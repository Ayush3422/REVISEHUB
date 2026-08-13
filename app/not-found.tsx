import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md glass rounded-2xl p-8 text-center">
        <p className="font-mono text-sm text-neon-violet">404</p>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Not found</h1>
        <p className="mt-3 text-sm text-text-secondary">
          That repository, pull request, or page does not exist. Public repositories only — private
          ones are not accessible without signing in.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-neon-violet px-4 py-2 text-sm font-semibold text-[#12071f] shadow-[0_0_20px_rgba(167,139,250,0.35)] transition hover:brightness-110"
        >
          Choose a repository
        </Link>
      </div>
    </main>
  );
}
