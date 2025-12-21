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

const AggregationSchema = z
  .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
  .optional()
  .default('total')
  .describe(
    'Time aggregation: total (default, maximum token reduction), daily, weekly, monthly, quarterly, half-yearly, yearly'
  );

/**
 * Fetch Apple insights for all locations, or a single location if storeId provided.
 */
export function getAppleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_apple_insights',
    {
      description:
        'Fetch Apple metrics for all locations, or a single location if storeId provided. Supports time aggregation (default: total).\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if storeId doesn\'t exist\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().optional().describe('Optional store ID to fetch a single location'),
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        aggregation: AggregationSchema,
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
      storeId?: string;
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = storeId
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Apple insights (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const aggregatedData = aggregateMetrics(result.data, aggregation);

      const textContent = storeId
        ? (response_format === 'markdown'
            ? formatLocationInsightsAsMarkdown(aggregatedData, storeId)
            : JSON.stringify(aggregatedData))
        : formatContent(aggregatedData, response_format, formatInsightsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}
