import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod } from '../../helpers';

export function getFacebookLocationsInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_facebook_location_insights',
    'Fetch Facebook metrics for a single location belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total.',
    {
      storeId: z.string().describe('The store ID to look up'),
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe(
          'Time aggregation period. Options: total (default, single sum - maximum token reduction), daily (no aggregation, full granularity), weekly (~85% token reduction), monthly (~96% reduction), quarterly (~98% reduction), half-yearly, yearly (~99.7% reduction)'
        )
    },
    async ({
      storeId,
      from,
      to,
      aggregation = 'total'
    }: {
      storeId: string;
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
    }) => {
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

      // Apply aggregation
      const aggregatedData = aggregateMetrics(locationData, aggregation);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregatedData)
          }
        ]
      };
    }
  );
}

export function getAllFacebookInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_all_facebook_insights',
    'Fetch Facebook metrics for all brand pages belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe(
          'Time aggregation period. Options: total (default, single sum - maximum token reduction), daily (no aggregation, full granularity), weekly (~85% token reduction), monthly (~96% reduction), quarterly (~98% reduction), half-yearly, yearly (~99.7% reduction)'
        )
    },
    async ({ from, to, aggregation = 'total' }: { from: string; to: string; aggregation?: AggregationPeriod }) => {
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

      // Apply aggregation
      const aggregatedData = aggregateMetrics(insightsData, aggregation);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregatedData)
          }
        ]
      };
    }
  );
}

export const getAllFacebookBrandpageInsights = (server: PinMeToMcpServer) => {
  server.tool(
    'get_all_facebook_brandpage_insights',
    'Fetch Facebook metrics for all brand pages belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total.',
    {
      from: z.string().describe('The start date format YYYY-MM-DD'),
      to: z.string().describe('The end date format YYYY-MM-DD'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe(
          'Time aggregation period. Options: total (default, single sum - maximum token reduction), daily (no aggregation, full granularity), weekly (~85% token reduction), monthly (~96% reduction), quarterly (~98% reduction), half-yearly, yearly (~99.7% reduction)'
        )
    },
    async ({ from, to, aggregation = 'total' }: { from: string; to: string; aggregation?: AggregationPeriod }) => {
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

      // Apply aggregation
      const aggregatedData = aggregateMetrics(insightsData, aggregation);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregatedData)
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
      to: z.string().describe('The end date format YYYY-MM-DD')
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
      to: z.string().describe('The end date format YYYY-MM-DD')
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
