import 'server-only';
import { parseDiff, type DiffFile } from '@/lib/diff';
import { getFileContent, getFileTree } from '@/lib/github/repo';
import type { RepoRef, TreeNode } from '@/lib/types';
import { sortFindings, type AnalysisResult, type Finding } from './types';
import { secretRules } from './rules/secrets';
import { hygieneRules } from './rules/hygiene';
import { complexityRules, supportsComplexity, type SourceFileInput } from './rules/complexity';
import { dependencyRules } from './rules/dependencies';
import { findPackageJson, repoHealthRules } from './rules/repo-health';

/**
 * Runs the deterministic rules and collects their findings.
 *
 * No API key is involved anywhere in this file. Every rule either works on
 * data already fetched from GitHub or calls a public, unauthenticated service.
 *
 * A rule that throws is recorded in `failedRules` rather than taking down the
 * whole analysis — one broken rule should cost one rule's worth of coverage.
 */

/** AST analysis needs whole files, so this bounds the extra GitHub requests. */
const MAX_AST_FILES = 12;
const MAX_AST_BYTES = 400_000;

async function runRule(
  name: string,
  failed: string[],
  fn: () => Finding[] | Promise<Finding[]>,
): Promise<Finding[]> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[engine] rule "${name}" failed`, error);
    failed.push(name);
    return [];
  }
}

/** Line numbers touched in the post-image, used to scope complexity findings. */
function changedLines(files: DiffFile[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const file of files) {
    const lines = new Set<number>();
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add' && line.newLine !== null) lines.add(line.newLine);
      }
    }
    if (lines.size > 0) map.set(file.newPath, lines);
  }
  return map;
}

export interface PullRequestAnalysisInput {
  ref: RepoRef;
  diff: string;
  /** Head ref of the pull request, so AST analysis reads the proposed code. */
  headRef: string;
}

export async function analysePullRequest({
  ref,
  diff,
  headRef,
}: PullRequestAnalysisInput): Promise<AnalysisResult> {
  const started = Date.now();
  const failedRules: string[] = [];
  const skipped: { file: string; reason: string }[] = [];

  const files = parseDiff(diff);

  const findings: Finding[] = [
    ...(await runRule('secrets', failedRules, () => secretRules(files))),
    ...(await runRule('hygiene', failedRules, () => hygieneRules(files))),
  ];

  // --- Fetch changed source files for AST analysis ---
  const astCandidates = files.filter(
    (f) => !f.isBinary && !f.isDeleted && supportsComplexity(f.newPath),
  );

  const sources: SourceFileInput[] = [];
  let budget = MAX_AST_BYTES;

  for (const file of astCandidates.slice(0, MAX_AST_FILES)) {
    if (budget <= 0) {
      skipped.push({ file: file.newPath, reason: 'AST size budget exhausted' });
      continue;
    }
    try {
      const content = await getFileContent(ref, file.newPath, headRef);
      if (content.isTruncated) {
        skipped.push({ file: file.newPath, reason: 'file too large or binary' });
        continue;
      }
      budget -= content.text.length;
      sources.push({ path: file.newPath, text: content.text });
    } catch {
      // Commonly a file added on a fork branch we cannot read. Not a finding.
      skipped.push({ file: file.newPath, reason: 'could not read file contents' });
    }
  }

  for (const file of astCandidates.slice(MAX_AST_FILES)) {
    skipped.push({ file: file.newPath, reason: `beyond the ${MAX_AST_FILES}-file AST limit` });
  }

  findings.push(
    ...(await runRule('complexity', failedRules, () =>
      complexityRules(sources, changedLines(files)),
    )),
  );

  // --- Dependency scan, only when the manifest itself changed ---
  const manifestChanged = files.some((f) => f.newPath === 'package.json' && !f.isDeleted);
  if (manifestChanged) {
    findings.push(
      ...(await runRule('dependencies', failedRules, async () => {
        const manifest = await getFileContent(ref, 'package.json', headRef);
        return manifest.isTruncated ? [] : dependencyRules(manifest.text);
      })),
    );
  }

  return {
    findings: sortFindings(findings),
    scannedFiles: files.map((f) => f.newPath),
    skipped,
    failedRules,
    durationMs: Date.now() - started,
  };
}

export interface RepositoryAnalysisInput {
  ref: RepoRef;
  defaultBranch: string;
  /** Reuses the tree the page already fetched, when it has one. */
  tree?: TreeNode[];
}

export async function analyseRepository({
  ref,
  defaultBranch,
  tree,
}: RepositoryAnalysisInput): Promise<AnalysisResult> {
  const started = Date.now();
  const failedRules: string[] = [];

  const nodes = tree ?? (await getFileTree(ref, defaultBranch)).nodes;

  const findings: Finding[] = [
    ...(await runRule('repo-health', failedRules, () => repoHealthRules(nodes))),
  ];

  const manifestPath = findPackageJson(nodes);
  if (manifestPath) {
    findings.push(
      ...(await runRule('dependencies', failedRules, async () => {
        const manifest = await getFileContent(ref, manifestPath, defaultBranch);
        return manifest.isTruncated ? [] : dependencyRules(manifest.text);
      })),
    );
  }

  return {
    findings: sortFindings(findings),
    scannedFiles: manifestPath ? [manifestPath] : [],
    skipped: manifestPath
      ? []
      : [{ file: 'package.json', reason: 'no npm manifest found at the repository root' }],
    failedRules,
    durationMs: Date.now() - started,
  };
}
