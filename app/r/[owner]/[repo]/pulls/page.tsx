import Link from 'next/link';
import Image from 'next/image';
import { parseRepoInput } from '@/lib/github/client';
import { getPullRequests } from '@/lib/github/repo';
import { EmptyState, ErrorPanel } from '@/components/ui/Panel';
import { ChevronRightIcon } from '@/components/icons/ChevronRightIcon';
import { CodeIcon } from '@/components/icons/CodeIcon';
import { toErrorResponse } from '@/lib/errors';
import type { PullRequestState } from '@/lib/types';

export const revalidate = 120;

const STATE_STYLES: Record<PullRequestState, string> = {
  open: 'bg-emerald-500/15 text-emerald-400',
  merged: 'bg-violet-500/15 text-violet-400',
  closed: 'bg-red-500/15 text-red-400',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function PullsPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const ref = parseRepoInput(`${owner}/${repo}`);

  let pulls;
  try {
    pulls = await getPullRequests(ref);
  } catch (error) {
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not load pull requests" message={message} />;
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Pull requests</h1>
        <p className="mt-1 text-text-secondary">
          {pulls.length > 0
            ? `${pulls.length} most recently updated. Open one to review its diff with AI.`
            : 'Open one to review its diff with AI.'}
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-muted/50 bg-surface/50 shadow-lg">
        {pulls.length === 0 ? (
          <EmptyState
            icon={<CodeIcon className="h-10 w-10" />}
            title="No pull requests"
            message={`${owner}/${repo} has no pull requests yet, so there is nothing to review here.`}
          />
        ) : (
          <ul className="divide-y divide-muted/40">
            {pulls.map((pr) => (
              <li key={pr.number}>
                <Link
                  href={`/r/${owner}/${repo}/pulls/${pr.number}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATE_STYLES[pr.state]}`}
                      >
                        {pr.state}
                      </span>
                      {pr.isDraft && (
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs font-semibold text-text-secondary">
                          Draft
                        </span>
                      )}
                      <p className="truncate font-semibold text-text-primary">
                        {pr.title}{' '}
                        <span className="font-normal text-text-secondary">#{pr.number}</span>
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      {pr.authorAvatar && (
                        <Image
                          src={pr.authorAvatar}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-full"
                          unoptimized
                        />
                      )}
                      <span>{pr.author}</span>
                      <span aria-hidden="true">·</span>
                      <code className="rounded bg-background px-1.5 py-0.5 text-xs text-secondary">
                        {pr.branch}
                      </code>
                      <span aria-hidden="true">·</span>
                      <span>updated {relativeTime(pr.updatedAt)}</span>
                    </div>
                  </div>

                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
