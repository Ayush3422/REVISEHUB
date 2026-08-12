/**
 * Client-side storage for a user-supplied AI key.
 *
 * `sessionStorage`, not `localStorage`: the key is cleared when the tab closes,
 * which is the safer default for a credential the user pasted in. It is sent
 * only to this app's own API routes, over the same origin, and the server uses
 * it for the request and discards it.
 */

const STORAGE_KEY = 'revisehub.ai-key';

export function getAiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be disabled entirely; that is not an error worth surfacing.
    return null;
  }
}

export function setAiKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (key && key.trim()) window.sessionStorage.setItem(STORAGE_KEY, key.trim());
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event('revisehub:ai-key-changed'));
}

/** Headers for a request to an AI route, including the user key when set. */
export function aiHeaders(): HeadersInit {
  const key = getAiKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'x-ai-key': key } : {}),
  };
}

/** Shows enough to confirm which key is stored without revealing it. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(12)}${key.slice(-4)}`;
}
