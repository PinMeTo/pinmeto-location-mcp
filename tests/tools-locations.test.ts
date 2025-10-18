/**
 * Location tools tests
 * Tests for get_location and get_locations tools
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

describe('pinmeto_get_location tool', () => {
  it('should fetch single location by storeId with JSON format', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Call tool
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_location', {
        storeId: 'downtown-store-001',
        format: 'json'
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Verify correct URL was called
    expect(spy).toHaveBeenCalledWith(buildUrl.location('downtown-store-001'));

    // Verify axios was called
    expect(mockAxiosGet).toHaveBeenCalledWith(
      buildUrl.location('downtown-store-001'),
      expect.any(Object)
    );
  });

  it('should fetch single location with Markdown format (default)', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Call tool without format parameter (should default to markdown)
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_location', {
        storeId: 'uptown-store-002'
      })
    );

    await waitForAsync(100);
    await transport.close();

    expect(spy).toHaveBeenCalledWith(buildUrl.location('uptown-store-002'));
  });

  it('should return location data in correct format', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(buildUrl.location('downtown-store-001'));

    expect(result).toBeDefined();
    expect(result.storeId).toBe('downtown-store-001');
    expect(result.name).toBe('Downtown Coffee Shop');
    expect(result.permanentlyClosed).toBe(false);
    expect(result.address).toBeDefined();
    expect(result.contact).toBeDefined();
    expect(result.openHours).toBeDefined();
  });

  it('should handle nonexistent location with 404 error', async () => {
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.location('nonexistent-store-999'))
    ).rejects.toThrow();
  });

  it('should fetch closed location successfully', async () => {
    const server = createMcpServer();
    const result = await server.makePinMeToRequest(buildUrl.location('closed-store-003'));

    expect(result).toBeDefined();
    expect(result.storeId).toBe('closed-store-003');
    expect(result.permanentlyClosed).toBe(true);
  });

  it('should handle different storeIds correctly', async () => {
    const server = createMcpServer();

    const location1 = await server.makePinMeToRequest(buildUrl.location('downtown-store-001'));
    const location2 = await server.makePinMeToRequest(buildUrl.location('uptown-store-002'));

    expect(location1.storeId).toBe('downtown-store-001');
    expect(location2.storeId).toBe('uptown-store-002');
    expect(location1.name).not.toBe(location2.name);
  });
});

describe('pinmeto_get_locations tool', () => {
  it('should fetch all locations without field filtering', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Call tool
    transport.onmessage?.(createToolCallMessage('pinmeto_get_locations', {}));

    await waitForAsync(100);
    await transport.close();

    // Verify correct URL was called (pagesize=1000, no fields param)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/v4/test_account/locations?pagesize=1000'),
      undefined
    );
  });

  it('should fetch locations with specific fields', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Call tool with field filtering
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_locations', {
        fields: ['storeId', 'name', 'isActive']
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Verify correct URL was called with fields parameter
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('fields=storeId,name,isActive'),
      undefined
    );
  });

  it('should respect maxPages parameter', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Call tool with maxPages
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_locations', {
        maxPages: 2
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Verify maxPages was passed correctly
    expect(spy).toHaveBeenCalledWith(expect.any(String), 2);
  });

  it('should return all locations data', async () => {
    const server = createMcpServer();
    const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
      buildUrl.locations()
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(areAllPagesFetched).toBe(true);

    // Verify data structure
    const firstLocation = data[0];
    expect(firstLocation.storeId).toBeDefined();
    expect(firstLocation.name).toBeDefined();
  });

  it('should handle field filtering correctly', async () => {
    const server = createMcpServer();

    // Call with specific fields
    const url = buildUrl.locations() + '?pagesize=1000&fields=storeId,name,isActive';
    mockAxiosGet.mockImplementationOnce((url) => {
      if (url.includes('fields=storeId,name,isActive')) {
        return Promise.resolve({
          data: {
            data: [
              { storeId: 'store-1', name: 'Store 1', isActive: true },
              { storeId: 'store-2', name: 'Store 2', isActive: false }
            ],
            paging: {}
          }
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const [data] = await server.makePaginatedPinMeToRequest(url);

    expect(data).toBeDefined();
    expect(data.length).toBe(2);
    expect(data[0].storeId).toBeDefined();
    expect(data[0].name).toBeDefined();
    expect(data[0].isActive).toBeDefined();
  });

  it('should handle pagination with maxPages=1', async () => {
    const server = createMcpServer();
    const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
      buildUrl.locations({ pagesize: 2 }),
      1
    );

    expect(data.length).toBe(2); // Only first page
    expect(areAllPagesFetched).toBe(false); // More pages available
  });

  it('should fetch all pages when maxPages not specified', async () => {
    const server = createMcpServer();
    const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
      buildUrl.locations({ pagesize: 2 })
    );

    expect(data.length).toBe(3); // All locations across all pages
    expect(areAllPagesFetched).toBe(true);
  });

  it('should include both open and closed locations', async () => {
    const server = createMcpServer();
    const [data] = await server.makePaginatedPinMeToRequest(buildUrl.locations());

    const openLocations = data.filter((loc: any) => loc.permanentlyClosed === false);
    const closedLocations = data.filter((loc: any) => loc.permanentlyClosed === true);

    expect(openLocations.length).toBeGreaterThan(0);
    expect(closedLocations.length).toBeGreaterThan(0);
  });

  it('should return correct location count', async () => {
    const server = createMcpServer();
    const [data] = await server.makePaginatedPinMeToRequest(buildUrl.locations());

    expect(data.length).toBe(3); // Based on our mock data
  });

  it('should handle empty locations list', async () => {
    const server = createMcpServer();

    // Mock empty response
    mockAxiosGet.mockImplementationOnce(() => {
      return Promise.resolve({
        data: {
          data: [],
          paging: {}
        }
      });
    });

    const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
      buildUrl.locations()
    );

    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
    expect(areAllPagesFetched).toBe(true);
  });
});

describe('Location tools - Error handling', () => {
  it('should handle 404 error for get_location', async () => {
    setAxiosMockErrorMode('specific-location-404');
    const server = createMcpServer();

    await expect(
      server.makePinMeToRequest(buildUrl.location('nonexistent-store-999'))
    ).rejects.toThrow();
  });

  it('should handle 401 authentication error', async () => {
    setAxiosMockErrorMode('401');
    const server = createMcpServer();

    await expect(server.makePinMeToRequest(buildUrl.locations())).rejects.toThrow();
  });

  it('should handle 403 permission error', async () => {
    setAxiosMockErrorMode('403');
    const server = createMcpServer();

    await expect(server.makePinMeToRequest(buildUrl.locations())).rejects.toThrow();
  });

  it('should handle network timeout', async () => {
    setAxiosMockErrorMode('timeout');
    const server = createMcpServer();

    await expect(server.makePinMeToRequest(buildUrl.locations())).rejects.toThrow();
  });

  it('should handle network connectivity error', async () => {
    setAxiosMockErrorMode('network');
    const server = createMcpServer();

    await expect(server.makePinMeToRequest(buildUrl.locations())).rejects.toThrow();
  });
});

describe('Location tools - Integration', () => {
  it('should work with complete MCP protocol flow', async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Initialize
    transport.onmessage?.(createInitializeMessage());

    // Get all locations
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_locations', {
        fields: ['storeId', 'name']
      })
    );

    await waitForAsync(100);

    // Get specific location
    transport.onmessage?.(
      createToolCallMessage('pinmeto_get_location', {
        storeId: 'downtown-store-001'
      })
    );

    await waitForAsync(100);
    await transport.close();

    // Verify both calls were made
    expect(mockAxiosGet).toHaveBeenCalled();
  });
});
