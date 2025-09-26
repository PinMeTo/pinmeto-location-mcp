import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';

export function getGoogleLocationInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_google_location_insights',
    'Fetch Google metrics for a single location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;
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

export function getAllGoogleInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_all_google_insights',
    'Fetch Google metrics for all locations belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;
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

export const getAllGoogleRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'get_all_google_ratings',
    'Fetch Google ratings for all locations belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;
      const insightsData = await server.makePinMeToRequest(url);
      if (!insightsData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch ratings data.'
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
};

export const getGoogleLocationRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'get_google_location_ratings',
    'Fetch Google ratings for a given location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch ratings data.'
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
};

export const getAllGoogleKeywords = (server: PinMeToMcpServer) => {
  server.tool(
    'get_google_keywords',
    'Fetch Google keywords for all locations belonging to a specific account',
    {
      from: z.string().describe('The start date format YYYY-MM'),
      to: z.string().describe('The end date format YYYY-MM')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch keywords data.'
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
};

export const getGoogleKeywordsForLocation = (server: PinMeToMcpServer) => {
  server.tool(
    'get_google_keywords_for_location',
    'Fetch Google keywords for a given location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM'),
      to: z.string().describe('The end date format YYYY-MM')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch keywords data.'
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
};
