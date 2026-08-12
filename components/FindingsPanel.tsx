'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { AnalysisResult, Finding, FindingSeverity } from '@/lib/analysis/types';
import { countBySeverity, sortFindings } from '@/lib/analysis/types';
import { aiHeaders } from '@/lib/client/ai-key';
import { FindingCard } from './FindingCard';
import { EmptyState, ErrorPanel } from './ui/Panel';
import { SparklesIcon } from './icons/SparklesIcon';
import { ShieldIcon } from './icons/ShieldIcon';

const SEVERITY_ORDER: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_CHIP: Record<FindingSeverity, string> = {
  CRITICAL: 'bg-red-500/15 text-red-300 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  INFO: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

type Filter = 'all' | 'engine' | 'ai';

/**
 * `initialEngine` is produced on the server during page render, so engine
 * findings are present in the initial HTML with no client round-trip and no
 * loading state. Only the AI layer, which is opt-in, is fetched from here.
 */
export function FindingsPanel({
  owner,
  repo,
  number,
  initialEngine,
}: {
  owner: string;
  repo: string;
  number: number;
  initialEngine: AnalysisResult;
}) {
  const [engine, setEngine] = useState<AnalysisResult>(initialEngine);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);

  const [aiFindings, setAiFindings] = useState<Finding[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [filter, setFilter] = useState<Filter>('all');

  const runEngine = useCallback(async () => {
    setEngineLoading(true);
    setEngineError(null);
    try {
      const res = await fetch('/api/analysis/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, number }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed.');
      setEngine(data as AnalysisResult);
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setEngineLoading(false);
    }
  }, [owner, repo, number]);

  const runAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          owner,
          repo,
          number,
          // Telling the model what is already known keeps it from repeating it.
          engineFindings: engine.findings.map((f) => ({
            ruleId: f.ruleId,
            source: f.source,
            category: f.category,
            severity: f.severity,
            title: f.title,
            description: f.description.slice(0, 2000),
            file: f.file,
            line: f.line,
            confidence: f.confidence,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI review failed.');
      setAiFindings(data.findings as Finding[]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI review failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const all = useMemo(
    () => sortFindings([...engine.findings, ...(aiFindings ?? [])]),
    [engine, aiFindings],
  );

  const visible = useMemo(
    () => (filter === 'all' ? all : all.filter((f) => f.source === filter)),
    [all, filter],
  );

  const counts = useMemo(() => countBySeverity(all), [all]);
  const engineCount = engine.findings.length;
  const aiCount = aiFindings?.length ?? 0;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-muted/50 bg-surface/50">
      <header className="space-y-3 border-b border-muted/50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Findings</h2>
            <p className="text-xs text-text-secondary">
              {engine.scannedFiles.length} {engine.scannedFiles.length === 1 ? 'file' : 'files'}{' '}
              scanned by rules in {engine.durationMs}ms
            </p>
          </div>

          <button
            onClick={runAi}
            disabled={aiLoading || engineLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
          >
            <SparklesIcon
              className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {aiLoading ? 'Reviewing…' : aiFindings ? 'Re-run AI' : 'Add AI review'}
          </button>
        </div>

        {all.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span
                key={s}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_CHIP[s]}`}
              >
                {counts[s]} {s.toLowerCase()}
              </span>
            ))}

            {aiCount > 0 && (
              <div className="ml-auto flex gap-1">
                {(['all', 'engine', 'ai'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`rounded-md px-2 py-1 text-xs transition ${
                      filter === f
                        ? 'bg-primary/20 text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {f === 'all'
                      ? `All ${all.length}`
                      : f === 'engine'
                        ? `Rules ${engineCount}`
                        : `AI ${aiCount}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {engineLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-muted/40 bg-background/40 px-4 py-2.5 text-sm text-text-secondary">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            Re-running analysis rules…
          </div>
        )}

        {engineError && (
          <div className="space-y-3">
            <ErrorPanel title="Analysis failed" message={engineError} />
            <button
              onClick={runEngine}
              className="rounded-lg border border-muted/60 px-3 py-1.5 text-sm text-text-secondary transition hover:border-primary hover:text-primary"
            >
              Try again
            </button>
          </div>
        )}

        {aiError && <ErrorPanel title="AI review unavailable" message={aiError} />}

        {!engineError && all.length === 0 && (
          <EmptyState
            icon={<ShieldIcon className="h-10 w-10" />}
            title="No issues found"
            message={
              aiFindings
                ? 'Neither the analysis rules nor the AI review found problems in this diff.'
                : 'The analysis rules found no problems. Add an AI review to also check for logic errors that rules cannot detect.'
            }
          />
        )}

        {visible.map((finding, i) => (
          <FindingCard
            key={`${finding.ruleId}-${finding.file}-${finding.line}-${i}`}
            finding={finding}
          />
        ))}

        {/* Coverage is stated explicitly rather than implied. */}
        {(engine.skipped.length > 0 || engine.failedRules.length > 0) && (
          <div className="rounded-lg border border-muted/40 bg-background/40 px-4 py-3 text-xs text-text-secondary">
            {engine.skipped.length > 0 && (
              <p>
                <span className="font-semibold text-yellow-400/90">Not fully scanned:</span>{' '}
                {engine.skipped
                  .slice(0, 4)
                  .map((s) => `${s.file} (${s.reason})`)
                  .join(', ')}
                {engine.skipped.length > 4 && ` and ${engine.skipped.length - 4} more`}.
              </p>
            )}
            {engine.failedRules.length > 0 && (
              <p className="mt-1">
                <span className="font-semibold text-red-400/90">Rules that errored:</span>{' '}
                {engine.failedRules.join(', ')}.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
