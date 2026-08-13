import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { answerRepoQuestion } from '@/lib/ai/chat';
import { buildRepoContext } from '@/lib/ai/context';
import { userKeyFrom } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 45;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  question: z.string().min(1).max(4000),
  paths: z.array(z.string().max(500)).max(5).default([]),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(20)
    .default([]),
});

export async function POST(request: Request) {
  try {
    if (!rateLimit(`chat:${clientKey(request)}`, 20, 60_000)) {
      throw new AppError('Too many messages. Wait a minute and try again.', 429, 'RATE_LIMITED');
    }

    const body = await readJson(request, bodySchema);
    const ref = parseRepoInput(`${body.owner}/${body.repo}`);

    const context = await buildRepoContext(ref, body.paths);

    const answer = await answerRepoQuestion({
      repo: context.summary,
      tree: context.tree,
      readme: context.readme,
      files: context.files,
      history: body.history,
      question: body.question,
      userKey: userKeyFrom(request),
    });

    return NextResponse.json({ answer });
  } catch (error) {
    return errorResponse(error);
  }
}
