/**
 * Shared types. This module is safe to import from Client Components — it
 * contains no secrets and no server-only imports.
 */

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface RepoSummary extends RepoRef {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  isPrivate: boolean;
  pushedAt: string;
  htmlUrl: string;
}

export type PullRequestState = 'open' | 'closed' | 'merged';

export interface PullRequest {
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  branch: string;
  baseBranch: string;
  /**
   * Head commit SHA. Required for reading the proposed files: a pull request
   * from a fork has a head branch that does not exist on the base repository,
   * but GitHub does serve its commits from the base repo by SHA.
   */
  headSha: string;
  state: PullRequestState;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  htmlUrl: string;
}

/** Only available from the single-PR endpoint, not the list endpoint. */
export interface PullRequestDetail extends PullRequest {
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  mergeable: boolean | null;
}

export interface ContributorStats {
  name: string;
  avatarUrl: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface WeeklyPoint {
  /** ISO date of the week start, used as the chart's category axis. */
  name: string;
  [key: string]: string | number;
}

export interface DashboardData {
  contributors: ContributorStats[];
  /** Weekly additions/deletions across the repository's history (trimmed). */
  codeChurn: WeeklyPoint[];
  /** Weekly opened vs merged pull request counts. */
  prVelocity: WeeklyPoint[];
  /** Weekly commit counts for the last year. */
  commitActivity: WeeklyPoint[];
  /**
   * True when GitHub is still computing its statistics cache. The caller should
   * tell the user to retry rather than render zeroes as though they were real.
   */
  statsPending: boolean;
}

export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  /** Byte size for files; undefined for folders. */
  size?: number;
  children?: TreeNode[];
}

export interface FileTree {
  nodes: TreeNode[];
  /** GitHub caps tree responses; if true, some entries are missing. */
  truncated: boolean;
}

export interface FileContent {
  path: string;
  text: string;
  size: number;
  /** True when the file was too large or not valid UTF-8 text to display. */
  isTruncated: boolean;
}

// --- AI review ---

export const SUGGESTION_CATEGORIES = [
  'BUG',
  'SECURITY',
  'STYLE',
  'DOCUMENTATION',
  'OPTIMIZATION',
  'COMPLEXITY',
  'TESTING',
] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type SuggestionSeverity = (typeof SUGGESTION_SEVERITIES)[number];

export interface CodeSuggestion {
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  /** Path of the file the suggestion applies to, as it appears in the diff. */
  file: string;
  /** Line number within the new version of the file, when determinable. */
  line: number | null;
  title: string;
  description: string;
  /** Replacement code, or an empty string when the fix is not a code change. */
  suggestedCode: string;
  /** Model's own confidence, 0-1. Used to sort and to de-emphasise guesses. */
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
