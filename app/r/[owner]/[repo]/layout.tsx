import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ChatWidget } from '@/components/ChatWidget';
import { CommandPalette } from '@/components/CommandPalette';
import { ErrorPanel } from '@/components/ui/Panel';
import { parseRepoInput } from '@/lib/github/client';
import { getRepoSummary } from '@/lib/github/repo';
import { NotFoundError, ValidationError, toErrorResponse } from '@/lib/errors';
import { serverKeyConfigured } from '@/lib/ai/provider';

interface Params {
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${owner}/${repo}` };
}

export default async function RepoLayout({
  children,
  params,
}: Params & { children: React.ReactNode }) {
  const { owner, repo } = await params;

  // Validate the slug and confirm the repository exists before rendering the
  // shell, so a bad URL gives a 404 page rather than four broken panels.
  let configError: string | null = null;
  try {
    const ref = parseRepoInput(`${owner}/${repo}`);
    await getRepoSummary(ref);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) notFound();

    /*
     * Anything else — a rejected token, a rate limit, GitHub being down — is
     * rendered rather than rethrown.
     *
     * Rethrowing from a *layout* escapes this segment's error boundary and is
     * caught by the parent, which can only show a generic "Something went
     * wrong". On a fresh deployment with a mistyped token that produced a blank
     * 500 with no indication that the token was the problem, when the message
     * needed to diagnose it already existed.
     */
    configError = toErrorResponse(error).message;
  }

  if (configError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
        <div className="w-full space-y-4">
          <ErrorPanel title="Cannot reach GitHub" message={configError} />
          <p className="px-1 text-sm text-text-secondary">
            If this is a deployed instance, check that{' '}
            <code className="text-neon-cyan">GITHUB_TOKEN</code> is set correctly in the hosting
            provider&rsquo;s environment variables, then redeploy.
          </p>
          <Link
            href="/"
            className="press inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-text-secondary hover:border-neon-violet/60 hover:text-neon-violet"
          >
            Back to start
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar owner={owner} repo={repo} serverKeyConfigured={serverKeyConfigured()} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
      <ChatWidget owner={owner} repo={repo} />
      <CommandPalette owner={owner} repo={repo} />
    </div>
  );
}
