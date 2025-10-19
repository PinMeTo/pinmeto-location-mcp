/**
 * TypeScript type definitions for PinMeTo Location MCP
 *
 * This file contains all the core type definitions used throughout the application
 * to ensure type safety and better IDE support.
 */

// ============================================================================
// LOCATION TYPES
// ============================================================================

export interface LocationAddress {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
}

export interface LocationContact {
  phone?: string;
  email?: string;
  website?: string;
  homepage?: string;
}

export interface GoogleIntegration {
  link?: string;
  placeId?: string;
  newReviewUrl?: string;
}

export interface FacebookIntegration {
  link?: string;
  pageId?: string;
}

export interface AppleIntegration {
  link?: string;
}

export interface Location {
  _id?: string;
  storeId?: string;
  name?: string;
  type?: string;
  site?: string;
  alternativeNames?: string[];
  location?: {
    lat?: number;
    lng?: number;
  };
  locationDescriptor?: string;
  isActive?: boolean;
  permanentlyClosed?: boolean;
  openingDate?: string;
  temporarilyClosedUntil?: string;
  temporarilyClosedMessage?: string;
  address?: LocationAddress;
  contact?: LocationContact;
  google?: GoogleIntegration;
  fb?: FacebookIntegration;
  apple?: AppleIntegration;
  openHours?: unknown; // Complex nested structure
  isAlwaysOpen?: boolean;
  specialOpenHours?: unknown;
  networkCategories?: unknown;
  networkActionLinks?: unknown;
  networkAttributes?: unknown;
  networkServiceItems?: unknown;
  networkCustomName?: string;
  shortDescription?: string;
  longDescription?: string;
  customData?: Record<string, unknown>;
  wifiSsid?: string;
  serviceAreas?: unknown[];
}

// ============================================================================
// INSIGHTS TYPES
// ============================================================================

export interface MetricDataPoint {
  key: string;  // Date like "2024-09-05"
  value: number;
}

export interface MetricData {
  key: string;  // Metric name like "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"
  metrics: MetricDataPoint[];
}

export type InsightsData = MetricData[];

// ============================================================================
// RATINGS TYPES
// ============================================================================

export interface Rating {
  rating: number;
  date?: string;
  hasAnswer?: boolean;
  comment?: string;
  reviewerName?: string;
  reviewerPhotoUrl?: string;
  ownerResponse?: string;
  ownerResponseTime?: string;
}

export type RatingsData = Rating[];

// ============================================================================
// KEYWORDS TYPES
// ============================================================================

export interface Keyword {
  keyword: string;
  value: number;
  locationCounts?: number;
}

export type KeywordsData = Keyword[];

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

export type AggregationLevel = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'total';

export interface AggregatedInsights {
  aggregation: AggregationLevel;
  dateRange: {
    from: string;
    to: string;
  };
  periods: Array<{
    period: string; // e.g., "2024-09-01 to 2024-09-07" or "Total"
    metrics: Record<string, number>; // metric key -> total value
  }>;
}

// ============================================================================
// COMPOSITE TOOL TYPES
// ============================================================================

export interface PlatformResult {
  platform: string;
  data: InsightsData | RatingsData | null;
  error?: string;
}

export interface PlatformResultWithType extends PlatformResult {
  type: 'insights' | 'ratings';
  period: 'current' | 'previous';
}

export interface PlatformData {
  currentInsights?: InsightsData;
  previousInsights?: InsightsData;
  currentRatings?: RatingsData;
  previousRatings?: RatingsData;
  errors: string[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  count: number;
  items: T[];
  offset?: number;
  total?: number;
  has_more: boolean;
  next_offset?: number;
  message?: string;
}

export interface ApiPagingInfo {
  nextUrl?: string;
}

export interface ApiResponse<T> {
  data?: T[];
  paging?: ApiPagingInfo;
}
