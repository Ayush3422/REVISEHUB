import 'server-only';
import { Type } from '@google/genai';
import { z } from 'zod';
import { resolveProvider, wrapProviderError } from './provider';
import { limitDiff, parseDiff } from '@/lib/diff';
import { FINDING_CATEGORIES, type Finding } from '@/lib/analysis/types';

/** Roughly 80k characters keeps a review inside a comfortable token budget. */
const MAX_DIFF_CHARS = 80_000;

/**
 * Constrains decoding so the model cannot emit a shape we did not ask for.
 * The result is still validated with Zod afterwards.
 */
const responseSchema = {
  type: Type.OBJECT,
  required: ['findings'],
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['category', 'severity', 'file', 'title', 'description', 'confidence'],
        properties: {
          category: { type: Type.STRING, enum: [...FINDING_CATEGORIES] },
          severity: { type: Type.STRING, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          file: { type: Type.STRING, description: 'Path exactly as it appears in the diff.' },
          line: {
            type: Type.INTEGER,
            description: 'Line number in the new version of the file, or 0 if not applicable.',
          },
          title: { type: Type.STRING, description: 'Under 80 characters.' },
          description: { type: Type.STRING },
          remediation: { type: Type.STRING, description: 'How to fix it.' },
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

const findingSchema = z.object({
  category: z.enum(FINDING_CATEGORIES),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  file: z.string().min(1),
  line: z.number().int().nonnegative().nullish(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  remediation: z.string().default(''),
  suggestedCode: z.string().default(''),
  confidence: z.number().min(0).max(1).catch(0.5),
});

const payloadSchema = z.object({ findings: z.array(findingSchema).default([]) });

/**
 * The AI layer is deliberately scoped to what deterministic rules cannot do.
 * Secrets, dependency CVEs, complexity metrics, and hygiene are already
 * covered by the engine and reported with certainty; asking the model to
 * repeat them adds noise and an opportunity to be wrong about something that
 * was already known.
 */
const SYSTEM_PROMPT = `You are a senior engineer reviewing a pull request diff.

A deterministic static analysis engine has ALREADY reported the findings listed
below. Do not repeat them and do not contradict them. Your job is the part a
rule cannot express:

- Logic and correctness errors: off-by-one, inverted conditions, wrong operator,
  unhandled null, race conditions, incorrect error handling.
- Behaviour that does not match what the change appears to intend.
- Missing edge cases in the changed code.
- API misuse.

You are seeing changed lines only, not the whole codebase. Therefore:
- Do not speculate about code you cannot see.
- Do not report a symbol as undefined merely because its definition is absent
  from the diff.
- If a concern depends on context outside the diff, either omit it or give it a
  low confidence.

Do not report formatting or naming preferences. Do not report missing tests,
debug statements, or secrets — the engine handles those.

For every finding:
- "file" must exactly match a path from the diff.
- "line" must be a line number in the NEW version of the file, or 0.
- "suggestedCode" is raw code with no markdown fences.
- "confidence" reflects how certain you are given only this diff.

An empty list is the correct answer for a diff with no logic problems. Never
invent findings to fill space.`;

export interface AiReviewResult {
  findings: Finding[];
  reviewedFiles: string[];
  skippedFiles: string[];
}

export interface AiReviewInput {
  diff: string;
  /** Findings the engine already reported, so the model does not repeat them. */
  engineFindings: Finding[];
  userKey?: string | null;
}

export async function reviewDiff({
  diff,
  engineFindings,
  userKey,
}: AiReviewInput): Promise<AiReviewResult> {
  const files = parseDiff(diff);
  if (files.length === 0) return { findings: [], reviewedFiles: [], skippedFiles: [] };

  const { text, includedFiles, omittedFiles } = limitDiff(files, MAX_DIFF_CHARS);
  if (!text) return { findings: [], reviewedFiles: [], skippedFiles: omittedFiles };

  const alreadyKnown =
    engineFindings.length > 0
      ? engineFindings
          .slice(0, 40)
          .map(
            (f) => `- [${f.severity}] ${f.title}${f.file ? ` (${f.file}:${f.line ?? '-'})` : ''}`,
          )
          .join('\n')
      : '(none)';

  let raw: unknown;
  try {
    const provider = resolveProvider(userKey);
    const body = await provider.generate({
      systemInstruction: SYSTEM_PROMPT,
      contents: `Findings already reported by the static analysis engine:\n${alreadyKnown}\n\nReview this diff for logic and correctness problems the engine cannot detect.\n\n\`\`\`diff\n${text}\n\`\`\``,
      temperature: 0.2,
      jsonSchema: responseSchema,
    });
    if (!body) return { findings: [], reviewedFiles: includedFiles, skippedFiles: omittedFiles };
    raw = JSON.parse(body);
  } catch (error) {
    wrapProviderError(error, 'review');
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[ai:review] response failed validation', parsed.error.issues);
    return { findings: [], reviewedFiles: includedFiles, skippedFiles: omittedFiles };
  }

  const validPaths = new Set(files.flatMap((f) => [f.newPath, f.oldPath]));
  const engineKeys = new Set(engineFindings.map((f) => `${f.file}:${f.line}`));

  const findings: Finding[] = parsed.data.findings
    // A path not present in the diff means the model invented it.
    .filter((f) => validPaths.has(f.file))
    // Belt and braces on the "do not repeat the engine" instruction.
    .filter((f) => !engineKeys.has(`${f.file}:${f.line && f.line > 0 ? f.line : null}`))
    .map((f) => ({
      ruleId: 'ai/review',
      source: 'ai' as const,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      file: f.file,
      line: f.line && f.line > 0 ? f.line : null,
      ...(f.remediation ? { remediation: f.remediation } : {}),
      ...(f.suggestedCode ? { suggestedCode: stripFences(f.suggestedCode) } : {}),
      confidence: f.confidence,
    }));

  return { findings, reviewedFiles: includedFiles, skippedFiles: omittedFiles };
}

/** Models add markdown fences even when told not to. */
function stripFences(code: string): string {
  return code
    .replace(/^\s*```[a-zA-Z0-9+-]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
