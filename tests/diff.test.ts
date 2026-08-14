import { describe, expect, it } from 'vitest';
import { limitDiff, parseDiff } from '@/lib/diff';

const SAMPLE = `diff --git a/src/calc.ts b/src/calc.ts
index 1234567..89abcde 100644
--- a/src/calc.ts
+++ b/src/calc.ts
@@ -10,7 +10,8 @@ export function sum(a: number, b: number) {
   const total = a + b;
-  return total;
+  console.log(total);
+  return total * 1;
 }

 export const ZERO = 0;
`;

describe('parseDiff', () => {
  const [file] = parseDiff(SAMPLE);

  it('extracts the file paths', () => {
    expect(file?.oldPath).toBe('src/calc.ts');
    expect(file?.newPath).toBe('src/calc.ts');
  });

  it('counts additions and deletions', () => {
    expect(file?.additions).toBe(2);
    expect(file?.deletions).toBe(1);
  });

  /**
   * The previous renderer called `substring(1)` on every line, which removed
   * the first character of context lines as well as markers. These two cases
   * are the regression guard for that bug.
   */
  it('preserves the full content of context lines', () => {
    const context = file?.hunks[0]?.lines.find((l) => l.type === 'context');
    expect(context?.content).toBe('  const total = a + b;');
  });

  it('preserves the full content of added lines', () => {
    const added = file?.hunks[0]?.lines.filter((l) => l.type === 'add');
    expect(added?.[0]?.content).toBe('  console.log(total);');
    expect(added?.[1]?.content).toBe('  return total * 1;');
  });

  it('numbers lines from the hunk header, not the array index', () => {
    const lines = file?.hunks[0]?.lines ?? [];
    // Hunk starts at old line 10 / new line 10.
    expect(lines[0]).toMatchObject({ type: 'context', oldLine: 10, newLine: 10 });
    // A removed line has no position in the new file, and vice versa.
    expect(lines[1]).toMatchObject({ type: 'del', oldLine: 11, newLine: null });
    expect(lines[2]).toMatchObject({ type: 'add', oldLine: null, newLine: 11 });
    expect(lines[3]).toMatchObject({ type: 'add', oldLine: null, newLine: 12 });
  });

  it('does not treat the diff header as content', () => {
    const contents = file?.hunks.flatMap((h) => h.lines.map((l) => l.content)) ?? [];
    expect(contents.some((c) => c.includes('diff --git'))).toBe(false);
    expect(contents.some((c) => c.startsWith('++ b/'))).toBe(false);
  });

  it('returns an empty array for an empty diff', () => {
    expect(parseDiff('')).toEqual([]);
  });

  it('flags binary files', () => {
    const binary = parseDiff(
      'diff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ\n',
    );
    expect(binary[0]?.isBinary).toBe(true);
  });

  it('detects added and deleted files', () => {
    const added = parseDiff('diff --git a/new.ts b/new.ts\nnew file mode 100644\n');
    expect(added[0]?.isNew).toBe(true);

    const removed = parseDiff('diff --git a/old.ts b/old.ts\ndeleted file mode 100644\n');
    expect(removed[0]?.isDeleted).toBe(true);
  });
});

describe('limitDiff', () => {
  it('keeps whole files rather than truncating mid-file', () => {
    const files = parseDiff(SAMPLE);
    const { text, includedFiles, omittedFiles } = limitDiff(files, 10_000);
    expect(includedFiles).toEqual(['src/calc.ts']);
    expect(omittedFiles).toEqual([]);
    expect(text).toContain('const total = a + b;');
  });

  it('omits files that do not fit and reports them', () => {
    const files = parseDiff(SAMPLE);
    const { includedFiles, omittedFiles } = limitDiff(files, 10);
    expect(includedFiles).toEqual([]);
    expect(omittedFiles).toEqual(['src/calc.ts']);
  });
});
