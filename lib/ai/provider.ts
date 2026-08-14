import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';
import { AppError, UpstreamError } from '@/lib/errors';

/**
 * A narrow interface over the model, so the rest of the app never imports a
 * vendor SDK directly. Swapping or adding a provider means adding one file
 * here, not touching the review, analysis, and chat code.
 */

export interface GenerateOptions {
  systemInstruction: string;
  contents: string | { role: 'user' | 'model'; parts: { text: string }[] }[];
  temperature?: number;
  /** Provider-neutral JSON schema. Omit for free-text output. */
  jsonSchema?: object;
}

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  generate(options: GenerateOptions): Promise<string>;
  /**
   * Yields text as the model produces it. Used for conversational replies,
   * where waiting for a complete answer before showing anything makes a
   * two-second response feel like a stall.
   */
  generateStream(options: GenerateOptions): AsyncIterable<string>;
}

class GeminiProvider implements AiProvider {
  readonly id = 'gemini';
  readonly model: string;
  readonly #client: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.#client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generate({ systemInstruction, contents, temperature, jsonSchema }: GenerateOptions) {
    const response = await this.#client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction,
        temperature: temperature ?? 0.3,
        ...(jsonSchema ? { responseMimeType: 'application/json', responseSchema: jsonSchema } : {}),
      },
    });
    return response.text ?? '';
  }

  async *generateStream({
    systemInstruction,
    contents,
    temperature,
  }: GenerateOptions): AsyncIterable<string> {
    // Retried because Gemini returns 503 "experiencing high demand" under load
    // and explicitly says the condition is temporary. Only the initial request
    // is retried; once tokens are flowing a restart would duplicate output.
    const stream = await withRetry(() =>
      this.#client.models.generateContentStream({
        model: this.model,
        contents,
        config: { systemInstruction, temperature: temperature ?? 0.3 },
      }),
    );

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}

/** True for upstream conditions the provider itself describes as temporary. */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /503|UNAVAILABLE|overloaded|high demand|try again later|ECONNRESET|ETIMEDOUT/i.test(
    message,
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts - 1) throw error;
      // 400ms, then 1200ms. Short enough to stay inside the request budget.
      await new Promise((r) => setTimeout(r, 400 * 3 ** attempt));
    }
  }

  throw lastError;
}

/**
 * Resolves which key to use.
 *
 * A user-supplied key takes precedence over the server's, which is the point
 * of the bring-your-own-key option: a visitor to a deployed instance spends
 * their own quota rather than the owner's.
 *
 * The key is used for this request and then discarded. It is never logged,
 * never written to disk, and never included in an error message.
 */
export function resolveProvider(userKey?: string | null): AiProvider {
  const { GEMINI_API_KEY, GEMINI_MODEL } = env();
  const key = userKey?.trim() || GEMINI_API_KEY;

  if (!key) {
    throw new AppError(
      'AI features need an API key. Either set GEMINI_API_KEY on the server, or add your own key using the key button in the interface.',
      503,
      'AI_NOT_CONFIGURED',
    );
  }

  return new GeminiProvider(key, GEMINI_MODEL);
}

/** True when the server has its own key, so the UI can explain what is available. */
export function serverKeyConfigured(): boolean {
  return Boolean(env().GEMINI_API_KEY);
}

/**
 * Provider errors are never forwarded verbatim: they can echo request
 * metadata, and a user-supplied key must not be able to leak back out through
 * an error string.
 */
export function wrapProviderError(error: unknown, context: string): never {
  if (error instanceof AppError) throw error;

  console.error(`[ai:${context}] ${error instanceof Error ? error.name : 'error'}`);
  const message = error instanceof Error ? error.message : '';

  // Checked before the quota branch: a 503 "high demand" is the provider being
  // busy, not the caller being out of quota, and telling the user to wait for a
  // quota reset would send them chasing the wrong problem.
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(message)) {
    throw new UpstreamError(
      'The AI model is temporarily overloaded on Google’s side. This usually clears within a minute — try again, or set GEMINI_MODEL to a less busy model such as gemini-3.1-flash-lite.',
    );
  }
  if (/quota|RESOURCE_EXHAUSTED|rate.?limit|429/i.test(message)) {
    throw new UpstreamError(
      'The AI provider quota is exhausted. Wait for it to reset, or supply your own API key.',
    );
  }
  if (/API.?key|invalid|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    throw new UpstreamError(
      'The AI provider rejected the API key. Check that it is valid and active.',
    );
  }
  if (/SAFETY|blocked|RECITATION/i.test(message)) {
    throw new UpstreamError('The AI provider declined to answer for this content.');
  }
  // Deliberately narrow: an unqualified /model/ would swallow almost every
  // provider error, since the word appears in most of them.
  if (/NOT_FOUND|404|is no longer available|not found for API version/i.test(message)) {
    throw new UpstreamError(
      'The configured AI model is unavailable — Google retires models and blocks older ones for newly issued keys. Set GEMINI_MODEL to a current model, for example gemini-3.5-flash.',
    );
  }
  throw new UpstreamError('The AI service is unavailable right now. Please try again.');
}

/** Reads a per-request user key from the request headers. */
export function userKeyFrom(request: Request): string | null {
  const key = request.headers.get('x-ai-key');
  if (!key) return null;
  const trimmed = key.trim();
  // Bound the length so a malformed header cannot be used to bloat a request.
  return trimmed.length > 0 && trimmed.length <= 400 ? trimmed : null;
}
