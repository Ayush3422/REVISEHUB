import { RepoInputForm } from '@/components/RepoInputForm';
import { LogoIcon } from '@/components/icons/LogoIcon';
import { CodeIcon } from '@/components/icons/CodeIcon';
import { DashboardIcon } from '@/components/icons/DashboardIcon';
import { LightbulbIcon } from '@/components/icons/LightbulbIcon';
import { FolderIcon } from '@/components/icons/FolderIcon';

const FEATURES = [
  {
    icon: CodeIcon,
    title: 'Pull request review',
    body: 'Line-anchored AI findings on any diff, ranked by severity.',
  },
  {
    icon: DashboardIcon,
    title: 'Project metrics',
    body: 'Contributors, churn, and velocity from the GitHub statistics API.',
  },
  {
    icon: LightbulbIcon,
    title: 'Health analysis',
    body: 'A written assessment grounded in the repository’s real numbers.',
  },
  {
    icon: FolderIcon,
    title: 'File explorer',
    body: 'Browse the tree and read any file without leaving the app.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-4">
          <LogoIcon className="h-14 w-14 text-primary" />
          <h1 className="text-5xl font-bold tracking-tight text-white">ReviseHub</h1>
        </div>
        <p className="mt-5 max-w-xl text-lg text-text-secondary">
          Point it at a public GitHub repository to get an AI code review, real project metrics, and
          a repository-aware assistant.
        </p>
      </div>

      <div className="w-full max-w-lg rounded-xl border border-muted/50 bg-surface/50 p-8 shadow-2xl backdrop-blur-sm">
        <RepoInputForm />
      </div>

      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-xl border border-muted/40 bg-surface/30 p-5">
            <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-text-primary">{title}</p>
            <p className="mt-1 text-sm text-text-secondary">{body}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">Powered by Google Gemini and the GitHub API.</p>
    </main>
  );
}
