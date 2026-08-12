import { parseRepoInput } from '@/lib/github/client';
import { getFileTree, getRepoSummary } from '@/lib/github/repo';
import { analyseRepository } from '@/lib/analysis/engine';
import { countBySeverity, type FindingSeverity } from '@/lib/analysis/types';
import { FindingCard } from '@/components/FindingCard';
import { EmptyState, ErrorPanel, Stat } from '@/components/ui/Panel';
import { ShieldIcon } from '@/components/icons/ShieldIcon';
import { toErrorResponse } from '@/lib/errors';

export const revalidate = 900;
export const metadata = { title: 'Security & health' };

const ORDER: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const ref = parseRepoInput(`${owner}/${repo}`);

  let result, tree;
  try {
    const summary = await getRepoSummary(ref);
    tree = await getFileTree(ref, summary.defaultBranch);
    result = await analyseRepository({
      ref,
      defaultBranch: summary.defaultBranch,
      tree: tree.nodes,
    });
  } catch (error) {
    const { message } = toErrorResponse(error);
    return <ErrorPanel title="Could not analyse this repository" message={message} />;
  }

  const counts = countBySeverity(result.findings);
  const vulnerabilities = result.findings.filter((f) => f.category === 'DEPENDENCY');
  const health = result.findings.filter((f) => f.category !== 'DEPENDENCY');

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white">Security &amp; health</h1>
        <p className="mt-1 text-text-secondary">
          Dependency vulnerabilities and repository checks for{' '}
          <span className="font-semibold text-primary">
            {owner}/{repo}
          </span>
          . These run entirely from deterministic rules — no AI, and no API key.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {ORDER.map((severity) => (
          <Stat
            key={severity}
            label={severity.toLowerCase()}
            value={counts[severity]}
            tone={
              counts[severity] === 0
                ? 'neutral'
                : severity === 'CRITICAL' || severity === 'HIGH'
                  ? 'negative'
                  : 'neutral'
            }
          />
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-white">
          Dependency vulnerabilities
          {vulnerabilities.length > 0 && (
            <span className="ml-2 text-base font-normal text-text-secondary">
              {vulnerabilities.length}
            </span>
          )}
        </h2>

        {vulnerabilities.length === 0 ? (
          <div className="rounded-xl border border-muted/50 bg-surface/50">
            <EmptyState
              icon={<ShieldIcon className="h-10 w-10" />}
              title={
                result.scannedFiles.length > 0
                  ? 'No known vulnerabilities'
                  : 'No npm manifest found'
              }
              message={
                result.scannedFiles.length > 0
                  ? 'None of the declared dependencies match a known advisory in the OSV database.'
                  : 'Dependency scanning currently supports npm. This repository has no package.json at its root.'
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {vulnerabilities.map((finding, i) => (
              <FindingCard key={`${finding.ruleId}-${i}`} finding={finding} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-white">
          Repository health
          {health.length > 0 && (
            <span className="ml-2 text-base font-normal text-text-secondary">{health.length}</span>
          )}
        </h2>

        {health.length === 0 ? (
          <div className="rounded-xl border border-muted/50 bg-surface/50">
            <EmptyState
              title="All health checks pass"
              message="This repository has CI, tests, a README, a licence, a .gitignore, and a committed lockfile."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {health.map((finding, i) => (
              <FindingCard key={`${finding.ruleId}-${i}`} finding={finding} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Dependency data from{' '}
        <a
          href="https://osv.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          OSV.dev
        </a>
        . Versions are read from package.json, so the version actually installed may differ from the
        one checked.
      </p>
    </div>
  );
}
