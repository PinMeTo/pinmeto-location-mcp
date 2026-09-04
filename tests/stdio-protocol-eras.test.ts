import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLIENT_VERSION = '1.0.0';
const DISCOVERY_CACHE_TTL_MS = 60 * 60 * 1000;
const EXPECTED_TOOL_ORDER = [
  'pinmeto_get_location',
  'pinmeto_get_locations',
  'pinmeto_search_locations',
  'pinmeto_get_google_insights',
  'pinmeto_get_google_ratings',
  'pinmeto_get_google_reviews',
  'pinmeto_get_google_keywords',
  'pinmeto_get_google_review_insights',
  'pinmeto_get_facebook_insights',
  'pinmeto_get_facebook_brandpage_insights',
  'pinmeto_get_facebook_ratings',
  'pinmeto_get_apple_insights'
];

describe('stdio protocol eras', () => {
  let apiServer: Server;
  let apiBaseUrl: string;
  const userAgents: string[] = [];

  beforeAll(async () => {
    apiServer = createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/oauth/token') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ access_token: 'test-token' }));
        return;
      }

      if (request.method === 'GET' && request.url === '/v4/test-account/locations?pagesize=1000') {
        userAgents.push(request.headers['user-agent'] ?? '');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            data: [{ _id: 'location-1', storeId: 'store-1', name: 'Test location' }],
            paging: {}
          })
        );
        return;
      }

      response.writeHead(404);
      response.end();
    });

    await new Promise<void>(resolve => apiServer.listen(0, '127.0.0.1', resolve));
    const address = apiServer.address() as AddressInfo;
    apiBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      apiServer.close(error => (error ? reject(error) : resolve()));
    });
  });

  for (const era of ['legacy', 'modern'] as const) {
    it(`lists and calls tools in the ${era} era`, async () => {
      const clientName = `issue-59-${era}`;
      const client = new Client(
        { name: clientName, version: CLIENT_VERSION },
        era === 'modern'
          ? {
              versionNegotiation: {
                mode: { pin: '2026-07-28' },
                probe: { timeoutMs: 2_000 }
              }
            }
          : undefined
      );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        cwd: process.cwd(),
        env: {
          ...env,
          NODE_ENV: 'development',
          PINMETO_ACCOUNT_ID: 'test-account',
          PINMETO_APP_ID: 'test-app',
          PINMETO_APP_SECRET: 'test-secret',
          PINMETO_API_URL: apiBaseUrl,
          PINMETO_LOCATION_API_URL: apiBaseUrl
        },
        stderr: 'pipe'
      });

      try {
        await client.connect(transport);

        expect(client.getProtocolEra()).toBe(era);
        expect(client.getServerVersion()).toMatchObject({
          name: 'PinMeTo Location MCP',
          description: expect.any(String),
          websiteUrl: 'https://www.pinmeto.com'
        });

        const discovery = client.getDiscoverResult();
        const toolCatalog = await client.listTools();
        expect(toolCatalog.tools.map(tool => tool.name)).toEqual(EXPECTED_TOOL_ORDER);

        if (era === 'modern') {
          expect(discovery).toMatchObject({
            ttlMs: DISCOVERY_CACHE_TTL_MS,
            cacheScope: 'public'
          });
          expect(toolCatalog).toMatchObject({
            ttlMs: DISCOVERY_CACHE_TTL_MS,
            cacheScope: 'public'
          });
        } else {
          expect(discovery).toBeUndefined();
          expect(toolCatalog).not.toHaveProperty('ttlMs');
          expect(toolCatalog).not.toHaveProperty('cacheScope');
        }

        const result = await client.callTool({
          name: 'pinmeto_get_locations',
          arguments: { fields: ['_id'] }
        });
        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({
          data: [{ _id: 'location-1' }]
        });
        expect(userAgents).toContainEqual(
          expect.stringContaining(`${clientName}/${CLIENT_VERSION}`)
        );
      } finally {
        await client.close();
      }
    });
  }
});
