import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type output, type ZodTypeAny } from 'zod';
import { toErrorResponse, ValidationError } from '@/lib/errors';

/**
 * A tiny in-process rate limiter. It is per-instance and resets on redeploy,
 * which is the correct trade-off while there is no Redis: it costs nothing on
 * a free tier and still stops a single tab from looping an expensive AI call.
 * Replace with a shared store when the app becomes multi-instance.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Best-effort client identity for rate limiting behind a proxy. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/**
 * Generic over the schema rather than over a single `T`, so that a field with
 * a `.default()` is optional on the way in but guaranteed on the way out.
 */
export async function readJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      throw new ValidationError(
        first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body.',
      );
    }
    throw error;
  }
}

export function errorResponse(error: unknown): NextResponse {
  const { message, status, code } = toErrorResponse(error);
  if (status >= 500) console.error('[api]', error);
  return NextResponse.json({ error: message, code }, { status });
}
