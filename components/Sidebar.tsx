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
  { segment: 'files', label: 'File explorer', icon: FolderIcon },
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
      className="flex w-64 shrink-0 flex-col border-r border-muted/50 bg-surface/30 p-4 max-lg:w-full max-lg:border-b max-lg:border-r-0"
    >
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <LogoIcon className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-white">ReviseHub</span>
      </Link>

      <p
        className="mb-4 truncate px-2 font-mono text-xs text-text-secondary"
        title={`${owner}/${repo}`}
      >
        {owner}/{repo}
      </p>

      <ul className="space-y-1 max-lg:flex max-lg:space-y-0 max-lg:overflow-x-auto">
        {NAV.map(({ segment, label, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={segment}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-4 py-2.5 font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-3 pt-6 max-lg:hidden">
        <AiKeyButton serverKeyConfigured={serverKeyConfigured} />
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-4 py-2.5 font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          <SwitchIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          Switch repository
        </Link>
        <p className="mt-3 text-center text-xs text-muted">Powered by Google Gemini</p>
      </div>
    </nav>
  );
}
