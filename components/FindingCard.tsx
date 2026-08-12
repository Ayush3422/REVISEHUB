'use client';

import React, { useState } from 'react';
import type { Finding, FindingCategory, FindingSeverity } from '@/lib/analysis/types';
import { BugIcon } from './icons/BugIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { StyleIcon } from './icons/StyleIcon';
import { DocIcon } from './icons/DocIcon';
import { OptimizeIcon } from './icons/OptimizeIcon';
import { ComplexityIcon } from './icons/ComplexityIcon';
import { FlaskIcon } from './icons/FlaskIcon';
import { PackageIcon } from './icons/PackageIcon';
import { BroomIcon } from './icons/BroomIcon';

const CATEGORY: Record<
  FindingCategory,
  { icon: React.FC<React.SVGProps<SVGSVGElement>>; color: string; label: string }
> = {
  SECURITY: { icon: ShieldIcon, color: 'text-orange-400', label: 'Security' },
  DEPENDENCY: { icon: PackageIcon, color: 'text-amber-400', label: 'Dependency' },
  BUG: { icon: BugIcon, color: 'text-red-400', label: 'Correctness' },
  COMPLEXITY: { icon: ComplexityIcon, color: 'text-violet-400', label: 'Complexity' },
  HYGIENE: { icon: BroomIcon, color: 'text-sky-400', label: 'Hygiene' },
  TESTING: { icon: FlaskIcon, color: 'text-cyan-400', label: 'Testing' },
  DOCUMENTATION: { icon: DocIcon, color: 'text-blue-400', label: 'Documentation' },
  OPTIMIZATION: { icon: OptimizeIcon, color: 'text-emerald-400', label: 'Performance' },
  STYLE: { icon: StyleIcon, color: 'text-yellow-400', label: 'Style' },
};

const SEVERITY: Record<FindingSeverity, { dot: string; text: string; label: string }> = {
  CRITICAL: { dot: 'bg-red-500', text: 'text-red-300', label: 'Critical' },
  HIGH: { dot: 'bg-orange-500', text: 'text-orange-300', label: 'High' },
  MEDIUM: { dot: 'bg-yellow-500', text: 'text-yellow-300', label: 'Medium' },
  LOW: { dot: 'bg-emerald-500', text: 'text-emerald-300', label: 'Low' },
  INFO: { dot: 'bg-slate-400', text: 'text-slate-300', label: 'Info' },
};

export function FindingCard({ finding }: { finding: Finding }) {
  const [copied, setCopied] = useState(false);
  const { icon: Icon, color, label } = CATEGORY[finding.category];
  const severity = SEVERITY[finding.severity];

  const copy = async () => {
    if (!finding.suggestedCode) return;
    try {
      await navigator.clipboard.writeText(finding.suggestedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the code is selectable anyway */
    }
  };

  return (
    <article className="animate-fade-in-up rounded-lg border border-muted/50 bg-surface/50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="font-semibold text-text-primary">{finding.title}</h4>
            {finding.file && (
              <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
                {finding.file}
                {finding.line !== null && `:${finding.line}`}
              </p>
            )}
          </div>
        </div>

        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium ${severity.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${severity.dot}`} aria-hidden="true" />
          {severity.label}
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{finding.description}</p>

      {finding.evidence && (
        <pre className="mt-3 overflow-x-auto rounded-md border border-muted/40 bg-background px-3 py-2 font-mono text-xs text-text-secondary">
          <code>{finding.evidence}</code>
        </pre>
      )}

      {finding.remediation && (
        <div className="mt-3 rounded-md border-l-2 border-primary/60 bg-primary/5 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Fix</p>
          <p className="mt-1 text-sm text-text-secondary">{finding.remediation}</p>
        </div>
      )}

      {finding.suggestedCode && (
        <div className="mt-3 overflow-hidden rounded-md border border-muted/50 bg-background">
          <div className="flex items-center justify-between border-b border-muted/40 px-3 py-1.5">
            <span className="text-xs text-muted">Suggested code</span>
            <button
              onClick={copy}
              className="text-xs text-text-secondary transition hover:text-primary"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs text-emerald-300">
            <code>{finding.suggestedCode}</code>
          </pre>
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{label}</span>

        <div className="flex items-center gap-3">
          {finding.referenceUrl && (
            <a
              href={finding.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary transition hover:underline"
            >
              Advisory ↗
            </a>
          )}

          {/*
            The distinction that matters most on this card: a rule that matched
            is a fact, a model's opinion is not. Never present them as equal.
          */}
          {finding.source === 'engine' ? (
            <span
              className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400"
              title={`Deterministic rule: ${finding.ruleId}`}
            >
              Verified rule
            </span>
          ) : (
            <span
              className="rounded-full bg-violet-500/10 px-2 py-0.5 font-medium text-violet-300"
              title="Generated by a language model and may be incorrect"
            >
              AI · {Math.round(finding.confidence * 100)}% confidence
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
