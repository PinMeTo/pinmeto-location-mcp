import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod, formatErrorResponse, formatContent } from '../../helpers';
import {
  InsightsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat
} from '../../schemas/output';
import { formatInsightsAsMarkdown, formatLocationInsightsAsMarkdown } from '../../formatters';

// Shared date validation schema
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g., 2024-01-15)');

export function getAppleLocationInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_apple_insights_location',
    {
      description:
        'Fetch Apple metrics for a SINGLE location by store ID. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
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
          ),
        response_format: ResponseFormatSchema
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
      aggregation = 'total',
      response_format = 'json'
    }: {
      storeId: string;
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
      }

      // Apply aggregation
      const aggregatedData = aggregateMetrics(result.data, aggregation);

      const textContent =
        response_format === 'markdown'
          ? formatLocationInsightsAsMarkdown(aggregatedData, storeId)
          : JSON.stringify(aggregatedData);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}

export function getAllAppleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_apple_insights',
    {
      description:
        'Fetch Apple metrics for ALL locations. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
      inputSchema: {
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
        aggregation: z
          .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
          .optional()
          .default('total')
          .describe(
            'Time aggregation period. Options: total (default, single sum - maximum token reduction), daily (no aggregation, full granularity), weekly (~85% token reduction), monthly (~96% reduction), quarterly (~98% reduction), half-yearly, yearly (~99.7% reduction)'
          ),
        response_format: ResponseFormatSchema
      },
      outputSchema: InsightsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      from,
      to,
      aggregation = 'total',
      response_format = 'json'
    }: {
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Apple insights (${from} to ${to})`);
      }

      // Apply aggregation
      const aggregatedData = aggregateMetrics(result.data, aggregation);

      const textContent = formatContent(aggregatedData, response_format, formatInsightsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}
