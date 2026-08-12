/**
 * The finding model shared by the deterministic engine and the AI layer.
 *
 * Both produce the same shape so the UI renders them identically and the user
 * can see, per finding, where it came from. Engine findings are reproducible:
 * the same diff always yields the same results. AI findings are not, and are
 * labelled as such.
 *
 * Client-safe: no secrets, no server-only imports.
 */

export const FINDING_CATEGORIES = [
  'SECURITY',
  'DEPENDENCY',
  'BUG',
  'COMPLEXITY',
  'HYGIENE',
  'TESTING',
  'DOCUMENTATION',
  'OPTIMIZATION',
  'STYLE',
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FINDING_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/**
 * `engine` findings come from deterministic rules and need no API key.
 * `ai` findings come from a language model and may be wrong.
 */
export type FindingSource = 'engine' | 'ai';

export interface Finding {
  /** Stable identifier for the rule that produced this, e.g. `secrets/aws-access-key`. */
  ruleId: string;
  source: FindingSource;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  /** Repository-relative path, or null for repository-wide findings. */
  file: string | null;
  /** Line in the post-image of the file, or null when not line-specific. */
  line: number | null;
  /** Short excerpt of the offending code. Always redacted for secret findings. */
  evidence?: string;
  /** What to do about it. */
  remediation?: string;
  /** Replacement code, when the fix is mechanical. */
  suggestedCode?: string;
  /**
   * Engine findings are 1 by construction — the rule either matched or it did
   * not. AI findings carry the model's own estimate.
   */
  confidence: number;
  /** Supporting link, e.g. an OSV advisory or a rule reference. */
  referenceUrl?: string;
}

export interface AnalysisResult {
  findings: Finding[];
  /** Files the engine inspected. */
  scannedFiles: string[];
  /** Files skipped, with the reason, so coverage is never overstated. */
  skipped: { file: string; reason: string }[];
  /** Rule ids that failed to run, so a broken rule is visible rather than silent. */
  failedRules: string[];
  /** Milliseconds the engine took. */
  durationMs: number;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    // Deterministic findings outrank model guesses at equal severity.
    if (a.source !== b.source) return a.source === 'engine' ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (a.file ?? '').localeCompare(b.file ?? '');
  });
}

export function countBySeverity(findings: Finding[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}
