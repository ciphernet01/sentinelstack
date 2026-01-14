
import { prisma } from '../config/db';
import { calculateRiskScore } from './riskScoring.service';
import logger from '../utils/logger';
import { spawn } from 'child_process';
import type { Prisma } from '@prisma/client';

// A simple in-memory queue to prevent multiple workers on the same assessment.
const activeWorkers = new Set<string>();

/**
 * Executes the Python scanner script and returns the findings.
 * @param targetUrl The URL to scan.
 * @param scope The assessment scope (e.g., WEB, API).
 * @param assessmentId The assessment ID (passed through to the scanner context).
 * @returns A promise that resolves to an array of findings.
 */
const runPythonScanner = (
    targetUrl: string,
    scope: string,
    assessmentId: string,
    preset: string = 'default',
    authorizationConfirmed: boolean = false,
): Promise<Prisma.FindingCreateManyInput[]> => {
    return new Promise((resolve, reject) => {
        const runtime = String(process.env.SCANNER_RUNTIME || 'local').toLowerCase();

        const stuckWarnMs = Number(process.env.SCANNER_STUCK_WARN_MS || 2 * 60 * 1000);
        const toolStuckWarnMs = Number(process.env.SCANNER_TOOL_STUCK_WARN_MS || 5 * 60 * 1000);
        const killOnStuck = String(process.env.SCANNER_KILL_ON_STUCK || 'false').toLowerCase() === 'true';
        const watchdogIntervalMs = Number(process.env.SCANNER_WATCHDOG_INTERVAL_MS || 30 * 1000);

        // Normalize preset names to avoid registry warnings.
        const normalizedPreset = String(preset || 'default').trim().toLowerCase();

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
                    ...scannerArgs,
                ]);
            })()
            : spawn('python', scannerArgs);

        let findingsOutput = '';
        let errorOutput = '';

        // Watchdog state: helps detect when scans look stuck.
        let lastProgressAt = Date.now();
        let currentToolName: string | null = null;
        let currentToolStartedAt: number | null = null;
        let watchdogTimer: NodeJS.Timeout | null = null;
        let lastWarnAt = 0;

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
                        logger.error(
                            `Killing scanner due to SCANNER_KILL_ON_STUCK=true after ${idleForMs}ms without output (pid=${pythonProcess.pid}).`,
                        );
                        pythonProcess.kill('SIGKILL');
                    }
                }

                if (currentToolName && currentToolStartedAt && now - currentToolStartedAt >= toolStuckWarnMs) {
                    // This is informational and may happen on heavy tools; it helps pinpoint which tool is slow.
                    logger.warn(
                        `Scanner tool running long: tool=${currentToolName} durationMs=${now - currentToolStartedAt} (runtime=${runtime}, preset=${normalizedPreset}, assessmentId=${assessmentId}).`,
                    );
                    // Avoid repeated tool-long warnings every tick.
                    currentToolStartedAt = now;
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

        logger.info(
            `Spawning scanner runtime=${runtime} for ${targetUrl} with scope ${scope}, preset ${normalizedPreset} (assessmentId=${assessmentId}, authorizationConfirmed=${authorizationConfirmed})`,
        );

        startWatchdog();

        pythonProcess.stdout.on('data', (data) => {
            findingsOutput += data.toString();
            bumpProgress();
        });

        pythonProcess.stderr.on('data', (data) => {
            // This captures messages printed to stderr by the Python script, useful for debugging progress.
            errorOutput += data.toString();

            const line = data.toString().trim();
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

            bumpProgress();
        });

        pythonProcess.on('close', (code) => {
            stopWatchdog();
            if (code !== 0) {
                logger.error(`Python scanner exited with code ${code}: ${errorOutput}`);
                return reject(new Error(`Scanner failed: ${errorOutput}`));
            }
            try {
                // The Python script should print a JSON array of findings to stdout.
                const findings = JSON.parse(findingsOutput);
                resolve(findings);
            } catch (e) {
                logger.error('Failed to parse JSON output from Python script.');
                reject(e);
            }
        });

        pythonProcess.on('error', (err) => {
            stopWatchdog();
            logger.error(`Failed to spawn scanner process (runtime=${runtime}):`, err);
            reject(err);
        });
    });
};


/**
 * Simulates a background worker process to run an assessment.
 * This function should be called without `await` to run in the background.
 * @param assessmentId The ID of the assessment to process.
 * @param targetUrl The URL to scan.
 * @param scope The scope of the scan.
 */
export const startAssessmentWorker = async (
    assessmentId: string,
    targetUrl: string,
    scope: string,
    preset: string = 'default',
    _authorizationConfirmed: boolean = false,
): Promise<void> => {
    if (activeWorkers.has(assessmentId)) {
        logger.warn(`Worker already active for assessment ID: ${assessmentId}. Skipping.`);
        return;
    }
    
    activeWorkers.add(assessmentId);
    logger.info(`Starting worker for assessment ID: ${assessmentId}`);

    try {
        // 1. Mark assessment as IN_PROGRESS
        await prisma.assessment.update({
            where: { id: assessmentId },
            data: { status: 'IN_PROGRESS' },
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
        );
        
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
        await prisma.assessment.update({
            where: { id: assessmentId },
            data: { 
                status: 'COMPLETED',
                riskScore: riskScore
            },
        });
        
        logger.info(`Assessment ${assessmentId} COMPLETED with risk score: ${riskScore}.`);

    } catch (error) {
        logger.error(`Error in worker for assessment ${assessmentId}:`, error);
        try {
            await prisma.assessment.update({
                where: { id: assessmentId },
                data: { status: 'REJECTED' },
            });
        } catch (updateError) {
            logger.error(`Failed to mark assessment ${assessmentId} as REJECTED:`, updateError);
        }
    } finally {
        // Clean up the worker from the active set
        activeWorkers.delete(assessmentId);
    }
};
