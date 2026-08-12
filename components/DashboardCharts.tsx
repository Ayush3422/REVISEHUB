'use client';

import React from 'react';
import Image from 'next/image';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ContributorStats, WeeklyPoint } from '@/lib/types';
import { EmptyState, Panel } from './ui/Panel';

/**
 * Series colours. Every pair below was checked with the palette validator
 * against the #1E293B dark surface and passes the lightness band, chroma floor,
 * CVD separation, normal-vision floor, and contrast checks.
 *
 * Churn additionally encodes polarity by position — additions above the zero
 * line, deletions below — so the distinction survives even without colour.
 */
const COLORS = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  additions: '#059669',
  deletions: '#EF4444',
} as const;

const AXIS = '#94A3B8';
const GRID = '#334155';

function formatWeek(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

/** Values are absolute in the tooltip even where the chart plots them negative. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-muted/60 bg-surface/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-semibold text-text-primary">{formatWeek(String(label))}</p>
      {payload.map((item, i) => (
        <p key={i} className="flex items-center gap-2 text-xs text-text-secondary">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span>{item.name}</span>
          <span className="ml-auto font-mono tabular-nums text-text-primary">
            {Math.abs(item.value ?? 0).toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

const legendStyle = { fontSize: 12, color: AXIS } as const;
const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
} as const;

function hasData(points: WeeklyPoint[], keys: string[]): boolean {
  return points.some((p) => keys.some((k) => Number(p[k] ?? 0) !== 0));
}

// --- Commit activity: one series, so no legend; the title names it. ---

export function CommitActivityChart({ data }: { data: WeeklyPoint[] }) {
  if (!hasData(data, ['commits'])) {
    return (
      <EmptyState
        title="No commit activity"
        message="GitHub reports no commits in the last year."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="commitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickFormatter={formatWeek} {...axisProps} minTickGap={24} />
        <YAxis tickFormatter={compact} width={44} {...axisProps} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
        <Area
          type="monotone"
          dataKey="commits"
          name="Commits"
          stroke={COLORS.primary}
          strokeWidth={2}
          fill="url(#commitFill)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Code churn: polarity by position, reinforced by colour. ---

export function ChurnChart({ data }: { data: WeeklyPoint[] }) {
  if (!hasData(data, ['additions', 'deletions'])) {
    return (
      <EmptyState title="No churn data" message="GitHub reports no line changes for this period." />
    );
  }

  const mirrored = data.map((week) => ({
    name: week.name,
    additions: Number(week.additions ?? 0),
    deletions: -Number(week.deletions ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={mirrored} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickFormatter={formatWeek} {...axisProps} minTickGap={24} />
        <YAxis
          tickFormatter={(v: number) => compact(Math.abs(v))}
          width={44}
          {...axisProps}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke={AXIS} strokeWidth={1} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
        <Area
          type="monotone"
          dataKey="additions"
          name="Lines added"
          stroke={COLORS.additions}
          strokeWidth={2}
          fill={COLORS.additions}
          fillOpacity={0.2}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="deletions"
          name="Lines removed"
          stroke={COLORS.deletions}
          strokeWidth={2}
          fill={COLORS.deletions}
          fillOpacity={0.2}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- PR velocity: two categorical series. ---

export function VelocityChart({ data }: { data: WeeklyPoint[] }) {
  if (!hasData(data, ['opened', 'merged'])) {
    return (
      <EmptyState
        title="No pull request activity"
        message="No pull requests were opened or merged in the last six months."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickFormatter={formatWeek} {...axisProps} minTickGap={24} />
        <YAxis allowDecimals={false} width={36} {...axisProps} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
        <Line
          type="monotone"
          dataKey="opened"
          name="Opened"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="merged"
          name="Merged"
          stroke={COLORS.secondary}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Contributors ---

/**
 * Commits only. The previous version plotted commits, additions and deletions
 * as three bars on one axis — but additions run into the hundreds of thousands
 * while commits are in the hundreds, so the commit bars were invisible. Line
 * counts belong in the table below, where they are readable.
 */
export function ContributorChart({ data }: { data: ContributorStats[] }) {
  const top = data.slice(0, 10);

  if (top.length === 0) {
    return (
      <EmptyState title="No contributors" message="GitHub reports no contributor statistics." />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, top.length * 34)}>
      <BarChart
        data={top}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap={2}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={compact} {...axisProps} axisLine={false} />
        <YAxis type="category" dataKey="name" width={110} {...axisProps} axisLine={false} />
        <Tooltip
          cursor={{ fill: '#FFFFFF', fillOpacity: 0.04 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const c = payload[0]?.payload as ContributorStats | undefined;
            if (!c) return null;
            return (
              <div className="rounded-lg border border-muted/60 bg-surface/95 px-3 py-2 shadow-xl backdrop-blur-sm">
                <p className="text-xs font-semibold text-text-primary">{c.name}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {c.commits.toLocaleString()} commits · +{c.additions.toLocaleString()} / −
                  {c.deletions.toLocaleString()}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="commits" name="Commits" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** The accessible table view of the same data, and where line counts live. */
export function ContributorTable({ data }: { data: ContributorStats[] }) {
  if (data.length === 0) return null;

  return (
    <Panel title="Contributors" subtitle={`${data.length} in total`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Commits and line changes per contributor</caption>
          <thead>
            <tr className="border-b border-muted/40 text-left text-xs uppercase tracking-wide text-text-secondary">
              <th scope="col" className="pb-2 pr-4 font-medium">
                #
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                Contributor
              </th>
              <th scope="col" className="pb-2 pr-4 text-right font-medium">
                Commits
              </th>
              <th scope="col" className="pb-2 pr-4 text-right font-medium">
                Added
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Removed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/20">
            {data.slice(0, 25).map((c, i) => (
              <tr key={c.name}>
                <td className="py-2 pr-4 tabular-nums text-text-secondary">{i + 1}</td>
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-2">
                    {c.avatarUrl && (
                      <Image
                        src={c.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-text-primary">{c.name}</span>
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-text-primary">
                  {c.commits.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-mono tabular-nums text-emerald-400">
                  +{c.additions.toLocaleString()}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-red-400">
                  −{c.deletions.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
