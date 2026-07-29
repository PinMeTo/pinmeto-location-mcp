import { describe, it, expect } from 'vitest';
import {
  sanitizeReviewText,
  sanitizeReviews,
  estimateTokens,
  formatTokenEstimate,
  selectRepresentativeSample,
  selectRecentWeightedSample,
  applySamplingStrategy,
  buildInsightsCacheKey,
  computeSentimentFromRating,
  computeRatingDistribution,
  computeSentimentDistribution,
  computeAverageRating,
  performStatisticalAnalysis,
  performStatisticalLocationComparison,
  TOKENS_PER_REVIEW,
  REVIEW_INSIGHTS_THRESHOLDS,
  RawReview,
  SanitizedReview
} from '../src/helpers';
import {
  formatReviewInsightsAsMarkdown,
  formatLargeDatasetWarningAsMarkdown
} from '../src/formatters';
import { ReviewInsightsData, LargeDatasetWarning } from '../src/schemas/output';

describe('Review Insights - PII Sanitization', () => {
  describe('sanitizeReviewText', () => {
    it('should redact phone numbers', () => {
      const text = 'Call me at 555-123-4567 or +1 (555) 987-6543';
      const result = sanitizeReviewText(text);
      expect(result).toContain('[PHONE]');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('987-6543');
    });

    it('should redact email addresses', () => {
      const text = 'Contact support@example.com for help';
      const result = sanitizeReviewText(text);
      expect(result).toContain('[EMAIL]');
      expect(result).not.toContain('support@example.com');
    });

    it('should redact URLs', () => {
      const text = 'Visit https://example.com/page for more info';
      const result = sanitizeReviewText(text);
      expect(result).toContain('[URL]');
      expect(result).not.toContain('https://example.com');
    });

    it('should redact social media handles', () => {
      const text = 'Follow us @company_official on Twitter';
      const result = sanitizeReviewText(text);
      expect(result).toContain('[HANDLE]');
      expect(result).not.toContain('@company_official');
    });

    it('should handle empty or undefined text', () => {
      expect(sanitizeReviewText('')).toBe('');
      expect(sanitizeReviewText(undefined as unknown as string)).toBe('');
    });

    it('should handle text with multiple PII types', () => {
      const text = 'Email me at john@test.com or call 555-123-4567, my Twitter is @johndoe';
      const result = sanitizeReviewText(text);
      expect(result).toContain('[EMAIL]');
      expect(result).toContain('[HANDLE]');
      expect(result).not.toContain('john@test.com');
      expect(result).not.toContain('@johndoe');
      // Phone number detection requires 10+ digits
      expect(result).not.toContain('555-123-4567');
    });
  });

  describe('sanitizeReviews', () => {
    const rawReviews: RawReview[] = [
      {
        id: '1',
        storeId: 'store-1',
        rating: 5,
        comment: 'Great service! Call 555-1234 for details.',
        date: '2024-01-15',
        hasAnswer: true,
        reply: 'Thanks!'
      },
      {
        id: '2',
        storeId: 'store-2',
        rating: 3,
        comment: 'Email me@test.com',
        date: '2024-01-16',
        hasAnswer: false
      },
      {
        storeId: 'store-3',
        rating: 1,
        comment: undefined,
        date: '2024-01-17'
      }
    ];

    it('should sanitize all reviews', () => {
      const result = sanitizeReviews(rawReviews);
      expect(result).toHaveLength(3);
      expect(result[0].text).toContain('[PHONE]');
      expect(result[1].text).toContain('[EMAIL]');
    });

    it('should generate IDs for reviews without them', () => {
      const result = sanitizeReviews(rawReviews);
      // IDs are generated as 'review-{index}' for reviews without explicit IDs
      expect(result[2].id).toMatch(/^review-\d+$/);
    });

    it('should handle empty comment', () => {
      const result = sanitizeReviews(rawReviews);
      expect(result[2].text).toBe('');
    });

    it('should preserve hasOwnerResponse correctly', () => {
      const result = sanitizeReviews(rawReviews);
      expect(result[0].hasOwnerResponse).toBe(true);
      expect(result[1].hasOwnerResponse).toBe(false);
      expect(result[2].hasOwnerResponse).toBe(false);
    });
  });
});

describe('Review Insights - Token Estimation', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on review count', () => {
      expect(estimateTokens(100)).toBe(100 * TOKENS_PER_REVIEW);
      expect(estimateTokens(500)).toBe(500 * TOKENS_PER_REVIEW);
    });

    it('should handle zero reviews', () => {
      expect(estimateTokens(0)).toBe(0);
    });
  });

  describe('formatTokenEstimate', () => {
    it('should format thousands', () => {
      expect(formatTokenEstimate(5000)).toBe('~5K tokens');
      expect(formatTokenEstimate(150000)).toBe('~150K tokens');
    });

    it('should format millions', () => {
      expect(formatTokenEstimate(1500000)).toBe('~1.5M tokens');
      expect(formatTokenEstimate(2000000)).toBe('~2.0M tokens');
    });

    it('should handle small numbers', () => {
      expect(formatTokenEstimate(500)).toBe('~500 tokens');
    });
  });

  describe('thresholds', () => {
    it('should have expected threshold values', () => {
      expect(REVIEW_INSIGHTS_THRESHOLDS.immediateProcessing).toBe(200);
      expect(REVIEW_INSIGHTS_THRESHOLDS.warningRequired).toBe(1000);
      expect(REVIEW_INSIGHTS_THRESHOLDS.forceSamplingRequired).toBe(10000);
    });
  });
});

describe('Review Insights - Sampling Strategies', () => {
  const mockReviews: SanitizedReview[] = [
    // 5-star reviews
    { id: '1', storeId: 'store-1', rating: 5, text: 'Great!', date: '2024-01-01', hasOwnerResponse: false },
    { id: '2', storeId: 'store-1', rating: 5, text: 'Awesome!', date: '2024-01-05', hasOwnerResponse: true },
    { id: '3', storeId: 'store-2', rating: 5, text: 'Perfect!', date: '2024-01-10', hasOwnerResponse: false },
    // 4-star reviews
    { id: '4', storeId: 'store-1', rating: 4, text: 'Good', date: '2024-01-02', hasOwnerResponse: false },
    { id: '5', storeId: 'store-2', rating: 4, text: 'Nice', date: '2024-01-15', hasOwnerResponse: false },
    // 3-star reviews
    { id: '6', storeId: 'store-1', rating: 3, text: 'OK', date: '2024-01-03', hasOwnerResponse: false },
    { id: '7', storeId: 'store-3', rating: 3, text: 'Average', date: '2024-01-20', hasOwnerResponse: true },
    // 2-star reviews
    { id: '8', storeId: 'store-2', rating: 2, text: 'Not great', date: '2024-01-04', hasOwnerResponse: false },
    // 1-star reviews
    { id: '9', storeId: 'store-1', rating: 1, text: 'Bad', date: '2024-01-06', hasOwnerResponse: false },
    { id: '10', storeId: 'store-3', rating: 1, text: 'Terrible', date: '2024-01-25', hasOwnerResponse: false }
  ];

  describe('selectRepresentativeSample', () => {
    it('should return all reviews if under sample size', () => {
      const result = selectRepresentativeSample(mockReviews, 20);
      expect(result).toHaveLength(10);
    });

    it('should sample proportionally by rating', () => {
      const result = selectRepresentativeSample(mockReviews, 5);
      expect(result.length).toBeLessThanOrEqual(5);
      // Should have representation from different ratings
      const ratings = new Set(result.map(r => r.rating));
      expect(ratings.size).toBeGreaterThan(1);
    });
  });

  describe('selectRecentWeightedSample', () => {
    // Helper to create date strings relative to now
    const daysAgo = (days: number): string => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0];
    };

    it('should prioritize recent reviews', () => {
      // Create reviews with dates relative to today for consistent testing
      const recentWeightedReviews: SanitizedReview[] = [
        // Recent reviews (within 3 months = 90 days)
        { id: '1', storeId: 'store-1', rating: 5, text: 'Recent 1', date: daysAgo(7), hasOwnerResponse: false },
        { id: '2', storeId: 'store-1', rating: 4, text: 'Recent 2', date: daysAgo(30), hasOwnerResponse: false },
        { id: '3', storeId: 'store-1', rating: 3, text: 'Recent 3', date: daysAgo(60), hasOwnerResponse: false },
        // Medium reviews (3-6 months = 91-180 days)
        { id: '4', storeId: 'store-1', rating: 5, text: 'Medium 1', date: daysAgo(120), hasOwnerResponse: false },
        { id: '5', storeId: 'store-1', rating: 4, text: 'Medium 2', date: daysAgo(150), hasOwnerResponse: false },
        // Older reviews (>6 months = >180 days)
        { id: '6', storeId: 'store-1', rating: 5, text: 'Old 1', date: daysAgo(200), hasOwnerResponse: false },
        { id: '7', storeId: 'store-1', rating: 4, text: 'Old 2', date: daysAgo(250), hasOwnerResponse: false },
        { id: '8', storeId: 'store-1', rating: 3, text: 'Old 3', date: daysAgo(300), hasOwnerResponse: false },
        { id: '9', storeId: 'store-1', rating: 2, text: 'Old 4', date: daysAgo(350), hasOwnerResponse: false },
        { id: '10', storeId: 'store-1', rating: 1, text: 'Old 5', date: daysAgo(400), hasOwnerResponse: false }
      ];

      const result = selectRecentWeightedSample(recentWeightedReviews, 5);
      expect(result.length).toBeLessThanOrEqual(5);

      // With 60% weighting to recent (3 reviews), 25% to medium (2 reviews), 15% to older (5 reviews)
      // We should get mostly recent reviews when sampling 5 from 10
      const recentCutoff = daysAgo(90);
      const hasRecentReview = result.some(r => r.date >= recentCutoff);
      expect(hasRecentReview).toBe(true);
    });
  });

  describe('applySamplingStrategy', () => {
    it('should return all reviews for full strategy', () => {
      const result = applySamplingStrategy(mockReviews, 'full');
      expect(result).toHaveLength(10);
    });

    it('should apply representative sampling', () => {
      const result = applySamplingStrategy(mockReviews, 'representative', 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should apply recent_weighted sampling', () => {
      const result = applySamplingStrategy(mockReviews, 'recent_weighted', 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});

describe('Review Insights - Statistical Analysis', () => {
  const mockReviews: SanitizedReview[] = [
    { id: '1', storeId: 'store-1', rating: 5, text: 'Great!', date: '2024-01-01', hasOwnerResponse: false },
    { id: '2', storeId: 'store-1', rating: 4, text: 'Good', date: '2024-01-02', hasOwnerResponse: true },
    { id: '3', storeId: 'store-2', rating: 3, text: 'OK', date: '2024-01-03', hasOwnerResponse: false },
    { id: '4', storeId: 'store-2', rating: 2, text: 'Bad', date: '2024-01-04', hasOwnerResponse: false },
    { id: '5', storeId: 'store-3', rating: 1, text: 'Terrible', date: '2024-01-05', hasOwnerResponse: false }
  ];

  describe('computeAverageRating', () => {
    it('should compute correct average', () => {
      const avg = computeAverageRating(mockReviews);
      expect(avg).toBe(3); // (5+4+3+2+1)/5 = 3
    });

    it('should return 0 for empty array', () => {
      expect(computeAverageRating([])).toBe(0);
    });
  });

  describe('computeRatingDistribution', () => {
    it('should count ratings correctly', () => {
      const dist = computeRatingDistribution(mockReviews);
      expect(dist['5']).toBe(1);
      expect(dist['4']).toBe(1);
      expect(dist['3']).toBe(1);
      expect(dist['2']).toBe(1);
      expect(dist['1']).toBe(1);
    });
  });

  describe('computeSentimentDistribution', () => {
    it('should compute sentiment percentages', () => {
      const dist = computeSentimentDistribution(mockReviews);
      expect(dist.positive).toBe(40); // 2 out of 5 (4 and 5 star)
      expect(dist.neutral).toBe(20); // 1 out of 5 (3 star)
      expect(dist.negative).toBe(40); // 2 out of 5 (1 and 2 star)
    });
  });

  describe('computeSentimentFromRating', () => {
    it('should return positive for high ratings', () => {
      expect(computeSentimentFromRating(4.5)).toBe('positive');
      expect(computeSentimentFromRating(4.0)).toBe('positive');
    });

    it('should return neutral for medium ratings', () => {
      expect(computeSentimentFromRating(3.5)).toBe('neutral');
      expect(computeSentimentFromRating(3.0)).toBe('neutral');
    });

    it('should return negative for low ratings', () => {
      expect(computeSentimentFromRating(2.0)).toBe('negative');
      expect(computeSentimentFromRating(1.5)).toBe('negative');
    });
  });

  describe('performStatisticalAnalysis', () => {
    it('should return summary data', () => {
      const result = performStatisticalAnalysis(mockReviews);
      expect(result.summary).toBeDefined();
      expect(result.summary?.averageRating).toBe(3);
      expect(result.summary?.ratingDistribution).toBeDefined();
      expect(result.summary?.sentimentDistribution).toBeDefined();
    });

    it('should generate executive summary', () => {
      const result = performStatisticalAnalysis(mockReviews);
      expect(result.summary?.executiveSummary).toBeDefined();
      expect(typeof result.summary?.executiveSummary).toBe('string');
    });
  });

  describe('performStatisticalLocationComparison', () => {
    it('should return comparison data for each location', () => {
      const result = performStatisticalLocationComparison(mockReviews);
      expect(result.locationComparison).toBeDefined();
      expect(result.locationComparison).toHaveLength(3); // 3 unique stores
    });

    it('should compute per-location metrics', () => {
      const result = performStatisticalLocationComparison(mockReviews);
      const store1 = result.locationComparison?.find(l => l.storeId === 'store-1');
      expect(store1).toBeDefined();
      expect(store1?.reviewCount).toBe(2);
      expect(store1?.averageRating).toBe(4.5); // (5+4)/2
    });
  });
});

describe('Review Insights - Cache Key', () => {
  describe('buildInsightsCacheKey', () => {
    it('should build consistent cache keys', () => {
      const key = buildInsightsCacheKey({
        accountId: 'acc-123',
        storeIds: ['store-1', 'store-2'],
        from: '2024-01-01',
        to: '2024-01-31',
        analysisType: 'summary',
        samplingStrategy: 'full'
      });
      expect(key).toContain('acc-123');
      expect(key).toContain('2024-01-01');
      expect(key).toContain('summary');
    });

    it('should handle optional parameters', () => {
      const key1 = buildInsightsCacheKey({
        accountId: 'acc-123',
        from: '2024-01-01',
        to: '2024-01-31',
        analysisType: 'summary',
        samplingStrategy: 'full'
      });
      const key2 = buildInsightsCacheKey({
        accountId: 'acc-123',
        storeIds: undefined,
        from: '2024-01-01',
        to: '2024-01-31',
        analysisType: 'summary',
        samplingStrategy: 'full'
      });
      expect(key1).toBe(key2);
    });

    it('should differentiate by analysis type', () => {
      const key1 = buildInsightsCacheKey({
        accountId: 'acc-123',
        from: '2024-01-01',
        to: '2024-01-31',
        analysisType: 'summary',
        samplingStrategy: 'full'
      });
      const key2 = buildInsightsCacheKey({
        accountId: 'acc-123',
        from: '2024-01-01',
        to: '2024-01-31',
        analysisType: 'issues',
        samplingStrategy: 'full'
      });
      expect(key1).not.toBe(key2);
    });
  });
});

describe('Review Insights - Markdown Formatters', () => {
  describe('formatReviewInsightsAsMarkdown', () => {
    it('should format summary data', () => {
      const data: ReviewInsightsData = {
        summary: {
          executiveSummary: 'Overall positive reviews with some concerns about wait times.',
          overallSentiment: 'positive',
          averageRating: 4.2,
          sentimentDistribution: { positive: 70, neutral: 20, negative: 10 },
          ratingDistribution: { '5': 50, '4': 30, '3': 12, '2': 5, '1': 3 }
        }
      };

      const result = formatReviewInsightsAsMarkdown(data);
      expect(result).toContain('# Review Insights Analysis');
      expect(result).toContain('Overall positive reviews');
      expect(result).toContain('4.2');
      expect(result).toContain('Positive');
    });

    it('should format themes data', () => {
      const data: ReviewInsightsData = {
        themes: {
          positive: [
            { theme: 'Service Speed', frequency: 25, exampleQuote: 'Very fast service!' }
          ],
          negative: [
            { theme: 'Wait Times', frequency: 15, severity: 'medium', exampleQuote: 'Had to wait too long' }
          ]
        }
      };

      const result = formatReviewInsightsAsMarkdown(data);
      expect(result).toContain('Themes Identified');
      expect(result).toContain('Service Speed');
      expect(result).toContain('Wait Times');
    });

    it('should format issues data', () => {
      const data: ReviewInsightsData = {
        issues: [
          {
            category: 'Cleanliness',
            description: 'Multiple reports of dirty restrooms',
            severity: 'high',
            frequency: 20,
            suggestedAction: 'Increase cleaning frequency'
          }
        ]
      };

      const result = formatReviewInsightsAsMarkdown(data);
      expect(result).toContain('Issues Identified');
      expect(result).toContain('Cleanliness');
      expect(result).toContain('dirty restrooms');
    });
  });

  describe('formatLargeDatasetWarningAsMarkdown', () => {
    it('should format warning with options', () => {
      const warning: LargeDatasetWarning = {
        totalReviewCount: 5000,
        locationCount: 50,
        dateRange: { from: '2024-01-01', to: '2024-12-31' },
        estimatedTokens: 750000,
        estimatedTokensFormatted: '~750K tokens',
        message: 'Large dataset requires confirmation',
        options: [
          {
            option: 'representative_sample',
            description: 'Stratified sample',
            estimatedTokens: 75000,
            parameters: { samplingStrategy: 'representative' }
          }
        ]
      };

      const result = formatLargeDatasetWarningAsMarkdown(warning);
      expect(result).toContain('Large Dataset Confirmation');
      expect(result).toContain('5,000');
      expect(result).toContain('~750K tokens');
      expect(result).toContain('representative_sample');
    });
  });
});
