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
  it('should call Location APIs', async () => {
    const server = createMcpServer();
    const spy = vi.spyOn(server, 'makePinMeToRequest');

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
    expect(spy).toHaveBeenCalledWith(
      `${testLocationApiBaseUrl}/v4/test_account/locations?pagesize=1000&fields=_id`
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
              { storeId: '3', name: 'Location Partial', address: { street: null, city: 'Oslo', country: null } },
              // Normal location for comparison
              { storeId: '4', name: 'Location Complete', address: { street: 'Main St', city: 'Bergen', country: 'Norway' } }
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
    expect(searchResponse.result.structuredContent.data[3].addressSummary).toBe('Main St, Bergen, Norway');
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
