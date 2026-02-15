import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { answerProductFaqAssistant } from '../ai/flows/product-faq-assistant';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function isChatRole(value: unknown): value is ChatMessage['role'] {
  return value === 'user' || value === 'assistant';
}

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as any).role;
    const content = (item as any).content;
    if (!isChatRole(role)) continue;
    if (typeof content !== 'string') continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }

  return out;
}

function toTranscript(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const label = m.role === 'user' ? 'User' : 'Assistant';
      return `${label}: ${m.content}`;
    })
    .join('\n');
}

export const aiController = {
  chat: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messages = normalizeMessages((req.body as any)?.messages);
    if (messages.length === 0) {
      return res.status(400).json({ message: 'messages must be a non-empty array' });
    }

    const maxMessages = Number(process.env.AI_CHAT_MAX_MESSAGES || 12);
    const recentMessages = messages.slice(-Math.max(1, Math.min(50, maxMessages)));

    try {
      const output = await answerProductFaqAssistant({
        transcript: toTranscript(recentMessages),
      });

      const reply = String(output?.reply || '').trim();
      if (!reply) {
        return res.status(502).json({ message: 'Empty AI response' });
      }

      return res.status(200).json({ reply });
    } catch (e: any) {
      return res.status(500).json({ message: 'AI request failed', error: e?.message || String(e) });
    }
  },
};
