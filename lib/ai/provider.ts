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
  if (/model|NOT_FOUND|404/i.test(message)) {
    throw new UpstreamError(
      'The configured AI model is unavailable. It may have been retired — set GEMINI_MODEL to a current model.',
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
