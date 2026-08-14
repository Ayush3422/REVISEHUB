import type { DiffFile } from '@/lib/diff';
import type { Finding } from '../types';

/**
 * Detects credentials introduced by a diff.
 *
 * Two rules govern the output and neither is negotiable:
 *  1. The matched value is never emitted. A finding that quotes the secret
 *     would copy it into logs, caches, and the page itself.
 *  2. Only added lines are scanned. Flagging a secret that a diff *removes*
 *     would be backwards.
 */

interface Pattern {
  id: string;
  label: string;
  severity: 'CRITICAL' | 'HIGH';
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    id: 'aws-access-key',
    label: 'AWS access key ID',
    severity: 'CRITICAL',
    regex: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/,
  },
  {
    id: 'google-api-key',
    label: 'Google API key',
    severity: 'CRITICAL',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    // Google AI Studio also issues keys in a newer `AQ.` form, which the
    // `AIza` pattern above does not match. Both are live credentials.
    id: 'google-aistudio-key',
    label: 'Google AI Studio API key',
    severity: 'CRITICAL',
    regex: /\bAQ\.[A-Za-z0-9_-]{30,}\b/,
  },
  {
    id: 'github-token',
    label: 'GitHub token',
    severity: 'CRITICAL',
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/,
  },
  {
    id: 'github-pat-fine-grained',
    label: 'GitHub fine-grained token',
    severity: 'CRITICAL',
    regex: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  },
  {
    id: 'slack-token',
    label: 'Slack token',
    severity: 'HIGH',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: 'stripe-secret-key',
    label: 'Stripe secret key',
    severity: 'CRITICAL',
    regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'openai-api-key',
    label: 'OpenAI API key',
    severity: 'CRITICAL',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'anthropic-api-key',
    label: 'Anthropic API key',
    severity: 'CRITICAL',
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'private-key',
    label: 'Private key block',
    severity: 'CRITICAL',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    id: 'jwt',
    label: 'JSON Web Token',
    severity: 'HIGH',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: 'postgres-url',
    label: 'Database connection string with password',
    severity: 'CRITICAL',
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s:@/]+@/,
  },
];

/** Assignment to a secret-sounding name with a long literal value. */
const ASSIGNMENT =
  /(?:api[_-]?key|secret|password|passwd|token|credential|private[_-]?key|access[_-]?key)["'\s]*[:=]\s*["'`]([^"'`\s]{16,})["'`]/i;

/**
 * Placeholder values are the common case in example files and templates.
 * Flagging `API_KEY=your-key-here` trains people to ignore the scanner.
 */
const PLACEHOLDER =
  /^(?:x{3,}|\.{3,}|\*{3,}|<.*>|\$\{.*\}|process\.env\..*|your[_-]?.*|my[_-]?.*|example.*|sample.*|dummy.*|placeholder.*|changeme.*|test[_-]?.*|fake.*|todo.*|none|null|undefined|true|false|abc123.*|foo.*|bar.*|secret|password|token)$/i;

/** Files where a long random-looking string is expected and meaningless. */
const IGNORED_PATHS =
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Cargo\.lock|go\.sum|\.min\.(?:js|css)|.*\.snap)$/i;

/** Example env files are meant to be committed; real ones are not. */
const EXAMPLE_ENV = /(?:^|\/)\.env\.(?:example|sample|template|dist)$/i;

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Never returns the value — only enough to locate it. */
function redact(match: string): string {
  const head = match.slice(0, 4);
  return `${head}${'•'.repeat(Math.min(Math.max(match.length - 4, 4), 24))} (${match.length} chars, redacted)`;
}

export function secretRules(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (file.isBinary || file.isDeleted) continue;
    if (IGNORED_PATHS.test(file.newPath)) continue;

    const isExampleEnv = EXAMPLE_ENV.test(file.newPath);

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        const text = line.content;
        if (text.length > 4000) continue;

        for (const pattern of PATTERNS) {
          const match = pattern.regex.exec(text);
          if (!match) continue;

          // Deduplicate per file+rule; one report per leaked credential type
          // is actionable, fifty are noise.
          const key = `${file.newPath}:${pattern.id}`;
          if (seen.has(key)) continue;
          seen.add(key);

          findings.push({
            ruleId: `secrets/${pattern.id}`,
            source: 'engine',
            category: 'SECURITY',
            severity: pattern.severity,
            title: `${pattern.label} committed to the repository`,
            description: `A value matching the format of a ${pattern.label.toLowerCase()} was added in this change. Anything committed to git remains in the repository history even after it is deleted in a later commit.`,
            file: file.newPath,
            line: line.newLine,
            evidence: redact(match[0]),
            remediation: `Revoke and regenerate this credential now — treat it as compromised. Then remove it from the working tree, load it from an environment variable instead, and confirm the file is gitignored. Deleting the line alone is not sufficient; the value stays in history.`,
            confidence: 1,
          });
        }

        // Generic assignment check, skipped for `.env.example` and friends,
        // which exist precisely to hold fake values.
        if (isExampleEnv) continue;

        const assignment = ASSIGNMENT.exec(text);
        const value = assignment?.[1];
        if (!value || PLACEHOLDER.test(value)) continue;
        if (shannonEntropy(value) < 3.5) continue;

        const key = `${file.newPath}:generic:${line.newLine}`;
        if (seen.has(key)) continue;
        seen.add(key);

        findings.push({
          ruleId: 'secrets/high-entropy-assignment',
          source: 'engine',
          category: 'SECURITY',
          severity: 'HIGH',
          title: 'Possible hard-coded credential',
          description:
            'A secret-sounding variable is assigned a long, high-entropy literal. This may be a real credential rather than a placeholder.',
          file: file.newPath,
          line: line.newLine,
          evidence: redact(value),
          remediation:
            'If this is a real credential, revoke it and read it from an environment variable instead. If it is test data, this rule can be ignored.',
          confidence: 1,
        });
      }
    }
  }

  return findings;
}
