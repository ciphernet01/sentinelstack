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

  try {
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

    const result = await reportSummaryPrompt({ technicalFindings });

    if (!result?.output?.executiveSummary) {
      return null;
    }

    return {
      executiveSummary: result.output.executiveSummary,
      remediationExplanations: result.output.remediationExplanations || '',
    };
  } catch (error) {
    // Never let AI failure block report generation. Log and continue.
    console.error('[AI Summary] Failed to generate executive summary:', error);
    return null;
  }
}
