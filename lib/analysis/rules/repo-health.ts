import type { TreeNode } from '@/lib/types';
import type { Finding } from '../types';

/**
 * Repository-level checks derived from the file tree alone — no file contents
 * are fetched, so this rule costs nothing beyond the tree request the page has
 * already made.
 */

interface Check {
  ruleId: string;
  title: string;
  severity: Finding['severity'];
  category: Finding['category'];
  matches: (paths: string[]) => boolean;
  description: string;
  remediation: string;
}

const CHECKS: Check[] = [
  {
    ruleId: 'health/no-ci',
    title: 'No continuous integration configured',
    severity: 'MEDIUM',
    category: 'TESTING',
    matches: (paths) =>
      paths.some(
        (p) =>
          /^\.github\/workflows\/.+\.ya?ml$/i.test(p) ||
          /^\.(?:gitlab-ci|travis|circleci)/i.test(p) ||
          /^(?:Jenkinsfile|azure-pipelines\.ya?ml|\.drone\.yml)$/i.test(p),
      ),
    description:
      'No CI workflow was found, so nothing automatically builds or tests this project when changes are pushed. Breakages are only discovered manually.',
    remediation:
      'Add a workflow at .github/workflows/ci.yml that installs dependencies and runs the build, type check, lint, and tests on every push and pull request.',
  },
  {
    ruleId: 'health/no-tests',
    title: 'No test files found',
    severity: 'HIGH',
    category: 'TESTING',
    matches: (paths) =>
      paths.some(
        (p) =>
          /(?:^|\/)(?:__tests__|tests?|specs?|e2e|cypress)\//i.test(p) ||
          /\.(?:test|spec)\.[jt]sx?$/i.test(p) ||
          /_test\.(?:py|go|rb)$/i.test(p) ||
          /Test\.java$/.test(p),
      ),
    description:
      'No files matching common test naming conventions were found. Without tests, every change carries the risk of silently breaking existing behaviour.',
    remediation:
      'Add a test runner and cover the critical paths first — the code that would be most damaging to break.',
  },
  {
    ruleId: 'health/no-readme',
    title: 'No README',
    severity: 'MEDIUM',
    category: 'DOCUMENTATION',
    matches: (paths) => paths.some((p) => /^readme(?:\.(?:md|rst|txt|adoc))?$/i.test(p)),
    description:
      'There is no README at the repository root, so a newcomer has no way to learn what this project is or how to run it.',
    remediation:
      'Add a README covering what the project does, how to install it, and how to run it.',
  },
  {
    ruleId: 'health/no-license',
    title: 'No licence file',
    severity: 'LOW',
    category: 'DOCUMENTATION',
    matches: (paths) => paths.some((p) => /^licen[cs]e(?:\.(?:md|txt))?$/i.test(p)),
    description:
      'Without a licence, default copyright applies and nobody else may legally reuse this code, even though it is public.',
    remediation: 'Add a LICENSE file. MIT is the usual choice for a project meant to be reused.',
  },
  {
    ruleId: 'health/no-gitignore',
    title: 'No .gitignore',
    severity: 'MEDIUM',
    category: 'HYGIENE',
    matches: (paths) => paths.includes('.gitignore'),
    description:
      'Without a .gitignore, build output, dependency directories, and local environment files are all liable to be committed by accident.',
    remediation: 'Add a .gitignore covering at least node_modules, build output, and .env files.',
  },
];

/** Only meaningful when a package.json exists. */
const NODE_CHECKS: Check[] = [
  {
    ruleId: 'health/no-lockfile',
    title: 'No dependency lockfile committed',
    severity: 'MEDIUM',
    category: 'DEPENDENCY',
    matches: (paths) =>
      paths.some((p) =>
        /^(?:package-lock\.json|yarn\.lock|pnpm-lock\.ya?ml|bun\.lockb?)$/i.test(p),
      ),
    description:
      'This project has a package.json but no lockfile, so installs are not reproducible. Two people can end up with different dependency versions from the same commit.',
    remediation: 'Run an install and commit the resulting lockfile.',
  },
];

function flatten(nodes: TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    into.push(node.path);
    if (node.children) flatten(node.children, into);
  }
  return into;
}

export function repoHealthRules(tree: TreeNode[]): Finding[] {
  const paths = flatten(tree);
  const hasPackageJson = paths.includes('package.json');

  const applicable = hasPackageJson ? [...CHECKS, ...NODE_CHECKS] : CHECKS;

  // Each check describes the healthy state, so a finding is emitted when it
  // does *not* match.
  return applicable
    .filter((check) => !check.matches(paths))
    .map((check) => ({
      ruleId: check.ruleId,
      source: 'engine' as const,
      category: check.category,
      severity: check.severity,
      title: check.title,
      description: check.description,
      file: null,
      line: null,
      remediation: check.remediation,
      confidence: 1,
    }));
}

/** Locates the root package.json so the caller can fetch it for OSV scanning. */
export function findPackageJson(tree: TreeNode[]): string | null {
  return flatten(tree).find((p) => p === 'package.json') ?? null;
}
