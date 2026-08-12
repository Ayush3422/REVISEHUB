import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { env, requireGeminiKey } from '@/lib/env';
import { AppError, UpstreamError } from '@/lib/errors';

let cached: GoogleGenAI | null = null;

/**
 * The Gemini client lives on the server only. The previous version constructed
 * it in a module imported by React components and fed it a key that Vite had
 * inlined into the browser bundle, so the key was readable by anyone who
 * opened DevTools.
 */
export function gemini(): GoogleGenAI {
  if (!cached) cached = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return cached;
}

export function model(): string {
  return env().GEMINI_MODEL;
}

/**
 * Upstream failures must not propagate verbatim: provider errors sometimes
 * echo request metadata, and that is not something to forward to a browser.
 */
export function wrapGeminiError(error: unknown, context: string): never {
  // A configuration error is already a clear, user-safe message — pass it through.
  if (error instanceof AppError) throw error;

  console.error(`[gemini:${context}]`, error);
  const message = error instanceof Error ? error.message : '';

  if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) {
    throw new UpstreamError('The Gemini API quota is exhausted. Try again later.');
  }
  if (/API key|401|403|PERMISSION_DENIED/i.test(message)) {
    throw new UpstreamError('Gemini rejected the API key. Check GEMINI_API_KEY on the server.');
  }
  if (/SAFETY|blocked/i.test(message)) {
    throw new UpstreamError('Gemini declined to answer for this content.');
  }
  throw new UpstreamError('The AI service is unavailable right now. Please try again.');
}
