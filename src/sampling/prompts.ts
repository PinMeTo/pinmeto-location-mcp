/**
 * Analysis prompt templates for MCP Sampling.
 * These prompts guide the AI to produce structured analysis of reviews.
 */

import { AnalysisType } from '../schemas/output';

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
  } = {}
): string {
  const { maxQuotes = 3, themes, locationName } = options;

  switch (analysisType) {
    case 'summary':
      return getSummaryPrompt(maxQuotes);
    case 'issues':
      return getIssuesPrompt(maxQuotes);
    case 'comparison':
      return getComparisonPrompt();
    case 'trends':
      return getTrendsPrompt();
    case 'themes':
      return getThemesPrompt(maxQuotes, themes);
    default: {
      const _exhaustive: never = analysisType;
      return getSummaryPrompt(maxQuotes);
    }
  }
}

/**
 * Summary analysis prompt - general sentiment and themes.
 */
function getSummaryPrompt(maxQuotes: number): string {
  return `Analyze these reviews and provide a comprehensive summary.

## Instructions
1. Calculate overall sentiment distribution (positive/neutral/negative percentages)
2. Identify the average rating and rating distribution (count per star rating)
3. List top 5 positive themes customers mention frequently
4. List top 5 areas for improvement (negative themes)
5. Include ${maxQuotes} representative quotes (mix of positive and negative)
6. Write an executive summary (2-3 sentences)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "summary": {
    "executiveSummary": "2-3 sentence summary of key findings",
    "overallSentiment": "positive" | "neutral" | "negative" | "mixed",
    "averageRating": number,
    "sentimentDistribution": { "positive": %, "neutral": %, "negative": % },
    "ratingDistribution": { "5": count, "4": count, "3": count, "2": count, "1": count }
  },
  "themes": {
    "positive": [
      { "theme": "theme name", "frequency": count, "exampleQuote": "quote" }
    ],
    "negative": [
      { "theme": "theme name", "frequency": count, "severity": "low"|"medium"|"high", "exampleQuote": "quote" }
    ]
  }
}`;
}

/**
 * Issues analysis prompt - focus on problems and complaints.
 */
function getIssuesPrompt(maxQuotes: number): string {
  return `Focus on negative reviews (1-3 stars) and identify issues requiring attention.

## Instructions
1. Identify critical issues requiring immediate attention
2. Group recurring complaints by category
3. Assign severity based on frequency and impact
4. Note affected locations (by storeId) if patterns emerge
5. Suggest actionable responses for each major issue
6. Include ${maxQuotes} illustrative quotes per issue

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "issues": [
    {
      "category": "Issue Category (e.g., Wait Times, Cleanliness, Staff)",
      "description": "Detailed description of the issue",
      "severity": "low" | "medium" | "high" | "critical",
      "frequency": number,
      "affectedLocations": ["storeId1", "storeId2"],
      "suggestedAction": "Recommended action to address this issue"
    }
  ],
  "summary": {
    "executiveSummary": "Summary of key issues found",
    "overallSentiment": "negative",
    "averageRating": number,
    "sentimentDistribution": { "positive": %, "neutral": %, "negative": % },
    "ratingDistribution": { "5": count, "4": count, "3": count, "2": count, "1": count }
  }
}`;
}

/**
 * Comparison analysis prompt - compare across locations.
 */
function getComparisonPrompt(): string {
  return `Compare customer feedback across the provided locations.

## Instructions
1. Rank locations by overall sentiment and rating
2. Identify common strengths across all locations
3. Identify location-specific issues
4. Note best practices from top performers
5. Provide recommendations for underperformers

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "locationComparison": [
    {
      "storeId": "store identifier",
      "locationName": "store name if available",
      "averageRating": number,
      "reviewCount": number,
      "sentiment": "positive" | "neutral" | "negative",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"]
    }
  ],
  "summary": {
    "executiveSummary": "Summary comparing locations",
    "overallSentiment": "positive" | "neutral" | "negative" | "mixed",
    "averageRating": number,
    "sentimentDistribution": { "positive": %, "neutral": %, "negative": % },
    "ratingDistribution": { "5": count, "4": count, "3": count, "2": count, "1": count }
  }
}`;
}

/**
 * Trends analysis prompt - compare time periods.
 */
function getTrendsPrompt(): string {
  return `Compare the reviews between the current and prior periods to identify trends.

## Instructions
1. Determine if sentiment is improving, stable, or declining
2. Calculate period summaries (average rating, sentiment, review count)
3. Identify new issues that emerged in the current period
4. Identify issues that were resolved (present in prior, absent in current)
5. Note themes gaining or losing prominence

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "trends": {
    "direction": "improving" | "stable" | "declining",
    "previousPeriod": {
      "averageRating": number,
      "sentiment": "positive" | "neutral" | "negative",
      "reviewCount": number
    },
    "currentPeriod": {
      "averageRating": number,
      "sentiment": "positive" | "neutral" | "negative",
      "reviewCount": number
    },
    "emergingIssues": ["new issue 1", "new issue 2"],
    "resolvedIssues": ["resolved issue 1", "resolved issue 2"]
  },
  "summary": {
    "executiveSummary": "Summary of trend analysis",
    "overallSentiment": "positive" | "neutral" | "negative" | "mixed",
    "averageRating": number,
    "sentimentDistribution": { "positive": %, "neutral": %, "negative": % },
    "ratingDistribution": { "5": count, "4": count, "3": count, "2": count, "1": count }
  }
}`;
}

/**
 * Themes analysis prompt - deep dive on specific themes.
 */
function getThemesPrompt(maxQuotes: number, themes?: string[]): string {
  const themeInstruction = themes?.length
    ? `Focus specifically on these themes: ${themes.join(', ')}`
    : 'Identify and analyze all significant themes in the reviews';

  return `Perform a deep-dive analysis on themes in the reviews.

## Instructions
${themeInstruction}

1. For each theme, analyze:
   - How frequently it's mentioned
   - Sentiment breakdown (positive vs negative mentions)
   - Severity of issues related to this theme
   - ${maxQuotes} representative quotes
2. Rank themes by importance (frequency × impact)

## Response Format
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "themes": {
    "positive": [
      { "theme": "theme name", "frequency": count, "exampleQuote": "quote" }
    ],
    "negative": [
      { "theme": "theme name", "frequency": count, "severity": "low"|"medium"|"high", "exampleQuote": "quote" }
    ]
  },
  "summary": {
    "executiveSummary": "Summary of theme analysis",
    "overallSentiment": "positive" | "neutral" | "negative" | "mixed",
    "averageRating": number,
    "sentimentDistribution": { "positive": %, "neutral": %, "negative": % },
    "ratingDistribution": { "5": count, "4": count, "3": count, "2": count, "1": count }
  }
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

CRITICAL OUTPUT RULES:
1. Always respond with VALID JSON only
2. No markdown formatting, no code blocks, no explanation text
3. Match the exact schema requested
4. Use actual numbers, not placeholder text
5. Ensure all JSON is properly escaped and valid`;
