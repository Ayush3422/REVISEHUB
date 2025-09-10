import type { PullRequest, CodeDiff, DashboardData, TreeNode, ContributorStats } from '../types';
import { MOCK_CODE_DIFF_TEMPLATES } from '../constants';

// --- GitHub API Integration ---
const GITHUB_TOKEN = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GITHUB_TOKEN
    ? import.meta.env.VITE_GITHUB_TOKEN
    : undefined;

function getAuthHeaders() {
    return GITHUB_TOKEN
        ? { 'Authorization': `token ${GITHUB_TOKEN}` }
        : {};
}
const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([\w-]+\/[\w.-]+)/);
    if (!match) return null;
    const [owner, repo] = match[1].replace(/\.git$/, '').split('/');
    return { owner, repo };
};

// --- REAL API FUNCTIONS ---

export const getFileTree = async (repoUrl: string): Promise<TreeNode[]> => {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) throw new Error('Invalid GitHub URL');

    const { owner, repo } = repoInfo;

    // STEP 1: Fetch the repository's metadata to find its default branch
    const repoDetailsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: getAuthHeaders()
    });
    if (!repoDetailsResponse.ok) {
        throw new Error(`GitHub API Error: Could not fetch repo details. Status: ${repoDetailsResponse.status}`);
    }
    const repoDetails = await repoDetailsResponse.json();
    const defaultBranch = repoDetails.default_branch; // e.g., 'main', 'master', etc.

    // STEP 2: Use the correct default branch name to fetch the file tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
        headers: getAuthHeaders()
    });
    if (!treeResponse.ok) {
        throw new Error(`GitHub API Error: Could not fetch file tree. Status: ${treeResponse.status}`);
    }

    const { tree } = await treeResponse.json();

    const buildTree = (paths: { path: string; type: 'tree' | 'blob' }[]): TreeNode[] => {
        const root: TreeNode[] = [];
        const map: { [key: string]: TreeNode } = {};

        paths.forEach(item => {
            map[item.path] = {
                name: item.path.split('/').pop()!,
                type: item.type === 'tree' ? 'folder' : 'file',
                path: item.path,
                children: item.type === 'tree' ? [] : undefined,
            };
        });

        Object.values(map).forEach(node => {
            const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
            if (map[parentPath]) {
                map[parentPath].children!.push(node);
            } else {
                root.push(node);
            }
        });

        return root;
    };

    return buildTree(tree);
};

export const getFileContent = async (repoUrl: string, filePath: string): Promise<string> => {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) throw new Error('Invalid GitHub URL');

    const { owner, repo } = repoInfo;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`);
    if (!response.ok) throw new Error('Failed to fetch file content from GitHub API.');

    const data = await response.json();
    return atob(data.content);
};

// --- MOCK FUNCTIONS (Kept for other features) ---
// ... (the rest of the file remains the same)
export const getPullRequests = async (repoUrl: string): Promise<PullRequest[]> => {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) throw new Error('Invalid GitHub URL');
    const { owner, repo } = repoInfo;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch pull requests from GitHub API.');
    const data = await response.json();
    // For each PR, fetch additions/deletions (requires another API call per PR)
    const prs: PullRequest[] = await Promise.all(
        data.map(async (pr: any) => {
            let additions = 0;
            let deletions = 0;
            try {
                const prDetailsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
                    headers: getAuthHeaders()
                });
                if (prDetailsRes.ok) {
                    const prDetails = await prDetailsRes.json();
                    additions = prDetails.additions;
                    deletions = prDetails.deletions;
                }
            } catch (e) {
                // ignore
            }
            return {
                id: pr.number,
                title: pr.title,
                author: pr.user.login,
                authorAvatar: pr.user.avatar_url,
                branch: pr.head.ref,
                additions,
                deletions
            };
        })
    );
    return prs;
};

export const getPullRequestDiff = async (repoUrl: string, prNumber: number): Promise<CodeDiff> => {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) throw new Error('Invalid GitHub URL');
    const { owner, repo } = repoInfo;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: { 'Accept': 'application/vnd.github.v3.diff' }
    });
    if (!response.ok) throw new Error('Failed to fetch pull request diff from GitHub API.');
    const diffContent = await response.text();
    return { diff: diffContent };
};

export const getDashboardData = async (repoUrl: string): Promise<DashboardData> => {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) throw new Error('Invalid GitHub URL');
    const { owner, repo } = repoInfo;

    // Fetch up to 100 contributors
    const contributorsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, {
        headers: getAuthHeaders()
    });
    const contributorsData = contributorsRes.ok ? await contributorsRes.json() : [];

    // Fetch up to 250 commits (for recent weeks)
    const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=250`, {
        headers: getAuthHeaders()
    });
    const commitsData = commitsRes.ok ? await commitsRes.json() : [];

    // Fetch commit details for additions/deletions (rate-limited, so only for recent 250 commits)
    const commitStats: { [sha: string]: { author: string, date: string, additions: number, deletions: number } } = {};
    for (const commit of commitsData) {
        try {
            const commitDetailRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`,
                { headers: getAuthHeaders() });
            if (!commitDetailRes.ok) continue;
            const commitDetail = await commitDetailRes.json();
            commitStats[commit.sha] = {
                author: commitDetail.author ? commitDetail.author.login : (commitDetail.commit.author.name || 'unknown'),
                date: commitDetail.commit.author.date,
                additions: commitDetail.stats.additions,
                deletions: commitDetail.stats.deletions
            };
        } catch (e) {
            // skip failed commits
        }
    }

    // Aggregate contributor stats
    const contributorMap: { [name: string]: ContributorStats } = {};
    for (const c of contributorsData) {
        contributorMap[c.login] = {
            name: c.login,
            commits: c.contributions,
            additions: 0,
            deletions: 0
        };
    }
    for (const sha in commitStats) {
        const stat = commitStats[sha];
        if (!contributorMap[stat.author]) {
            contributorMap[stat.author] = {
                name: stat.author,
                commits: 0,
                additions: 0,
                deletions: 0
            };
        }
        contributorMap[stat.author].additions += stat.additions;
        contributorMap[stat.author].deletions += stat.deletions;
    }
    const contributors: ContributorStats[] = Object.values(contributorMap);

    // PR Velocity (last 4 weeks)
    const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`, {
        headers: getAuthHeaders()
    });
    const pullsData = pullsRes.ok ? await pullsRes.json() : [];

    const now = new Date();
    // Helper to ensure 4 weeks always present, even if no data
    function fillWeeks(dataArr, keyNames) {
        const filled = [];
        for (let i = 0; i < 4; i++) {
            const weekName = `Week ${i + 1}`;
            const found = dataArr.find((d) => d.name === weekName);
            if (found) {
                filled.push(found);
            } else {
                const empty = { name: weekName };
                for (const k of keyNames) empty[k] = 0;
                filled.push(empty);
            }
        }
        return filled;
    }

    // PR Velocity (last 4 weeks)
    let prVelocityRaw = [];
    for (let i = 0; i < 4; i++) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (7 * (3 - i)));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        const weekPRs = pullsData.filter((pr) => {
            const created = new Date(pr.created_at);
            return created >= weekStart && created < weekEnd;
        });
        const merged = weekPRs.filter((pr) => pr.merged_at && new Date(pr.merged_at) >= weekStart && new Date(pr.merged_at) < weekEnd);
        prVelocityRaw.push({
            name: `Week ${i + 1}`,
            opened: weekPRs.length,
            merged: merged.length
        });
    }
    const prVelocity = fillWeeks(prVelocityRaw, ['opened', 'merged']);

    // Code Churn (last 4 weeks, using commit stats)
    let codeChurnRaw = [];
    for (let i = 0; i < 4; i++) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (7 * (3 - i)));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        let additions = 0;
        let deletions = 0;
        for (const sha in commitStats) {
            const stat = commitStats[sha];
            const date = new Date(stat.date);
            if (date >= weekStart && date < weekEnd) {
                additions += stat.additions;
                deletions += stat.deletions;
            }
        }
        codeChurnRaw.push({
            name: `Week ${i + 1}`,
            additions,
            deletions
        });
    }
    const codeChurn = fillWeeks(codeChurnRaw, ['additions', 'deletions']);

    return { contributors, prVelocity, codeChurn };
};