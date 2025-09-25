import axios from 'axios';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createMcpServer } from '../src/mcp_server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const testAccountId = 'test_account';
const testAppId = 'test_id';
const testAppSecret = 'test_secret';
const testApiBaseUrl = 'https://api.example.com';
const testAccessToken = 'test_token';

vi.mock('axios', () => ({
  default: {
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
      params: { name: 'get_locations', arguments: {} },
      jsonrpc: '2.0',
      id: 3
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    await testTransport.close();
    expect(spy).toHaveBeenCalledWith(
      `${testApiBaseUrl}/listings/v3/test_account/locations?pagesize=100`
    );
  });
});
