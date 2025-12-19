import { z } from 'zod';
import { API_ERROR_CODES } from '../errors';

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
 * Metric data point - represents a single key-value metric
 * Used in insights data across Google, Facebook, and Apple
 */
export const MetricDataSchema = z.object({
  key: z
    .string()
    .describe('Date or period identifier (e.g., "2024-01-15" or "2024-01-15 to 2024-03-15")'),
  value: z.number().describe('Numeric metric value')
});

/**
 * Insights data structure - contains metrics for a specific dimension
 * Structure matches the PinMeTo API response and aggregateMetrics() output
 */
export const InsightsDataSchema = z.object({
  key: z.string().describe('Metric dimension name (e.g., "views", "clicks", "searches")'),
  metrics: z.array(MetricDataSchema).describe('Array of metric data points')
});

// ============================================================================
// Tool Output Schemas
// ============================================================================

/**
 * Output schema for insights tools (Google, Facebook, Apple)
 * Returns aggregated metrics data
 */
export const InsightsOutputSchema = {
  data: z.array(InsightsDataSchema).describe('Array of insights data grouped by metric dimension'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for ratings tools
 * Ratings have a different structure than insights
 */
export const RatingsOutputSchema = {
  data: z.unknown().describe('Ratings data from the PinMeTo API'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for keywords tools
 * Keywords have a different structure than insights
 */
export const KeywordsOutputSchema = {
  data: z.unknown().describe('Keywords data from the PinMeTo API'),
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
      _id: z.string().optional(),
      storeId: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      site: z.string().optional(),
      address: z.unknown().optional(),
      location: z.unknown().optional(),
      contact: z.unknown().optional(),
      openHours: z.unknown().optional(),
      google: z.unknown().optional(),
      fb: z.unknown().optional()
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
  totalCached: z.number().optional().describe('Total locations in cache')
});

/**
 * Output schema for multiple locations retrieval
 * Returns array of locations with pagination metadata and cache info
 */
export const LocationsOutputSchema = {
  data: z.array(z.record(z.unknown())).describe('Array of location objects'),
  totalCount: z.number().nonnegative().describe('Total locations matching filters'),
  hasMore: z.boolean().describe('Whether more results exist beyond offset+limit'),
  offset: z.number().nonnegative().describe('Current offset position'),
  limit: z.number().positive().describe('Requested limit'),
  incomplete: z.boolean().describe('Whether data may be incomplete due to pagination errors'),
  warning: z.string().optional().describe('Warning message if data may be incomplete'),
  cacheInfo: CacheInfoSchema.optional().describe('Cache status information'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

/**
 * Output schema for location search results
 * Returns lightweight location data for quick discovery
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
    .describe('Matching locations with minimal data for discovery'),
  totalMatches: z.number().nonnegative().describe('Total number of locations matching the query'),
  hasMore: z.boolean().describe('Whether more results exist beyond the limit'),
  error: z.string().optional().describe('Error message if the request failed'),
  errorCode: ApiErrorCodeSchema.optional().describe('Error code for programmatic handling'),
  retryable: z.boolean().optional().describe('Whether the operation can be retried')
};

// ============================================================================
// Type Exports
// ============================================================================

export type MetricData = z.infer<typeof MetricDataSchema>;
export type InsightsData = z.infer<typeof InsightsDataSchema>;
