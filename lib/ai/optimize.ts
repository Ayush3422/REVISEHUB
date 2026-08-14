import 'server-only';
import { Type } from '@google/genai';
import { z } from 'zod';
import { resolveProvider, wrapProviderError } from './provider';
import { ValidationError } from '@/lib/errors';
import type { Finding } from '@/lib/analysis/types';
import { extractBigO, truncate } from '@/lib/text';

/** Enough for a substantial module without an unreasonable prompt. */
const MAX_SOURCE_CHARS = 24_000;

const responseSchema = {
  type: Type.OBJECT,
  required: [
    'optimizedCode',
    'summary',
    'changes',
    'behaviourPreserved',
    'complexityBefore',
    'complexityAfter',
  ],
  properties: {
    optimizedCode: {
      type: Type.STRING,
      description: 'The complete rewritten file. Raw code, no markdown fences.',
    },
    summary: {
      type: Type.STRING,
      description: 'One or two sentences, under 400 characters.',
    },
    complexityBefore: {
      type: Type.STRING,
      description: 'Big-O notation only, under 40 characters. Example: O(n^2). No prose.',
    },
    complexityAfter: {
      type: Type.STRING,
      description: 'Big-O notation only, under 40 characters. Example: O(n). No prose.',
    },
    behaviourPreserved: {
      type: Type.BOOLEAN,
      description: 'False if any change could alter observable behaviour.',
    },
    behaviourNotes: {
      type: Type.STRING,
      description: 'Required when behaviourPreserved is false: what might differ, and why.',
    },
    changes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['what', 'why'],
        properties: {
          what: { type: Type.STRING, description: 'The specific edit made.' },
          why: { type: Type.STRING, description: 'The performance reason.' },
          impact: { type: Type.STRING, description: 'e.g. "O(n^2) to O(n)"' },
        },
      },
    },
  },
};

/**
 * Truncates instead of rejecting. A model that rambles in a cosmetic field
 * should not cost the user a perfectly good rewrite — one real response filled
 * `complexityBefore` with 88,000 characters of run-on text.
 */
const bounded = (max: number) => z.string().transform((v) => truncate(v, max));

const bigO = () => z.string().default('').transform(extractBigO);

const payloadSchema = z.object({
  optimizedCode: z.string().min(1),
  summary: bounded(600).pipe(z.string().min(1)),
  complexityBefore: bigO(),
  complexityAfter: bigO(),
  behaviourPreserved: z.boolean(),
  behaviourNotes: bounded(800).default(''),
  changes: z
    .array(
      z.object({
        what: bounded(300).pipe(z.string().min(1)),
        why: bounded(500).pipe(z.string().min(1)),
        impact: bounded(80).default(''),
      }),
    )
    .max(20)
    .default([]),
});

export type OptimizeResult = z.infer<typeof payloadSchema> & {
  originalCode: string;
  /** True when the model returned code identical to the input. */
  unchanged: boolean;
};

/**
 * Correctness outranks speed here. A faster function that returns different
 * results is not an optimisation, it is a bug — so the model is required to
 * declare when a change could alter behaviour rather than quietly making it.
 */
const SYSTEM_PROMPT = `You are a performance engineer rewriting a source file to be faster.

The single hard rule: PRESERVE OBSERVABLE BEHAVIOUR. Same inputs must produce
the same outputs, the same thrown errors, and the same side effects in the same
order. A faster function that behaves differently is a bug, not an optimisation.

If a genuine speed-up would change behaviour in any way — different iteration
order, different handling of duplicates, a changed error type, altered timing of
side effects — you must either not make it, or set behaviourPreserved to false
and explain precisely what differs in behaviourNotes.

Focus on the algorithmic problems reported below:
- Replace a linear scan inside a loop with a Set or Map lookup.
- Replace spread accumulation with mutation of an accumulator.
- Parallelise independent awaits with Promise.all. Keep them sequential when
  each iteration depends on the previous, or when a rate limit requires it —
  and say so rather than parallelising blindly.
- Hoist loop-invariant work out of the loop.
- Replace JSON.parse(JSON.stringify(x)) with structuredClone(x).

Also required:
- Return the COMPLETE file, not a fragment or a diff.
- Keep the existing language, module system, imports, exports, and public API.
- Keep the existing formatting conventions and preserve comments.
- Do not add dependencies.
- Do not rename exported symbols.
- Do not "improve" anything unrelated to performance. Leave style alone.

If the code has no meaningful performance problem, return it unchanged with an
empty changes array and say so in the summary. Do not invent work.`;

export interface OptimizeInput {
  path: string;
  source: string;
  findings: Finding[];
  userKey?: string | null;
}

export async function optimizeSource({
  path,
  source,
  findings,
  userKey,
}: OptimizeInput): Promise<OptimizeResult> {
  if (source.length > MAX_SOURCE_CHARS) {
    throw new ValidationError(
      `This file is ${Math.round(source.length / 1000)}k characters, above the ${MAX_SOURCE_CHARS / 1000}k limit for optimisation. Try a smaller file.`,
    );
  }

  // Titles only. Including the analyser's remediation prose invited the model
  // to copy it verbatim into the complexity fields.
  const reported =
    findings.length > 0
      ? findings.map((f) => `- Line ${f.line ?? '?'}: ${f.title}`).join('\n')
      : '(the analyser found no known slow pattern — say so unless you can see a real one)';

  let raw: unknown;
  try {
    const provider = resolveProvider(userKey);
    const body = await provider.generate({
      systemInstruction: SYSTEM_PROMPT,
      contents: `File: ${path}\n\nProblems reported by the static analyser:\n${reported}\n\nRewrite this file:\n\n\`\`\`\n${source}\n\`\`\``,
      // Low temperature: this is a mechanical transformation, not a creative one.
      temperature: 0.1,
      jsonSchema: responseSchema,
    });
    if (!body) throw new Error('empty response');
    raw = JSON.parse(body);
  } catch (error) {
    wrapProviderError(error, 'optimize');
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[ai:optimize] response failed validation', parsed.error.issues);
    throw new ValidationError('The optimizer returned a malformed result. Try again.');
  }

  const optimizedCode = stripFences(parsed.data.optimizedCode);

  return {
    ...parsed.data,
    optimizedCode,
    originalCode: source,
    unchanged: normalise(optimizedCode) === normalise(source),
  };
}

function stripFences(code: string): string {
  return code
    .replace(/^\s*```[a-zA-Z0-9+-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trimEnd();
}

/** Ignores trailing whitespace and line endings when comparing. */
function normalise(code: string): string {
  return code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
}
