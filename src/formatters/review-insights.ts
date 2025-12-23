/**
 * Markdown formatters for review insights tool.
 * Converts AI-analyzed review insights to human-readable Markdown.
 */

import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';
import {
  ReviewInsightsData,
  ReviewInsightsMetadata,
  LargeDatasetWarning,
  ReviewInsightsTheme,
  ReviewInsightsIssue,
  ReviewInsightsLocationComparison,
  ReviewInsightsTrends
} from '../schemas/output';

/**
 * Formats review insights data as Markdown.
 * Includes executive summary, themes, issues, location comparison, and trends.
 */
export function formatReviewInsightsAsMarkdown(
  data: ReviewInsightsData,
  metadata?: ReviewInsightsMetadata
): string {
  const sections: string[] = [];

  // Header
  sections.push('# Review Insights Analysis\n');

  // Metadata section
  if (metadata) {
    sections.push(formatMetadataSection(metadata));
  }

  // Executive summary section
  if (data.summary) {
    sections.push(formatSummarySection(data.summary));
  }

  // Themes section
  if (data.themes) {
    sections.push(formatThemesSection(data.themes));
  }

  // Issues section
  if (data.issues && data.issues.length > 0) {
    sections.push(formatIssuesSection(data.issues));
  }

  // Location comparison section
  if (data.locationComparison && data.locationComparison.length > 0) {
    sections.push(formatLocationComparisonSection(data.locationComparison));
  }

  // Trends section
  if (data.trends) {
    sections.push(formatTrendsSection(data.trends));
  }

  return sections.join('\n');
}

/**
 * Formats the metadata section.
 */
function formatMetadataSection(metadata: ReviewInsightsMetadata): string {
  let md = '## Analysis Details\n\n';

  md += `**Analysis Type:** ${formatAnalysisType(metadata.analysisType)}\n`;
  md += `**Method:** ${metadata.analysisMethod === 'ai_sampling' ? 'AI-Powered Analysis' : 'Statistical Analysis'}\n`;
  md += `**Date Range:** ${metadata.dateRange.from} to ${metadata.dateRange.to}\n`;
  md += `**Locations:** ${metadata.locationCount.toLocaleString('en-US')}\n`;
  md += `**Reviews Analyzed:** ${metadata.analyzedReviewCount.toLocaleString('en-US')} of ${metadata.totalReviewCount.toLocaleString('en-US')}\n`;

  if (metadata.samplingNote) {
    md += `**Note:** ${metadata.samplingNote}\n`;
  }

  if (metadata.cache?.hit) {
    md += `**Cached:** Yes (expires ${metadata.cache.expiresAt || 'soon'})\n`;
  }

  md += '\n';
  return md;
}

/**
 * Formats the executive summary section.
 */
function formatSummarySection(
  summary: NonNullable<ReviewInsightsData['summary']>
): string {
  let md = '## Executive Summary\n\n';

  md += `> ${summary.executiveSummary}\n\n`;

  // Key metrics
  md += '### Key Metrics\n\n';
  md += `**Overall Sentiment:** ${formatSentiment(summary.overallSentiment)}\n`;
  md += `**Average Rating:** ${summary.averageRating.toFixed(1)} / 5.0\n\n`;

  // Sentiment distribution
  md += '### Sentiment Distribution\n\n';
  md += '| Sentiment | % | Bar |\n';
  md += '|-----------|--:|-----|\n';

  const sentiments = [
    { name: 'Positive', value: summary.sentimentDistribution.positive, emoji: '😊' },
    { name: 'Neutral', value: summary.sentimentDistribution.neutral, emoji: '😐' },
    { name: 'Negative', value: summary.sentimentDistribution.negative, emoji: '😞' }
  ];

  for (const s of sentiments) {
    const barLength = Math.round(s.value / 5); // Max 20 chars for 100%
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    md += `| ${s.emoji} ${s.name} | ${s.value}% | ${bar} |\n`;
  }

  md += '\n';

  // Rating distribution
  if (summary.ratingDistribution && Object.keys(summary.ratingDistribution).length > 0) {
    md += '### Rating Distribution\n\n';
    md += '| Stars | Count | Bar |\n';
    md += '|-------|------:|-----|\n';

    const total = Object.values(summary.ratingDistribution).reduce((a, b) => a + b, 0) || 1;

    // Display 5 to 1 stars
    for (let stars = 5; stars >= 1; stars--) {
      const key = String(stars);
      const count = summary.ratingDistribution[key] || 0;
      const percentage = (count / total) * 100;
      const barLength = Math.round(percentage / 5);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      md += `| ${'⭐'.repeat(stars)} | ${count.toLocaleString('en-US')} | ${bar} |\n`;
    }

    md += '\n';
  }

  return md;
}

/**
 * Formats the themes section with positive and negative themes.
 */
function formatThemesSection(
  themes: NonNullable<ReviewInsightsData['themes']>
): string {
  let md = '## Themes Identified\n\n';

  // Positive themes
  if (themes.positive && themes.positive.length > 0) {
    md += '### ✅ Positive Themes\n\n';
    md += formatThemesTable(themes.positive, false);
  } else {
    md += '### ✅ Positive Themes\n\n*No positive themes identified.*\n\n';
  }

  // Negative themes
  if (themes.negative && themes.negative.length > 0) {
    md += '### ⚠️ Areas for Improvement\n\n';
    md += formatThemesTable(themes.negative, true);
  } else {
    md += '### ⚠️ Areas for Improvement\n\n*No negative themes identified.*\n\n';
  }

  return md;
}

/**
 * Formats a themes table.
 */
function formatThemesTable(themes: ReviewInsightsTheme[], showSeverity: boolean): string {
  let md = showSeverity
    ? '| Theme | Mentions | Severity | Example |\n|-------|----------|----------|--------|\n'
    : '| Theme | Mentions | Example |\n|-------|----------|--------|\n';

  const displayCount = Math.min(themes.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const theme = themes[i];
    const quote = theme.exampleQuote ? `"${truncateText(theme.exampleQuote, 50)}"` : '-';

    if (showSeverity) {
      md += `| ${theme.theme} | ${theme.frequency} | ${formatSeverity(theme.severity)} | ${quote} |\n`;
    } else {
      md += `| ${theme.theme} | ${theme.frequency} | ${quote} |\n`;
    }
  }

  if (themes.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = themes.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more themes (use structuredContent for full data)*\n`;
  }

  md += '\n';
  return md;
}

/**
 * Formats the issues section.
 */
function formatIssuesSection(issues: ReviewInsightsIssue[]): string {
  let md = '## Issues Identified\n\n';

  md += '| Category | Description | Severity | Frequency | Action |\n';
  md += '|----------|-------------|----------|-----------|--------|\n';

  const displayCount = Math.min(issues.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const issue = issues[i];
    const action = issue.suggestedAction ? truncateText(issue.suggestedAction, 40) : '-';
    md += `| ${issue.category} | ${truncateText(issue.description, 50)} | ${formatSeverity(issue.severity)} | ${issue.frequency} | ${action} |\n`;
  }

  if (issues.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = issues.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more issues (use structuredContent for full data)*\n`;
  }

  md += '\n';
  return md;
}

/**
 * Formats the location comparison section.
 */
function formatLocationComparisonSection(locations: ReviewInsightsLocationComparison[]): string {
  let md = '## Location Comparison\n\n';

  md += '| Location | Rating | Reviews | Sentiment | Strengths | Weaknesses |\n';
  md += '|----------|-------:|--------:|-----------|-----------|------------|\n';

  const displayCount = Math.min(locations.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const loc = locations[i];
    const name = loc.locationName || loc.storeId;
    const strengths = loc.strengths.slice(0, 2).join(', ') || '-';
    const weaknesses = loc.weaknesses.slice(0, 2).join(', ') || '-';

    md += `| ${name} | ${loc.averageRating.toFixed(1)} | ${loc.reviewCount} | ${formatSentiment(loc.sentiment)} | ${strengths} | ${weaknesses} |\n`;
  }

  if (locations.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = locations.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more locations (use structuredContent for full data)*\n`;
  }

  md += '\n';
  return md;
}

/**
 * Formats the trends section.
 */
function formatTrendsSection(trends: ReviewInsightsTrends): string {
  let md = '## Trends Analysis\n\n';

  // Overall direction
  const directionEmoji = trends.direction === 'improving' ? '📈' : trends.direction === 'declining' ? '📉' : '➡️';
  md += `**Overall Trend:** ${directionEmoji} ${formatDirection(trends.direction)}\n\n`;

  // Period comparison table
  md += '### Period Comparison\n\n';
  md += '| Metric | Previous | Current | Change |\n';
  md += '|--------|----------|---------|--------|\n';

  const ratingDelta = trends.currentPeriod.averageRating - trends.previousPeriod.averageRating;
  const ratingSign = ratingDelta >= 0 ? '+' : '';
  md += `| Average Rating | ${trends.previousPeriod.averageRating.toFixed(1)} | ${trends.currentPeriod.averageRating.toFixed(1)} | ${ratingSign}${ratingDelta.toFixed(1)} |\n`;

  const reviewDelta = trends.currentPeriod.reviewCount - trends.previousPeriod.reviewCount;
  const reviewSign = reviewDelta >= 0 ? '+' : '';
  md += `| Review Count | ${trends.previousPeriod.reviewCount} | ${trends.currentPeriod.reviewCount} | ${reviewSign}${reviewDelta} |\n`;

  md += `| Sentiment | ${formatSentiment(trends.previousPeriod.sentiment)} | ${formatSentiment(trends.currentPeriod.sentiment)} | - |\n\n`;

  // Emerging and resolved issues
  if (trends.emergingIssues.length > 0) {
    md += '### 🆕 Emerging Issues\n\n';
    for (const issue of trends.emergingIssues) {
      md += `- ${issue}\n`;
    }
    md += '\n';
  }

  if (trends.resolvedIssues.length > 0) {
    md += '### ✅ Resolved Issues\n\n';
    for (const issue of trends.resolvedIssues) {
      md += `- ${issue}\n`;
    }
    md += '\n';
  }

  return md;
}

/**
 * Formats a large dataset warning as Markdown.
 */
export function formatLargeDatasetWarningAsMarkdown(warning: LargeDatasetWarning): string {
  let md = '# ⚠️ Large Dataset Confirmation Required\n\n';

  md += `> ${warning.message}\n\n`;

  md += '## Dataset Summary\n\n';
  md += `**Total Reviews:** ${warning.totalReviewCount.toLocaleString('en-US')}\n`;
  md += `**Locations:** ${warning.locationCount.toLocaleString('en-US')}\n`;
  md += `**Date Range:** ${warning.dateRange.from} to ${warning.dateRange.to}\n`;
  md += `**Estimated Tokens:** ${warning.estimatedTokensFormatted}\n\n`;

  md += '## Available Options\n\n';

  for (const option of warning.options) {
    md += `### ${option.option}\n\n`;
    md += `${option.description}\n\n`;
    md += `**Estimated tokens:** ~${formatTokenCount(option.estimatedTokens)}\n\n`;
    md += '**To proceed:** Call the tool again with:\n';
    md += '```json\n';
    md += JSON.stringify(option.parameters, null, 2);
    md += '\n```\n\n';
  }

  return md;
}

// Helper functions

function formatAnalysisType(type: string): string {
  const labels: Record<string, string> = {
    summary: 'Summary Analysis',
    issues: 'Issues Analysis',
    comparison: 'Location Comparison',
    trends: 'Trends Analysis',
    themes: 'Theme Analysis'
  };
  return labels[type] || type;
}

function formatSentiment(sentiment: string): string {
  const emojis: Record<string, string> = {
    positive: '😊 Positive',
    neutral: '😐 Neutral',
    negative: '😞 Negative',
    mixed: '🤔 Mixed'
  };
  return emojis[sentiment] || sentiment;
}

function formatSeverity(severity?: string): string {
  if (!severity) return '-';
  const badges: Record<string, string> = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    critical: '🔴 Critical'
  };
  return badges[severity] || severity;
}

function formatDirection(direction: string): string {
  const labels: Record<string, string> = {
    improving: 'Improving',
    stable: 'Stable',
    declining: 'Declining'
  };
  return labels[direction] || direction;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return String(tokens);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
