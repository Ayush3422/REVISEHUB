import type { ChatMessage } from '@/lib/types';

/**
 * Conversation persistence, scoped per repository.
 *
 * `sessionStorage` rather than `localStorage`: a conversation about someone
 * else's codebase is not something to leave on disk indefinitely, and clearing
 * on tab close matches how the AI key is already handled.
 */

const PREFIX = 'revisehub.chat.';
/** Bounded so a long conversation cannot exhaust the storage quota. */
const MAX_STORED = 40;

function key(owner: string, repo: string): string {
  return `${PREFIX}${owner}/${repo}`;
}

export function loadConversation(owner: string, repo: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(key(owner, repo));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Storage is user-writable, so the shape is checked rather than trusted.
    return parsed.filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === 'object' &&
        (m as ChatMessage).role !== undefined &&
        ['user', 'assistant'].includes((m as ChatMessage).role) &&
        typeof (m as ChatMessage).content === 'string',
    );
  } catch {
    return [];
  }
}

export function saveConversation(owner: string, repo: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key(owner, repo), JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    /* storage full or disabled; the conversation still works in memory */
  }
}

export function clearConversation(owner: string, repo: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key(owner, repo));
  } catch {
    /* nothing to do */
  }
}
