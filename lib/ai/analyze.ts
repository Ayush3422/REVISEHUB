import 'server-only';
import { gemini, model, wrapGeminiError } from './client';
import type { DashboardData, PullRequest, RepoSummary } from '@/lib/types';

const SYSTEM_PROMPT = `You are a principal engineer assessing the health of a software project.

You are given real metrics from the GitHub API. Ground every claim in those
numbers and cite them inline. If a metric is empty or zero, say the data is not
available — never invent activity.

Structure the response as markdown with these sections:

## Summary
Two or three sentences on the project's overall state.

## What is going well
## Risks
## Recommendations
Concrete and actionable, most important first.

Be direct. A short, specific assessment beats a long, hedged one.`;

export interface AnalysisInput {
  repo: RepoSummary;
  dashboard: DashboardData;
  pulls: PullRequest[];
}

export async function analyzeProject({ repo, dashboard, pulls }: AnalysisInput): Promise<string> {
  const open = pulls.filter((p) => p.state === 'open');
  const merged = pulls.filter((p) => p.state === 'merged');

  const totalCommits = dashboard.contributors.reduce((s, c) => s + c.commits, 0);
  const topContributorShare =
    totalCommits > 0 && dashboard.contributors[0]
      ? Math.round((dashboard.contributors[0].commits / totalCommits) * 100)
      : 0;

  const facts = [
    `Repository: ${repo.fullName}`,
    `Primary language: ${repo.language ?? 'not detected'}`,
    `Stars: ${repo.stars}, forks: ${repo.forks}, open issues: ${repo.openIssues}`,
    `Last push: ${repo.pushedAt}`,
    '',
    `Contributors: ${dashboard.contributors.length}`,
    `Total commits across contributors: ${totalCommits}`,
    `Top contributor share of commits: ${topContributorShare}%`,
    `Top contributors: ${
      dashboard.contributors
        .slice(0, 5)
        .map((c) => `${c.name} (${c.commits} commits, +${c.additions}/-${c.deletions})`)
        .join('; ') || 'none reported'
    }`,
    '',
    `Pull requests sampled: ${pulls.length} (${open.length} open, ${merged.length} merged)`,
    `Recent pull request titles: ${
      pulls
        .slice(0, 8)
        .map((p) => p.title)
        .join(' | ') || 'none'
    }`,
    '',
    `Weekly code churn (last ${dashboard.codeChurn.length} weeks): ${JSON.stringify(dashboard.codeChurn.slice(-12))}`,
    `Weekly commit activity: ${JSON.stringify(dashboard.commitActivity.slice(-12))}`,
    `Weekly PR velocity: ${JSON.stringify(dashboard.prVelocity.slice(-12))}`,
    dashboard.statsPending
      ? 'NOTE: GitHub is still computing some statistics, so parts of this data may be incomplete.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await gemini().models.generateContent({
      model: model(),
      contents: `Assess this project.\n\n${facts}`,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.4 },
    });
    return response.text ?? 'No analysis was returned.';
  } catch (error) {
    wrapGeminiError(error, 'analyze');
  }
}
