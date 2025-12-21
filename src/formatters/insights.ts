import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import { InsightsData, ComparisonInsightsData, ComparisonPeriod } from '../schemas/output';

/**
 * Formats insights data as Markdown.
 * Each insight dimension becomes a section with a metrics table.
 * Uses human-readable labels when available.
 */
export function formatInsightsAsMarkdown(data: InsightsData[]): string {
  if (!data || data.length === 0) {
    return '## Insights\n\nNo insights data available.';
  }

  let md = '## Insights\n\n';

  for (const insight of data) {
    md += `### ${formatMetricName(insight.key)}\n\n`;

    if (!insight.metrics || insight.metrics.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Table header
    md += '| Period | Value |\n';
    md += '|--------|-------|\n';

    // Table rows (truncated) - use label if available
    const displayCount = Math.min(insight.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = insight.metrics[i];
      const periodDisplay = metric.label || metric.key;
      md += `| ${periodDisplay} | ${formatNumber(metric.value)} |\n`;
    }

    // Truncation notice
    if (insight.metrics.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = insight.metrics.length - MARKDOWN_TABLE_MAX_ROWS;
      md += `\n*... and ${remaining} more rows (use structuredContent for full data)*\n`;
    }

    md += '\n';
  }

  return md;
}

/**
 * Formats insights for a specific location as Markdown.
 * Includes location identifier in the header.
 * Uses human-readable labels when available.
 */
export function formatLocationInsightsAsMarkdown(data: InsightsData[], storeId: string): string {
  if (!data || data.length === 0) {
    return `## Insights for ${storeId}\n\nNo insights data available.`;
  }

  let md = `## Insights for Store: ${storeId}\n\n`;

  for (const insight of data) {
    md += `### ${formatMetricName(insight.key)}\n\n`;

    if (!insight.metrics || insight.metrics.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Table header
    md += '| Period | Value |\n';
    md += '|--------|-------|\n';

    // Table rows (truncated) - use label if available
    const displayCount = Math.min(insight.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = insight.metrics[i];
      const periodDisplay = metric.label || metric.key;
      md += `| ${periodDisplay} | ${formatNumber(metric.value)} |\n`;
    }

    // Truncation notice
    if (insight.metrics.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = insight.metrics.length - MARKDOWN_TABLE_MAX_ROWS;
      md += `\n*... and ${remaining} more rows (use structuredContent for full data)*\n`;
    }

    md += '\n';
  }

  return md;
}

/**
 * Formats insights with comparison data as Markdown.
 * Shows current vs prior period values with deltas.
 */
export function formatInsightsWithComparisonAsMarkdown(
  data: InsightsData[],
  comparisonData: ComparisonInsightsData[],
  comparisonPeriod: ComparisonPeriod,
  storeId?: string
): string {
  if (!comparisonData || comparisonData.length === 0) {
    // Fall back to regular format if no comparison data
    return storeId
      ? formatLocationInsightsAsMarkdown(data, storeId)
      : formatInsightsAsMarkdown(data);
  }

  const header = storeId
    ? `## Insights Comparison for Store: ${storeId}\n\n`
    : '## Insights Comparison\n\n';

  let md = header;

  // Show period ranges
  md += `**Current Period:** ${comparisonPeriod.current.from} to ${comparisonPeriod.current.to}\n`;
  md += `**Prior Period:** ${comparisonPeriod.prior.from} to ${comparisonPeriod.prior.to}\n\n`;

  for (const comparison of comparisonData) {
    md += `### ${formatMetricName(comparison.key)}\n\n`;

    if (!comparison.metrics || comparison.metrics.length === 0) {
      md += '*No comparison data for this metric.*\n\n';
      continue;
    }

    // Comparison table header
    md += '| Period | Current | Prior | Change | % Change |\n';
    md += '|--------|--------:|------:|-------:|---------:|\n';

    // Table rows (truncated)
    const displayCount = Math.min(comparison.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = comparison.metrics[i];
      const periodDisplay = metric.currentLabel || metric.key;
      const deltaSign = metric.delta >= 0 ? '+' : '';
      const pctChange =
        metric.deltaPercent !== null
          ? `${metric.deltaPercent >= 0 ? '+' : ''}${metric.deltaPercent.toFixed(1)}%`
          : 'N/A';

      md += `| ${periodDisplay} | ${formatNumber(metric.current)} | ${formatNumber(metric.prior)} | ${deltaSign}${formatNumber(metric.delta)} | ${pctChange} |\n`;
    }

    // Truncation notice
    if (comparison.metrics.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = comparison.metrics.length - MARKDOWN_TABLE_MAX_ROWS;
      md += `\n*... and ${remaining} more rows (use structuredContent for full data)*\n`;
    }

    md += '\n';
  }

  return md;
}

/**
 * Formats a metric name for display.
 * Converts snake_case or camelCase to Title Case.
 */
function formatMetricName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Formats a number for display with locale-aware separators.
 * Returns '-' for invalid or missing values to handle malformed API responses.
 */
function formatNumber(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return value.toLocaleString('en-US');
}
