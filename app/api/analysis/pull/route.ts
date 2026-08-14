import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getPullRequest, getPullRequestDiff } from '@/lib/github/repo';
import { analysePullRequest } from '@/lib/analysis/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
});

/**
 * The deterministic engine. No API key is involved, so this endpoint works on
 * a deployment with nothing configured. Limits are generous for that reason —
 * the only cost is GitHub requests.
 */
export async function POST(request: Request) {
  try {
    if (!rateLimit(`engine:${clientKey(request)}`, 30, 60_000)) {
      throw new AppError('Too many analysis requests. Wait a moment.', 429, 'RATE_LIMITED');
    }

    const body = await readJson(request, bodySchema);
    const ref = parseRepoInput(`${body.owner}/${body.repo}`);

    const [pr, diff] = await Promise.all([
      getPullRequest(ref, body.number),
      getPullRequestDiff(ref, body.number),
    ]);

    const result = await analysePullRequest({ ref, diff, headRef: pr.headSha });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
