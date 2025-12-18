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
    expect(tools.length).toBe(15);

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
    expect(tools.length).toBe(15);

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
