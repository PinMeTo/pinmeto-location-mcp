import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server.js';
import {
  aggregateInsightsData,
  formatInsightsMarkdown,
  formatRatingsMarkdown,
  formatLocationMarkdown,
  AggregationLevel
} from '../../helpers.js';

/**
 * Helper to calculate previous year date range
 */
function getPreviousYearDates(fromDate: string, toDate: string): { from: string; to: string } {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  from.setFullYear(from.getFullYear() - 1);
  to.setFullYear(to.getFullYear() - 1);

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
}

/**
 * Helper to format Y-o-Y comparison markdown
 */
function formatYoYComparison(
  currentData: any,
  previousData: any,
  platform: string,
  currentPeriod: { from: string; to: string },
  previousPeriod: { from: string; to: string },
  aggregation: AggregationLevel = 'total'
): string {
  let md = `# ${platform} Year-over-Year Comparison\n\n`;

  md += `**Current Period:** ${currentPeriod.from} to ${currentPeriod.to}\n`;
  md += `**Previous Period:** ${previousPeriod.from} to ${previousPeriod.to}\n\n`;

  // Aggregate both periods
  const currentAgg = aggregateInsightsData(currentData, aggregation);
  const previousAgg = aggregateInsightsData(previousData, aggregation);

  // If no data in either period
  if (currentAgg.periods.length === 0 && previousAgg.periods.length === 0) {
    return md + '*No data available for either period.*\n\n';
  }

  // If aggregation is 'total', show single comparison table
  if (aggregation === 'total') {
    md += formatPeriodComparison(
      currentAgg.periods[0]?.metrics || {},
      previousAgg.periods[0]?.metrics || {},
      'Metrics Comparison'
    );
  } else {
    // For other aggregations (daily, weekly, monthly, etc.), show per-period comparison
    // Create a map of period -> metrics for easy lookup
    const currentPeriodMap = new Map(currentAgg.periods.map(p => [p.period, p.metrics]));
    const previousPeriodMap = new Map(previousAgg.periods.map(p => [p.period, p.metrics]));

    // Get all unique periods
    const allPeriods = new Set([
      ...currentAgg.periods.map(p => p.period),
      ...previousAgg.periods.map(p => p.period)
    ]);

    // Sort periods chronologically
    const sortedPeriods = Array.from(allPeriods).sort();

    if (sortedPeriods.length === 0) {
      return md + '*No metrics available for comparison.*\n\n';
    }

    // Show comparison for each period
    for (const period of sortedPeriods) {
      const currentMetrics = currentPeriodMap.get(period) || {};
      const previousMetrics = previousPeriodMap.get(period) || {};

      md += formatPeriodComparison(currentMetrics, previousMetrics, `Period: ${period}`);
      md += '\n';
    }
  }

  return md;
}

/**
 * Helper to format a single period comparison table
 */
function formatPeriodComparison(
  currentMetrics: Record<string, number>,
  previousMetrics: Record<string, number>,
  title: string
): string {
  // Combine all metric keys
  const allMetricKeys = new Set([
    ...Object.keys(currentMetrics),
    ...Object.keys(previousMetrics)
  ]);

  if (allMetricKeys.size === 0) {
    return `## ${title}\n\n*No metrics available for this period.*\n\n`;
  }

  let md = `## ${title}\n\n`;
  md += '| Metric | Current | Previous | Change | % Change |\n';
  md += '|--------|---------|----------|--------|----------|\n';

  // Sort metrics by name for consistent display
  const sortedMetrics = Array.from(allMetricKeys).sort();

  for (const metricKey of sortedMetrics) {
    const current = currentMetrics[metricKey] || 0;
    const previous = previousMetrics[metricKey] || 0;
    const change = current - previous;
    const percentChange = previous !== 0 ? ((change / previous) * 100) : (current > 0 ? Infinity : 0);

    const changeStr = change >= 0 ? `+${change.toLocaleString()}` : change.toLocaleString();
    let percentStr = '';
    if (percentChange === Infinity) {
      percentStr = 'NEW';
    } else if (previous === 0 && current === 0) {
      percentStr = '-';
    } else {
      percentStr = percentChange >= 0 ? `+${percentChange.toFixed(1)}%` : `${percentChange.toFixed(1)}%`;
    }

    // Add emoji indicators
    let indicator = '';
    if (change > 0) indicator = '📈';
    else if (change < 0) indicator = '📉';
    else indicator = '➖';

    const metricName = formatMetricName(metricKey);
    md += `| ${metricName} | ${current.toLocaleString()} | ${previous.toLocaleString()} | ${changeStr} ${indicator} | ${percentStr} |\n`;
  }

  md += '\n';

  return md;
}

/**
 * Helper to format metric name (simplified version from helpers.ts)
 */
function formatMetricName(key: string): string {
  const replacements: Record<string, string> = {
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'Desktop Search',
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'Mobile Search',
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'Desktop Maps',
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'Mobile Maps',
    BUSINESS_DIRECTION_REQUESTS: 'Directions',
    CALL_CLICKS: 'Calls',
    WEBSITE_CLICKS: 'Website Clicks',
    page_impressions: 'Page Views',
    page_impressions_unique: 'Unique Views',
    page_fans: 'Total Fans',
    page_fan_adds: 'New Fans'
  };

  if (replacements[key]) return replacements[key];

  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
}

/**
 * Composite tool: Get insights from multiple platforms in parallel
 */
export function getMultiPlatformInsights(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_multi_platform_insights',
    `Fetch insights from Google, Facebook, and Apple for ALL locations in a single call.

This is a high-performance composite tool that makes multiple API calls in parallel and returns a unified report. Perfect for:
- Executive dashboards and reports
- Multi-platform performance analysis
- Reducing agent processing time (single tool call vs. multiple sequential calls)

**Performance:** Makes 3 parallel API calls instead of 3 sequential agent round-trips, reducing report generation time from minutes to seconds.

**Returns:** Combined insights from all selected platforms with markdown formatting.

**Date requirements:**
- Format: YYYY-MM-DD (e.g., "2024-01-01")
- ⚠️ **Data lag:** Google ~10 days, Facebook ~3 days, Apple ~4 days

**Example:** "Show me all platform insights for Q4 2024 across all locations"`,
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format'),
      platforms: z
        .array(z.enum(['google', 'facebook', 'apple']))
        .optional()
        .default(['google', 'facebook', 'apple'])
        .describe('Platforms to fetch insights from. Default: all platforms'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ from, to, platforms, aggregation, format }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const selectedPlatforms = platforms || ['google', 'facebook', 'apple'];

      // Build API requests for selected platforms
      const requests: Promise<{ platform: string; data: any; error?: string }>[] = [];

      if (selectedPlatforms.includes('google')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`
            )
            .then(data => ({ platform: 'Google', data }))
            .catch(err => ({ platform: 'Google', data: null, error: String(err) }))
        );
      }

      if (selectedPlatforms.includes('facebook')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`
            )
            .then(data => ({ platform: 'Facebook', data }))
            .catch(err => ({ platform: 'Facebook', data: null, error: String(err) }))
        );
      }

      if (selectedPlatforms.includes('apple')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`
            )
            .then(data => ({ platform: 'Apple', data }))
            .catch(err => ({ platform: 'Apple', data: null, error: String(err) }))
        );
      }

      // Execute all requests in parallel
      const results = await Promise.all(requests);

      // If JSON format requested, return structured data
      if (format === 'json') {
        const jsonResponse: any = {
          period: { from, to },
          platforms: selectedPlatforms,
          aggregation,
          data: {}
        };

        for (const result of results) {
          if (result.error) {
            jsonResponse.data[result.platform.toLowerCase()] = {
              error: result.error
            };
          } else {
            // Aggregate data if needed
            const isRawApiFormat = Array.isArray(result.data) &&
              result.data.length > 0 &&
              result.data[0]?.metrics &&
              Array.isArray(result.data[0].metrics);

            if (isRawApiFormat) {
              jsonResponse.data[result.platform.toLowerCase()] = aggregateInsightsData(
                result.data,
                aggregation as AggregationLevel
              );
            } else {
              jsonResponse.data[result.platform.toLowerCase()] = result.data;
            }
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(jsonResponse, null, 2) }]
        };
      }

      // Format combined markdown report
      let report = '# Multi-Platform Insights Report\n\n';
      report += `**Period:** ${from} to ${to}\n`;
      report += `**Platforms:** ${selectedPlatforms.join(', ')}\n`;
      report += `**Aggregation:** ${aggregation}\n\n`;
      report += '---\n\n';

      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.error) {
          report += `## ${result.platform} ⚠️\n\n`;
          report += `*Failed to fetch data: ${result.error}*\n\n`;
          report += '---\n\n';
          errorCount++;
        } else {
          report += formatInsightsMarkdown(
            `${result.platform} (All Locations)`,
            result.data,
            undefined,
            aggregation as AggregationLevel
          );
          report += '---\n\n';
          successCount++;
        }
      }

      // Add summary at the end
      report += `## Summary\n\n`;
      report += `- ✅ Successfully fetched: ${successCount} platform(s)\n`;
      if (errorCount > 0) {
        report += `- ⚠️ Failed to fetch: ${errorCount} platform(s)\n`;
      }

      return {
        content: [{ type: 'text', text: report }]
      };
    }
  );
}

/**
 * Composite tool: Get year-over-year comparison
 */
export function getYoYComparison(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_yoy_comparison',
    `Fetch current and previous year data in parallel and generate a year-over-year comparison report.

This is a high-performance composite tool that automatically:
1. Fetches current period data
2. Calculates and fetches previous year dates
3. Makes all API calls in parallel
4. Generates comparison report with metrics, changes, and percentages

Perfect for:
- Monthly/quarterly/yearly performance reports
- Year-over-year trend analysis
- Executive summaries with historical context
- Reducing report generation time from 10+ minutes to under 1 minute

**Performance:** Makes 6-12 parallel API calls (depending on platforms) instead of 15+ sequential agent round-trips.

**Date requirements:**
- Format: YYYY-MM-DD
- Automatically calculates previous year dates
- ⚠️ **Data lag:** Ensure dates account for platform delays (Google ~10 days, Facebook ~3 days, Apple ~4 days)

**Example:** "Compare Q4 2024 performance to Q4 2023 across all platforms"`,
    {
      current_from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Current period start date'),
      current_to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Current period end date'),
      platforms: z
        .array(z.enum(['google', 'facebook', 'apple']))
        .optional()
        .default(['google', 'facebook', 'apple'])
        .describe('Platforms to compare. Default: all platforms'),
      include_ratings: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include ratings comparison (Google only). Default: false'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ current_from, current_to, platforms, include_ratings, aggregation, format }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const selectedPlatforms = platforms || ['google', 'facebook', 'apple'];

      // Calculate previous year dates
      const previousYear = getPreviousYearDates(current_from, current_to);

      // Build all API requests
      const requests: Promise<{
        platform: string;
        type: 'insights' | 'ratings';
        period: 'current' | 'previous';
        data: any;
        error?: string;
      }>[] = [];

      // Google insights
      if (selectedPlatforms.includes('google')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${current_from}&to=${current_to}`
            )
            .then(data => ({ platform: 'Google', type: 'insights' as const, period: 'current' as const, data }))
            .catch(err => ({
              platform: 'Google',
              type: 'insights' as const,
              period: 'current' as const,
              data: null,
              error: String(err)
            }))
        );

        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${previousYear.from}&to=${previousYear.to}`
            )
            .then(data => ({ platform: 'Google', type: 'insights' as const, period: 'previous' as const, data }))
            .catch(err => ({
              platform: 'Google',
              type: 'insights' as const,
              period: 'previous' as const,
              data: null,
              error: String(err)
            }))
        );

        // Google ratings if requested
        if (include_ratings) {
          requests.push(
            server
              .makePinMeToRequest(
                `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${current_from}&to=${current_to}`
              )
              .then(data => ({ platform: 'Google', type: 'ratings' as const, period: 'current' as const, data }))
              .catch(err => ({
                platform: 'Google',
                type: 'ratings' as const,
                period: 'current' as const,
                data: null,
                error: String(err)
              }))
          );

          requests.push(
            server
              .makePinMeToRequest(
                `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${previousYear.from}&to=${previousYear.to}`
              )
              .then(data => ({ platform: 'Google', type: 'ratings' as const, period: 'previous' as const, data }))
              .catch(err => ({
                platform: 'Google',
                type: 'ratings' as const,
                period: 'previous' as const,
                data: null,
                error: String(err)
              }))
          );
        }
      }

      // Facebook insights
      if (selectedPlatforms.includes('facebook')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${current_from}&to=${current_to}`
            )
            .then(data => ({ platform: 'Facebook', type: 'insights' as const, period: 'current' as const, data }))
            .catch(err => ({
              platform: 'Facebook',
              type: 'insights' as const,
              period: 'current' as const,
              data: null,
              error: String(err)
            }))
        );

        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${previousYear.from}&to=${previousYear.to}`
            )
            .then(data => ({ platform: 'Facebook', type: 'insights' as const, period: 'previous' as const, data }))
            .catch(err => ({
              platform: 'Facebook',
              type: 'insights' as const,
              period: 'previous' as const,
              data: null,
              error: String(err)
            }))
        );
      }

      // Apple insights
      if (selectedPlatforms.includes('apple')) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${current_from}&to=${current_to}`
            )
            .then(data => ({ platform: 'Apple', type: 'insights' as const, period: 'current' as const, data }))
            .catch(err => ({
              platform: 'Apple',
              type: 'insights' as const,
              period: 'current' as const,
              data: null,
              error: String(err)
            }))
        );

        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${previousYear.from}&to=${previousYear.to}`
            )
            .then(data => ({ platform: 'Apple', type: 'insights' as const, period: 'previous' as const, data }))
            .catch(err => ({
              platform: 'Apple',
              type: 'insights' as const,
              period: 'previous' as const,
              data: null,
              error: String(err)
            }))
        );
      }

      // Execute all requests in parallel
      const results = await Promise.all(requests);

      // Organize results by platform
      const platformData: Record<
        string,
        {
          currentInsights?: any;
          previousInsights?: any;
          currentRatings?: any;
          previousRatings?: any;
          errors: string[];
        }
      > = {};

      for (const result of results) {
        if (!platformData[result.platform]) {
          platformData[result.platform] = { errors: [] };
        }

        if (result.error) {
          platformData[result.platform].errors.push(result.error);
        } else {
          if (result.type === 'insights') {
            if (result.period === 'current') {
              platformData[result.platform].currentInsights = result.data;
            } else {
              platformData[result.platform].previousInsights = result.data;
            }
          } else if (result.type === 'ratings') {
            if (result.period === 'current') {
              platformData[result.platform].currentRatings = result.data;
            } else {
              platformData[result.platform].previousRatings = result.data;
            }
          }
        }
      }

      // If JSON format requested, return structured data
      if (format === 'json') {
        const jsonResponse: any = {
          current_period: { from: current_from, to: current_to },
          previous_period: previousYear,
          platforms: selectedPlatforms,
          aggregation,
          data: {}
        };

        for (const platform of selectedPlatforms) {
          const data = platformData[platform.charAt(0).toUpperCase() + platform.slice(1)];
          if (!data) continue;

          const platformKey = platform.toLowerCase();
          jsonResponse.data[platformKey] = {
            errors: data.errors.length > 0 ? data.errors : undefined
          };

          if (data.currentInsights && data.previousInsights) {
            const currentAgg = aggregateInsightsData(data.currentInsights, aggregation as AggregationLevel);
            const previousAgg = aggregateInsightsData(data.previousInsights, aggregation as AggregationLevel);

            jsonResponse.data[platformKey].insights = {
              current: currentAgg,
              previous: previousAgg
            };
          }

          if (include_ratings && data.currentRatings && data.previousRatings) {
            jsonResponse.data[platformKey].ratings = {
              current: data.currentRatings,
              previous: data.previousRatings
            };
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(jsonResponse, null, 2) }]
        };
      }

      // Format markdown report
      let report = '# Year-over-Year Comparison Report\n\n';
      report += `**Current Period:** ${current_from} to ${current_to}\n`;
      report += `**Previous Period:** ${previousYear.from} to ${previousYear.to}\n`;
      report += `**Platforms:** ${selectedPlatforms.join(', ')}\n`;
      report += `**Aggregation:** ${aggregation}\n\n`;
      report += '---\n\n';

      // Generate comparison for each platform
      for (const platform of selectedPlatforms) {
        const data = platformData[platform.charAt(0).toUpperCase() + platform.slice(1)];

        if (!data) continue;

        if (data.errors.length > 0) {
          report += `## ${platform.charAt(0).toUpperCase() + platform.slice(1)} ⚠️\n\n`;
          report += `*Some data could not be fetched*\n\n`;
        }

        // Insights comparison
        if (data.currentInsights && data.previousInsights) {
          report += formatYoYComparison(
            data.currentInsights,
            data.previousInsights,
            platform.charAt(0).toUpperCase() + platform.slice(1),
            { from: current_from, to: current_to },
            previousYear,
            aggregation as AggregationLevel
          );
        } else if (data.currentInsights || data.previousInsights) {
          report += `## ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n\n`;
          report += '*Incomplete data: could not fetch both current and previous period for comparison.*\n\n';
        }

        // Ratings comparison (if applicable)
        if (include_ratings && (data.currentRatings || data.previousRatings)) {
          report += `### Ratings Comparison\n\n`;
          if (data.currentRatings && data.previousRatings) {
            report += formatRatingsComparison(data.currentRatings, data.previousRatings);
          } else {
            report += '*Incomplete ratings data for comparison.*\n\n';
          }
        }

        report += '---\n\n';
      }

      return {
        content: [{ type: 'text', text: report }]
      };
    }
  );
}

/**
 * Helper to format ratings comparison
 */
function formatRatingsComparison(currentRatings: any[], previousRatings: any[]): string {
  const currentTotal = currentRatings.length;
  const previousTotal = previousRatings.length;

  const currentAvg =
    currentTotal > 0
      ? currentRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / currentTotal
      : 0;
  const previousAvg =
    previousTotal > 0
      ? previousRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / previousTotal
      : 0;

  const countChange = currentTotal - previousTotal;
  const avgChange = currentAvg - previousAvg;

  let md = '| Metric | Current | Previous | Change |\n';
  md += '|--------|---------|----------|--------|\n';
  md += `| Total Ratings | ${currentTotal} | ${previousTotal} | ${countChange >= 0 ? '+' : ''}${countChange} |\n`;
  md += `| Average Rating | ${currentAvg.toFixed(1)} ⭐ | ${previousAvg.toFixed(1)} ⭐ | ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)} |\n\n`;

  return md;
}

/**
 * Composite tool: Get complete location overview
 */
export function getLocationOverview(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_location_overview',
    `Get a complete overview for a specific location including insights and ratings from all platforms in a single call.

This composite tool fetches in parallel:
- Location details
- Google insights and ratings
- Facebook insights and ratings
- Apple insights

Perfect for:
- Single location performance review
- Store manager reports
- Location-specific analysis
- Reducing agent processing time

**Performance:** Makes up to 6 parallel API calls instead of 6 sequential agent round-trips.

**Example:** "Give me a complete overview for store ID abc123 for last month"`,
    {
      storeId: z.string().min(1).describe('The PinMeTo store ID'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format'),
      include_ratings: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include ratings data. Default: true'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ storeId, from, to, include_ratings, aggregation, format }) => {
      const { apiBaseUrl, locationsApiBaseUrl, accountId } = server.configs;

      // Build all API requests
      const requests = [];

      // Location details
      requests.push(
        server
          .makePinMeToRequest(`${locationsApiBaseUrl}/v4/${accountId}/locations/${storeId}`)
          .then(data => ({ type: 'location', data }))
          .catch(err => ({ type: 'location', data: null, error: String(err) }))
      );

      // Google insights
      requests.push(
        server
          .makePinMeToRequest(
            `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`
          )
          .then(data => ({ type: 'google_insights', data }))
          .catch(err => ({ type: 'google_insights', data: null, error: String(err) }))
      );

      // Facebook insights
      requests.push(
        server
          .makePinMeToRequest(
            `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`
          )
          .then(data => ({ type: 'facebook_insights', data }))
          .catch(err => ({ type: 'facebook_insights', data: null, error: String(err) }))
      );

      // Apple insights
      requests.push(
        server
          .makePinMeToRequest(
            `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`
          )
          .then(data => ({ type: 'apple_insights', data }))
          .catch(err => ({ type: 'apple_insights', data: null, error: String(err) }))
      );

      // Ratings if requested
      if (include_ratings) {
        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`
            )
            .then(data => ({ type: 'google_ratings', data }))
            .catch(err => ({ type: 'google_ratings', data: null, error: String(err) }))
        );

        requests.push(
          server
            .makePinMeToRequest(
              `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`
            )
            .then(data => ({ type: 'facebook_ratings', data }))
            .catch(err => ({ type: 'facebook_ratings', data: null, error: String(err) }))
        );
      }

      // Execute all requests in parallel
      const results = await Promise.all(requests);

      // Organize results
      const data: Record<string, any> = {};
      const errors: string[] = [];

      for (const result of results) {
        if ('error' in result && result.error) {
          errors.push(`${result.type}: ${result.error}`);
        } else {
          data[result.type] = result.data;
        }
      }

      // If JSON format requested, return structured data
      if (format === 'json') {
        const jsonResponse: any = {
          storeId,
          period: { from, to },
          aggregation,
          location: data.location || null,
          insights: {},
          ratings: include_ratings ? {} : undefined,
          errors: errors.length > 0 ? errors : undefined
        };

        // Add insights for each platform (with aggregation)
        if (data.google_insights) {
          const isRawApiFormat = Array.isArray(data.google_insights) &&
            data.google_insights.length > 0 &&
            data.google_insights[0]?.metrics &&
            Array.isArray(data.google_insights[0].metrics);

          jsonResponse.insights.google = isRawApiFormat
            ? aggregateInsightsData(data.google_insights, aggregation as AggregationLevel)
            : data.google_insights;
        }

        if (data.facebook_insights) {
          const isRawApiFormat = Array.isArray(data.facebook_insights) &&
            data.facebook_insights.length > 0 &&
            data.facebook_insights[0]?.metrics &&
            Array.isArray(data.facebook_insights[0].metrics);

          jsonResponse.insights.facebook = isRawApiFormat
            ? aggregateInsightsData(data.facebook_insights, aggregation as AggregationLevel)
            : data.facebook_insights;
        }

        if (data.apple_insights) {
          const isRawApiFormat = Array.isArray(data.apple_insights) &&
            data.apple_insights.length > 0 &&
            data.apple_insights[0]?.metrics &&
            Array.isArray(data.apple_insights[0].metrics);

          jsonResponse.insights.apple = isRawApiFormat
            ? aggregateInsightsData(data.apple_insights, aggregation as AggregationLevel)
            : data.apple_insights;
        }

        // Add ratings if included
        if (include_ratings) {
          if (data.google_ratings) jsonResponse.ratings.google = data.google_ratings;
          if (data.facebook_ratings) jsonResponse.ratings.facebook = data.facebook_ratings;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(jsonResponse, null, 2) }]
        };
      }

      // Format markdown report
      let report = '# Location Overview Report\n\n';
      report += `**Period:** ${from} to ${to}\n`;
      report += `**Aggregation:** ${aggregation}\n\n`;
      report += '---\n\n';

      // Location info with network integrations
      if (data.location) {
        report += formatLocationMarkdown(data.location);
        report += '---\n\n';
      }

      // Google section
      if (data.google_insights) {
        report += formatInsightsMarkdown('Google', data.google_insights, storeId, aggregation as AggregationLevel);
        if (data.google_ratings && include_ratings) {
          report += formatRatingsMarkdown('Google', data.google_ratings, storeId);
        }
        report += '---\n\n';
      }

      // Facebook section
      if (data.facebook_insights) {
        report += formatInsightsMarkdown('Facebook', data.facebook_insights, storeId, aggregation as AggregationLevel);
        if (data.facebook_ratings && include_ratings) {
          report += formatRatingsMarkdown('Facebook', data.facebook_ratings, storeId);
        }
        report += '---\n\n';
      }

      // Apple section
      if (data.apple_insights) {
        report += formatInsightsMarkdown('Apple', data.apple_insights, storeId, aggregation as AggregationLevel);
        report += '---\n\n';
      }

      // Errors section
      if (errors.length > 0) {
        report += '## ⚠️ Warnings\n\n';
        report += '*Some data could not be fetched:*\n\n';
        errors.forEach(err => {
          report += `- ${err}\n`;
        });
        report += '\n';
      }

      return {
        content: [{ type: 'text', text: report }]
      };
    }
  );
}
