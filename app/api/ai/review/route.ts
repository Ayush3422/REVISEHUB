import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getPullRequestDiff } from '@/lib/github/repo';
import { reviewDiff } from '@/lib/ai/review';

export const runtime = 'nodejs';
/** A large review can take a while; the default 15s is not enough. */
export const maxDuration = 60;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    if (!rateLimit(`review:${clientKey(request)}`, 10, 60_000)) {
      throw new AppError(
        'Too many review requests. Wait a minute and try again.',
        429,
        'RATE_LIMITED',
      );
    }

    const body = await readJson(request, bodySchema);
    const ref = parseRepoInput(`${body.owner}/${body.repo}`);

    const diff = await getPullRequestDiff(ref, body.number);
    const result = await reviewDiff(diff);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
