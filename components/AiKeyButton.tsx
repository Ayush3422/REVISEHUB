'use client';

import React, { useEffect, useState } from 'react';
import { getAiKey, maskKey, setAiKey } from '@/lib/client/ai-key';

/**
 * Lets a visitor supply their own AI key so they spend their own quota rather
 * than the deployment owner's. The key lives in sessionStorage only and is
 * sent as a header to this app's own API routes.
 */
export function AiKeyButton({ serverKeyConfigured }: { serverKeyConfigured: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stored, setStored] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const sync = () => setStored(getAiKey());
    sync();
    window.addEventListener('revisehub:ai-key-changed', sync);
    return () => window.removeEventListener('revisehub:ai-key-changed', sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setAiKey(draft);
    setDraft('');
    setIsOpen(false);
  };

  const status = stored ? 'Using your key' : serverKeyConfigured ? 'Using server key' : 'No AI key';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
          stored
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : serverKeyConfigured
              ? 'border-muted/50 text-text-secondary hover:border-primary hover:text-primary'
              : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
        }`}
      >
        <span className="block font-medium">{status}</span>
        <span className="mt-0.5 block opacity-70">
          {stored ? maskKey(stored) : 'Click to add your own'}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="key-title"
            className="w-full max-w-md rounded-xl border border-muted/50 bg-surface p-6 shadow-2xl"
          >
            <h2 id="key-title" className="text-lg font-semibold text-white">
              Use your own AI key
            </h2>

            <p className="mt-2 text-sm text-text-secondary">
              AI features run on Google Gemini. Supplying your own key means requests count against
              your quota instead of this deployment&rsquo;s.{' '}
              {!serverKeyConfigured && (
                <span className="text-yellow-300">
                  No server key is configured, so AI features need a key from you.
                </span>
              )}
            </p>

            <form onSubmit={save} className="mt-4">
              <label
                htmlFor="ai-key"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Gemini API key
              </label>
              <input
                id="ai-key"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-muted bg-background px-3 py-2 font-mono text-sm text-text-primary placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <p className="mt-2 text-xs text-muted">
                Stored in this browser tab only and cleared when you close it. Sent to this
                app&rsquo;s own server to make the request, and never saved there. Get a free key at{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  aistudio.google.com/apikey
                </a>
                .
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                {stored ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAiKey(null);
                      setIsOpen(false);
                    }}
                    className="text-sm text-red-400 transition hover:underline"
                  >
                    Remove stored key
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-muted/60 px-3 py-2 text-sm text-text-secondary transition hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/85 disabled:bg-muted disabled:text-text-secondary"
                  >
                    Save key
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
