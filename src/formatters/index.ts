/**
 * Formatters module - Centralized Markdown formatters for all tool responses.
 *
 * Each formatter converts structured data to human-readable Markdown with:
 * - Headers for organization
 * - Tables for tabular data
 * - Truncation at MARKDOWN_TABLE_MAX_ROWS for large datasets
 *
 * Usage in tools:
 * ```typescript
 * import { formatContent } from '../helpers';
 * import { formatLocationAsMarkdown } from '../formatters';
 *
 * const textContent = formatContent(data, response_format, formatLocationAsMarkdown);
 * ```
 */

export * from './locations';
export * from './insights';
export * from './ratings';
export * from './reviews';
export * from './keywords';
