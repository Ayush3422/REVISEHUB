import { AnalysisPanel } from '@/components/AnalysisPanel';

export const metadata = { title: 'AI analysis' };

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Project health analysis</h1>
        <p className="mt-1 text-text-secondary">
          A written assessment of{' '}
          <span className="font-semibold text-neon-violet">
            {owner}/{repo}
          </span>
          , grounded in its contributor, churn, and pull request metrics.
        </p>
      </header>

      <AnalysisPanel owner={owner} repo={repo} />
    </div>
  );
}
