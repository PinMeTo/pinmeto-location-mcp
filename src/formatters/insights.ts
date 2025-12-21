import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import { InsightsData } from '../schemas/output';

/**
 * Formats insights data as Markdown.
 * Each insight dimension becomes a section with a metrics table.
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

    // Table rows (truncated)
    const displayCount = Math.min(insight.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = insight.metrics[i];
      md += `| ${metric.key} | ${formatNumber(metric.value)} |\n`;
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
 */
export function formatLocationInsightsAsMarkdown(
  data: InsightsData[],
  storeId: string
): string {
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

    // Table rows (truncated)
    const displayCount = Math.min(insight.metrics.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const metric = insight.metrics[i];
      md += `| ${metric.key} | ${formatNumber(metric.value)} |\n`;
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
