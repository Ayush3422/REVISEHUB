'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoIcon } from './icons/LogoIcon';
import { CodeIcon } from './icons/CodeIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { FolderIcon } from './icons/FolderIcon';
import { SwitchIcon } from './icons/SwitchIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { ZapIcon } from './icons/ZapIcon';
import { AiKeyButton } from './AiKeyButton';

const NAV = [
  { segment: 'pulls', label: 'Pull requests', icon: CodeIcon },
  { segment: 'efficiency', label: 'Efficiency', icon: ZapIcon },
  { segment: 'security', label: 'Security', icon: ShieldIcon },
  { segment: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { segment: 'analysis', label: 'AI analysis', icon: LightbulbIcon },
  { segment: 'files', label: 'Files', icon: FolderIcon },
] as const;

export function Sidebar({
  owner,
  repo,
  serverKeyConfigured,
}: {
  owner: string;
  repo: string;
  serverKeyConfigured: boolean;
}) {
  const pathname = usePathname();
  const base = `/r/${owner}/${repo}`;

  return (
    <nav
      aria-label="Repository sections"
      className="glass z-20 flex w-64 shrink-0 flex-col rounded-none border-y-0 border-l-0 p-4 max-lg:w-full max-lg:border-x-0 max-lg:border-b"
    >
      <Link
        href="/"
        className="press group mb-5 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]"
      >
        <span className="relative">
          <LogoIcon className="h-8 w-8 text-neon-violet transition-transform duration-300 group-hover:scale-110" />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-full bg-neon-violet/40 blur-lg transition-opacity duration-300 group-hover:opacity-100 md:opacity-70"
          />
        </span>
        <span className="text-lg font-bold tracking-tight text-text-primary">ReviseHub</span>
      </Link>

      <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted">Repository</p>
        <p className="mt-0.5 truncate font-mono text-xs text-neon-cyan" title={`${owner}/${repo}`}>
          {owner}/{repo}
        </p>
      </div>

      <ul className="space-y-0.5 max-lg:flex max-lg:space-y-0 max-lg:overflow-x-auto max-lg:pb-1">
        {NAV.map(({ segment, label, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={segment}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`press group relative flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? 'bg-neon-violet/[0.12] text-neon-violet'
                    : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary'
                }`}
              >
                {/* The active marker is a shape and a position, not only a colour. */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-neon-violet shadow-[0_0_12px_rgba(167,139,250,0.9)]"
                  />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                    isActive ? '' : 'group-hover:scale-110'
                  }`}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-2.5 pt-6 max-lg:hidden">
        <AiKeyButton serverKeyConfigured={serverKeyConfigured} />
        <Link
          href="/"
          className="press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
        >
          <SwitchIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          Switch repository
        </Link>
      </div>
    </nav>
  );
}
