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

export function getGoogleLocationInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_google_location_insights',
    {
      description:
        'Fetch Google metrics for a single location belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
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

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;
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

export function getAllGoogleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'get_all_google_insights',
    {
      description:
        'Fetch Google metrics for all locations belonging to a specific account. Supports time aggregation to reduce token usage (daily, weekly, monthly, quarterly, half-yearly, yearly, total). Default: total. Returns structured insights data with metrics grouped by dimension.',
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

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Google insights (${from} to ${to})`);
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

export const getAllGoogleRatings = (server: PinMeToMcpServer) => {
  server.registerTool(
    'get_all_google_ratings',
    {
      description:
        'Fetch Google ratings for all locations belonging to a specific account. Returns structured ratings data.',
      inputSchema: {
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
        response_format: ResponseFormatSchema
      },
      outputSchema: RatingsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      from,
      to,
      response_format = 'json'
    }: {
      from: string;
      to: string;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);
      if (!result.ok) {
        return formatErrorResponse(result.error, `all Google ratings (${from} to ${to})`);
      }

      const textContent = formatContent(result.data, response_format, formatRatingsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
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
        from: DateSchema.describe('The start date (YYYY-MM-DD)'),
        to: DateSchema.describe('The end date (YYYY-MM-DD)'),
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
      storeId: string;
      from: string;
      to: string;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
      }

      const textContent =
        response_format === 'markdown'
          ? formatLocationRatingsAsMarkdown(result.data, storeId)
          : JSON.stringify(result.data);

      return {
        content: [{ type: 'text', text: textContent }],
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
        from: MonthSchema.describe('The start month (YYYY-MM)'),
        to: MonthSchema.describe('The end month (YYYY-MM)'),
        response_format: ResponseFormatSchema
      },
      outputSchema: KeywordsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      from,
      to,
      response_format = 'json'
    }: {
      from: string;
      to: string;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `all Google keywords (${from} to ${to})`);
      }

      const textContent = formatContent(result.data, response_format, formatKeywordsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
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
        from: MonthSchema.describe('The start month (YYYY-MM)'),
        to: MonthSchema.describe('The end month (YYYY-MM)'),
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
      storeId: string;
      from: string;
      to: string;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
      }

      const textContent =
        response_format === 'markdown'
          ? formatLocationKeywordsAsMarkdown(result.data, storeId)
          : JSON.stringify(result.data);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: result.data }
      };
    }
  );
};
