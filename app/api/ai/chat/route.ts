import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { getFileContent, getFileTree, getRepoSummary } from '@/lib/github/repo';
import { answerRepoQuestion } from '@/lib/ai/chat';
import { userKeyFrom } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 45;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  question: z.string().min(1).max(2000),
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

    const summary = await getRepoSummary(ref);
    const tree = await getFileTree(ref, summary.defaultBranch);

    // Give the model the README when there is one; a missing README is normal
    // and must not fail the request.
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

    const answer = await answerRepoQuestion({
      repo: summary,
      tree: tree.nodes,
      readme,
      history: body.history,
      question: body.question,
      userKey: userKeyFrom(request),
    });

    return NextResponse.json({ answer });
  } catch (error) {
    return errorResponse(error);
  }
}
