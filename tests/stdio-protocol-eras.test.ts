import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLIENT_VERSION = '1.0.0';

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

      if (request.method === 'GET' && request.url?.startsWith('/listings/v3/test-account/ratings/google?')) {
        const from = new URL(request.url, 'http://localhost').searchParams.get('from');
        const reviewCount = from === '2031-01-01' || from === '2034-01-01' ? 10_500 : 1_500;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify(
            Array.from({ length: reviewCount }, (_, index) => ({
              storeId: `store-${index % 3}`,
              rating: (index % 5) + 1,
              comment: `Review number ${index}`,
              date: from
            }))
          )
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

  const createTransport = () => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    );
    return new StdioClientTransport({
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
  };

  const createClient = (era: 'legacy' | 'modern', supportsElicitation = false) =>
    new Client(
      { name: `stdio-${era}`, version: CLIENT_VERSION },
      {
        ...(supportsElicitation && {
          capabilities: { elicitation: { form: {} } },
          inputRequired: { autoFulfill: true }
        }),
        ...(era === 'modern' && {
          versionNegotiation: {
            mode: { pin: '2026-07-28' as const },
            probe: { timeoutMs: 2_000 }
          }
        })
      }
    );

  const callReviewInsights = async (client: Client, from: string) => {
    await client.listTools();
    return client.callTool({
      name: 'pinmeto_get_google_review_insights',
      arguments: {
        from,
        to: from.replace('-01-01', '-12-31'),
        analysisType: 'summary',
        forceRefresh: true
      }
    });
  };

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
      const transport = createTransport();

      try {
        await client.connect(transport);

        expect(client.getProtocolEra()).toBe(era);
        expect(client.getServerVersion()).toMatchObject({
          name: 'PinMeTo Location MCP',
          description: expect.any(String),
          websiteUrl: 'https://www.pinmeto.com'
        });

        const { tools } = await client.listTools();
        expect(tools).toHaveLength(12);

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

  it.each([
    ['medium', '2030-01-01', 'proceed_full', undefined, 1_500],
    ['large', '2031-01-01', 'representative_sample', 'representative', 500]
  ] as const)(
    'completes modern review-insights MRTR for a %s dataset over stdio',
    async (_label, from, choice, expectedStrategy, expectedAnalyzedCount) => {
      const client = createClient('modern', true);
      const transport = createTransport();
      let elicitationRequest: any;
      client.setRequestHandler('elicitation/create', async request => {
        elicitationRequest = request;
        return { action: 'accept', content: { choice } };
      });

      try {
        await client.connect(transport);
        const result = await callReviewInsights(client, from);

        expect(elicitationRequest.params.message).toContain(choice);
        expect(elicitationRequest.params.requestedSchema.properties.choice.enum).toContain(choice);
        expect(result.isError).not.toBe(true);
        const structured = result.structuredContent as any;
        expect(structured.requiresConfirmation).toBeUndefined();
        expect(structured.metadata.analyzedReviewCount).toBe(expectedAnalyzedCount);
        expect(structured.metadata.samplingStrategy).toBe(expectedStrategy);
        expect(structured.warningCode).toBe(expectedStrategy ? 'SAMPLED_ANALYSIS' : undefined);
      } finally {
        await client.close();
      }
    }
  );

  it('completes review-insights elicitation through the legacy stdio shim', async () => {
    const client = createClient('legacy', true);
    const transport = createTransport();
    let elicitationCount = 0;
    client.setRequestHandler('elicitation/create', async () => {
      elicitationCount += 1;
      return { action: 'accept', content: { choice: 'recent_weighted' } };
    });

    try {
      await client.connect(transport);
      const result = await callReviewInsights(client, '2035-01-01');

      expect(elicitationCount).toBe(1);
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        metadata: { analyzedReviewCount: 500, samplingStrategy: 'recent_weighted' },
        warningCode: 'SAMPLED_ANALYSIS'
      });
    } finally {
      await client.close();
    }
  });

  it('preserves the explicit review-insights fallback without elicitation support', async () => {
    const client = createClient('modern');
    const transport = createTransport();

    try {
      await client.connect(transport);
      const result = await callReviewInsights(client, '2032-01-01');

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        requiresConfirmation: true,
        warningCode: 'LARGE_DATASET_WARNING'
      });
      expect((result.structuredContent as any).largeDatasetWarning.options).toHaveLength(3);
    } finally {
      await client.close();
    }
  });

  it('returns the explicit fallback when modern stdio elicitation is cancelled', async () => {
    const client = createClient('modern', true);
    const transport = createTransport();
    client.setRequestHandler('elicitation/create', async () => ({ action: 'cancel' }));

    try {
      await client.connect(transport);
      const result = await callReviewInsights(client, '2033-01-01');

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        requiresConfirmation: true,
        warningCode: 'LARGE_DATASET_WARNING'
      });
    } finally {
      await client.close();
    }
  });

  it('rejects an invalid large-dataset choice over modern stdio', async () => {
    const client = createClient('modern', true);
    const transport = createTransport();
    client.setRequestHandler('elicitation/create', async () => ({
      action: 'accept',
      content: { choice: 'proceed_full' }
    }));

    try {
      await client.connect(transport);
      const result = await callReviewInsights(client, '2034-01-01');

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        errorCode: 'BAD_REQUEST',
        retryable: false
      });
      expect((result.structuredContent as any).data).toBeUndefined();
    } finally {
      await client.close();
    }
  });
});
