'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ChatWidget() {
  const { isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi — I'm the SentinelStack assistant. I can help with product FAQs (no account access). Try: \n- How do I generate and download a report?\n- Where do I configure webhooks?\n- How does billing/subscription work?" },
  ]);
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: 'end' }); }, [open, messages.length]);
  const isAllowedPath = pathname === '/' || (pathname || '').startsWith('/dashboard');
  React.useEffect(() => { if (!isAllowedPath) setOpen(false); }, [isAllowedPath]);
  if (loading || !isAuthenticated || !isAllowedPath) return null;

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages); setInput(''); setSending(true);
    try {
      const res = await api.post('/ai/chat', { messages: nextMessages });
      const reply = String(res?.data?.reply || '').trim();
      if (!reply) throw new Error('Empty assistant reply');
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      toast({ title: 'Assistant error', description: e?.response?.data?.message || e?.message || 'Failed to send message', variant: 'destructive' });
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry — I couldn't respond right now. Please try again in a moment." }]);
    } finally { setSending(false); }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-3">
      {open ? (
        <Card className="flex h-[70vh] max-h-[560px] w-[92vw] max-w-[420px] flex-col overflow-hidden border-cyan-200/10 bg-[#071317] text-slate-100 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200/10 bg-cyan-300/[0.06] text-cyan-200"><Bot className="h-4 w-4" /></span>
              <div><div className="text-sm font-medium leading-tight">SentinelStack Assistant</div><div className="text-[10px] text-slate-600">Product guidance · no account access</div></div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant" className="h-8 w-8 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"><X className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1 px-3 py-3">
            <div className="space-y-3">
              {messages.map((m, idx) => <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}><div className={m.role === 'user' ? 'max-w-[85%] rounded-lg border border-cyan-200/10 bg-cyan-300/[0.06] px-3 py-2 text-sm whitespace-pre-wrap text-cyan-50' : 'max-w-[85%] rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2 text-sm whitespace-pre-wrap text-slate-300'}>{m.content}</div></div>)}
              {sending ? <div className="flex justify-start"><div className="rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2 text-sm text-slate-600">Thinking…</div></div> : null}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
          <div className="flex gap-2 border-t border-white/[0.06] p-3">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" aria-label="Ask the assistant" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} disabled={sending} className="h-[44px] min-h-[44px] resize-none border-white/[0.07] bg-black/20 text-slate-200 placeholder:text-slate-700 focus-visible:ring-cyan-300/20" />
            <Button onClick={sendMessage} disabled={sending || !input.trim()} aria-label="Send message" className="h-11 w-11 shrink-0 bg-cyan-300/[0.10] p-0 text-cyan-100 hover:bg-cyan-300/[0.16]"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      ) : null}
      <Button
        variant="ghost"
        className="h-12 w-12 rounded-full border border-cyan-200/15 bg-[#071317] p-0 text-cyan-100 shadow-[0_10px_35px_rgba(0,0,0,.42),0_0_24px_rgba(33,212,253,.10)] transition-[background-color,border-color,transform,box-shadow] duration-200 hover:border-cyan-200/30 hover:bg-[#0a1b20] hover:shadow-[0_12px_40px_rgba(0,0,0,.48),0_0_30px_rgba(33,212,253,.18)] active:scale-95"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Hide assistant' : 'Open SentinelStack assistant'}
        title={open ? 'Close assistant' : 'Open SentinelStack assistant'}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>
    </div>
  );
}
