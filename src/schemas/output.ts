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
 * Embedded comparison data for a metric.
 * Present only when compare_with parameter is specified in insights tools.
 * Note: The 'current' value is NOT duplicated here - use the parent metric's 'value' field.
 */
export const MetricComparisonSchema = z.object({
  prior: z.number().describe('Prior period value'),
  priorLabel: z.string().optional().describe('Human-readable prior period label'),
  delta: z.number().describe('Absolute change (current value - prior)'),
  deltaPercent: z
    .number()
    .nullable()
    .describe('Percentage change ((value - prior) / prior * 100). Null if prior is 0')
});

/**
 * Metric data point - represents a single key-value metric
 * Used in insights data across Google, Facebook, and Apple.
 * When comparison is requested, the 'comparison' field contains prior period data.
 */
export const MetricDataSchema = z.object({
  key: z
    .string()
    .describe('Date or period identifier (e.g., "2024-01-15" or "2024-01-15 to 2024-03-15")'),
  value: z.number().describe('Numeric metric value (current period when comparison is active)'),
  label: z
    .string()
    .optional()
    .describe('Human-readable period label (e.g., "January 2024", "Q1 2024")'),
  comparison: MetricComparisonSchema.optional().describe(
    'Prior period comparison data (present only when compare_with is specified)'
  )
});

/**
 * Insights data structure - contains metrics for a specific dimension.
 * Used across Google, Facebook, and Apple insights tools.
 */
export const InsightsDataSchema = z.object({
  key: z.string().describe('Metric dimension name (e.g., "views", "clicks", "searches")'),
  metrics: z.array(MetricDataSchema).describe('Array of metric data points')
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
 * Comparison period info - describes the current and prior period ranges.
 */
export const ComparisonPeriodSchema = z.object({
  current: DateRangeSchema.describe('Current period date range'),
  prior: DateRangeSchema.describe('Prior period date range')
});

/**
 * Warning codes for data validation issues.
 */
export const WarningCodeSchema = z.enum(['INCOMPLETE_DATA']);

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
 * Individual review entry.
 * Uses passthrough to allow extra API fields.
 */
export const ReviewSchema = z
  .object({
    storeId: z.string().optional().describe('Store identifier'),
    rating: z.number().min(1).max(5).describe('Rating value (1-5)'),
    comment: z.string().optional().describe('Review comment text'),
    date: z.string().optional().describe('Review date')
  })
  .passthrough();

/**
 * Location ratings summary (for multi-location queries).
 */
export const LocationRatingsSummarySchema = RatingsSummarySchema.extend({
  storeId: z.string().describe('Store identifier')
});

/**
 * Ratings data union - shape depends on query context:
 * - Single location summary: RatingsSummary object with averageRating, totalReviews, distribution
 * - Multi-location: Array of LocationRatingsSummary (each has storeId field)
 * - Reviews listing: Array of Review objects (each has rating and optional comment)
 *
 * Discriminate by: Array.isArray(data) first, then check for 'storeId' on elements
 */
export const RatingsDataSchema = z.union([
  RatingsSummarySchema,
  z.array(ReviewSchema),
  z.array(LocationRatingsSummarySchema)
]);

// ============================================================================
// Tool Output Schemas
// ============================================================================

/**
 * Output schema for insights tools (Google, Facebook, Apple)
 * Returns aggregated metrics data with optional period comparisons.
 *
 * When compare_with is specified, each metric in data[].metrics[] includes
 * a 'comparison' field with prior period data. This unified structure avoids
 * the duplication of having both 'data' and 'comparisonData' arrays.
 *
 * Note: data is optional to allow error-only responses
 */
export const InsightsOutputSchema = {
  data: z
    .array(InsightsDataSchema)
    .optional()
    .describe(
      'Array of insights data grouped by metric dimension. When compare_with is specified, each metric includes a comparison field with prior period data (absent on error)'
    ),
  comparisonPeriod: ComparisonPeriodSchema.optional().describe(
    'Date ranges for the current and prior comparison periods (present when compare_with is specified)'
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
 * Returns ratings summary, reviews, or per-location summaries
 * Note: data is optional to allow error-only responses
 */
export const RatingsOutputSchema = {
  data: RatingsDataSchema.optional().describe(
    'Ratings data: summary, reviews array, or location summaries (absent on error)'
  ),
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
 * Cache information schema for location queries
 */
export const CacheInfoSchema = z.object({
  cached: z.boolean().describe('Whether data was served from cache'),
  ageSeconds: z.number().optional().describe('Cache age in seconds'),
  totalCached: z.number().optional().describe('Total locations in cache'),
  stale: z
    .boolean()
    .optional()
    .describe('Whether cache data is stale and being refreshed in background')
});

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

export type MetricComparison = z.infer<typeof MetricComparisonSchema>;
export type MetricData = z.infer<typeof MetricDataSchema>;
export type InsightsData = z.infer<typeof InsightsDataSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type ComparisonPeriod = z.infer<typeof ComparisonPeriodSchema>;
export type WarningCode = z.infer<typeof WarningCodeSchema>;
