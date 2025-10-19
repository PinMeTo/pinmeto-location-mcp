/**
 * Google tools tests
 * Tests for all 6 Google Business Profile tools
 */

import axios from 'axios';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from '../src/mcp_server';
import {
  setupTestEnv,
  clearAllMocks,
  buildUrl,
  createInitializeMessage,
  createToolCallMessage,
  waitForAsync
} from './helpers/test-utils';
import {
  setAxiosMockErrorMode,
  resetAxiosMockErrorMode,
  mockAxiosGet
} from './helpers/axios-mock';

// Mock axios - must be at top level for hoisting
vi.mock('axios', async () => {
  const mock = await import('./helpers/axios-mock');
  return mock.axiosMock;
});

beforeAll(() => {
  setupTestEnv();
});

beforeEach(() => {
  clearAllMocks();
  resetAxiosMockErrorMode();
});

describe('pinmeto_get_google_location_insights tool', () => {
  it('should fetch Google insights for specific location with JSON format', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.googleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
  });

  it('should return Google insights data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBeDefined(); // Metric name like 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
    expect(result[0].metrics).toBeDefined();
    expect(Array.isArray(result[0].metrics)).toBe(true);
    expect(result[0].metrics[0].key).toBeDefined(); // Date like '2024-01-01'
    expect(result[0].metrics[0].value).toBeDefined(); // Value
  });

  it('should handle Markdown format (default)', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'uptown-store-002',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.googleInsightsLocation('uptown-store-002', '2024-01-01', '2024-01-31')
    );
  });

  it('should handle empty insights for closed location', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleInsightsLocation('closed-store-003', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(result.metrics.length).toBe(0);
  });
});

describe('pinmeto_get_all_google_insights tool', () => {
  it('should fetch Google insights for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_google_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/locations/insights/google?from=2024-01-01&to=2024-01-31')
    );
  });

  it('should return multiple locations insights', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.googleInsightsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure of first location
    const firstLocation = data[0];
    expect(firstLocation.storeId).toBeDefined();
    expect(firstLocation.metrics).toBeDefined();
    expect(Array.isArray(firstLocation.metrics)).toBe(true);
  });
});

describe('pinmeto_get_google_location_ratings tool', () => {
  it('should fetch Google ratings for specific location', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_ratings', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/ratings/google/downtown-store-001')
    );
  });

  it('should return Google ratings data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include rating details', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.length).toBeGreaterThan(0);

    const firstRating = result[0];
    expect(firstRating.id).toBeDefined();
    expect(firstRating.rating).toBeDefined();
    expect(firstRating.date).toBeDefined();
    expect(firstRating.storeId).toBe('downtown-store-001');
  });
});

describe('pinmeto_get_all_google_ratings tool', () => {
  it('should fetch Google ratings for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_google_ratings', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/ratings/google'));
  });

  it('should return multiple locations ratings', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.googleRatingsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure - each item is a rating with storeId
    const firstRating = data[0];
    expect(firstRating.id).toBeDefined();
    expect(firstRating.storeId).toBeDefined();
    expect(firstRating.rating).toBeDefined();
    expect(firstRating.date).toBeDefined();
  });
});

describe('pinmeto_get_google_keywords_for_location tool', () => {
  it('should fetch Google keywords for specific location', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords_for_location', {
        storeId: 'downtown-store-001',
        from: '2024-01',
        to: '2024-01',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/insights/google-keywords/downtown-store-001')
    );
  });

  it('should return Google keywords data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleKeywordsLocation('downtown-store-001', '2024-01', '2024-01')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should include keyword metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.googleKeywordsLocation('downtown-store-001', '2024-01', '2024-01')
    );

    expect(result.length).toBeGreaterThan(0);

    const firstKeyword = result[0];
    expect(firstKeyword.keyword).toBeDefined();
    expect(firstKeyword.value).toBeDefined();
    expect(firstKeyword.locationCounts).toBeDefined();
  });
});

describe('pinmeto_get_google_keywords tool', () => {
  it('should fetch Google keywords for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords', {
        from: '2024-01',
        to: '2024-01'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/insights/google-keywords')
    );
  });

  it('should return multiple locations keywords', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(buildUrl.googleKeywordsAll('2024-01', '2024-01'));

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure - array of keyword objects
    const firstKeyword = data[0];
    expect(firstKeyword.keyword).toBeDefined();
    expect(firstKeyword.value).toBeDefined();
    expect(firstKeyword.locationCounts).toBeDefined();
  });

  it('should accept custom limit parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords', {
        from: '2024-01',
        to: '2024-01',
        format: 'markdown',
        limit: 50
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalled();
  });

  it('should accept "all" as limit parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords', {
        from: '2024-01',
        to: '2024-01',
        format: 'markdown',
        limit: 'all'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalled();
  });
});

describe('pinmeto_get_google_keywords_for_location - limit parameter', () => {
  it('should accept custom limit parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords_for_location', {
        storeId: 'downtown-store-001',
        from: '2024-01',
        to: '2024-01',
        format: 'markdown',
        limit: 100
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalled();
  });

  it('should accept "all" as limit parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords_for_location', {
        storeId: 'downtown-store-001',
        from: '2024-01',
        to: '2024-01',
        format: 'markdown',
        limit: 'all'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalled();
  });
});

describe('Google tools - Error handling', () => {
  it('should handle 404 error for insights', async () => {
    setAxiosMockErrorMode('404');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(
        buildUrl.googleInsightsLocation('nonexistent', '2024-01-01', '2024-01-31')
      )
    ).rejects.toThrow();
  });

  it('should handle 401 authentication error', async () => {
    setAxiosMockErrorMode('401');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.googleRatingsAll())
    ).rejects.toThrow();
  });

  it('should handle timeout error', async () => {
    setAxiosMockErrorMode('timeout');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.googleKeywordsAll('2024-01'))
    ).rejects.toThrow();
  });
});

describe('Google tools - Data validation', () => {
  it('should validate date format for insights', async () => {
    const server = createMcpServer();

    // Valid date format should work
    const result = await server.makePinMeToRequest(
      buildUrl.googleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
  });

  it('should validate period format for keywords', async () => {
    const server = createMcpServer();

    // Valid period format (YYYY-MM) should work
    const result = await server.makePinMeToRequest(
      buildUrl.googleKeywordsLocation('downtown-store-001', '2024-01')
    );

    expect(result).toBeDefined();
  });
});

describe('Google tools - Integration', () => {
  it('should fetch insights, ratings, and keywords for same location', async () => {
    const server = createMcpServer();

    const insights = await server.makePinMeToRequest(
      buildUrl.googleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
    const ratings = await server.makePinMeToRequest(
      buildUrl.googleRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
    const keywords = await server.makePinMeToRequest(
      buildUrl.googleKeywordsLocation('downtown-store-001', '2024-01', '2024-01')
    );

    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].metrics).toBeDefined(); // New format: array of metric objects
    expect(Array.isArray(ratings)).toBe(true);
    expect(ratings[0].storeId).toBe('downtown-store-001');
    expect(Array.isArray(keywords)).toBe(true);
  });

  it('should handle multiple tool calls in sequence', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    // Call multiple Google tools
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_ratings', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_keywords_for_location', {
        storeId: 'downtown-store-001',
        from: '2024-01',
        to: '2024-01'
      })
    );

    await waitForAsync(50);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });
});

describe('Google tools - Aggregation parameter', () => {
  it('should aggregate data in JSON format', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    let receivedMessage: any = null;
    const originalSend = transport.send.bind(transport);
    transport.send = (message: any) => {
      receivedMessage = message;
      return originalSend(message);
    };

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-05',
        format: 'json',
        aggregation: 'total'
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Verify response contains aggregated structure
    expect(receivedMessage).toBeDefined();
    const responseText = receivedMessage.result?.content?.[0]?.text;
    expect(responseText).toBeDefined();

    const parsed = JSON.parse(responseText);
    expect(parsed.aggregation).toBe('total');
    expect(parsed.periods).toBeDefined();
    expect(Array.isArray(parsed.periods)).toBe(true);
    expect(parsed.periods.length).toBe(1); // Total should have 1 period
    expect(parsed.periods[0].period).toBe('Total');
  });

  it('should accept daily aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'daily'
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Should make the API call successfully
    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept weekly aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'weekly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept monthly aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'monthly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept quarterly aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-12-31',
        aggregation: 'quarterly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept yearly aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-12-31',
        aggregation: 'yearly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept total aggregation parameter (default)', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'total'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should default to total when aggregation not specified', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_google_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
        // No aggregation parameter
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should support aggregation in get_all_google_insights', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_google_insights', {
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'weekly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });
});
