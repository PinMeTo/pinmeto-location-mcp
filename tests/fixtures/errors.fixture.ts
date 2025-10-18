/**
 * Mock error responses for testing
 * Contains realistic error scenarios for various HTTP status codes and network issues
 */

// 404 Not Found error
export const mockError404 = {
  status: 404,
  statusText: 'Not Found',
  data: {
    error: 'Not Found',
    message: 'The requested resource does not exist',
    code: 'RESOURCE_NOT_FOUND'
  }
};

// 401 Unauthorized error
export const mockError401 = {
  status: 401,
  statusText: 'Unauthorized',
  data: {
    error: 'Unauthorized',
    message: 'Authentication failed. Invalid or expired credentials.',
    code: 'AUTHENTICATION_FAILED'
  }
};

// 403 Forbidden error
export const mockError403 = {
  status: 403,
  statusText: 'Forbidden',
  data: {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource',
    code: 'PERMISSION_DENIED'
  }
};

// 429 Rate Limit error
export const mockError429 = {
  status: 429,
  statusText: 'Too Many Requests',
  data: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests. Please wait before making more requests.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  }
};

// 500 Internal Server Error
export const mockError500 = {
  status: 500,
  statusText: 'Internal Server Error',
  data: {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred on the server',
    code: 'INTERNAL_ERROR'
  }
};

// 400 Bad Request error
export const mockError400 = {
  status: 400,
  statusText: 'Bad Request',
  data: {
    error: 'Bad Request',
    message: 'Invalid request parameters',
    code: 'INVALID_REQUEST',
    details: {
      field: 'from',
      message: 'Date must be in YYYY-MM-DD format'
    }
  }
};

// Timeout error (ECONNABORTED)
export const mockErrorTimeout = {
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded'
};

// Network error (ENOTFOUND)
export const mockErrorNetwork = {
  code: 'ENOTFOUND',
  message: 'getaddrinfo ENOTFOUND api.pinmeto.com'
};

// Connection refused error (ECONNREFUSED)
export const mockErrorConnectionRefused = {
  code: 'ECONNREFUSED',
  message: 'connect ECONNREFUSED 127.0.0.1:443'
};

// Helper to create axios-style error object
export function createAxiosError(errorConfig: {
  code?: string;
  message?: string;
  response?: {
    status: number;
    statusText: string;
    data: any;
  };
}) {
  const error: any = new Error(errorConfig.message || 'Request failed');
  error.isAxiosError = true;
  error.code = errorConfig.code;

  if (errorConfig.response) {
    error.response = {
      status: errorConfig.response.status,
      statusText: errorConfig.response.statusText,
      data: errorConfig.response.data,
      headers: {},
      config: {}
    };
  }

  return error;
}

// Predefined axios errors for common scenarios
export const axiosError404 = createAxiosError({
  message: 'Request failed with status code 404',
  response: mockError404
});

export const axiosError401 = createAxiosError({
  message: 'Request failed with status code 401',
  response: mockError401
});

export const axiosError403 = createAxiosError({
  message: 'Request failed with status code 403',
  response: mockError403
});

export const axiosError429 = createAxiosError({
  message: 'Request failed with status code 429',
  response: mockError429
});

export const axiosError500 = createAxiosError({
  message: 'Request failed with status code 500',
  response: mockError500
});

export const axiosErrorTimeout = createAxiosError({
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded'
});

export const axiosErrorNetwork = createAxiosError({
  code: 'ENOTFOUND',
  message: 'getaddrinfo ENOTFOUND api.pinmeto.com'
});

export const axiosErrorConnectionRefused = createAxiosError({
  code: 'ECONNREFUSED',
  message: 'connect ECONNREFUSED 127.0.0.1:443'
});
