'use client';

import { useEffect } from 'react';
import { ErrorPanel } from '@/components/ui/Panel';

export default function RepoError({
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
    <div className="space-y-4">
      <ErrorPanel
        title="Could not load this section"
        message="The GitHub or AI request failed. This is usually a rate limit or a temporary upstream error."
      />
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/85"
      >
        Try again
      </button>
    </div>
  );
}
