import 'server-only';
import { ghJson, ghJsonOrNull, ghStats, ghText } from './client';
import { NotFoundError } from '@/lib/errors';
import type {
  ContributorStats,
  DashboardData,
  FileContent,
  FileTree,
  PullRequest,
  PullRequestDetail,
  RepoRef,
  RepoSummary,
  TreeNode,
  WeeklyPoint,
} from '@/lib/types';

/** GitHub's Contents API refuses to inline anything above 1 MB. */
const MAX_INLINE_FILE_BYTES = 1_000_000;
/** Enough history to show a trend without making the charts unreadable. */
const CHART_WEEKS = 26;

// --- Repository metadata ---

interface RawRepo {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  private: boolean;
  pushed_at: string;
  html_url: string;
}

export async function getRepoSummary({ owner, repo }: RepoRef): Promise<RepoSummary> {
  const raw = await ghJson<RawRepo>(`/repos/${owner}/${repo}`, { revalidate: 600 });
  return {
    owner,
    repo,
    fullName: raw.full_name,
    description: raw.description,
    defaultBranch: raw.default_branch,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    language: raw.language,
    isPrivate: raw.private,
    pushedAt: raw.pushed_at,
    htmlUrl: raw.html_url,
  };
}

// --- File tree ---

interface RawTreeEntry {
  path: string;
  type: 'tree' | 'blob' | 'commit';
  size?: number;
}

export async function getFileTree(ref: RepoRef, defaultBranch?: string): Promise<FileTree> {
  const branch = defaultBranch ?? (await getRepoSummary(ref)).defaultBranch;
  const { owner, repo } = ref;

  const data = await ghJson<{ tree: RawTreeEntry[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { revalidate: 600 },
  );

  return { nodes: buildTree(data.tree), truncated: Boolean(data.truncated) };
}

function buildTree(entries: RawTreeEntry[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Submodules come back as type `commit` and have no browsable contents.
  const usable = entries.filter((e) => e.type === 'tree' || e.type === 'blob');

  for (const entry of usable) {
    const name = entry.path.split('/').pop();
    if (!name) continue;
    map.set(entry.path, {
      name,
      path: entry.path,
      type: entry.type === 'tree' ? 'folder' : 'file',
      ...(entry.size !== undefined ? { size: entry.size } : {}),
      ...(entry.type === 'tree' ? { children: [] } : {}),
    });
  }

  for (const node of map.values()) {
    const slash = node.path.lastIndexOf('/');
    const parent = slash === -1 ? null : map.get(node.path.slice(0, slash));
    if (parent?.children) parent.children.push(node);
    else roots.push(node);
  }

  // Folders before files, alphabetical within each group — matching how GitHub
  // itself renders a tree. The previous version left API ordering untouched.
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.children) sort(n.children);
    return nodes;
  };

  return sort(roots);
}

// --- File contents ---

interface RawContent {
  content?: string;
  encoding?: string;
  size: number;
  type: string;
}

export async function getFileContent(ref: RepoRef, path: string): Promise<FileContent> {
  const { owner, repo } = ref;
  const encoded = path.split('/').map(encodeURIComponent).join('/');

  const raw = await ghJsonOrNull<RawContent>(`/repos/${owner}/${repo}/contents/${encoded}`, {
    revalidate: 600,
  });

  if (!raw) throw new NotFoundError(`File not found: ${path}`);
  if (raw.type !== 'file') throw new NotFoundError(`${path} is not a file.`);

  if (raw.size > MAX_INLINE_FILE_BYTES || raw.encoding === 'none' || !raw.content) {
    return {
      path,
      text: `This file is ${formatBytes(raw.size)}, which is above GitHub's 1 MB inline limit. Open it on GitHub to view the full contents.`,
      size: raw.size,
      isTruncated: true,
    };
  }

  // `atob` — used by the previous implementation — decodes base64 to Latin-1
  // and mangles every multi-byte UTF-8 character. Buffer decodes correctly.
  const buffer = Buffer.from(raw.content, 'base64');

  // A NUL byte in the first block is a reliable, cheap binary heuristic.
  if (buffer.subarray(0, 8000).includes(0)) {
    return {
      path,
      text: `${path} appears to be a binary file and cannot be displayed as text.`,
      size: raw.size,
      isTruncated: true,
    };
  }

  return { path, text: buffer.toString('utf8'), size: raw.size, isTruncated: false };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Pull requests ---

interface RawPull {
  number: number;
  title: string;
  body: string | null;
  user: { login: string; avatar_url: string } | null;
  head: { ref: string };
  base: { ref: string };
  state: 'open' | 'closed';
  draft?: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  comments?: number;
  html_url: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  mergeable?: boolean | null;
}

function mapPull(raw: RawPull): PullRequest {
  return {
    number: raw.number,
    title: raw.title,
    author: raw.user?.login ?? 'ghost',
    authorAvatar: raw.user?.avatar_url ?? '',
    branch: raw.head.ref,
    baseBranch: raw.base.ref,
    state: raw.merged_at ? 'merged' : raw.state,
    isDraft: Boolean(raw.draft),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    commentCount: raw.comments ?? 0,
    htmlUrl: raw.html_url,
  };
}

/**
 * One request. The previous implementation fetched the list and then issued a
 * detail request per pull request purely to display additions/deletions —
 * about 101 calls to render one page. Those counts are only available from the
 * detail endpoint, so they are shown on the detail page instead, where the
 * request has to happen anyway.
 */
export async function getPullRequests(ref: RepoRef, limit = 50): Promise<PullRequest[]> {
  const { owner, repo } = ref;
  const raw = await ghJson<RawPull[]>(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`,
    { revalidate: 120 },
  );
  return raw.map(mapPull);
}

export async function getPullRequest(ref: RepoRef, number: number): Promise<PullRequestDetail> {
  const { owner, repo } = ref;
  const raw = await ghJsonOrNull<RawPull>(`/repos/${owner}/${repo}/pulls/${number}`, {
    revalidate: 120,
  });
  if (!raw) throw new NotFoundError(`Pull request #${number} not found in ${owner}/${repo}.`);

  return {
    ...mapPull(raw),
    body: raw.body,
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changedFiles: raw.changed_files ?? 0,
    commits: raw.commits ?? 0,
    mergeable: raw.mergeable ?? null,
  };
}

export async function getPullRequestDiff(ref: RepoRef, number: number): Promise<string> {
  const { owner, repo } = ref;
  return ghText(`/repos/${owner}/${repo}/pulls/${number}`, {
    accept: 'application/vnd.github.v3.diff',
    revalidate: 300,
  });
}

// --- Dashboard ---

interface RawContributorStat {
  author: { login: string; avatar_url: string } | null;
  total: number;
  weeks: { w: number; a: number; d: number; c: number }[];
}

/** `[unixWeekStart, additions, deletions]`, where deletions are negative. */
type RawCodeFrequency = [number, number, number][];

interface RawCommitActivity {
  week: number;
  total: number;
}

function weekLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Built entirely from GitHub's precomputed `/stats/*` endpoints: three requests
 * total, regardless of repository size. The previous implementation walked 250
 * commits with one sequential request each, which exhausted the rate limit on
 * any real repository and took minutes to fail.
 */
export async function getDashboardData(ref: RepoRef): Promise<DashboardData> {
  const { owner, repo } = ref;

  const [contributorStats, codeFrequency, commitActivity, pulls] = await Promise.all([
    ghStats<RawContributorStat[]>(`/repos/${owner}/${repo}/stats/contributors`),
    ghStats<RawCodeFrequency>(`/repos/${owner}/${repo}/stats/code_frequency`),
    ghStats<RawCommitActivity[]>(`/repos/${owner}/${repo}/stats/commit_activity`),
    getPullRequests(ref, 100),
  ]);

  const statsPending =
    contributorStats === null || codeFrequency === null || commitActivity === null;

  const contributors: ContributorStats[] = (contributorStats ?? [])
    .filter((c) => c.author)
    .map((c) => ({
      name: c.author!.login,
      // The real avatar, which the API already returned. The previous version
      // discarded it and rendered a random face from an unrelated service.
      avatarUrl: c.author!.avatar_url,
      commits: c.total,
      additions: c.weeks.reduce((sum, w) => sum + w.a, 0),
      deletions: c.weeks.reduce((sum, w) => sum + w.d, 0),
    }))
    .sort((a, b) => b.commits - a.commits);

  const codeChurn: WeeklyPoint[] = (codeFrequency ?? []).slice(-CHART_WEEKS).map(([w, a, d]) => ({
    name: weekLabel(w),
    additions: a,
    deletions: Math.abs(d),
  }));

  const commitActivityPoints: WeeklyPoint[] = (commitActivity ?? [])
    .slice(-CHART_WEEKS)
    .map((entry) => ({ name: weekLabel(entry.week), commits: entry.total }));

  return {
    contributors,
    codeChurn,
    commitActivity: commitActivityPoints,
    prVelocity: buildPrVelocity(pulls),
    statsPending,
  };
}

/** Buckets pull requests into the trailing `CHART_WEEKS` Sunday-aligned weeks. */
function buildPrVelocity(pulls: PullRequest[]): WeeklyPoint[] {
  const startOfWeek = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return Math.floor(d.getTime() / 1000);
  };

  const buckets = new Map<number, { opened: number; merged: number }>();
  const thisWeek = startOfWeek(new Date());

  for (let i = CHART_WEEKS - 1; i >= 0; i--) {
    buckets.set(thisWeek - i * 604800, { opened: 0, merged: 0 });
  }

  for (const pr of pulls) {
    const opened = startOfWeek(new Date(pr.createdAt));
    const openedBucket = buckets.get(opened);
    if (openedBucket) openedBucket.opened += 1;

    if (pr.state === 'merged') {
      const merged = startOfWeek(new Date(pr.updatedAt));
      const mergedBucket = buckets.get(merged);
      if (mergedBucket) mergedBucket.merged += 1;
    }
  }

  return [...buckets.entries()].map(([week, counts]) => ({
    name: weekLabel(week),
    opened: counts.opened,
    merged: counts.merged,
  }));
}
