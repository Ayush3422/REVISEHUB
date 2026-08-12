'use client';

import React, { useState } from 'react';
import { Markdown } from './ui/Markdown';
import { EmptyState, ErrorPanel } from './ui/Panel';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { SparklesIcon } from './icons/SparklesIcon';

export function AnalysisPanel({ owner, repo }: { owner: string; repo: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Explicitly triggered rather than run on mount. Every visit to this page
   * would otherwise spend a Gemini call before the user asked for one, which
   * matters on a free API tier.
   */
  const run = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'The analysis failed.');
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-muted/50 bg-surface/50 p-6 shadow-lg backdrop-blur-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
          <LightbulbIcon className="h-6 w-6 text-yellow-400" aria-hidden="true" />
          Assessment
        </h2>
        <button
          onClick={run}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
        >
          <SparklesIcon
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isLoading ? 'Analysing…' : analysis ? 'Regenerate' : 'Generate analysis'}
        </button>
      </div>

      <div aria-live="polite">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-text-secondary">Reading the repository’s metrics…</p>
          </div>
        )}

        {!isLoading && error && <ErrorPanel title="Analysis failed" message={error} />}

        {!isLoading && !error && !analysis && (
          <EmptyState
            icon={<LightbulbIcon className="h-10 w-10" />}
            title="No analysis yet"
            message="Generate an assessment based on this repository's contributor, churn, and pull request metrics."
          />
        )}

        {!isLoading && !error && analysis && <Markdown text={analysis} />}
      </div>
    </div>
  );
}
