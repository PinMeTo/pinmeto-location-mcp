import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod, formatErrorResponse, formatContent } from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat
} from '../../schemas/output';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown,
  formatRatingsAsMarkdown,
  formatLocationRatingsAsMarkdown
} from '../../formatters';

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
 * Fetch Facebook insights for all locations, or a single location if storeId provided.
 */
export function getFacebookInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_facebook_insights',
    {
      description:
        'Fetch Facebook metrics for all locations, or a single location if storeId provided. Supports time aggregation (default: total).\n\n' +
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
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Facebook insights (${from} to ${to})`;
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

/**
 * Fetch Facebook brand page insights (no single-location variant).
 */
export function getFacebookBrandpageInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_facebook_brandpage_insights',
    {
      description:
        'Fetch Facebook metrics for all brand pages. Supports time aggregation (default: total).\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Auth failure (401): errorCode="AUTH_INVALID_CREDENTIALS"\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
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

      const url = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        return formatErrorResponse(result.error, `all Facebook brand page insights (${from} to ${to})`);
      }

      const aggregatedData = aggregateMetrics(result.data, aggregation);
      const textContent = formatContent(aggregatedData, response_format, formatInsightsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: aggregatedData }
      };
    }
  );
}

/**
 * Fetch Facebook ratings for all locations, or a single location if storeId provided.
 */
export function getFacebookRatings(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_facebook_ratings',
    {
      description:
        'Fetch Facebook ratings for all locations, or a single location if storeId provided.\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if storeId doesn\'t exist\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().optional().describe('Optional store ID to fetch a single location'),
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        response_format: ResponseFormatSchema
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      storeId,
      from,
      to,
      response_format = 'json'
    }: {
      storeId?: string;
      from: string;
      to: string;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = storeId
        ? `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Facebook ratings (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const textContent = storeId
        ? (response_format === 'markdown'
            ? formatLocationRatingsAsMarkdown(result.data, storeId)
            : JSON.stringify(result.data))
        : formatContent(result.data, response_format, formatRatingsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: result.data }
      };
    }
  );
}
