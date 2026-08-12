'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GithubIcon } from './icons/GithubIcon';

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
        <label htmlFor="repo" className="mb-2 block text-sm font-medium text-text-primary">
          GitHub repository
        </label>
        <div className="relative">
          <GithubIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
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
            className="w-full rounded-lg border border-muted/80 bg-surface py-3 pl-10 pr-4 text-text-primary placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-60"
          />
        </div>

        {error && (
          <p id="repo-error" role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/85 disabled:cursor-wait disabled:bg-muted"
        >
          {isPending ? (
            <>
              <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Opening…
            </>
          ) : (
            'Analyze repository'
          )}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-secondary">Try:</span>
        {EXAMPLES.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => {
              setValue(slug);
              go(slug);
            }}
            disabled={isPending}
            className="rounded-full border border-muted/60 px-3 py-1 font-mono text-xs text-text-secondary transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {slug}
          </button>
        ))}
      </div>
    </div>
  );
}
