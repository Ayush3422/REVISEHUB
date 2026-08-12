import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-muted/50 bg-surface/50 p-8 text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Not found</h1>
        <p className="mt-3 text-sm text-text-secondary">
          That repository, pull request, or page does not exist. Public repositories only — private
          ones are not accessible without signing in.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/85"
        >
          Choose a repository
        </Link>
      </div>
    </main>
  );
}
