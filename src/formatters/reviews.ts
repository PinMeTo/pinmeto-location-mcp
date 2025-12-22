import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import { Review } from '../schemas/output';

/**
 * Maximum characters for comment preview in markdown table
 */
const COMMENT_MAX_LENGTH = 60;

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 * Handles null/undefined gracefully.
 */
function truncateComment(comment: string | undefined, maxLength: number = COMMENT_MAX_LENGTH): string {
  if (!comment) return '-';
  if (comment.length <= maxLength) return comment;
  return comment.substring(0, maxLength - 3) + '...';
}

/**
 * Escapes pipe characters in text for markdown table cells.
 */
function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Formats a rating as stars emoji
 */
function formatStars(rating: number): string {
  return '⭐'.repeat(Math.min(5, Math.max(1, Math.round(rating))));
}

/**
 * Formats response status as indicator
 */
function formatResponseStatus(hasResponse: boolean): string {
  return hasResponse ? '✅ Yes' : '❌ No';
}

/**
 * Formats reviews data as Markdown with pagination info.
 * Handles both single location and all-locations response formats.
 */
export function formatReviewsAsMarkdown(
  reviews: Review[],
  options?: {
    totalCount?: number;
    hasMore?: boolean;
    offset?: number;
    limit?: number;
  }
): string {
  if (!reviews || reviews.length === 0) {
    return '## Reviews\n\nNo reviews found matching the criteria.';
  }

  let md = '## Reviews\n\n';

  // Pagination info
  if (options?.totalCount !== undefined) {
    md += `**Total reviews:** ${options.totalCount.toLocaleString('en-US')}`;
    if (options.offset !== undefined && options.limit !== undefined) {
      const start = options.offset + 1;
      const end = Math.min(options.offset + reviews.length, options.totalCount);
      md += ` (showing ${start}-${end})`;
    }
    md += '\n\n';
  }

  // Table header
  md += '| Store ID | Rating | Date | Comment | Responded |\n';
  md += '|----------|--------|------|---------|----------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(reviews.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const review = reviews[i];
    const stars = formatStars(review.rating);
    const date = review.date || '-';
    const comment = escapeTableCell(truncateComment(review.comment));
    const responded = formatResponseStatus(!!review.ownerResponse);

    md += `| ${review.storeId} | ${stars} | ${date} | ${comment} | ${responded} |\n`;
  }

  // Truncation notice
  if (reviews.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = reviews.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more reviews (use structuredContent for full data)*\n`;
  }

  // Has more notice
  if (options?.hasMore) {
    md += `\n*More reviews available - use offset parameter to paginate*\n`;
  }

  return md;
}

/**
 * Formats reviews for a specific location as Markdown.
 * Similar to formatReviewsAsMarkdown but with storeId in header instead of column.
 */
export function formatLocationReviewsAsMarkdown(
  reviews: Review[],
  storeId: string,
  options?: {
    totalCount?: number;
    hasMore?: boolean;
    offset?: number;
    limit?: number;
  }
): string {
  if (!reviews || reviews.length === 0) {
    return `## Reviews for ${storeId}\n\nNo reviews found matching the criteria.`;
  }

  let md = `## Reviews for ${storeId}\n\n`;

  // Pagination info
  if (options?.totalCount !== undefined) {
    md += `**Total reviews:** ${options.totalCount.toLocaleString('en-US')}`;
    if (options.offset !== undefined && options.limit !== undefined) {
      const start = options.offset + 1;
      const end = Math.min(options.offset + reviews.length, options.totalCount);
      md += ` (showing ${start}-${end})`;
    }
    md += '\n\n';
  }

  // Table header (no Store ID column since it's in the header)
  md += '| Rating | Date | Comment | Responded |\n';
  md += '|--------|------|---------|----------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(reviews.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const review = reviews[i];
    const stars = formatStars(review.rating);
    const date = review.date || '-';
    const comment = escapeTableCell(truncateComment(review.comment));
    const responded = formatResponseStatus(!!review.ownerResponse);

    md += `| ${stars} | ${date} | ${comment} | ${responded} |\n`;
  }

  // Truncation notice
  if (reviews.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = reviews.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more reviews (use structuredContent for full data)*\n`;
  }

  // Has more notice
  if (options?.hasMore) {
    md += `\n*More reviews available - use offset parameter to paginate*\n`;
  }

  return md;
}
