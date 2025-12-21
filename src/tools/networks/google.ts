import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { aggregateMetrics, AggregationPeriod, formatErrorResponse, formatContent } from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  KeywordsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat
} from '../../schemas/output';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown,
  formatRatingsAsMarkdown,
  formatLocationRatingsAsMarkdown,
  formatKeywordsAsMarkdown,
  formatLocationKeywordsAsMarkdown
} from '../../formatters';

// Shared date validation schemas
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g., 2024-01-15)');

const MonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Date must be in YYYY-MM format (e.g., 2024-01)');

const AggregationSchema = z
  .enum(['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly', 'total'])
  .optional()
  .default('total')
  .describe(
    'Time aggregation: total (default, maximum token reduction), daily, weekly, monthly, quarterly, half-yearly, yearly'
  );

/**
 * Fetch Google insights for all locations, or a single location if storeId provided.
 */
export function getGoogleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_insights',
    {
      description:
        'Fetch Google metrics for all locations, or a single location if storeId provided. Supports time aggregation (default: total).\n\n' +
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
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google insights (${from} to ${to})`;
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
 * Fetch Google ratings for all locations, or a single location if storeId provided.
 */
export function getGoogleRatings(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_ratings',
    {
      description:
        'Fetch Google ratings for all locations, or a single location if storeId provided.\n\n' +
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
        ? `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google ratings (${from} to ${to})`;
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

/**
 * Fetch Google keywords for all locations, or a single location if storeId provided.
 */
export function getGoogleKeywords(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_keywords',
    {
      description:
        'Fetch Google keywords for all locations, or a single location if storeId provided.\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if storeId doesn\'t exist\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().optional().describe('Optional store ID to fetch a single location'),
        from: MonthSchema.describe('Start month (YYYY-MM)'),
        to: MonthSchema.describe('End month (YYYY-MM)'),
        response_format: ResponseFormatSchema
      },
      outputSchema: KeywordsOutputSchema,
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
        ? `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google keywords (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const textContent = storeId
        ? (response_format === 'markdown'
            ? formatLocationKeywordsAsMarkdown(result.data, storeId)
            : JSON.stringify(result.data))
        : formatContent(result.data, response_format, formatKeywordsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: result.data }
      };
    }
  );
}
