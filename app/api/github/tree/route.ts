import { NextResponse } from 'next/server';
import { clientKey, errorResponse, rateLimit } from '@/lib/api';
import { AppError, ValidationError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getFileTree, getRepoSummary } from '@/lib/github/repo';
import type { TreeNode } from '@/lib/types';

export const runtime = 'nodejs';

/** Enough to autocomplete against without shipping a huge payload. */
const MAX_PATHS = 4000;

function flattenFiles(nodes: TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (into.length >= MAX_PATHS) return into;
    if (node.type === 'file') into.push(node.path);
    if (node.children) flattenFiles(node.children, into);
  }
  return into;
}

/**
 * A flat list of file paths, for @-mention autocomplete in the assistant.
 *
 * Fetched lazily the first time the user types `@` rather than on every page
 * load, so pages that never open the assistant pay nothing for it.
 */
export async function GET(request: Request) {
  try {
    if (!rateLimit(`tree:${clientKey(request)}`, 30, 60_000)) {
      throw new AppError('Too many requests. Wait a moment.', 429, 'RATE_LIMITED');
    }

    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    if (!owner || !repo) throw new ValidationError('owner and repo are required.');

    const ref = parseRepoInput(`${owner}/${repo}`);
    const summary = await getRepoSummary(ref);
    const tree = await getFileTree(ref, summary.defaultBranch);

    return NextResponse.json({
      paths: flattenFiles(tree.nodes),
      truncated: tree.truncated,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
