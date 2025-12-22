import {
  MetricData,
  InsightsData,
  ResponseFormat,
  Insight,
  InsightValue,
  FlatInsight,
  PeriodRange
} from './schemas/output';
import { ApiError } from './errors';

/** Maximum rows to display in Markdown tables before truncating */
export const MARKDOWN_TABLE_MAX_ROWS = 50;

/**
 * Validates that a YYYY-MM-DD string represents a real calendar date.
 * Returns true if valid, false if invalid (e.g., 2024-06-31, 2024-02-30).
 *
 * Note: This function expects input that has already passed the YYYY-MM-DD
 * regex validation. It handles malformed input gracefully but is designed
 * to be used with DateSchema.refine() after regex validation.
 */
export function isValidDate(dateStr: string): boolean {
  // Handle malformed input explicitly
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;

  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export type AggregationPeriod =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly'
  | 'total';

/**
 * Aggregates insights data by the specified time period.
 * Uses new field names: metric, values, period, periodLabel.
 *
 * @param data Array of insights data with daily values
 * @param period Aggregation period (daily, weekly, monthly, etc.)
 * @returns Aggregated data using Insight[] structure
 */
export function aggregateInsights(data: Insight[], period: AggregationPeriod = 'total'): Insight[] {
  // Return unchanged if daily or no data
  if (period === 'daily' || !data || data.length === 0) {
    return data;
  }

  return data.map(insight => {
    const aggregatedValues = aggregateValuesByPeriod(insight.values, period);
    return {
      metric: insight.metric,
      values: aggregatedValues
    };
  });
}

/**
 * @deprecated Use aggregateInsights instead. Kept for backwards compatibility.
 */
export function aggregateMetrics(
  data: InsightsData[],
  period: AggregationPeriod = 'total'
): InsightsData[] {
  // Return unchanged if daily or no data
  if (period === 'daily' || !data || data.length === 0) {
    return data;
  }

  return data.map(insightData => {
    const aggregatedMetrics = aggregateMetricsByPeriodLegacy(insightData.metrics, period);
    return {
      key: insightData.key,
      metrics: aggregatedMetrics
    };
  });
}

/**
 * Aggregates an array of insight values by the specified period.
 * Uses new field names: period, periodLabel.
 */
function aggregateValuesByPeriod(
  values: InsightValue[],
  period: AggregationPeriod
): InsightValue[] {
  if (values.length === 0) {
    return values;
  }

  // Handle 'total' aggregation - sum all values
  if (period === 'total') {
    const totalValue = values.reduce((sum, v) => sum + v.value, 0);

    // Find actual min and max dates (API returns unsorted data)
    const dates = values.map(v => v.period).filter(p => p && p !== 'total');
    const sortedDates = dates.sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0] || 'total';
    const lastDate = sortedDates[sortedDates.length - 1] || 'total';

    const periodKey = `${firstDate} to ${lastDate}`;
    return [
      {
        period: periodKey,
        periodLabel: getPeriodLabel(periodKey),
        value: totalValue
      }
    ];
  }

  // Group values by period
  const groupedValues = new Map<string, number>();

  for (const v of values) {
    const periodKey = getPeriodKey(v.period, period);
    const currentValue = groupedValues.get(periodKey) || 0;
    groupedValues.set(periodKey, currentValue + v.value);
  }

  // Convert back to array format with labels and sort by date
  return Array.from(groupedValues.entries())
    .map(([periodKey, value]) => ({
      period: periodKey,
      periodLabel: getPeriodLabel(periodKey),
      value
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * @deprecated Use aggregateValuesByPeriod instead. Kept for backwards compatibility.
 */
function aggregateMetricsByPeriodLegacy(
  metrics: MetricData[],
  period: AggregationPeriod
): MetricData[] {
  if (metrics.length === 0) {
    return metrics;
  }

  // Handle 'total' aggregation - sum all values
  if (period === 'total') {
    const totalValue = metrics.reduce((sum, m) => sum + m.value, 0);

    // Find actual min and max dates (API returns unsorted data)
    const dates = metrics.map(m => m.period).filter(p => p && p !== 'total');
    const sortedDates = dates.sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0] || 'total';
    const lastDate = sortedDates[sortedDates.length - 1] || 'total';

    const periodKey = `${firstDate} to ${lastDate}`;
    return [
      {
        period: periodKey,
        periodLabel: getPeriodLabel(periodKey),
        value: totalValue
      }
    ];
  }

  // Group metrics by period
  const groupedMetrics = new Map<string, number>();

  for (const metric of metrics) {
    const periodKey = getPeriodKey(metric.period, period);
    const currentValue = groupedMetrics.get(periodKey) || 0;
    groupedMetrics.set(periodKey, currentValue + metric.value);
  }

  // Convert back to array format with labels and sort by date
  return Array.from(groupedMetrics.entries())
    .map(([periodKey, value]) => ({
      period: periodKey,
      periodLabel: getPeriodLabel(periodKey),
      value
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Generates a period key for grouping metrics
 * @param dateStr Date string in YYYY-MM-DD format
 * @param period Aggregation period
 * @returns Period key for grouping
 */
function getPeriodKey(dateStr: string, period: AggregationPeriod): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  switch (period) {
    case 'weekly': {
      // Get ISO week number
      const weekNumber = getISOWeek(date);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${year}-${String(month + 1).padStart(2, '0')}`;

    case 'quarterly': {
      const quarter = Math.floor(month / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    case 'half-yearly': {
      const half = month < 6 ? 'H1' : 'H2';
      return `${year}-${half}`;
    }
    case 'yearly':
      return `${year}`;

    default:
      return dateStr;
  }
}

/**
 * Calculate ISO week number for a date
 * ISO weeks start on Monday and week 1 contains the first Thursday of the year
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNumber + 3); // Thursday of current week
  const firstThursday = new Date(target.getFullYear(), 0, 4); // Jan 4 is always in week 1
  const weekNumber =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7
    );
  return weekNumber;
}

// ============================================================================
// Period Label Generation
// ============================================================================

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

/**
 * Generates a human-readable label for a period key.
 * Automatically detects the period format from the key.
 *
 * @param periodKey The period key (e.g., "2024-01", "2024-Q1", "2024-W01")
 * @returns Human-readable label (e.g., "January 2024", "Q1 2024", "Week 1, 2024")
 */
export function getPeriodLabel(periodKey: string): string {
  // Total range format: "2024-01-01 to 2024-12-31"
  if (periodKey.includes(' to ')) {
    const [fromDate, toDate] = periodKey.split(' to ');
    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Validate dates before accessing month indices
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return periodKey; // Return raw key for invalid dates
    }

    const fromLabel = `${MONTH_NAMES_SHORT[from.getMonth()]} ${from.getDate()}`;
    const toLabel = `${MONTH_NAMES_SHORT[to.getMonth()]} ${to.getDate()}`;

    // Same year
    if (from.getFullYear() === to.getFullYear()) {
      return `${fromLabel} - ${toLabel}, ${from.getFullYear()}`;
    }
    return `${fromLabel}, ${from.getFullYear()} - ${toLabel}, ${to.getFullYear()}`;
  }

  // Weekly format: "2024-W01"
  if (periodKey.includes('-W')) {
    const match = periodKey.match(/^(\d{4})-W(\d{2})$/);
    if (match) {
      const [, year, week] = match;
      return `Week ${parseInt(week, 10)}, ${year}`;
    }
  }

  // Quarterly format: "2024-Q1"
  if (periodKey.includes('-Q')) {
    const match = periodKey.match(/^(\d{4})-Q(\d)$/);
    if (match) {
      const [, year, quarter] = match;
      return `Q${quarter} ${year}`;
    }
  }

  // Half-yearly format: "2024-H1"
  if (periodKey.includes('-H')) {
    const match = periodKey.match(/^(\d{4})-(H\d)$/);
    if (match) {
      const [, year, half] = match;
      return `${half} ${year}`;
    }
  }

  // Monthly format: "2024-01"
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    const [year, month] = periodKey.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTH_NAMES[monthIndex]} ${year}`;
    }
  }

  // Yearly format: "2024"
  if (/^\d{4}$/.test(periodKey)) {
    return periodKey;
  }

  // Daily format: "2024-01-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    const date = new Date(periodKey);
    // Validate date before accessing month index
    if (isNaN(date.getTime())) {
      return periodKey; // Return raw key for invalid dates
    }
    return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  // Unknown format - return as-is
  return periodKey;
}

// ============================================================================
// Prior Period Calculation
// ============================================================================

export type CompareWithType = 'prior_period' | 'prior_year' | 'none';

/**
 * Calculates the prior period date range based on comparison type.
 *
 * @param from Start date (YYYY-MM-DD)
 * @param to End date (YYYY-MM-DD)
 * @param compareWith Comparison type: 'prior_period' or 'prior_year'
 * @returns Prior period date range
 *
 * @example
 * // Prior period (same duration, immediately before)
 * calculatePriorPeriod('2024-02-01', '2024-02-29', 'prior_period')
 * // Returns: { from: '2024-01-03', to: '2024-01-31' }
 *
 * // Prior year (same dates, previous year)
 * calculatePriorPeriod('2024-01-01', '2024-03-31', 'prior_year')
 * // Returns: { from: '2023-01-01', to: '2023-03-31' }
 */
export function calculatePriorPeriod(
  from: string,
  to: string,
  compareWith: CompareWithType
): { from: string; to: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (compareWith === 'prior_year') {
    // Same dates, previous year
    const priorFrom = new Date(fromDate);
    const priorTo = new Date(toDate);
    priorFrom.setFullYear(priorFrom.getFullYear() - 1);
    priorTo.setFullYear(priorTo.getFullYear() - 1);

    return {
      from: formatDateString(priorFrom),
      to: formatDateString(priorTo)
    };
  }

  // prior_period: shift back by the same duration
  const durationMs = toDate.getTime() - fromDate.getTime();
  const priorTo = new Date(fromDate.getTime() - 1); // Day before current start
  const priorFrom = new Date(priorTo.getTime() - durationMs);

  return {
    from: formatDateString(priorFrom),
    to: formatDateString(priorTo)
  };
}

/**
 * Formats a Date object as YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Google Data Lag Validation
// ============================================================================

/** Google Business Profile data typically has a ~10 day reporting lag */
export const GOOGLE_DATA_LAG_DAYS = 10;

/**
 * Checks if the date range may have incomplete Google data due to reporting lag.
 * Google Business Profile data has a ~10 day lag.
 *
 * @param toDate End date to check (YYYY-MM-DD)
 * @returns Warning object if data may be incomplete, null otherwise
 */
export function checkGoogleDataLag(
  toDate: string
): { warning: string; warningCode: 'INCOMPLETE_DATA' } | null {
  // Parse toDate as UTC to match input format (YYYY-MM-DD interpreted as UTC)
  const to = new Date(toDate + 'T00:00:00Z');

  // Get today in UTC for consistent comparison
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const lagCutoff = new Date(todayUTC);
  lagCutoff.setUTCDate(lagCutoff.getUTCDate() - GOOGLE_DATA_LAG_DAYS);

  if (to > lagCutoff) {
    const daysAffected = Math.ceil((to.getTime() - lagCutoff.getTime()) / (1000 * 60 * 60 * 24));
    const recommendedDate = formatDateString(lagCutoff);

    return {
      warning: `Data for the last ${daysAffected} day${daysAffected > 1 ? 's' : ''} may be incomplete due to Google's ~10 day reporting lag. For complete data, use a 'to' date of ${recommendedDate} or earlier.`,
      warningCode: 'INCOMPLETE_DATA'
    };
  }

  return null;
}

// ============================================================================
// Comparison Computation
// ============================================================================

/**
 * Embeds comparison data directly into insights as flat fields, avoiding nested wrappers.
 *
 * Instead of a nested 'comparison' object, comparison fields are added directly:
 * - priorValue: The prior period's value
 * - priorPeriod: The prior period identifier
 * - priorPeriodLabel: Human-readable prior period label
 * - delta: Absolute change (current - prior)
 * - deltaPercent: Percentage change (null if prior is 0)
 *
 * @param currentData Current period insights data (using new Insight[] type)
 * @param priorData Prior period insights data
 * @returns Current data with flat comparison fields embedded in each value
 *
 * @example
 * // Before: value = { period: "2024-01", value: 250, periodLabel: "Jan 2024" }
 * // After:  value = { period: "2024-01", value: 250, periodLabel: "Jan 2024",
 * //                   priorValue: 200, priorPeriod: "2023-12", priorPeriodLabel: "Dec 2023",
 * //                   delta: 50, deltaPercent: 25 }
 */
export function embedComparison(currentData: Insight[], priorData: Insight[]): Insight[] {
  // Create a map of prior data by metric name for efficient lookup
  const priorMap = new Map<string, InsightValue[]>();

  for (const insight of priorData) {
    priorMap.set(insight.metric, insight.values);
  }

  return currentData.map(currentInsight => {
    const priorValues = priorMap.get(currentInsight.metric) || [];

    const enrichedValues: InsightValue[] = currentInsight.values.map((currentValue, index) => {
      // Match prior value by position index since period keys differ between periods
      // e.g., current "2024-01" matches with prior "2023-12" by position
      const priorValue = priorValues[index];
      const priorValueNum = priorValue?.value ?? 0;

      const delta = currentValue.value - priorValueNum;
      const deltaPercent = priorValueNum !== 0 ? (delta / priorValueNum) * 100 : null;

      return {
        period: currentValue.period,
        periodLabel: currentValue.periodLabel,
        value: currentValue.value,
        // Flat comparison fields (no nested wrapper)
        priorValue: priorValueNum,
        priorPeriod: priorValue?.period,
        priorPeriodLabel: priorValue?.periodLabel,
        delta,
        deltaPercent
      };
    });

    return {
      metric: currentInsight.metric,
      values: enrichedValues
    };
  });
}

/**
 * @deprecated Use embedComparison with Insight[] instead.
 * Legacy version for backwards compatibility during migration.
 */
export function embedComparisonLegacy(
  currentData: InsightsData[],
  priorData: InsightsData[]
): InsightsData[] {
  // Create a map of prior data by metric key for efficient lookup
  const priorMap = new Map<string, Map<string, MetricData>>();

  for (const insight of priorData) {
    const metricsMap = new Map<string, MetricData>();
    for (const metric of insight.metrics) {
      metricsMap.set(metric.period, metric);
    }
    priorMap.set(insight.key, metricsMap);
  }

  return currentData.map(currentInsight => {
    const priorMetrics = priorMap.get(currentInsight.key);
    const priorMetricsArray = priorMetrics ? Array.from(priorMetrics.values()) : [];

    const enrichedMetrics: MetricData[] = currentInsight.metrics.map((currentMetric, index) => {
      const priorMetric = priorMetricsArray[index];
      const priorValue = priorMetric?.value ?? 0;

      const delta = currentMetric.value - priorValue;
      const deltaPercent = priorValue !== 0 ? (delta / priorValue) * 100 : null;

      return {
        period: currentMetric.period,
        periodLabel: currentMetric.periodLabel,
        value: currentMetric.value,
        priorValue: priorValue,
        priorPeriod: priorMetric?.period,
        priorPeriodLabel: priorMetric?.periodLabel,
        delta,
        deltaPercent
      };
    });

    return {
      key: currentInsight.key,
      metrics: enrichedMetrics
    };
  });
}

/**
 * Flattens multi-period insights to single-value insights.
 * Used when aggregation=total to provide simpler structure for AI consumption.
 *
 * Converts: { metric: "clicks", values: [{ period: "...", value: 250, ... }] }
 * To:       { metric: "clicks", value: 250, priorValue: 200, delta: 50, deltaPercent: 25 }
 *
 * @param data Aggregated insights (should have single value per metric when aggregation=total)
 * @returns Flattened insights array
 */
export function flattenInsights(data: Insight[]): FlatInsight[] {
  return data.map(insight => {
    // Take the first (and should be only) value when aggregation=total
    const firstValue = insight.values[0];

    if (!firstValue) {
      return {
        metric: insight.metric,
        value: 0
      };
    }

    // Build flat insight, only including comparison fields if they exist
    const flatInsight: FlatInsight = {
      metric: insight.metric,
      value: firstValue.value
    };

    if (firstValue.priorValue !== undefined) {
      flatInsight.priorValue = firstValue.priorValue;
    }
    if (firstValue.delta !== undefined) {
      flatInsight.delta = firstValue.delta;
    }
    if (firstValue.deltaPercent !== undefined) {
      flatInsight.deltaPercent = firstValue.deltaPercent;
    }

    return flatInsight;
  });
}

/**
 * Converts raw API response data to the new Insight[] structure.
 * API returns data with 'key' and 'metrics', we convert to 'metric' and 'values'.
 *
 * @param apiData Raw API response array
 * @returns Converted Insight[] array
 */
export function convertApiDataToInsights(
  apiData: Array<{ key: string; metrics: Array<{ key: string; value: number }> }>
): Insight[] {
  return apiData.map(item => ({
    metric: item.key,
    values: item.metrics.map(m => ({
      period: m.key,
      periodLabel: getPeriodLabel(m.key),
      value: m.value
    }))
  }));
}

// ============================================================================
// Insights Processing Pipeline
// ============================================================================

/**
 * Result of processing insights with comparison.
 */
export interface ProcessedInsightsResult {
  /** Processed insights (flattened if aggregation=total) */
  outputData: Insight[] | FlatInsight[];
  /** Whether the output is flattened (aggregation=total) */
  isTotal: boolean;
  /** The insights with comparison embedded (for markdown formatting when not flattened) */
  insightsWithComparison: Insight[];
}

/**
 * Finalizes insights processing: embeds comparison and applies flattening.
 * Use this after you've fetched both current and prior period data.
 *
 * @param currentInsights Aggregated current period insights
 * @param priorInsights Aggregated prior period insights (or undefined if no comparison)
 * @param aggregation Time aggregation level
 * @returns Processed insights result with outputData and formatting info
 */
export function finalizeInsights(
  currentInsights: Insight[],
  priorInsights: Insight[] | undefined,
  aggregation: AggregationPeriod
): ProcessedInsightsResult {
  // Embed comparison if prior data available
  const insightsWithComparison = priorInsights
    ? embedComparison(currentInsights, priorInsights)
    : currentInsights;

  // Auto-flatten when aggregation=total for simpler AI consumption
  const isTotal = aggregation === 'total';
  const outputData: Insight[] | FlatInsight[] = isTotal
    ? flattenInsights(insightsWithComparison)
    : insightsWithComparison;

  return {
    outputData,
    isTotal,
    insightsWithComparison
  };
}

/**
 * Formats an ApiError into a standard MCP-compliant tool response.
 * Provides consistent error formatting across all tools.
 *
 * MCP compliance:
 * - Sets `isError: true` to help clients identify error responses
 * - Prefixes messages with "Error:" for standardized formatting
 *
 * @param error The ApiError to format
 * @param context Optional context string to identify which resource/operation failed
 *                (e.g., "storeId '1234'" or "location 'Main Street Store'")
 */
export function formatErrorResponse(error: ApiError, context?: string) {
  const baseMessage = context ? `Failed for ${context}: ${error.message}` : error.message;
  // Prevent double-prefixing if message already starts with "Error:"
  const message = baseMessage.startsWith('Error:') ? baseMessage : `Error: ${baseMessage}`;
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    structuredContent: {
      error: message,
      errorCode: error.code,
      retryable: error.retryable
    }
  };
}

/**
 * Formats content based on the requested response format.
 * Use this in tool handlers to support both JSON and Markdown output.
 *
 * @param data The data to format
 * @param format The response format ('json' or 'markdown')
 * @param markdownFormatter Function to convert data to markdown
 * @returns Formatted text content
 *
 * @example
 * // In a tool handler:
 * const textContent = formatContent(data, response_format, formatLocationAsMarkdown);
 */
export function formatContent<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter: (data: T) => string
): string {
  switch (format) {
    case 'markdown':
      return markdownFormatter(data);
    case 'json':
      return JSON.stringify(data);
    default: {
      // Exhaustive check - TypeScript will error if new format added without handling
      const _exhaustive: never = format;
      return JSON.stringify(data);
    }
  }
}
