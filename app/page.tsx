import { RepoInputForm } from '@/components/RepoInputForm';
import { LogoIcon } from '@/components/icons/LogoIcon';
import { ShieldIcon } from '@/components/icons/ShieldIcon';
import { ZapIcon } from '@/components/icons/ZapIcon';
import { DashboardIcon } from '@/components/icons/DashboardIcon';
import { SparklesIcon } from '@/components/icons/SparklesIcon';

const FEATURES = [
  {
    icon: ShieldIcon,
    accent: 'text-neon-cyan',
    glow: 'group-hover:shadow-[0_0_28px_rgba(34,211,238,0.25)]',
    title: 'Security',
    body: 'Leaked credentials in a diff and known CVEs in your dependencies, from the OSV database.',
    free: true,
  },
  {
    icon: ZapIcon,
    accent: 'text-neon-lime',
    glow: 'group-hover:shadow-[0_0_28px_rgba(163,230,53,0.22)]',
    title: 'Efficiency',
    body: 'Quadratic loops, linear scans, sequential awaits — graded A to F, with an optional AI rewrite.',
    free: true,
  },
  {
    icon: DashboardIcon,
    accent: 'text-neon-violet',
    glow: 'group-hover:shadow-[0_0_28px_rgba(167,139,250,0.25)]',
    title: 'Metrics',
    body: 'Contributors, code churn and pull request velocity, straight from the GitHub statistics API.',
    free: true,
  },
  {
    icon: SparklesIcon,
    accent: 'text-neon-pink',
    glow: 'group-hover:shadow-[0_0_28px_rgba(244,114,182,0.25)]',
    title: 'AI review',
    body: 'Logic errors and edge cases that no static rule can express. Optional, and it degrades gracefully.',
    free: false,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-14 px-6 py-20">
      <header className="animate-fade-in flex flex-col items-center text-center">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-lime opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-lime" />
          </span>
          Works with no API key
        </span>

        <div className="flex items-center gap-4">
          <span className="relative">
            <LogoIcon className="h-14 w-14 text-neon-violet" />
            <span
              aria-hidden="true"
              className="animate-pulse-glow absolute inset-0 -z-10 rounded-full bg-neon-violet/50 blur-2xl"
            />
          </span>
          <h1 className="bg-gradient-to-br from-white via-white to-neon-violet/70 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
            ReviseHub
          </h1>
        </div>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Point it at any public GitHub repository. It finds leaked secrets, vulnerable
          dependencies, and slow code — deterministically, before any AI is involved.
        </p>
      </header>

      <div className="animate-fade-in-up glass w-full max-w-xl rounded-3xl p-8 [animation-delay:120ms]">
        <RepoInputForm />
      </div>

      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, accent, glow, title, body, free }, i) => (
          <li
            key={title}
            className={`glass-card press animate-fade-in-up group rounded-2xl p-5 hover:border-white/15 ${glow}`}
            style={{ animationDelay: `${180 + i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <Icon
                className={`h-6 w-6 ${accent} transition-transform duration-300 group-hover:scale-110`}
                aria-hidden="true"
              />
              {free && (
                <span className="rounded-full border border-neon-lime/25 bg-neon-lime/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-neon-lime">
                  No key
                </span>
              )}
            </div>
            <p className="mt-4 font-semibold text-text-primary">{title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{body}</p>
          </li>
        ))}
      </ul>

      <footer className="flex flex-col items-center gap-2 text-xs text-muted">
        <div className="rule-glow w-40" />
        <p>Public repositories · GitHub API · OSV.dev · Google Gemini (optional)</p>
      </footer>
    </main>
  );
}
