import { z } from 'zod';

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
  error: z.string().optional().describe('Error message if the request failed')
};

/**
 * Output schema for ratings tools
 * Ratings have a different structure than insights
 */
export const RatingsOutputSchema = {
  data: z.unknown().describe('Ratings data from the PinMeTo API'),
  error: z.string().optional().describe('Error message if the request failed')
};

/**
 * Output schema for keywords tools
 * Keywords have a different structure than insights
 */
export const KeywordsOutputSchema = {
  data: z.unknown().describe('Keywords data from the PinMeTo API'),
  error: z.string().optional().describe('Error message if the request failed')
};

/**
 * Output schema for single location retrieval
 * Location objects contain many optional fields from the PinMeTo API
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
    .describe('Location data from the PinMeTo API'),
  error: z.string().optional().describe('Error message if the request failed')
};

/**
 * Output schema for multiple locations retrieval
 * Returns array of locations with pagination status
 */
export const LocationsOutputSchema = {
  data: z.array(z.record(z.unknown())).describe('Array of location objects'),
  allPagesFetched: z.boolean().describe('Whether all pages were successfully retrieved'),
  error: z.string().optional().describe('Error message if the request failed')
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
  totalMatches: z.number().describe('Total number of locations matching the query'),
  hasMore: z.boolean().describe('Whether more results exist beyond the limit'),
  error: z.string().optional().describe('Error message if the request failed')
};

// ============================================================================
// Type Exports
// ============================================================================

export type MetricData = z.infer<typeof MetricDataSchema>;
export type InsightsData = z.infer<typeof InsightsDataSchema>;
