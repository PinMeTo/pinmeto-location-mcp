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
  isValidDate
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
  Review
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
  InsightsFormatOptions
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
 * Build cache key for reviews
 */
function buildReviewsCacheKey(accountId: string, storeId: string | undefined, from: string, to: string): string {
  return `${accountId}-${storeId || 'all'}-${from}-${to}`;
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
      // Unexpected object shape - log for debugging
      console.error(
        `[getCachedOrFetchReviews] Unexpected API response shape (object without recognized fields): ${JSON.stringify(rawData).slice(0, 200)}`
      );
      reviews = [];
    }
  } else {
    // Unexpected non-object response - log for debugging
    console.error(
      `[getCachedOrFetchReviews] Unexpected API response type: ${typeof rawData}, value: ${JSON.stringify(rawData).slice(0, 100)}`
    );
    reviews = [];
  }

  // Cache all results (including empty - they're valid for locations with no reviews)
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
    const summary = summaries[0];
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
