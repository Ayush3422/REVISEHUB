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
    <section className={`glass overflow-hidden rounded-2xl ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold tracking-wide text-text-primary">{title}</h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
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
    <div
      role="alert"
      className="glass-card relative overflow-hidden rounded-2xl border-danger/30 p-5"
    >
      {/* Colour alone never carries the meaning: there is an icon and a heading. */}
      <div className="absolute inset-y-0 left-0 w-[2px] bg-danger shadow-[0_0_16px_rgba(248,113,113,0.7)]" />
      <div className="flex items-start gap-3 pl-2">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-5 w-5 shrink-0 text-danger"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <div className="min-w-0">
          <p className="font-semibold text-danger">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{message}</p>
        </div>
      </div>
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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="mb-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-neon-violet/70">
          {icon}
        </div>
      )}
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-text-secondary">{message}</p>
    </div>
  );
}

const STAT_TONES = {
  neutral: { value: 'text-text-primary', bar: 'from-neon-violet/70' },
  positive: { value: 'text-success', bar: 'from-success/70' },
  negative: { value: 'text-danger', bar: 'from-danger/70' },
  accent: { value: 'text-neon-cyan', bar: 'from-neon-cyan/70' },
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
  const t = STAT_TONES[tone];
  return (
    <div className="glass-card group relative overflow-hidden rounded-xl px-4 py-3">
      {/* Top hairline picks up the accent colour and brightens on hover. */}
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${t.bar} to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${t.value}`}>{value}</p>
    </div>
  );
}

/** Section heading with a fading neon rule, used to break up long pages. */
export function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 font-mono text-sm font-normal text-muted">{count}</span>
          )}
        </h2>
        {children}
      </div>
      <div className="rule-glow mt-2" />
    </div>
  );
}
