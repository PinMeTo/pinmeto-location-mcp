import { isAxiosError } from 'axios';

/**
 * Error codes that categorize API failures.
 * These codes enable programmatic error handling by AI clients.
 */
export type ApiErrorCode =
  | 'AUTH_INVALID_CREDENTIALS' // 401 - wrong app ID/secret
  | 'AUTH_APP_DISABLED' // 403 - OAuth app revoked
  | 'BAD_REQUEST' // 400 - malformed request
  | 'NOT_FOUND' // 404 - resource not found
  | 'RATE_LIMITED' // 429 - too many requests
  | 'SERVER_ERROR' // 500/503 - server issues
  | 'NETWORK_ERROR' // timeout, DNS, connection refused
  | 'UNKNOWN_ERROR'; // fallback

/**
 * Structured error with actionable information.
 * Provides enough context for AI agents to guide users.
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string; // Human-readable, actionable message
  statusCode?: number; // HTTP status if applicable
  retryable: boolean; // Whether the operation can be retried
}

/**
 * Result type for API requests - either success or error.
 * Uses discriminated union for type-safe error handling.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * Authentication error class for errors thrown during token fetch.
 * Used internally to propagate auth-specific errors.
 */
export class AuthError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Maps an unknown error to a structured ApiError.
 * Handles Axios errors, AuthErrors, and unknown errors.
 */
export function mapAxiosErrorToApiError(e: unknown): ApiError {
  // Handle AuthError (from token fetch)
  if (e instanceof AuthError) {
    return {
      code: e.code,
      message: e.message,
      retryable: false
    };
  }

  // Handle Axios errors
  if (isAxiosError(e)) {
    const status = e.response?.status;

    switch (status) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters. Check date formats and store IDs.',
          statusCode: 400,
          retryable: false
        };
      case 401:
        return {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Authentication failed. Check PINMETO_APP_ID and PINMETO_APP_SECRET.',
          statusCode: 401,
          retryable: false
        };
      case 403:
        return {
          code: 'AUTH_APP_DISABLED',
          message: 'OAuth application is disabled or revoked. Contact PinMeTo support.',
          statusCode: 403,
          retryable: false
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Resource not found. Verify the store ID exists.',
          statusCode: 404,
          retryable: false
        };
      case 429:
        return {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Wait before retrying.',
          statusCode: 429,
          retryable: true
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: 'PinMeTo API server error. Try again later.',
          statusCode: status,
          retryable: true
        };
      default:
        // No response - network error
        if (!e.response) {
          const detail = e.code || e.message || 'Unknown network error';
          return {
            code: 'NETWORK_ERROR',
            message: `Network error: ${detail}. Check internet connection.`,
            retryable: true
          };
        }
    }
  }

  // Fallback for unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: e instanceof Error ? e.message : 'An unknown error occurred',
    retryable: false
  };
}
