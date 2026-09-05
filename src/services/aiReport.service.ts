import { generateReportSummary } from '@/ai/flows/ai-powered-report-summarization';

export type AiExecutiveSummary = {
  executiveSummary: string;
  remediationExplanations: string;
};

/**
 * Generates an AI-powered executive summary for a security assessment.
 *
 * This is best-effort: if the AI service is unavailable or fails, we return
 * null rather than blocking report generation. The report is always generated;
 * the AI summary is an enhancement on top.
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

    const result = await generateReportSummary({ technicalFindings });

    if (!result?.executiveSummary) {
      return null;
    }

    return {
      executiveSummary: result.executiveSummary,
      remediationExplanations: result.remediationExplanations || '',
    };
  } catch (error) {
    // Never let AI failure block report generation. Log and continue.
    console.error('[AI Summary] Failed to generate executive summary:', error);
    return null;
  }
}
