import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod } from '../../helpers';
import { InsightsOutputSchema } from '../../schemas/output';

export function getAppleLocationInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_apple_location_insights',
    {
      description:
        'Fetch Apple metrics for a single location belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
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

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch insights data.'
            }
          ],
          structuredContent: { error: 'Unable to fetch insights data.' }
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
        ],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}

export function getAllAppleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_all_apple_insights',
    {
      description:
        'Fetch Apple metrics for all locations belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
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

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`;
      const insightsData = await server.makePinMeToRequest(url);
      if (!insightsData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch insights data.'
            }
          ],
          structuredContent: { error: 'Unable to fetch insights data.' }
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
        ],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}
