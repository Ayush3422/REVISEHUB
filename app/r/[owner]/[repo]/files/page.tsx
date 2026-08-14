import { parseRepoInput } from '@/lib/github/client';
import { getFileContent, getFileTree, getRepoSummary } from '@/lib/github/repo';
import { FileExplorer } from '@/components/FileExplorer';
import { ErrorPanel } from '@/components/ui/Panel';
import { toErrorResponse } from '@/lib/errors';
import type { FileContent } from '@/lib/types';

export const revalidate = 600;
export const metadata = { title: 'File explorer' };

export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { owner, repo } = await params;
  const { path: requestedPath } = await searchParams;
  const ref = parseRepoInput(`${owner}/${repo}`);

  let tree;
  let initialFile: FileContent | null = null;
  try {
    // The tree is fetched once, here, on the server. The previous version
    // fetched it in the app shell, passed it down, and then had the explorer
    // fetch it a second time on mount.
    const summary = await getRepoSummary(ref);
    tree = await getFileTree(ref, summary.defaultBranch);

    // A deep link from the command palette carries ?path=; load it here so the
    // file is on screen in the first render.
    if (requestedPath && !requestedPath.includes('..') && !requestedPath.startsWith('/')) {
      try {
        initialFile = await getFileContent(ref, requestedPath, summary.defaultBranch);
      } catch {
        initialFile = null;
      }
    }
  } catch (error) {
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not load the file tree" message={message} />;
  }

  return (
    <div className="flex h-full animate-fade-in flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">File explorer</h1>
        <p className="mt-1 text-text-secondary">
          Browse{' '}
          <span className="font-semibold text-neon-violet">
            {owner}/{repo}
          </span>{' '}
          and read any file.
        </p>
      </header>

      <FileExplorer
        owner={owner}
        repo={repo}
        tree={tree.nodes}
        truncated={tree.truncated}
        initialFile={initialFile}
      />
    </div>
  );
}
