/**
 * Minimal unified-diff parser. Shared by the server (to chunk a diff into
 * per-file units before review) and the client (to render it).
 *
 * The previous renderer called `line.substring(1)` on every line, which ate
 * the first character of context lines and of the `diff --git` header, and it
 * numbered lines by array index rather than by actual file position. Parsing
 * the hunk headers gives real line numbers on both sides.
 */

export type DiffLineType = 'add' | 'del' | 'context';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  /** Line number in the pre-image, or null for added lines. */
  oldLine: number | null;
  /** Line number in the post-image, or null for removed lines. */
  newLine: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

const FILE_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of diff.split('\n')) {
    const fileMatch = FILE_HEADER.exec(raw);
    if (fileMatch) {
      file = {
        oldPath: fileMatch[1] ?? '',
        newPath: fileMatch[2] ?? '',
        hunks: [],
        additions: 0,
        deletions: 0,
        isBinary: false,
        isNew: false,
        isDeleted: false,
        isRenamed: false,
      };
      files.push(file);
      hunk = null;
      continue;
    }

    if (!file) continue;

    if (raw.startsWith('new file mode')) {
      file.isNew = true;
      continue;
    }
    if (raw.startsWith('deleted file mode')) {
      file.isDeleted = true;
      continue;
    }
    if (raw.startsWith('rename from') || raw.startsWith('rename to')) {
      file.isRenamed = true;
      continue;
    }
    if (raw.startsWith('Binary files ') || raw.startsWith('GIT binary patch')) {
      file.isBinary = true;
      continue;
    }

    const hunkMatch = HUNK_HEADER.exec(raw);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      hunk = { header: raw, lines: [] };
      file.hunks.push(hunk);
      continue;
    }

    // Everything before the first hunk (index/---/+++ lines) is metadata.
    if (!hunk) continue;

    // "\ No newline at end of file" is a marker, not content.
    if (raw.startsWith('\\')) continue;

    const marker = raw[0];
    const content = raw.slice(1);

    if (marker === '+') {
      hunk.lines.push({ type: 'add', content, oldLine: null, newLine });
      file.additions += 1;
      newLine += 1;
    } else if (marker === '-') {
      hunk.lines.push({ type: 'del', content, oldLine, newLine: null });
      file.deletions += 1;
      oldLine += 1;
    } else if (marker === ' ' || raw === '') {
      hunk.lines.push({ type: 'context', content, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  return files;
}

/** Renders one file's hunks back to unified-diff text, for prompting. */
export function stringifyFile(file: DiffFile): string {
  const head = `--- a/${file.oldPath}\n+++ b/${file.newPath}`;
  const body = file.hunks
    .map((h) => {
      const lines = h.lines.map((l) => {
        const marker = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
        return `${marker}${l.content}`;
      });
      return [h.header, ...lines].join('\n');
    })
    .join('\n');
  return `${head}\n${body}`;
}

/**
 * Trims a diff to fit a prompt. Whole files are kept or dropped so the model
 * never sees a syntactically broken fragment, and the caller is told what was
 * left out so it can say so in the UI.
 */
export function limitDiff(
  files: DiffFile[],
  maxChars: number,
): { text: string; includedFiles: string[]; omittedFiles: string[] } {
  const included: string[] = [];
  const omitted: string[] = [];
  const parts: string[] = [];
  let used = 0;

  // Review the smallest files first so a single huge file cannot crowd out
  // everything else in the pull request.
  const ordered = [...files].sort(
    (a, b) => a.additions + a.deletions - (b.additions + b.deletions),
  );

  for (const file of ordered) {
    if (file.isBinary || file.hunks.length === 0) {
      omitted.push(file.newPath);
      continue;
    }
    const text = stringifyFile(file);
    if (used + text.length > maxChars) {
      omitted.push(file.newPath);
      continue;
    }
    parts.push(text);
    included.push(file.newPath);
    used += text.length;
  }

  return { text: parts.join('\n\n'), includedFiles: included, omittedFiles: omitted };
}
