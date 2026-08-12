import 'server-only';
import { Type } from '@google/genai';
import { z } from 'zod';
import { gemini, model, wrapGeminiError } from './client';
import { limitDiff, parseDiff } from '@/lib/diff';
import { SUGGESTION_CATEGORIES, SUGGESTION_SEVERITIES } from '@/lib/types';
import type { CodeSuggestion } from '@/lib/types';

/** Roughly 80k characters keeps a review inside a comfortable token budget. */
const MAX_DIFF_CHARS = 80_000;

/**
 * Handed to Gemini as `responseSchema`, which constrains decoding so the model
 * cannot emit a shape we did not ask for. The previous implementation asked for
 * JSON in prose and then ran `JSON.parse` on whatever came back, so one stray
 * token took down the whole review.
 */
const responseSchema = {
  type: Type.OBJECT,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['category', 'severity', 'file', 'title', 'description', 'confidence'],
        properties: {
          category: { type: Type.STRING, enum: [...SUGGESTION_CATEGORIES] },
          severity: { type: Type.STRING, enum: [...SUGGESTION_SEVERITIES] },
          file: { type: Type.STRING, description: 'Path exactly as it appears in the diff.' },
          line: {
            type: Type.INTEGER,
            description: 'Line number in the new version of the file, or 0 if not applicable.',
          },
          title: { type: Type.STRING, description: 'Under 80 characters.' },
          description: { type: Type.STRING },
          suggestedCode: {
            type: Type.STRING,
            description: 'Replacement code only, no markdown fences. Empty if not a code change.',
          },
          confidence: { type: Type.NUMBER, description: 'Between 0 and 1.' },
        },
      },
    },
  },
};

/** Belt and braces: the schema constrains the model, Zod verifies the result. */
const suggestionSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  severity: z.enum(SUGGESTION_SEVERITIES),
  file: z.string().min(1),
  line: z.number().int().nonnegative().nullish(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  suggestedCode: z.string().default(''),
  confidence: z.number().min(0).max(1).catch(0.5),
});

const payloadSchema = z.object({ suggestions: z.array(suggestionSchema).default([]) });

const SYSTEM_PROMPT = `You are a senior software engineer reviewing a pull request.

Report only problems that are visible in the diff you are given. You are seeing
changed lines, not the whole codebase, so:
- Do not speculate about code you cannot see.
- Do not report a symbol as undefined merely because its definition is not in the diff.
- If a concern depends on context outside the diff, either omit it or give it a low confidence.

Prioritise, in order: correctness bugs, security flaws, missing error handling,
performance problems, absent tests, unclear naming or documentation.

Skip pure formatting nits that a linter or formatter would fix automatically.

For every finding:
- "file" must match a path from the diff exactly.
- "line" must be a line number in the NEW version of the file. Use 0 when the
  finding applies to the file as a whole.
- "suggestedCode" is raw replacement code with no markdown fences. Leave it
  empty when the fix is not a code change.
- "confidence" reflects how certain you are given only this diff.

Returning an empty list is the correct answer for a clean diff. Never invent
findings to fill space.`;

export interface ReviewResult {
  suggestions: CodeSuggestion[];
  /** Files that were reviewed. */
  reviewedFiles: string[];
  /** Files skipped because they were binary or the diff exceeded the budget. */
  skippedFiles: string[];
}

export async function reviewDiff(diff: string): Promise<ReviewResult> {
  const files = parseDiff(diff);

  if (files.length === 0) {
    return { suggestions: [], reviewedFiles: [], skippedFiles: [] };
  }

  const { text, includedFiles, omittedFiles } = limitDiff(files, MAX_DIFF_CHARS);

  if (!text) {
    return { suggestions: [], reviewedFiles: [], skippedFiles: omittedFiles };
  }

  let raw: unknown;
  try {
    const response = await gemini().models.generateContent({
      model: model(),
      contents: `Review this diff.\n\n\`\`\`diff\n${text}\n\`\`\``,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    });

    const body = response.text;
    if (!body) return { suggestions: [], reviewedFiles: includedFiles, skippedFiles: omittedFiles };
    raw = JSON.parse(body);
  } catch (error) {
    wrapGeminiError(error, 'review');
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[gemini:review] response failed validation', parsed.error.issues);
    return { suggestions: [], reviewedFiles: includedFiles, skippedFiles: omittedFiles };
  }

  const validPaths = new Set(files.flatMap((f) => [f.newPath, f.oldPath]));

  const suggestions: CodeSuggestion[] = parsed.data.suggestions
    // Drop hallucinated file paths rather than rendering a card that points nowhere.
    .filter((s) => validPaths.has(s.file))
    .map((s) => ({
      category: s.category,
      severity: s.severity,
      file: s.file,
      line: s.line && s.line > 0 ? s.line : null,
      title: s.title,
      description: s.description,
      suggestedCode: stripFences(s.suggestedCode),
      confidence: s.confidence,
    }))
    .sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const bySeverity = rank[a.severity] - rank[b.severity];
      return bySeverity !== 0 ? bySeverity : b.confidence - a.confidence;
    });

  return { suggestions, reviewedFiles: includedFiles, skippedFiles: omittedFiles };
}

/** Models add markdown fences even when told not to. */
function stripFences(code: string): string {
  return code
    .replace(/^\s*```[a-zA-Z0-9+-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
