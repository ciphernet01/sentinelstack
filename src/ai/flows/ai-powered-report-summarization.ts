'use server';
/**
 * @fileOverview This file contains the Genkit flow for AI-powered report summarization.
 *
 * - generateReportSummary - A function that takes technical findings and translates them into a business-friendly summary.
 * - ReportSummaryInput - The input type for the generateReportSummary function.
 * - ReportSummaryOutput - The return type for the generateReportSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReportSummaryInputSchema = z.object({
  technicalFindings: z
    .string()
    .describe('The technical findings from the security assessment.'),
});
export type ReportSummaryInput = z.infer<typeof ReportSummaryInputSchema>;

const ReportSummaryOutputSchema = z.object({
  executiveSummary: z
    .string()
    .describe('A business-friendly summary of the technical findings.'),
  remediationExplanations: z
    .string()
    .describe('Clear and actionable remediation explanations.'),
});
export type ReportSummaryOutput = z.infer<typeof ReportSummaryOutputSchema>;

export async function generateReportSummary(
  input: ReportSummaryInput
): Promise<ReportSummaryOutput> {
  return reportSummaryFlow(input);
}

const reportSummaryPrompt = ai.definePrompt({
  name: 'reportSummaryPrompt',
  input: {schema: ReportSummaryInputSchema},
  output: {schema: ReportSummaryOutputSchema},
  prompt: `You are an AI assistant designed to translate complex technical security findings into easy-to-understand business language for non-technical stakeholders.

  Given the following technical findings from a security assessment, generate an executive summary that highlights the key business risks and their potential impact. Also, provide clear and actionable remediation explanations for each finding.

  Technical Findings:
  {{technicalFindings}}

  Executive Summary:
  [Provide a concise and non-technical summary of the findings, emphasizing business impact]

  Remediation Explanations:
  [Explain how to fix each issue in simple terms, focusing on the steps to mitigate the risks]`,
});

const reportSummaryFlow = ai.defineFlow(
  {
    name: 'reportSummaryFlow',
    inputSchema: ReportSummaryInputSchema,
    outputSchema: ReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await reportSummaryPrompt(input);
    return output!;
  }
);
