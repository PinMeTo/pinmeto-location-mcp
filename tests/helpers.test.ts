/**
 * Helper functions tests
 * Tests for all formatter and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatListResponse,
  truncateResponse,
  formatLocationMarkdown,
  formatInsightsMarkdown,
  formatRatingsMarkdown,
  formatKeywordsMarkdown,
  formatApiError,
  handleToolResponse
} from '../src/helpers';
import { PinMeToApiError } from '../src/mcp_server';
import { mockLocation1, mockLocation2 } from './fixtures/locations.fixture';
import {
  mockGoogleLocationInsights,
  mockGoogleLocationRatings,
  mockGoogleKeywordsForLocation
} from './fixtures/google.fixture';

describe('formatListResponse', () => {
  it('should format list with pagination metadata', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = formatListResponse(data, true);

    expect(result).toBeDefined();
    expect(result).toContain('"count": 3');
    expect(result).toContain('"has_more": false');
    expect(result).toContain('"items"');
  });

  it('should include has_more=true when not all pages fetched', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatListResponse(data, false);

    expect(result).toContain('"has_more": true');
    expect(result).toContain('Not all pages were fetched');
  });

  it('should handle empty array', () => {
    const result = formatListResponse([], true);

    expect(result).toBe('The response was empty...');
  });

  it('should include offset and total when provided', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatListResponse(data, true, {
      offset: 0,
      limit: 10,
      total: 100
    });

    expect(result).toContain('"offset": 0');
    expect(result).toContain('"total": 100');
  });

  it('should calculate next_offset when has_more is true', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatListResponse(data, false, {
      offset: 0
    });

    expect(result).toContain('"next_offset": 2');
  });

  it('should not include next_offset when all pages fetched', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatListResponse(data, true, {
      offset: 0
    });

    expect(result).not.toContain('next_offset');
  });

  it('should return valid JSON', () => {
    const data = [{ id: 1, name: 'Test' }];
    const result = formatListResponse(data, true);

    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe('truncateResponse', () => {
  it('should not truncate small response', () => {
    const data = { message: 'short message' };
    const [result, wasTruncated] = truncateResponse(data);

    expect(wasTruncated).toBe(false);
    expect(result).toContain('short message');
  });

  it('should truncate large response', () => {
    const largeData = {
      items: Array(10000)
        .fill(null)
        .map((_, i) => ({ id: i, text: 'Some text here'.repeat(10) }))
    };
    const [result, wasTruncated] = truncateResponse(largeData);

    expect(wasTruncated).toBe(true);
    expect(result).toContain('[Response truncated due to size');
    expect(result.length).toBeLessThanOrEqual(25100); // MAX_RESPONSE_CHARS + message
  });

  it('should return valid JSON even when truncated', () => {
    const data = { message: 'test' };
    const [result, wasTruncated] = truncateResponse(data);

    expect(wasTruncated).toBe(false);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should handle null and undefined', () => {
    const [result1, wasTruncated1] = truncateResponse(null);
    const [result2, wasTruncated2] = truncateResponse(undefined);

    expect(wasTruncated1).toBe(false);
    expect(wasTruncated2).toBe(false);
    expect(result1).toContain('null');
    expect(result2).toContain('undefined');
  });

  it('should handle arrays', () => {
    const data = [1, 2, 3, 4, 5];
    const [result, wasTruncated] = truncateResponse(data);

    expect(wasTruncated).toBe(false);
    expect(result).toContain('[');
    expect(result).toContain('1,');
  });
});

describe('formatLocationMarkdown', () => {
  it('should format location with all fields', () => {
    const result = formatLocationMarkdown(mockLocation1);

    expect(result).toContain('# Location Details');
    expect(result).toContain('**Store ID:** downtown-store-001');
    expect(result).toContain('**Name:** Downtown Coffee Shop');
    expect(result).toContain('**Status:** Active');
    expect(result).toContain('## Address');
    expect(result).toContain('123 Market Street');
    expect(result).toContain('San Francisco');
    expect(result).toContain('## Contact');
    expect(result).toContain('+1-415-555-0123');
  });

  it('should handle inactive location', () => {
    const inactiveLocation = { ...mockLocation1, permanentlyClosed: true };
    const result = formatLocationMarkdown(inactiveLocation);

    expect(result).toContain('**Status:** Inactive');
  });

  it('should handle null location', () => {
    const result = formatLocationMarkdown(null);

    expect(result).toBe('No location data available.');
  });

  it('should handle minimal location data', () => {
    const minimalLocation = {
      storeId: 'test-store',
      name: 'Test Location',
      isActive: true
    };
    const result = formatLocationMarkdown(minimalLocation);

    expect(result).toContain('**Store ID:** test-store');
    expect(result).toContain('**Name:** Test Location');
  });

  it('should format operating hours', () => {
    const result = formatLocationMarkdown(mockLocation1);

    expect(result).toContain('## Operating Hours');
    expect(result).toContain('mon'); // Days are abbreviated in the API (mon, tue, etc.)
  });

  it('should format contact information', () => {
    const result = formatLocationMarkdown(mockLocation1);

    expect(result).toContain('**Phone:**');
    expect(result).toContain('**Email:**');
    expect(result).toContain('**Website:**');
  });
});

describe('formatInsightsMarkdown', () => {
  it('should format insights with platform name', () => {
    const result = formatInsightsMarkdown('Google', mockGoogleLocationInsights);

    expect(result).toContain('# Google Insights');
    expect(result).toContain('## Metrics');
    expect(result).toContain('```json');
  });

  it('should include storeId when provided', () => {
    const result = formatInsightsMarkdown(
      'Google',
      mockGoogleLocationInsights,
      'downtown-store-001'
    );

    expect(result).toContain('**Store ID:** downtown-store-001');
  });

  it('should handle null insights', () => {
    const result = formatInsightsMarkdown('Facebook', null);

    expect(result).toBe('No Facebook insights available.');
  });

  it('should format different platforms', () => {
    const googleResult = formatInsightsMarkdown('Google', mockGoogleLocationInsights);
    const facebookResult = formatInsightsMarkdown('Facebook', { test: 'data' });
    const appleResult = formatInsightsMarkdown('Apple', { test: 'data' });

    expect(googleResult).toContain('# Google Insights');
    expect(facebookResult).toContain('# Facebook Insights');
    expect(appleResult).toContain('# Apple Insights');
  });

  it('should include JSON code block', () => {
    const result = formatInsightsMarkdown('Google', mockGoogleLocationInsights);

    expect(result).toContain('```json');
    expect(result).toContain('```');
  });
});

describe('formatRatingsMarkdown', () => {
  it('should format ratings with platform name', () => {
    const result = formatRatingsMarkdown('Google', mockGoogleLocationRatings);

    expect(result).toContain('# Google Ratings');
    expect(result).toContain('## Rating Details');
    expect(result).toContain('```json');
  });

  it('should include storeId when provided', () => {
    const result = formatRatingsMarkdown(
      'Google',
      mockGoogleLocationRatings,
      'downtown-store-001'
    );

    expect(result).toContain('**Store ID:** downtown-store-001');
  });

  it('should handle null ratings', () => {
    const result = formatRatingsMarkdown('Facebook', null);

    expect(result).toBe('No Facebook ratings available.');
  });

  it('should format different platforms', () => {
    const googleResult = formatRatingsMarkdown('Google', mockGoogleLocationRatings);
    const facebookResult = formatRatingsMarkdown('Facebook', { test: 'data' });

    expect(googleResult).toContain('# Google Ratings');
    expect(facebookResult).toContain('# Facebook Ratings');
  });
});

describe('formatKeywordsMarkdown', () => {
  it('should format keywords data', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation);

    expect(result).toContain('# Google Keywords');
    expect(result).toContain('## Keywords');
    expect(result).toContain('```json');
  });

  it('should include storeId when provided', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation, 'downtown-store-001');

    expect(result).toContain('**Store ID:** downtown-store-001');
  });

  it('should handle null keywords', () => {
    const result = formatKeywordsMarkdown(null);

    expect(result).toBe('No keyword data available.');
  });

  it('should include JSON code block', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation);

    expect(result).toContain('```json');
    expect(result).toContain('```');
  });
});

describe('formatApiError', () => {
  it('should format 404 error with guidance', () => {
    const error = new PinMeToApiError('Not found', 404, 'http_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: Resource not found');
    expect(result).toContain('verify the ID is correct');
  });

  it('should format 401 error', () => {
    const error = new PinMeToApiError('Unauthorized', 401, 'http_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: Authentication failed');
    expect(result).toContain('Verify your API credentials');
  });

  it('should format 403 error', () => {
    const error = new PinMeToApiError('Forbidden', 403, 'http_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: Permission denied');
    expect(result).toContain('Check your PINMETO_APP_ID and PINMETO_APP_SECRET');
  });

  it('should format 429 rate limit error', () => {
    const error = new PinMeToApiError('Too many requests', 429, 'http_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: Rate limit exceeded');
    expect(result).toContain('Please wait before making more requests');
  });

  it('should format timeout error', () => {
    const error = new PinMeToApiError('Timeout', undefined, 'timeout');
    const result = formatApiError(error);

    expect(result).toContain('Error: Request timed out');
    expect(result).toContain('PinMeTo API may be slow');
  });

  it('should format network error', () => {
    const error = new PinMeToApiError('Network error', undefined, 'network_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: Network error');
    expect(result).toContain('Unable to reach the PinMeTo API');
  });

  it('should include context when provided', () => {
    const error = new PinMeToApiError('Not found', 404, 'http_error');
    const result = formatApiError(error, 'for location downtown-store-001');

    expect(result).toContain('for location downtown-store-001');
  });

  it('should handle generic errors', () => {
    const error = new Error('Something went wrong');
    const result = formatApiError(error);

    expect(result).toContain('Error: Unexpected error occurred');
    expect(result).toContain('Something went wrong');
  });

  it('should handle non-PinMeToApiError with status code', () => {
    const error = new PinMeToApiError('Server error', 500, 'http_error');
    const result = formatApiError(error);

    expect(result).toContain('Error: API request failed with status 500');
  });
});

describe('handleToolResponse', () => {
  it('should handle successful JSON response', async () => {
    const data = { test: 'data' };
    const result = await handleToolResponse(
      async () => data,
      'json',
      {
        errorMessage: 'Failed to fetch data'
      }
    );

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('test');
    expect(result.content[0].text).toContain('data');
  });

  it('should handle successful markdown response', async () => {
    const data = mockLocation1;
    const result = await handleToolResponse(
      async () => data,
      'markdown',
      {
        errorMessage: 'Failed to fetch location',
        markdownFormatter: (d) => `# Location: ${d.name}`
      }
    );

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('# Location: Downtown Coffee Shop');
  });

  it('should handle errors and format them', async () => {
    const error = new PinMeToApiError('Not found', 404, 'http_error');
    const result = await handleToolResponse(
      async () => {
        throw error;
      },
      'json',
      {
        errorMessage: 'Failed to fetch data'
      }
    );

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain('Failed to fetch data');
    expect(result.content[0].text).toContain('Resource not found');
  });

  it('should use markdown formatter when format is markdown', async () => {
    const data = { storeId: 'test-001', name: 'Test Store' };
    const markdownFormatter = (d: any) => `**Store:** ${d.name} (${d.storeId})`;

    const result = await handleToolResponse(async () => data, 'markdown', {
      errorMessage: 'Error',
      markdownFormatter
    });

    expect(result.content[0].text).toBe('**Store:** Test Store (test-001)');
  });

  it('should fallback to JSON when markdown formatter not provided', async () => {
    const data = { test: 'data' };
    const result = await handleToolResponse(async () => data, 'markdown', {
      errorMessage: 'Error'
    });

    expect(result.content[0].text).toContain('"test"');
    expect(result.content[0].text).toContain('"data"');
  });

  it('should handle async data fetcher', async () => {
    const dataFetcher = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { async: 'data' };
    };

    const result = await handleToolResponse(dataFetcher, 'json', {
      errorMessage: 'Error'
    });

    expect(result.content[0].text).toContain('async');
    expect(result.content[0].text).toContain('data');
  });
});

describe('Helper functions - Integration', () => {
  it('should chain formatters correctly', () => {
    const data = [mockLocation1, mockLocation2];
    const listResponse = formatListResponse(data, true);
    const parsed = JSON.parse(listResponse);

    expect(parsed.count).toBe(2);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.has_more).toBe(false);
  });

  it('should handle large data truncation in list response', () => {
    const largeData = Array(1000)
      .fill(null)
      .map((_, i) => ({
        id: i,
        longText: 'Some very long text here'.repeat(100)
      }));

    const listResponse = formatListResponse(largeData, true);
    const [truncated, wasTruncated] = truncateResponse(JSON.parse(listResponse));

    expect(wasTruncated).toBe(true);
  });

  it('should format error then use in handleToolResponse', async () => {
    const error = new PinMeToApiError('Not found', 404, 'http_error');
    const formatted = formatApiError(error, 'for test');

    const result = await handleToolResponse(
      async () => {
        throw error;
      },
      'json',
      {
        errorMessage: 'Custom error message'
      }
    );

    expect(result.content[0].text).toContain('Custom error message');
    expect(result.content[0].text).toContain('Resource not found');
  });
});
