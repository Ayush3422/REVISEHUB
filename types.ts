
export interface Repo {
  url: string;
  name: string;
}

export interface PullRequest {
  id: number;
  title: string;
  author: string;
  authorAvatar: string;
  branch: string;
  additions: number;
  deletions: number;
}

export interface CodeDiff {
  diff: string;
}

export enum SuggestionCategory {
  BUG = 'BUG',
  STYLE = 'STYLE',
  DOCUMENTATION = 'DOCUMENTATION',
  OPTIMIZATION = 'OPTIMIZATION',
  COMPLEXITY = 'COMPLEXITY',
}

export enum SuggestionSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface CodeSuggestion {
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  description: string;
  suggestion: string;
}

export interface Comment {
    id: number;
    author: string;
    text: string;
}

export interface ContributorStats {
    name: string;
    commits: number;
    additions: number;
    deletions: number;
}

export interface TimeDataPoint {
    name: string;
    [key: string]: string | number;
}

export interface DashboardData {
    contributors: ContributorStats[];
    prVelocity: TimeDataPoint[];
    codeChurn: TimeDataPoint[];
}

export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeNode[];
}
