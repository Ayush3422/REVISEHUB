import 'server-only';
import { resolveProvider, wrapProviderError } from './provider';
import type { ChatMessage, RepoSummary, TreeNode } from '@/lib/types';

/** Keeps the flattened tree from dominating the prompt on large repositories. */
const MAX_TREE_ENTRIES = 600;
const MAX_README_CHARS = 12_000;
/** Per-file cap for attached sources, so one large file cannot crowd out the rest. */
const MAX_FILE_CHARS = 24_000;

export interface AttachedFile {
  path: string;
  text: string;
  truncated: boolean;
}

/**
 * The system prompt changes shape depending on whether the user attached files.
 *
 * Without attachments the assistant can only see paths and the README, and
 * saying so is the honest answer — a confident guess about unseen code is the
 * worst possible response. With attachments it has the real source, so hedging
 * would be equally wrong.
 */
function systemPrompt(hasFiles: boolean): string {
  const base = `You are an assistant answering questions about a specific GitHub repository.

Be concise and concrete. Use markdown. Refer to files by their full path, and
quote the relevant lines when you cite code.`;

  return hasFiles
    ? `${base}

The user has attached the full contents of specific files, given below. For
anything those files cover, answer directly from them — do not hedge about code
you can actually see.

For anything they do NOT cover, you still only have the file listing and the
README. Say so plainly and name the files worth attaching next, rather than
guessing.`
    : `${base}

You can see: the repository's metadata, its file and folder listing, and its
README. You CANNOT see the contents of any other file.

This limit matters. When a question needs code you have not been shown, say so
and name the specific files worth opening, rather than guessing at their
contents. The user can attach a file by typing @ followed by its path.`;
}

export interface ChatInput {
  repo: RepoSummary;
  tree: TreeNode[];
  readme: string | null;
  files: AttachedFile[];
  history: ChatMessage[];
  question: string;
  userKey?: string | null;
}

function buildContents({ repo, tree, readme, files, history, question }: ChatInput) {
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
    files.length > 0
      ? '\n\n=== ATTACHED FILE CONTENTS ===\n' +
        files
          .map(
            (f) =>
              `\n--- ${f.path}${f.truncated ? ' (truncated)' : ''} ---\n${f.text.slice(0, MAX_FILE_CHARS)}`,
          )
          .join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Gemini requires alternating roles; the SDK uses "model" for assistant turns.
  return [
    { role: 'user' as const, parts: [{ text: `Repository context:\n\n${context}` }] },
    {
      role: 'model' as const,
      parts: [
        {
          text:
            files.length > 0
              ? `Understood. I have the listing, the README, and the contents of ${files.map((f) => f.path).join(', ')}.`
              : 'Understood. I have the file listing and README for this repository.',
        },
      ],
    },
    ...history.slice(-10).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: question }] },
  ];
}

export async function answerRepoQuestion(input: ChatInput): Promise<string> {
  try {
    const provider = resolveProvider(input.userKey);
    const text = await provider.generate({
      systemInstruction: systemPrompt(input.files.length > 0),
      contents: buildContents(input),
      temperature: 0.3,
    });
    return text || 'No response was returned.';
  } catch (error) {
    wrapProviderError(error, 'chat');
  }
}

export function streamRepoAnswer(input: ChatInput): AsyncIterable<string> {
  // `resolveProvider` throws synchronously when no key is configured, which
  // must surface before the response stream opens — once the SSE headers are
  // sent, the status code can no longer say 503.
  const provider = resolveProvider(input.userKey);

  return provider.generateStream({
    systemInstruction: systemPrompt(input.files.length > 0),
    contents: buildContents(input),
    temperature: 0.3,
  });
}
