import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  aggregateMetrics,
  AggregationPeriod,
  formatErrorResponse,
  formatContent,
  CompareWithType,
  calculatePriorPeriod,
  embedComparison
} from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat,
  ComparisonPeriod,
  InsightsData
} from '../../schemas/output';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown,
  formatRatingsAsMarkdown,
  formatLocationRatingsAsMarkdown,
  formatInsightsWithComparisonAsMarkdown
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

const CompareWithSchema = z
  .enum(['prior_period', 'prior_year', 'none'])
  .optional()
  .default('none')
  .describe(
    'Compare with: prior_period (MoM/QoQ for same-duration period before), prior_year (YoY for same dates last year), or none (default)'
  );

/**
 * Fetch Facebook insights for all locations, or a single location if storeId provided.
 * Supports period comparisons (MoM, QoQ, YoY) via compare_with parameter.
 */
export function getFacebookInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_facebook_insights',
    {
      description:
        'Fetch Facebook metrics for all locations, or a single location if storeId provided. ' +
        'Supports time aggregation (default: total) and period comparisons.\n\n' +
        'Comparison Options:\n' +
        '  - compare_with="prior_period": Compare with same-duration period before (MoM, QoQ)\n' +
        '  - compare_with="prior_year": Compare with same dates last year (YoY)\n' +
        '  - When comparison is active, each metric includes a comparison field with prior, delta, deltaPercent\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if storeId doesn\'t exist\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().optional().describe('Optional store ID to fetch a single location'),
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        aggregation: AggregationSchema,
        compare_with: CompareWithSchema,
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
      compare_with = 'none',
      response_format = 'json'
    }: {
      storeId?: string;
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
      compare_with?: CompareWithType;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = storeId
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId
          ? `storeId '${storeId}'`
          : `all Facebook insights (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      let aggregatedData: InsightsData[] = aggregateMetrics(result.data, aggregation);

      // Handle comparison if requested - embed comparison data directly into metrics
      let comparisonPeriod: ComparisonPeriod | undefined;
      let comparisonError: string | undefined;

      if (compare_with !== 'none') {
        const priorPeriod = calculatePriorPeriod(from, to, compare_with);

        const priorUrl = storeId
          ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${priorPeriod.from}&to=${priorPeriod.to}`
          : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${priorPeriod.from}&to=${priorPeriod.to}`;

        const priorResult = await server.makePinMeToRequest(priorUrl);

        if (priorResult.ok) {
          const priorAggregated = aggregateMetrics(priorResult.data, aggregation);
          // Embed comparison directly into each metric (no separate comparisonData array)
          aggregatedData = embedComparison(aggregatedData, priorAggregated);
          comparisonPeriod = {
            current: { from, to },
            prior: priorPeriod
          };
        } else {
          // Surface comparison failure - current period data is still valuable
          comparisonError = `Comparison data unavailable (${priorPeriod.from} to ${priorPeriod.to}): ${priorResult.error.message}`;
        }
      }

      // Format text content
      let textContent: string;
      if (response_format === 'markdown') {
        if (comparisonPeriod) {
          textContent = formatInsightsWithComparisonAsMarkdown(
            aggregatedData,
            comparisonPeriod,
            storeId
          );
        } else {
          textContent = storeId
            ? formatLocationInsightsAsMarkdown(aggregatedData, storeId)
            : formatInsightsAsMarkdown(aggregatedData);
        }
      } else {
        textContent = JSON.stringify({
          data: aggregatedData,
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError })
        });
      }

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: aggregatedData,
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError })
        }
      };
    }
  );
}

/**
 * Fetch Facebook brand page insights (no single-location variant).
 * Supports period comparisons (MoM, QoQ, YoY) via compare_with parameter.
 */
export function getFacebookBrandpageInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_facebook_brandpage_insights',
    {
      description:
        'Fetch Facebook metrics for all brand pages. Supports time aggregation (default: total) and period comparisons.\n\n' +
        'Comparison Options:\n' +
        '  - compare_with="prior_period": Compare with same-duration period before (MoM, QoQ)\n' +
        '  - compare_with="prior_year": Compare with same dates last year (YoY)\n' +
        '  - When comparison is active, each metric includes a comparison field with prior, delta, deltaPercent\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Auth failure (401): errorCode="AUTH_INVALID_CREDENTIALS"\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        aggregation: AggregationSchema,
        compare_with: CompareWithSchema,
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
      compare_with = 'none',
      response_format = 'json'
    }: {
      from: string;
      to: string;
      aggregation?: AggregationPeriod;
      compare_with?: CompareWithType;
      response_format?: ResponseFormat;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;
      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        return formatErrorResponse(
          result.error,
          `all Facebook brand page insights (${from} to ${to})`
        );
      }

      let aggregatedData: InsightsData[] = aggregateMetrics(result.data, aggregation);

      // Handle comparison if requested - embed comparison data directly into metrics
      let comparisonPeriod: ComparisonPeriod | undefined;
      let comparisonError: string | undefined;

      if (compare_with !== 'none') {
        const priorPeriod = calculatePriorPeriod(from, to, compare_with);
        const priorUrl = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${priorPeriod.from}&to=${priorPeriod.to}`;
        const priorResult = await server.makePinMeToRequest(priorUrl);

        if (priorResult.ok) {
          const priorAggregated = aggregateMetrics(priorResult.data, aggregation);
          // Embed comparison directly into each metric (no separate comparisonData array)
          aggregatedData = embedComparison(aggregatedData, priorAggregated);
          comparisonPeriod = {
            current: { from, to },
            prior: priorPeriod
          };
        } else {
          // Surface comparison failure - current period data is still valuable
          comparisonError = `Comparison data unavailable (${priorPeriod.from} to ${priorPeriod.to}): ${priorResult.error.message}`;
        }
      }

      // Format text content
      let textContent: string;
      if (response_format === 'markdown') {
        if (comparisonPeriod) {
          textContent = formatInsightsWithComparisonAsMarkdown(aggregatedData, comparisonPeriod);
        } else {
          textContent = formatInsightsAsMarkdown(aggregatedData);
        }
      } else {
        textContent = JSON.stringify({
          data: aggregatedData,
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError })
        });
      }

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: aggregatedData,
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError })
        }
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
        const context = storeId
          ? `storeId '${storeId}'`
          : `all Facebook ratings (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const textContent = storeId
        ? response_format === 'markdown'
          ? formatLocationRatingsAsMarkdown(result.data, storeId)
          : JSON.stringify(result.data)
        : formatContent(result.data, response_format, formatRatingsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: { data: result.data }
      };
    }
  );
}
