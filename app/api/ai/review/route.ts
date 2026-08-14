import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getPullRequestDiff } from '@/lib/github/repo';
import { reviewDiff } from '@/lib/ai/review';
import { userKeyFrom } from '@/lib/ai/provider';
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from '@/lib/analysis/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * The client sends the engine's findings so the model is told what is already
 * known and does not repeat it. They are re-validated here rather than
 * trusted: this is user-controlled input that ends up in a prompt.
 */
const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  engineFindings: z
    .array(
      z.object({
        ruleId: z.string().max(120),
        source: z.literal('engine'),
        category: z.enum(FINDING_CATEGORIES),
        severity: z.enum(FINDING_SEVERITIES),
        title: z.string().max(300),
        description: z.string().max(2000),
        file: z.string().max(500).nullable(),
        line: z.number().int().nullable(),
        confidence: z.number(),
      }),
    )
    .max(200)
    .default([]),
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

    const result = await reviewDiff({
      diff,
      engineFindings: body.engineFindings,
      userKey: userKeyFrom(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
