import { z } from 'zod';
import { API_ERROR_CODES } from '../errors';

// ============================================================================
// Response Format Schema
// ============================================================================

/**
 * Response format parameter - shared across all tools.
 * Controls whether the content.text field returns JSON or Markdown.
 *
 * - json (default): Token-efficient structured data
 * - markdown: Human-readable with headers and tables
 *
 * Note: structuredContent always contains typed data regardless of format.
 */
export const ResponseFormatSchema = z
  .enum(['json', 'markdown'])
  .optional()
  .default('json')
  .describe(
    'Response format: "json" (default, token-efficient) or "markdown" (human-readable with tables)'
  );

export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;

// ============================================================================
// Error Schema
// ============================================================================

/**
 * Standard error fields for all tool outputs.
 * Enables programmatic error handling by AI clients.
 *
 * Derived from API_ERROR_CODES in errors.ts to ensure consistency
 * between TypeScript types and Zod validation.
 */
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Single metric value for multi-period insights (daily, weekly, monthly, etc.).
 * Comparison fields are flat on the object (no nested wrapper) when compare_with is specified.
 */
export const InsightValueSchema = z.object({
  period: z
    .string()
    .describe('Date or period identifier (e.g., "2024-01-15", "2024-01", "2024-Q1")'),
  periodLabel: z
    .string()
    .optional()
    .describe('Human-readable period label (e.g., "January 2024", "Q1 2024")'),
  value: z.number().describe('Numeric metric value'),
  // Flat comparison fields (present only when compare_with is specified)
  priorValue: z.number().optional().describe('Prior period value'),
  priorPeriod: z.string().optional().describe('Prior period identifier'),
  priorPeriodLabel: z.string().optional().describe('Human-readable prior period label'),
  delta: z.number().optional().describe('Absolute change (value - priorValue)'),
  deltaPercent: z
    .number()
    .nullable()
    .optional()
    .describe('Percentage change ((value - priorValue) / priorValue * 100). Null if priorValue is 0')
});

/**
 * Multi-period insights structure - contains time-series values for a metric.
 * Used when aggregation is daily, weekly, monthly, quarterly, half-yearly, or yearly.
 */
export const InsightSchema = z.object({
  metric: z.string().describe('Metric dimension name (e.g., "views", "clicks", "searches")'),
  values: z.array(InsightValueSchema).describe('Array of metric values by period')
});

/**
 * Flattened insight for total aggregation - single value per metric.
 * Comparison fields are flat on the object when compare_with is specified.
 * Used when aggregation=total (default) for simpler AI consumption.
 */
export const FlatInsightSchema = z.object({
  metric: z.string().describe('Metric dimension name (e.g., "views", "clicks", "searches")'),
  value: z.number().describe('Total aggregated value'),
  priorValue: z.number().optional().describe('Prior period total value'),
  delta: z.number().optional().describe('Absolute change (value - priorValue)'),
  deltaPercent: z
    .number()
    .nullable()
    .optional()
    .describe('Percentage change. Null if priorValue is 0')
});

// Legacy aliases for backwards compatibility in internal code during migration
export const MetricDataSchema = InsightValueSchema;
export const InsightsDataSchema = z.object({
  key: z.string().describe('Metric dimension name (e.g., "views", "clicks", "searches")'),
  metrics: z.array(InsightValueSchema).describe('Array of metric data points')
});

// ============================================================================
// Comparison Period Schema
// ============================================================================

/**
 * Date range schema for comparison periods.
 * Validates format and ensures from <= to chronologically.
 */
export const DateRangeSchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
      .describe('Start date (YYYY-MM-DD)'),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
      .describe('End date (YYYY-MM-DD)')
  })
  .refine(data => data.from <= data.to, {
    message: 'from date must not be after to date',
    path: ['from']
  });

/**
 * Period range schema - describes the date range for insights data.
 */
export const PeriodRangeSchema = DateRangeSchema.describe('Date range for the insights data');

/**
 * @deprecated Use PeriodRangeSchema instead. Kept for backwards compatibility.
 */
export const ComparisonPeriodSchema = z.object({
  current: DateRangeSchema.describe('Current period date range'),
  prior: DateRangeSchema.describe('Prior period date range')
});

/**
 * Warning codes for data validation issues.
 */
export const WarningCodeSchema = z.enum(['INCOMPLETE_DATA']);

/**
 * Cache information schema for queries with caching support.
 */
export const CacheInfoSchema = z.object({
  cached: z.boolean().describe('Whether data was served from cache'),
  ageSeconds: z.number().optional().describe('Cache age in seconds'),
  totalCached: z.number().optional().describe('Total items in cache'),
  stale: z
    .boolean()
    .optional()
    .describe('Whether cache data is stale and being refreshed in background')
});

// ============================================================================
// Location Sub-Schemas
// ============================================================================

/**
 * Address structure for locations.
 * Uses passthrough to allow extra API fields.
 */
export const AddressSchema = z
  .object({
    street: z.string().optional().describe('Street address'),
    city: z.string().optional().describe('City name'),
    zip: z.string().optional().describe('Postal/ZIP code'),
    country: z.string().optional().describe('Country name')
  })
  .passthrough();

/**
 * Contact information for locations.
 * Uses passthrough to allow extra API fields.
 * Note: email/homepage validators are lenient to handle empty strings from API
 */
export const ContactSchema = z
  .object({
    phone: z.string().optional().describe('Phone number'),
    email: z.string().optional().describe('Email address'),
    homepage: z.string().optional().describe('Website URL')
  })
  .passthrough();

/**
 * Open hours structure - maps day names to hour data.
 * API returns objects with open/close times, not simple strings.
 */
export const OpenHoursSchema = z
  .record(z.string(), z.unknown())
  .describe('Day to hours mapping (e.g., "mon": { open: "09:00", close: "17:00" })');

// ============================================================================
// Keywords Schema
// ============================================================================

/**
 * Keyword data structure from Google keywords API.
 * Uses passthrough to allow extra API fields.
 */
export const KeywordDataSchema = z
  .object({
    keyword: z.string().describe('Search keyword'),
    value: z.number().nonnegative().describe('Impression count'),
    locationCounts: z
      .number()
      .nonnegative()
      .optional()
      .describe('Number of locations with this keyword')
  })
  .passthrough();

// ============================================================================
// Ratings Schemas
// ============================================================================

/**
 * Ratings summary - aggregate stats for a location.
 * Uses passthrough to allow extra API fields.
 */
export const RatingsSummarySchema = z
  .object({
    averageRating: z.number().min(1).max(5).optional().describe('Average rating (1-5)'),
    totalReviews: z.number().nonnegative().optional().describe('Total number of reviews'),
    distribution: z
      .record(z.string(), z.number().nonnegative())
      .optional()
      .describe('Rating distribution (e.g., {"5": 100, "4": 50})')
  })
  .passthrough();

/**
 * Individual review entry for the reviews tool.
 * Extended with owner response fields for sentiment analysis.
 */
export const ReviewSchema = z.object({
  storeId: z.string().describe('Store identifier'),
  rating: z.number().min(1).max(5).describe('Rating value (1-5)'),
  comment: z.string().optional().describe('Review comment text'),
  date: z.string().optional().describe('Review date (YYYY-MM-DD)'),
  ownerResponse: z.string().optional().describe('Owner response to the review'),
  responseDate: z.string().optional().describe('Date of owner response (YYYY-MM-DD)')
});

/**
 * Location ratings summary (for multi-location queries).
 */
export const LocationRatingsSummarySchema = RatingsSummarySchema.extend({
  storeId: z.string().describe('Store identifier')
});

/**
 * Ratings data - aggregate statistics only (no individual reviews).
 * Shape depends on query context:
 * - Single location: RatingsSummary object with averageRating, totalReviews, distribution
 * - Multi-location: Array of LocationRatingsSummary (each has storeId field)
 *
 * For individual reviews, use the pinmeto_get_google_reviews tool instead.
 */
export const RatingsDataSchema = z.union([
  RatingsSummarySchema,
  z.array(LocationRatingsSummarySchema)
]);

// ============================================================================
// Tool Output Schemas
// ============================================================================

/**
 * Output schema for insights tools (Google, Facebook, Apple)
 * Returns aggregated metrics data with optional period comparisons.
 *
 * Two response formats depending on aggregation:
 * - aggregation=total (default): Flattened structure with FlatInsightSchema[]
 * - Other aggregations: Multi-period structure with InsightSchema[]
 *
 * Comparison data (when compare_with is specified) is embedded flat on each insight/value.
 */
/**
 * Time aggregation levels - controls how metrics are grouped.
 * Used in response metadata to indicate what aggregation was applied.
 */
export const TimeAggregationSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
  'total'
]);

export type TimeAggregation = z.infer<typeof TimeAggregationSchema>;

/**
 * Comparison period types - controls what prior period is compared against.
 * Used in response metadata to indicate what comparison was applied.
 * Values match the input parameter options.
 */
export const CompareWithSchema = z.enum([
  'none',
  'prior_period',
  'prior_year'
]);

export type CompareWith = z.infer<typeof CompareWithSchema>;

export const InsightsOutputSchema = {
  insights: z
    .union([z.array(InsightSchema), z.array(FlatInsightSchema)])
    .optional()
    .describe(
      'Array of insights by metric. Flattened (no values array) when aggregation=total, multi-period otherwise (absent on error)'
    ),
  periodRange: PeriodRangeSchema.optional().describe('Date range for the current period data'),
  timeAggregation: TimeAggregationSchema.optional().describe(
    'Time aggregation level applied to the data (e.g., "total", "monthly", "daily")'
  ),
  compareWith: CompareWithSchema.optional().describe(
    'Comparison period type used: "none", "prior_period", or "prior_year"'
  ),
  priorPeriodRange: PeriodRangeSchema.optional().describe(
    'Date range for the prior period (present when compare_with is specified)'
  ),
  comparisonError: z
    .string()
    .optional()
    .describe(
      'Error message if comparison data could not be fetched (current period data still returned)'
    ),
  warning: z.string().optional().describe('Warning message (e.g., incomplete data due to lag)'),
  warningCode: WarningCodeSchema.optional().describe('Warning code for programmatic handling'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for ratings tools (Google, Facebook)
 * Returns aggregate statistics only (averageRating, totalReviews, distribution)
 * For individual reviews, use the reviews tool instead.
 * Note: data is optional to allow error-only responses
 */
export const RatingsOutputSchema = {
  data: RatingsDataSchema.optional().describe(
    'Ratings data: single location summary or array of location summaries (absent on error)'
  ),
  cacheInfo: CacheInfoSchema.optional().describe('Cache status information'),
  warning: z.string().optional().describe('Warning message (e.g., incomplete data due to lag)'),
  warningCode: WarningCodeSchema.optional().describe('Warning code for programmatic handling'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for reviews tools (Google)
 * Returns individual reviews with pagination and filtering support.
 * Note: data is optional to allow error-only responses
 */
export const ReviewsOutputSchema = {
  data: z.array(ReviewSchema).optional().describe('Array of reviews (absent on error)'),
  totalCount: z.number().nonnegative().optional().describe('Total reviews matching filters'),
  hasMore: z.boolean().optional().describe('Whether more results exist beyond offset+limit'),
  offset: z.number().nonnegative().optional().describe('Current offset position'),
  limit: z.number().positive().optional().describe('Requested limit'),
  cacheInfo: CacheInfoSchema.optional().describe('Cache status information'),
  warning: z.string().optional().describe('Warning message (e.g., incomplete data due to lag)'),
  warningCode: WarningCodeSchema.optional().describe('Warning code for programmatic handling'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for keywords tools (Google)
 * Returns array of keywords with impression counts
 * Note: data is optional to allow error-only responses
 */
export const KeywordsOutputSchema = {
  data: z
    .array(KeywordDataSchema)
    .optional()
    .describe('Array of keywords with impression data (absent on error)'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for single location retrieval
 * Location objects contain many optional fields from the PinMeTo API
 * Note: data is optional to allow error-only responses
 */
export const LocationOutputSchema = {
  data: z
    .object({
      _id: z.string().optional().describe('Internal MongoDB ID'),
      storeId: z.string().optional().describe('Unique store identifier'),
      name: z.string().optional().describe('Location name'),
      type: z.string().optional().describe('Type: "location" or "serviceArea"'),
      site: z.string().optional().describe('Site identifier'),
      address: AddressSchema.optional().describe('Location address'),
      location: z
        .object({
          lat: z.number().optional().describe('Latitude in decimal degrees'),
          lon: z.number().optional().describe('Longitude in decimal degrees')
        })
        .passthrough()
        .optional()
        .describe('Geographic coordinates'),
      contact: ContactSchema.optional().describe('Contact information'),
      openHours: OpenHoursSchema.optional().describe('Opening hours by day'),
      google: z.record(z.unknown()).optional().describe('Google-specific data'),
      fb: z.record(z.unknown()).optional().describe('Facebook-specific data')
    })
    .passthrough()
    .optional()
    .describe('Location data from the PinMeTo API (absent on error)'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for multiple locations retrieval
 * Returns array of locations with pagination metadata and cache info
 * Note: data fields are optional to allow error-only responses
 */
export const LocationsOutputSchema = {
  data: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Array of location objects (absent on error)'),
  totalCount: z.number().nonnegative().optional().describe('Total locations matching filters'),
  hasMore: z.boolean().optional().describe('Whether more results exist beyond offset+limit'),
  offset: z.number().nonnegative().optional().describe('Current offset position'),
  limit: z.number().positive().optional().describe('Requested limit'),
  incomplete: z
    .boolean()
    .optional()
    .describe('Whether data may be incomplete due to pagination errors'),
  warning: z.string().optional().describe('Warning message if data may be incomplete'),
  cacheInfo: CacheInfoSchema.optional().describe('Cache status information'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for location search results
 * Returns lightweight location data for quick discovery
 * Note: data is optional to allow error-only responses
 */
export const SearchResultOutputSchema = {
  data: z
    .array(
      z.object({
        storeId: z.string().describe('Unique store identifier'),
        name: z.string().describe('Location name'),
        locationDescriptor: z.string().optional().describe('Location descriptor if available'),
        addressSummary: z.string().describe('Formatted address: street, city, country')
      })
    )
    .optional()
    .describe('Matching locations with minimal data for discovery (absent on error)'),
  totalMatches: z
    .number()
    .nonnegative()
    .optional()
    .describe('Total number of locations matching the query'),
  hasMore: z.boolean().optional().describe('Whether more results exist beyond the limit'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

// ============================================================================
// Type Exports
// ============================================================================

// New types for refactored structure
export type InsightValue = z.infer<typeof InsightValueSchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type FlatInsight = z.infer<typeof FlatInsightSchema>;
export type PeriodRange = z.infer<typeof PeriodRangeSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type RatingsSummary = z.infer<typeof RatingsSummarySchema>;
export type LocationRatingsSummary = z.infer<typeof LocationRatingsSummarySchema>;
export type CacheInfo = z.infer<typeof CacheInfoSchema>;

// Legacy type aliases for backwards compatibility during migration
export type MetricData = InsightValue;
export type InsightsData = z.infer<typeof InsightsDataSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type ComparisonPeriod = z.infer<typeof ComparisonPeriodSchema>;
export type WarningCode = z.infer<typeof WarningCodeSchema>;
