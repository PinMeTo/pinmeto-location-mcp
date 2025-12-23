/**
 * Parses and validates MCP Sampling responses.
 * Uses Zod schemas to ensure type-safe output.
 */

import { z } from 'zod';
import {
  ReviewInsightsDataSchema,
  ReviewInsightsData,
  AnalysisType,
  ReviewInsightsSummarySchema,
  ReviewInsightsThemeSchema,
  ReviewInsightsIssueSchema,
  ReviewInsightsLocationComparisonSchema,
  ReviewInsightsTrendsSchema
} from '../schemas/output';

/**
 * Error thrown when sampling response parsing fails.
 */
export class SamplingParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly zodError?: z.ZodError
  ) {
    super(message);
    this.name = 'SamplingParseError';
  }
}

/**
 * MCP Sampling response structure from the SDK.
 */
export interface SamplingResponse {
  role: 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
  };
  model?: string;
  stopReason?: string;
}

/**
 * Parses and validates a sampling response.
 *
 * @param response The raw sampling response from the SDK
 * @param analysisType The type of analysis expected
 * @returns Parsed and validated ReviewInsightsData
 * @throws SamplingParseError if parsing or validation fails
 */
export function parseSamplingResponse(
  response: SamplingResponse,
  analysisType: AnalysisType
): ReviewInsightsData {
  // Extract text content
  if (response.content.type !== 'text' || !response.content.text) {
    throw new SamplingParseError(
      'Sampling response did not contain text content',
      JSON.stringify(response)
    );
  }

  const rawText = response.content.text;

  // Try to extract JSON from the response
  const jsonText = extractJson(rawText);
  if (!jsonText) {
    throw new SamplingParseError(
      'Could not extract JSON from sampling response',
      rawText
    );
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new SamplingParseError(
      `Invalid JSON in sampling response: ${(e as Error).message}`,
      rawText
    );
  }

  // Validate against schema based on analysis type
  const schema = getSchemaForAnalysisType(analysisType);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new SamplingParseError(
      `Sampling response validation failed: ${result.error.message}`,
      rawText,
      result.error
    );
  }

  return result.data;
}

/**
 * Attempts to extract JSON from text that might contain markdown or other formatting.
 */
function extractJson(text: string): string | null {
  // First, try the raw text as-is
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  // Try to find JSON block in markdown code fence
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find JSON object anywhere in text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * Gets the appropriate Zod schema for an analysis type.
 * The schema is lenient to handle AI response variations.
 */
function getSchemaForAnalysisType(analysisType: AnalysisType): z.ZodType<ReviewInsightsData> {
  // Create a lenient schema that accepts partial data
  // The AI might not include all fields, and that's okay
  const lenientSchema = z.object({
    summary: ReviewInsightsSummarySchema.optional(),
    themes: z.object({
      positive: z.array(ReviewInsightsThemeSchema.partial()).default([]),
      negative: z.array(ReviewInsightsThemeSchema.partial()).default([])
    }).optional(),
    issues: z.array(ReviewInsightsIssueSchema.partial()).optional(),
    locationComparison: z.array(ReviewInsightsLocationComparisonSchema.partial()).optional(),
    trends: ReviewInsightsTrendsSchema.partial().optional()
  }).passthrough(); // Allow extra fields from AI

  return lenientSchema as z.ZodType<ReviewInsightsData>;
}

/**
 * Normalizes AI response data to ensure consistent structure.
 * Fills in missing fields with sensible defaults.
 *
 * @param data Parsed response data
 * @param analysisType Type of analysis performed
 * @returns Normalized data with all expected fields
 */
export function normalizeResponseData(
  data: ReviewInsightsData,
  analysisType: AnalysisType
): ReviewInsightsData {
  const normalized: ReviewInsightsData = { ...data };

  // Ensure summary has all required fields
  if (normalized.summary) {
    normalized.summary = {
      executiveSummary: normalized.summary.executiveSummary || 'Analysis complete.',
      overallSentiment: normalized.summary.overallSentiment || 'neutral',
      averageRating: normalized.summary.averageRating || 0,
      sentimentDistribution: normalized.summary.sentimentDistribution || {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      ratingDistribution: normalized.summary.ratingDistribution || {}
    };
  }

  // Ensure themes have required fields
  if (normalized.themes) {
    normalized.themes = {
      positive: (normalized.themes.positive || []).map(t => ({
        theme: t.theme || 'Unknown',
        frequency: t.frequency || 0,
        exampleQuote: t.exampleQuote
      })),
      negative: (normalized.themes.negative || []).map(t => ({
        theme: t.theme || 'Unknown',
        frequency: t.frequency || 0,
        severity: t.severity || 'medium',
        exampleQuote: t.exampleQuote
      }))
    };
  }

  // Ensure issues have required fields
  if (normalized.issues) {
    normalized.issues = normalized.issues.map(issue => ({
      category: issue.category || 'Uncategorized',
      description: issue.description || '',
      severity: issue.severity || 'medium',
      frequency: issue.frequency || 0,
      affectedLocations: issue.affectedLocations,
      suggestedAction: issue.suggestedAction
    }));
  }

  // Ensure location comparison has required fields
  if (normalized.locationComparison) {
    normalized.locationComparison = normalized.locationComparison.map(loc => ({
      storeId: loc.storeId || 'unknown',
      locationName: loc.locationName,
      averageRating: loc.averageRating || 0,
      reviewCount: loc.reviewCount || 0,
      sentiment: loc.sentiment || 'neutral',
      strengths: loc.strengths || [],
      weaknesses: loc.weaknesses || []
    }));
  }

  // Ensure trends has required fields
  if (normalized.trends) {
    normalized.trends = {
      direction: normalized.trends.direction || 'stable',
      previousPeriod: {
        averageRating: normalized.trends.previousPeriod?.averageRating || 0,
        sentiment: normalized.trends.previousPeriod?.sentiment || 'neutral',
        reviewCount: normalized.trends.previousPeriod?.reviewCount || 0
      },
      currentPeriod: {
        averageRating: normalized.trends.currentPeriod?.averageRating || 0,
        sentiment: normalized.trends.currentPeriod?.sentiment || 'neutral',
        reviewCount: normalized.trends.currentPeriod?.reviewCount || 0
      },
      emergingIssues: normalized.trends.emergingIssues || [],
      resolvedIssues: normalized.trends.resolvedIssues || []
    };
  }

  return normalized;
}
