import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';

/**
 * Server-side environment. Importing `server-only` above means any accidental
 * import of this module from a Client Component is a build error rather than a
 * secret leaked into the browser bundle.
 *
 * Note the absence of a `NEXT_PUBLIC_` prefix on every value here: that prefix
 * is what inlines a variable into client JavaScript, and no secret should ever
 * have one.
 *
 * Both keys are optional at this layer and required at the point of use, so a
 * missing Gemini key breaks only the AI features rather than the whole app.
 */
const schema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  /**
   * Pinned, deliberately.
   *
   * `gemini-flash-latest` looks like the safer choice — it survives model
   * retirements, which have broken this project twice. In practice the alias
   * resolves to Google's default model, which is also the most contended: it
   * measured 503 after 65 seconds while pinned versions answered in 1.4s.
   * A pin that might be retired in a year beats an alias that is unusable
   * today, and `wrapProviderError` names the fix if this one is ever retired.
   */
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash'),
  /**
   * Optional. Without it the GitHub API allows 60 requests/hour per IP, which
   * is not enough to load a dashboard. With a token it is 5,000/hour.
   */
  GITHUB_TOKEN: z.string().min(1).optional(),
});

let cached: z.infer<typeof schema> | null = null;

/**
 * Values are trimmed, and surrounding quotes are stripped.
 *
 * Both are pasting accidents rather than hypotheticals: a token copied with a
 * trailing newline produces `Bearer ghp_xxx\n`, and one pasted with the quotes
 * from a `.env` line produces `Bearer "ghp_xxx"`. Either yields a 401 that
 * looks exactly like an invalid token, sending you to regenerate a credential
 * that was fine all along.
 */
function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function env() {
  if (cached) return cached;

  cached = schema.parse({
    GEMINI_API_KEY: clean(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: clean(process.env.GEMINI_MODEL),
    GITHUB_TOKEN: clean(process.env.GITHUB_TOKEN),
  });

  return cached;
}

/** Called only by the AI layer, so GitHub-only pages work without a Gemini key. */
export function requireGeminiKey(): string {
  const key = env().GEMINI_API_KEY;
  if (!key) {
    throw new AppError(
      'AI features are not configured. Set GEMINI_API_KEY in .env.local and restart the server.',
      503,
      'AI_NOT_CONFIGURED',
    );
  }
  return key;
}
