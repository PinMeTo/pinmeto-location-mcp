import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import { InsightsData, ComparisonPeriod } from '../schemas/output';

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
 * Formats insights with embedded comparison data as Markdown.
 * Shows current vs prior period values with deltas.
 *
 * The comparison data is embedded in each metric as metric.comparison
 * (unified structure - no separate comparisonData array).
 */
export function formatInsightsWithComparisonAsMarkdown(
  data: InsightsData[],
  comparisonPeriod: ComparisonPeriod,
  storeId?: string
): string {
  if (!data || data.length === 0) {
    return storeId
      ? `## Insights Comparison for ${storeId}\n\nNo insights data available.`
      : '## Insights Comparison\n\nNo insights data available.';
  }

  const header = storeId
    ? `## Insights Comparison for Store: ${storeId}\n\n`
    : '## Insights Comparison\n\n';

  let md = header;

  // Show period ranges
  md += `**Current Period:** ${comparisonPeriod.current.from} to ${comparisonPeriod.current.to}\n`;
  md += `**Prior Period:** ${comparisonPeriod.prior.from} to ${comparisonPeriod.prior.to}\n\n`;

  for (const insight of data) {
    md += `### ${formatMetricName(insight.key)}\n\n`;

    if (!insight.metrics || insight.metrics.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Comparison table header
    md += '| Period | Current | Prior | Change | % Change |\n';
    md += '|--------|--------:|------:|-------:|---------:|\n';

    // Table rows (truncated)
    const displayCount = Math.min(insight.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = insight.metrics[i];
      const periodDisplay = metric.label || metric.key;
      const comparison = metric.comparison;

      if (comparison) {
        const deltaSign = comparison.delta >= 0 ? '+' : '';
        const pctChange =
          comparison.deltaPercent !== null
            ? `${comparison.deltaPercent >= 0 ? '+' : ''}${comparison.deltaPercent.toFixed(1)}%`
            : 'N/A';

        md += `| ${periodDisplay} | ${formatNumber(metric.value)} | ${formatNumber(comparison.prior)} | ${deltaSign}${formatNumber(comparison.delta)} | ${pctChange} |\n`;
      } else {
        // Metric without comparison data (shouldn't happen in normal flow)
        md += `| ${periodDisplay} | ${formatNumber(metric.value)} | - | - | - |\n`;
      }
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
