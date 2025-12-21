import {
  MetricData,
  InsightsData,
  ResponseFormat,
  ComparisonInsightsData,
  ComparisonMetric
} from './schemas/output';
import { ApiError } from './errors';

/** Maximum rows to display in Markdown tables before truncating */
export const MARKDOWN_TABLE_MAX_ROWS = 50;

export type AggregationPeriod =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly'
  | 'total';

/**
 * Aggregates metrics data by the specified time period
 * @param data Array of insights data with daily metrics
 * @param period Aggregation period (daily, weekly, monthly, etc.)
 * @returns Aggregated data with the same structure
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
    const aggregatedMetrics = aggregateMetricsByPeriod(insightData.metrics, period);
    return {
      key: insightData.key,
      metrics: aggregatedMetrics
    };
  });
}

/**
 * Aggregates an array of metric data points by the specified period.
 * Always includes human-readable labels for each period.
 */
function aggregateMetricsByPeriod(metrics: MetricData[], period: AggregationPeriod): MetricData[] {
  if (metrics.length === 0) {
    return metrics;
  }

  // Handle 'total' aggregation - sum all values
  if (period === 'total') {
    const totalValue = metrics.reduce((sum, m) => sum + m.value, 0);
    const firstDate = metrics[0]?.key || 'total';
    const lastDate = metrics[metrics.length - 1]?.key || 'total';
    const key = `${firstDate} to ${lastDate}`;
    return [
      {
        key,
        value: totalValue,
        label: getPeriodLabel(key)
      }
    ];
  }

  // Group metrics by period
  const groupedMetrics = new Map<string, number>();

  for (const metric of metrics) {
    const periodKey = getPeriodKey(metric.key, period);
    const currentValue = groupedMetrics.get(periodKey) || 0;
    groupedMetrics.set(periodKey, currentValue + metric.value);
  }

  // Convert back to array format with labels and sort by date
  return Array.from(groupedMetrics.entries())
    .map(([key, value]) => ({
      key,
      value,
      label: getPeriodLabel(key)
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
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
  const to = new Date(toDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  const lagCutoff = new Date(today);
  lagCutoff.setDate(lagCutoff.getDate() - GOOGLE_DATA_LAG_DAYS);

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
 * Computes comparison metrics between current and prior period data.
 *
 * @param currentData Current period insights data
 * @param priorData Prior period insights data
 * @returns Comparison insights data with deltas
 */
export function computeComparison(
  currentData: InsightsData[],
  priorData: InsightsData[]
): ComparisonInsightsData[] {
  // Create a map of prior data by metric key for efficient lookup
  const priorMap = new Map<string, Map<string, MetricData>>();

  for (const insight of priorData) {
    const metricsMap = new Map<string, MetricData>();
    for (const metric of insight.metrics) {
      metricsMap.set(metric.key, metric);
    }
    priorMap.set(insight.key, metricsMap);
  }

  return currentData.map(currentInsight => {
    const priorMetrics = priorMap.get(currentInsight.key);

    const comparisonMetrics: ComparisonMetric[] = currentInsight.metrics.map(currentMetric => {
      // Find matching prior metric
      // For comparison, we need to match by position since keys differ between periods
      // When aggregated, there's typically one metric per dimension
      const priorMetric = priorMetrics?.values().next().value as MetricData | undefined;
      const priorValue = priorMetric?.value ?? 0;

      const delta = currentMetric.value - priorValue;
      const deltaPercent = priorValue !== 0 ? (delta / priorValue) * 100 : null;

      return {
        key: currentMetric.key,
        current: currentMetric.value,
        prior: priorValue,
        delta,
        deltaPercent,
        currentLabel: currentMetric.label,
        priorLabel: priorMetric?.label
      };
    });

    return {
      key: currentInsight.key,
      metrics: comparisonMetrics
    };
  });
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
