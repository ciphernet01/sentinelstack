import { ai } from '../ai/genkit';
import { z } from 'zod';

export type AiExecutiveSummary = {
  executiveSummary: string;
  remediationExplanations: string;
};

const ReportSummaryInputSchema = z.object({
  technicalFindings: z.string().describe('The technical findings from the security assessment.'),
});

const ReportSummaryOutputSchema = z.object({
  executiveSummary: z.string().describe('A business-friendly summary of the technical findings.'),
  remediationExplanations: z.string().describe('Clear and actionable remediation explanations.'),
});

// Define the prompt on the shared Genkit instance so it can be used from
// the backend (Express) context without relying on Next.js server actions.
const reportSummaryPrompt = ai.definePrompt({
  name: 'reportSummaryPrompt',
  input: { schema: ReportSummaryInputSchema },
  output: { schema: ReportSummaryOutputSchema },
  prompt: `You are an AI assistant designed to translate complex technical security findings into easy-to-understand business language for non-technical stakeholders.

Given the following technical findings from a security assessment, generate an executive summary that highlights the key business risks and their potential impact. Also, provide clear and actionable remediation explanations for each finding.

Technical Findings:
{{technicalFindings}}

Executive Summary:
[Provide a concise and non-technical summary of the findings, emphasizing business impact]

Remediation Explanations:
[Explain how to fix each issue in simple terms, focusing on the steps to mitigate the risks]`,
});

/**
 * Generates an AI-powered executive summary for a security assessment.
 *
 * This is best-effort: if the AI service is unavailable or fails, we return
 * null rather than blocking report generation. The report is always generated;
 * the AI summary is an enhancement on top.
 *
 * This service runs in the backend (Express) context. It uses the Genkit
 * instance directly (via relative import) rather than the Next.js server
 * action flow, to avoid 'use server' / path-alias resolution issues in the
 * compiled backend.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isTransientError = (error: unknown): boolean => {
  const status = (error as { code?: number | string })?.code;
  const source = (error as { status?: number | string })?.status;
  const s = String(status ?? source ?? '').toUpperCase();
  // 429 rate-limit, 5xx server-side overload (e.g. Google Gemini 503 during
  // high demand), and UNAVAILABLE (gRPC-style) are safe to retry.
  return s === '429' || s === '500' || s === '502' || s === '503' || s === '504' || s.includes('UNAVAILABLE');
};

export async function generateAiExecutiveSummary(
  assessmentName: string,
  targetUrl: string,
  riskScore: number | null,
  findings: unknown[],
): Promise<AiExecutiveSummary | null> {
  // Only attempt AI summarization when there is something to summarize.
  if (!findings || findings.length === 0) {
    return null;
  }

  // Guard: never make the AI call (and never block report generation) when no
  // Google AI / Gemini API key is configured. The Genkit googleAI plugin reads
  // GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY from the environment.
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY,
  );
  if (!hasApiKey) {
    console.log(
      '[AI Summary] No Gemini/Google API key configured — skipping AI executive summary. ' +
        'Set GEMINI_API_KEY to enable AI-powered executive summaries.',
    );
    return null;
  }

  const technicalFindings = JSON.stringify(
    {
      assessmentName,
      targetUrl,
      riskScore,
      totalFindings: findings.length,
      findings,
    },
    null,
    2,
  );

  // Retry transient provider errors (503/429/5xx) with exponential backoff so
  // a temporary Google Gemini spike doesn't drop the AI summary from a report.
  // A hard deadline bounds the total time so AI latency can never push the
  // overall report-generate request past front-end/proxy timeouts.
  const maxAttempts = Math.max(1, Number(process.env.AI_SUMMARY_RETRY_ATTEMPTS) || 3);
  const baseDelayMs = Math.max(500, Number(process.env.AI_SUMMARY_RETRY_BASE_MS) || 1500);
  const deadlineMs = Math.max(1000, Number(process.env.AI_SUMMARY_RETRY_DEADLINE_MS) || 8000);
  const startedAt = Date.now();

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await reportSummaryPrompt({ technicalFindings });

      if (!result?.output?.executiveSummary) {
        console.error('[AI Summary] No executiveSummary in AI response');
        return null;
      }

      return {
        executiveSummary: result.output.executiveSummary,
        remediationExplanations: result.output.remediationExplanations || '',
      };
    } catch (error) {
      lastError = error;
      const retriable = isTransientError(error);
      if (!retriable || attempt >= maxAttempts) {
        break;
      }
      // Stop retrying if we'd exceed the overall AI time budget.
      const elapsed = Date.now() - startedAt;
      if (elapsed >= deadlineMs) {
        console.warn(`[AI Summary] Reached retry deadline (${deadlineMs}ms) after attempt ${attempt}/${maxAttempts} — skipping remaining retries`);
        break;
      }
      // Exponential backoff with jitter (1.5s, 3s, 6s, ...) — retry up to 3x.
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), deadlineMs / 2) + Math.random() * 400;
      console.warn(
        `[AI Summary] Attempt ${attempt}/${maxAttempts} failed (${retriable ? 'transient' : 'fatal'}) — ` +
          `retrying in ${Math.round(delay)}ms. Error code: ${(error as { code?: string })?.code ?? 'unknown'}`,
      );
      await sleep(delay);
    }
  }

  // Never let AI failure block report generation. Log and continue.
  console.error('[AI Summary] Failed to generate executive summary after retries:', lastError);
  return null;
}
