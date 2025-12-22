import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import { Insight, FlatInsight, PeriodRange } from '../schemas/output';

/**
 * Formats insights data as Markdown.
 * Each insight dimension becomes a section with a values table.
 * Uses human-readable labels when available.
 */
export function formatInsightsAsMarkdown(data: Insight[]): string {
  if (!data || data.length === 0) {
    return '## Insights\n\nNo insights data available.';
  }

  let md = '## Insights\n\n';

  for (const insight of data) {
    md += `### ${formatMetricName(insight.metric)}\n\n`;

    if (!insight.values || insight.values.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Table header
    md += '| Period | Value |\n';
    md += '|--------|-------|\n';

    // Table rows (truncated) - use periodLabel if available
    const displayCount = Math.min(insight.values.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const val = insight.values[i];
      const periodDisplay = val.periodLabel || val.period;
      md += `| ${periodDisplay} | ${formatNumber(val.value)} |\n`;
    }

    // Truncation notice
    if (insight.values.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = insight.values.length - MARKDOWN_TABLE_MAX_ROWS;
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
export function formatLocationInsightsAsMarkdown(data: Insight[], storeId: string): string {
  if (!data || data.length === 0) {
    return `## Insights for ${storeId}\n\nNo insights data available.`;
  }

  let md = `## Insights for Store: ${storeId}\n\n`;

  for (const insight of data) {
    md += `### ${formatMetricName(insight.metric)}\n\n`;

    if (!insight.values || insight.values.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Table header
    md += '| Period | Value |\n';
    md += '|--------|-------|\n';

    // Table rows (truncated) - use periodLabel if available
    const displayCount = Math.min(insight.values.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const val = insight.values[i];
      const periodDisplay = val.periodLabel || val.period;
      md += `| ${periodDisplay} | ${formatNumber(val.value)} |\n`;
    }

    // Truncation notice
    if (insight.values.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = insight.values.length - MARKDOWN_TABLE_MAX_ROWS;
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
 * Comparison data is now flat on each value (priorValue, delta, deltaPercent).
 */
export function formatInsightsWithComparisonAsMarkdown(
  data: Insight[],
  periodRange: PeriodRange,
  priorPeriodRange: PeriodRange,
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
  md += `**Current Period:** ${periodRange.from} to ${periodRange.to}\n`;
  md += `**Prior Period:** ${priorPeriodRange.from} to ${priorPeriodRange.to}\n\n`;

  for (const insight of data) {
    md += `### ${formatMetricName(insight.metric)}\n\n`;

    if (!insight.values || insight.values.length === 0) {
      md += '*No data for this metric.*\n\n';
      continue;
    }

    // Comparison table header
    md += '| Period | Current | Prior | Change | % Change |\n';
    md += '|--------|--------:|------:|-------:|---------:|\n';

    // Table rows (truncated)
    const displayCount = Math.min(insight.values.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const val = insight.values[i];
      const periodDisplay = val.periodLabel || val.period;

      // Comparison fields are now flat on the value object
      if (val.priorValue !== undefined && val.delta !== undefined) {
        const deltaSign = val.delta >= 0 ? '+' : '';
        const pctChange =
          val.deltaPercent !== null && val.deltaPercent !== undefined
            ? `${val.deltaPercent >= 0 ? '+' : ''}${val.deltaPercent.toFixed(1)}%`
            : 'N/A';

        md += `| ${periodDisplay} | ${formatNumber(val.value)} | ${formatNumber(val.priorValue)} | ${deltaSign}${formatNumber(val.delta)} | ${pctChange} |\n`;
      } else {
        // Value without comparison data
        md += `| ${periodDisplay} | ${formatNumber(val.value)} | - | - | - |\n`;
      }
    }

    // Truncation notice
    if (insight.values.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = insight.values.length - MARKDOWN_TABLE_MAX_ROWS;
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

/**
 * Formats flattened insights (from aggregation=total) as Markdown.
 * Simple table with Metric | Value | Prior | Change columns.
 */
export function formatFlatInsightsAsMarkdown(
  data: FlatInsight[],
  periodRange: PeriodRange,
  priorPeriodRange?: PeriodRange,
  storeId?: string
): string {
  if (!data || data.length === 0) {
    return storeId
      ? `## Insights for ${storeId}\n\nNo insights data available.`
      : '## Insights\n\nNo insights data available.';
  }

  const header = storeId
    ? `## Insights for Store: ${storeId}\n\n`
    : '## Insights Summary\n\n';

  let md = header;

  // Show period range
  md += `**Period:** ${periodRange.from} to ${periodRange.to}\n`;
  if (priorPeriodRange) {
    md += `**Compared to:** ${priorPeriodRange.from} to ${priorPeriodRange.to}\n`;
  }
  md += '\n';

  // Check if we have comparison data
  const hasComparison = data.some(d => d.priorValue !== undefined);

  if (hasComparison) {
    md += '| Metric | Value | Prior | Change | % Change |\n';
    md += '|--------|------:|------:|-------:|---------:|\n';

    for (const insight of data) {
      const metricName = formatMetricName(insight.metric);
      const value = formatNumber(insight.value);

      if (insight.priorValue !== undefined && insight.delta !== undefined) {
        const prior = formatNumber(insight.priorValue);
        const deltaSign = insight.delta >= 0 ? '+' : '';
        const delta = `${deltaSign}${formatNumber(insight.delta)}`;
        const pctChange =
          insight.deltaPercent !== null && insight.deltaPercent !== undefined
            ? `${insight.deltaPercent >= 0 ? '+' : ''}${insight.deltaPercent.toFixed(1)}%`
            : 'N/A';
        md += `| ${metricName} | ${value} | ${prior} | ${delta} | ${pctChange} |\n`;
      } else {
        md += `| ${metricName} | ${value} | - | - | - |\n`;
      }
    }
  } else {
    md += '| Metric | Value |\n';
    md += '|--------|------:|\n';

    for (const insight of data) {
      md += `| ${formatMetricName(insight.metric)} | ${formatNumber(insight.value)} |\n`;
    }
  }

  return md;
}
