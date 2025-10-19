import { PinMeToApiError } from './mcp_server.js';

const MAX_RESPONSE_CHARS = 25000; // ~25k tokens (MCP best practice)

// ============================================================================
// AGGREGATION TYPES & HELPERS
// ============================================================================

export type AggregationLevel = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'total';

/**
 * Metric data structure from API
 */
interface MetricData {
  key: string; // Metric name like "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"
  metrics: Array<{
    key: string; // Date like "2024-09-05"
    value: number;
  }>;
}

/**
 * Aggregated insights result
 */
interface AggregatedInsights {
  aggregation: AggregationLevel;
  dateRange: { from: string; to: string };
  periods: Array<{
    period: string; // e.g., "2024-09-01 to 2024-09-07" or "Total"
    metrics: Record<string, number>; // metric key -> total value
  }>;
}

/**
 * Helper to get week number from date
 */
function getWeekNumber(date: Date): string {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Helper to get month string from date
 */
function getMonth(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Helper to get quarter string from date
 */
function getQuarter(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

/**
 * Helper to get year string from date
 */
function getYear(date: Date): string {
  return `${date.getFullYear()}`;
}

/**
 * Get period key based on aggregation level
 */
function getPeriodKey(dateStr: string, aggregation: AggregationLevel): string {
  if (aggregation === 'total') return 'Total';
  if (aggregation === 'daily') return dateStr;

  const date = new Date(dateStr);
  switch (aggregation) {
    case 'weekly':
      return getWeekNumber(date);
    case 'monthly':
      return getMonth(date);
    case 'quarterly':
      return getQuarter(date);
    case 'yearly':
      return getYear(date);
    default:
      return dateStr;
  }
}

/**
 * Aggregate insights data by specified level
 */
export function aggregateInsightsData(
  data: MetricData[],
  aggregation: AggregationLevel = 'total'
): AggregatedInsights {
  if (!data || data.length === 0) {
    return {
      aggregation,
      dateRange: { from: '', to: '' },
      periods: []
    };
  }

  // Extract all dates to determine range
  const allDates = new Set<string>();
  data.forEach((metric) => {
    metric.metrics.forEach((m) => allDates.add(m.key));
  });
  const sortedDates = Array.from(allDates).sort();
  const dateRange = {
    from: sortedDates[0] || '',
    to: sortedDates[sortedDates.length - 1] || ''
  };

  // Group data by periods
  const periodMap = new Map<string, Record<string, number>>();

  data.forEach((metric) => {
    metric.metrics.forEach((m) => {
      const periodKey = getPeriodKey(m.key, aggregation);

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {});
      }

      const periodMetrics = periodMap.get(periodKey)!;
      periodMetrics[metric.key] = (periodMetrics[metric.key] || 0) + m.value;
    });
  });

  // Convert to array and sort
  const periods = Array.from(periodMap.entries())
    .map(([period, metrics]) => ({ period, metrics }))
    .sort((a, b) => {
      if (aggregation === 'total') return 0;
      return a.period.localeCompare(b.period);
    });

  return {
    aggregation,
    dateRange,
    periods
  };
}

export function formatListResponse(
  response: any[],
  areAllPagesFetched: boolean,
  options?: {
    offset?: number;
    limit?: number;
    total?: number;
  }
): string {
  if (response.length === 0) {
    return 'The response was empty...';
  }

  // Build structured pagination response following MCP best practices
  const paginatedResponse: any = {
    count: response.length,
    items: response
  };

  // Add offset if provided
  if (options?.offset !== undefined) {
    paginatedResponse.offset = options.offset;
  }

  // Add total if known
  if (options?.total !== undefined) {
    paginatedResponse.total = options.total;
  }

  // Add pagination metadata
  paginatedResponse.has_more = !areAllPagesFetched;

  // Calculate next_offset if there's more data
  if (!areAllPagesFetched && options?.offset !== undefined) {
    paginatedResponse.next_offset = options.offset + response.length;
  }

  // Add helpful message if not all pages fetched
  if (!areAllPagesFetched) {
    paginatedResponse.message =
      'Not all pages were fetched. Use offset parameter or increase maxPages to see more results.';
  }

  return JSON.stringify(paginatedResponse, null, 2);
}

export function truncateResponse(data: any): [string, boolean] {
  const jsonStr = JSON.stringify(data, null, 2);

  // Handle when JSON.stringify returns undefined (e.g., for undefined input)
  if (jsonStr === undefined) {
    return ['undefined', false];
  }

  if (jsonStr.length <= MAX_RESPONSE_CHARS) {
    return [jsonStr, false]; // [content, wasTruncated]
  }

  const truncated = jsonStr.substring(0, MAX_RESPONSE_CHARS);
  const message =
    '\n\n[Response truncated due to size. Use more specific filters or query individual items.]';

  return [truncated + message, true];
}

export function formatLocationMarkdown(location: any): string {
  if (!location) return 'No location data available.';

  let md = '# Location Details\n\n';
  md += `**Store ID:** ${location.storeId || 'N/A'}\n`;
  md += `**Name:** ${location.name || 'N/A'}\n`;
  md += `**Status:** ${location.permanentlyClosed === false ? 'Active ✓' : 'Inactive ✗'}\n\n`;

  // Address (condensed)
  if (location.address) {
    const parts = [
      location.address.street,
      [location.address.zip, location.address.city].filter(Boolean).join(' '),
      location.address.country
    ].filter(Boolean);
    if (parts.length > 0) {
      md += '## Address\n';
      md += parts.join(', ') + '\n\n';
    }
  }

  // Contact (condensed)
  if (location.contact) {
    const contactItems: string[] = [];
    if (location.contact.phone) contactItems.push(`📞 ${location.contact.phone}`);
    if (location.contact.email) contactItems.push(`✉️ ${location.contact.email}`);
    if (location.contact.website || location.contact.homepage) {
      contactItems.push(`🌐 ${location.contact.website || location.contact.homepage}`);
    }
    if (contactItems.length > 0) {
      md += '## Contact\n';
      md += contactItems.join(' • ') + '\n\n';
    }
  }

  // Network integrations with links
  const hasNetworks = location.google || location.fb || location.apple;
  if (hasNetworks) {
    md += '## Network Integrations\n\n';

    if (location.google) {
      md += '**Google Business Profile**\n';
      if (location.google.link) {
        md += `- Profile: ${location.google.link}\n`;
      }
      if (location.google.placeId) {
        md += `- Place ID: \`${location.google.placeId}\`\n`;
      }
      if (location.google.newReviewUrl) {
        md += `- Leave Review: ${location.google.newReviewUrl}\n`;
      }
      md += '\n';
    }

    if (location.fb) {
      md += '**Facebook**\n';
      if (location.fb.link) {
        md += `- Profile: ${location.fb.link}\n`;
      }
      if (location.fb.pageId) {
        md += `- Page ID: \`${location.fb.pageId}\`\n`;
      }
      md += '\n';
    }

    if (location.apple) {
      md += '**Apple Maps**\n';
      if (location.apple.link) {
        md += `- Profile: ${location.apple.link}\n`;
      }
      md += '\n';
    }
  }

  // Opening hours (only if always open or closed)
  if (location.isAlwaysOpen) {
    md += '**Hours:** Open 24/7\n\n';
  } else if (location.permanentlyClosed) {
    md += '**Hours:** Permanently Closed\n\n';
  } else if (location.temporarilyClosedUntil) {
    md += `**Hours:** Temporarily Closed (until ${location.temporarilyClosedUntil})\n\n`;
  }

  return md;
}

/**
 * Format insights in markdown with smart summarization
 * Handles both raw API data and pre-aggregated data
 */
export function formatInsightsMarkdown(
  platform: string,
  insights: any,
  storeId?: string,
  aggregation: AggregationLevel = 'total'
): string {
  if (!insights) return `No ${platform} insights available.`;

  // Handle empty array
  if (Array.isArray(insights) && insights.length === 0) {
    let md = `# ${platform} Insights\n\n`;
    if (storeId) md += `**Store ID:** ${storeId}\n\n`;
    md += `*No data available for this period.*\n\n`;
    return md;
  }

  // Check if data is raw API format: array of metric objects with nested metrics
  const isRawApiFormat = Array.isArray(insights) && insights.length > 0 && insights[0]?.metrics && Array.isArray(insights[0].metrics);

  if (isRawApiFormat) {
    // Aggregate the data first
    const aggregated = aggregateInsightsData(insights, aggregation);
    return formatAggregatedInsights(platform, aggregated, storeId);
  }

  // Fall back to JSON if structure is unknown or simplified test data
  let md = `# ${platform} Insights\n\n`;
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;
  md += '```json\n';
  md += JSON.stringify(insights, null, 2);
  md += '\n```\n\n';
  return md;
}

/**
 * Format aggregated insights into readable markdown
 */
export function formatAggregatedInsights(
  platform: string,
  aggregated: AggregatedInsights,
  storeId?: string
): string {
  let md = `# ${platform} Insights\n\n`;
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  md += `**Period:** ${aggregated.dateRange.from} to ${aggregated.dateRange.to}\n`;
  md += `**Aggregation:** ${aggregated.aggregation}\n\n`;

  // Handle case where no periods exist
  if (!aggregated.periods || aggregated.periods.length === 0) {
    md += `*No data available for this period.*\n\n`;
    return md;
  }

  // Group metrics by category for better readability
  const categories = categorizeMetrics(aggregated.periods[0]?.metrics || {});

  // Check if we have any categories with metrics
  const hasAnyMetrics = Object.values(categories).some(keys => keys.length > 0);
  if (!hasAnyMetrics) {
    md += `*No metrics data available.*\n\n`;
    return md;
  }

  for (const period of aggregated.periods) {
    if (aggregated.aggregation !== 'total') {
      md += `## ${period.period}\n\n`;
    }

    // Check if all metrics are zero for this period
    const allMetricsZero = Object.values(period.metrics).every(v => v === 0);

    if (allMetricsZero) {
      md += `*No activity recorded for this period.*\n\n`;
    }

    // Display each category
    for (const [categoryName, metricKeys] of Object.entries(categories)) {
      if (metricKeys.length === 0) continue;

      md += `### ${categoryName}\n`;
      for (const metricKey of metricKeys) {
        const value = period.metrics[metricKey] || 0;
        // Show all metrics, including zeros
        const displayName = formatMetricName(metricKey);
        md += `- **${displayName}**: ${value.toLocaleString()}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

/**
 * Categorize metrics into logical groups
 */
function categorizeMetrics(metrics: Record<string, number>): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    'Impressions & Visibility': [],
    'Customer Actions': [],
    'Engagement': [],
    'Photos & Media': [],
    'Other': []
  };

  for (const key of Object.keys(metrics)) {
    const keyLower = key.toLowerCase();

    if (keyLower.includes('impression') || keyLower.includes('view')) {
      categories['Impressions & Visibility'].push(key);
    } else if (
      keyLower.includes('direction') ||
      keyLower.includes('call') ||
      keyLower.includes('website') ||
      keyLower.includes('click') ||
      keyLower.includes('action')
    ) {
      categories['Customer Actions'].push(key);
    } else if (
      keyLower.includes('engagement') ||
      keyLower.includes('like') ||
      keyLower.includes('comment') ||
      keyLower.includes('share') ||
      keyLower.includes('fan')
    ) {
      categories['Engagement'].push(key);
    } else if (keyLower.includes('photo') || keyLower.includes('media')) {
      categories['Photos & Media'].push(key);
    } else {
      categories['Other'].push(key);
    }
  }

  // Remove empty categories
  Object.keys(categories).forEach((key) => {
    if (categories[key].length === 0) {
      delete categories[key];
    }
  });

  return categories;
}

/**
 * Convert metric key to human-readable name
 */
function formatMetricName(key: string): string {
  // Handle common patterns
  const replacements: Record<string, string> = {
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'Desktop Search Impressions',
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'Mobile Search Impressions',
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'Desktop Maps Impressions',
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'Mobile Maps Impressions',
    BUSINESS_DIRECTION_REQUESTS: 'Direction Requests',
    CALL_CLICKS: 'Call Clicks',
    WEBSITE_CLICKS: 'Website Clicks',
    page_impressions: 'Page Impressions',
    page_impressions_unique: 'Unique Page Views',
    page_impressions_organic: 'Organic Impressions',
    page_impressions_organic_unique: 'Unique Organic Impressions',
    page_impressions_paid: 'Paid Impressions',
    page_impressions_paid_unique: 'Unique Paid Impressions',
    page_fans: 'Total Fans',
    page_fan_adds: 'New Fans',
    page_fan_removes: 'Unfollows',
    page_total_actions: 'Total Actions'
  };

  if (replacements[key]) {
    return replacements[key];
  }

  // Generic formatting: convert underscores to spaces and title case
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
}

export function formatRatingsMarkdown(platform: string, ratings: any, storeId?: string): string {
  if (!ratings) return `No ${platform} ratings available.`;

  let md = `# ${platform} Ratings\n\n`;
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  // Handle array of rating objects
  if (Array.isArray(ratings)) {
    if (ratings.length === 0) {
      return md + 'No ratings found in this period.\n';
    }

    // Calculate summary stats
    const totalRatings = ratings.length;
    const avgRating =
      ratings.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalRatings;
    const ratingDistribution: Record<number, number> = {};
    const withAnswers = ratings.filter((r: any) => r.hasAnswer).length;

    ratings.forEach((r: any) => {
      const rating = r.rating || 0;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    // Display summary
    md += '## Summary\n\n';
    md += `- **Total Ratings**: ${totalRatings}\n`;
    md += `- **Average Rating**: ${avgRating.toFixed(1)} ⭐\n`;
    md += `- **Response Rate**: ${((withAnswers / totalRatings) * 100).toFixed(1)}%\n\n`;

    md += '## Rating Distribution\n\n';
    for (let star = 5; star >= 1; star--) {
      const count = ratingDistribution[star] || 0;
      const percentage = ((count / totalRatings) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(count / totalRatings * 20));
      md += `${'⭐'.repeat(star)}: ${count} (${percentage}%) ${bar}\n`;
    }

    // Show recent ratings (max 5)
    if (ratings.length > 0) {
      md += '\n## Recent Ratings\n\n';
      const recentRatings = ratings.slice(0, 5);
      recentRatings.forEach((r: any) => {
        md += `- **${'⭐'.repeat(r.rating || 0)}** on ${r.date || 'Unknown date'}`;
        if (r.hasAnswer) md += ' ✓ Responded';
        md += '\n';
      });

      if (ratings.length > 5) {
        md += `\n_...and ${ratings.length - 5} more ratings_\n`;
      }
    }
  } else {
    // Fallback to JSON for unknown structure
    md += '```json\n';
    md += JSON.stringify(ratings, null, 2);
    md += '\n```\n';
  }

  return md;
}

export function formatKeywordsMarkdown(keywords: any, storeId?: string, limit: number | 'all' = 15): string {
  if (!keywords) return 'No keyword data available.';

  let md = '# Google Keywords\n\n';
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  // Handle array of keyword objects
  if (Array.isArray(keywords)) {
    if (keywords.length === 0) {
      return md + 'No keywords found in this period.\n';
    }

    // Calculate summary
    const totalKeywords = keywords.length;
    const totalImpressions = keywords.reduce((sum: number, k: any) => sum + (k.value || 0), 0);

    md += '## Summary\n\n';
    md += `- **Total Keywords**: ${totalKeywords}\n`;
    md += `- **Total Impressions**: ${totalImpressions.toLocaleString()}\n\n`;

    // Determine how many keywords to show
    const maxToShow = limit === 'all' ? totalKeywords : limit;

    // Show top keywords
    md += `## Top Keywords${limit === 'all' ? ' (All)' : maxToShow < totalKeywords ? ` (Top ${maxToShow})` : ''}\n\n`;
    const sortedKeywords = [...keywords].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    const topKeywords = sortedKeywords.slice(0, maxToShow);

    topKeywords.forEach((k: any, index: number) => {
      const percentage = ((k.value / totalImpressions) * 100).toFixed(1);
      md += `${index + 1}. **"${k.keyword}"** - ${k.value.toLocaleString()} impressions (${percentage}%)`;
      if (k.locationCounts > 1) {
        md += ` • ${k.locationCounts} locations`;
      }
      md += '\n';
    });

    if (keywords.length > maxToShow) {
      md += `\n_...and ${keywords.length - maxToShow} more keywords (use limit='all' to see all)_\n`;
    }
  } else {
    // Fallback to JSON for unknown structure
    md += '```json\n';
    md += JSON.stringify(keywords, null, 2);
    md += '\n```\n';
  }

  return md;
}

/**
 * Format API errors with specific, actionable messages
 * Provides guidance based on error type and status code
 */
export function formatApiError(error: unknown, context?: string): string {
  if (error instanceof PinMeToApiError) {
    const contextStr = context ? ` ${context}` : '';

    if (error.statusCode === 404) {
      return `Error: Resource not found${contextStr}. Please verify the ID is correct and the resource exists.`;
    } else if (error.statusCode === 403) {
      return `Error: Permission denied${contextStr}. Check your PINMETO_APP_ID and PINMETO_APP_SECRET credentials.`;
    } else if (error.statusCode === 429) {
      return `Error: Rate limit exceeded${contextStr}. Please wait before making more requests.`;
    } else if (error.statusCode === 401) {
      return `Error: Authentication failed${contextStr}. Verify your API credentials are correct.`;
    } else if (error.errorType === 'timeout') {
      return `Error: Request timed out${contextStr}. The PinMeTo API may be slow. Please try again.`;
    } else if (error.errorType === 'network_error') {
      return `Error: Network error${contextStr}. Unable to reach the PinMeTo API. Check your internet connection.`;
    } else if (error.statusCode) {
      return `Error: API request failed with status ${error.statusCode}${contextStr}.`;
    }
  }

  return `Error: Unexpected error occurred${context ? ` ${context}` : ''}: ${
    error instanceof Error ? error.message : String(error)
  }`;
}

/**
 * Helper to handle tool responses with consistent error handling and formatting
 * Reduces code duplication across tool implementations
 */
export async function handleToolResponse<T>(
  dataFetcher: () => Promise<T>,
  format: 'json' | 'markdown',
  options: {
    errorMessage: string;
    markdownFormatter?: (data: T, aggregation?: AggregationLevel, limit?: number | 'all') => string;
    aggregation?: AggregationLevel;
    limit?: number | 'all';
  }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    let data = await dataFetcher();

    // Check if data is insights in raw API format and aggregation is requested
    const isRawInsightsFormat = Array.isArray(data) &&
      data.length > 0 &&
      data[0]?.metrics &&
      Array.isArray(data[0].metrics);

    // Apply aggregation to insights data if needed (works for both JSON and markdown)
    if (isRawInsightsFormat && options.aggregation) {
      const aggregated = aggregateInsightsData(data as any, options.aggregation);

      // For JSON format, return the aggregated structure
      if (format === 'json') {
        const [responseText] = truncateResponse(aggregated);
        return {
          content: [
            {
              type: 'text',
              text: responseText
            }
          ]
        };
      }

      // For markdown format, use the formatter with already-aggregated data
      if (options.markdownFormatter) {
        return {
          content: [
            {
              type: 'text',
              text: options.markdownFormatter(data, options.aggregation, options.limit)
            }
          ]
        };
      }
    }

    // Handle markdown format (non-insights or no aggregation)
    if (format === 'markdown' && options.markdownFormatter) {
      return {
        content: [
          {
            type: 'text',
            text: options.markdownFormatter(data, options.aggregation, options.limit)
          }
        ]
      };
    }

    // Handle JSON format with truncation (non-insights or no aggregation)
    const [responseText] = truncateResponse(data);
    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  } catch (error) {
    // Format error with context
    return {
      content: [
        {
          type: 'text',
          text: `${options.errorMessage}\n\n${formatApiError(error)}`
        }
      ]
    };
  }
}
