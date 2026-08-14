import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ChatWidget } from '@/components/ChatWidget';
import { CommandPalette } from '@/components/CommandPalette';
import { parseRepoInput } from '@/lib/github/client';
import { getRepoSummary } from '@/lib/github/repo';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { serverKeyConfigured } from '@/lib/ai/provider';

interface Params {
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${owner}/${repo}` };
}

export default async function RepoLayout({
  children,
  params,
}: Params & { children: React.ReactNode }) {
  const { owner, repo } = await params;

  // Validate the slug and confirm the repository exists before rendering the
  // shell, so a bad URL gives a 404 page rather than four broken panels.
  try {
    const ref = parseRepoInput(`${owner}/${repo}`);
    await getRepoSummary(ref);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar owner={owner} repo={repo} serverKeyConfigured={serverKeyConfigured()} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
      <ChatWidget owner={owner} repo={repo} />
      <CommandPalette owner={owner} repo={repo} />
    </div>
  );
}
