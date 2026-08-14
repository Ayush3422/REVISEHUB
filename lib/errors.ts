/**
 * Application errors carry an HTTP status and a message that is safe to show a
 * user. Route handlers translate them; anything else becomes a generic 500 so
 * that internal details (including anything that might embed a key) never
 * reach the browser.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  /** Unix seconds at which the GitHub rate limit window resets, if known. */
  readonly resetAt: number | null;

  constructor(message: string, resetAt: number | null = null) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UpstreamError extends AppError {
  constructor(message: string) {
    super(message, 502, 'UPSTREAM_ERROR');
    this.name = 'UpstreamError';
  }
}

/** Narrows an unknown catch value to a user-safe message and status. */
export function toErrorResponse(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof AppError) {
    return { message: error.message, status: error.status, code: error.code };
  }
  return {
    message: 'Something went wrong. Please try again.',
    status: 500,
    code: 'INTERNAL_ERROR',
  };
}
