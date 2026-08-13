import 'server-only';
import { getFileContent, getFileTree, getRepoSummary } from '@/lib/github/repo';
import type { RepoRef, RepoSummary, TreeNode } from '@/lib/types';
import type { AttachedFile } from './chat';

/** Bounded so a crafted request cannot turn one message into fifty API calls. */
const MAX_ATTACHED_FILES = 5;

export interface RepoContext {
  summary: RepoSummary;
  tree: TreeNode[];
  readme: string | null;
  files: AttachedFile[];
}

/**
 * Assembles everything the assistant is allowed to see for one message.
 *
 * Shared by the streaming and non-streaming chat routes so the two cannot drift
 * apart — a difference in what the model is shown between them would be
 * invisible and very confusing to debug.
 */
export async function buildRepoContext(
  ref: RepoRef,
  requestedPaths: string[] = [],
): Promise<RepoContext> {
  const summary = await getRepoSummary(ref);
  const tree = await getFileTree(ref, summary.defaultBranch);

  const readmePath = tree.nodes.find(
    (n) => n.type === 'file' && /^readme(\.(md|rst|txt))?$/i.test(n.name),
  )?.path;

  let readme: string | null = null;
  if (readmePath) {
    try {
      const file = await getFileContent(ref, readmePath);
      readme = file.isTruncated ? null : file.text;
    } catch {
      readme = null;
    }
  }

  // Only paths that actually exist in the tree are fetched. Without this, an
  // arbitrary string from the client would be interpolated into a GitHub path.
  const known = new Set<string>();
  const collect = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') known.add(node.path);
      if (node.children) collect(node.children);
    }
  };
  collect(tree.nodes);

  const wanted = [...new Set(requestedPaths)]
    .filter((p) => known.has(p))
    .slice(0, MAX_ATTACHED_FILES);

  const files: AttachedFile[] = [];
  for (const path of wanted) {
    try {
      const file = await getFileContent(ref, path, summary.defaultBranch);
      files.push({ path, text: file.text, truncated: file.isTruncated });
    } catch {
      // A file that cannot be read is simply not attached; the prompt already
      // tells the model to say when it lacks the source it needs.
    }
  }

  return { summary, tree: tree.nodes, readme, files };
}
