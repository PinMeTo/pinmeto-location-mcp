import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod, formatErrorResponse } from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  KeywordsOutputSchema
} from '../../schemas/output';

export function getGoogleLocationInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_google_location_insights',
    {
      description:
        'Fetch Google metrics for a single location belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
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
      outputSchema: InsightsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
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

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error);
      }

      // Apply aggregation
      const aggregatedData = aggregateMetrics(result.data, aggregation);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregatedData)
          }
        ],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}

export function getAllGoogleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_all_google_insights',
    {
      description:
        'Fetch Google metrics for all locations belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
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
      outputSchema: InsightsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      from,
      to,
      aggregation = 'total'
    }: {
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error);
      }

      // Apply aggregation
      const aggregatedData = aggregateMetrics(result.data, aggregation);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregatedData)
          }
        ],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}

export const getAllGoogleRatings = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_all_google_ratings',
    {
      description:
        'Fetch Google ratings for all locations belonging to a specific account. Returns structured ratings data.',
      inputSchema: {
        from: z.string().describe('The start date format YYYY-MM-DD'),
        to: z.string().describe('The end date format YYYY-MM-DD')
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data)
          }
        ],
        structuredContent: { data: result.data }
      };
    }
  );
};

export const getGoogleLocationRatings = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_google_location_ratings',
    {
      description:
        'Fetch Google ratings for a given location belonging to a specific account. Returns structured ratings data.',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up'),
        from: z.string().describe('The start date format YYYY-MM-DD'),
        to: z.string().describe('The end date format YYYY-MM-DD')
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data)
          }
        ],
        structuredContent: { data: result.data }
      };
    }
  );
};

export const getAllGoogleKeywords = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_google_keywords',
    {
      description:
        'Fetch Google keywords for all locations belonging to a specific account. Returns structured keywords data.',
      inputSchema: {
        from: z.string().describe('The start date format YYYY-MM'),
        to: z.string().describe('The end date format YYYY-MM')
      },
      outputSchema: KeywordsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data)
          }
        ],
        structuredContent: { data: result.data }
      };
    }
  );
};

export const getGoogleKeywordsForLocation = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_google_keywords_for_location',
    {
      description:
        'Fetch Google keywords for a given location belonging to a specific account. Returns structured keywords data.',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up'),
        from: z.string().describe('The start date format YYYY-MM'),
        to: z.string().describe('The end date format YYYY-MM')
      },
      outputSchema: KeywordsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data)
          }
        ],
        structuredContent: { data: result.data }
      };
    }
  );
};
