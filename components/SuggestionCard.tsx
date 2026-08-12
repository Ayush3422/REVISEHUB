'use client';

import React, { useState } from 'react';
import type { CodeSuggestion, SuggestionCategory, SuggestionSeverity } from '@/lib/types';
import { BugIcon } from './icons/BugIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { StyleIcon } from './icons/StyleIcon';
import { DocIcon } from './icons/DocIcon';
import { OptimizeIcon } from './icons/OptimizeIcon';
import { ComplexityIcon } from './icons/ComplexityIcon';
import { FlaskIcon } from './icons/FlaskIcon';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { ThumbsDownIcon } from './icons/ThumbsDownIcon';

const CATEGORY: Record<
  SuggestionCategory,
  { icon: React.FC<React.SVGProps<SVGSVGElement>>; color: string; label: string }
> = {
  BUG: { icon: BugIcon, color: 'text-red-400', label: 'Potential bug' },
  SECURITY: { icon: ShieldIcon, color: 'text-orange-400', label: 'Security' },
  STYLE: { icon: StyleIcon, color: 'text-yellow-400', label: 'Style' },
  DOCUMENTATION: { icon: DocIcon, color: 'text-blue-400', label: 'Documentation' },
  OPTIMIZATION: { icon: OptimizeIcon, color: 'text-emerald-400', label: 'Performance' },
  COMPLEXITY: { icon: ComplexityIcon, color: 'text-violet-400', label: 'Complexity' },
  TESTING: { icon: FlaskIcon, color: 'text-cyan-400', label: 'Testing' },
};

const SEVERITY: Record<SuggestionSeverity, { dot: string; label: string }> = {
  CRITICAL: { dot: 'bg-red-500', label: 'Critical' },
  HIGH: { dot: 'bg-orange-500', label: 'High' },
  MEDIUM: { dot: 'bg-yellow-500', label: 'Medium' },
  LOW: { dot: 'bg-emerald-500', label: 'Low' },
};

export function SuggestionCard({ suggestion }: { suggestion: CodeSuggestion }) {
  // Local only, and labelled as such in the UI. Persisting this feedback needs
  // a database and sign-in, which is the next phase of work.
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);

  const { icon: Icon, color, label } = CATEGORY[suggestion.category];
  const severity = SEVERITY[suggestion.severity];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.suggestedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the code is selectable either way */
    }
  };

  return (
    <article className="animate-fade-in-up rounded-lg border border-muted/50 bg-surface/50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="font-semibold text-text-primary">{suggestion.title}</h4>
            <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
              {suggestion.file}
              {suggestion.line !== null && `:${suggestion.line}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium">
          <span className={`h-2 w-2 rounded-full ${severity.dot}`} aria-hidden="true" />
          <span className="text-text-secondary">{severity.label}</span>
        </div>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{suggestion.description}</p>

      {suggestion.suggestedCode && (
        <div className="mt-3 overflow-hidden rounded-md border border-muted/50 bg-background">
          <div className="flex items-center justify-between border-b border-muted/40 px-3 py-1.5">
            <span className="text-xs text-muted">Suggested fix</span>
            <button
              onClick={copy}
              className="text-xs text-text-secondary transition hover:text-primary"
              aria-label="Copy suggested fix"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs text-emerald-300">
            <code>{suggestion.suggestedCode}</code>
          </pre>
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between text-sm text-text-secondary">
        <span className="text-xs">
          {label} · {Math.round(suggestion.confidence * 100)}% confidence
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setVote(vote === 'up' ? null : 'up')}
            aria-pressed={vote === 'up'}
            aria-label="Mark this suggestion as useful"
            title="Rating is local to this page for now"
            className={`rounded p-1.5 transition ${vote === 'up' ? 'text-emerald-400' : 'hover:text-emerald-400'}`}
          >
            <ThumbsUpIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setVote(vote === 'down' ? null : 'down')}
            aria-pressed={vote === 'down'}
            aria-label="Mark this suggestion as unhelpful"
            title="Rating is local to this page for now"
            className={`rounded p-1.5 transition ${vote === 'down' ? 'text-red-400' : 'hover:text-red-400'}`}
          >
            <ThumbsDownIcon className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </article>
  );
}
