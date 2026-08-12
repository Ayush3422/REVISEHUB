import React from 'react';

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-muted/50 bg-surface/50 shadow-lg backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-muted/50 px-5 py-4">
          <div>
            {title && <h3 className="font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ErrorPanel({
  title = 'Something went wrong',
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/40 p-5">
      <p className="font-semibold text-red-300">{title}</p>
      <p className="mt-1 text-sm text-red-200/80">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="max-w-md text-sm text-text-secondary">{message}</p>
    </div>
  );
}

const STAT_TONES = {
  neutral: 'text-text-primary',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
} as const;

export function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-lg border border-muted/40 bg-surface/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${STAT_TONES[tone]}`}>{value}</p>
    </div>
  );
}
