
import type { PullRequest, CodeDiff, DashboardData, TreeNode } from '../types';
import { MOCK_CODE_DIFF_TEMPLATES } from '../constants';

// Mock function to simulate fetching pull requests
export const getPullRequests = async (repoUrl: string): Promise<PullRequest[]> => {
  console.log(`Fetching PRs for ${repoUrl}`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return [
    {
      id: 101,
      title: 'feat: Add user authentication service',
      author: 'alice',
      authorAvatar: 'https://i.pravatar.cc/40?u=alice',
      branch: 'feature/auth',
      additions: 250,
      deletions: 45,
    },
    {
      id: 102,
      title: 'fix: Correct calculation in payment module',
      author: 'bob',
      authorAvatar: 'https://i.pravatar.cc/40?u=bob',
      branch: 'bugfix/payment-calc',
      additions: 15,
      deletions: 10,
    },
    {
      id: 103,
      title: 'refactor: Simplify component rendering logic',
      author: 'charlie',
      authorAvatar: 'https://i.pravatar.cc/40?u=charlie',
      branch: 'refactor/ui-components',
      additions: 80,
      deletions: 120,
    },
  ];
};

// Mock function to simulate fetching a pull request diff
export const getPullRequestDiff = async (prId: number, prTitle: string): Promise<CodeDiff> => {
    console.log(`Fetching diff for PR #${prId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let diffContent = MOCK_CODE_DIFF_TEMPLATES.feat;
    if (prTitle.toLowerCase().includes('fix')) {
        diffContent = MOCK_CODE_DIFF_TEMPLATES.fix;
    } else if (prTitle.toLowerCase().includes('refactor')) {
        diffContent = MOCK_CODE_DIFF_TEMPLATES.refactor;
    }

    return {
        diff: diffContent,
    };
};

// Mock function to simulate fetching dashboard data
export const getDashboardData = async (repoUrl: string): Promise<DashboardData> => {
    console.log(`Fetching dashboard data for ${repoUrl}`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
        contributors: [
            { name: 'alice', commits: 58, additions: 2400, deletions: 800 },
            { name: 'bob', commits: 42, additions: 1500, deletions: 500 },
            { name: 'charlie', commits: 35, additions: 1800, deletions: 1200 },
            { name: 'diana', commits: 21, additions: 600, deletions: 150 },
        ],
        prVelocity: [
            { name: 'Week 1', opened: 10, merged: 8 },
            { name: 'Week 2', opened: 12, merged: 9 },
            { name: 'Week 3', opened: 8, merged: 7 },
            { name: 'Week 4', opened: 15, merged: 11 },
        ],
        codeChurn: [
            { name: 'Week 1', additions: 1200, deletions: 400 },
            { name: 'Week 2', additions: 1500, deletions: 600 },
            { name: 'Week 3', additions: 900, deletions: 300 },
            { name: 'Week 4', additions: 1800, deletions: 750 },
        ]
    };
};

// Mock function to fetch file tree
export const getFileTree = async (repoUrl: string): Promise<TreeNode[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [
    { name: 'src', type: 'folder', path: 'src', children: [
      { name: 'components', type: 'folder', path: 'src/components', children: [
        { name: 'Button.tsx', type: 'file', path: 'src/components/Button.tsx' },
        { name: 'Input.tsx', type: 'file', path: 'src/components/Input.tsx' },
      ]},
      { name: 'services', type: 'folder', path: 'src/services', children: [
        { name: 'api.ts', type: 'file', path: 'src/services/api.ts' },
      ]},
      { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
      { name: 'index.tsx', type: 'file', path: 'src/index.tsx' },
    ]},
    { name: 'package.json', type: 'file', path: 'package.json' },
    { name: 'README.md', type: 'file', path: 'README.md' },
  ];
}

// Mock function to fetch file content
export const getFileContent = async (repoUrl: string, filePath: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return `// Content for ${filePath} in ${repoUrl}
  
export const HelloWorld = () => {
  return <div>Hello, World!</div>;
};
`;
}
