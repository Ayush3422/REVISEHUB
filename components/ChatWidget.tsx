'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';
import { aiHeaders } from '@/lib/client/ai-key';
import { Markdown } from './ui/Markdown';
import { CommentIcon } from './icons/CommentIcon';

export function ChatWidget({ owner, repo }: { owner: string; repo: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Escape closes the dialog, which is the behaviour a keyboard user expects.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isSending) return;

    const history = messages;
    setMessages([...history, { role: 'user', content: question }]);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ owner, repo, question, history }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'The assistant could not answer.');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant could not answer.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open repository assistant"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-neon-violet text-text-primary shadow-lg shadow-neon-violet/30 transition hover:scale-105 hover:bg-neon-violet/85"
      >
        <CommentIcon className="h-6 w-6" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-white/[0.03] p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
        className="flex h-[75vh] w-full max-w-lg flex-col glass-strong rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 id="chat-title" className="font-semibold text-text-primary">
              Repository assistant
            </h2>
            <p className="font-mono text-xs text-text-secondary">
              {owner}/{repo}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close assistant"
            className="rounded-md px-2 text-2xl leading-none text-muted transition hover:text-text-primary"
          >
            &times;
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="rounded-lg bg-white/[0.03] p-4 text-sm text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">Ask about this repository.</p>
              <p>
                The assistant can see the file listing and the README. It will tell you when a
                question needs a file it has not been given rather than guessing.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-neon-violet text-text-primary'
                    : 'border border-white/[0.08] bg-white/[0.03] text-text-secondary'
                }`}
              >
                {msg.role === 'user' ? msg.content : <Markdown text={msg.content} />}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start" aria-live="polite">
              <div className="flex items-center gap-2 glass-card rounded-xl bg-white/[0.03] px-4 py-2.5 text-sm text-text-secondary">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-neon-violet" />
                Thinking…
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-2.5 text-sm text-red-300"
            >
              {error}
            </p>
          )}
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-white/[0.07] p-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What does this project do?"
            aria-label="Message"
            maxLength={2000}
            disabled={isSending}
            className="flex-1 rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:border-neon-violet/60 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-md bg-neon-violet px-4 py-2 text-sm font-semibold text-[#12071f] shadow-[0_0_20px_rgba(167,139,250,0.35)] transition hover:brightness-110 disabled:bg-muted disabled:text-text-secondary"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
