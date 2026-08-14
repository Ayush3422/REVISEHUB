import { NextResponse } from 'next/server';
import { clientKey, errorResponse, rateLimit } from '@/lib/api';
import { AppError, ValidationError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getFileContent } from '@/lib/github/repo';

export const runtime = 'nodejs';

/**
 * Backs the file explorer's on-click file loads. The GitHub token stays on the
 * server; the browser only ever talks to this endpoint.
 */
export async function GET(request: Request) {
  try {
    if (!rateLimit(`file:${clientKey(request)}`, 60, 60_000)) {
      throw new AppError('Too many file requests. Slow down a moment.', 429, 'RATE_LIMITED');
    }

    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const path = url.searchParams.get('path');

    if (!owner || !repo || !path) {
      throw new ValidationError('owner, repo and path query parameters are required.');
    }
    // Reject traversal before the value reaches a URL path segment.
    if (path.includes('..') || path.startsWith('/')) {
      throw new ValidationError('Invalid file path.');
    }

    const ref = parseRepoInput(`${owner}/${repo}`);
    const file = await getFileContent(ref, path);

    return NextResponse.json(file);
  } catch (error) {
    return errorResponse(error);
  }
}
