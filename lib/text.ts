/**
 * Pure text helpers. No server-only imports, so these stay testable and can be
 * used from either side of the client/server boundary.
 */

/**
 * Pulls a Big-O expression out of free text.
 *
 * Asking a model for "O(n^2)" reliably produces something *containing* that,
 * but often with surrounding prose copied in — one response returned the
 * analyser's whole remediation paragraph in the field. Extracting the notation
 * is more robust than hoping the instruction is followed.
 */
export function extractBigO(value: string): string {
  const match = /O\s*\(\s*[^)\n]{1,24}\s*\)/.exec(value);
  return match ? match[0].replace(/\s+/g, '') : '';
}

/** Truncates to `max` characters, appending an ellipsis when it had to cut. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}
