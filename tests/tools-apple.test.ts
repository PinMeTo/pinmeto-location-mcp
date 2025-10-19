/**
 * Apple tools tests
 * Tests for both Apple Maps tools
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

describe('pinmeto_get_apple_location_insights tool', () => {
  it('should fetch Apple insights for specific location with JSON format', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_apple_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
  });

  it('should return Apple insights data with correct structure', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBeDefined(); // Metric name like 'PLACECARD_VIEW'
    expect(result[0].metrics).toBeDefined();
    expect(Array.isArray(result[0].metrics)).toBe(true);
    expect(result[0].metrics[0].key).toBeDefined(); // Date like '2024-01-01'
    expect(result[0].metrics[0].value).toBeDefined(); // Value
  });

  it('should include multiple metric types', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(1); // Multiple metric types

    // Check for common Apple metrics
    const metricKeys = result.map((m: any) => m.key);
    expect(metricKeys).toContain('PLACECARD_VIEW');
  });

  it('should include action metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    const metricKeys = result.map((m: any) => m.key);
    // Should have direction or call metrics
    const hasActionMetrics = metricKeys.some((key: string) =>
      key.includes('TAP_DIRECTION') || key.includes('TAP_CALL') || key.includes('TAP_WEBSITE')
    );
    expect(hasActionMetrics).toBe(true);
  });

  it('should handle Markdown format (default)', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_apple_location_insights', {
        storeId: 'uptown-store-002',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.appleInsightsLocation('uptown-store-002', '2024-01-01', '2024-01-31')
    );
  });

  it('should handle empty insights for inactive location', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('closed-store-003', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Can be empty array or array with zero values
    if (result.length > 0) {
      const hasNonZeroValues = result.some((m: any) =>
        m.metrics.some((metric: any) => metric.value > 0)
      );
      // For inactive location, expect mostly zero values
      expect(hasNonZeroValues || result.length === 0).toBe(true);
    }
  });
});

describe('pinmeto_get_all_apple_insights tool', () => {
  it('should fetch Apple insights for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_apple_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );
  });

  it('should return multiple locations insights', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure matches single location format (array of metrics)
    const firstMetric = data[0];
    expect(firstMetric.key).toBeDefined(); // Metric name like 'PLACECARD_VIEW'
    expect(firstMetric.metrics).toBeDefined();
    expect(Array.isArray(firstMetric.metrics)).toBe(true);
  });

  it('should fetch all insights in one request (no pagination)', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_apple_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/insights/apple'));
  });

  it('should include metrics for all locations', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    // Each element should be a metric with key and metrics array
    expect(Array.isArray(data)).toBe(true);
    data.forEach((metric: any) => {
      expect(metric.key).toBeDefined();
      expect(metric.metrics).toBeDefined();
      expect(Array.isArray(metric.metrics)).toBe(true);
    });
  });

  it('should return valid insights data for each metric', async () => {
    const server = createMcpServer();
    const data = await server.makePinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    // Validate metric structure
    expect(Array.isArray(data)).toBe(true);
    data.forEach((metric: any) => {
      expect(metric.key).toBeDefined(); // Metric name
      expect(Array.isArray(metric.metrics)).toBe(true);
      if (metric.metrics.length > 0) {
        expect(metric.metrics[0].key).toBeDefined(); // Date
        expect(metric.metrics[0].value).toBeDefined(); // Value
      }
    });
  });
});

describe('Apple tools - Error handling', () => {
  it('should handle 404 error for insights', async () => {
    setAxiosMockErrorMode('404');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(
        buildUrl.appleInsightsLocation('nonexistent', '2024-01-01', '2024-01-31')
      )
    ).rejects.toThrow();
  });

  it('should handle 401 authentication error', async () => {
    setAxiosMockErrorMode('401');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.appleInsightsAll('2024-01-01', '2024-01-31'))
    ).rejects.toThrow();
  });

  it('should handle 403 permission error', async () => {
    setAxiosMockErrorMode('403');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(
        buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
      )
    ).rejects.toThrow();
  });

  it('should handle timeout error', async () => {
    setAxiosMockErrorMode('timeout');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.appleInsightsAll('2024-01-01', '2024-01-31'))
    ).rejects.toThrow();
  });

  it('should handle network error', async () => {
    setAxiosMockErrorMode('network');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(
        buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
      )
    ).rejects.toThrow();
  });
});

describe('Apple tools - Data validation', () => {
  it('should validate date format', async () => {
    const server = createMcpServer();

    // Valid date format should work
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Should have metrics with dates in the specified range
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].metrics[0].key).toMatch(/^2024-01/);
  });

  it('should return valid impression metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Check that metrics have values
    const hasMetrics = result.some((m: any) =>
      m.metrics.some((metric: any) => metric.value > 0)
    );
    expect(hasMetrics).toBe(true);
  });

  it('should return valid view metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(Array.isArray(result)).toBe(true);
    const metricKeys = result.map((m: any) => m.key);

    // Should have placecard view metrics
    const hasViewMetrics = metricKeys.some((key: string) =>
      key.includes('VIEW') || key.includes('PLACECARD')
    );
    expect(hasViewMetrics).toBe(true);
  });
});

describe('Apple tools - Integration', () => {
  it('should fetch insights for same location with different date ranges', async () => {
    const server = createMcpServer();

    const january = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );
    const february = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-02-01', '2024-02-29')
    );

    expect(Array.isArray(january)).toBe(true);
    expect(Array.isArray(february)).toBe(true);
    expect(january.length).toBeGreaterThan(0);
    expect(february.length).toBeGreaterThan(0);

    // Both should have metric data
    expect(january[0].key).toBeDefined();
    expect(february[0].key).toBeDefined();
  });

  it('should handle multiple tool calls in sequence', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    // Call location-specific insights
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_apple_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);

    // Call all locations insights
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_apple_insights', {
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);
    await transport.close();

    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it('should work with complete MCP protocol flow', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Get location details
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_location', {
        storeId: 'downtown-store-001'
      })
    );

    await waitForAsync(50);

    // Get Apple insights for that location
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_apple_location_insights', {
        storeId: 'downtown-store-001',
        from: '2024-01-01',
        to: '2024-01-31'
      })
    );

    await waitForAsync(50);
    await transport.close();

    // Verify both calls were made
    expect(mockAxiosGet).toHaveBeenCalled();
  });
});
