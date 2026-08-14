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
  SECURITY: { icon: ShieldIcon, color: 'text-orange-300', label: 'Security' },
  DEPENDENCY: { icon: PackageIcon, color: 'text-amber-300', label: 'Dependency' },
  BUG: { icon: BugIcon, color: 'text-danger', label: 'Correctness' },
  COMPLEXITY: { icon: ComplexityIcon, color: 'text-neon-violet', label: 'Complexity' },
  HYGIENE: { icon: BroomIcon, color: 'text-neon-cyan', label: 'Hygiene' },
  TESTING: { icon: FlaskIcon, color: 'text-teal-300', label: 'Testing' },
  DOCUMENTATION: { icon: DocIcon, color: 'text-blue-300', label: 'Documentation' },
  OPTIMIZATION: { icon: OptimizeIcon, color: 'text-neon-lime', label: 'Performance' },
  STYLE: { icon: StyleIcon, color: 'text-yellow-300', label: 'Style' },
};

/**
 * `rail` is the left edge marker. Severity is carried by position and intensity
 * as well as hue, so the ranking survives for a colour-blind reader.
 */
const SEVERITY: Record<
  FindingSeverity,
  { text: string; chip: string; rail: string; label: string }
> = {
  CRITICAL: {
    text: 'text-danger',
    chip: 'border-danger/40 bg-danger/12 text-danger',
    rail: 'bg-danger shadow-[0_0_14px_rgba(248,113,113,0.85)]',
    label: 'Critical',
  },
  HIGH: {
    text: 'text-orange-300',
    chip: 'border-orange-400/35 bg-orange-400/12 text-orange-300',
    rail: 'bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.7)]',
    label: 'High',
  },
  MEDIUM: {
    text: 'text-warning',
    chip: 'border-amber-400/35 bg-amber-400/12 text-warning',
    rail: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]',
    label: 'Medium',
  },
  LOW: {
    text: 'text-success',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-success',
    rail: 'bg-emerald-400/80',
    label: 'Low',
  },
  INFO: {
    text: 'text-text-secondary',
    chip: 'border-white/12 bg-white/[0.05] text-text-secondary',
    rail: 'bg-white/25',
    label: 'Info',
  },
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
    <article className="glass-card animate-fade-in-up group relative overflow-hidden rounded-2xl p-4 pl-5 transition-colors duration-300 hover:border-white/[0.14]">
      <div
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${severity.rail}`}
      />

      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="font-semibold leading-snug text-text-primary">{finding.title}</h4>
            {finding.file && (
              <p className="mt-1 truncate font-mono text-xs text-muted">
                {finding.file}
                {finding.line !== null && <span className="text-neon-cyan">:{finding.line}</span>}
              </p>
            )}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${severity.chip}`}
        >
          {severity.label}
        </span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{finding.description}</p>

      {finding.evidence && (
        <pre className="glass-inset mt-3 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs text-text-secondary">
          <code>{finding.evidence}</code>
        </pre>
      )}

      {finding.remediation && (
        <div className="mt-3 rounded-lg border-l-2 border-neon-cyan/60 bg-neon-cyan/[0.06] px-3 py-2.5">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-neon-cyan">
            Fix
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{finding.remediation}</p>
        </div>
      )}

      {finding.suggestedCode && (
        <div className="glass-inset mt-3 overflow-hidden rounded-lg">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              Suggested code
            </span>
            <button
              onClick={copy}
              className="press cursor-pointer text-xs text-text-secondary hover:text-neon-cyan"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs text-neon-lime">
            <code>{finding.suggestedCode}</code>
          </pre>
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>

        <div className="flex items-center gap-3">
          {finding.referenceUrl && (
            <a
              href={finding.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan transition hover:underline"
            >
              Advisory ↗
            </a>
          )}

          {/*
            The most important distinction on this card: a rule that matched is
            a fact, a model's opinion is not. They must never look equivalent.
          */}
          {finding.source === 'engine' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 font-medium text-success"
              title={`Deterministic rule: ${finding.ruleId}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              Verified rule
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-neon-pink/25 bg-neon-pink/10 px-2.5 py-0.5 font-medium text-neon-pink"
              title="Generated by a language model and may be incorrect"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-neon-pink shadow-[0_0_8px_rgba(244,114,182,0.9)]" />
              AI · {Math.round(finding.confidence * 100)}%
            </span>
          )}
        </div>
      </footer>
    </article>
  );
}
