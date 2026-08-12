import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getDashboardData, getPullRequests, getRepoSummary } from '@/lib/github/repo';
import { analyzeProject } from '@/lib/ai/analyze';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!rateLimit(`analyze:${clientKey(request)}`, 6, 60_000)) {
      throw new AppError(
        'Too many analysis requests. Wait a minute and try again.',
        429,
        'RATE_LIMITED',
      );
    }

    const body = await readJson(request, bodySchema);
    const ref = parseRepoInput(`${body.owner}/${body.repo}`);

    const [repo, dashboard, pulls] = await Promise.all([
      getRepoSummary(ref),
      getDashboardData(ref),
      getPullRequests(ref, 50),
    ]);

    const analysis = await analyzeProject({ repo, dashboard, pulls });

    return NextResponse.json({ analysis, statsPending: dashboard.statsPending });
  } catch (error) {
    return errorResponse(error);
  }
}
