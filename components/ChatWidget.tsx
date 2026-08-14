'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatMessage } from '@/lib/types';
import { getAiKey } from '@/lib/client/ai-key';
import { clearConversation, loadConversation, saveConversation } from '@/lib/client/chat-store';
import { Markdown } from './ui/Markdown';
import { CommentIcon } from './icons/CommentIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { FileIcon } from './icons/FileIcon';

/** Prompts tailored to whichever section the user is looking at. */
const SUGGESTIONS: { match: RegExp; prompts: string[] }[] = [
  {
    match: /\/pulls\/\d+/,
    prompts: [
      'Summarise what this pull request changes',
      'What should a reviewer look at most carefully here?',
      'Are there edge cases this change might miss?',
    ],
  },
  {
    match: /\/security/,
    prompts: [
      'Which of these vulnerabilities should I fix first?',
      'How do I add CI to this project?',
      'Explain the risk of the highest-severity finding',
    ],
  },
  {
    match: /\/efficiency/,
    prompts: [
      'Which files are most likely to be slow?',
      'Explain why a linear scan inside a loop is quadratic',
      'How would I profile this project properly?',
    ],
  },
  {
    match: /\/dashboard/,
    prompts: [
      'What do these contributor metrics suggest?',
      'Is the commit activity healthy for a project this size?',
    ],
  },
];

const DEFAULT_PROMPTS = [
  'What does this project do?',
  'How is the code organised?',
  'Where should I start reading?',
];

export function ChatWidget({ owner, repo }: { owner: string; repo: string }) {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<string[]>([]);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const partialRef = useRef('');

  // --- Persistence -------------------------------------------------------
  /**
   * The stored conversation is read when the panel first opens, not on mount.
   * Reading it in an effect would setState on every page render for a panel
   * most visits never open, and would fight React's rule against synchronous
   * setState inside an effect.
   */
  const loadedRef = useRef(false);
  const open = useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      const stored = loadConversation(owner, repo);
      if (stored.length > 0) setMessages(stored);
    }
    setIsOpen(true);
  }, [owner, repo]);

  useEffect(() => {
    if (messages.length > 0) saveConversation(owner, repo, messages);
  }, [messages, owner, repo]);

  // --- Keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isOpen) setIsOpen(false);
        else open();
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        if (mentionQuery !== null) setMentionQuery(null);
        else setIsOpen(false);
      }
    };
    // The command palette asks for the assistant by event rather than by
    // reaching into this component's state.
    const onExternalOpen = () => open();

    window.addEventListener('keydown', onKey);
    window.addEventListener('revisehub:open-assistant', onExternalOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('revisehub:open-assistant', onExternalOpen);
    };
  }, [isOpen, mentionQuery, open]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, partial]);

  // --- @-mention ---------------------------------------------------------
  const loadPaths = useCallback(async () => {
    if (paths) return;
    try {
      const res = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}`);
      const data = await res.json();
      setPaths(res.ok ? (data.paths ?? []) : []);
    } catch {
      setPaths([]);
    }
  }, [owner, repo, paths]);

  const matches = useMemo(() => {
    if (mentionQuery === null || !paths) return [];
    const q = mentionQuery.toLowerCase();
    return (
      paths
        .filter((p) => p.toLowerCase().includes(q))
        // A match on the file name beats one buried in a directory path.
        .sort((a, b) => {
          const an = a.split('/').pop()!.toLowerCase().startsWith(q) ? 0 : 1;
          const bn = b.split('/').pop()!.toLowerCase().startsWith(q) ? 0 : 1;
          return an - bn || a.length - b.length;
        })
        .slice(0, 6)
    );
  }, [mentionQuery, paths]);

  const onInputChange = (value: string) => {
    setInput(value);
    // Only the token currently being typed counts as a mention.
    const m = /(?:^|\s)@([\w./-]*)$/.exec(value);
    if (m) {
      setMentionQuery(m[1] ?? '');
      setMentionIndex(0);
      void loadPaths();
    } else {
      setMentionQuery(null);
    }
  };

  const attach = (path: string) => {
    setAttachments((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setInput((prev) => prev.replace(/@[\w./-]*$/, ''));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // --- Sending -----------------------------------------------------------
  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || streaming) return;

    const history = messages;
    setMessages([...history, { role: 'user', content: question }]);
    setInput('');
    setMentionQuery(null);
    setStreaming(true);
    setPartial('');
    partialRef.current = '';
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const key = getAiKey();

    try {
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { 'x-ai-key': key } : {}) },
        body: JSON.stringify({ owner, repo, question, paths: attachments, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'The assistant could not answer.');
      }
      if (!res.body) throw new Error('The assistant returned an empty response.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE arrives in arbitrary chunks, so events are split on the blank-line
      // delimiter rather than assuming one event per read.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const raw of events) {
          const evt = /event: (\w+)/.exec(raw)?.[1];
          const dataLine = /data: (.*)/.exec(raw)?.[1];
          if (!evt || !dataLine) continue;

          let payload: { text?: string; message?: string };
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (evt === 'delta' && payload.text) {
            partialRef.current += payload.text;
            setPartial(partialRef.current);
          } else if (evt === 'error') {
            throw new Error(payload.message ?? 'The response was interrupted.');
          }
        }
      }

      /*
       * The accumulated text is snapshotted into a local before it reaches
       * setMessages.
       *
       * Reading `partialRef.current` *inside* the updater looks equivalent but
       * is not: React invokes the updater during the render phase, which
       * happens after the `finally` below has already reset the ref. The guard
       * passed, the message was appended, and its content was the empty string
       * — a reply that streamed correctly but rendered as a blank bubble.
       */
      const answer = partialRef.current;
      if (answer) setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      setAttachments([]);
    } catch (err) {
      // Aborting is the user pressing Stop, not a failure — whatever arrived
      // before the abort is kept rather than thrown away.
      const salvaged = partialRef.current;
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (salvaged) setMessages((prev) => [...prev, { role: 'assistant', content: salvaged }]);
      } else {
        setError(err instanceof Error ? err.message : 'The assistant could not answer.');
      }
    } finally {
      setStreaming(false);
      setPartial('');
      partialRef.current = '';
      abortRef.current = null;
    }
  };

  const reset = () => {
    clearConversation(owner, repo);
    setMessages([]);
    setAttachments([]);
    setError(null);
  };

  const suggestions = SUGGESTIONS.find((s) => s.match.test(pathname))?.prompts ?? DEFAULT_PROMPTS;

  if (!isOpen) {
    return (
      <button
        onClick={open}
        aria-label="Open repository assistant (Ctrl+J)"
        title="Repository assistant · Ctrl+J"
        className="press group fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-pink text-[#12071f] shadow-[0_0_28px_rgba(167,139,250,0.45)] hover:shadow-[0_0_40px_rgba(167,139,250,0.7)]"
      >
        <CommentIcon
          className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
          aria-hidden="true"
        />
        {messages.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neon-cyan px-1 font-mono text-[0.6rem] font-bold text-[#062028]">
            {messages.filter((m) => m.role === 'user').length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-void/70 p-4 backdrop-blur-md sm:items-center sm:justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
        className={`glass-strong flex w-full flex-col overflow-hidden rounded-2xl transition-all duration-300 ${
          expanded ? 'h-[92vh] max-w-4xl' : 'h-[78vh] max-w-lg'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neon-violet/15">
              <SparklesIcon className="h-4 w-4 text-neon-violet" aria-hidden="true" />
              {streaming && (
                <span className="animate-pulse-glow absolute inset-0 rounded-xl bg-neon-violet/30" />
              )}
            </span>
            <div className="min-w-0">
              <h2 id="chat-title" className="text-sm font-semibold text-text-primary">
                Assistant
              </h2>
              <p className="truncate font-mono text-[0.65rem] text-muted">
                {owner}/{repo}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="press cursor-pointer rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-danger"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Shrink' : 'Expand'}
              aria-label={expanded ? 'Shrink assistant' : 'Expand assistant'}
              className="press cursor-pointer rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-neon-cyan"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {expanded ? (
                  <path d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
                ) : (
                  <path d="M4 4h6M4 4v6M20 20h-6M20 20v-6" />
                )}
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="press cursor-pointer rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-text-primary"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && !streaming && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4">
                <p className="text-sm font-medium text-text-primary">Ask about this repository.</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  I can see the file listing and README. Type{' '}
                  <code className="rounded border border-white/[0.08] bg-white/[0.05] px-1 font-mono text-xs text-neon-cyan">
                    @
                  </code>{' '}
                  to attach a file and I will read its actual contents.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted">Suggested</p>
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void send(prompt)}
                    className="press block w-full cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left text-sm text-text-secondary hover:border-neon-violet/40 hover:bg-neon-violet/[0.06] hover:text-text-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Message key={i} message={msg} />
          ))}

          {streaming && (
            <div className="flex justify-start">
              <div className="glass-card max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-secondary">
                {partial ? (
                  <>
                    <Markdown text={partial} />
                    {/* A caret makes it obvious output is still arriving. */}
                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-neon-violet align-middle" />
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neon-violet [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neon-violet [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neon-violet [animation-delay:240ms]" />
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </div>

        <div className="relative border-t border-white/[0.08] p-4">
          {mentionQuery !== null && matches.length > 0 && (
            <ul className="glass-strong absolute bottom-full left-4 right-4 mb-2 max-h-56 overflow-y-auto rounded-xl p-1.5">
              {matches.map((path, i) => (
                <li key={path}>
                  <button
                    onClick={() => attach(path)}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-mono text-xs ${
                      i === mentionIndex
                        ? 'bg-neon-violet/15 text-neon-violet'
                        : 'text-text-secondary'
                    }`}
                  >
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((path) => (
                <span
                  key={path}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-1 font-mono text-[0.65rem] text-neon-cyan"
                >
                  <FileIcon className="h-3 w-3" aria-hidden="true" />
                  <span className="max-w-40 truncate">{path}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((p) => p !== path))}
                    aria-label={`Remove ${path}`}
                    className="cursor-pointer hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (mentionQuery !== null && matches.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIndex((i) => (i + 1) % matches.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionIndex((i) => (i - 1 + matches.length) % matches.length);
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const chosen = matches[mentionIndex];
                    if (chosen) attach(chosen);
                    return;
                  }
                }
                // Enter sends; Shift+Enter inserts a newline.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Ask anything, or @file to attach…"
              aria-label="Message"
              maxLength={4000}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:border-neon-violet/60 focus:outline-none"
            />

            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Stop generating"
                className="press flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
              >
                <span className="h-3 w-3 rounded-[2px] bg-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
                className="press flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-pink text-[#12071f] shadow-[0_0_18px_rgba(167,139,250,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </form>

          <p className="mt-2 text-[0.65rem] text-muted">
            Enter to send · Shift+Enter for a new line · @ to attach a file
          </p>
        </div>
      </div>
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'rounded-tr-sm bg-neon-violet/15 text-text-primary shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]'
            : 'glass-card rounded-tl-sm text-text-secondary'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown text={message.content} />
        )}

        {!isUser && (
          <button
            onClick={copy}
            aria-label="Copy message"
            className="absolute -right-2 -top-2 cursor-pointer rounded-lg border border-white/10 bg-elevated p-1.5 text-muted opacity-0 transition-opacity hover:text-neon-cyan focus-visible:opacity-100 group-hover:opacity-100"
          >
            {copied ? (
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3 text-success"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
