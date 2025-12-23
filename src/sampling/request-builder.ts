/**
 * Builds MCP Sampling requests for review analysis.
 */

import { AnalysisType } from '../schemas/output';
import { SanitizedReview } from '../helpers';
import { getAnalysisPrompt, ANALYSIS_SYSTEM_PROMPT } from './prompts';

/**
 * Options for building a sampling request.
 */
export interface SamplingRequestOptions {
  /** Type of analysis to perform */
  analysisType: AnalysisType;
  /** Maximum quotes to include in response */
  maxQuotes?: number;
  /** Specific themes to focus on (for themes analysis) */
  themes?: string[];
  /** Location name for context */
  locationName?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
}

/**
 * MCP Sampling request structure.
 * Matches the SDK's CreateMessageRequest params.
 */
export interface SamplingRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
  maxTokens: number;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
}

/**
 * Builds an MCP Sampling request for review analysis.
 *
 * @param reviews Sanitized reviews to analyze
 * @param options Analysis options
 * @returns Sampling request ready to send to client
 */
export function buildSamplingRequest(
  reviews: SanitizedReview[],
  options: SamplingRequestOptions
): SamplingRequest {
  const { analysisType, maxQuotes = 3, themes, locationName, maxTokens = 4000 } = options;

  // Get the analysis prompt
  const analysisPrompt = getAnalysisPrompt(analysisType, {
    maxQuotes,
    themes,
    locationName
  });

  // Format reviews for the prompt
  const reviewsText = formatReviewsForPrompt(reviews);

  // Build the user message
  const userMessage = `Analyze the following ${reviews.length} Google reviews${locationName ? ` for ${locationName}` : ''}.

${analysisPrompt}

## Reviews Data (${reviews.length} reviews)
${reviewsText}`;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: userMessage
        }
      }
    ],
    maxTokens,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    includeContext: 'none', // Don't include conversation history
    temperature: 0.3 // Lower temperature for consistent, factual analysis
  };
}

/**
 * Formats reviews into a compact, parseable format for the prompt.
 * Uses a structured format that's token-efficient but easy to analyze.
 */
function formatReviewsForPrompt(reviews: SanitizedReview[]): string {
  return JSON.stringify(
    reviews.map(r => ({
      id: r.id,
      storeId: r.storeId,
      rating: r.rating,
      date: r.date,
      text: r.text,
      hasResponse: r.hasOwnerResponse
    })),
    null,
    2
  );
}

/**
 * Builds a sampling request for merging partial batch results.
 * Used when reviews are processed in multiple batches.
 *
 * @param partialResults Array of partial analysis results
 * @param analysisType Type of analysis being merged
 * @returns Sampling request for merge operation
 */
export function buildMergeRequest(
  partialResults: object[],
  analysisType: AnalysisType
): SamplingRequest {
  const userMessage = `Merge these ${partialResults.length} partial analysis results into a single cohesive analysis.

## Instructions
1. Combine statistics (sum counts, average ratings across batches)
2. Deduplicate themes - merge similar themes and sum frequencies
3. Consolidate issues - group similar issues together
4. Recalculate percentages based on combined totals
5. Write a unified executive summary

## Partial Results
${JSON.stringify(partialResults, null, 2)}

## Response Format
Return ONLY a valid JSON object matching the original schema for ${analysisType} analysis.
Ensure all numbers are recalculated for the combined dataset.`;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: userMessage
        }
      }
    ],
    maxTokens: 4000,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    includeContext: 'none',
    temperature: 0.2 // Even lower for merge operations
  };
}
