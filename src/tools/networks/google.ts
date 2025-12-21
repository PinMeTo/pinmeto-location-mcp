import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  aggregateMetrics,
  AggregationPeriod,
  formatErrorResponse,
  formatContent,
  CompareWithType,
  calculatePriorPeriod,
  checkGoogleDataLag,
  computeComparison
} from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  KeywordsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat,
  ComparisonInsightsData,
  ComparisonPeriod
} from '../../schemas/output';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown,
  formatRatingsAsMarkdown,
  formatLocationRatingsAsMarkdown,
  formatKeywordsAsMarkdown,
  formatLocationKeywordsAsMarkdown,
  formatInsightsWithComparisonAsMarkdown
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

const CompareWithSchema = z
  .enum(['prior_period', 'prior_year', 'none'])
  .optional()
  .default('none')
  .describe(
    'Compare with: prior_period (MoM/QoQ for same-duration period before), prior_year (YoY for same dates last year), or none (default)'
  );

/**
 * Fetch Google insights for all locations, or a single location if storeId provided.
 * Supports period comparisons (MoM, QoQ, YoY) via compare_with parameter.
 */
export function getGoogleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_insights',
    {
      description:
        'Fetch Google metrics for all locations, or a single location if storeId provided. ' +
        'Supports time aggregation (default: total) and period comparisons.\n\n' +
        'Comparison Options:\n' +
        '  - compare_with="prior_period": Compare with same-duration period before (MoM, QoQ)\n' +
        '  - compare_with="prior_year": Compare with same dates last year (YoY)\n' +
        '  - Returns comparisonData with current, prior, delta, deltaPercent\n\n' +
        'Data Lag Warning:\n' +
        '  - Google data has ~10 day lag. Requests with recent end dates may return incomplete data.\n' +
        '  - Check structuredContent.warning and warningCode for data completeness.\n\n' +
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

      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      const url = storeId
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google insights (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const aggregatedData = aggregateMetrics(result.data, aggregation);

      // Handle comparison if requested
      let comparisonData: ComparisonInsightsData[] | undefined;
      let comparisonPeriod: ComparisonPeriod | undefined;
      let comparisonError: string | undefined;

      if (compare_with !== 'none') {
        const priorPeriod = calculatePriorPeriod(from, to, compare_with);

        const priorUrl = storeId
          ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${priorPeriod.from}&to=${priorPeriod.to}`
          : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${priorPeriod.from}&to=${priorPeriod.to}`;

        const priorResult = await server.makePinMeToRequest(priorUrl);

        if (priorResult.ok) {
          const priorAggregated = aggregateMetrics(priorResult.data, aggregation);
          comparisonData = computeComparison(aggregatedData, priorAggregated);
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
        if (comparisonData && comparisonPeriod) {
          textContent = storeId
            ? formatInsightsWithComparisonAsMarkdown(
                aggregatedData,
                comparisonData,
                comparisonPeriod,
                storeId
              )
            : formatInsightsWithComparisonAsMarkdown(
                aggregatedData,
                comparisonData,
                comparisonPeriod
              );
        } else {
          textContent = storeId
            ? formatLocationInsightsAsMarkdown(aggregatedData, storeId)
            : formatInsightsAsMarkdown(aggregatedData);
        }
      } else {
        textContent = JSON.stringify({
          data: aggregatedData,
          ...(comparisonData && { comparisonData }),
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError }),
          ...(lagWarning && lagWarning)
        });
      }

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: aggregatedData,
          ...(comparisonData && { comparisonData }),
          ...(comparisonPeriod && { comparisonPeriod }),
          ...(comparisonError && { comparisonError }),
          ...(lagWarning && lagWarning)
        }
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
        'Data Lag Warning:\n' +
        '  - Google data has ~10 day lag. Requests with recent end dates may return incomplete data.\n' +
        '  - Check structuredContent.warning and warningCode for data completeness.\n\n' +
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

      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      const url = storeId
        ? `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google ratings (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const textContent = storeId
        ? response_format === 'markdown'
          ? formatLocationRatingsAsMarkdown(result.data, storeId)
          : JSON.stringify(result.data)
        : formatContent(result.data, response_format, formatRatingsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: result.data,
          ...(lagWarning && lagWarning)
        }
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
        'Data Lag Warning:\n' +
        '  - Google data has ~10 day lag. Current month data may be incomplete.\n' +
        '  - Check structuredContent.warning and warningCode for data completeness.\n\n' +
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

      // Check for data lag warning (convert month to last day of month for comparison)
      const [year, month] = to.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const toDateStr = `${to}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const lagWarning = checkGoogleDataLag(toDateStr);

      const url = storeId
        ? `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google keywords (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      const textContent = storeId
        ? response_format === 'markdown'
          ? formatLocationKeywordsAsMarkdown(result.data, storeId)
          : JSON.stringify(result.data)
        : formatContent(result.data, response_format, formatKeywordsAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: result.data,
          ...(lagWarning && lagWarning)
        }
      };
    }
  );
}
