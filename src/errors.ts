import { isAxiosError } from 'axios';

/**
 * Error codes that categorize API failures.
 * These codes enable programmatic error handling by AI clients.
 *
 * This array is the single source of truth - both the TypeScript type
 * and Zod schema are derived from it to ensure consistency.
 */
export const API_ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS', // 401 - wrong app ID/secret
  'AUTH_APP_DISABLED', // 403 - OAuth app revoked
  'BAD_REQUEST', // 400 - malformed request
  'NOT_FOUND', // 404 - resource not found
  'RATE_LIMITED', // 429 - too many requests
  'SERVER_ERROR', // 500/503 - server issues
  'NETWORK_ERROR', // timeout, DNS, connection refused
  'UNKNOWN_ERROR' // fallback
] as const;

/**
 * Union type of all possible API error codes.
 * Derived from API_ERROR_CODES array for type safety.
 */
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

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
 * Extracts error message from API response body.
 * Handles common API error response formats.
 */
function extractApiErrorMessage(responseData: unknown): string | undefined {
  if (!responseData || typeof responseData !== 'object') {
    return undefined;
  }
  const data = responseData as Record<string, unknown>;
  // Common API error message fields
  return (
    (typeof data.message === 'string' && data.message) ||
    (typeof data.error === 'string' && data.error) ||
    (typeof data.error_description === 'string' && data.error_description) ||
    undefined
  );
}

/**
 * Maps an unknown error to a structured ApiError.
 * Handles Axios errors, AuthErrors, and unknown errors.
 * Preserves API response details when available.
 */
export function mapAxiosErrorToApiError(e: unknown): ApiError {
  // Handle AuthError (from token fetch)
  if (e instanceof AuthError) {
    return {
      code: e.code,
      message: e.message,
      // Network errors and rate limiting during auth are retryable; credential errors are not
      retryable: e.code === 'NETWORK_ERROR' || e.code === 'RATE_LIMITED'
    };
  }

  // Handle Axios errors
  if (isAxiosError(e)) {
    const status = e.response?.status;
    const apiMessage = extractApiErrorMessage(e.response?.data);

    // No response - network error (check first to handle undefined status)
    if (!e.response) {
      const errorCode = e.code || '';
      // Map specific network error codes to actionable messages
      const networkErrorMessages: Record<string, string> = {
        ECONNABORTED: 'Request timed out (30s). PinMeTo API may be slow - try again.',
        ECONNREFUSED: 'Connection refused. Verify PinMeTo API is accessible from your network.',
        ENOTFOUND: 'DNS lookup failed for API host. Check network configuration.',
        ETIMEDOUT: 'Connection timed out. Check network stability.'
      };
      const message =
        networkErrorMessages[errorCode] ||
        `Network error: ${errorCode || e.message || 'Unknown'}. Check internet connection.`;
      return {
        code: 'NETWORK_ERROR',
        message,
        retryable: true
      };
    }

    switch (status) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: apiMessage || 'Invalid request parameters. Check date formats and store IDs.',
          statusCode: 400,
          retryable: false
        };
      case 401:
        return {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: apiMessage || 'Authentication failed. Check PINMETO_APP_ID and PINMETO_APP_SECRET.',
          statusCode: 401,
          retryable: false
        };
      case 403:
        return {
          code: 'AUTH_APP_DISABLED',
          message: apiMessage || 'OAuth application is disabled or revoked. Contact PinMeTo support.',
          statusCode: 403,
          retryable: false
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: apiMessage || 'Resource not found. Verify the store ID exists.',
          statusCode: 404,
          retryable: false
        };
      case 429: {
        // Extract Retry-After header for actionable guidance
        const retryAfter = e.response?.headers?.['retry-after'];
        let message = apiMessage || 'Rate limit exceeded.';
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          message += isNaN(seconds)
            ? ` Retry after: ${retryAfter}.`
            : ` Wait ${seconds} seconds before retrying.`;
        } else {
          message += ' Wait before retrying.';
        }
        return {
          code: 'RATE_LIMITED',
          message,
          statusCode: 429,
          retryable: true
        };
      }
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: apiMessage || 'PinMeTo API server error. Try again later.',
          statusCode: status,
          retryable: true
        };
      default: {
        // Unhandled HTTP status code - provide informative message
        const is5xx = status !== undefined && status >= 500 && status < 600;
        return {
          code: is5xx ? 'SERVER_ERROR' : 'UNKNOWN_ERROR',
          message:
            apiMessage ||
            (status !== undefined
              ? `API returned unexpected status ${status}.`
              : 'API returned response with no status code.'),
          statusCode: status,
          retryable: is5xx
        };
      }
    }
  }

  // Fallback for unknown errors (non-Axios errors)
  return {
    code: 'UNKNOWN_ERROR',
    message: e instanceof Error ? e.message : 'An unknown error occurred',
    retryable: false
  };
}
