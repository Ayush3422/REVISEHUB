'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-muted/50 bg-surface/50 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-3 text-sm text-text-secondary">
          An unexpected error occurred. Try again, and if it persists check the server logs.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/85"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-muted/60 px-4 py-2 text-sm text-text-secondary transition hover:border-primary hover:text-primary"
          >
            Start over
          </Link>
        </div>
      </div>
    </main>
  );
}
