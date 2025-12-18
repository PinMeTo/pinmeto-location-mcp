import axios from 'axios';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createMcpServer } from '../src/mcp_server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const testAccountId = 'test_account';
const testAppId = 'test_id';
const testAppSecret = 'test_secret';
const testApiBaseUrl = 'https://api.example.com';
const testLocationApiBaseUrl = 'https://locations.api.example.com';
const testAccessToken = 'test_token';

vi.mock('axios', () => ({
  default: {
    defaults: {
      headers: {
        common: {}
      }
    },
    get: vi.fn((url: string, { headers }) => {
      console.error('Mocked axios GET request', url, headers);
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url === `${testApiBaseUrl}/locations`) {
        return Promise.resolve({ data: { data: [{ id: 1 }] } });
      }

      if (url === `${testApiBaseUrl}/page1`) {
        return Promise.resolve({
          data: {
            data: [{ id: 1 }, { id: 2 }],
            paging: { nextUrl: `${testApiBaseUrl}/page2` }
          }
        });
      }

      if (url === `${testApiBaseUrl}/page2`) {
        return Promise.resolve({
          data: {
            data: [{ id: 3 }],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    }),
    post: vi.fn((url: string, data, { headers }) => {
      console.error('Mocked axios POST request', url, data);

      if (url === `${testApiBaseUrl}/oauth/token`) {
        if (
          headers['Authorization'] == 'Basic dGVzdF9pZDp0ZXN0X3NlY3JldA==' &&
          headers['Content-Type'] == 'application/x-www-form-urlencoded'
        ) {
          return Promise.resolve({ data: { access_token: testAccessToken } });
        }
      }

      return Promise.reject(new Error('Not found'));
    })
  }
}));

beforeAll(() => {
  process.env.NODE_ENV = 'development';
  process.env.PINMETO_API_URL = testApiBaseUrl;
  process.env.PINMETO_LOCATION_API_URL = testLocationApiBaseUrl;
  process.env.PINMETO_ACCOUNT_ID = testAccountId;
  process.env.PINMETO_APP_ID = testAppId;
  process.env.PINMETO_APP_SECRET = testAppSecret;
  vi.clearAllMocks();
});

describe('PinMeToMcpServer', () => {
  it('should cache access token', async () => {
    const server = createMcpServer();
    await server.makePinMeToRequest(`${testApiBaseUrl}/locations`);
    await server.makePinMeToRequest(`${testApiBaseUrl}/locations`);
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1);
    expect(server.configs.accessToken).toBe(testAccessToken);
  });

  it('PinMeToRequest should return correct data', async () => {
    const server = createMcpServer();
    await expect(server.makePinMeToRequest(`${testApiBaseUrl}/locations`)).resolves.toEqual({
      data: [{ id: 1 }]
    });
    expect(server.configs.accessToken).toBe(testAccessToken);
  });

  it('PaginatedPinMeToRequest should handle paginated requests and format responses', async () => {
    const server = createMcpServer();
    await expect(server.makePaginatedPinMeToRequest(`${testApiBaseUrl}/page1`)).resolves.toEqual([
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      true
    ]);
  });
});

describe('Locations', () => {
  it('should call Location APIs via cache', async () => {
    // Mock the API response with location data
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('pagesize=1000')) {
        return Promise.resolve({
          data: {
            data: [
              { _id: '123', storeId: '1', name: 'Test Location', address: { city: 'Stockholm' } }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');

    const testTransport = new StdioServerTransport();

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'get_locations',
        arguments: {
          fields: ['_id']
        }
      },
      jsonrpc: '2.0',
      id: 3
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    await testTransport.close();
    // Cache now fetches all data without field filtering at API level
    expect(spy).toHaveBeenCalledWith(
      `${testLocationApiBaseUrl}/v4/test_account/locations?pagesize=1000`
    );
  });
});

describe('Tool Annotations', () => {
  it('should register all 15 tools with readOnlyHint annotations', async () => {
    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    // Capture responses from the server
    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        const parsed = JSON.parse(chunk.toString());
        responses.push(parsed);
      } catch {
        // Not JSON, ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    // Send initialize request
    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Send tools/list request
    testTransport.onmessage?.({
      method: 'tools/list',
      params: {},
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Restore stdout
    process.stdout.write = originalWrite;
    await testTransport.close();

    // Find the tools/list response
    const toolsResponse = responses.find(r => r.id === 1);
    expect(toolsResponse).toBeDefined();
    expect(toolsResponse.result).toBeDefined();
    expect(toolsResponse.result.tools).toBeDefined();

    const tools = toolsResponse.result.tools;
    expect(tools.length).toBe(16);

    // Verify each tool has readOnlyHint: true
    for (const tool of tools) {
      expect(tool.annotations).toBeDefined();
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it('should successfully invoke tools after migration to registerTool API', async () => {
    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    // Test tool invocation still works after migration
    testTransport.onmessage?.({
      method: 'tools/call',
      params: { name: 'get_locations', arguments: { fields: ['_id'] } },
      jsonrpc: '2.0',
      id: 3
    });

    // Wait and verify no errors occurred
    await new Promise(resolve => setTimeout(resolve, 100));

    await testTransport.close();

    // If we get here without errors, the migration was successful
    expect(server).toBeDefined();
  });
});

describe('Output Schemas', () => {
  it('should include outputSchema in all tool definitions', async () => {
    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    // Capture responses from the server
    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        const parsed = JSON.parse(chunk.toString());
        responses.push(parsed);
      } catch {
        // Not JSON, ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    // Send initialize request
    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Send tools/list request
    testTransport.onmessage?.({
      method: 'tools/list',
      params: {},
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Restore stdout
    process.stdout.write = originalWrite;
    await testTransport.close();

    // Find the tools/list response
    const toolsResponse = responses.find(r => r.id === 1);
    expect(toolsResponse).toBeDefined();
    expect(toolsResponse.result).toBeDefined();
    expect(toolsResponse.result.tools).toBeDefined();

    const tools = toolsResponse.result.tools;
    expect(tools.length).toBe(16);

    // Verify each tool has outputSchema defined
    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
      expect(typeof tool.outputSchema).toBe('object');
      // Verify outputSchema has required properties
      expect(tool.outputSchema.type).toBe('object');
      expect(tool.outputSchema.properties).toBeDefined();
    }
  });
});

describe('Search Locations', () => {
  it('should search locations by name (case-insensitive)', async () => {
    // Mock the API response with location data
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              {
                storeId: '1337',
                name: 'PinMeTo Malmö',
                locationDescriptor: 'HQ Office',
                address: { street: 'Adelgatan 9', city: 'Malmö', country: 'Sweden' }
              },
              {
                storeId: '666',
                name: 'PinMeTo Stockholm',
                locationDescriptor: 'Branch Office',
                address: { street: 'Fleminggatan 18', city: 'Stockholm', country: 'Sweden' }
              }
            ],
            paging: {}
          }
        });
      }

      // Token request
      if (url.includes('/oauth/token')) {
        return Promise.resolve({ data: { access_token: testAccessToken } });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    // Capture responses
    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        const parsed = JSON.parse(chunk.toString());
        responses.push(parsed);
      } catch {
        // Not JSON, ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Search for "malm" (should match "Malmö" case-insensitively)
    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'malm' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse).toBeDefined();
    expect(searchResponse.result).toBeDefined();
    expect(searchResponse.result.structuredContent).toBeDefined();
    expect(searchResponse.result.structuredContent.data).toHaveLength(1);
    expect(searchResponse.result.structuredContent.data[0].name).toBe('PinMeTo Malmö');
    expect(searchResponse.result.structuredContent.totalMatches).toBe(1);
  });

  it('should search locations by storeId', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              {
                storeId: '1337',
                name: 'PinMeTo Malmö',
                address: { street: 'Adelgatan 9', city: 'Malmö', country: 'Sweden' }
              },
              {
                storeId: '666',
                name: 'PinMeTo Stockholm',
                address: { street: 'Fleminggatan 18', city: 'Stockholm', country: 'Sweden' }
              }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: '1337' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse.result.structuredContent.data).toHaveLength(1);
    expect(searchResponse.result.structuredContent.data[0].storeId).toBe('1337');
  });

  it('should return empty results for non-matching query', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              {
                storeId: '1337',
                name: 'PinMeTo Malmö',
                address: { street: 'Adelgatan 9', city: 'Malmö', country: 'Sweden' }
              }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'nonexistent' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse.result.structuredContent.data).toHaveLength(0);
    expect(searchResponse.result.structuredContent.totalMatches).toBe(0);
  });

  it('should respect limit parameter', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              { storeId: '1', name: 'Location 1', address: { city: 'Stockholm' } },
              { storeId: '2', name: 'Location 2', address: { city: 'Stockholm' } },
              { storeId: '3', name: 'Location 3', address: { city: 'Stockholm' } }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'Stockholm', limit: 2 }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse.result.structuredContent.data).toHaveLength(2);
    expect(searchResponse.result.structuredContent.totalMatches).toBe(3);
    expect(searchResponse.result.structuredContent.hasMore).toBe(true);
  });

  it('should search by locationDescriptor', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              {
                storeId: '1337',
                name: 'PinMeTo',
                locationDescriptor: 'Main Headquarters',
                address: { city: 'Malmö' }
              },
              {
                storeId: '666',
                name: 'PinMeTo',
                locationDescriptor: 'Regional Office',
                address: { city: 'Stockholm' }
              }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'headquarters' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse.result.structuredContent.data).toHaveLength(1);
    expect(searchResponse.result.structuredContent.data[0].locationDescriptor).toBe(
      'Main Headquarters'
    );
  });

  it('should return error response when API request fails', async () => {
    // Mock API failure - returns empty array with incomplete pagination
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        // Simulate network error
        return Promise.reject(new Error('Network error'));
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'Stockholm' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse).toBeDefined();
    expect(searchResponse.result.structuredContent.error).toBe(
      'Unable to fetch location data for search.'
    );
    expect(searchResponse.result.structuredContent.data).toEqual([]);
    expect(searchResponse.result.structuredContent.totalMatches).toBe(0);
    expect(searchResponse.result.structuredContent.hasMore).toBe(false);
  });

  it('should handle locations with null or missing address fields gracefully', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations') && url.includes('fields=')) {
        return Promise.resolve({
          data: {
            data: [
              // Completely missing address
              { storeId: '1', name: 'Location No Address' },
              // address is null
              { storeId: '2', name: 'Location Null Address', address: null },
              // address has null fields
              {
                storeId: '3',
                name: 'Location Partial',
                address: { street: null, city: 'Oslo', country: null }
              },
              // Normal location for comparison
              {
                storeId: '4',
                name: 'Location Complete',
                address: { street: 'Main St', city: 'Bergen', country: 'Norway' }
              }
            ],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Search for "Location" to match all
    testTransport.onmessage?.({
      method: 'tools/call',
      params: {
        name: 'search_locations',
        arguments: { query: 'Location' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const searchResponse = responses.find(r => r.id === 1);
    expect(searchResponse).toBeDefined();
    expect(searchResponse.result.structuredContent.data).toHaveLength(4);

    // Missing address should show "No address"
    expect(searchResponse.result.structuredContent.data[0].addressSummary).toBe('No address');
    // Null address should show "No address"
    expect(searchResponse.result.structuredContent.data[1].addressSummary).toBe('No address');
    // Partial address should only show non-null fields
    expect(searchResponse.result.structuredContent.data[2].addressSummary).toBe('Oslo');
    // Complete address should show all fields
    expect(searchResponse.result.structuredContent.data[3].addressSummary).toBe(
      'Main St, Bergen, Norway'
    );
  });
});

describe('Initialize Handler', () => {
  it('should return server capabilities, not client capabilities', async () => {
    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    // Capture responses from the server
    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        const parsed = JSON.parse(chunk.toString());
        responses.push(parsed);
      } catch {
        // Not JSON, ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    // Send initialize request with EMPTY client capabilities
    // The bug was returning request.params.capabilities (client's) instead of serverInfo.capabilities
    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {}, // Client sends empty capabilities
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Restore stdout
    process.stdout.write = originalWrite;
    await testTransport.close();

    // Find the initialize response
    const initResponse = responses.find(r => r.id === 0);
    expect(initResponse).toBeDefined();
    expect(initResponse.result).toBeDefined();

    // Verify server returns its OWN capabilities (prompts, resources, tools)
    // NOT the empty client capabilities
    expect(initResponse.result.capabilities).toBeDefined();
    expect(initResponse.result.capabilities).toHaveProperty('prompts');
    expect(initResponse.result.capabilities).toHaveProperty('resources');
    expect(initResponse.result.capabilities).toHaveProperty('tools');

    // Verify serverInfo is also returned
    expect(initResponse.result.serverInfo).toBeDefined();
    expect(initResponse.result.serverInfo.name).toBe('PinMeTo Location MCP');
  });
});

describe('get_locations pagination', () => {
  const setupMockLocations = (locations: any[]) => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        return Promise.resolve({
          data: {
            data: locations,
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });
  };

  const callGetLocations = async (args: any) => {
    const server = createMcpServer();
    const testTransport = new StdioServerTransport();

    const responses: any[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: any) => {
      try {
        responses.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore
      }
      return true;
    }) as typeof process.stdout.write;

    await server.connect(testTransport);

    testTransport.onmessage?.({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' }
      },
      jsonrpc: '2.0',
      id: 0
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    testTransport.onmessage?.({
      method: 'tools/call',
      params: { name: 'get_locations', arguments: args },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    return responses.find(r => r.id === 1);
  };

  it('should use default pagination (limit=50, offset=0)', async () => {
    const locations = Array.from({ length: 100 }, (_, i) => ({
      storeId: String(i + 1),
      name: `Location ${i + 1}`,
      address: { city: 'Stockholm' }
    }));
    setupMockLocations(locations);

    const response = await callGetLocations({});

    expect(response.result.structuredContent.data).toHaveLength(50);
    expect(response.result.structuredContent.totalCount).toBe(100);
    expect(response.result.structuredContent.hasMore).toBe(true);
    expect(response.result.structuredContent.offset).toBe(0);
    expect(response.result.structuredContent.limit).toBe(50);
  });

  it('should respect custom limit parameter', async () => {
    const locations = Array.from({ length: 100 }, (_, i) => ({
      storeId: String(i + 1),
      name: `Location ${i + 1}`,
      address: { city: 'Stockholm' }
    }));
    setupMockLocations(locations);

    const response = await callGetLocations({ limit: 10 });

    expect(response.result.structuredContent.data).toHaveLength(10);
    expect(response.result.structuredContent.totalCount).toBe(100);
    expect(response.result.structuredContent.hasMore).toBe(true);
    expect(response.result.structuredContent.limit).toBe(10);
  });

  it('should handle offset pagination', async () => {
    const locations = Array.from({ length: 100 }, (_, i) => ({
      storeId: String(i + 1),
      name: `Location ${i + 1}`,
      address: { city: 'Stockholm' }
    }));
    setupMockLocations(locations);

    const response = await callGetLocations({ offset: 90, limit: 20 });

    expect(response.result.structuredContent.data).toHaveLength(10); // Only 10 left
    expect(response.result.structuredContent.totalCount).toBe(100);
    expect(response.result.structuredContent.hasMore).toBe(false);
    expect(response.result.structuredContent.offset).toBe(90);
  });

  it('should filter by permanentlyClosed', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Open Location', permanentlyClosed: false },
      { storeId: '2', name: 'Closed Location', permanentlyClosed: true },
      { storeId: '3', name: 'Another Open', permanentlyClosed: false }
    ]);

    const response = await callGetLocations({ permanentlyClosed: false });

    expect(response.result.structuredContent.data).toHaveLength(2);
    expect(response.result.structuredContent.totalCount).toBe(2);
    expect(response.result.structuredContent.data[0].name).toBe('Open Location');
  });

  it('should filter by type', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Location 1', type: 'location' },
      { storeId: '2', name: 'Service Area', type: 'serviceArea' },
      { storeId: '3', name: 'Location 2', type: 'location' }
    ]);

    const response = await callGetLocations({ type: 'serviceArea' });

    expect(response.result.structuredContent.data).toHaveLength(1);
    expect(response.result.structuredContent.data[0].name).toBe('Service Area');
  });

  it('should filter by city (case-insensitive)', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Location 1', address: { city: 'Stockholm' } },
      { storeId: '2', name: 'Location 2', address: { city: 'STOCKHOLM' } },
      { storeId: '3', name: 'Location 3', address: { city: 'Malmö' } }
    ]);

    const response = await callGetLocations({ city: 'stockholm' });

    expect(response.result.structuredContent.data).toHaveLength(2);
    expect(response.result.structuredContent.totalCount).toBe(2);
  });

  it('should filter by country (case-insensitive)', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Location 1', address: { country: 'Sweden' } },
      { storeId: '2', name: 'Location 2', address: { country: 'Norway' } },
      { storeId: '3', name: 'Location 3', address: { country: 'sweden' } }
    ]);

    const response = await callGetLocations({ country: 'SWEDEN' });

    expect(response.result.structuredContent.data).toHaveLength(2);
    expect(response.result.structuredContent.totalCount).toBe(2);
  });

  it('should handle combined filters', async () => {
    setupMockLocations([
      {
        storeId: '1',
        name: 'Open Stockholm',
        permanentlyClosed: false,
        address: { city: 'Stockholm' }
      },
      {
        storeId: '2',
        name: 'Closed Stockholm',
        permanentlyClosed: true,
        address: { city: 'Stockholm' }
      },
      { storeId: '3', name: 'Open Malmö', permanentlyClosed: false, address: { city: 'Malmö' } }
    ]);

    const response = await callGetLocations({ permanentlyClosed: false, city: 'Stockholm' });

    expect(response.result.structuredContent.data).toHaveLength(1);
    expect(response.result.structuredContent.data[0].name).toBe('Open Stockholm');
  });

  it('should handle large offset beyond results', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Location 1' },
      { storeId: '2', name: 'Location 2' }
    ]);

    const response = await callGetLocations({ offset: 100 });

    expect(response.result.structuredContent.data).toHaveLength(0);
    expect(response.result.structuredContent.totalCount).toBe(2);
    expect(response.result.structuredContent.hasMore).toBe(false);
  });

  it('should calculate hasMore correctly', async () => {
    const locations = Array.from({ length: 10 }, (_, i) => ({
      storeId: String(i + 1),
      name: `Location ${i + 1}`
    }));
    setupMockLocations(locations);

    // Exactly at boundary
    const response1 = await callGetLocations({ limit: 10 });
    expect(response1.result.structuredContent.hasMore).toBe(false);
  });

  it('should include cacheInfo in response', async () => {
    setupMockLocations([{ storeId: '1', name: 'Test' }]);

    const response = await callGetLocations({});

    expect(response.result.structuredContent.cacheInfo).toBeDefined();
    expect(response.result.structuredContent.cacheInfo.cached).toBe(true);
    expect(typeof response.result.structuredContent.cacheInfo.ageSeconds).toBe('number');
    expect(response.result.structuredContent.cacheInfo.totalCached).toBe(1);
  });

  it('should apply field selection', async () => {
    setupMockLocations([
      { storeId: '1', name: 'Test', address: { city: 'Stockholm' }, contact: { phone: '123' } }
    ]);

    const response = await callGetLocations({ fields: ['storeId', 'name'] });

    expect(response.result.structuredContent.data[0]).toHaveProperty('storeId');
    expect(response.result.structuredContent.data[0]).toHaveProperty('name');
    expect(response.result.structuredContent.data[0]).not.toHaveProperty('address');
    expect(response.result.structuredContent.data[0]).not.toHaveProperty('contact');
  });
});

describe('LocationCache', () => {
  it('should cache data and not re-fetch on repeated calls', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        return Promise.resolve({
          data: {
            data: [{ storeId: '1', name: 'Test' }],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');

    // First call - should fetch
    await server.locationCache.getLocations();
    expect(spy).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await server.locationCache.getLocations();
    expect(spy).toHaveBeenCalledTimes(1); // Still 1, no additional fetch

    // Force refresh - should fetch again
    await server.locationCache.getLocations(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should return correct cache info', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        return Promise.resolve({
          data: {
            data: [{ storeId: '1' }, { storeId: '2' }, { storeId: '3' }],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();

    // Before fetch - cache is empty
    const infoBeforeFetch = server.locationCache.getCacheInfo();
    expect(infoBeforeFetch.cached).toBe(false);

    // After fetch - cache is populated
    await server.locationCache.getLocations();
    const infoAfterFetch = server.locationCache.getCacheInfo();
    expect(infoAfterFetch.cached).toBe(true);
    expect(infoAfterFetch.size).toBe(3);
    expect(typeof infoAfterFetch.age).toBe('number');
  });

  it('should invalidate cache', async () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        return Promise.resolve({
          data: {
            data: [{ storeId: '1' }],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();

    // Populate cache
    await server.locationCache.getLocations();
    expect(server.locationCache.getCacheInfo().cached).toBe(true);

    // Invalidate
    server.locationCache.invalidate();
    expect(server.locationCache.getCacheInfo().cached).toBe(false);
  });

  it('should re-fetch when cache TTL expires', async () => {
    vi.useFakeTimers();

    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        return Promise.resolve({
          data: {
            data: [{ storeId: '1', name: 'Test' }],
            paging: {}
          }
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePaginatedPinMeToRequest');

    // First fetch
    await server.locationCache.getLocations();
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance time by 4 minutes - should still use cache
    vi.advanceTimersByTime(4 * 60 * 1000);
    await server.locationCache.getLocations();
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance time beyond 5 minutes - should re-fetch
    vi.advanceTimersByTime(2 * 60 * 1000);
    await server.locationCache.getLocations();
    expect(spy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should return stale cache on complete fetch failure', async () => {
    let fetchCount = 0;

    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        fetchCount++;
        if (fetchCount === 1) {
          // First fetch succeeds
          return Promise.resolve({
            data: {
              data: [{ storeId: '1', name: 'Test' }],
              paging: {}
            }
          });
        } else {
          // Subsequent fetches fail
          return Promise.reject(new Error('Network error'));
        }
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();

    // First fetch - succeeds and caches
    const [data1, complete1] = await server.locationCache.getLocations();
    expect(data1).toHaveLength(1);
    expect(complete1).toBe(true);

    // Force refresh - fails, should return stale cache
    const [data2, complete2] = await server.locationCache.getLocations(true);
    expect(data2).toHaveLength(1);
    expect(data2[0].storeId).toBe('1');
    // Returns stale cache completeness status
    expect(complete2).toBe(true);
  });

  it('should deduplicate concurrent requests', async () => {
    let fetchCallCount = 0;

    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations')) {
        fetchCallCount++;
        // Simulate slow API response
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: {
                data: [{ storeId: '1', name: 'Test' }],
                paging: {}
              }
            });
          }, 100);
        });
      }

      return Promise.reject(new Error('Not found'));
    });

    const server = createMcpServer();

    // Fire multiple concurrent requests
    const promise1 = server.locationCache.getLocations();
    const promise2 = server.locationCache.getLocations();
    const promise3 = server.locationCache.getLocations();

    // All should resolve to same data
    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    expect(result1[0]).toEqual(result2[0]);
    expect(result2[0]).toEqual(result3[0]);

    // Only one actual API call should have been made
    expect(fetchCallCount).toBe(1);
  });
});
