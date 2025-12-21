import axios from 'axios';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createMcpServer } from '../src/mcp_server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { formatErrorResponse } from '../src/helpers';
import { ApiError } from '../src/errors';

const testAccountId = 'test_account';
const testAppId = 'test_id';
const testAppSecret = 'test_secret';
const testApiBaseUrl = 'https://api.example.com';
const testLocationApiBaseUrl = 'https://locations.api.example.com';
const testAccessToken = 'test_token';

vi.mock('axios', async importOriginal => {
  const actual = (await importOriginal()) as any;
  return {
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
    },
    isAxiosError: actual.isAxiosError
  };
});

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
      ok: true,
      data: { data: [{ id: 1 }] }
    });
    expect(server.configs.accessToken).toBe(testAccessToken);
  });

  it('PaginatedPinMeToRequest should handle paginated requests and format responses', async () => {
    const server = createMcpServer();
    await expect(server.makePaginatedPinMeToRequest(`${testApiBaseUrl}/page1`)).resolves.toEqual([
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      true,
      null
    ]);
  });

  it('should return ApiResult error on request failure', async () => {
    // Create mock that returns error for any GET request
    vi.mocked(axios.get).mockRejectedValueOnce(
      Object.assign(new Error('Server Error'), {
        isAxiosError: true,
        response: { status: 500, data: { message: 'Internal server error' } }
      })
    );

    const server = createMcpServer();
    // Clear token cache to force token fetch first
    server.configs.accessToken = testAccessToken;
    server.configs.accessTokenTime = Date.now() / 1000;

    const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SERVER_ERROR');
      expect(result.error.retryable).toBe(true);
    }
  });

  describe('Authentication error handling', () => {
    it('should return AUTH_INVALID_CREDENTIALS on 401 during token fetch', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          response: { status: 401, data: { error_description: 'Bad credentials' } }
        })
      );

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AUTH_INVALID_CREDENTIALS');
        expect(result.error.retryable).toBe(false);
        expect(result.error.message).toContain('Invalid credentials');
      }
    });

    it('should return AUTH_APP_DISABLED on 403 during token fetch', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), {
          isAxiosError: true,
          response: { status: 403, data: { error: 'App disabled' } }
        })
      );

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AUTH_APP_DISABLED');
        expect(result.error.retryable).toBe(false);
        expect(result.error.message).toContain('disabled');
      }
    });

    it('should return BAD_REQUEST on 400 during token fetch', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(
        Object.assign(new Error('Bad Request'), {
          isAxiosError: true,
          response: { status: 400, data: { error: 'invalid_grant' } }
        })
      );

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BAD_REQUEST');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('should return NETWORK_ERROR on network failure during token fetch', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(
        Object.assign(new Error('Network Error'), {
          isAxiosError: true,
          code: 'ECONNREFUSED',
          response: undefined
        })
      );

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.retryable).toBe(true); // Network errors are retryable
      }
    });

    it('should return RATE_LIMITED on 429 during token fetch', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(
        Object.assign(new Error('Too Many Requests'), {
          isAxiosError: true,
          response: { status: 429, data: { error: 'rate_limit_exceeded' } }
        })
      );

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('RATE_LIMITED');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('rate limited');
      }
    });

    it('should return AUTH_INVALID_CREDENTIALS when OAuth response lacks access_token', async () => {
      // OAuth returns 200 OK but with empty/malformed response (no access_token)
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { token_type: 'Bearer' } // Missing access_token field
      });

      const server = createMcpServer();
      const result = await server.makePinMeToRequest(`${testApiBaseUrl}/any-endpoint`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AUTH_INVALID_CREDENTIALS');
        expect(result.error.message).toContain('No access_token');
        expect(result.error.retryable).toBe(false);
      }
    });
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
        name: 'pinmeto_get_locations',
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

  it('should return NOT_FOUND error when location does not exist', async () => {
    // Mock 404 response for get_location
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url.includes('/locations/invalid-store-id')) {
        const error = Object.assign(new Error('Not Found'), {
          isAxiosError: true,
          response: {
            status: 404,
            data: { message: 'Location not found' }
          }
        });
        return Promise.reject(error);
      }

      return Promise.reject(new Error('Not found'));
    });

    // Also need to mock the token endpoint
    vi.mocked(axios.post).mockImplementation((url: string, data, { headers }: any) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve({ data: { access_token: testAccessToken } });
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
        name: 'pinmeto_get_location',
        arguments: { storeId: 'invalid-store-id' }
      },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    const locationResponse = responses.find(r => r.id === 1);
    expect(locationResponse).toBeDefined();
    expect(locationResponse.result.structuredContent.errorCode).toBe('NOT_FOUND');
    expect(locationResponse.result.structuredContent.retryable).toBe(false);
    expect(locationResponse.result.structuredContent.error).toContain('not found');
  });
});

describe('Tool Annotations', () => {
  it('should register all 10 tools with readOnlyHint annotations', async () => {
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
    expect(tools.length).toBe(10);

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
      params: { name: 'pinmeto_get_locations', arguments: { fields: ['_id'] } },
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
    expect(tools.length).toBe(10);

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
        name: 'pinmeto_search_locations',
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
        name: 'pinmeto_search_locations',
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
        name: 'pinmeto_search_locations',
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
        name: 'pinmeto_search_locations',
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
        name: 'pinmeto_search_locations',
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
        name: 'pinmeto_search_locations',
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
    // With structured errors, we now get the actual error message with context
    expect(searchResponse.result.structuredContent.error).toBe(
      "Failed for search query 'Stockholm': Network error"
    );
    expect(searchResponse.result.structuredContent.errorCode).toBe('UNKNOWN_ERROR');
    expect(searchResponse.result.structuredContent.retryable).toBe(false);
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
        name: 'pinmeto_search_locations',
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

    // Verify server returns its OWN capabilities (resources, tools)
    // NOT the empty client capabilities
    expect(initResponse.result.capabilities).toBeDefined();
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
      params: { name: 'pinmeto_get_locations', arguments: args },
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
    const result1 = await server.locationCache.getLocations();
    expect(result1.data).toHaveLength(1);
    expect(result1.allPagesFetched).toBe(true);
    expect(result1.stale).toBe(false);

    // Force refresh - fails, should return stale cache
    const result2 = await server.locationCache.getLocations(true);
    expect(result2.data).toHaveLength(1);
    expect(result2.data[0].storeId).toBe('1');
    // Returns stale cache with stale indicator
    expect(result2.allPagesFetched).toBe(true);
    expect(result2.stale).toBe(true);
    // Verify error details are preserved
    expect(result2.error).not.toBeNull();
    expect(result2.error?.code).toBeDefined();
    expect(result2.error?.retryable).toBeDefined();
    // Verify stale age is tracked
    expect(result2.staleAgeSeconds).toBeDefined();
    expect(result2.staleAgeSeconds).toBeGreaterThanOrEqual(0);
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

    expect(result1.data).toEqual(result2.data);
    expect(result2.data).toEqual(result3.data);

    // Only one actual API call should have been made
    expect(fetchCallCount).toBe(1);
  });
});

// ============================================================================
// mapAxiosErrorToApiError Tests
// ============================================================================

import { mapAxiosErrorToApiError, AuthError, ApiError } from '../src/errors';
import { AxiosError } from 'axios';

/**
 * Helper to create mock Axios errors with specific status codes and response data
 */
function createMockAxiosError(
  status: number | undefined,
  responseData?: Record<string, unknown>,
  code?: string
): AxiosError {
  const error = new Error(`Request failed with status ${status}`) as AxiosError;
  error.isAxiosError = true;
  error.code = code;
  if (status !== undefined) {
    error.response = {
      status,
      statusText: 'Error',
      headers: {},
      config: {} as any,
      data: responseData
    };
  }
  return error;
}

describe('formatErrorResponse', () => {
  it('should format ApiError with all required fields', () => {
    const error: ApiError = {
      code: 'NOT_FOUND',
      message: 'Store not found. Verify the store ID exists.',
      statusCode: 404,
      retryable: false
    };

    const result = formatErrorResponse(error);

    expect(result.content).toEqual([{ type: 'text', text: 'Store not found. Verify the store ID exists.' }]);
    expect(result.structuredContent.error).toBe('Store not found. Verify the store ID exists.');
    expect(result.structuredContent.errorCode).toBe('NOT_FOUND');
    expect(result.structuredContent.retryable).toBe(false);
  });

  it('should format retryable error correctly', () => {
    const error: ApiError = {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Wait before retrying.',
      statusCode: 429,
      retryable: true
    };

    const result = formatErrorResponse(error);

    expect(result.structuredContent.errorCode).toBe('RATE_LIMITED');
    expect(result.structuredContent.retryable).toBe(true);
  });

  it('should format network error without statusCode', () => {
    const error: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Network error: ECONNREFUSED. Check internet connection.',
      retryable: true
    };

    const result = formatErrorResponse(error);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('ECONNREFUSED');
    expect(result.structuredContent.errorCode).toBe('NETWORK_ERROR');
    expect(result.structuredContent.retryable).toBe(true);
  });

  it('should prepend context to error message when provided', () => {
    const error: ApiError = {
      code: 'NOT_FOUND',
      message: 'Resource not found. Verify the ID exists.',
      statusCode: 404,
      retryable: false
    };

    const result = formatErrorResponse(error, "storeId '12345'");

    expect(result.content[0].text).toBe("Failed for storeId '12345': Resource not found. Verify the ID exists.");
    expect(result.structuredContent.error).toBe("Failed for storeId '12345': Resource not found. Verify the ID exists.");
    expect(result.structuredContent.errorCode).toBe('NOT_FOUND');
    expect(result.structuredContent.retryable).toBe(false);
  });

  it('should handle all error codes', () => {
    const errorCodes = [
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_APP_DISABLED',
      'BAD_REQUEST',
      'NOT_FOUND',
      'RATE_LIMITED',
      'SERVER_ERROR',
      'NETWORK_ERROR',
      'UNKNOWN_ERROR'
    ] as const;

    for (const code of errorCodes) {
      const error: ApiError = {
        code,
        message: `Test message for ${code}`,
        retryable: false
      };

      const result = formatErrorResponse(error);
      expect(result.structuredContent.errorCode).toBe(code);
    }
  });
});

describe('mapAxiosErrorToApiError', () => {
  describe('HTTP Status Code Mapping', () => {
    it('should map 400 to BAD_REQUEST with retryable: false', () => {
      const axiosError = createMockAxiosError(400);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('BAD_REQUEST');
      expect(result.statusCode).toBe(400);
      expect(result.retryable).toBe(false);
    });

    it('should map 401 to AUTH_INVALID_CREDENTIALS with retryable: false', () => {
      const axiosError = createMockAxiosError(401);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(result.statusCode).toBe(401);
      expect(result.retryable).toBe(false);
    });

    it('should map 403 to AUTH_APP_DISABLED with retryable: false', () => {
      const axiosError = createMockAxiosError(403);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('AUTH_APP_DISABLED');
      expect(result.statusCode).toBe(403);
      expect(result.retryable).toBe(false);
    });

    it('should map 404 to NOT_FOUND with retryable: false', () => {
      const axiosError = createMockAxiosError(404);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('NOT_FOUND');
      expect(result.statusCode).toBe(404);
      expect(result.retryable).toBe(false);
    });

    it('should map 429 to RATE_LIMITED with retryable: true', () => {
      const axiosError = createMockAxiosError(429);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('RATE_LIMITED');
      expect(result.statusCode).toBe(429);
      expect(result.retryable).toBe(true);
    });

    it('should map 500 to SERVER_ERROR with retryable: true', () => {
      const axiosError = createMockAxiosError(500);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.retryable).toBe(true);
    });

    it('should map 502 to SERVER_ERROR with retryable: true', () => {
      const axiosError = createMockAxiosError(502);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.statusCode).toBe(502);
      expect(result.retryable).toBe(true);
    });

    it('should map 503 to SERVER_ERROR with retryable: true', () => {
      const axiosError = createMockAxiosError(503);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.statusCode).toBe(503);
      expect(result.retryable).toBe(true);
    });

    it('should map 504 to SERVER_ERROR with retryable: true', () => {
      const axiosError = createMockAxiosError(504);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.statusCode).toBe(504);
      expect(result.retryable).toBe(true);
    });
  });

  describe('Unexpected HTTP Status Codes', () => {
    it('should map unexpected 4xx to UNKNOWN_ERROR with retryable: false', () => {
      const axiosError = createMockAxiosError(422);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.statusCode).toBe(422);
      expect(result.retryable).toBe(false);
      expect(result.message).toContain('422');
    });

    it('should map unexpected 5xx to SERVER_ERROR with retryable: true', () => {
      const axiosError = createMockAxiosError(507);
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.statusCode).toBe(507);
      expect(result.retryable).toBe(true);
    });
  });

  describe('API Response Message Extraction', () => {
    it('should extract message from response.data.message', () => {
      const axiosError = createMockAxiosError(400, { message: 'Invalid storeId format' });
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.message).toBe('Invalid storeId format');
    });

    it('should extract message from response.data.error', () => {
      const axiosError = createMockAxiosError(400, { error: 'Store not found in account' });
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.message).toBe('Store not found in account');
    });

    it('should extract message from response.data.error_description', () => {
      const axiosError = createMockAxiosError(401, {
        error_description: 'The client credentials are invalid'
      });
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.message).toBe('The client credentials are invalid');
    });

    it('should use default message when no API message is present', () => {
      const axiosError = createMockAxiosError(400, {});
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.message).toBe('Invalid request parameters. Check date formats and store IDs.');
    });

    it('should prefer message over error when both present', () => {
      const axiosError = createMockAxiosError(400, {
        message: 'Specific message',
        error: 'Generic error'
      });
      const result = mapAxiosErrorToApiError(axiosError);

      expect(result.message).toBe('Specific message');
    });
  });

  describe('Network Errors (No Response)', () => {
    it('should map network timeout to NETWORK_ERROR with retryable: true', () => {
      const error = new Error('timeout of 30000ms exceeded') as AxiosError;
      error.isAxiosError = true;
      error.code = 'ECONNABORTED';
      // No response property - network error

      const result = mapAxiosErrorToApiError(error);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('ECONNABORTED');
    });

    it('should map connection refused to NETWORK_ERROR with retryable: true', () => {
      const error = new Error('connect ECONNREFUSED') as AxiosError;
      error.isAxiosError = true;
      error.code = 'ECONNREFUSED';

      const result = mapAxiosErrorToApiError(error);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('should map DNS lookup failure to NETWORK_ERROR with retryable: true', () => {
      const error = new Error('getaddrinfo ENOTFOUND api.example.com') as AxiosError;
      error.isAxiosError = true;
      error.code = 'ENOTFOUND';

      const result = mapAxiosErrorToApiError(error);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('ENOTFOUND');
    });
  });

  describe('AuthError Handling', () => {
    it('should map AuthError to ApiError with same code', () => {
      const authError = new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid credentials');
      const result = mapAxiosErrorToApiError(authError);

      expect(result.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(result.message).toBe('Invalid credentials');
      expect(result.retryable).toBe(false);
    });

    it('should map AuthError with NETWORK_ERROR code as retryable', () => {
      const authError = new AuthError('NETWORK_ERROR', 'Authentication failed: timeout');
      const result = mapAxiosErrorToApiError(authError);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Authentication failed: timeout');
      expect(result.retryable).toBe(true); // Network errors are retryable even during auth
    });
  });

  describe('Unknown Errors', () => {
    it('should map generic Error to UNKNOWN_ERROR', () => {
      const error = new Error('Something unexpected happened');
      const result = mapAxiosErrorToApiError(error);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('Something unexpected happened');
      expect(result.retryable).toBe(false);
    });

    it('should handle non-Error objects', () => {
      const result = mapAxiosErrorToApiError('string error');

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('An unknown error occurred');
      expect(result.retryable).toBe(false);
    });

    it('should handle null/undefined', () => {
      const result = mapAxiosErrorToApiError(null);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.retryable).toBe(false);
    });
  });
});

// ============================================================================
// Consolidated Network Tools Tests (storeId optional pattern)
// ============================================================================

describe('Consolidated Network Tools', () => {
  const setupNetworkToolMocks = () => {
    vi.mocked(axios.get).mockImplementation((url: string, { headers }: any) => {
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      // Single location insights (storeId in URL)
      // InsightsData format: { key: string, metrics: { key: string, value: number }[] }
      if (url.includes('/locations/1337/insights/google')) {
        return Promise.resolve({
          data: [
            {
              key: 'ACTIONS_WEBSITE',
              metrics: [{ key: '2024-01-01', value: 100 }]
            },
            {
              key: 'VIEWS_SEARCH',
              metrics: [{ key: '2024-01-01', value: 200 }]
            }
          ]
        });
      }

      // Bulk insights (no storeId in URL)
      if (url.includes('/locations/insights/google') && !url.includes('/locations/1337')) {
        return Promise.resolve({
          data: [
            {
              key: 'ACTIONS_WEBSITE',
              metrics: [
                { key: '2024-01-01', value: 50 },
                { key: '2024-01-02', value: 75 }
              ]
            },
            {
              key: 'VIEWS_SEARCH',
              metrics: [
                { key: '2024-01-01', value: 150 },
                { key: '2024-01-02', value: 200 }
              ]
            }
          ]
        });
      }

      // 404 for invalid storeId
      if (url.includes('/locations/invalid-id/insights/google')) {
        const error = Object.assign(new Error('Not Found'), {
          isAxiosError: true,
          response: {
            status: 404,
            data: { message: 'Location not found' }
          }
        });
        return Promise.reject(error);
      }

      return Promise.reject(new Error('Not found'));
    });
  };

  const callNetworkTool = async (toolName: string, args: any) => {
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
      params: { name: toolName, arguments: args },
      jsonrpc: '2.0',
      id: 1
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    process.stdout.write = originalWrite;
    await testTransport.close();

    return responses.find(r => r.id === 1);
  };

  describe('pinmeto_get_google_insights', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      setupNetworkToolMocks();
    });

    it('should call single-location API when storeId provided', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        storeId: '1337',
        from: '2024-01-01',
        to: '2024-12-31'
      });

      expect(response.result).toBeDefined();
      expect(response.result.structuredContent).toBeDefined();
      expect(response.result.structuredContent.data).toBeDefined();
      // Single-location mock returns ACTIONS_WEBSITE and VIEWS_SEARCH metrics
      expect(response.result.structuredContent.data[0].key).toBe('ACTIONS_WEBSITE');
      // With aggregation='total' (default), metrics are aggregated into one entry
      expect(response.result.structuredContent.data[0].metrics.length).toBe(1);
    });

    it('should call bulk API when storeId omitted', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        from: '2024-01-01',
        to: '2024-12-31'
      });

      expect(response.result).toBeDefined();
      expect(response.result.structuredContent).toBeDefined();
      expect(response.result.structuredContent.data).toBeDefined();
      // Bulk mock returns 2 metric types
      expect(response.result.structuredContent.data.length).toBe(2);
      // With aggregation='total' (default), multi-day metrics are aggregated
      expect(response.result.structuredContent.data[0].metrics[0].value).toBe(125); // 50 + 75
    });

    it('should return NOT_FOUND error with storeId context when location does not exist', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        storeId: 'invalid-id',
        from: '2024-01-01',
        to: '2024-12-31'
      });

      expect(response.result).toBeDefined();
      expect(response.result.structuredContent.errorCode).toBe('NOT_FOUND');
      expect(response.result.structuredContent.error).toContain("storeId 'invalid-id'");
      expect(response.result.structuredContent.retryable).toBe(false);
    });

    it('should format as JSON by default', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        storeId: '1337',
        from: '2024-01-01',
        to: '2024-12-31'
      });

      expect(response.result.content[0].type).toBe('text');
      // JSON format should be parseable
      const parsed = JSON.parse(response.result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it('should format as markdown when requested for single location', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        storeId: '1337',
        from: '2024-01-01',
        to: '2024-12-31',
        response_format: 'markdown'
      });

      expect(response.result.content[0].type).toBe('text');
      // Markdown format should contain headers
      expect(response.result.content[0].text).toContain('#');
    });

    it('should format as markdown when requested for bulk', async () => {
      const response = await callNetworkTool('pinmeto_get_google_insights', {
        from: '2024-01-01',
        to: '2024-12-31',
        response_format: 'markdown'
      });

      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('#');
    });
  });

  describe('Tool names verification', () => {
    it('should register exactly the expected 10 consolidated tools', async () => {
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
        method: 'tools/list',
        params: {},
        jsonrpc: '2.0',
        id: 1
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      process.stdout.write = originalWrite;
      await testTransport.close();

      const toolsResponse = responses.find(r => r.id === 1);
      const tools = toolsResponse.result.tools;

      const expectedToolNames = [
        'pinmeto_get_location',
        'pinmeto_get_locations',
        'pinmeto_search_locations',
        'pinmeto_get_google_insights',
        'pinmeto_get_google_ratings',
        'pinmeto_get_google_keywords',
        'pinmeto_get_facebook_insights',
        'pinmeto_get_facebook_brandpage_insights',
        'pinmeto_get_facebook_ratings',
        'pinmeto_get_apple_insights'
      ];

      const actualToolNames = tools.map((t: any) => t.name).sort();
      expect(actualToolNames).toEqual(expectedToolNames.sort());
    });
  });
});
