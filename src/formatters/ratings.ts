import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';

/**
 * Single location rating data (aggregated format)
 */
interface RatingData {
  storeId?: string;
  averageRating?: number;
  totalReviews?: number;
  distribution?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * Individual review data (from API)
 */
interface ReviewData {
  storeId: string;
  rating: number;
  comment?: string;
  date?: string;
  hasAnswer?: boolean;
  reply?: string;
  id?: string;
}

/**
 * Type guard to detect if data is individual reviews vs aggregated ratings
 */
function isReviewData(data: unknown[]): data is ReviewData[] {
  if (data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return 'rating' in first && !('averageRating' in first);
}

/**
 * Aggregates individual reviews by store into rating summaries
 */
function aggregateReviewsByStore(reviews: ReviewData[]): RatingData[] {
  const storeMap = new Map<string, number[]>();

  for (const review of reviews) {
    const ratings = storeMap.get(review.storeId) || [];
    ratings.push(review.rating);
    storeMap.set(review.storeId, ratings);
  }

  return Array.from(storeMap.entries()).map(([storeId, ratings]) => {
    const sum = ratings.reduce((a, b) => a + b, 0);
    const distribution: Record<string, number> = {};
    for (const r of ratings) {
      const key = String(Math.round(r));
      distribution[key] = (distribution[key] || 0) + 1;
    }

    return {
      storeId,
      averageRating: sum / ratings.length,
      totalReviews: ratings.length,
      distribution
    };
  });
}

/**
 * Formats ratings data as Markdown.
 * Handles both single location and all-locations response formats.
 */
export function formatRatingsAsMarkdown(data: unknown): string {
  if (!data) {
    return '## Ratings\n\nNo ratings data available.';
  }

  // Handle array of ratings (all locations)
  if (Array.isArray(data)) {
    // Detect if this is individual review data vs aggregated data
    if (isReviewData(data)) {
      const aggregated = aggregateReviewsByStore(data);
      return formatAllRatingsAsMarkdown(aggregated);
    }
    return formatAllRatingsAsMarkdown(data as RatingData[]);
  }

  // Handle single location rating
  return formatSingleRatingAsMarkdown(data as RatingData);
}

/**
 * Formats ratings for all locations as a Markdown table.
 */
function formatAllRatingsAsMarkdown(ratings: RatingData[]): string {
  if (ratings.length === 0) {
    return '## Ratings\n\nNo ratings data available.';
  }

  let md = '## Ratings (All Locations)\n\n';
  md += `**Total locations:** ${ratings.length}\n\n`;

  // Table header
  md += '| Store ID | Avg Rating | Total Reviews |\n';
  md += '|----------|------------|---------------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(ratings.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const rating = ratings[i];
    const avgRating = rating.averageRating?.toFixed(1) || '-';
    const totalReviews = rating.totalReviews?.toLocaleString('en-US') || '0';
    md += `| ${rating.storeId || '-'} | ${avgRating} | ${totalReviews} |\n`;
  }

  // Truncation notice
  if (ratings.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = ratings.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more locations (use structuredContent for full data)*\n`;
  }

  return md;
}

/**
 * Formats a single location's rating as Markdown.
 */
function formatSingleRatingAsMarkdown(rating: RatingData): string {
  let md = '## Rating Summary\n\n';

  if (rating.storeId) {
    md += `**Store ID:** ${rating.storeId}\n`;
  }

  md += `**Average Rating:** ${rating.averageRating?.toFixed(1) || 'N/A'} / 5.0\n`;
  md += `**Total Reviews:** ${rating.totalReviews?.toLocaleString('en-US') || '0'}\n\n`;

  // Rating distribution if available
  if (rating.distribution && Object.keys(rating.distribution).length > 0) {
    md += '### Rating Distribution\n\n';
    md += '| Stars | Count | Bar |\n';
    md += '|-------|-------|-----|\n';

    const total = rating.totalReviews || 1;

    // Display in descending order (5 stars to 1 star)
    for (let stars = 5; stars >= 1; stars--) {
      const key = String(stars);
      const count = rating.distribution[key] || 0;
      const percentage = (count / total) * 100;
      const barLength = Math.round(percentage / 5); // Max 20 chars
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      md += `| ${stars} ⭐ | ${count.toLocaleString('en-US')} | ${bar} |\n`;
    }
  }

  return md;
}

/**
 * Formats ratings for a specific location as Markdown.
 * Ensures storeId is set in the rating data before formatting.
 */
export function formatLocationRatingsAsMarkdown(data: unknown, storeId: string): string {
  if (!data) {
    return `## Ratings for ${storeId}\n\nNo ratings data available.`;
  }

  const ratingData = { ...(data as RatingData), storeId };

  return formatSingleRatingAsMarkdown(ratingData);
}
