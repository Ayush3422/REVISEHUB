import { redirect } from 'next/navigation';

export default async function RepoIndexPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  redirect(`/r/${owner}/${repo}/pulls`);
}
