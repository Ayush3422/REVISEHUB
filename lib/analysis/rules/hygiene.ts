import type { DiffFile } from '@/lib/diff';
import type { Finding } from '../types';

/**
 * Rules over the shape and content of a change, independent of language
 * semantics. Cheap, deterministic, and they catch the mistakes that actually
 * reach review most often.
 */

const TEST_PATH =
  /(?:^|\/)(?:__tests__|__specs__|tests?|specs?|e2e|cypress)\/|\.(?:test|spec)\.[jt]sx?$|_test\.(?:py|go|rb)$|Test\.java$/i;

const SOURCE_FILE = /\.(?:[jt]sx?|mjs|cjs|py|rb|go|java|kt|rs|php|cs|swift|scala)$/i;

/** Files that should never be committed. */
const FORBIDDEN_FILES: { pattern: RegExp; label: string; severity: 'CRITICAL' | 'HIGH' }[] = [
  {
    pattern: /(?:^|\/)\.env(?:\.local|\.production|\.development)?$/i,
    label: 'environment file',
    severity: 'CRITICAL',
  },
  {
    pattern: /\.(?:pem|key|p12|pfx|keystore|jks)$/i,
    label: 'private key or keystore',
    severity: 'CRITICAL',
  },
  {
    pattern: /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
    label: 'SSH private key',
    severity: 'CRITICAL',
  },
  {
    pattern: /(?:^|\/)(?:credentials|secrets)\.(?:json|ya?ml|ini)$/i,
    label: 'credentials file',
    severity: 'HIGH',
  },
  {
    pattern: /(?:^|\/)\.npmrc$/i,
    label: 'npm config (often contains auth tokens)',
    severity: 'HIGH',
  },
];

/** Debug statements, per language. */
const DEBUG_STATEMENTS: { pattern: RegExp; label: string; severity: 'MEDIUM' | 'HIGH' }[] = [
  { pattern: /^\s*debugger\s*;?\s*$/, label: '`debugger` statement', severity: 'HIGH' },
  {
    pattern: /\bconsole\.(?:log|debug|dir|trace)\s*\(/,
    label: '`console.log` call',
    severity: 'MEDIUM',
  },
  {
    pattern: /^\s*(?:import\s+)?pdb\.set_trace\s*\(|^\s*breakpoint\s*\(\s*\)/,
    label: 'Python breakpoint',
    severity: 'HIGH',
  },
  {
    pattern: /\bSystem\.out\.print(?:ln)?\s*\(/,
    label: '`System.out.println` call',
    severity: 'MEDIUM',
  },
  { pattern: /^\s*fmt\.Print(?:ln|f)?\s*\(/, label: 'Go debug print', severity: 'MEDIUM' },
];

const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/;
const TODO_MARKER = /(?:^|\s|\/\/|#|\*)\s*(TODO|FIXME|HACK|XXX)\b[:\s]/;

/** A PR above this size is hard to review carefully. */
const LARGE_PR_LINES = 500;
const LARGE_PR_FILES = 20;

export function hygieneRules(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  let totalChanged = 0;
  let touchedTests = false;
  let touchedSource = false;

  for (const file of files) {
    totalChanged += file.additions + file.deletions;
    if (TEST_PATH.test(file.newPath)) touchedTests = true;
    else if (SOURCE_FILE.test(file.newPath) && !file.isDeleted) touchedSource = true;

    // --- Forbidden files ---
    if (!file.isDeleted) {
      for (const { pattern, label, severity } of FORBIDDEN_FILES) {
        if (!pattern.test(file.newPath)) continue;
        findings.push({
          ruleId: 'hygiene/forbidden-file',
          source: 'engine',
          category: 'SECURITY',
          severity,
          title: `A ${label} is committed to the repository`,
          description: `\`${file.newPath}\` is a ${label}. Files of this kind normally hold credentials and should never be tracked in version control.`,
          file: file.newPath,
          line: null,
          remediation: `Add this path to .gitignore, remove it with \`git rm --cached\`, and rotate anything it contained. It remains in git history until that history is rewritten.`,
          confidence: 1,
        });
      }
    }

    if (file.isBinary || file.isDeleted) continue;

    const debugSeen = new Set<string>();

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        const text = line.content;

        // --- Merge conflict markers ---
        if (CONFLICT_MARKER.test(text)) {
          findings.push({
            ruleId: 'hygiene/merge-conflict-marker',
            source: 'engine',
            category: 'BUG',
            severity: 'CRITICAL',
            title: 'Unresolved merge conflict marker',
            description:
              'A conflict marker was committed. The file almost certainly does not parse, and a broken merge has been left half-finished.',
            file: file.newPath,
            line: line.newLine,
            evidence: text.trim().slice(0, 80),
            remediation:
              'Resolve the conflict and remove the <<<<<<<, ======= and >>>>>>> markers.',
            confidence: 1,
          });
          continue;
        }

        // --- Debug statements ---
        for (const { pattern, label, severity } of DEBUG_STATEMENTS) {
          if (!pattern.test(text)) continue;
          if (debugSeen.has(label)) continue;
          debugSeen.add(label);

          findings.push({
            ruleId: 'hygiene/debug-statement',
            source: 'engine',
            category: 'HYGIENE',
            severity,
            title: `${label} left in the code`,
            description: `A ${label} was added in this change. Debug output left in production code leaks internal state into logs and clutters output.`,
            file: file.newPath,
            line: line.newLine,
            evidence: text.trim().slice(0, 120),
            remediation: 'Remove it, or replace it with a proper logger at an appropriate level.',
            confidence: 1,
          });
        }

        // --- TODO markers ---
        const todo = TODO_MARKER.exec(text);
        if (todo) {
          findings.push({
            ruleId: 'hygiene/todo-added',
            source: 'engine',
            category: 'DOCUMENTATION',
            severity: 'INFO',
            title: `${todo[1]} comment added`,
            description: 'This change introduces unfinished work marked in a comment.',
            file: file.newPath,
            line: line.newLine,
            evidence: text.trim().slice(0, 120),
            remediation:
              'Either finish it before merging, or open a tracked issue and reference it here.',
            confidence: 1,
          });
        }
      }
    }
  }

  // --- Change size ---
  if (totalChanged > LARGE_PR_LINES || files.length > LARGE_PR_FILES) {
    findings.push({
      ruleId: 'hygiene/large-change',
      source: 'engine',
      category: 'COMPLEXITY',
      severity: 'LOW',
      title: `Large change: ${files.length} files, ${totalChanged} lines`,
      description:
        'Review quality drops sharply with change size, and defects are more likely to be missed in a large diff.',
      file: null,
      line: null,
      remediation:
        'Where possible, split this into smaller changes that can each be reviewed on their own.',
      confidence: 1,
    });
  }

  // --- Source changed without tests ---
  if (touchedSource && !touchedTests) {
    findings.push({
      ruleId: 'hygiene/no-tests-touched',
      source: 'engine',
      category: 'TESTING',
      severity: 'MEDIUM',
      title: 'Source code changed but no tests were added or updated',
      description:
        'This change modifies source files without touching any test file, so the new behaviour is unverified.',
      file: null,
      line: null,
      remediation: 'Add or update tests covering the changed behaviour.',
      confidence: 1,
    });
  }

  return findings;
}
