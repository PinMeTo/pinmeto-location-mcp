/**
 * Shared test utilities
 * Common test setup, configuration, and helper functions
 */

import { vi } from 'vitest';

/**
 * Test configuration constants
 */
export const TEST_CONFIG = {
  accountId: 'test_account',
  appId: 'test_id',
  appSecret: 'test_secret',
  apiBaseUrl: 'https://api.example.com',
  locationApiBaseUrl: 'https://locations.api.example.com',
  accessToken: 'test_access_token_12345'
};

/**
 * Setup test environment variables
 * Call this in beforeAll() or beforeEach()
 */
export function setupTestEnv() {
  process.env.NODE_ENV = 'development';
  process.env.PINMETO_API_URL = TEST_CONFIG.apiBaseUrl;
  process.env.PINMETO_LOCATION_API_URL = TEST_CONFIG.locationApiBaseUrl;
  process.env.PINMETO_ACCOUNT_ID = TEST_CONFIG.accountId;
  process.env.PINMETO_APP_ID = TEST_CONFIG.appId;
  process.env.PINMETO_APP_SECRET = TEST_CONFIG.appSecret;
}

/**
 * Clear all mocks
 * Call this in beforeEach() to ensure clean state between tests
 */
export function clearAllMocks() {
  vi.clearAllMocks();
}

/**
 * Build URL for various API endpoints
 */
export const buildUrl = {
  locations: (params?: { fields?: string; pagesize?: number; page?: number }) => {
    let url = `${TEST_CONFIG.locationApiBaseUrl}/v4/${TEST_CONFIG.accountId}/locations`;
    const queryParams: string[] = [];

    if (params?.pagesize) queryParams.push(`pagesize=${params.pagesize}`);
    if (params?.fields) queryParams.push(`fields=${params.fields}`);
    if (params?.page) queryParams.push(`page=${params.page}`);

    return queryParams.length > 0 ? `${url}?${queryParams.join('&')}` : url;
  },

  location: (storeId: string) => {
    return `${TEST_CONFIG.locationApiBaseUrl}/v4/${TEST_CONFIG.accountId}/locations/${storeId}`;
  },

  googleInsightsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;
  },

  googleInsightsAll: (from: string, to: string, params?: { page?: number }) => {
    let url = `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/insights/google?from=${from}&to=${to}`;
    if (params?.page) url += `&page=${params.page}`;
    return url;
  },

  googleRatingsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/ratings/google/${storeId}?from=${from}&to=${to}`;
  },

  googleRatingsAll: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/ratings/google?from=${from}&to=${to}`;
  },

  googleKeywordsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`;
  },

  googleKeywordsAll: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/insights/google-keywords?from=${from}&to=${to}`;
  },

  facebookInsightsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`;
  },

  facebookInsightsAll: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/locations/insights/facebook?from=${from}&to=${to}`;
  },

  facebookInsightsBrandpage: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;
  },

  facebookRatingsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`;
  },

  facebookRatingsAll: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v3/${TEST_CONFIG.accountId}/ratings/facebook?from=${from}&to=${to}`;
  },

  appleInsightsLocation: (storeId: string, from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`;
  },

  appleInsightsAll: (from: string, to: string) => {
    return `${TEST_CONFIG.apiBaseUrl}/listings/v4/${TEST_CONFIG.accountId}/locations/insights/apple?from=${from}&to=${to}`;
  },

  oauth: () => {
    return `${TEST_CONFIG.apiBaseUrl}/oauth/token`;
  }
};

/**
 * Expected authorization header for OAuth token
 */
export function getExpectedAuthHeader() {
  // Base64 encode "test_id:test_secret"
  const credentials = `${TEST_CONFIG.appId}:${TEST_CONFIG.appSecret}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Expected bearer token header for API requests
 */
export function getExpectedBearerHeader() {
  return `Bearer ${TEST_CONFIG.accessToken}`;
}

/**
 * Wait for async operations to complete
 * Useful for testing async MCP tool calls
 */
export function waitForAsync(ms: number = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock StdioServerTransport message
 */
export function createMcpMessage(method: string, params: any, id: number = 1) {
  return {
    method,
    params,
    jsonrpc: '2.0' as const,
    id
  };
}

/**
 * Create an initialize message for MCP
 */
export function createInitializeMessage(id: number = 0) {
  return createMcpMessage(
    'initialize',
    {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    },
    id
  );
}

/**
 * Create a tools/call message for MCP
 */
export function createToolCallMessage(toolName: string, args: any, id: number = 1) {
  return createMcpMessage(
    'tools/call',
    {
      name: toolName,
      arguments: args
    },
    id
  );
}
