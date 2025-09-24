import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';

export function getFacebookLocationsInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_facebook_location_insights',
    'Fetch Facebook metrics for a single location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('	The end date format YYYY-MM-DD')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`;
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

export function getAllFacebookInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_all_facebook_insights',
    'Fetch Facebook metrics for all brand pages belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('	The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`;
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

export const getAllFacebookBrandpageInsights = (server: PinMeToMcpServer) => {
  server.tool(
    'get_all_facebook_brandpage_insights',
    'Fetch Facebook metrics for all brand pages belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('	The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;
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
};

export const getAllFacebookRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'get_all_facebook_ratings',
    'Fetch Facebook ratings for all locations belonging to a specific account.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('	The end date format YYYY-MM-DD')
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook?from=${from}&to=${to}`;
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

export const getFacebookLocationRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'get_facebook_location_ratings',
    'Fetch Facebook ratings for a given location belonging to a specific account.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('	The end date format YYYY-MM-DD')
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`;
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
