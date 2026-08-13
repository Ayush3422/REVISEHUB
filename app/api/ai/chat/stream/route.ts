import { z } from 'zod';
import { clientKey, errorResponse, rateLimit, readJson } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { parseRepoInput } from '@/lib/github/client';
import { buildRepoContext } from '@/lib/ai/context';
import { streamRepoAnswer } from '@/lib/ai/chat';
import { userKeyFrom } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  question: z.string().min(1).max(4000),
  /** Paths the user attached with @-mentions. Validated against the tree. */
  paths: z.array(z.string().max(500)).max(5).default([]),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(20)
    .default([]),
});

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`chat:${clientKey(request)}`, 20, 60_000)) {
      throw new AppError('Too many messages. Wait a minute and try again.', 429, 'RATE_LIMITED');
    }

    const body = await readJson(request, bodySchema);
    const ref = parseRepoInput(`${body.owner}/${body.repo}`);

    // Everything that can fail with a meaningful status happens BEFORE the
    // stream opens. Once SSE headers are sent the status is fixed at 200, so a
    // missing key or a bad repo has to be reported here or not at all.
    const context = await buildRepoContext(ref, body.paths);
    const iterator = streamRepoAnswer({
      repo: context.summary,
      tree: context.tree,
      readme: context.readme,
      files: context.files,
      history: body.history,
      question: body.question,
      userKey: userKeyFrom(request),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Tell the client which files were actually attached, which may be
        // fewer than requested if a path did not exist or could not be read.
        controller.enqueue(
          encoder.encode(sse('context', { files: context.files.map((f) => f.path) })),
        );

        try {
          for await (const chunk of iterator) {
            controller.enqueue(encoder.encode(sse('delta', { text: chunk })));
          }
          controller.enqueue(encoder.encode(sse('done', {})));
        } catch (error) {
          console.error('[chat:stream]', error);
          // Mid-stream failures cannot change the status code, so they are
          // reported as an event the client renders inline.
          controller.enqueue(
            encoder.encode(
              sse('error', { message: 'The response was interrupted. Please try again.' }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Stops nginx and similar proxies from buffering the stream, which
        // would defeat the point by delivering it all at once at the end.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
