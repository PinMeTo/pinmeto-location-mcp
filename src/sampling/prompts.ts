/**
 * Analysis prompt templates for MCP Sampling.
 * These prompts guide the AI to produce structured analysis of reviews.
 */

import { AnalysisType } from '../schemas/output';

/**
 * Period context for trends analysis.
 * Defines explicit date boundaries for current and prior periods.
 */
export interface PeriodContext {
  currentPeriod: { from: string; to: string };
  priorPeriod: { from: string; to: string };
}

/**
 * Shared summary JSON block for consistent output across all analysis types.
 * Uses concrete example values instead of TypeScript union syntax.
 * Percentages are integers 0-100, not strings with % symbol.
 */
const SUMMARY_JSON_BLOCK = `"summary": {
    "executiveSummary": "2-3 sentence summary of key findings",
    "overallSentiment": "mixed",
    "averageRating": 4.2,
    "sentimentDistribution": { "positive": 45, "neutral": 30, "negative": 25 },
    "ratingDistribution": { "5": 100, "4": 50, "3": 20, "2": 10, "1": 5 },
    "lowConfidence": false
  }`;

/**
 * Shared themes JSON block for summary and themes analysis.
 */
const THEMES_JSON_BLOCK = `"themes": {
    "positive": [
      { "theme": "theme name", "frequency": 15, "exampleQuote": "quote text" }
    ],
    "negative": [
      { "theme": "theme name", "frequency": 8, "severity": "medium", "exampleQuote": "quote text" }
    ]
  }`;

/**
 * Gets the analysis prompt for a specific analysis type.
 *
 * @param analysisType Type of analysis to perform
 * @param options Additional options for the prompt
 * @returns The prompt template string
 */
export function getAnalysisPrompt(
  analysisType: AnalysisType,
  options: {
    maxQuotes?: number;
    themes?: string[];
    locationName?: string;
    periodContext?: PeriodContext;
  } = {}
): string {
  const { maxQuotes = 3, themes, locationName, periodContext } = options;

  switch (analysisType) {
    case 'summary':
      return getSummaryPrompt(maxQuotes, locationName);
    case 'issues':
      return getIssuesPrompt(maxQuotes, locationName);
    case 'comparison':
      return getComparisonPrompt();
    case 'trends':
      return getTrendsPrompt(periodContext);
    case 'themes':
      return getThemesPrompt(maxQuotes, themes, locationName);
    default: {
      const _exhaustive: never = analysisType;
      return getSummaryPrompt(maxQuotes, locationName);
    }
  }
}

/**
 * Summary analysis prompt - general sentiment and themes.
 */
function getSummaryPrompt(maxQuotes: number, locationName?: string): string {
  const locationContext = locationName ? ` for **${locationName}**` : '';

  return `Analyze these reviews${locationContext} and provide a comprehensive summary.

## Instructions
1. Calculate overall sentiment distribution (positive/neutral/negative as integer percentages 0-100)
2. Identify the average rating and rating distribution (count per star rating)
3. List top 5 positive themes customers mention frequently
4. List top 5 areas for improvement (negative themes)
5. Include ${maxQuotes} representative quotes per theme (diverse across rating levels)
6. Write an executive summary (2-3 sentences)
7. Set lowConfidence: true if fewer than 20 reviews analyzed

## Field Specifications
- **overallSentiment**: One of "positive", "neutral", "negative", or "mixed"
- **sentimentDistribution**: Integer percentages (0-100) that sum to 100
- **severity**: One of "low", "medium", or "high"
- **lowConfidence**: Boolean, true when sample size is small (<20 reviews)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  ${SUMMARY_JSON_BLOCK},
  ${THEMES_JSON_BLOCK}
}`;
}

/**
 * Issues analysis prompt - focus on problems and complaints.
 */
function getIssuesPrompt(maxQuotes: number, locationName?: string): string {
  const locationContext = locationName ? ` for **${locationName}**` : '';

  return `Focus on negative reviews (1-3 stars)${locationContext} and identify issues requiring attention.

## Instructions
1. Identify critical issues requiring immediate attention (list critical severity first)
2. Group recurring complaints by category
3. Assign severity based on frequency and impact
4. Note affected locations (by storeId) if patterns emerge
5. Suggest actionable responses for each major issue
6. Include ${maxQuotes} illustrative quotes per issue

## Field Specifications
- **severity**: One of "low", "medium", "high", or "critical"
- **overallSentiment**: One of "positive", "neutral", "negative", or "mixed"
- **sentimentDistribution**: Integer percentages (0-100) that sum to 100
- **lowConfidence**: Boolean, true when sample size is small (<20 reviews)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "issues": [
    {
      "category": "Issue Category (e.g., Wait Times, Cleanliness, Staff)",
      "description": "Detailed description of the issue",
      "severity": "high",
      "frequency": 12,
      "affectedLocations": ["storeId1", "storeId2"],
      "exampleQuotes": ["quote from review 1", "quote from review 2"],
      "suggestedAction": "Recommended action to address this issue"
    }
  ],
  ${SUMMARY_JSON_BLOCK}
}`;
}

/**
 * Comparison analysis prompt - compare across locations.
 */
function getComparisonPrompt(): string {
  return `Compare customer feedback across the provided locations.

## Instructions
1. Note the review count per location - consider sample size when comparing
2. Flag locations with very few reviews (<10) as having lower confidence
3. Rank locations by overall sentiment and rating (best first)
4. Identify common strengths across all locations
5. Identify location-specific issues
6. Note best practices from top performers
7. Provide specific recommendations for underperformers

## Field Specifications
- **sentiment**: One of "positive", "neutral", or "negative"
- **overallSentiment**: One of "positive", "neutral", "negative", or "mixed"
- **sentimentDistribution**: Integer percentages (0-100) that sum to 100
- **lowConfidence**: Boolean, true when total sample size is small (<20 reviews across all locations)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "locationComparison": [
    {
      "storeId": "store identifier",
      "locationName": "store name if available",
      "averageRating": 4.5,
      "reviewCount": 150,
      "sentiment": "positive",
      "lowConfidence": false,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "recommendations": ["specific action to improve"]
    }
  ],
  "bestPerformer": {
    "storeId": "store identifier of best location",
    "reason": "Why this location performs best",
    "bestPractices": ["practice other locations should adopt"]
  },
  "commonStrengths": ["strength shared across locations"],
  "commonWeaknesses": ["weakness shared across locations"],
  ${SUMMARY_JSON_BLOCK}
}`;
}

/**
 * Trends analysis prompt - compare time periods.
 */
function getTrendsPrompt(periodContext?: PeriodContext): string {
  const periodInfo = periodContext
    ? `

## Period Definitions
- **Current Period**: ${periodContext.currentPeriod.from} to ${periodContext.currentPeriod.to}
- **Prior Period**: ${periodContext.priorPeriod.from} to ${periodContext.priorPeriod.to}

Classify each review by its date into the appropriate period before analysis.`
    : `

## Period Classification
Sort reviews by date. The older 50% of reviews are "prior period", the newer 50% are "current period".
If fewer than 10 reviews total, set lowConfidence: true.`;

  return `Compare the reviews between the current and prior periods to identify trends.
${periodInfo}

## Instructions
1. Determine direction based on rating change:
   - **improving**: Current period rating is >0.2 higher than prior
   - **stable**: Rating change is between -0.2 and +0.2
   - **declining**: Current period rating is >0.2 lower than prior
2. Calculate period summaries (average rating, sentiment, review count)
3. Identify new issues that emerged in the current period
4. Identify issues that were resolved (present in prior, absent in current)
5. Track themes gaining or losing prominence between periods

## Field Specifications
- **direction**: One of "improving", "stable", or "declining" (based on ±0.2 rating threshold)
- **sentiment**: One of "positive", "neutral", or "negative"
- **overallSentiment**: One of "positive", "neutral", "negative", or "mixed"
- **sentimentDistribution**: Integer percentages (0-100) that sum to 100
- **lowConfidence**: Boolean, true when either period has <10 reviews
- **trend**: One of "increasing", "stable", or "decreasing"

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "trends": {
    "direction": "improving",
    "ratingChange": 0.4,
    "previousPeriod": {
      "averageRating": 3.8,
      "sentiment": "neutral",
      "reviewCount": 45
    },
    "currentPeriod": {
      "averageRating": 4.2,
      "sentiment": "positive",
      "reviewCount": 62
    },
    "emergingIssues": ["new issue 1", "new issue 2"],
    "resolvedIssues": ["resolved issue 1", "resolved issue 2"],
    "prominenceChanges": [
      { "theme": "theme name", "trend": "increasing", "note": "brief explanation" }
    ]
  },
  ${SUMMARY_JSON_BLOCK}
}`;
}

/**
 * Themes analysis prompt - deep dive on specific themes.
 */
function getThemesPrompt(maxQuotes: number, themes?: string[], locationName?: string): string {
  const themeInstruction = themes?.length
    ? `Focus specifically on these themes: ${themes.join(', ')}`
    : 'Identify and analyze all significant themes in the reviews';

  const locationContext = locationName ? ` for **${locationName}**` : '';

  return `Perform a deep-dive analysis on themes in the reviews${locationContext}.

## Instructions
${themeInstruction}

1. For each theme, analyze:
   - How frequently it's mentioned
   - Sentiment breakdown (positive vs negative mentions)
   - Severity of issues related to this theme
   - ${maxQuotes} representative quotes (diverse across rating levels)
2. Rank themes by importance (frequency × impact)

## Field Specifications
- **severity**: One of "low", "medium", or "high"
- **overallSentiment**: One of "positive", "neutral", "negative", or "mixed"
- **sentimentDistribution**: Integer percentages (0-100) that sum to 100
- **lowConfidence**: Boolean, true when sample size is small (<20 reviews)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  ${THEMES_JSON_BLOCK},
  ${SUMMARY_JSON_BLOCK}
}`;
}

/**
 * System prompt for review analysis.
 * Sets the AI's role and output expectations.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a customer feedback analyst specializing in location-based business reviews.

Your role is to:
- Analyze reviews objectively and identify patterns
- Provide actionable insights for business improvement
- Quantify findings with specific numbers and percentages
- Include representative quotes to support findings
- Prefer consistent classifications over creative interpretations

CRITICAL OUTPUT RULES:
1. Always respond with VALID JSON only
2. No markdown formatting, no code blocks, no explanation text
3. Match the exact schema requested
4. Use actual numbers, not placeholder text
5. Ensure all JSON is properly escaped and valid
6. Percentages must be integers 0-100 (not strings with % symbol)

EDGE CASE HANDLING:
7. If fewer than 5 reviews provided, include "lowConfidence": true in the summary
8. If reviews are in multiple languages, translate quotes to English
9. If data is insufficient to draw meaningful conclusions, return: {"error": "Insufficient data for analysis", "reviewCount": N, "minimumRequired": 5}`;
