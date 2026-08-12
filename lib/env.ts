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
   * A moving alias by default, not a pinned version. This project has already
   * been broken twice by model retirement (gemini-1.5-flash, then
   * gemini-2.5-flash, which Google now blocks for newly issued keys). The
   * alias tracks the current Flash model, so the app keeps working.
   * Pin an explicit version here if you need reproducible output.
   */
  GEMINI_MODEL: z.string().min(1).default('gemini-flash-latest'),
  /**
   * Optional. Without it the GitHub API allows 60 requests/hour per IP, which
   * is not enough to load a dashboard. With a token it is 5,000/hour.
   */
  GITHUB_TOKEN: z.string().min(1).optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;

  cached = schema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || undefined,
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
