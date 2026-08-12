'use client';

import React, { useState } from 'react';
import type { CodeSuggestion } from '@/lib/types';
import { SuggestionCard } from './SuggestionCard';
import { EmptyState, ErrorPanel } from './ui/Panel';
import { SparklesIcon } from './icons/SparklesIcon';

interface ReviewResponse {
  suggestions: CodeSuggestion[];
  reviewedFiles: string[];
  skippedFiles: string[];
}

export function ReviewPanel({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, number }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'The review failed.');
      setResult(data as ReviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The review failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-muted/50 bg-surface/50">
      <header className="flex items-center justify-between gap-3 border-b border-muted/50 px-5 py-3">
        <h2 className="font-semibold text-white">AI review</h2>
        <button
          onClick={run}
          disabled={isRunning}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
        >
          <SparklesIcon
            className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isRunning ? 'Reviewing…' : result ? 'Run again' : 'Run AI review'}
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {error && <ErrorPanel title="Review failed" message={error} />}

        {isRunning && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-text-secondary">Analysing the diff…</p>
          </div>
        )}

        {!isRunning && !result && !error && (
          <EmptyState
            icon={<SparklesIcon className="h-10 w-10" />}
            title="No review yet"
            message="Run an AI review to get findings on this diff, ranked by severity and anchored to the files they affect."
          />
        )}

        {!isRunning && result && (
          <>
            <div className="rounded-lg border border-muted/40 bg-background/50 px-4 py-3 text-sm text-text-secondary">
              {result.suggestions.length > 0 ? (
                <p>
                  <span className="font-semibold text-text-primary">
                    {result.suggestions.length}
                  </span>{' '}
                  {result.suggestions.length === 1 ? 'finding' : 'findings'} across{' '}
                  {result.reviewedFiles.length}{' '}
                  {result.reviewedFiles.length === 1 ? 'file' : 'files'}.
                </p>
              ) : (
                <p>
                  No issues found across {result.reviewedFiles.length}{' '}
                  {result.reviewedFiles.length === 1 ? 'file' : 'files'}.
                </p>
              )}

              {/* Say plainly what was not reviewed rather than implying full coverage. */}
              {result.skippedFiles.length > 0 && (
                <p className="mt-2 text-xs text-yellow-400/90">
                  {result.skippedFiles.length}{' '}
                  {result.skippedFiles.length === 1 ? 'file was' : 'files were'} not reviewed
                  (binary, or the diff exceeded the size budget):{' '}
                  {result.skippedFiles.slice(0, 5).join(', ')}
                  {result.skippedFiles.length > 5 && ` and ${result.skippedFiles.length - 5} more`}.
                </p>
              )}
            </div>

            {result.suggestions.map((suggestion, i) => (
              <SuggestionCard
                key={`${suggestion.file}-${suggestion.line}-${i}`}
                suggestion={suggestion}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
