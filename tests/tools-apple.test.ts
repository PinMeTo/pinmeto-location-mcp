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
    expect(result.storeId).toBe('downtown-store-001');
    expect(result.period).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.impressions).toBeDefined();
    expect(result.metrics.actions).toBeDefined();
    expect(result.metrics.views).toBeDefined();
    expect(result.metrics.engagement).toBeDefined();
  });

  it('should include device breakdown', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.deviceBreakdown).toBeDefined();
    expect(result.deviceBreakdown.iPhone).toBeDefined();
    expect(result.deviceBreakdown.iPad).toBeDefined();
    expect(result.deviceBreakdown.Mac).toBeDefined();
  });

  it('should include top interaction types', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.topInteractionTypes).toBeDefined();
    expect(Array.isArray(result.topInteractionTypes)).toBe(true);
    expect(result.topInteractionTypes.length).toBeGreaterThan(0);

    const firstInteraction = result.topInteractionTypes[0];
    expect(firstInteraction.type).toBeDefined();
    expect(firstInteraction.count).toBeDefined();
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
    expect(result.metrics.impressions.total).toBe(0);
    expect(result.deviceBreakdown.iPhone).toBe(0);
  });

  it('should return action metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.metrics.actions.directionsRequests).toBeDefined();
    expect(result.metrics.actions.phoneCallClicks).toBeDefined();
    expect(result.metrics.actions.websiteClicks).toBeDefined();
    expect(result.metrics.actions.total).toBeDefined();
  });
});

describe('pinmeto_get_all_apple_insights tool', () => {
  it('should fetch Apple insights for all locations', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');
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
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31'),
      undefined
    );
  });

  it('should return multiple locations insights', async () => {
    const server = createMcpServer();
    const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(areAllPagesFetched).toBe(true);

    // Verify structure of first location
    const firstLocation = data[0];
    expect(firstLocation.storeId).toBeDefined();
    expect(firstLocation.metrics).toBeDefined();
    expect(firstLocation.deviceBreakdown).toBeDefined();
  });

  it('should respect maxPages parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);
    transport.onmessage?.(createInitializeMessage());

    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_all_apple_insights', {
        from: '2024-01-01',
        to: '2024-01-31',
        maxPages: 1
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(expect.any(String), 1);
  });

  it('should include device breakdown for all locations', async () => {
    const server = createMcpServer();
    const [data] = await server.makePaginatedPinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    data.forEach((location: any) => {
      expect(location.deviceBreakdown).toBeDefined();
      expect(location.deviceBreakdown.iPhone).toBeDefined();
      expect(location.deviceBreakdown.iPad).toBeDefined();
      expect(location.deviceBreakdown.Mac).toBeDefined();
    });
  });

  it('should return valid insights data for each location', async () => {
    const server = createMcpServer();
    const [data] = await server.makePaginatedPinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    data.forEach((location: any) => {
      expect(location.storeId).toBeDefined();
      expect(location.period).toBeDefined();
      expect(location.period.from).toBe('2024-01-01');
      expect(location.period.to).toBe('2024-01-31');
      expect(location.metrics.impressions).toBeDefined();
      expect(location.metrics.actions).toBeDefined();
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
    expect(result.period.from).toBe('2024-01-01');
    expect(result.period.to).toBe('2024-01-31');
  });

  it('should return valid impression metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.metrics.impressions.total).toBeGreaterThan(0);
    expect(result.metrics.impressions.search).toBeDefined();
    expect(result.metrics.impressions.maps).toBeDefined();
    expect(
      result.metrics.impressions.search + result.metrics.impressions.maps
    ).toBe(result.metrics.impressions.total);
  });

  it('should return valid view metrics', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    expect(result.metrics.views).toBeDefined();
    expect(result.metrics.views.mapViews).toBeDefined();
    expect(result.metrics.views.locationCardViews).toBeDefined();
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

    expect(january.storeId).toBe('downtown-store-001');
    expect(february.storeId).toBe('downtown-store-001');
    expect(january.period.from).not.toBe(february.period.from);
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

describe('Apple tools - Device breakdown analysis', () => {
  it('should provide accurate device distribution', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(
      buildUrl.appleInsightsLocation('downtown-store-001', '2024-01-01', '2024-01-31')
    );

    const deviceTotal =
      result.deviceBreakdown.iPhone +
      result.deviceBreakdown.iPad +
      result.deviceBreakdown.Mac;

    expect(deviceTotal).toBeGreaterThan(0);
    expect(result.deviceBreakdown.iPhone).toBeGreaterThan(result.deviceBreakdown.iPad);
    expect(result.deviceBreakdown.iPhone).toBeGreaterThan(result.deviceBreakdown.Mac);
  });

  it('should include device breakdown in all locations insights', async () => {
    const server = createMcpServer();
    const [data] = await server.makePaginatedPinMeToRequest(
      buildUrl.appleInsightsAll('2024-01-01', '2024-01-31')
    );

    expect(data.length).toBeGreaterThan(0);

    data.forEach((location: any) => {
      const deviceTotal =
        location.deviceBreakdown.iPhone +
        location.deviceBreakdown.iPad +
        location.deviceBreakdown.Mac;

      expect(deviceTotal).toBeGreaterThanOrEqual(0);
    });
  });
});
