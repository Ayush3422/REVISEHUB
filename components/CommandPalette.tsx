'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CodeIcon } from './icons/CodeIcon';
import { ZapIcon } from './icons/ZapIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { SwitchIcon } from './icons/SwitchIcon';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Files' | 'Actions';
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  run: () => void;
}

/**
 * Subsequence match: every character of the query must appear in order, but not
 * necessarily adjacently, so "efv" finds "EfficiencyView". Returns a score where
 * lower is better — tighter runs and earlier matches win.
 */
function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let ti = 0;
  let score = 0;
  let lastHit = -1;

  for (const char of q) {
    const hit = t.indexOf(char, ti);
    if (hit === -1) return null;
    // Gaps between matched characters cost more than consecutive ones.
    score += hit - (lastHit + 1);
    lastHit = hit;
    ti = hit + 1;
  }
  // Prefer shorter candidates when scores tie.
  return score + text.length * 0.01;
}

export function CommandPalette({ owner, repo }: { owner: string; repo: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const loadedRef = useRef(false);

  const base = `/r/${owner}/${repo}`;

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setIndex(0);

    // The file list is fetched once, the first time the palette is opened.
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetch(`/api/github/tree?owner=${owner}&repo=${repo}`)
        .then((r) => (r.ok ? r.json() : { paths: [] }))
        .then((d) => setPaths(d.paths ?? []))
        .catch(() => setPaths([]));
    }
  }, [owner, repo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) setIsOpen(false);
        else open();
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, open]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const go = useCallback(
    (href: string) => {
      setIsOpen(false);
      router.push(href);
    },
    [router],
  );

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      {
        id: 'pulls',
        label: 'Pull requests',
        group: 'Navigate',
        icon: CodeIcon,
        run: () => go(`${base}/pulls`),
      },
      {
        id: 'efficiency',
        label: 'Efficiency',
        group: 'Navigate',
        icon: ZapIcon,
        run: () => go(`${base}/efficiency`),
      },
      {
        id: 'security',
        label: 'Security & health',
        group: 'Navigate',
        icon: ShieldIcon,
        run: () => go(`${base}/security`),
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        group: 'Navigate',
        icon: DashboardIcon,
        run: () => go(`${base}/dashboard`),
      },
      {
        id: 'analysis',
        label: 'AI analysis',
        group: 'Navigate',
        icon: LightbulbIcon,
        run: () => go(`${base}/analysis`),
      },
      {
        id: 'files',
        label: 'File explorer',
        group: 'Navigate',
        icon: FolderIcon,
        run: () => go(`${base}/files`),
      },
    ];

    const actions: Command[] = [
      {
        id: 'assistant',
        label: 'Open the assistant',
        hint: 'Ctrl J',
        group: 'Actions',
        icon: LightbulbIcon,
        run: () => {
          setIsOpen(false);
          // The assistant owns its own visibility, so the palette asks for it
          // by dispatching rather than reaching into its state.
          window.dispatchEvent(new Event('revisehub:open-assistant'));
        },
      },
      {
        id: 'switch',
        label: 'Switch repository',
        group: 'Actions',
        icon: SwitchIcon,
        run: () => go('/'),
      },
    ];

    // Files only appear once the user types, otherwise they would bury the
    // navigation commands under hundreds of paths.
    const files: Command[] = query
      ? paths.slice(0, 2000).map((path) => ({
          id: `file:${path}`,
          label: path,
          group: 'Files' as const,
          icon: FileIcon,
          run: () => go(`${base}/files?path=${encodeURIComponent(path)}`),
        }))
      : [];

    return [...nav, ...actions, ...files];
  }, [base, go, paths, query]);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, score: fuzzyScore(c.label, query) }))
      .filter((r): r is { c: Command; score: number } => r.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map((r) => r.c);

    // Group headers are decided here rather than by mutating a variable while
    // rendering, which React 19 forbids.
    return scored.map((cmd, i) => ({ cmd, startsGroup: cmd.group !== scored[i - 1]?.group }));
  }, [commands, query]);

  // Clamping during render avoids a setState-in-effect round trip when the
  // result list shrinks under the cursor.
  const active = index < results.length ? index : 0;

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-void/70 p-4 pt-[12vh] backdrop-blur-md"
      onClick={() => setIsOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-xl overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => (i + 1) % Math.max(results.length, 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => (i - 1 + results.length) % Math.max(results.length, 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                results[active]?.cmd.run();
              }
            }}
            placeholder="Jump to a section, or search files…"
            aria-label="Search commands"
            className="flex-1 bg-transparent py-4 text-sm text-text-primary placeholder:text-muted focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.6rem] text-muted">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted">Nothing matches “{query}”.</li>
          )}

          {results.map(({ cmd, startsGroup }, i) => {
            const Icon = cmd.icon;
            return (
              <React.Fragment key={cmd.id}>
                {startsGroup && (
                  <li className="px-3 pb-1 pt-3 text-[0.6rem] uppercase tracking-[0.16em] text-muted">
                    {cmd.group}
                  </li>
                )}
                <li>
                  <button
                    data-active={i === active}
                    onMouseEnter={() => setIndex(i)}
                    onClick={cmd.run}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      i === active
                        ? 'bg-neon-violet/15 text-neon-violet'
                        : 'text-text-secondary hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span
                      className={`truncate ${cmd.group === 'Files' ? 'font-mono text-xs' : ''}`}
                    >
                      {cmd.label}
                    </span>
                    {cmd.hint && (
                      <kbd className="ml-auto shrink-0 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.6rem] text-muted">
                        {cmd.hint}
                      </kbd>
                    )}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-white/[0.08] px-4 py-2.5 text-[0.65rem] text-muted">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span className="ml-auto font-mono">Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
