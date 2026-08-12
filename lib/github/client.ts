import 'server-only';
import { env } from '@/lib/env';
import { NotFoundError, RateLimitError, UpstreamError, ValidationError } from '@/lib/errors';
import type { RepoRef } from '@/lib/types';

const API = 'https://api.github.com';

/**
 * Every GitHub request goes through here, which is the whole point: the token
 * is attached in one place and can never be forgotten on an individual call.
 * The previous implementation authenticated some endpoints and not others,
 * so file reads and diffs silently ran against the 60/hour anonymous limit.
 */
function headers(accept = 'application/vnd.github+json'): HeadersInit {
  const { GITHUB_TOKEN } = env();
  const base: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ReviseHub',
  };
  if (GITHUB_TOKEN) base.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return base;
}

function rateLimitFrom(res: Response): RateLimitError | null {
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  const isRateLimited =
    res.status === 429 || (res.status === 403 && remaining !== null && Number(remaining) === 0);

  if (!isRateLimited) return null;

  const resetAt = reset ? Number(reset) : null;
  const when = resetAt ? new Date(resetAt * 1000).toLocaleTimeString() : 'shortly';
  const hint = env().GITHUB_TOKEN
    ? `The authenticated limit of 5,000 requests/hour is exhausted. It resets at ${when}.`
    : `Anonymous requests are limited to 60/hour. Add a GITHUB_TOKEN to raise this to 5,000/hour. Resets at ${when}.`;

  return new RateLimitError(`GitHub API rate limit reached. ${hint}`, resetAt);
}

interface RequestOptions {
  /** Seconds to cache the response for. 0 disables caching. */
  revalidate?: number;
  accept?: string;
  /** When true a 404 resolves to null instead of throwing. */
  allowMissing?: boolean;
}

async function request(path: string, options: RequestOptions = {}): Promise<Response | null> {
  const { revalidate = 300, accept, allowMissing = false } = options;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: headers(accept),
      next: revalidate > 0 ? { revalidate } : undefined,
      cache: revalidate > 0 ? undefined : 'no-store',
    });
  } catch {
    throw new UpstreamError('Could not reach the GitHub API. Check your network connection.');
  }

  const limited = rateLimitFrom(res);
  if (limited) throw limited;

  if (res.status === 404) {
    if (allowMissing) return null;
    throw new NotFoundError(
      'Repository or resource not found. It may be private, renamed, or misspelled.',
    );
  }

  if (res.status === 401) {
    throw new UpstreamError(
      'GitHub rejected the configured token. Check that GITHUB_TOKEN is valid.',
    );
  }

  if (!res.ok) {
    throw new UpstreamError(`GitHub API returned ${res.status} for ${path}.`);
  }

  return res;
}

export async function ghJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options);
  return (await res!.json()) as T;
}

export async function ghJsonOrNull<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const res = await request(path, { ...options, allowMissing: true });
  return res ? ((await res.json()) as T) : null;
}

export async function ghText(path: string, options: RequestOptions = {}): Promise<string> {
  const res = await request(path, options);
  return await res!.text();
}

/**
 * The `/stats/*` endpoints are computed asynchronously by GitHub. The first
 * request for a cold repository returns 202 with an empty body while the cache
 * is built. Returning `null` lets the caller say "still computing, retry" —
 * which is honest — instead of rendering zeroes as though they were data.
 */
export async function ghStats<T>(path: string): Promise<T | null> {
  const res = await request(path, { revalidate: 900 });
  if (!res) return null;
  if (res.status === 202 || res.status === 204) return null;

  const body = await res.text();
  if (!body.trim()) return null;

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts a full URL, an `owner/repo` slug, or a `git@` remote. Validating the
 * two segments against GitHub's own naming rules keeps user input from being
 * interpolated into an API path unchecked.
 */
export function parseRepoInput(input: string): RepoRef {
  const trimmed = input.trim();
  if (!trimmed) throw new ValidationError('Enter a GitHub repository URL or owner/repo.');

  let candidate = trimmed
    .replace(/^git@github\.com:/i, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '');

  try {
    // Strip any query string or fragment a copy-pasted URL might carry.
    candidate = candidate.split(/[?#]/)[0] ?? candidate;
  } catch {
    /* not a URL, fine */
  }

  const parts = candidate
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);

  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo || !OWNER.test(owner) || !REPO.test(repo)) {
    throw new ValidationError(
      'That does not look like a GitHub repository. Try https://github.com/owner/repo.',
    );
  }

  return { owner, repo };
}
