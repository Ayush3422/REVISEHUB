'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Finding } from '@/lib/analysis/types';
import type { TreeNode } from '@/lib/types';
import { aiHeaders } from '@/lib/client/ai-key';
import { FindingCard } from './FindingCard';
import { EmptyState, ErrorPanel } from './ui/Panel';
import { FileIcon } from './icons/FileIcon';
import { ZapIcon } from './icons/ZapIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface EfficiencyReport {
  path: string;
  findings: Finding[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  estimatedComplexity: string;
  parsed: boolean;
  source: string;
}

interface OptimizeResult {
  optimizedCode: string;
  originalCode: string;
  summary: string;
  complexityBefore: string;
  complexityAfter: string;
  behaviourPreserved: boolean;
  behaviourNotes: string;
  changes: { what: string; why: string; impact: string }[];
  unchanged: boolean;
}

const GRADE_STYLE: Record<EfficiencyReport['grade'], string> = {
  A: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  B: 'border-lime-500/40 bg-lime-500/10 text-lime-300',
  C: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  D: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  F: 'border-red-500/40 bg-red-500/10 text-red-300',
};

/** Only files the analyser can actually parse are offered. */
const ANALYSABLE = /\.(?:[jt]sx?|mjs|cjs|mts|cts)$/i;
const EXCLUDED =
  /(?:^|\/)(?:__tests__|__mocks__|tests?|specs?|e2e|cypress|node_modules|dist|build|out|\.next)\/|\.(?:test|spec)\.[jt]sx?$|\.d\.ts$|\.min\.[jt]s$/i;

function CodePane({
  title,
  code,
  tone,
}: {
  title: string;
  code: string;
  tone: 'before' | 'after';
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the code is selectable anyway */
    }
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-muted/50">
      <div
        className={`flex items-center justify-between border-b px-3 py-2 text-xs font-semibold ${
          tone === 'after'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-muted/50 bg-surface text-text-secondary'
        }`}
      >
        <span>
          {title} · {lines.length} lines
        </span>
        <button onClick={copy} className="font-normal transition hover:text-primary">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto bg-background">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="w-10 select-none border-r border-muted/30 px-2 text-right align-top tabular-nums text-muted">
                  {i + 1}
                </td>
                <td className="whitespace-pre-wrap break-all px-3 py-0.5 text-text-secondary">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EfficiencyView({
  owner,
  repo,
  tree,
  defaultBranch,
}: {
  owner: string;
  repo: string;
  tree: TreeNode[];
  defaultBranch: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<EfficiencyReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const [filter, setFilter] = useState('');

  const files = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && ANALYSABLE.test(node.path) && !EXCLUDED.test(node.path)) {
          out.push(node.path);
        }
        if (node.children) walk(node.children);
      }
    };
    walk(tree);
    return out.sort();
  }, [tree]);

  const visibleFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
    return list.slice(0, 300);
  }, [files, filter]);

  const analyse = useCallback(
    async (path: string) => {
      setSelected(path);
      setAnalysing(true);
      setReport(null);
      setReportError(null);
      setOptimized(null);
      setOptimizeError(null);
      try {
        const res = await fetch('/api/analysis/efficiency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo, path, ref: defaultBranch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Analysis failed.');
        setReport(data as EfficiencyReport);
      } catch (err) {
        setReportError(err instanceof Error ? err.message : 'Analysis failed.');
      } finally {
        setAnalysing(false);
      }
    },
    [owner, repo, defaultBranch],
  );

  const optimize = async () => {
    if (!selected) return;
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ owner, repo, path: selected, ref: defaultBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Optimisation failed.');
      setOptimized(data as OptimizeResult);
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : 'Optimisation failed.');
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
      {/* File picker */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-muted/50 bg-surface/50 lg:col-span-1">
        <div className="border-b border-muted/50 p-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files…"
            aria-label="Filter files"
            className="w-full rounded-md border border-muted/60 bg-background px-3 py-1.5 text-sm text-text-primary placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <p className="mt-2 text-xs text-text-secondary">
            {files.length} analysable {files.length === 1 ? 'file' : 'files'} · JavaScript and
            TypeScript
          </p>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {visibleFiles.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">
              {files.length === 0
                ? 'No JavaScript or TypeScript source files were found in this repository.'
                : `No files match “${filter}”.`}
            </p>
          ) : (
            <ul>
              {visibleFiles.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => analyse(path)}
                    title={path}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                      selected === path
                        ? 'bg-primary/20 text-primary'
                        : 'text-text-secondary hover:bg-surface'
                    }`}
                  >
                    <FileIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Report */}
      <div className="min-h-0 space-y-4 lg:col-span-2">
        {!selected && (
          <div className="rounded-xl border border-muted/50 bg-surface/50">
            <EmptyState
              icon={<ZapIcon className="h-10 w-10" />}
              title="Select a file"
              message="Pick a source file to check it for known inefficiency patterns. The check runs from deterministic rules and needs no API key."
            />
          </div>
        )}

        {analysing && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-muted/50 bg-surface/50 py-16">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-text-secondary">Parsing and checking…</p>
          </div>
        )}

        {reportError && <ErrorPanel title="Could not analyse this file" message={reportError} />}

        {report && !analysing && (
          <>
            <div className="rounded-xl border border-muted/50 bg-surface/50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-text-primary">{report.path}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Estimated worst case:{' '}
                    <span className="font-semibold text-text-primary">
                      {report.estimatedComplexity}
                    </span>
                  </p>
                </div>

                <div
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${GRADE_STYLE[report.grade]}`}
                >
                  <span className="text-3xl font-bold leading-none">{report.grade}</span>
                  <span className="text-xs">
                    {report.score}/100
                    <br />
                    {report.findings.length} {report.findings.length === 1 ? 'issue' : 'issues'}
                  </span>
                </div>
              </div>

              {report.findings.length > 0 && (
                <button
                  onClick={optimize}
                  disabled={optimizing}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
                >
                  <SparklesIcon
                    className={`h-4 w-4 ${optimizing ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {optimizing
                    ? 'Rewriting…'
                    : optimized
                      ? 'Generate again'
                      : 'Generate optimized code'}
                </button>
              )}

              {/*
                Stated on every clean report. This is pattern detection, not a
                benchmark, and "no known slow pattern" is a weaker claim than
                "this code is fast".
              */}
              <p className="mt-4 border-t border-muted/40 pt-3 text-xs text-muted">
                Detected from the syntax tree, not measured at runtime. A clean result means no
                known slow pattern was found, not that the code is fast.
              </p>
            </div>

            {report.findings.length === 0 ? (
              <div className="rounded-xl border border-muted/50 bg-surface/50">
                <EmptyState
                  title="No inefficiency patterns found"
                  message="None of the quadratic-loop, linear-search, sequential-await, or copy-accumulation patterns appear in this file."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {report.findings.map((finding, i) => (
                  <FindingCard key={`${finding.ruleId}-${i}`} finding={finding} />
                ))}
              </div>
            )}
          </>
        )}

        {optimizeError && <ErrorPanel title="Optimisation failed" message={optimizeError} />}

        {optimized && (
          <div className="space-y-4 rounded-xl border border-primary/30 bg-surface/50 p-5">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <SparklesIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                Optimized version
              </h3>
              <p className="mt-2 text-sm text-text-secondary">{optimized.summary}</p>

              {optimized.complexityBefore && optimized.complexityAfter && (
                <p className="mt-2 font-mono text-sm">
                  <span className="text-red-400">{optimized.complexityBefore}</span>
                  <span className="mx-2 text-muted">→</span>
                  <span className="text-emerald-400">{optimized.complexityAfter}</span>
                </p>
              )}
            </div>

            {/* A rewrite that changes behaviour is a bug, so it is called out loudly. */}
            {!optimized.behaviourPreserved && (
              <div
                role="alert"
                className="rounded-lg border border-yellow-500/40 bg-yellow-950/30 px-4 py-3"
              >
                <p className="text-sm font-semibold text-yellow-300">
                  This rewrite may change behaviour
                </p>
                <p className="mt-1 text-sm text-yellow-200/80">
                  {optimized.behaviourNotes || 'The model did not explain what differs.'}
                </p>
              </div>
            )}

            {optimized.unchanged && (
              <p className="rounded-lg border border-muted/40 bg-background/40 px-4 py-3 text-sm text-text-secondary">
                The model returned the file unchanged — it did not find a safe improvement to make.
              </p>
            )}

            {optimized.changes.length > 0 && (
              <ul className="space-y-2">
                {optimized.changes.map((change, i) => (
                  <li key={i} className="rounded-lg border border-muted/40 bg-background/40 p-3">
                    <p className="text-sm font-medium text-text-primary">{change.what}</p>
                    <p className="mt-1 text-sm text-text-secondary">{change.why}</p>
                    {change.impact && (
                      <p className="mt-1 font-mono text-xs text-emerald-400">{change.impact}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CodePane title="Original" code={optimized.originalCode} tone="before" />
              <CodePane title="Optimized" code={optimized.optimizedCode} tone="after" />
            </div>

            <p className="text-xs text-muted">
              Generated by a language model. Read it and run your tests before using it — the
              rewrite is a proposal, not a verified equivalent.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
