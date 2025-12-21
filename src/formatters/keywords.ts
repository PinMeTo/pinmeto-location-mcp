import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';

/**
 * Keyword data structure from PinMeTo API
 */
interface KeywordData {
  keyword?: string;
  value?: number; // Impressions count
  locationCounts?: number;
  [key: string]: unknown;
}

/**
 * Formats keywords data as Markdown.
 * Handles both all-locations and single-location response formats.
 */
export function formatKeywordsAsMarkdown(data: unknown): string {
  if (!data) {
    return '## Keywords\n\nNo keywords data available.';
  }

  // Handle array of keywords
  if (Array.isArray(data)) {
    return formatKeywordsArrayAsMarkdown(data as KeywordData[]);
  }

  // Handle object with nested structure
  return formatKeywordsObjectAsMarkdown(data);
}

/**
 * Formats an array of keywords as a Markdown table.
 */
function formatKeywordsArrayAsMarkdown(keywords: KeywordData[]): string {
  if (keywords.length === 0) {
    return '## Keywords\n\nNo keywords data available.';
  }

  let md = '## Google Keywords\n\n';
  md += `**Total keywords:** ${keywords.length}\n\n`;

  // Table header
  md += '| Keyword | Impressions |\n';
  md += '|---------|-------------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(keywords.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const kw = keywords[i];
    const impressions = kw.value || 0;

    md += `| ${kw.keyword || '-'} | ${impressions.toLocaleString('en-US')} |\n`;
  }

  // Truncation notice
  if (keywords.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = keywords.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more keywords (use structuredContent for full data)*\n`;
  }

  return md;
}

/**
 * Formats a keywords object (possibly with nested location data) as Markdown.
 */
function formatKeywordsObjectAsMarkdown(data: unknown): string {
  let md = '## Google Keywords\n\n';

  // If it has a data array, extract it
  const obj = data as Record<string, unknown>;
  if (obj.data && Array.isArray(obj.data)) {
    return formatKeywordsArrayAsMarkdown(obj.data as KeywordData[]);
  }

  // Otherwise, display as key-value pairs
  md += '```json\n';
  md += JSON.stringify(data, null, 2);
  md += '\n```\n';

  return md;
}

/**
 * Formats keywords for a specific location as Markdown.
 */
export function formatLocationKeywordsAsMarkdown(data: unknown, storeId: string): string {
  if (!data) {
    return `## Keywords for ${storeId}\n\nNo keywords data available.`;
  }

  // Handle array
  if (Array.isArray(data)) {
    const keywords = data as KeywordData[];
    if (keywords.length === 0) {
      return `## Keywords for ${storeId}\n\nNo keywords data available.`;
    }

    let md = `## Google Keywords for Store: ${storeId}\n\n`;
    md += `**Total keywords:** ${keywords.length}\n\n`;

    // Table header
    md += '| Keyword | Impressions |\n';
    md += '|---------|-------------|\n';

    // Table rows (truncated)
    const displayCount = Math.min(keywords.length, MARKDOWN_TABLE_MAX_ROWS);
    for (let i = 0; i < displayCount; i++) {
      const kw = keywords[i];
      const impressions = kw.value || 0;

      md += `| ${kw.keyword || '-'} | ${impressions.toLocaleString('en-US')} |\n`;
    }

    // Truncation notice
    if (keywords.length > MARKDOWN_TABLE_MAX_ROWS) {
      const remaining = keywords.length - MARKDOWN_TABLE_MAX_ROWS;
      md += `\n*... and ${remaining} more keywords (use structuredContent for full data)*\n`;
    }

    return md;
  }

  // Fallback for other formats
  return formatKeywordsObjectAsMarkdown(data);
}
