import 'server-only';
import { gemini, model, wrapGeminiError } from './client';
import type { ChatMessage, RepoSummary, TreeNode } from '@/lib/types';

/** Keeps the flattened tree from dominating the prompt on large repositories. */
const MAX_TREE_ENTRIES = 600;
const MAX_README_CHARS = 12_000;

const SYSTEM_PROMPT = `You are an assistant answering questions about a specific GitHub repository.

You can see: the repository's metadata, its file and folder listing, and its
README. You CANNOT see the contents of any other file.

This limit matters. When a question needs code you have not been shown, say so
and name the specific files worth opening, rather than guessing at their
contents. A confident wrong answer about code you cannot see is the worst
possible response.

Be concise. Use markdown. Refer to files by their full path.`;

export interface ChatInput {
  repo: RepoSummary;
  tree: TreeNode[];
  readme: string | null;
  history: ChatMessage[];
  question: string;
}

export async function answerRepoQuestion({
  repo,
  tree,
  readme,
  history,
  question,
}: ChatInput): Promise<string> {
  const paths: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (paths.length >= MAX_TREE_ENTRIES) return;
      paths.push(node.type === 'folder' ? `${node.path}/` : node.path);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);

  const truncatedNote =
    paths.length >= MAX_TREE_ENTRIES ? '\n(listing truncated — the repository has more files)' : '';

  const context = [
    `Repository: ${repo.fullName}`,
    repo.description ? `Description: ${repo.description}` : '',
    `Primary language: ${repo.language ?? 'not detected'}`,
    `Default branch: ${repo.defaultBranch}`,
    '',
    'Files:',
    paths.join('\n') + truncatedNote,
    readme ? `\nREADME:\n${readme.slice(0, MAX_README_CHARS)}` : '\n(no README found)',
  ]
    .filter(Boolean)
    .join('\n');

  // Gemini requires alternating roles; the SDK uses "model" for assistant turns.
  const contents = [
    { role: 'user' as const, parts: [{ text: `Repository context:\n\n${context}` }] },
    {
      role: 'model' as const,
      parts: [{ text: 'Understood. I have the file listing and README for this repository.' }],
    },
    ...history.slice(-10).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: question }] },
  ];

  try {
    const response = await gemini().models.generateContent({
      model: model(),
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.3 },
    });
    return response.text ?? 'No response was returned.';
  } catch (error) {
    wrapGeminiError(error, 'chat');
  }
}
