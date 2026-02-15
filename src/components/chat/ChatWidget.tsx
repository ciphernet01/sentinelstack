'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function ChatWidget() {
  const { isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm the SentinelStack assistant. I can help with product FAQs (no account access). Try: \n- How do I generate and download a report?\n- Where do I configure webhooks?\n- How does billing/subscription work?",
    },
  ]);
  const [sending, setSending] = React.useState(false);

  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Best-effort scroll-to-bottom
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages.length]);

  const isAllowedPath = pathname === '/' || (pathname || '').startsWith('/dashboard');

  React.useEffect(() => {
    if (!isAllowedPath) {
      setOpen(false);
    }
  }, [isAllowedPath]);

  if (loading || !isAuthenticated || !isAllowedPath) {
    return null;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/ai/chat', {
        messages: nextMessages,
      });

      const reply = String(res?.data?.reply || '').trim();
      if (!reply) {
        throw new Error('Empty assistant reply');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      toast({
        title: 'Assistant error',
        description: e?.response?.data?.message || e?.message || 'Failed to send message',
        variant: 'destructive',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Sorry — I couldn't respond right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <Card className="w-[92vw] max-w-[420px] h-[70vh] max-h-[560px] border bg-card text-card-foreground flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">Assistant</div>
              <div className="text-xs text-muted-foreground leading-tight">FAQ-only • No account access</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close assistant">
              Close
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-3">
            <div className="space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={
                    m.role === 'user'
                      ? 'flex justify-end'
                      : 'flex justify-start'
                  }
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap'
                        : 'max-w-[85%] rounded-lg border bg-muted px-3 py-2 text-sm whitespace-pre-wrap'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Ask the assistant"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={sending}
              className="min-h-[44px] h-[44px] resize-none"
            />
            <Button onClick={sendMessage} disabled={sending || !input.trim()} aria-label="Send message">
              Send
            </Button>
          </div>
        </Card>
      ) : null}

      <Button
        variant={open ? 'secondary' : 'default'}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Hide assistant' : 'Open assistant'}
      >
        {open ? 'Hide assistant' : 'Assistant'}
      </Button>
    </div>
  );
}
