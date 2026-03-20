import { ai } from '../genkit';
import { z } from 'genkit';
import { PRODUCT_FAQ } from '../knowledge/product-faq';

const ProductFaqAssistantInputSchema = z.object({
  transcript: z.string().describe('A short transcript of the recent chat, with roles.'),
});

type ProductFaqAssistantInput = z.infer<typeof ProductFaqAssistantInputSchema>;

const ProductFaqAssistantOutputSchema = z.object({
  reply: z.string().describe('A helpful answer grounded in the product FAQ.'),
});

type ProductFaqAssistantOutput = z.infer<typeof ProductFaqAssistantOutputSchema>;

const productFaqAssistantPrompt = ai.definePrompt({
  name: 'productFaqAssistantPrompt',
  input: { schema: ProductFaqAssistantInputSchema },
  output: { schema: ProductFaqAssistantOutputSchema },
  prompt: `You are SentinelStack's in-app assistant.

Rules:
- ONLY answer using the provided FAQ content.
- Do NOT claim access to user/org data.
- If the FAQ does not contain the answer, say you don't know.
- For account-specific issues, explicitly tell the user to contact support.
- Provide actionable steps when possible (e.g., which dashboard area/page to use).
- If the question is ambiguous, ask 1 short clarifying question.
- Keep answers concise (3-8 sentences).

FAQ:
${PRODUCT_FAQ}

Conversation transcript:
{{{transcript}}}

Return a single field JSON output with key "reply".
`,
});

export async function answerProductFaqAssistant(
  input: ProductFaqAssistantInput
): Promise<ProductFaqAssistantOutput> {
  const { output } = await productFaqAssistantPrompt(input);
  return output!;
}
