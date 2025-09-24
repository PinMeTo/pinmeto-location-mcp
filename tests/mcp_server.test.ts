import axios from 'axios';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { PinMeToMcpServer, createMcpServer } from '../src/mcp_server';

const testAccountId = 'test_account';
const testAppId = 'test_id';
const testAppSecret = 'test_secret';
const testApiBaseUrl = 'https://api.example.com';
const testAccessToken = 'test_token';

vi.mock('axios', () => ({
  default: {
    get: vi.fn((url: string, { headers }) => {
      console.log('Mocked axios GET request', url, headers);
      if (headers['Authorization'] !== `Bearer ${testAccessToken}`) {
        return Promise.reject(new Error('Unauthorized'));
      }

      if (url === `${testApiBaseUrl}/locations`) {
        return Promise.resolve({ data: { data: [] } });
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
      console.log('Mocked axios POST request', url, data);

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
  it('should make PMT request with correct headers and return data', async () => {
    const server = createMcpServer();
    await expect(server.makePinMeToRequest(`${testApiBaseUrl}/locations`)).resolves.toEqual({
      data: []
    });
    expect(server.configs.accessToken).toBe(testAccessToken);
  });

  it('should handle paginated requests and format responses', async () => {
    const server = createMcpServer();
    await expect(server.makePaginatedPinMeToRequest(`${testApiBaseUrl}/page1`)).resolves.toEqual([
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      true
    ]);
  });
});
