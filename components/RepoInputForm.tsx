'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GithubIcon } from './icons/GithubIcon';
import { Button } from './ui/Button';

const EXAMPLES = ['facebook/react', 'vercel/next.js', 'honojs/hono'];

/**
 * Parses input in the browser purely to give fast feedback. The server
 * re-validates every value it receives — this is convenience, not a check.
 */
function parseSlug(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^git@github\.com:/i, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .split(/[?#]/)[0]!
    .replace(/\.git$/i, '');

  const parts = cleaned.split('/').filter(Boolean);
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner)) return null;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;

  return { owner, repo };
}

export function RepoInputForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const go = (input: string) => {
    const parsed = parseSlug(input);
    if (!parsed) {
      setError('Enter a GitHub repository URL or owner/repo, e.g. facebook/react.');
      return;
    }
    setError(null);
    startTransition(() => {
      router.push(`/r/${parsed.owner}/${parsed.repo}/pulls`);
    });
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        noValidate
      >
        <label
          htmlFor="repo"
          className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted"
        >
          GitHub repository
        </label>
        <div className="relative">
          <GithubIcon
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="repo"
            name="repo"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'repo-error' : undefined}
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 font-mono text-sm text-text-primary transition-all duration-200 placeholder:text-muted hover:border-white/20 focus:border-neon-violet/60 focus:bg-white/[0.06] focus:shadow-[0_0_28px_rgba(167,139,250,0.18)] focus:outline-none disabled:opacity-60"
          />
        </div>

        {error && (
          <p id="repo-error" role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={isPending} className="mt-5 w-full">
          {isPending ? 'Opening…' : 'Analyze repository'}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Try</span>
        {EXAMPLES.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => {
              setValue(slug);
              go(slug);
            }}
            disabled={isPending}
            className="press cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-text-secondary hover:border-neon-cyan/50 hover:bg-neon-cyan/[0.07] hover:text-neon-cyan disabled:opacity-50"
          >
            {slug}
          </button>
        ))}
      </div>
    </div>
  );
}
