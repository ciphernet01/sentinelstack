
'use server';
/**
 * @fileOverview A Genkit flow for summarizing security findings.
 *
 * - summarizeFindings - A function that takes security findings and returns a concise summary.
 * - SummarizeFindingsInput - The input type for the summarizeFindings function.
 * - SummarizeFindingsOutput - The return type for the summarizeFindings function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFindingsInputSchema = z.object({
  findings: z.string().describe('A JSON string of security findings.'),
});
export type SummarizeFindingsInput = z.infer<typeof SummarizeFindingsInputSchema>;

const SummarizeFindingsOutputSchema = z.object({
  summary: z.string().describe('A concise, executive-level summary of the key security findings.'),
});
export type SummarizeFindingsOutput = z.infer<typeof SummarizeFindingsOutputSchema>;

export async function summarizeFindings(input: SummarizeFindingsInput): Promise<SummarizeFindingsOutput> {
  return summarizeFindingsFlow(input);
}

const summarizeFindingsPrompt = ai.definePrompt({
  name: 'summarizeFindingsPrompt',
  input: {schema: SummarizeFindingsInputSchema},
  output: {schema: SummarizeFindingsOutputSchema},
  prompt: `You are a security expert providing an executive summary.
  
  Analyze the following JSON blob of security findings and provide a short, high-level summary (2-3 sentences) of the most critical risks. Focus on the business impact, not the technical details.

  Findings:
  {{{findings}}}
  `,
});

const summarizeFindingsFlow = ai.defineFlow(
  {
    name: 'summarizeFindingsFlow',
    inputSchema: SummarizeFindingsInputSchema,
    outputSchema: SummarizeFindingsOutputSchema,
  },
  async input => {
    const {output} = await summarizeFindingsPrompt(input);
    return output!;
  }
);
