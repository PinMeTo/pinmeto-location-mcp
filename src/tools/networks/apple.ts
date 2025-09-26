import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';

export function getAppleLocationInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_apple_location_insights',
    'Fetch Apple metrics for a single location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch insights data.'
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(locationData)
          }
        ]
      };
    }
  );
}

export function getAllAppleInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_all_apple_insights',
    'Fetch Apple metrics for all locations belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`;
      const insightsData = await server.makePinMeToRequest(url);
      if (!insightsData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch insights data.'
            }
          ]
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(insightsData)
          }
        ]
      };
    }
  );
}
