export type AggregationPeriod =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly'
  | 'total';

interface MetricData {
  key: string;
  value: number;
}

interface InsightsData {
  key: string;
  metrics: MetricData[];
}

/**
 * Aggregates metrics data by the specified time period
 * @param data Array of insights data with daily metrics
 * @param period Aggregation period (daily, weekly, monthly, etc.)
 * @returns Aggregated data with the same structure
 */
export function aggregateMetrics(
  data: InsightsData[],
  period: AggregationPeriod = 'daily'
): InsightsData[] {
  // Return unchanged if daily or no data
  if (period === 'daily' || !data || data.length === 0) {
    return data;
  }

  return data.map((insightData) => {
    const aggregatedMetrics = aggregateMetricsByPeriod(insightData.metrics, period);
    return {
      key: insightData.key,
      metrics: aggregatedMetrics
    };
  });
}

/**
 * Aggregates an array of metric data points by the specified period
 */
function aggregateMetricsByPeriod(
  metrics: MetricData[],
  period: AggregationPeriod
): MetricData[] {
  if (metrics.length === 0) {
    return metrics;
  }

  // Handle 'total' aggregation - sum all values
  if (period === 'total') {
    const totalValue = metrics.reduce((sum, m) => sum + m.value, 0);
    const firstDate = metrics[0]?.key || 'total';
    const lastDate = metrics[metrics.length - 1]?.key || 'total';
    return [
      {
        key: `${firstDate} to ${lastDate}`,
        value: totalValue
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

  // Convert back to array format and sort by date
  return Array.from(groupedMetrics.entries())
    .map(([key, value]) => ({ key, value }))
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
    1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return weekNumber;
}

export function formatListResponse(response: any[], areAllPagesFetched: boolean): string {
  if (response.length === 0) {
    return 'The response was empty...';
  }
  let formattedMessage = '-'.repeat(20);
  if (!areAllPagesFetched) {
    formattedMessage =
      'Not All pages were successfully fetched, collected data:\n' + formattedMessage;
  }
  for (const result of response) {
    formattedMessage += '\n' + JSON.stringify(result, null, 2) + '\n' + '-'.repeat(20);
  }
  return formattedMessage;
}
