import { parseRepoInput } from '@/lib/github/client';
import { getDashboardData, getRepoSummary } from '@/lib/github/repo';
import {
  ChurnChart,
  CommitActivityChart,
  ContributorChart,
  ContributorTable,
  VelocityChart,
} from '@/components/DashboardCharts';
import { ErrorPanel, Panel, Stat } from '@/components/ui/Panel';
import { toErrorResponse } from '@/lib/errors';

export const revalidate = 900;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const ref = parseRepoInput(`${owner}/${repo}`);

  let summary, data;
  try {
    [summary, data] = await Promise.all([getRepoSummary(ref), getDashboardData(ref)]);
  } catch (error) {
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not load dashboard data" message={message} />;
  }

  const totalCommits = data.contributors.reduce((s, c) => s + c.commits, 0);
  const totalAdditions = data.contributors.reduce((s, c) => s + c.additions, 0);
  const totalDeletions = data.contributors.reduce((s, c) => s + c.deletions, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-text-secondary">
          Metrics for <span className="font-semibold text-primary">{summary.fullName}</span>, from
          the GitHub statistics API.
        </p>
      </header>

      {/*
        GitHub computes the /stats endpoints asynchronously and returns 202 with
        an empty body until its cache is warm. Saying so is the honest response;
        rendering zeroes as though they were measurements is not.
      */}
      {data.statsPending && (
        <div
          role="status"
          className="rounded-xl border border-yellow-500/40 bg-yellow-950/30 px-5 py-4 text-sm text-yellow-200"
        >
          <p className="font-semibold">GitHub is still computing statistics for this repository.</p>
          <p className="mt-1 text-yellow-200/80">
            This happens the first time a repository is requested. Reload in a few seconds — the
            figures below may be incomplete until then.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Contributors" value={data.contributors.length} />
        <Stat label="Commits" value={totalCommits.toLocaleString()} />
        <Stat label="Lines added" value={`+${totalAdditions.toLocaleString()}`} tone="positive" />
        <Stat label="Lines removed" value={`−${totalDeletions.toLocaleString()}`} tone="negative" />
        <Stat label="Open issues" value={summary.openIssues.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Commit activity" subtitle="Commits per week over the last year">
          <CommitActivityChart data={data.commitActivity} />
        </Panel>

        <Panel title="Code churn" subtitle="Lines added above the line, removed below">
          <ChurnChart data={data.codeChurn} />
        </Panel>

        <Panel title="Pull request velocity" subtitle="Opened versus merged, per week">
          <VelocityChart data={data.prVelocity} />
        </Panel>

        <Panel title="Top contributors" subtitle="By commit count">
          <ContributorChart data={data.contributors} />
        </Panel>
      </div>

      <ContributorTable data={data.contributors} />
    </div>
  );
}
