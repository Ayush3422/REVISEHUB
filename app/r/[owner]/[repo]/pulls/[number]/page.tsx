import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { parseRepoInput } from '@/lib/github/client';
import { getPullRequest, getPullRequestDiff } from '@/lib/github/repo';
import { DiffViewer } from '@/components/DiffViewer';
import { FindingsPanel } from '@/components/FindingsPanel';
import { analysePullRequest } from '@/lib/analysis/engine';
import { ErrorPanel, Stat } from '@/components/ui/Panel';
import { NotFoundError, toErrorResponse } from '@/lib/errors';

export const revalidate = 120;

interface Params {
  params: Promise<{ owner: string; repo: string; number: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { owner, repo, number } = await params;
  return { title: `PR #${number} · ${owner}/${repo}` };
}

export default async function PullRequestPage({ params }: Params) {
  const { owner, repo, number: rawNumber } = await params;

  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number <= 0) notFound();

  const ref = parseRepoInput(`${owner}/${repo}`);

  let pr, diff;
  try {
    [pr, diff] = await Promise.all([getPullRequest(ref, number), getPullRequestDiff(ref, number)]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not load this pull request" message={message} />;
  }

  // Deterministic findings are computed during render, so they are in the
  // initial HTML rather than arriving after a client round-trip.
  const engine = await analysePullRequest({ ref, diff, headRef: pr.headSha });

  return (
    <div className="flex h-full animate-fade-in flex-col">
      <header className="mb-6">
        <Link
          href={`/r/${owner}/${repo}/pulls`}
          className="press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-neon-violet hover:bg-neon-violet/[0.08]"
        >
          &larr; Back to pull requests
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-text-primary lg:text-3xl">
          {pr.title} <span className="font-normal text-text-secondary">#{pr.number}</span>
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          {pr.authorAvatar && (
            <Image
              src={pr.authorAvatar}
              alt=""
              width={24}
              height={24}
              className="rounded-full"
              unoptimized
            />
          )}
          <span className="font-semibold text-text-primary">{pr.author}</span>
          <span>wants to merge</span>
          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-xs text-neon-cyan">
            {pr.branch}
          </code>
          <span>into</span>
          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-xs text-neon-cyan">
            {pr.baseBranch}
          </code>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="press ml-1 inline-flex min-h-9 items-center rounded-md px-1.5 text-neon-cyan hover:bg-neon-cyan/[0.08]"
          >
            View on GitHub ↗
          </a>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Additions" value={`+${pr.additions}`} tone="positive" />
          <Stat label="Deletions" value={`-${pr.deletions}`} tone="negative" />
          <Stat label="Files" value={pr.changedFiles} />
          <Stat label="Commits" value={pr.commits} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden glass rounded-2xl">
          <header className="border-b border-white/[0.07] px-5 py-3">
            <h2 className="font-semibold text-text-primary">Code changes</h2>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <DiffViewer diff={diff} />
          </div>
        </section>

        <FindingsPanel owner={owner} repo={repo} number={number} initialEngine={engine} />
      </div>
    </div>
  );
}
