'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { AnalysisResult, Finding, FindingSeverity } from '@/lib/analysis/types';
import { countBySeverity, sortFindings } from '@/lib/analysis/types';
import { aiHeaders } from '@/lib/client/ai-key';
import { FindingCard } from './FindingCard';
import { EmptyState, ErrorPanel } from './ui/Panel';
import { SparklesIcon } from './icons/SparklesIcon';
import { Button, SegmentedButton } from './ui/Button';
import { ShieldIcon } from './icons/ShieldIcon';

const SEVERITY_ORDER: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_CHIP: Record<FindingSeverity, string> = {
  CRITICAL: 'border-danger/35 bg-danger/12 text-danger',
  HIGH: 'border-orange-400/30 bg-orange-400/12 text-orange-300',
  MEDIUM: 'border-amber-400/30 bg-amber-400/12 text-warning',
  LOW: 'border-emerald-400/25 bg-emerald-400/10 text-success',
  INFO: 'border-white/12 bg-white/[0.05] text-text-secondary',
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
    <section className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      <header className="space-y-3 border-b border-white/[0.07] px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-text-primary">Findings</h2>
            <p className="mt-0.5 text-xs text-muted">
              {engine.scannedFiles.length} {engine.scannedFiles.length === 1 ? 'file' : 'files'}{' '}
              scanned by rules in {engine.durationMs}ms
            </p>
          </div>

          <Button
            onClick={runAi}
            loading={aiLoading}
            disabled={engineLoading}
            icon={!aiLoading ? <SparklesIcon className="h-4 w-4" aria-hidden="true" /> : undefined}
          >
            {aiLoading ? 'Reviewing…' : aiFindings ? 'Re-run AI' : 'Add AI review'}
          </Button>
        </div>

        {all.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span
                key={s}
                className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${SEVERITY_CHIP[s]}`}
              >
                {counts[s]} {s.toLowerCase()}
              </span>
            ))}

            {aiCount > 0 && (
              <div className="ml-auto flex gap-1">
                {(['all', 'engine', 'ai'] as Filter[]).map((f) => (
                  <SegmentedButton key={f} active={filter === f} onClick={() => setFilter(f)}>
                    {f === 'all'
                      ? `All ${all.length}`
                      : f === 'engine'
                        ? `Rules ${engineCount}`
                        : `AI ${aiCount}`}
                  </SegmentedButton>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {engineLoading && (
          <div className="glass-inset flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text-secondary">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-neon-violet" />
            Re-running analysis rules…
          </div>
        )}

        {engineError && (
          <div className="space-y-3">
            <ErrorPanel title="Analysis failed" message={engineError} />
            <Button onClick={runEngine} variant="outline" size="sm">
              Try again
            </Button>
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
          <div className="glass-inset rounded-xl px-4 py-3 text-xs text-text-secondary">
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
