import { describe, it, expect, vi } from 'vitest';
import {
  processInBatches,
  DEFAULT_BATCH_SIZE,
  MAX_BATCHES,
  BATCH_FAILURE_THRESHOLD,
  BatchProcessingResult,
  SamplingFunction
} from '../src/sampling/batching';
import { SanitizedReview } from '../src/helpers';
import { ReviewInsightsData } from '../src/schemas/output';
import { SamplingParseError } from '../src/sampling/response-parser';

// Helper to create mock reviews
function createMockReviews(count: number, storeId = 'store-1'): SanitizedReview[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `review-${i}`,
    storeId,
    rating: (i % 5) + 1,
    text: `Review text ${i}`,
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
    hasOwnerResponse: i % 2 === 0
  }));
}

// Mock response data
const mockSummaryResponse: ReviewInsightsData = {
  summary: {
    executiveSummary: 'Test summary',
    overallSentiment: 'positive',
    averageRating: 4.2,
    sentimentDistribution: { positive: 70, neutral: 20, negative: 10 },
    ratingDistribution: { '5': 50, '4': 30, '3': 12, '2': 5, '1': 3 }
  }
};

describe('Batch Processing - Constants', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_BATCH_SIZE).toBe(300);
    expect(MAX_BATCHES).toBe(20);
    expect(BATCH_FAILURE_THRESHOLD).toBe(0.5);
  });
});

describe('Batch Processing - processInBatches', () => {
  const defaultOptions = { analysisType: 'summary' as const };

  describe('single batch scenarios', () => {
    it('should process a single batch successfully', async () => {
      const reviews = createMockReviews(100);
      const mockSamplingFn: SamplingFunction = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'text',
          text: JSON.stringify(mockSummaryResponse)
        }
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn);

      expect(result.batchCount).toBe(1);
      expect(result.totalReviews).toBe(100);
      expect(result.complete).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data.summary).toBeDefined();
      expect(mockSamplingFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple batch scenarios', () => {
    it('should split large datasets into batches', async () => {
      const reviews = createMockReviews(700);
      const batchSize = 300;
      const expectedBatches = 3; // 300 + 300 + 100

      const mockSamplingFn: SamplingFunction = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'text',
          text: JSON.stringify(mockSummaryResponse)
        }
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      // 3 batch calls + 1 merge call
      expect(mockSamplingFn).toHaveBeenCalledTimes(4);
      expect(result.batchCount).toBe(expectedBatches);
      expect(result.totalReviews).toBe(700);
    });

    it('should merge results from multiple batches', async () => {
      const reviews = createMockReviews(200);
      const batchSize = 100;

      const mockSamplingFn: SamplingFunction = vi.fn().mockResolvedValue({
        role: 'assistant',
        content: {
          type: 'text',
          text: JSON.stringify(mockSummaryResponse)
        }
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      expect(result.batchCount).toBe(2);
      expect(result.complete).toBe(true);
      expect(result.data.summary).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle partial batch failures', async () => {
      const reviews = createMockReviews(200);
      const batchSize = 100;
      let callCount = 0;

      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Batch 1 failed'));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      expect(result.complete).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('Batch 1');
      expect(result.data.summary).toBeDefined();
    });

    it('should throw when all batches fail', async () => {
      const reviews = createMockReviews(100);

      const mockSamplingFn: SamplingFunction = vi.fn().mockRejectedValue(
        new Error('Sampling failed')
      );

      await expect(
        processInBatches(reviews, defaultOptions, mockSamplingFn)
      ).rejects.toThrow('All 1 batches failed');
    });

    it('should handle SamplingParseError specially', async () => {
      const reviews = createMockReviews(200);
      const batchSize = 100;
      let callCount = 0;

      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new SamplingParseError('Invalid JSON response'));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Invalid JSON response');
    });
  });

  describe('failure threshold', () => {
    it('should abort when failure rate exceeds threshold', async () => {
      const reviews = createMockReviews(400);
      const batchSize = 100;
      let callCount = 0;

      // Fail first 2 of 4 batches (50% failure rate)
      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error(`Batch ${callCount} failed`));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      // Should throw after batch 2 fails (2/2 = 100% > 50% threshold)
      await expect(
        processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize)
      ).rejects.toThrow(/failure rate exceeds 50% threshold/);

      // Should have stopped after 2 batches
      expect(mockSamplingFn).toHaveBeenCalledTimes(2);
    });

    it('should continue if failure rate is below threshold', async () => {
      const reviews = createMockReviews(400);
      const batchSize = 100;
      let callCount = 0;

      // Fail only first batch (1/4 = 25% failure rate)
      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Batch 1 failed'));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      // Should complete all batches + merge
      expect(mockSamplingFn).toHaveBeenCalledTimes(5); // 4 batches + 1 merge
      expect(result.complete).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should not check threshold on first batch failure', async () => {
      const reviews = createMockReviews(200);
      const batchSize = 100;
      let callCount = 0;

      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First batch failed'));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      // Should continue despite first batch failing (threshold check requires 2+ batches)
      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      expect(mockSamplingFn).toHaveBeenCalledTimes(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('batch size limits', () => {
    it('should reject datasets requiring too many batches', async () => {
      const reviews = createMockReviews(100);
      const tinyBatchSize = 4; // Would require 25 batches > MAX_BATCHES (20)

      const mockSamplingFn: SamplingFunction = vi.fn();

      await expect(
        processInBatches(reviews, defaultOptions, mockSamplingFn, tinyBatchSize)
      ).rejects.toThrow(/exceeding maximum of 20/);

      expect(mockSamplingFn).not.toHaveBeenCalled();
    });
  });

  describe('merge fallback', () => {
    it('should use manual merge when AI merge fails', async () => {
      const reviews = createMockReviews(200);
      const batchSize = 100;
      let callCount = 0;

      const mockSamplingFn: SamplingFunction = vi.fn().mockImplementation(() => {
        callCount++;
        // Fail on the 3rd call (merge request)
        if (callCount === 3) {
          return Promise.reject(new Error('Merge failed'));
        }
        return Promise.resolve({
          role: 'assistant',
          content: {
            type: 'text',
            text: JSON.stringify(mockSummaryResponse)
          }
        });
      });

      const result = await processInBatches(reviews, defaultOptions, mockSamplingFn, batchSize);

      // Should complete with fallback merge
      expect(result.complete).toBe(false);
      expect(result.errors).toContain('Merge failed: Merge failed');
      expect(result.data.summary).toBeDefined();
    });
  });
});
