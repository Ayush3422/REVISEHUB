import { parseRepoInput } from '@/lib/github/client';
import { getFileTree, getRepoSummary } from '@/lib/github/repo';
import { EfficiencyView } from '@/components/EfficiencyView';
import { ErrorPanel } from '@/components/ui/Panel';
import { toErrorResponse } from '@/lib/errors';

export const revalidate = 600;
export const metadata = { title: 'Efficiency' };

export default async function EfficiencyPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const ref = parseRepoInput(`${owner}/${repo}`);

  let tree, summary;
  try {
    summary = await getRepoSummary(ref);
    tree = await getFileTree(ref, summary.defaultBranch);
  } catch (error) {
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not load the file tree" message={message} />;
  }

  return (
    <div className="flex h-full animate-fade-in flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Code efficiency</h1>
        <p className="mt-1 text-text-secondary">
          Check a file in{' '}
          <span className="font-semibold text-neon-violet">
            {owner}/{repo}
          </span>{' '}
          for algorithmic inefficiency, then generate an optimized rewrite.
        </p>
      </header>

      <EfficiencyView
        owner={owner}
        repo={repo}
        tree={tree.nodes}
        defaultBranch={summary.defaultBranch}
      />
    </div>
  );
}
