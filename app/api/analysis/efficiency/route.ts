import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError, ValidationError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getFileContent } from '@/lib/github/repo';
import { analyseEfficiency } from '@/lib/analysis/rules/efficiency';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  path: z.string().min(1).max(500),
  ref: z.string().max(200).optional(),
});

/** Deterministic and key-free: parses the file and reports slow patterns. */
export async function POST(request: Request) {
  try {
    if (!rateLimit(`efficiency:${clientKey(request)}`, 40, 60_000)) {
      throw new AppError('Too many analysis requests. Wait a moment.', 429, 'RATE_LIMITED');
    }

    const body = await readJson(request, bodySchema);
    if (body.path.includes('..') || body.path.startsWith('/')) {
      throw new ValidationError('Invalid file path.');
    }

    const ref = parseRepoInput(`${body.owner}/${body.repo}`);
    const file = await getFileContent(ref, body.path, body.ref);

    if (file.isTruncated) {
      throw new ValidationError('This file is too large or is binary, so it cannot be analysed.');
    }

    const report = analyseEfficiency(body.path, file.text);

    return NextResponse.json({ ...report, source: file.text });
  } catch (error) {
    return errorResponse(error);
  }
}
