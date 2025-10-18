/**
 * Sophisticated axios mock for testing
 * Handles different URL patterns and returns appropriate mock data
 */

import { vi } from 'vitest';
import { TEST_CONFIG, getExpectedAuthHeader, getExpectedBearerHeader } from './test-utils';

// Import fixtures
import {
  mockLocation1,
  mockLocation2,
  mockLocation3Inactive,
  mockLocationsAll,
  mockLocationsEmpty,
  mockLocationsFieldsFiltered,
  mockLocationsPaginatedPage1,
  mockLocationsPaginatedPage2
} from '../fixtures/locations.fixture';

import {
  mockGoogleLocationInsights,
  mockAllGoogleInsights,
  mockGoogleLocationRatings,
  mockAllGoogleRatings,
  mockGoogleKeywordsForLocation,
  mockAllGoogleKeywords,
  mockGoogleInsightsEmpty,
  mockGoogleInsightsPaginatedPage1,
  mockGoogleInsightsPaginatedPage2
} from '../fixtures/google.fixture';

import {
  mockFacebookLocationInsights,
  mockFacebookBrandpageInsights,
  mockAllFacebookInsights,
  mockFacebookLocationRatings,
  mockAllFacebookRatings,
  mockFacebookInsightsEmpty,
  mockFacebookInsightsPaginatedPage1,
  mockFacebookInsightsPaginatedPage2
} from '../fixtures/facebook.fixture';

import {
  mockAppleLocationInsights,
  mockAllAppleInsights,
  mockAppleInsightsEmpty,
  mockAppleInsightsPaginatedPage1,
  mockAppleInsightsPaginatedPage2
} from '../fixtures/apple.fixture';

import {
  axiosError404,
  axiosError401,
  axiosError403,
  axiosError429,
  axiosErrorTimeout,
  axiosErrorNetwork
} from '../fixtures/errors.fixture';

/**
 * Error simulation mode for testing error scenarios
 */
type ErrorMode =
  | null
  | '404'
  | '401'
  | '403'
  | '429'
  | 'timeout'
  | 'network'
  | 'specific-location-404';

let currentErrorMode: ErrorMode = null;

/**
 * Set error mode for testing error scenarios
 */
export function setAxiosMockErrorMode(mode: ErrorMode) {
  currentErrorMode = mode;
}

/**
 * Reset error mode to null (normal operation)
 */
export function resetAxiosMockErrorMode() {
  currentErrorMode = null;
}

/**
 * Mock axios GET implementation
 */
export const mockAxiosGet = vi.fn((url: string, config: any) => {
  console.error('Mocked axios GET request', url);

  // Check authorization header
  const authHeader = config?.headers?.['Authorization'];
  if (authHeader !== getExpectedBearerHeader()) {
    return Promise.reject(axiosError401);
  }

  // Handle error modes
  if (currentErrorMode === '404') {
    return Promise.reject(axiosError404);
  }
  if (currentErrorMode === '401') {
    return Promise.reject(axiosError401);
  }
  if (currentErrorMode === '403') {
    return Promise.reject(axiosError403);
  }
  if (currentErrorMode === '429') {
    return Promise.reject(axiosError429);
  }
  if (currentErrorMode === 'timeout') {
    return Promise.reject(axiosErrorTimeout);
  }
  if (currentErrorMode === 'network') {
    return Promise.reject(axiosErrorNetwork);
  }

  // Handle specific location 404
  if (currentErrorMode === 'specific-location-404' && url.includes('/locations/nonexistent-')) {
    return Promise.reject(axiosError404);
  }

  // Google keywords - location specific (v3 API) (MUST be before generic insights patterns)
  if (url.includes('/v3/') && url.includes('/insights/google-keywords/') && url.match(/\/google-keywords\/[^?]+/)) {
    return Promise.resolve({ data: mockGoogleKeywordsForLocation });
  }

  // Google keywords - all locations (v3 API) (MUST be before generic insights patterns)
  if (url.includes('/v3/') && url.includes('/insights/google-keywords') && !url.match(/\/google-keywords\/[^?]+/)) {
    return Promise.resolve({ data: mockAllGoogleKeywords });
  }

  // Google insights - location specific (MUST be before generic locations check)
  if (url.includes('/locations/') && url.includes('/insights/google') && !url.includes('google-keywords')) {
    const storeId = url.split('/locations/')[1].split('/')[0];
    if (storeId === 'closed-store-003') {
      return Promise.resolve({ data: mockGoogleInsightsEmpty });
    }
    return Promise.resolve({ data: mockGoogleLocationInsights });
  }

  // Google insights - all locations
  if (url.includes('/insights/google') && !url.includes('/locations/') && !url.includes('google-keywords')) {
    if (url.includes('page=2')) {
      return Promise.resolve({ data: mockGoogleInsightsPaginatedPage2 });
    }
    return Promise.resolve({ data: mockAllGoogleInsights });
  }

  // Google ratings - location specific (v3 API)
  if (url.includes('/v3/') && url.includes('/ratings/google/') && url.match(/\/ratings\/google\/[^?]+/)) {
    return Promise.resolve({ data: mockGoogleLocationRatings });
  }

  // Google ratings - all locations (v3 API)
  if (url.includes('/v3/') && url.includes('/ratings/google') && !url.match(/\/ratings\/google\/[^?]+/)) {
    return Promise.resolve({ data: mockAllGoogleRatings });
  }

  // Facebook insights - location specific
  if (url.match(/\/locations\/[^/]+\/insights\/facebook/)) {
    const storeId = url.split('/locations/')[1].split('/')[0];
    if (storeId === 'closed-store-003') {
      return Promise.resolve({ data: mockFacebookInsightsEmpty });
    }
    return Promise.resolve({ data: mockFacebookLocationInsights });
  }

  // Facebook insights - brandpage
  if (url.includes('/brand-page/insights/facebook')) {
    return Promise.resolve({ data: mockFacebookBrandpageInsights });
  }

  // Facebook insights - all locations (NOTE: path is /locations/insights/facebook, not just /insights/facebook)
  if (url.includes('/locations/insights/facebook') && !url.match(/\/locations\/[^/]+\/insights\/facebook/)) {
    if (url.includes('page=2')) {
      return Promise.resolve({ data: mockFacebookInsightsPaginatedPage2 });
    }
    return Promise.resolve({ data: mockAllFacebookInsights });
  }

  // Facebook ratings - location specific (v3 API)
  if (url.includes('/v3/') && url.includes('/ratings/facebook/') && url.match(/\/ratings\/facebook\/[^?]+/)) {
    return Promise.resolve({ data: mockFacebookLocationRatings });
  }

  // Facebook ratings - all locations (v3 API)
  if (url.includes('/v3/') && url.includes('/ratings/facebook') && !url.match(/\/ratings\/facebook\/[^?]+/)) {
    return Promise.resolve({ data: mockAllFacebookRatings });
  }

  // Apple insights - location specific (MUST be before generic locations/insights check)
  if (url.match(/\/locations\/[^/]+\/insights\/apple/)) {
    const storeId = url.split('/locations/')[1].split('/')[0];

    // Extract date parameters from URL if present
    const urlObj = new URL(url, 'http://example.com');
    const from = urlObj.searchParams.get('from');
    const to = urlObj.searchParams.get('to');

    if (storeId === 'closed-store-003') {
      const emptyData = { ...mockAppleInsightsEmpty };
      if (from && to) {
        emptyData.period = { from, to };
      }
      return Promise.resolve({ data: emptyData });
    }

    // Return data with customized period if dates are provided
    const data = { ...mockAppleLocationInsights };
    if (from && to) {
      data.period = { from, to };
    }
    return Promise.resolve({ data });
  }

  // Apple insights - all locations (NOTE: path is /locations/insights/apple, not just /insights/apple)
  if (url.includes('/locations/insights/apple') && !url.match(/\/locations\/[^/]+\/insights\/apple/)) {
    // Extract date parameters from URL if present
    const urlObj = new URL(url, 'http://example.com');
    const from = urlObj.searchParams.get('from');
    const to = urlObj.searchParams.get('to');

    if (url.includes('page=2')) {
      const page2Data = mockAppleInsightsPaginatedPage2.map((loc: any) => {
        if (from && to) {
          return { ...loc, period: { from, to } };
        }
        return loc;
      });
      return Promise.resolve({
        data: {
          data: page2Data,
          paging: {}
        }
      });
    }

    const allData = mockAllAppleInsights.map((loc: any) => {
      if (from && to) {
        return { ...loc, period: { from, to } };
      }
      return loc;
    });
    return Promise.resolve({
      data: {
        data: allData,
        paging: {}
      }
    });
  }

  // Locations endpoints (MUST be after network-specific patterns to avoid conflicts)
  if (url.includes('/v4/test_account/locations')) {
    // Single location
    if (url.match(/\/locations\/[^?]+$/)) {
      const storeId = url.split('/locations/')[1];
      if (storeId === 'downtown-store-001') {
        return Promise.resolve({ data: mockLocation1 });
      }
      if (storeId === 'uptown-store-002') {
        return Promise.resolve({ data: mockLocation2 });
      }
      if (storeId === 'closed-store-003') {
        return Promise.resolve({ data: mockLocation3Inactive });
      }
      if (storeId.startsWith('nonexistent-')) {
        return Promise.reject(axiosError404);
      }
      return Promise.reject(axiosError404);
    }

    // All locations (with field filtering)
    if (url.includes('fields=storeId,name,isActive')) {
      return Promise.resolve({ data: mockLocationsFieldsFiltered });
    }

    // Paginated locations
    if (url.includes('page=2')) {
      return Promise.resolve({ data: mockLocationsPaginatedPage2 });
    }
    if (url.includes('pagesize=2')) {
      return Promise.resolve({ data: mockLocationsPaginatedPage1 });
    }

    // All locations (default)
    return Promise.resolve({ data: mockLocationsAll });
  }

  // Default: not found
  console.error('Unhandled URL pattern:', url);
  return Promise.reject(axiosError404);
});

/**
 * Mock axios POST implementation (for OAuth)
 */
export const mockAxiosPost = vi.fn((url: string, data: any, config: any) => {
  console.error('Mocked axios POST request', url, data);

  // Handle OAuth token endpoint
  if (url === `${TEST_CONFIG.apiBaseUrl}/oauth/token`) {
    const authHeader = config?.headers?.['Authorization'];
    const contentType = config?.headers?.['Content-Type'];

    if (
      authHeader === getExpectedAuthHeader() &&
      contentType === 'application/x-www-form-urlencoded'
    ) {
      return Promise.resolve({
        data: {
          access_token: TEST_CONFIG.accessToken,
          token_type: 'Bearer',
          expires_in: 3600
        }
      });
    }

    return Promise.reject(axiosError401);
  }

  // Default: not found
  return Promise.reject(axiosError404);
});

/**
 * Mock axios.isAxiosError implementation
 */
export const mockIsAxiosError = vi.fn((error: any) => {
  return error && error.isAxiosError === true;
});

/**
 * Create the complete axios mock
 * This function should be used inline in vi.mock() calls to avoid hoisting issues
 */
export function createAxiosMock() {
  return {
    default: {
      get: mockAxiosGet,
      post: mockAxiosPost,
      isAxiosError: mockIsAxiosError
    }
  };
}

/**
 * Axios mock object for vi.mock - use this directly in vi.mock calls
 */
export const axiosMock = {
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    isAxiosError: mockIsAxiosError
  }
};
