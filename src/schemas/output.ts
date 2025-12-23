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
// Review Insights Schemas (MCP Sampling)
// ============================================================================

/**
 * Sampling strategy for large datasets.
 * Controls how reviews are selected when dataset is too large for full analysis.
 */
export const SamplingStrategySchema = z.enum(['full', 'representative', 'recent_weighted']);

export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;

/**
 * Analysis type for review insights.
 * Controls what type of analysis is performed on the reviews.
 */
export const AnalysisTypeSchema = z.enum(['summary', 'issues', 'comparison', 'trends', 'themes']);

export type AnalysisType = z.infer<typeof AnalysisTypeSchema>;

/**
 * Sentiment classification for reviews.
 */
export const SentimentSchema = z.enum(['positive', 'neutral', 'negative', 'mixed']);

export type Sentiment = z.infer<typeof SentimentSchema>;

/**
 * Severity level for issues.
 */
export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Analysis method indicator - how the analysis was performed.
 */
export const AnalysisMethodSchema = z.enum(['ai_sampling', 'statistical']);

export type AnalysisMethod = z.infer<typeof AnalysisMethodSchema>;

/**
 * Theme identified in reviews (positive or negative).
 */
export const ReviewInsightsThemeSchema = z.object({
  theme: z.string().min(1).describe('Theme or topic identified (e.g., "Service Speed", "Staff Friendliness")'),
  frequency: z.number().int().nonnegative().describe('How often this theme appears in reviews'),
  severity: SeveritySchema.optional().describe('Severity level (for negative themes only)'),
  exampleQuote: z.string().optional().describe('Representative quote illustrating this theme')
});

export type ReviewInsightsTheme = z.infer<typeof ReviewInsightsThemeSchema>;

/**
 * Issue identified in negative reviews.
 */
export const ReviewInsightsIssueSchema = z.object({
  category: z.string().min(1).describe('Issue category (e.g., "Wait Times", "Cleanliness", "Staff")'),
  description: z.string().min(1).describe('Description of the issue'),
  severity: SeveritySchema.describe('Severity level of the issue'),
  frequency: z.number().int().nonnegative().describe('How often this issue appears'),
  affectedLocations: z.array(z.string()).optional().describe('Store IDs of affected locations'),
  exampleQuotes: z.array(z.string()).optional().describe('Representative quotes illustrating this issue'),
  suggestedAction: z.string().optional().describe('Recommended action to address the issue')
});

export type ReviewInsightsIssue = z.infer<typeof ReviewInsightsIssueSchema>;

/**
 * Location comparison data for multi-location analysis.
 */
export const ReviewInsightsLocationComparisonSchema = z.object({
  storeId: z.string().min(1).describe('Store identifier'),
  locationName: z.string().optional().describe('Location name'),
  averageRating: z.number().min(1).max(5).describe('Average rating for this location (1-5)'),
  reviewCount: z.number().int().nonnegative().describe('Number of reviews analyzed'),
  sentiment: SentimentSchema.describe('Overall sentiment for this location'),
  lowConfidence: z.boolean().optional().describe('True when location has few reviews (<10)'),
  strengths: z.array(z.string()).describe('Key strengths identified'),
  weaknesses: z.array(z.string()).describe('Key weaknesses identified'),
  recommendations: z.array(z.string()).optional().describe('Specific actions to improve this location')
});

/**
 * Best performer data for comparison analysis.
 */
export const ReviewInsightsBestPerformerSchema = z.object({
  storeId: z.string().min(1).describe('Store identifier of the best performing location'),
  reason: z.string().describe('Why this location performs best'),
  bestPractices: z.array(z.string()).describe('Practices other locations should adopt')
});

export type ReviewInsightsLocationComparison = z.infer<typeof ReviewInsightsLocationComparisonSchema>;

export type ReviewInsightsBestPerformer = z.infer<typeof ReviewInsightsBestPerformerSchema>;

/**
 * Prominence change for themes between periods.
 */
export const ReviewInsightsProminenceChangeSchema = z.object({
  theme: z.string().min(1).describe('Theme name'),
  trend: z.enum(['increasing', 'stable', 'decreasing']).describe('Direction of change'),
  note: z.string().optional().describe('Brief explanation of the change')
});

export type ReviewInsightsProminenceChange = z.infer<typeof ReviewInsightsProminenceChangeSchema>;

/**
 * Trends analysis comparing two time periods.
 */
export const ReviewInsightsTrendsSchema = z.object({
  direction: z.enum(['improving', 'stable', 'declining']).describe('Overall trend direction (based on ±0.2 rating threshold)'),
  ratingChange: z.number().optional().describe('Rating change between periods (current - previous)'),
  previousPeriod: z
    .object({
      averageRating: z.number().min(1).max(5).describe('Average rating in prior period (1-5)'),
      sentiment: SentimentSchema.describe('Overall sentiment in prior period'),
      reviewCount: z.number().int().nonnegative().describe('Number of reviews in prior period')
    })
    .describe('Prior period summary'),
  currentPeriod: z
    .object({
      averageRating: z.number().min(1).max(5).describe('Average rating in current period (1-5)'),
      sentiment: SentimentSchema.describe('Overall sentiment in current period'),
      reviewCount: z.number().int().nonnegative().describe('Number of reviews in current period')
    })
    .describe('Current period summary'),
  emergingIssues: z.array(z.string()).describe('New issues that emerged'),
  resolvedIssues: z.array(z.string()).describe('Issues that were resolved'),
  prominenceChanges: z.array(ReviewInsightsProminenceChangeSchema).optional().describe('Themes gaining or losing prominence')
});

export type ReviewInsightsTrends = z.infer<typeof ReviewInsightsTrendsSchema>;

/**
 * Executive summary of review insights.
 */
export const ReviewInsightsSummarySchema = z.object({
  executiveSummary: z.string().min(1).describe('2-3 sentence summary of findings'),
  overallSentiment: SentimentSchema.describe('Overall sentiment classification'),
  averageRating: z.number().min(1).max(5).describe('Average rating across analyzed reviews (1-5)'),
  sentimentDistribution: z
    .object({
      positive: z.number().min(0).max(100).describe('Percentage of positive reviews (0-100)'),
      neutral: z.number().min(0).max(100).describe('Percentage of neutral reviews (0-100)'),
      negative: z.number().min(0).max(100).describe('Percentage of negative reviews (0-100)')
    })
    .describe('Sentiment breakdown by percentage'),
  ratingDistribution: z
    .record(z.string(), z.number().int().nonnegative())
    .describe('Rating distribution (e.g., {"5": 100, "4": 50})'),
  lowConfidence: z.boolean().optional().describe('True when sample size is small (<20 reviews)')
});

export type ReviewInsightsSummary = z.infer<typeof ReviewInsightsSummarySchema>;

/**
 * Full review insights response data.
 * Different fields are populated based on analysisType.
 */
export const ReviewInsightsDataSchema = z.object({
  summary: ReviewInsightsSummarySchema.optional().describe('Executive summary (for summary analysis)'),
  themes: z
    .object({
      positive: z.array(ReviewInsightsThemeSchema).describe('Positive themes identified'),
      negative: z.array(ReviewInsightsThemeSchema).describe('Negative themes/areas for improvement')
    })
    .optional()
    .describe('Theme analysis (for summary/themes analysis)'),
  issues: z.array(ReviewInsightsIssueSchema).optional().describe('Issues identified (for issues analysis)'),
  locationComparison: z
    .array(ReviewInsightsLocationComparisonSchema)
    .optional()
    .describe('Location comparison (for comparison analysis)'),
  bestPerformer: ReviewInsightsBestPerformerSchema.optional().describe('Best performing location (for comparison analysis)'),
  commonStrengths: z.array(z.string()).optional().describe('Strengths shared across locations (for comparison analysis)'),
  commonWeaknesses: z.array(z.string()).optional().describe('Weaknesses shared across locations (for comparison analysis)'),
  trends: ReviewInsightsTrendsSchema.optional().describe('Trends analysis (for trends analysis)')
});

export type ReviewInsightsData = z.infer<typeof ReviewInsightsDataSchema>;

/**
 * Metadata for review insights response.
 */
export const ReviewInsightsMetadataSchema = z.object({
  locationCount: z.number().int().nonnegative().describe('Number of locations analyzed'),
  totalReviewCount: z.number().int().nonnegative().describe('Total reviews matching query criteria'),
  analyzedReviewCount: z.number().int().nonnegative().describe('Reviews actually analyzed (may differ if sampled)'),
  dateRange: DateRangeSchema.describe('Date range for the analysis'),
  analysisType: AnalysisTypeSchema.describe('Type of analysis performed'),
  analysisMethod: AnalysisMethodSchema.describe('How analysis was performed (ai_sampling or statistical)'),
  generatedAt: z.string().min(1).describe('ISO timestamp when analysis was generated'),
  samplingStrategy: SamplingStrategySchema.optional().describe('Sampling strategy used (if applicable)'),
  samplingNote: z.string().optional().describe('Human-readable note about sampling (if applicable)'),
  cache: z
    .object({
      hit: z.boolean().describe('Whether result was served from cache'),
      cachedAt: z.string().optional().describe('ISO timestamp when cached'),
      expiresAt: z.string().optional().describe('ISO timestamp when cache expires'),
      ttl: z.number().int().nonnegative().optional().describe('Cache TTL in seconds')
    })
    .optional()
    .describe('Cache information')
});

export type ReviewInsightsMetadata = z.infer<typeof ReviewInsightsMetadataSchema>;

/**
 * Large dataset warning with options.
 * Returned when review count exceeds threshold and confirmation is needed.
 */
export const LargeDatasetWarningOptionSchema = z.object({
  option: z.string().min(1).describe('Option identifier (e.g., "representative_sample", "proceed_full")'),
  description: z.string().min(1).describe('Human-readable description of this option'),
  estimatedTokens: z.number().int().nonnegative().describe('Estimated tokens for this option'),
  parameters: z.record(z.unknown()).describe('Parameters to pass to proceed with this option')
});

export const LargeDatasetWarningSchema = z.object({
  totalReviewCount: z.number().int().nonnegative().describe('Total reviews found'),
  locationCount: z.number().int().nonnegative().describe('Number of locations'),
  dateRange: DateRangeSchema.describe('Date range requested'),
  estimatedTokens: z.number().int().nonnegative().describe('Estimated tokens for full analysis'),
  estimatedTokensFormatted: z.string().min(1).describe('Human-readable token estimate (e.g., "~1.3M tokens")'),
  message: z.string().min(1).describe('Human-readable explanation'),
  options: z.array(LargeDatasetWarningOptionSchema).describe('Available options to proceed')
});

export type LargeDatasetWarning = z.infer<typeof LargeDatasetWarningSchema>;

/**
 * Warning codes for review insights.
 */
export const ReviewInsightsWarningCodeSchema = z.enum([
  'LARGE_DATASET_WARNING',
  'SAMPLED_ANALYSIS',
  'SAMPLING_NOT_SUPPORTED',
  'INCOMPLETE_DATA'
]);

export type ReviewInsightsWarningCode = z.infer<typeof ReviewInsightsWarningCodeSchema>;

/**
 * Output schema for review insights tool.
 * Returns AI-analyzed insights from reviews using MCP Sampling.
 */
export const ReviewInsightsOutputSchema = {
  data: ReviewInsightsDataSchema.optional().describe('Analysis results (absent on error or warning)'),
  metadata: ReviewInsightsMetadataSchema.optional().describe('Analysis metadata'),
  // Large dataset warning (when confirmation needed)
  requiresConfirmation: z
    .boolean()
    .optional()
    .describe('True if user must confirm before proceeding with large dataset'),
  largeDatasetWarning: LargeDatasetWarningSchema.optional().describe(
    'Large dataset details and options (when requiresConfirmation is true)'
  ),
  // Standard warning/error fields
  warning: z.string().optional().describe('Warning message'),
  warningCode: ReviewInsightsWarningCodeSchema.optional().describe('Warning code for programmatic handling'),
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
