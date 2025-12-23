/**
 * Batch processing for large review datasets.
 * Splits reviews into batches, processes each, and merges results.
 */

import { SanitizedReview } from '../helpers';
import { AnalysisType, ReviewInsightsData } from '../schemas/output';
import { buildSamplingRequest, buildMergeRequest, SamplingRequestOptions } from './request-builder';
import { parseSamplingResponse, normalizeResponseData, SamplingResponse, SamplingParseError } from './response-parser';

/**
 * Default batch size for processing reviews.
 * ~300 reviews keeps us well under typical context limits.
 */
export const DEFAULT_BATCH_SIZE = 300;

/**
 * Maximum number of batches before requiring explicit confirmation.
 * Prevents runaway token usage.
 */
export const MAX_BATCHES = 20;

/**
 * Function type for making sampling requests.
 * This allows injection of the actual MCP sampling implementation.
 */
export type SamplingFunction = (
  request: ReturnType<typeof buildSamplingRequest>
) => Promise<SamplingResponse>;

/**
 * Batch processing result with metadata.
 */
export interface BatchProcessingResult {
  /** The merged analysis result */
  data: ReviewInsightsData;
  /** Number of batches processed */
  batchCount: number;
  /** Total reviews processed */
  totalReviews: number;
  /** Whether all batches succeeded */
  complete: boolean;
  /** Errors from failed batches (if any) */
  errors?: string[];
}

/**
 * Processes reviews in batches when the dataset is too large for single pass.
 *
 * @param reviews All reviews to analyze
 * @param options Analysis options
 * @param samplingFn Function to make sampling requests
 * @param batchSize Reviews per batch
 * @returns Merged analysis result
 */
export async function processInBatches(
  reviews: SanitizedReview[],
  options: SamplingRequestOptions,
  samplingFn: SamplingFunction,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<BatchProcessingResult> {
  const batches = splitIntoBatches(reviews, batchSize);

  // Safety check
  if (batches.length > MAX_BATCHES) {
    throw new Error(
      `Dataset would require ${batches.length} batches, exceeding maximum of ${MAX_BATCHES}. ` +
      `Use sampling strategy to reduce dataset size.`
    );
  }

  // Process each batch
  const batchResults: ReviewInsightsData[] = [];
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const request = buildSamplingRequest(batch, options);
      const response = await samplingFn(request);
      const parsed = parseSamplingResponse(response, options.analysisType);
      const normalized = normalizeResponseData(parsed, options.analysisType);
      batchResults.push(normalized);
    } catch (e) {
      const errorMsg = e instanceof SamplingParseError
        ? `Batch ${i + 1}: ${e.message}`
        : `Batch ${i + 1}: ${(e as Error).message}`;
      errors.push(errorMsg);
      console.error(`Batch ${i + 1}/${batches.length} failed:`, e);
    }
  }

  // If no batches succeeded, throw
  if (batchResults.length === 0) {
    throw new Error(`All ${batches.length} batches failed: ${errors.join('; ')}`);
  }

  // If only one batch (or only one succeeded), return it directly
  if (batchResults.length === 1) {
    return {
      data: batchResults[0],
      batchCount: batches.length,
      totalReviews: reviews.length,
      complete: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Merge multiple batch results
  try {
    const mergeRequest = buildMergeRequest(batchResults, options.analysisType);
    const mergeResponse = await samplingFn(mergeRequest);
    const mergedData = parseSamplingResponse(mergeResponse, options.analysisType);
    const normalizedMerged = normalizeResponseData(mergedData, options.analysisType);

    return {
      data: normalizedMerged,
      batchCount: batches.length,
      totalReviews: reviews.length,
      complete: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (e) {
    // If merge fails, fall back to combining results manually
    console.error('Merge sampling failed, using fallback combination:', e);
    const fallbackMerged = manualMergeResults(batchResults, options.analysisType);

    return {
      data: fallbackMerged,
      batchCount: batches.length,
      totalReviews: reviews.length,
      complete: false,
      errors: [...errors, `Merge failed: ${(e as Error).message}`]
    };
  }
}

/**
 * Splits reviews into batches of specified size.
 */
function splitIntoBatches(reviews: SanitizedReview[], batchSize: number): SanitizedReview[][] {
  const batches: SanitizedReview[][] = [];
  for (let i = 0; i < reviews.length; i += batchSize) {
    batches.push(reviews.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Manually merges batch results when AI merge fails.
 * Uses simple aggregation for numeric fields.
 */
function manualMergeResults(results: ReviewInsightsData[], analysisType: AnalysisType): ReviewInsightsData {
  const merged: ReviewInsightsData = {};

  // Merge summaries
  const summaries = results.map(r => r.summary).filter(Boolean);
  if (summaries.length > 0) {
    const totalReviews = summaries.reduce(
      (sum, s) =>
        sum +
        Object.values(s?.ratingDistribution || {}).reduce((a, b) => a + b, 0),
      0
    );

    // Average the ratings
    const avgRating =
      summaries.reduce((sum, s) => sum + (s?.averageRating || 0), 0) / summaries.length;

    // Sum the rating distributions
    const ratingDist: Record<string, number> = {};
    for (const summary of summaries) {
      if (summary?.ratingDistribution) {
        for (const [rating, count] of Object.entries(summary.ratingDistribution)) {
          ratingDist[rating] = (ratingDist[rating] || 0) + count;
        }
      }
    }

    // Recalculate sentiment distribution
    const total = Object.values(ratingDist).reduce((a, b) => a + b, 0) || 1;
    const positive = ((ratingDist['5'] || 0) + (ratingDist['4'] || 0)) / total * 100;
    const neutral = (ratingDist['3'] || 0) / total * 100;
    const negative = ((ratingDist['2'] || 0) + (ratingDist['1'] || 0)) / total * 100;

    merged.summary = {
      executiveSummary: summaries[0]?.executiveSummary || 'Analysis complete.',
      overallSentiment: avgRating >= 4 ? 'positive' : avgRating >= 3 ? 'neutral' : 'negative',
      averageRating: Math.round(avgRating * 100) / 100,
      sentimentDistribution: {
        positive: Math.round(positive),
        neutral: Math.round(neutral),
        negative: Math.round(negative)
      },
      ratingDistribution: ratingDist
    };
  }

  // Merge themes
  const allThemes = results.map(r => r.themes).filter(Boolean);
  if (allThemes.length > 0) {
    const positiveThemes = new Map<string, { frequency: number; quote?: string }>();
    const negativeThemes = new Map<string, { frequency: number; severity?: string; quote?: string }>();

    for (const themes of allThemes) {
      for (const t of themes?.positive || []) {
        const existing = positiveThemes.get(t.theme) || { frequency: 0 };
        positiveThemes.set(t.theme, {
          frequency: existing.frequency + t.frequency,
          quote: existing.quote || t.exampleQuote
        });
      }
      for (const t of themes?.negative || []) {
        const existing = negativeThemes.get(t.theme) || { frequency: 0 };
        negativeThemes.set(t.theme, {
          frequency: existing.frequency + t.frequency,
          severity: existing.severity || t.severity,
          quote: existing.quote || t.exampleQuote
        });
      }
    }

    merged.themes = {
      positive: Array.from(positiveThemes.entries())
        .map(([theme, data]) => ({
          theme,
          frequency: data.frequency,
          exampleQuote: data.quote
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      negative: Array.from(negativeThemes.entries())
        .map(([theme, data]) => ({
          theme,
          frequency: data.frequency,
          severity: (data.severity as 'low' | 'medium' | 'high') || 'medium',
          exampleQuote: data.quote
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
    };
  }

  // Merge issues
  const allIssues = results.flatMap(r => r.issues || []);
  if (allIssues.length > 0) {
    // Group by category and sum frequencies
    const issueMap = new Map<string, typeof allIssues[0]>();
    for (const issue of allIssues) {
      const existing = issueMap.get(issue.category);
      if (existing) {
        existing.frequency += issue.frequency;
        if (issue.affectedLocations) {
          existing.affectedLocations = [
            ...new Set([...(existing.affectedLocations || []), ...issue.affectedLocations])
          ];
        }
      } else {
        issueMap.set(issue.category, { ...issue });
      }
    }
    merged.issues = Array.from(issueMap.values()).sort((a, b) => b.frequency - a.frequency);
  }

  // Merge location comparisons (concatenate)
  const allLocations = results.flatMap(r => r.locationComparison || []);
  if (allLocations.length > 0) {
    merged.locationComparison = allLocations;
  }

  // For trends, just take the first one (they should be the same conceptually)
  const trends = results.find(r => r.trends)?.trends;
  if (trends) {
    merged.trends = trends;
  }

  return merged;
}
