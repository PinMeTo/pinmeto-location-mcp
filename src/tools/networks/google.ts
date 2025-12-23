import { z } from 'zod';
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
  RawReview as InsightsRawReview,
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
import {
  buildSamplingRequest,
  parseSamplingResponse,
  normalizeResponseData,
  processInBatches,
  SamplingResponse,
  DEFAULT_BATCH_SIZE
} from '../../sampling';

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
 * Raw review data from PinMeTo API (before transformation to our schema)
 */
interface RawReview {
  storeId: string;
  rating: number;
  comment?: string;
  date?: string;
  hasAnswer?: boolean;
  reply?: string;
  replyDate?: string;
  id?: string;
}

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
  forceRefresh: boolean = false
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

  const result = await server.makePinMeToRequest(url);

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

        const priorResult = await server.makePinMeToRequest(priorUrl);

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
        content: [{ type: 'text', text: textContent }],
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
    }) => {
      // Check for data lag warning
      const lagWarning = checkGoogleDataLag(to);

      // Fetch reviews (from cache or API)
      const result = await getCachedOrFetchReviews(server, storeId, from, to, forceRefresh);

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
        content: [{ type: 'text', text: textContent }],
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
    }) => {
      // Validate filter combination
      if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: minRating cannot be greater than maxRating' }],
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
      const result = await getCachedOrFetchReviews(server, storeId, from, to, forceRefresh);

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
        content: [{ type: 'text', text: textContent }],
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

// ============================================================================
// Review Insights Cache
// ============================================================================

/**
 * Cache entry for review insights.
 * Longer TTL than raw reviews since AI analysis is expensive.
 */
interface InsightsCacheEntry {
  data: ReviewInsightsData;
  metadata: ReviewInsightsMetadata;
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

// ============================================================================
// Review Insights Tool
// ============================================================================

/**
 * Fetch AI-powered insights from Google reviews using MCP Sampling.
 * Falls back to statistical analysis when sampling is unavailable.
 */
export function getGoogleReviewInsights(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_google_review_insights',
    {
      description:
        'Analyze Google reviews using AI to extract insights, themes, and issues.\n\n' +
        'This tool uses MCP Sampling to process reviews server-side and return summarized insights ' +
        'instead of raw review data. This is far more token-efficient than fetching raw reviews.\n\n' +
        'Analysis Types:\n' +
        '  - summary: Executive summary with sentiment analysis and key themes\n' +
        '  - issues: Detailed breakdown of problems mentioned in negative reviews\n' +
        '  - comparison: Compare performance across multiple locations\n' +
        '  - trends: Compare current period with previous period\n' +
        '  - themes: Deep dive into specific themes (provide themes parameter)\n\n' +
        'Large Dataset Handling:\n' +
        '  - <200 reviews: Processed immediately\n' +
        '  - 200-1000: Processed with token estimate in metadata\n' +
        '  - 1000-10000: Returns warning with options (set skipConfirmation=true to proceed)\n' +
        '  - >10000: Requires sampling strategy (representative or recent_weighted)\n\n' +
        'Sampling Strategies:\n' +
        '  - full: Analyze all reviews (default for <10000 reviews)\n' +
        '  - representative: Stratified sample by rating and location\n' +
        '  - recent_weighted: Prioritize recent reviews\n\n' +
        'Caching:\n' +
        '  - AI-generated insights cached for 1 hour\n' +
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
          .describe('Specific themes to analyze (only for themes analysisType)'),
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
    }) => {
      const { accountId } = server.configs;

      // Validate filter combination
      if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Error: minRating cannot be greater than maxRating' }],
          structuredContent: {
            error: 'Error: minRating cannot be greater than maxRating',
            errorCode: 'BAD_REQUEST',
            retryable: false
          }
        };
      }

      // Check cache first (unless forceRefresh)
      const cacheKey = buildInsightsCacheKey({
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

      if (!forceRefresh) {
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
              content: [{ type: 'text', text: textContent }],
              structuredContent: {
                data: cached.data,
                metadata: cachedMetadata
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

      if (storeIds && storeIds.length > 0) {
        // Fetch reviews for specific stores in parallel
        const fetchPromises = storeIds.map(storeId =>
          getCachedOrFetchReviews(server, storeId, from, to, forceRefresh)
        );
        const results = await Promise.all(fetchPromises);

        for (const result of results) {
          if (result.ok) {
            allReviews.push(...result.data);
          }
          // Silently skip failed stores - we can analyze what we have
        }
      } else {
        // Fetch all reviews
        const result = await getCachedOrFetchReviews(server, undefined, from, to, forceRefresh);
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
          generatedAt: new Date().toISOString()
        };

        return {
          content: [
            {
              type: 'text',
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

        const textContent =
          response_format === 'markdown'
            ? formatLargeDatasetWarningAsMarkdown(warning)
            : JSON.stringify({ requiresConfirmation: true, largeDatasetWarning: warning });

        return {
          content: [{ type: 'text', text: textContent }],
          structuredContent: {
            requiresConfirmation: true,
            largeDatasetWarning: warning,
            warningCode: 'LARGE_DATASET_WARNING'
          }
        };
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

        const textContent =
          response_format === 'markdown'
            ? formatLargeDatasetWarningAsMarkdown(warning)
            : JSON.stringify({ requiresConfirmation: true, largeDatasetWarning: warning });

        return {
          content: [{ type: 'text', text: textContent }],
          structuredContent: {
            requiresConfirmation: true,
            largeDatasetWarning: warning,
            warningCode: 'LARGE_DATASET_WARNING'
          }
        };
      }

      // Sanitize reviews and apply sampling strategy
      const sanitized = sanitizeReviews(
        allReviews.map(r => ({
          id: r.id,
          storeId: r.storeId,
          rating: r.rating,
          comment: r.comment,
          date: r.date || '',
          hasAnswer: r.hasAnswer,
          reply: r.reply,
          replyDate: r.replyDate
        }))
      );

      const reviewsToAnalyze = applySamplingStrategy(sanitized, samplingStrategy);
      const analyzedReviewCount = reviewsToAnalyze.length;

      // Determine analysis method and perform analysis
      let analysisData: ReviewInsightsData;
      let analysisMethod: AnalysisMethod;
      let samplingNote: string | undefined;

      // Check if MCP Sampling is supported
      const samplingSupported = await checkSamplingSupport(server);

      if (samplingSupported) {
        // Use AI-powered analysis via MCP Sampling
        analysisMethod = 'ai_sampling';

        try {
          // Build the sampling function that wraps server.server.createMessage
          const samplingFn = async (
            request: ReturnType<typeof buildSamplingRequest>
          ): Promise<SamplingResponse> => {
            // Access underlying SDK server for sampling
            const sdkServer = (server as any).server;
            if (!sdkServer || typeof sdkServer.createMessage !== 'function') {
              throw new Error('MCP Sampling not available');
            }

            const response = await sdkServer.createMessage({
              messages: request.messages,
              maxTokens: request.maxTokens,
              systemPrompt: request.systemPrompt,
              includeContext: request.includeContext,
              temperature: request.temperature
            });

            return {
              role: 'assistant',
              content: response.content,
              model: response.model,
              stopReason: response.stopReason
            };
          };

          // Check if we need batching
          if (analyzedReviewCount > DEFAULT_BATCH_SIZE) {
            // Process in batches
            const batchResult = await processInBatches(
              reviewsToAnalyze,
              { analysisType, themes },
              samplingFn
            );
            analysisData = batchResult.data;

            if (!batchResult.complete) {
              samplingNote = `Analysis completed with ${batchResult.batchCount} batches. ` +
                `Some batches may have had issues: ${batchResult.errors?.join('; ')}`;
            }
          } else {
            // Single pass analysis
            const request = buildSamplingRequest(reviewsToAnalyze, {
              analysisType,
              themes,
              maxQuotes: 5
            });
            const response = await samplingFn(request);
            const parsed = parseSamplingResponse(response, analysisType);
            analysisData = normalizeResponseData(parsed, analysisType);
          }
        } catch (e) {
          // Sampling failed - fall back to statistical analysis
          console.error('MCP Sampling failed, falling back to statistical analysis:', e);
          analysisMethod = 'statistical';
          analysisData =
            analysisType === 'comparison'
              ? performStatisticalLocationComparison(reviewsToAnalyze)
              : performStatisticalAnalysis(reviewsToAnalyze);
          samplingNote = 'AI analysis failed, using statistical fallback';
        }
      } else {
        // Use statistical fallback
        analysisMethod = 'statistical';
        analysisData =
          analysisType === 'comparison'
            ? performStatisticalLocationComparison(reviewsToAnalyze)
            : performStatisticalAnalysis(reviewsToAnalyze);
        samplingNote = 'AI sampling not supported by client, using statistical analysis';
      }

      // Add sampling note for non-full strategies
      if (samplingStrategy !== 'full' && !samplingNote) {
        samplingNote = `Used ${samplingStrategy} sampling: analyzed ${analyzedReviewCount} of ${totalReviewCount} reviews`;
      }

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
        ...(samplingNote && { samplingNote })
      };

      // Cache the result
      insightsCache.set(cacheKey, {
        data: analysisData,
        metadata,
        timestamp: Date.now()
      });

      // Format output
      const textContent =
        response_format === 'markdown'
          ? formatReviewInsightsAsMarkdown(analysisData, metadata)
          : JSON.stringify({ data: analysisData, metadata });

      return {
        content: [{ type: 'text', text: textContent }],
        structuredContent: {
          data: analysisData,
          metadata,
          ...(samplingNote && analysisMethod === 'statistical' && { warningCode: 'SAMPLING_NOT_SUPPORTED' as const }),
          ...(samplingStrategy !== 'full' && { warningCode: 'SAMPLED_ANALYSIS' as const })
        }
      };
    }
  );
}

/**
 * Check if MCP Sampling is supported by the connected client.
 * Returns true if sampling capability is available.
 */
async function checkSamplingSupport(server: PinMeToMcpServer): Promise<boolean> {
  try {
    // Access underlying SDK server
    const sdkServer = (server as any).server;
    if (!sdkServer) {
      return false;
    }

    // Check if createMessage method exists
    if (typeof sdkServer.createMessage !== 'function') {
      return false;
    }

    // The sampling capability is determined by the client during connection
    // The server can attempt to use it and handle errors gracefully
    return true;
  } catch {
    return false;
  }
}
