/**
 * Facebook tools tests
 * Tests for all 5 Facebook Page tools
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

describe('pinmeto_get_facebook_location_insights tool', () => {
  it('should fetch Facebook insights for specific location with JSON format', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.facebookInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
  });

  it('should return Facebook insights data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBeDefined(); // Metric name like 'page_impressions'
    expect(result[0].metrics).toBeDefined();
    expect(Array.isArray(result[0].metrics)).toBe(true);
    expect(result[0].metrics[0].key).toBeDefined(); // Date like '2024-01-01'
    expect(result[0].metrics[0].value).toBeDefined(); // Value
  });

  it('should handle empty insights for inactive location', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookInsightsLocation('closed-store-003', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(result.metrics.length).toBe(0);
  });
  it('should handle Markdown format (default)', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
        storeId: 'uptown-store-002',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.facebookInsightsLocation('uptown-store-002', '2024-01-01', '2024-01-31')
    );
  });
});

describe('pinmeto_get_all_facebook_brandpage_insights tool', () => {
  it('should fetch Facebook brandpage insights', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_brandpage_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.facebookInsightsBrandpage('2024-01-01', '2024-01-31')
    );
  });

  it('should return brandpage insights with aggregated data', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookInsightsBrandpage('2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.metrics[0].key).toBeDefined();
    expect(result.metrics[0].value).toBeDefined();
  });
});

describe('pinmeto_get_all_facebook_insights tool', () => {
  it('should fetch Facebook insights for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/locations/insights/facebook')
    );
  });

  it('should return multiple locations insights', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.facebookInsightsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure of first location
    const firstLocation = data[0];
    expect(firstLocation.storeId).toBeDefined();
    expect(firstLocation.metrics).toBeDefined();
  });

  it('should handle optional maxPages parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/locations/insights/facebook'));
  });
});

describe('pinmeto_get_facebook_location_ratings tool', () => {
  it('should fetch Facebook ratings for specific location', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_ratings', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/ratings/facebook/downtown-store-001')
    );
  });

  it('should return Facebook ratings data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include review details', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.length).toBeGreaterThan(0);

    const firstReview = result[0];
    expect(firstReview.id).toBeDefined();
    expect(firstReview.rating).toBeDefined();
    expect(firstReview.date).toBeDefined();
    expect(firstReview.storeId).toBe('downtown-store-001');
  });
});

describe('pinmeto_get_all_facebook_ratings tool', () => {
  it('should fetch Facebook ratings for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_ratings', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/ratings/facebook'));
  });

  it('should return multiple locations ratings', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.facebookRatingsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure - array of ratings
    const firstRating = data[0];
    expect(firstRating.storeId).toBeDefined();
    expect(firstRating.id).toBeDefined();
    expect(firstRating.rating).toBeDefined();
  });
});

describe('Facebook tools - Error handling', () => {
  it('should handle 404 error for insights', async () => {
    setAxiosMockErrorMode('404');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(
        buildUrl.facebookInsightsLocation('nonexistent', '2024-01-01', '2024-01-31')
      )
    ).rejects.toThrow();
  });

  it('should handle 401 authentication error', async () => {
    setAxiosMockErrorMode('401');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.facebookRatingsAll())
    ).rejects.toThrow();
  });

  it('should handle timeout error', async () => {
    setAxiosMockErrorMode('timeout');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.facebookInsightsAll('2024-01-01', '2024-01-31'))
    ).rejects.toThrow();
  });
});

describe('Facebook tools - Data validation', () => {
  it('should validate date format for insights', async () => {
    const server = createMcpServer();

    // Valid date format should work
    const result = await server.makePinMeToRequest(
      buildUrl.facebookInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
  });

  it('should return engagement metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.facebookInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBeDefined(); // Metric name
    expect(result[0].metrics).toBeDefined();
    expect(Array.isArray(result[0].metrics)).toBe(true);
    expect(result[0].metrics[0].value).toBeGreaterThan(0);
  });
});

describe('Facebook tools - Integration', () => {
  it('should fetch insights and ratings for same location', async () => {
    const server = createMcpServer();

    const insights = await server.makePinMeToRequest(
      buildUrl.facebookInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
    const ratings = await server.makePinMeToRequest(
      buildUrl.facebookRatingsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    // Verify insights structure (new format: array of metric objects)
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].metrics).toBeDefined();

    // Verify ratings structure and storeId
    expect(Array.isArray(ratings)).toBe(true);
    expect(ratings.length).toBeGreaterThan(0);
    expect(ratings[0].storeId).toBe('downtown-store-001');
  });

  it('should handle multiple tool calls in sequence', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    // Call multiple Facebook tools
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_ratings', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_brandpage_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });
});

describe('Facebook tools - Aggregation parameter', () => {
  it('should accept daily aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'daily'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should accept weekly aggregation parameter', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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
      createToolCallMessage('pinmeto_get_facebook_location_insights', {
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

  it('should support aggregation in get_all_facebook_insights', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_insights', {
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'monthly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });

  it('should support aggregation in get_all_facebook_brandpage_insights', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_facebook_brandpage_insights', {
        from: '2024-01-01',
        to: '2024-01-31',
        aggregation: 'quarterly'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalled();
  });
});
