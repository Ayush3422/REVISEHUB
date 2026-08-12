import React from 'react';

export function Loader({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="text-text-secondary">{text}</p>
    </div>
  );
}

/** Content-shaped placeholder, used where a spinner would cause layout shift. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/40 ${className}`} />;
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
