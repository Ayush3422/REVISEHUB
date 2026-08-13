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
      <div className="w-full max-w-md glass rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
        <p className="mt-3 text-sm text-text-secondary">
          An unexpected error occurred. Try again, and if it persists check the server logs.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-neon-violet px-4 py-2 text-sm font-semibold text-[#12071f] shadow-[0_0_20px_rgba(167,139,250,0.35)] transition hover:brightness-110"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-secondary transition hover:border-neon-violet/60 hover:text-neon-violet"
          >
            Start over
          </Link>
        </div>
      </div>
    </main>
  );
}
