
import { prisma } from '../config/db';
import { calculateRiskScore } from './riskScoring.service';
import logger from '../utils/logger';
import { spawn } from 'child_process';
import type { Prisma } from '@prisma/client';
import { getEffectiveScannerConfig, isScannerTimeoutFinding } from './scannerConfig.service';
import { webhookService } from './webhook.service';

// A simple in-memory queue to prevent multiple workers on the same assessment.
const activeWorkers = new Set<string>();

/**
 * Optional scan configuration options that can be passed to tools
 */
export interface ScanOptions {
    cookies?: string;      // Cookie string like 'session=abc; token=xyz'
    headers?: Record<string, string>;  // Custom headers like { "Authorization": "Bearer token" }
    wordlist?: string;     // Path to custom wordlist file
    [key: string]: unknown; // Allow additional options
}

/**
 * Executes the Python scanner script and returns the findings.
 * @param targetUrl The URL to scan.
 * @param scope The assessment scope (e.g., WEB, API).
 * @param assessmentId The assessment ID (passed through to the scanner context).
 * @param scanOptions Optional configuration like cookies, headers, wordlist
 * @returns A promise that resolves to an array of findings.
 */
const runPythonScanner = (
    targetUrl: string,
    scope: string,
    assessmentId: string,
    preset: string = 'default',
    authorizationConfirmed: boolean = false,
    scanOptions: ScanOptions = {},
): Promise<Prisma.FindingCreateManyInput[]> => {
    return new Promise((resolve, reject) => {
        const config = getEffectiveScannerConfig(preset, scope);
        const runtime = config.runtime;
        const timeoutMs = config.timeoutMs;
        const timeoutSource = config.timeoutSource;
        const stuckWarnMs = config.stuckWarnMs;
        const toolStuckWarnMs = config.toolStuckWarnMs;
        const killOnStuck = config.killOnStuck;
        const watchdogIntervalMs = config.watchdogIntervalMs;
        const normalizedPreset = config.preset;

        // Assumes a master script `scanner.py` exists in a `scanners` directory at the project root.
        // This script is responsible for orchestrating the actual Python tools.
        const scannerArgs = [
            './scanners/scanner.py',
            '--target',
            targetUrl,
            '--scope',
            scope,
            '--preset',
            normalizedPreset,
            '--assessment_id',
            assessmentId,
            '--authorization_confirmed',
            authorizationConfirmed ? 'true' : 'false',
        ];
        
        // Add optional scan options if provided
        if (scanOptions.cookies) {
            scannerArgs.push('--cookies', scanOptions.cookies);
        }
        if (scanOptions.headers && Object.keys(scanOptions.headers).length > 0) {
            scannerArgs.push('--headers', JSON.stringify(scanOptions.headers));
        }
        if (scanOptions.wordlist) {
            scannerArgs.push('--wordlist', scanOptions.wordlist);
        }
        // Pass any additional scan options as JSON
        const extraOptions = { ...scanOptions };
        delete extraOptions.cookies;
        delete extraOptions.headers;
        delete extraOptions.wordlist;
        if (Object.keys(extraOptions).length > 0) {
            scannerArgs.push('--scan_options', JSON.stringify(extraOptions));
        }

        const pythonProcess = runtime === 'docker'
            ? (() => {
                const image = process.env.SCANNER_DOCKER_IMAGE || 'sentinel-stack-scanner:latest';
                const repoRoot = process.cwd();
                const volumeArg = `${repoRoot}:/work`;

                // Pass-through any SENTINEL_* env vars to the container (e.g., log/threat-intel inputs).
                const forwardedEnvArgs: string[] = [];
                for (const [key, value] of Object.entries(process.env)) {
                    if (!key.startsWith('SENTINEL_')) continue;
                    if (typeof value !== 'string' || value.length === 0) continue;
                    forwardedEnvArgs.push('-e', `${key}=${value}`);
                }

                // Note: On Windows, Docker Desktop supports mounting via absolute paths.
                // If scanning a local dev server, use host.docker.internal instead of localhost.
                return spawn('docker', [
                    'run',
                    '--rm',
                    ...forwardedEnvArgs,
                    '-v',
                    volumeArg,
                    '-w',
                    '/work',
                    image,
                    'python',
                    '-u',
                    ...scannerArgs,
                ]);
            })()
            : spawn('python', ['-u', ...scannerArgs], {
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                },
            });

        let findingsOutput = '';
        let errorOutput = '';

        let settled = false;
        const safeResolve = (value: Prisma.FindingCreateManyInput[]) => {
            if (settled) return;
            settled = true;
            stopWatchdog();
            clearTimeout(timeoutTimer);
            resolve(value);
        };

        const safeReject = (err: Error) => {
            if (settled) return;
            settled = true;
            stopWatchdog();
            clearTimeout(timeoutTimer);
            reject(err);
        };

        // Watchdog state: helps detect when scans look stuck.
        let lastProgressAt = Date.now();
        let currentToolName: string | null = null;
        let currentToolStartedAt: number | null = null;
        let watchdogTimer: NodeJS.Timeout | null = null;
        let lastWarnAt = 0;
        let lastToolLongWarnAt = 0;

        const bumpProgress = () => {
            lastProgressAt = Date.now();
        };

        const startWatchdog = () => {
            if (watchdogTimer) return;
            watchdogTimer = setInterval(() => {
                const now = Date.now();
                const idleForMs = now - lastProgressAt;

                // Rate-limit warnings to avoid log spam.
                if (idleForMs >= stuckWarnMs && now - lastWarnAt >= stuckWarnMs) {
                    const toolInfo = currentToolName
                        ? ` currentTool=${currentToolName} toolRunningForMs=${currentToolStartedAt ? now - currentToolStartedAt : 'unknown'}`
                        : '';

                    logger.warn(
                        `Scanner appears stuck: no output for ${idleForMs}ms (runtime=${runtime}, preset=${normalizedPreset}, assessmentId=${assessmentId}).${toolInfo}`,
                    );
                    lastWarnAt = now;

                    if (killOnStuck) {
                        // Only kill aggressively when truly idle BETWEEN tools.
                        // If a tool is currently running, do NOT kill based solely on lack of output;
                        // rely on the global timeout as the hard stop.
                        const shouldKill = !currentToolName && idleForMs >= stuckWarnMs;

                        if (shouldKill) {
                            logger.error(
                                `Killing scanner due to SCANNER_KILL_ON_STUCK=true after ${idleForMs}ms without output (pid=${pythonProcess.pid}, currentTool=${currentToolName ?? 'none'}).`,
                            );
                            pythonProcess.kill('SIGKILL');
                        } else if (currentToolName) {
                            logger.warn(
                                `Not killing scanner despite ${idleForMs}ms idle because a tool is running (tool=${currentToolName}, toolRunningForMs=${currentToolStartedAt ? now - currentToolStartedAt : 'unknown'}, toolStuckWarnMs=${toolStuckWarnMs}).`,
                            );
                        }
                    }
                }

                if (
                    currentToolName &&
                    currentToolStartedAt &&
                    now - currentToolStartedAt >= toolStuckWarnMs &&
                    now - lastToolLongWarnAt >= toolStuckWarnMs
                ) {
                    // This is informational and may happen on heavy tools; it helps pinpoint which tool is slow.
                    logger.warn(
                        `Scanner tool running long: tool=${currentToolName} durationMs=${now - currentToolStartedAt} (runtime=${runtime}, preset=${normalizedPreset}, assessmentId=${assessmentId}).`,
                    );
                    lastToolLongWarnAt = now;
                }
            }, watchdogIntervalMs);

            // Don't keep the Node process alive solely for the watchdog.
            watchdogTimer.unref?.();
        };

        const stopWatchdog = () => {
            if (watchdogTimer) {
                clearInterval(watchdogTimer);
                watchdogTimer = null;
            }
        };

        const timeoutTimer = setTimeout(async () => {
            logger.warn(
                `Scanner timeout after ${timeoutMs}ms (runtime=${runtime}, preset=${normalizedPreset}, assessmentId=${assessmentId}). Killing process pid=${pythonProcess.pid}.`,
            );

            try {
                pythonProcess.kill('SIGKILL');
            } catch {
                // ignore
            }

            // Try to recover accumulated findings from backup file
            let recoveredFindings: Prisma.FindingCreateManyInput[] = [];
            try {
                const os = await import('os');
                const fs = await import('fs');
                const path = await import('path');
                const backupPath = path.join(os.tmpdir(), 'sentinel_scanner', `findings_${assessmentId}.json`);
                
                if (fs.existsSync(backupPath)) {
                    const backupData = fs.readFileSync(backupPath, 'utf-8');
                    const parsed = JSON.parse(backupData);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        recoveredFindings = parsed;
                        logger.info(`Recovered ${recoveredFindings.length} findings from backup file after timeout.`);
                    }
                    // Clean up backup file
                    fs.unlinkSync(backupPath);
                }
            } catch (e) {
                logger.debug(`Could not recover findings from backup: ${e}`);
            }

            const timeoutNotice: Prisma.FindingCreateManyInput = {
                assessmentId,
                toolName: 'scanner',
                title: 'Scan reached time limit (results may be incomplete)',
                description:
                    `This run stopped after ${Math.round(timeoutMs / 1000)}s due to the configured time limit (${timeoutSource}). Some tools may not have finished, so results may be incomplete.`,
                severity: 'INFO',
                remediation:
                    `If you want deeper coverage, rerun with a longer timeout (set SCANNER_TIMEOUT_MS) and/or choose a deeper preset.`,
                evidence: {
                    timeoutMs,
                    timeoutSource,
                    runtime,
                    preset: normalizedPreset,
                    scope,
                    recoveredFindingsCount: recoveredFindings.length,
                } as any,
                complianceMapping: [],
            };

            safeResolve([...recoveredFindings, timeoutNotice]);
        }, timeoutMs);
        timeoutTimer.unref?.();

        logger.info(
            `Spawning scanner runtime=${runtime} for ${targetUrl} with scope ${scope}, preset ${normalizedPreset} (assessmentId=${assessmentId}, authorizationConfirmed=${authorizationConfirmed})`,
        );

        logger.info(
            `Scanner watchdog config: stuckWarnMs=${stuckWarnMs} toolStuckWarnMs=${toolStuckWarnMs} killOnStuck=${killOnStuck} watchdogIntervalMs=${watchdogIntervalMs} timeoutMs=${timeoutMs} (timeoutSource=${timeoutSource}, runtime=${runtime}, preset=${normalizedPreset}, assessmentId=${assessmentId})`,
        );

        startWatchdog();

        pythonProcess.stdout.on('data', (data) => {
            findingsOutput += data.toString();
            bumpProgress();
        });

        pythonProcess.stderr.on('data', (data) => {
            // This captures messages printed to stderr by the Python script, useful for debugging progress.
            const text = data.toString();
            errorOutput += text;

            // Split because multiple lines may arrive in a single chunk.
            for (const rawLine of text.split(/\r?\n/)) {
                const line = rawLine.trim();
                if (!line) continue;

                // Surface explicit progress lines at info level so long scans don't look stuck.
                if (line.startsWith('[SCAN]')) {
                    logger.info(`[Scanner Progress for ${targetUrl}]: ${line}`);

                    // Parse tool_start/tool_end to improve stuck diagnostics.
                    // Examples:
                    //  [SCAN] tool_start name=ai30_api_enum
                    //  [SCAN] tool_end name=ai30_api_enum status=ok findings=3 duration_ms=1234
                    const isToolStart = line.includes('tool_start') && line.includes('name=');
                    const isToolEnd = line.includes('tool_end') && line.includes('name=');
                    const nameMatch = line.match(/name=([^\s]+)/);
                    const name = nameMatch?.[1] || null;

                    if (isToolStart && name) {
                        currentToolName = name;
                        currentToolStartedAt = Date.now();
                    }

                    if (isToolEnd && name && currentToolName === name) {
                        currentToolName = null;
                        currentToolStartedAt = null;
                    }
                } else {
                    logger.debug(`[Scanner STDERR for ${targetUrl}]: ${line}`);
                }
            }

            bumpProgress();
        });

        pythonProcess.on('close', (code) => {
            if (settled) return;
            stopWatchdog();
            clearTimeout(timeoutTimer);
            if (code !== 0) {
                logger.error(`Python scanner exited with code ${code}: ${errorOutput}`);
                return safeReject(new Error(`Scanner failed: ${errorOutput}`));
            }
            try {
                // Try to extract the first valid JSON object/array from findingsOutput
                let findings;
                try {
                    findings = JSON.parse(findingsOutput);
                } catch (e1) {
                    // Try to recover if there is extra output before/after JSON
                    const jsonMatch = findingsOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                    if (jsonMatch) {
                        try {
                            findings = JSON.parse(jsonMatch[0]);
                            logger.warn('Recovered findings by extracting JSON from noisy output.');
                        } catch (e2) {
                            logger.error('Failed to parse extracted JSON from Python output.', { output: findingsOutput });
                            throw e2;
                        }
                    } else {
                        logger.error('No JSON object/array found in Python output.', { output: findingsOutput });
                        throw e1;
                    }
                }
                // Clean up backup file on successful completion
                try {
                    const os = require('os');
                    const fs = require('fs');
                    const path = require('path');
                    const backupPath = path.join(os.tmpdir(), 'sentinel_scanner', `findings_${assessmentId}.json`);
                    if (fs.existsSync(backupPath)) {
                        fs.unlinkSync(backupPath);
                    }
                } catch {
                    // ignore cleanup errors
                }
                safeResolve(findings);
            } catch (e) {
                logger.error('Failed to parse JSON output from Python script.', { output: findingsOutput });
                safeReject(e as Error);
            }
        });

        pythonProcess.on('error', (err) => {
            if (settled) return;
            stopWatchdog();
            clearTimeout(timeoutTimer);
            logger.error(`Failed to spawn scanner process (runtime=${runtime}):`, err);
            safeReject(err);
        });
    });
};


/**
 * Simulates a background worker process to run an assessment.
 * This function should be called without `await` to run in the background.
 * @param assessmentId The ID of the assessment to process.
 * @param targetUrl The URL to scan.
 * @param scope The scope of the scan.
 * @param scanOptions Optional configuration like cookies, headers, wordlist
 */
export const startAssessmentWorker = async (
    assessmentId: string,
    targetUrl: string,
    scope: string,
    preset: string = 'default',
    _authorizationConfirmed: boolean = false,
    scanOptions: ScanOptions = {},
): Promise<void> => {
    if (activeWorkers.has(assessmentId)) {
        logger.warn(`Worker already active for assessment ID: ${assessmentId}. Skipping.`);
        return;
    }
    
    activeWorkers.add(assessmentId);
    logger.info(`Starting worker for assessment ID: ${assessmentId}`);

    try {
        const effectiveConfig = getEffectiveScannerConfig(preset, scope);

        // 1. Mark assessment as IN_PROGRESS and persist effective config for auditability.
        await prisma.assessment.update({
            where: { id: assessmentId },
            data: {
                status: 'IN_PROGRESS',
                scannerConfig: {
                    ...effectiveConfig,
                    scope,
                    scanOptions: scanOptions, // Store scan options for reference
                    capturedAt: new Date().toISOString(),
                } as any,
                endedEarly: false,
                endedEarlyReason: null,
            },
        });

        logger.info(`Assessment ${assessmentId} marked as IN_PROGRESS.`);

        // 2. Run the actual security tools via the Python script
        const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            select: { authorizationConfirmed: true },
        });

        const findings = await runPythonScanner(
            targetUrl,
            scope,
            assessmentId,
            preset,
            Boolean(assessment?.authorizationConfirmed),
            scanOptions,
        );

        const endedEarlyReason = findings.some(isScannerTimeoutFinding) ? 'TIMEOUT' : null;
        
        if (findings.length > 0) {
            // 3. Save the findings from the script to the database
            const findingsData = findings.map(finding => ({
                ...finding,
                assessmentId: assessmentId,
            }));

            await prisma.finding.createMany({
                data: findingsData,
                skipDuplicates: true,
            });
            logger.info(`Saved ${findings.length} findings from scanner for assessment ${assessmentId}.`);
        } else {
            logger.info(`No findings returned from scanner for assessment ${assessmentId}.`);
        }

        // 4. Calculate final risk score based on the new findings
        const allFindings = await prisma.finding.findMany({ where: { assessmentId }});
        const riskScore = calculateRiskScore(allFindings);

        // 5. Mark assessment as COMPLETED and save the score
        const completedAssessment = await prisma.assessment.update({
            where: { id: assessmentId },
            data: { 
                status: 'COMPLETED',
                riskScore: riskScore,
                endedEarly: Boolean(endedEarlyReason),
                endedEarlyReason,
            },
            include: {
                organization: { select: { id: true } },
            },
        });
        
        logger.info(`Assessment ${assessmentId} COMPLETED with risk score: ${riskScore}.`);
        
        // 6. Trigger webhooks for scan completion
        if (completedAssessment.organizationId) {
            const criticalFindings = allFindings.filter(f => f.severity === 'CRITICAL').length;
            const highFindings = allFindings.filter(f => f.severity === 'HIGH').length;
            const mediumFindings = allFindings.filter(f => f.severity === 'MEDIUM').length;
            const lowFindings = allFindings.filter(f => f.severity === 'LOW').length;
            
            // Trigger SCAN_COMPLETED webhook
            webhookService.trigger(completedAssessment.organizationId, 'SCAN_COMPLETED', {
                assessmentId,
                name: completedAssessment.name,
                targetUrl: completedAssessment.targetUrl,
                riskScore,
                findings: {
                    critical: criticalFindings,
                    high: highFindings,
                    medium: mediumFindings,
                    low: lowFindings,
                    total: allFindings.length,
                },
                completedAt: new Date().toISOString(),
            });
            
            // Trigger CRITICAL_FINDING webhook if any critical findings
            if (criticalFindings > 0) {
                webhookService.trigger(completedAssessment.organizationId, 'CRITICAL_FINDING', {
                    assessmentId,
                    name: completedAssessment.name,
                    targetUrl: completedAssessment.targetUrl,
                    criticalCount: criticalFindings,
                    message: `${criticalFindings} critical vulnerability(ies) found in ${completedAssessment.name}`,
                });
            }
        }

    } catch (error) {
        logger.error(`Error in worker for assessment ${assessmentId}:`, error);
        try {
            const failedAssessment = await prisma.assessment.update({
                where: { id: assessmentId },
                data: { status: 'REJECTED' },
                include: { organization: { select: { id: true } } },
            });
            
            // Trigger SCAN_FAILED webhook
            if (failedAssessment.organizationId) {
                webhookService.trigger(failedAssessment.organizationId, 'SCAN_FAILED', {
                    assessmentId,
                    name: failedAssessment.name,
                    targetUrl: failedAssessment.targetUrl,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    failedAt: new Date().toISOString(),
                });
            }
        } catch (updateError) {
            logger.error(`Failed to mark assessment ${assessmentId} as REJECTED:`, updateError);
        }
    } finally {
        // Clean up the worker from the active set
        activeWorkers.delete(assessmentId);
    }
};
