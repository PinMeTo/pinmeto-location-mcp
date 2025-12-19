import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod, formatErrorResponse } from '../../helpers';
import { InsightsOutputSchema, RatingsOutputSchema } from '../../schemas/output';

// Shared date validation schema
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g., 2024-01-15)');

export function getFacebookLocationsInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_facebook_location_insights',
    {
      description:
        'Fetch Facebook metrics for a single location belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up'),
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
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

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
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

export function getAllFacebookInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_all_facebook_insights',
    {
      description:
        'Fetch Facebook metrics for all locations belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
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

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Facebook insights (${from} to ${to})`);
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

export const getAllFacebookBrandpageInsights = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_all_facebook_brandpage_insights',
    {
      description:
        'Fetch Facebook metrics for all brand pages belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
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

      const url = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Facebook brand page insights (${from} to ${to})`);
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
};

export const getAllFacebookRatings = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_all_facebook_ratings',
    {
      description:
        'Fetch Facebook ratings for all locations belonging to a specific account. Returns structured ratings data.',
      inputSchema: {
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)')
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ from, to }: { from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Facebook ratings (${from} to ${to})`);
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

export const getFacebookLocationRatings = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_facebook_location_ratings',
    {
      description:
        'Fetch Facebook ratings for a given location belonging to a specific account. Returns structured ratings data.',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up'),
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)')
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ storeId, from, to }: { storeId: string; from: string; to: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
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
