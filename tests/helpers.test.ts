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
  handleToolResponse,
  aggregateInsightsData
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

  it('should show network integrations when available', () => {
    const result = formatLocationMarkdown(mockLocation1);

    // Should show which networks are integrated
    expect(result).toContain('**Status:** Active');
  });

  it('should format contact information', () => {
    const result = formatLocationMarkdown(mockLocation1);

    expect(result).toContain('📞');
    expect(result).toContain('✉️');
    expect(result).toContain('🌐');
  });
});

describe('formatInsightsMarkdown', () => {
  it('should format insights with platform name', () => {
    const result = formatInsightsMarkdown('Google', mockGoogleLocationInsights);

    expect(result).toContain('# Google Insights');
    // With real API format, should show aggregated markdown
    expect(result).toContain('**Period:**');
    expect(result).toContain('**Aggregation:**');
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

  it('should format insights data with aggregation', () => {
    const result = formatInsightsMarkdown('Google', mockGoogleLocationInsights);

    // Should include the aggregated insights data
    expect(result).toContain('Google Insights');
    expect(result).toContain('Impressions'); // Metric category
    expect(result).toContain('Desktop Maps'); // Metric name
  });
});

describe('formatRatingsMarkdown', () => {
  it('should format ratings with summary stats', () => {
    const result = formatRatingsMarkdown('Google', mockGoogleLocationRatings);

    expect(result).toContain('# Google Ratings');
    expect(result).toContain('## Summary');
    expect(result).toContain('## Rating Distribution');
    expect(result).toContain('Average Rating');
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
  it('should format keywords with summary stats', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation);

    expect(result).toContain('# Google Keywords');
    expect(result).toContain('## Summary');
    expect(result).toContain('## Top Keywords');
    expect(result).toContain('Total Keywords');
  });

  it('should include storeId when provided', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation, 'downtown-store-001');

    expect(result).toContain('**Store ID:** downtown-store-001');
  });

  it('should handle null keywords', () => {
    const result = formatKeywordsMarkdown(null);

    expect(result).toBe('No keyword data available.');
  });

  it('should show top keywords ranked by impressions', () => {
    const result = formatKeywordsMarkdown(mockGoogleKeywordsForLocation);

    // Should show ranked list of keywords
    expect(result).toMatch(/1\.\s+\*\*"[^"]+"\*\*/);
    expect(result).toContain('impressions');
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

describe('aggregateInsightsData', () => {
  // Mock metric data for testing aggregations
  const createMockMetrics = () => [
    {
      key: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      metrics: [
        { key: '2024-01-01', value: 100 },
        { key: '2024-01-02', value: 150 },
        { key: '2024-01-03', value: 120 },
        { key: '2024-01-08', value: 200 }, // Week 2
        { key: '2024-01-15', value: 180 }, // Week 3
        { key: '2024-02-01', value: 250 }, // February
        { key: '2024-04-01', value: 300 }, // Q2
        { key: '2025-01-01', value: 400 } // New year
      ]
    },
    {
      key: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      metrics: [
        { key: '2024-01-01', value: 50 },
        { key: '2024-01-02', value: 75 },
        { key: '2024-01-03', value: 60 },
        { key: '2024-01-08', value: 100 },
        { key: '2024-01-15', value: 90 },
        { key: '2024-02-01', value: 125 },
        { key: '2024-04-01', value: 150 },
        { key: '2025-01-01', value: 200 }
      ]
    }
  ];

  it('should aggregate by total (sum all metrics)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'total');

    expect(result.aggregation).toBe('total');
    expect(result.dateRange.from).toBe('2024-01-01');
    expect(result.dateRange.to).toBe('2025-01-01');
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].period).toBe('Total');

    // Verify totals: sum of all values
    const metrics = result.periods[0].metrics;
    expect(metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(1700); // 100+150+120+200+180+250+300+400
    expect(metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(850); // 50+75+60+100+90+125+150+200
  });

  it('should aggregate by daily (one period per day)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'daily');

    expect(result.aggregation).toBe('daily');
    expect(result.periods).toHaveLength(8); // 8 unique dates

    // Check first day
    const day1 = result.periods.find(p => p.period === '2024-01-01');
    expect(day1).toBeDefined();
    expect(day1!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(100);
    expect(day1!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(50);

    // Check another day
    const day2 = result.periods.find(p => p.period === '2024-01-02');
    expect(day2).toBeDefined();
    expect(day2!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(150);
    expect(day2!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(75);
  });

  it('should aggregate by weekly (group by week number)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'weekly');

    expect(result.aggregation).toBe('weekly');
    expect(result.periods.length).toBeGreaterThan(0);

    // Week 1 of 2024 should contain Jan 1-3
    const week1 = result.periods.find(p => p.period === '2024-W01');
    expect(week1).toBeDefined();
    expect(week1!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(370); // 100+150+120
    expect(week1!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(185); // 50+75+60

    // Should have multiple weeks
    const allWeeks = result.periods.filter(p => p.period.startsWith('2024-W'));
    expect(allWeeks.length).toBeGreaterThan(1);
  });

  it('should aggregate by monthly (group by month)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'monthly');

    expect(result.aggregation).toBe('monthly');

    // January 2024
    const jan = result.periods.find(p => p.period === '2024-01');
    expect(jan).toBeDefined();
    expect(jan!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(750); // 100+150+120+200+180
    expect(jan!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(375); // 50+75+60+100+90

    // February 2024
    const feb = result.periods.find(p => p.period === '2024-02');
    expect(feb).toBeDefined();
    expect(feb!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(250);
    expect(feb!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(125);

    // Should have at least 3 months (Jan, Feb, Apr 2024 + Jan 2025)
    expect(result.periods.length).toBeGreaterThanOrEqual(3);
  });

  it('should aggregate by quarterly (group by quarter)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'quarterly');

    expect(result.aggregation).toBe('quarterly');

    // Q1 2024 (Jan-Mar)
    const q1 = result.periods.find(p => p.period === '2024-Q1');
    expect(q1).toBeDefined();
    expect(q1!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(1000); // Jan+Feb: 750+250
    expect(q1!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(500); // Jan+Feb: 375+125

    // Q2 2024 (Apr-Jun)
    const q2 = result.periods.find(p => p.period === '2024-Q2');
    expect(q2).toBeDefined();
    expect(q2!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(300);
    expect(q2!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(150);

    // Q1 2025
    const q1_2025 = result.periods.find(p => p.period === '2025-Q1');
    expect(q1_2025).toBeDefined();
    expect(q1_2025!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(400);
  });

  it('should aggregate by yearly (group by year)', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data, 'yearly');

    expect(result.aggregation).toBe('yearly');
    expect(result.periods).toHaveLength(2); // 2024 and 2025

    // 2024
    const year2024 = result.periods.find(p => p.period === '2024');
    expect(year2024).toBeDefined();
    expect(year2024!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(1300); // All 2024 data
    expect(year2024!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(650);

    // 2025
    const year2025 = result.periods.find(p => p.period === '2025');
    expect(year2025).toBeDefined();
    expect(year2025!.metrics['BUSINESS_IMPRESSIONS_DESKTOP_MAPS']).toBe(400);
    expect(year2025!.metrics['BUSINESS_IMPRESSIONS_MOBILE_SEARCH']).toBe(200);
  });

  it('should handle empty data', () => {
    const result = aggregateInsightsData([], 'total');

    expect(result.aggregation).toBe('total');
    expect(result.dateRange.from).toBe('');
    expect(result.dateRange.to).toBe('');
    expect(result.periods).toHaveLength(0);
  });

  it('should handle single metric with single date', () => {
    const data = [
      {
        key: 'TEST_METRIC',
        metrics: [{ key: '2024-01-01', value: 100 }]
      }
    ];
    const result = aggregateInsightsData(data, 'total');

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].metrics['TEST_METRIC']).toBe(100);
    expect(result.dateRange.from).toBe('2024-01-01');
    expect(result.dateRange.to).toBe('2024-01-01');
  });

  it('should sort periods chronologically for daily aggregation', () => {
    const data = [
      {
        key: 'TEST_METRIC',
        metrics: [
          { key: '2024-01-05', value: 50 },
          { key: '2024-01-01', value: 10 },
          { key: '2024-01-03', value: 30 }
        ]
      }
    ];
    const result = aggregateInsightsData(data, 'daily');

    expect(result.periods).toHaveLength(3);
    expect(result.periods[0].period).toBe('2024-01-01');
    expect(result.periods[1].period).toBe('2024-01-03');
    expect(result.periods[2].period).toBe('2024-01-05');
  });

  it('should sort periods chronologically for monthly aggregation', () => {
    const data = [
      {
        key: 'TEST_METRIC',
        metrics: [
          { key: '2024-03-01', value: 30 },
          { key: '2024-01-01', value: 10 },
          { key: '2024-02-01', value: 20 }
        ]
      }
    ];
    const result = aggregateInsightsData(data, 'monthly');

    expect(result.periods).toHaveLength(3);
    expect(result.periods[0].period).toBe('2024-01');
    expect(result.periods[1].period).toBe('2024-02');
    expect(result.periods[2].period).toBe('2024-03');
  });

  it('should handle null or undefined data gracefully', () => {
    const result1 = aggregateInsightsData(null as any, 'total');
    const result2 = aggregateInsightsData(undefined as any, 'total');

    expect(result1.periods).toHaveLength(0);
    expect(result2.periods).toHaveLength(0);
  });

  it('should handle multiple metrics for the same period', () => {
    const data = [
      {
        key: 'METRIC_A',
        metrics: [{ key: '2024-01-01', value: 100 }]
      },
      {
        key: 'METRIC_B',
        metrics: [{ key: '2024-01-01', value: 200 }]
      },
      {
        key: 'METRIC_C',
        metrics: [{ key: '2024-01-01', value: 300 }]
      }
    ];
    const result = aggregateInsightsData(data, 'total');

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].metrics['METRIC_A']).toBe(100);
    expect(result.periods[0].metrics['METRIC_B']).toBe(200);
    expect(result.periods[0].metrics['METRIC_C']).toBe(300);
  });

  it('should default to total aggregation when not specified', () => {
    const data = createMockMetrics();
    const result = aggregateInsightsData(data);

    expect(result.aggregation).toBe('total');
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].period).toBe('Total');
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
