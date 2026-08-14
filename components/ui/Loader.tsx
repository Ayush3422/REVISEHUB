import React from 'react';

/**
 * Two counter-rotating arcs rather than a single spinner ring — it reads as
 * instrumentation rather than a generic throbber, which suits the rest of the
 * interface. The label is the accessible name; the rings are decorative.
 */
export function Loader({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-5 p-10"
    >
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-neon-violet border-r-neon-violet/40 [animation-duration:1.1s]" />
        <div className="absolute inset-[6px] animate-spin rounded-full border-2 border-transparent border-b-neon-cyan border-l-neon-cyan/40 [animation-direction:reverse] [animation-duration:1.5s]" />
        <div className="animate-pulse-glow absolute inset-[18px] rounded-full bg-neon-violet/70 blur-[6px]" />
      </div>
      <p className="text-sm text-text-secondary">{text}</p>
    </div>
  );
}

/** Inline variant for headers and buttons, where a block loader would shift layout. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-current ${className}`}
    />
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`sweep-track rounded-lg border border-white/[0.05] bg-white/[0.03] ${className}`}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
