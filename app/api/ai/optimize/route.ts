import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError, ValidationError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getFileContent } from '@/lib/github/repo';
import { analyseEfficiency } from '@/lib/analysis/rules/efficiency';
import { optimizeSource } from '@/lib/ai/optimize';
import { userKeyFrom } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 90;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  path: z.string().min(1).max(500),
  ref: z.string().max(200).optional(),
});

/**
 * The source and the findings are both recomputed here rather than accepted
 * from the client. The client could send anything, and the optimizer's output
 * is only meaningful when it is rewriting the file it claims to be rewriting.
 */
export async function POST(request: Request) {
  try {
    if (!rateLimit(`optimize:${clientKey(request)}`, 8, 60_000)) {
      throw new AppError(
        'Too many optimisation requests. Wait a minute and try again.',
        429,
        'RATE_LIMITED',
      );
    }

    const body = await readJson(request, bodySchema);
    if (body.path.includes('..') || body.path.startsWith('/')) {
      throw new ValidationError('Invalid file path.');
    }

    const ref = parseRepoInput(`${body.owner}/${body.repo}`);
    const file = await getFileContent(ref, body.path, body.ref);

    if (file.isTruncated) {
      throw new ValidationError('This file is too large or is binary, so it cannot be optimised.');
    }

    const report = analyseEfficiency(body.path, file.text);

    const result = await optimizeSource({
      path: body.path,
      source: file.text,
      findings: report.findings,
      userKey: userKeyFrom(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
