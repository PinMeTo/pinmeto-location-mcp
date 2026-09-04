import { z } from 'zod';
import { acceptedContent, CLIENT_CAPABILITIES_META_KEY, inputRequired, inputResponse } from '@modelcontextprotocol/server';
import type { ClientCapabilities, ServerContext } from '@modelcontextprotocol/server';
import { PinMeToMcpServer } from '../../mcp_server';
import { ApiError } from '../../errors';
import {
  AggregationPeriod,
  formatErrorResponse,
  formatContent,
  CompareWithType,
  calculatePriorPeriod,
  checkGoogleDataLag,
  aggregateInsights,
  convertApiDataToInsights,
  finalizeInsights,
  isValidDate,
  // Review insights helpers
  RawReview,
  SanitizedReview,
  sanitizeReviews,
  estimateTokens,
  formatTokenEstimate,
  applySamplingStrategy,
  buildInsightsCacheKey,
  performStatisticalAnalysis,
  performStatisticalLocationComparison,
  REVIEW_INSIGHTS_THRESHOLDS
} from '../../helpers';
import {
  InsightsOutputSchema,
  RatingsOutputSchema,
  ReviewsOutputSchema,
  KeywordsOutputSchema,
  ResponseFormatSchema,
  ResponseFormat,
  Insight,
  FlatInsight,
  PeriodRange,
  Review,
  // Review insights schemas
  ReviewInsightsOutputSchema,
  ReviewInsightsData,
  ReviewInsightsMetadata,
  ReviewInsightsWarningCode,
  LargeDatasetWarning,
  AnalysisType,
  AnalysisTypeSchema,
  SamplingStrategy,
  SamplingStrategySchema,
  AnalysisMethod
} from '../../schemas/output';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown,
  formatRatingsAsMarkdown,
  formatLocationRatingsAsMarkdown,
  formatReviewsAsMarkdown,
  formatLocationReviewsAsMarkdown,
  formatKeywordsAsMarkdown,
  formatLocationKeywordsAsMarkdown,
  formatInsightsWithComparisonAsMarkdown,
  formatFlatInsightsAsMarkdown,
  InsightsFormatOptions,
  formatReviewInsightsAsMarkdown,
  formatLargeDatasetWarningAsMarkdown
} from '../../formatters';

// Shared date validation schemas
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g., 2024-01-15)')
  .refine(isValidDate, {
    message: 'Invalid date - check month/day values (e.g., June has 30 days, not 31)'
  });

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

// ============================================================================
// Reviews Cache - Shared between ratings and reviews tools
// ============================================================================

/**
 * Cache entry for reviews data
 */
interface ReviewsCacheEntry {
  data: RawReview[];
  timestamp: number;
}

/**
 * Reviews cache - shared between ratings and reviews tools
 * Key format: `${accountId}-${storeId || 'all'}-${from}-${to}`
 */
const reviewsCache = new Map<string, ReviewsCacheEntry>();

/**
 * Cache TTL in milliseconds (5 minutes, consistent with locations cache)
 */
const REVIEWS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Build cache key for reviews.
 * Uses explicit prefixes to prevent collision if a storeId happens to be "all".
 */
function buildReviewsCacheKey(accountId: string, storeId: string | undefined, from: string, to: string): string {
  const scope = storeId ? `store:${storeId}` : 'bulk:all';
  return `${accountId}-${scope}-${from}-${to}`;
}

/**
 * Result type for getCachedOrFetchReviews
 */
type ReviewsCacheResult =
  | { ok: true; data: RawReview[]; cached: boolean; ageSeconds?: number }
  | { ok: false; error: ApiError };

/**
 * Get cached or fetch reviews from API.
 * Shared by both getGoogleRatings and getGoogleReviews tools.
 */
async function getCachedOrFetchReviews(
  server: PinMeToMcpServer,
  storeId: string | undefined,
  from: string,
  to: string,
  forceRefresh: boolean = false,
  requestContext?: ServerContext
): Promise<ReviewsCacheResult> {
  const { apiBaseUrl, accountId } = server.configs;
  const cacheKey = buildReviewsCacheKey(accountId, storeId, from, to);

  // Check cache (unless forceRefresh)
  if (!forceRefresh) {
    const cached = reviewsCache.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < REVIEWS_CACHE_TTL_MS) {
        // Serve from cache (including empty results - they're valid)
        return {
          ok: true,
          data: cached.data,
          cached: true,
          ageSeconds: Math.round(ageMs / 1000)
        };
      } else {
        // Cache expired, remove it
        reviewsCache.delete(cacheKey);
      }
    }
  }

  // Fetch from API
  const url = storeId
    ? `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`
    : `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;

  const result = await server.makePinMeToRequest(url, requestContext);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Normalize data to array of reviews
  // API returns: [{id, date, storeId, rating, comment, hasAnswer, reply}, ...]
  const rawData = result.data;
  let reviews: RawReview[];

  if (Array.isArray(rawData)) {
    reviews = rawData as RawReview[];
  } else if (rawData && typeof rawData === 'object') {
    // Check for nested data property (some API patterns)
    if (Array.isArray((rawData as any).data)) {
      reviews = (rawData as any).data as RawReview[];
    } else if ('rating' in rawData) {
      // Single review object - wrap in array
      reviews = [rawData as RawReview];
    } else {
      // Unexpected object shape - return error, do NOT cache
      console.error(
        `[getCachedOrFetchReviews] Unexpected API response shape (object without recognized fields): ${JSON.stringify(rawData).slice(0, 200)}`
      );
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR' as const,
          message:
            'API returned unexpected data format. This may indicate an API change or server issue.',
          retryable: true
        }
      };
    }
  } else {
    // Unexpected non-object response - return error, do NOT cache
    console.error(
      `[getCachedOrFetchReviews] Unexpected API response type: ${typeof rawData}, value: ${JSON.stringify(rawData).slice(0, 100)}`
    );
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR' as const,
        message: `API returned unexpected response type: ${typeof rawData}. This may indicate an API change or server issue.`,
        retryable: true
      }
    };
  }

  // Cache valid results (including empty arrays - they're valid for locations with no reviews)
  reviewsCache.set(cacheKey, {
    data: reviews,
    timestamp: Date.now()
  });

  return { ok: true, data: reviews, cached: false };
}

/**
 * Fetch Google insights for all locations, or a single location if storeId provided.
 * Supports period comparisons (MoM, QoQ, YoY) via compare_with parameter.
 */
export function getGoogleInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_insights',
    {
      title: 'Google insights',
      description:
        'Fetch Google metrics for all locations, or a single location if storeId provided. ' +
        'Supports time aggregation (default: total) and period comparisons.\n\n' +
        'Comparison Options:\n' +
        '  - compare_with="prior_period": Compare with same-duration period before (MoM, QoQ)\n' +
        '  - compare_with="prior_year": Compare with same dates last year (YoY)\n' +
        '  - When comparison is active, each metric includes a comparison field with prior, delta, deltaPercent\n\n' +
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
    }, requestContext) => {
      const { apiBaseUrl, accountId } = server.configs;

      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      const url = storeId
        ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url, requestContext);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google insights (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      // Convert API response to new Insight[] structure
      const currentInsights = aggregateInsights(convertApiDataToInsights(result.data), aggregation);

      // Handle comparison if requested
      const periodRange: PeriodRange = { from, to };
      let priorInsights: Insight[] | undefined;
      let priorPeriodRange: PeriodRange | undefined;
      let comparisonError: string | undefined;

      if (compare_with !== 'none') {
        const priorPeriod = calculatePriorPeriod(from, to, compare_with);

        const priorUrl = storeId
          ? `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${priorPeriod.from}&to=${priorPeriod.to}`
          : `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${priorPeriod.from}&to=${priorPeriod.to}`;

        const priorResult = await server.makePinMeToRequest(priorUrl, requestContext);

        if (priorResult.ok) {
          priorInsights = aggregateInsights(convertApiDataToInsights(priorResult.data), aggregation);
          priorPeriodRange = priorPeriod;
        } else {
          // Surface comparison failure - current period data is still valuable
          comparisonError = `Comparison data unavailable (${priorPeriod.from} to ${priorPeriod.to}): ${priorResult.error.message}`;
        }
      }

      // Finalize: embed comparison and flatten if total aggregation
      const { outputData, isTotal, insightsWithComparison } = finalizeInsights(
        currentInsights,
        priorInsights,
        aggregation
      );

      // Format text content
      let textContent: string;
      const formatOptions: InsightsFormatOptions = {
        timeAggregation: aggregation,
        compareWith: compare_with
      };
      if (response_format === 'markdown') {
        if (isTotal) {
          // Flattened output for total aggregation
          textContent = formatFlatInsightsAsMarkdown(
            outputData as FlatInsight[],
            periodRange,
            priorPeriodRange,
            storeId,
            formatOptions
          );
        } else if (priorPeriodRange) {
          // Multi-period with comparison
          textContent = formatInsightsWithComparisonAsMarkdown(
            insightsWithComparison,
            periodRange,
            priorPeriodRange,
            storeId,
            formatOptions
          );
        } else {
          // Multi-period without comparison
          textContent = storeId
            ? formatLocationInsightsAsMarkdown(insightsWithComparison, storeId)
            : formatInsightsAsMarkdown(insightsWithComparison);
        }
      } else {
        textContent = JSON.stringify({
          insights: outputData,
          periodRange,
          timeAggregation: aggregation,
          compareWith: compare_with,
          ...(priorPeriodRange && { priorPeriodRange }),
          ...(comparisonError && { comparisonError }),
          ...(lagWarning && lagWarning)
        });
      }

      return {
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: {
          insights: outputData,
          periodRange,
          timeAggregation: aggregation,
          compareWith: compare_with,
          ...(priorPeriodRange && { priorPeriodRange }),
          ...(comparisonError && { comparisonError }),
          ...(lagWarning && lagWarning)
        }
      };
    }
  );
}

/**
 * Compute rating distribution from an array of ratings
 */
function computeDistribution(ratings: number[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const rating of ratings) {
    const key = String(Math.round(rating));
    distribution[key] = (distribution[key] || 0) + 1;
  }
  return distribution;
}

/**
 * Aggregate raw reviews into rating summaries.
 * Groups by storeId and computes averageRating, totalReviews, distribution.
 */
function aggregateReviewsToRatings(reviews: RawReview[], singleStoreId?: string):
  | { averageRating: number; totalReviews: number; distribution: Record<string, number> }
  | Array<{ storeId: string; averageRating: number; totalReviews: number; distribution: Record<string, number> }> {

  if (reviews.length === 0) {
    if (singleStoreId) {
      return { averageRating: 0, totalReviews: 0, distribution: {} };
    }
    return [];
  }

  // Group reviews by storeId
  const storeMap = new Map<string, number[]>();
  for (const review of reviews) {
    const id = review.storeId || singleStoreId || 'unknown';
    const ratings = storeMap.get(id) || [];
    ratings.push(review.rating);
    storeMap.set(id, ratings);
  }

  // Compute aggregates per store
  const summaries = Array.from(storeMap.entries()).map(([storeId, ratings]) => {
    const sum = ratings.reduce((a, b) => a + b, 0);
    return {
      storeId,
      averageRating: Number((sum / ratings.length).toFixed(2)),
      totalReviews: ratings.length,
      distribution: computeDistribution(ratings)
    };
  });

  // Single location query: return object without storeId field
  // Only use single-object format when explicitly requested via singleStoreId
  if (singleStoreId) {
    // Find the summary matching the requested storeId, or fall back to first
    const summary = summaries.find(s => s.storeId === singleStoreId) || summaries[0];
    if (summary.storeId !== singleStoreId) {
      console.error(
        `[aggregateReviewsToRatings] Requested storeId '${singleStoreId}' not found in results, using '${summary.storeId}'`
      );
    }
    return {
      averageRating: summary.averageRating,
      totalReviews: summary.totalReviews,
      distribution: summary.distribution
    };
  }

  // Multi-location query: always return array (even if only one store has reviews)
  return summaries;
}

/**
 * Fetch Google ratings (aggregate statistics) for all locations, or a single location if storeId provided.
 * Returns only averageRating, totalReviews, and distribution - for detailed reviews use pinmeto_get_google_reviews.
 */
export function getGoogleRatings(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_ratings',
    {
      title: 'Google ratings',
      description:
        'Fetch Google rating statistics (averageRating, totalReviews, distribution) for all locations, or a single location.\n\n' +
        'Returns aggregate statistics only. For individual review text and sentiment analysis, use pinmeto_get_google_reviews.\n\n' +
        'Caching:\n' +
        '  - Results cached for 5 minutes (shared with reviews tool)\n' +
        '  - Use forceRefresh=true to bypass cache\n' +
        '  - Check structuredContent.cacheInfo for cache status\n\n' +
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
        forceRefresh: z.boolean().optional().default(false).describe('Bypass cache and fetch fresh data'),
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
      forceRefresh = false,
      response_format = 'json'
    }: {
      storeId?: string;
      from: string;
      to: string;
      forceRefresh?: boolean;
      response_format?: ResponseFormat;
    }, requestContext) => {
      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      // Fetch reviews (from cache or API)
      const result = await getCachedOrFetchReviews(server, storeId, from, to, forceRefresh, requestContext);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google ratings (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      // Aggregate reviews into rating summaries
      const aggregatedData = aggregateReviewsToRatings(result.data, storeId);

      // Build cache info
      const cacheInfo = {
        cached: result.cached,
        ...(result.ageSeconds !== undefined && { ageSeconds: result.ageSeconds })
      };

      // Format output
      const textContent = storeId
        ? response_format === 'markdown'
          ? formatLocationRatingsAsMarkdown(aggregatedData, storeId)
          : JSON.stringify(aggregatedData)
        : formatContent(aggregatedData, response_format, formatRatingsAsMarkdown);

      return {
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: {
          data: aggregatedData,
          cacheInfo,
          ...(lagWarning && lagWarning)
        }
      };
    }
  );
}

/**
 * Transform raw API review to our Review schema
 */
function transformRawReview(raw: RawReview): Review {
  return {
    storeId: raw.storeId,
    rating: raw.rating,
    comment: raw.comment,
    date: raw.date,
    ownerResponse: raw.reply,
    responseDate: raw.replyDate
  };
}

/**
 * Fetch Google reviews with pagination and filtering.
 * For aggregate statistics, use pinmeto_get_google_ratings instead.
 */
export function getGoogleReviews(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_reviews',
    {
      title: 'Google reviews',
      description:
        'Fetch individual Google reviews with pagination and filtering for sentiment analysis.\n\n' +
        'For aggregate statistics (averageRating, totalReviews), use pinmeto_get_google_ratings instead.\n\n' +
        'Pagination:\n' +
        '  - limit: Max reviews to return (default: 50, max: 500)\n' +
        '  - offset: Skip first N reviews (for pagination)\n' +
        '  - Check hasMore in response to know if more pages exist\n\n' +
        'Filtering:\n' +
        '  - minRating/maxRating: Filter by rating range (1-5)\n' +
        '  - hasResponse: true for responded reviews, false for unresponded\n\n' +
        'Caching:\n' +
        '  - Results cached for 5 minutes (shared with ratings tool)\n' +
        '  - Use forceRefresh=true to bypass cache\n' +
        '  - Filters are applied client-side on cached data\n\n' +
        'Data Lag Warning:\n' +
        '  - Google data has ~10 day lag. Requests with recent end dates may return incomplete data.\n\n' +
        'Error Handling:\n' +
        '  - Rate limit (429): errorCode="RATE_LIMITED", message includes retry timing\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if storeId doesn\'t exist\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().optional().describe('Optional store ID to fetch a single location'),
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        limit: z.number().min(1).max(500).optional().default(50).describe('Max reviews to return (default: 50, max: 500)'),
        offset: z.number().min(0).optional().default(0).describe('Skip first N reviews for pagination'),
        minRating: z.number().min(1).max(5).optional().describe('Minimum rating filter (1-5)'),
        maxRating: z.number().min(1).max(5).optional().describe('Maximum rating filter (1-5)'),
        hasResponse: z.boolean().optional().describe('Filter: true for responded reviews, false for unresponded'),
        forceRefresh: z.boolean().optional().default(false).describe('Bypass cache and fetch fresh data'),
        response_format: ResponseFormatSchema
      },
      outputSchema: ReviewsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      storeId,
      from,
      to,
      limit = 50,
      offset = 0,
      minRating,
      maxRating,
      hasResponse,
      forceRefresh = false,
      response_format = 'json'
    }: {
      storeId?: string;
      from: string;
      to: string;
      limit?: number;
      offset?: number;
      minRating?: number;
      maxRating?: number;
      hasResponse?: boolean;
      forceRefresh?: boolean;
      response_format?: ResponseFormat;
    }, requestContext) => {
      // Validate filter combination
      if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Error: minRating cannot be greater than maxRating' }],
          structuredContent: {
            error: 'Error: minRating cannot be greater than maxRating',
            errorCode: 'BAD_REQUEST',
            retryable: false
          }
        };
      }

      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      // Fetch reviews (from cache or API)
      const result = await getCachedOrFetchReviews(server, storeId, from, to, forceRefresh, requestContext);

      if (!result.ok) {
        const context = storeId ? `storeId '${storeId}'` : `all Google reviews (${from} to ${to})`;
        return formatErrorResponse(result.error, context);
      }

      // Apply filters
      let filteredReviews = result.data;

      if (minRating !== undefined) {
        filteredReviews = filteredReviews.filter(r => r.rating >= minRating);
      }

      if (maxRating !== undefined) {
        filteredReviews = filteredReviews.filter(r => r.rating <= maxRating);
      }

      if (hasResponse !== undefined) {
        filteredReviews = filteredReviews.filter(r =>
          hasResponse ? !!r.reply : !r.reply
        );
      }

      // Get total count after filtering (before pagination)
      const totalCount = filteredReviews.length;

      // Apply pagination
      const paginatedReviews = filteredReviews.slice(offset, offset + limit);

      // Transform to our Review schema
      const reviews: Review[] = paginatedReviews.map(transformRawReview);

      // Build pagination metadata
      const hasMore = offset + reviews.length < totalCount;

      // Build cache info
      const cacheInfo = {
        cached: result.cached,
        ...(result.ageSeconds !== undefined && { ageSeconds: result.ageSeconds })
      };

      // Format output
      const paginationOptions = { totalCount, hasMore, offset, limit };
      const textContent = storeId
        ? response_format === 'markdown'
          ? formatLocationReviewsAsMarkdown(reviews, storeId, paginationOptions)
          : JSON.stringify({ data: reviews, ...paginationOptions })
        : response_format === 'markdown'
          ? formatReviewsAsMarkdown(reviews, paginationOptions)
          : JSON.stringify({ data: reviews, ...paginationOptions });

      return {
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: {
          data: reviews,
          totalCount,
          hasMore,
          offset,
          limit,
          cacheInfo,
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
      title: 'Google search keywords',
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
    }, requestContext) => {
      const { apiBaseUrl, accountId } = server.configs;

      // Check for data lag warning (convert month to last day of month for comparison)
      const [year, month] = to.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const toDateStr = `${to}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const lagWarning = checkGoogleDataLag(toDateStr);

      const url = storeId
        ? `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`
        : `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;

      const result = await server.makePinMeToRequest(url, requestContext);

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
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: {
          data: result.data,
          ...(lagWarning && lagWarning)
        }
      };
    }
  );
}

// ============================================================================
// Review Insights Cache
// ============================================================================

/**
 * Cache entry for review insights.
 * Longer TTL than raw reviews since the analysis pass is expensive.
 */
interface InsightsCacheEntry {
  data: ReviewInsightsData;
  metadata: ReviewInsightsMetadata;
  /**
   * Stored so cache hits return the same warning as the fresh response.
   * Without it, the second identical request within the TTL silently drops
   * SAMPLED_ANALYSIS / UNDIFFERENTIATED_ANALYSIS_TYPE.
   */
  warningCode?: ReviewInsightsWarningCode;
  timestamp: number;
}

/**
 * Review insights cache - separate from raw reviews cache.
 * Key format based on all analysis parameters.
 */
const insightsCache = new Map<string, InsightsCacheEntry>();

/**
 * Insights cache TTL in milliseconds (1 hour - longer than raw reviews since analysis is expensive)
 */
const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;

const REVIEW_INSIGHTS_CHOICE_KEY = 'reviewAnalysisChoice';

const MediumDatasetChoiceSchema = z.object({
  choice: z.enum(['proceed_full', 'representative_sample', 'recent_weighted'])
});

const LargeDatasetChoiceSchema = z.object({
  choice: z.enum(['representative_sample', 'recent_weighted'])
});

type ReviewInsightsChoice = z.infer<typeof MediumDatasetChoiceSchema>['choice'];

function formatReviewInsightsElicitationMessage(
  warning: LargeDatasetWarning,
  analysisNote?: string
): string {
  const options = warning.options
    .map(
      option =>
        `- ${option.option}: ${option.description} ` +
        `(${formatTokenEstimate(option.estimatedTokens)} estimated)`
    )
    .join('\n');
  return (
    `${warning.message}\n\nOptions:\n${options}` +
    (analysisNote ? `\n\nNote: ${analysisNote}.` : '')
  );
}

/**
 * Modern requests carry capabilities in their per-request envelope. Legacy
 * requests use the capabilities captured during initialize.
 */
function supportsFormElicitation(server: PinMeToMcpServer, requestContext: ServerContext): boolean {
  const envelope = requestContext.mcpReq.envelope as Record<string, unknown> | undefined;
  const capabilities =
    (envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined) ??
    server.server.getClientCapabilities();
  const elicitation = capabilities?.elicitation;
  if (!elicitation) return false;

  // A bare elicitation capability is the legacy spelling for form support.
  return elicitation.form !== undefined || elicitation.url === undefined;
}

function formatReviewInsightsConfirmation(
  warning: LargeDatasetWarning,
  responseFormat: ResponseFormat,
  analysisNote?: string
) {
  const baseText =
    responseFormat === 'markdown'
      ? formatLargeDatasetWarningAsMarkdown(warning)
      : JSON.stringify({
          requiresConfirmation: true,
          largeDatasetWarning: warning,
          ...(analysisNote && { analysisNote })
        });
  const textContent = analysisNote ? `${baseText}\n\nNote: ${analysisNote}.` : baseText;

  return {
    content: [{ type: 'text' as const, text: textContent }],
    structuredContent: {
      requiresConfirmation: true,
      largeDatasetWarning: warning,
      warningCode: 'LARGE_DATASET_WARNING' as const,
      ...(analysisNote && { analysisNote })
    }
  };
}

function invalidReviewInsightsChoice(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    structuredContent: {
      error: `Error: ${message}`,
      errorCode: 'BAD_REQUEST' as const,
      retryable: false
    }
  };
}

// ============================================================================
// Review Insights Tool
// ============================================================================

/**
 * Compute statistical insights over Google reviews (ratings, sentiment
 * distribution, recurring themes) without returning the raw review text.
 */
export function getGoogleReviewInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_review_insights',
    {
      title: 'Google review analysis',
      description:
        'Summarize Google reviews into rating and sentiment statistics.\n\n' +
        'Computes aggregates over the matched reviews server-side and returns the summary ' +
        'instead of the raw reviews, which is far more token-efficient than fetching them. ' +
        'The returned data is descriptive statistics, not LLM-written prose: read it and ' +
        'draw your own conclusions for the user.\n\n' +
        'Analysis Types:\n' +
        '  - summary: Average rating, sentiment breakdown, rating distribution\n' +
        '  - comparison: The above, plus per-location metrics ranked by rating\n' +
        '  - issues, trends, themes: Accepted, but currently return the same payload as\n' +
        '    summary. No theme extraction, issue clustering, or period comparison is\n' +
        '    performed, and the response is flagged with warningCode\n' +
        '    UNDIFFERENTIATED_ANALYSIS_TYPE. To analyze review text, fetch\n' +
        '    pinmeto_get_google_reviews and read it yourself.\n\n' +
        'Large Dataset Handling:\n' +
        '  - <200 reviews: Processed immediately\n' +
        '  - 200-1000: Processed with token estimate in metadata\n' +
        '  - 1000-10000: Returns warning with options (set skipConfirmation=true to proceed)\n' +
        '  - >10000: Requires sampling strategy (representative or recent_weighted)\n\n' +
        'Sampling Strategies (which reviews get analyzed):\n' +
        '  - full: Analyze all reviews (default for <10000 reviews)\n' +
        '  - representative: Stratified sample by rating and location\n' +
        '  - recent_weighted: Prioritize recent reviews\n\n' +
        'Caching:\n' +
        '  - Results cached for 1 hour\n' +
        '  - Use forceRefresh=true to bypass cache\n\n' +
        'When NOT to use this tool:\n' +
        '  - Need raw review text: Use pinmeto_get_google_reviews\n' +
        '  - Need only aggregate stats: Use pinmeto_get_google_ratings\n' +
        '  - Need specific review lookup: Use pinmeto_get_google_reviews with filters',
      inputSchema: {
        storeIds: z
          .array(z.string())
          .optional()
          .describe('Optional store IDs to analyze (omit for all locations)'),
        from: DateSchema.describe('Start date (YYYY-MM-DD)'),
        to: DateSchema.describe('End date (YYYY-MM-DD)'),
        analysisType: AnalysisTypeSchema.describe(
          'Type of analysis: summary, issues, comparison, trends, or themes'
        ),
        samplingStrategy: SamplingStrategySchema.optional()
          .default('full')
          .describe('Sampling strategy: full (default), representative, or recent_weighted'),
        skipConfirmation: z
          .boolean()
          .optional()
          .default(false)
          .describe('Skip large dataset confirmation (set true after receiving warning)'),
        themes: z
          .array(z.string())
          .optional()
          .describe('Currently ignored - no theme extraction is performed'),
        minRating: z.number().min(1).max(5).optional().describe('Minimum rating filter (1-5)'),
        maxRating: z.number().min(1).max(5).optional().describe('Maximum rating filter (1-5)'),
        forceRefresh: z
          .boolean()
          .optional()
          .default(false)
          .describe('Bypass cache and regenerate analysis'),
        response_format: ResponseFormatSchema
      },
      outputSchema: ReviewInsightsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      storeIds,
      from,
      to,
      analysisType,
      samplingStrategy = 'full',
      skipConfirmation = false,
      themes,
      minRating,
      maxRating,
      forceRefresh = false,
      response_format = 'json'
    }: {
      storeIds?: string[];
      from: string;
      to: string;
      analysisType: AnalysisType;
      samplingStrategy?: SamplingStrategy;
      skipConfirmation?: boolean;
      themes?: string[];
      minRating?: number;
      maxRating?: number;
      forceRefresh?: boolean;
      response_format?: ResponseFormat;
    }, requestContext) => {
      const { accountId } = server.configs;

      // Validate filter combination
      if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Error: minRating cannot be greater than maxRating' }],
          structuredContent: {
            error: 'Error: minRating cannot be greater than maxRating',
            errorCode: 'BAD_REQUEST',
            retryable: false
          }
        };
      }

      // Only 'summary' and 'comparison' produce distinct output. Every other
      // analysisType resolves to the same summary payload, so say so rather
      // than returning something other than what was asked for in silence.
      // Resolved before the cache lookup so every return path can carry it.
      const isUndifferentiated = analysisType !== 'summary' && analysisType !== 'comparison';
      const analysisNote = isUndifferentiated
        ? `analysisType '${analysisType}' currently returns the same payload as 'summary' - ` +
          `no theme extraction, issue clustering, or period comparison is performed. ` +
          `Fetch pinmeto_get_google_reviews to analyze review text directly`
        : undefined;

      const confirmationResponse = inputResponse(
        requestContext.mcpReq.inputResponses,
        REVIEW_INSIGHTS_CHOICE_KEY
      );

      // Check cache first (unless forceRefresh)
      let cacheKey = buildInsightsCacheKey({
        accountId,
        storeIds,
        from,
        to,
        analysisType,
        minRating,
        maxRating,
        samplingStrategy,
        themes
      });

      // A resumed confirmation must be evaluated before a cached analysis can
      // complete the call. In particular, cancelled or forged choices must
      // never be hidden by a cache hit.
      if (!forceRefresh && confirmationResponse.kind === 'missing') {
        const cached = insightsCache.get(cacheKey);
        if (cached) {
          const ageMs = Date.now() - cached.timestamp;
          if (ageMs < INSIGHTS_CACHE_TTL_MS) {
            // Serve from cache
            const cachedMetadata: ReviewInsightsMetadata = {
              ...cached.metadata,
              cache: {
                hit: true,
                cachedAt: new Date(cached.timestamp).toISOString(),
                expiresAt: new Date(cached.timestamp + INSIGHTS_CACHE_TTL_MS).toISOString(),
                ttl: INSIGHTS_CACHE_TTL_MS / 1000
              }
            };

            const textContent =
              response_format === 'markdown'
                ? formatReviewInsightsAsMarkdown(cached.data, cachedMetadata)
                : JSON.stringify({ data: cached.data, metadata: cachedMetadata });

            return {
              content: [{ type: 'text' as const, text: textContent }],
              structuredContent: {
                data: cached.data,
                metadata: cachedMetadata,
                ...(cached.warningCode && { warningCode: cached.warningCode })
              }
            };
          } else {
            // Cache expired
            insightsCache.delete(cacheKey);
          }
        }
      }

      // Fetch reviews for analysis
      // Use storeIds to fetch from multiple locations or all if not specified
      let allReviews: RawReview[] = [];

      // Track store fetch failures for error reporting
      const storeFailures: Array<{ storeId: string; error: ApiError }> = [];

      if (storeIds && storeIds.length > 0) {
        // Fetch reviews for specific stores in parallel
        const fetchPromises = storeIds.map(storeId =>
          getCachedOrFetchReviews(server, storeId, from, to, forceRefresh, requestContext)
        );
        const results = await Promise.all(fetchPromises);

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.ok) {
            allReviews.push(...result.data);
          } else {
            // Track failure with store ID for error reporting
            storeFailures.push({ storeId: storeIds[i], error: result.error });
          }
        }

        // If ALL stores failed, return error with first failure details
        if (storeIds.length > 0 && allReviews.length === 0 && storeFailures.length > 0) {
          const failedStoreIds = storeFailures.map(f => f.storeId).join(', ');
          return formatErrorResponse(
            storeFailures[0].error,
            `all requested stores (${failedStoreIds})`
          );
        }
      } else {
        // Fetch all reviews
        const result = await getCachedOrFetchReviews(server, undefined, from, to, forceRefresh, requestContext);
        if (!result.ok) {
          return formatErrorResponse(result.error, `all Google reviews (${from} to ${to})`);
        }
        allReviews = result.data;
      }

      // Apply rating filters
      if (minRating !== undefined) {
        allReviews = allReviews.filter(r => r.rating >= minRating);
      }
      if (maxRating !== undefined) {
        allReviews = allReviews.filter(r => r.rating <= maxRating);
      }

      // Get unique store count
      const uniqueStoreIds = new Set(allReviews.map(r => r.storeId));
      const locationCount = uniqueStoreIds.size;

      // Check if we have any reviews
      if (allReviews.length === 0) {
        const metadata: ReviewInsightsMetadata = {
          locationCount: 0,
          totalReviewCount: 0,
          analyzedReviewCount: 0,
          dateRange: { from, to },
          analysisType,
          analysisMethod: 'statistical',
          generatedAt: new Date().toISOString(),
          // Absent data outranks the analysisType caveat for warningCode, so
          // carry the caveat in metadata rather than dropping it entirely.
          ...(analysisNote && { analysisNote })
        };

        return {
          content: [
            {
              type: 'text' as const,
              text:
                response_format === 'markdown'
                  ? '# Review Insights\n\nNo reviews found matching the specified criteria.'
                  : JSON.stringify({ data: null, metadata, warning: 'No reviews found' })
            }
          ],
          structuredContent: {
            data: null,
            metadata,
            warning: 'No reviews found matching the specified criteria.',
            warningCode: 'INCOMPLETE_DATA'
          }
        };
      }

      const totalReviewCount = allReviews.length;
      const estimatedTokensForFull = estimateTokens(totalReviewCount);

      // Check thresholds and handle large dataset warning
      const { warningRequired, forceSamplingRequired } = REVIEW_INSIGHTS_THRESHOLDS;

      // Large dataset requiring explicit sampling strategy
      if (totalReviewCount > forceSamplingRequired && samplingStrategy === 'full') {
        const warning: LargeDatasetWarning = {
          totalReviewCount,
          locationCount,
          dateRange: { from, to },
          estimatedTokens: estimatedTokensForFull,
          estimatedTokensFormatted: formatTokenEstimate(estimatedTokensForFull),
          message: `Dataset contains ${totalReviewCount.toLocaleString()} reviews. ` +
            `Full analysis would use ${formatTokenEstimate(estimatedTokensForFull)}. ` +
            `Please select a sampling strategy.`,
          options: [
            {
              option: 'representative_sample',
              description:
                'Stratified sample covering all ratings and locations proportionally',
              estimatedTokens: estimateTokens(Math.min(totalReviewCount, 1000)),
              parameters: {
                samplingStrategy: 'representative',
                skipConfirmation: true
              }
            },
            {
              option: 'recent_weighted',
              description: 'Prioritize recent reviews with light historical sampling',
              estimatedTokens: estimateTokens(Math.min(totalReviewCount, 1000)),
              parameters: {
                samplingStrategy: 'recent_weighted',
                skipConfirmation: true
              }
            }
          ]
        };

        // Surface the analysisType caveat here too. warningCode stays
        // LARGE_DATASET_WARNING because the caller keys off it to know a
        // re-call is required - but without this note they would only learn
        // their analysisType is undifferentiated after that second round trip.
        if (!supportsFormElicitation(server, requestContext)) {
          return formatReviewInsightsConfirmation(warning, response_format, analysisNote);
        }

        if (confirmationResponse.kind === 'missing') {
          // Do not round-trip dataset facts in requestState. The resumed call
          // fetches the reviews again and re-applies the current threshold, so
          // no client-controlled state can relax the sampling requirement.
          return inputRequired({
            inputRequests: {
              [REVIEW_INSIGHTS_CHOICE_KEY]: inputRequired.elicit({
                message: formatReviewInsightsElicitationMessage(warning, analysisNote),
                requestedSchema: LargeDatasetChoiceSchema
              })
            }
          });
        }

        if (confirmationResponse.kind !== 'elicit') {
          return invalidReviewInsightsChoice('Unexpected response to review analysis confirmation');
        }
        if (confirmationResponse.action !== 'accept') {
          return formatReviewInsightsConfirmation(warning, response_format, analysisNote);
        }

        const accepted = acceptedContent(
          requestContext.mcpReq.inputResponses,
          REVIEW_INSIGHTS_CHOICE_KEY,
          LargeDatasetChoiceSchema
        );
        if (!accepted) {
          return invalidReviewInsightsChoice(
            'Invalid sampling choice for a dataset over 10,000 reviews'
          );
        }
        samplingStrategy =
          accepted.choice === 'representative_sample' ? 'representative' : 'recent_weighted';
      }

      // Medium dataset requiring confirmation
      if (
        totalReviewCount > warningRequired &&
        totalReviewCount <= forceSamplingRequired &&
        !skipConfirmation &&
        samplingStrategy === 'full'
      ) {
        const warning: LargeDatasetWarning = {
          totalReviewCount,
          locationCount,
          dateRange: { from, to },
          estimatedTokens: estimatedTokensForFull,
          estimatedTokensFormatted: formatTokenEstimate(estimatedTokensForFull),
          message: `Dataset contains ${totalReviewCount.toLocaleString()} reviews ` +
            `(${formatTokenEstimate(estimatedTokensForFull)} estimated). ` +
            `Confirm to proceed or select a sampling strategy.`,
          options: [
            {
              option: 'proceed_full',
              description: 'Analyze all reviews (may take longer and use more tokens)',
              estimatedTokens: estimatedTokensForFull,
              parameters: { skipConfirmation: true }
            },
            {
              option: 'representative_sample',
              description:
                'Stratified sample covering all ratings and locations proportionally',
              estimatedTokens: estimateTokens(Math.min(totalReviewCount, 500)),
              parameters: {
                samplingStrategy: 'representative',
                skipConfirmation: true
              }
            },
            {
              option: 'recent_weighted',
              description: 'Prioritize recent reviews with light historical sampling',
              estimatedTokens: estimateTokens(Math.min(totalReviewCount, 500)),
              parameters: {
                samplingStrategy: 'recent_weighted',
                skipConfirmation: true
              }
            }
          ]
        };

        // Surface the analysisType caveat here too. warningCode stays
        // LARGE_DATASET_WARNING because the caller keys off it to know a
        // re-call is required - but without this note they would only learn
        // their analysisType is undifferentiated after that second round trip.
        if (!supportsFormElicitation(server, requestContext)) {
          return formatReviewInsightsConfirmation(warning, response_format, analysisNote);
        }

        if (confirmationResponse.kind === 'missing') {
          return inputRequired({
            inputRequests: {
              [REVIEW_INSIGHTS_CHOICE_KEY]: inputRequired.elicit({
                message: formatReviewInsightsElicitationMessage(warning, analysisNote),
                requestedSchema: MediumDatasetChoiceSchema
              })
            }
          });
        }

        if (confirmationResponse.kind !== 'elicit') {
          return invalidReviewInsightsChoice('Unexpected response to review analysis confirmation');
        }
        if (confirmationResponse.action !== 'accept') {
          return formatReviewInsightsConfirmation(warning, response_format, analysisNote);
        }

        const accepted = acceptedContent(
          requestContext.mcpReq.inputResponses,
          REVIEW_INSIGHTS_CHOICE_KEY,
          MediumDatasetChoiceSchema
        );
        if (!accepted) {
          return invalidReviewInsightsChoice('Invalid review analysis confirmation choice');
        }

        const choice: ReviewInsightsChoice = accepted.choice;
        if (choice === 'representative_sample') samplingStrategy = 'representative';
        if (choice === 'recent_weighted') samplingStrategy = 'recent_weighted';
        // proceed_full retains the caller's full strategy. The accepted,
        // schema-validated response is the confirmation for this round.
      }

      // An MRTR choice can change the strategy while the original tool
      // arguments remain byte-for-byte identical, so cache under the actual
      // analysis that will run.
      cacheKey = buildInsightsCacheKey({
        accountId,
        storeIds,
        from,
        to,
        analysisType,
        minRating,
        maxRating,
        samplingStrategy,
        themes
      });

      // Sanitize reviews and apply sampling strategy
      const sanitized = sanitizeReviews(allReviews);

      const reviewsToAnalyze = applySamplingStrategy(sanitized, samplingStrategy);
      const analyzedReviewCount = reviewsToAnalyze.length;

      // Analysis is statistical: ratings, sentiment, distributions and keyword
      // themes computed in-process. This tool previously delegated to MCP
      // Sampling for LLM-written summaries, but Sampling is deprecated as of
      // MCP 2026-07-28 and no client our customers use ever implemented it, so
      // the fallback was the only path that ever ran.
      const analysisMethod: AnalysisMethod = 'statistical';
      const analysisData: ReviewInsightsData =
        analysisType === 'comparison'
          ? performStatisticalLocationComparison(reviewsToAnalyze)
          : performStatisticalAnalysis(reviewsToAnalyze);
      let samplingNote: string | undefined;

      // Add sampling note for non-full strategies
      if (samplingStrategy !== 'full' && !samplingNote) {
        samplingNote = `Used ${samplingStrategy} sampling: analyzed ${analyzedReviewCount} of ${totalReviewCount} reviews`;
      }

      // Add partial store failure warning if some (but not all) stores failed
      if (storeFailures.length > 0 && allReviews.length > 0) {
        const failureNote = `${storeFailures.length} of ${storeIds!.length} stores failed to fetch: ${storeFailures.map(f => f.storeId).join(', ')}`;
        samplingNote = samplingNote ? `${samplingNote}. ${failureNote}` : failureNote;
      }

      // Single warning code by priority: not getting the requested analysis at
      // all outranks having analyzed only a subset of reviews.
      const warningCode: ReviewInsightsWarningCode | undefined = isUndifferentiated
        ? 'UNDIFFERENTIATED_ANALYSIS_TYPE'
        : samplingStrategy !== 'full'
          ? 'SAMPLED_ANALYSIS'
          : undefined;

      // Build metadata
      const metadata: ReviewInsightsMetadata = {
        locationCount,
        totalReviewCount,
        analyzedReviewCount,
        dateRange: { from, to },
        analysisType,
        analysisMethod,
        generatedAt: new Date().toISOString(),
        ...(samplingStrategy !== 'full' && { samplingStrategy }),
        ...(samplingNote && { samplingNote }),
        ...(analysisNote && { analysisNote })
      };

      // Cache the result, warning included - a cache hit must not look like a
      // cleaner result than the fresh response it stands in for.
      insightsCache.set(cacheKey, {
        data: analysisData,
        metadata,
        warningCode,
        timestamp: Date.now()
      });

      // Format output
      const textContent =
        response_format === 'markdown'
          ? formatReviewInsightsAsMarkdown(analysisData, metadata)
          : JSON.stringify({ data: analysisData, metadata });

      return {
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: {
          data: analysisData,
          metadata,
          ...(warningCode && { warningCode })
        }
      };
    }
  );
}
