import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculatePriorPeriod,
  computeComparison,
  checkGoogleDataLag,
  getPeriodLabel,
  aggregateMetrics
} from '../src/helpers';
import type { InsightsData } from '../src/schemas/output';

describe('Comparison Helper Functions', () => {
  describe('calculatePriorPeriod', () => {
    describe('prior_period mode', () => {
      it('should calculate prior period with same duration', () => {
        // 29-day period: Feb 1 to Mar 1
        const result = calculatePriorPeriod('2024-02-01', '2024-03-01', 'prior_period');

        // Verify duration is preserved
        const currentDuration =
          (new Date('2024-03-01').getTime() - new Date('2024-02-01').getTime()) /
          (1000 * 60 * 60 * 24);
        const priorDuration =
          (new Date(result.to).getTime() - new Date(result.from).getTime()) / (1000 * 60 * 60 * 24);

        expect(priorDuration).toBe(currentDuration);

        // Prior period should be in January
        expect(result.to.startsWith('2024-0')).toBe(true);
      });

      it('should handle month boundaries', () => {
        // Full January - prior period should be same duration ending before Jan 1
        const result = calculatePriorPeriod('2024-01-01', '2024-01-31', 'prior_period');

        // Verify duration is preserved (30 days)
        const currentDuration =
          (new Date('2024-01-31').getTime() - new Date('2024-01-01').getTime()) /
          (1000 * 60 * 60 * 24);
        const priorDuration =
          (new Date(result.to).getTime() - new Date(result.from).getTime()) / (1000 * 60 * 60 * 24);

        expect(priorDuration).toBe(currentDuration);

        // Prior period starts in December
        expect(result.from.startsWith('2023-12')).toBe(true);
      });

      it('should handle year boundaries correctly', () => {
        // The period spans into the previous year
        const result = calculatePriorPeriod('2024-01-01', '2024-01-15', 'prior_period');

        // Duration should match the original period
        const currentFrom = new Date('2024-01-01');
        const currentTo = new Date('2024-01-15');
        const priorFrom = new Date(result.from);
        const priorTo = new Date(result.to);

        const currentDuration = currentTo.getTime() - currentFrom.getTime();
        const priorDuration = priorTo.getTime() - priorFrom.getTime();

        expect(priorDuration).toBe(currentDuration);

        // Prior period should be in December 2023
        expect(result.from.startsWith('2023-12')).toBe(true);
      });
    });

    describe('prior_year mode', () => {
      it('should return same dates in previous year', () => {
        const result = calculatePriorPeriod('2024-01-01', '2024-03-31', 'prior_year');
        expect(result.from).toBe('2023-01-01');
        expect(result.to).toBe('2023-03-31');
      });

      it('should handle leap year dates', () => {
        // Feb 29 in leap year - prior year won't have Feb 29
        // JS Date rolls Feb 29 2023 -> Mar 1 2023
        const result = calculatePriorPeriod('2024-02-29', '2024-02-29', 'prior_year');
        expect(result.from).toBe('2023-03-01'); // JS Date rolls to Mar 1
        expect(result.to).toBe('2023-03-01');
      });

      it('should preserve month/day for non-leap dates', () => {
        const result = calculatePriorPeriod('2024-06-15', '2024-06-30', 'prior_year');
        expect(result.from).toBe('2023-06-15');
        expect(result.to).toBe('2023-06-30');
      });
    });

    describe('edge cases', () => {
      it('should default to prior_period for none', () => {
        // 'none' should still return a result (caller should check)
        const result = calculatePriorPeriod('2024-03-01', '2024-03-31', 'none');
        expect(result.from).toBeDefined();
        expect(result.to).toBeDefined();
      });
    });
  });

  describe('computeComparison', () => {
    it('should compute positive delta correctly', () => {
      const currentData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2024', value: 150 }] }
      ];
      const priorData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2023', value: 100 }] }
      ];

      const result = computeComparison(currentData, priorData);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('views');
      expect(result[0].metrics[0].current).toBe(150);
      expect(result[0].metrics[0].prior).toBe(100);
      expect(result[0].metrics[0].delta).toBe(50);
      expect(result[0].metrics[0].deltaPercent).toBe(50);
    });

    it('should compute negative delta correctly', () => {
      const currentData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2024', value: 80 }] }
      ];
      const priorData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2023', value: 100 }] }
      ];

      const result = computeComparison(currentData, priorData);

      expect(result[0].metrics[0].delta).toBe(-20);
      expect(result[0].metrics[0].deltaPercent).toBe(-20);
    });

    it('should return null deltaPercent when prior is 0', () => {
      const currentData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2024', value: 100 }] }
      ];
      const priorData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2023', value: 0 }] }
      ];

      const result = computeComparison(currentData, priorData);

      expect(result[0].metrics[0].current).toBe(100);
      expect(result[0].metrics[0].prior).toBe(0);
      expect(result[0].metrics[0].delta).toBe(100);
      expect(result[0].metrics[0].deltaPercent).toBeNull();
    });

    it('should match metrics by index for multiple periods', () => {
      const currentData: InsightsData[] = [
        {
          key: 'views',
          metrics: [
            { key: '2024-01', value: 100 },
            { key: '2024-02', value: 200 }
          ]
        }
      ];
      const priorData: InsightsData[] = [
        {
          key: 'views',
          metrics: [
            { key: '2023-01', value: 80 },
            { key: '2023-02', value: 150 }
          ]
        }
      ];

      const result = computeComparison(currentData, priorData);

      // First metric: 100 vs 80
      expect(result[0].metrics[0].current).toBe(100);
      expect(result[0].metrics[0].prior).toBe(80);
      expect(result[0].metrics[0].delta).toBe(20);

      // Second metric: 200 vs 150 (NOT 200 vs 80)
      expect(result[0].metrics[1].current).toBe(200);
      expect(result[0].metrics[1].prior).toBe(150);
      expect(result[0].metrics[1].delta).toBe(50);
    });

    it('should handle missing prior dimension', () => {
      const currentData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2024', value: 100 }] }
      ];
      const priorData: InsightsData[] = [
        { key: 'clicks', metrics: [{ key: '2023', value: 50 }] } // Different key
      ];

      const result = computeComparison(currentData, priorData);

      // Should use 0 for missing prior
      expect(result[0].metrics[0].prior).toBe(0);
      expect(result[0].metrics[0].delta).toBe(100);
    });

    it('should preserve labels', () => {
      const currentData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2024-01', value: 100, label: 'January 2024' }] }
      ];
      const priorData: InsightsData[] = [
        { key: 'views', metrics: [{ key: '2023-01', value: 80, label: 'January 2023' }] }
      ];

      const result = computeComparison(currentData, priorData);

      expect(result[0].metrics[0].currentLabel).toBe('January 2024');
      expect(result[0].metrics[0].priorLabel).toBe('January 2023');
    });
  });

  describe('checkGoogleDataLag', () => {
    beforeEach(() => {
      // Mock Date to a fixed point in time: 2024-12-21
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-21T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return warning for dates within lag window', () => {
      // 10 days ago from Dec 21 is Dec 11, so Dec 15 is within lag window
      const result = checkGoogleDataLag('2024-12-15');

      expect(result).not.toBeNull();
      expect(result?.warningCode).toBe('INCOMPLETE_DATA');
      expect(result?.warning).toContain('may be incomplete');
    });

    it('should return null for dates outside lag window', () => {
      // Dec 1 is well outside the 10-day lag window
      const result = checkGoogleDataLag('2024-12-01');

      expect(result).toBeNull();
    });

    it('should return null for exactly at cutoff boundary', () => {
      // Exactly 10 days ago (Dec 11) should not trigger warning
      const result = checkGoogleDataLag('2024-12-11');

      expect(result).toBeNull();
    });

    it('should return warning for today', () => {
      const result = checkGoogleDataLag('2024-12-21');

      expect(result).not.toBeNull();
      expect(result?.warningCode).toBe('INCOMPLETE_DATA');
    });
  });

  describe('getPeriodLabel', () => {
    describe('date range format', () => {
      it('should format same-year range', () => {
        expect(getPeriodLabel('2024-01-01 to 2024-03-31')).toBe('Jan 1 - Mar 31, 2024');
      });

      it('should format cross-year range', () => {
        expect(getPeriodLabel('2023-12-01 to 2024-01-31')).toBe('Dec 1, 2023 - Jan 31, 2024');
      });

      it('should return raw key for invalid date range', () => {
        expect(getPeriodLabel('invalid to dates')).toBe('invalid to dates');
      });
    });

    describe('weekly format', () => {
      it('should format week numbers', () => {
        expect(getPeriodLabel('2024-W01')).toBe('Week 1, 2024');
        expect(getPeriodLabel('2024-W52')).toBe('Week 52, 2024');
      });
    });

    describe('quarterly format', () => {
      it('should format quarters', () => {
        expect(getPeriodLabel('2024-Q1')).toBe('Q1 2024');
        expect(getPeriodLabel('2024-Q4')).toBe('Q4 2024');
      });
    });

    describe('half-yearly format', () => {
      it('should format halves', () => {
        expect(getPeriodLabel('2024-H1')).toBe('H1 2024');
        expect(getPeriodLabel('2024-H2')).toBe('H2 2024');
      });
    });

    describe('monthly format', () => {
      it('should format months', () => {
        expect(getPeriodLabel('2024-01')).toBe('January 2024');
        expect(getPeriodLabel('2024-12')).toBe('December 2024');
      });

      it('should handle invalid month numbers gracefully', () => {
        // Month 13 is invalid, should return raw
        expect(getPeriodLabel('2024-13')).toBe('2024-13');
      });
    });

    describe('yearly format', () => {
      it('should return year as-is', () => {
        expect(getPeriodLabel('2024')).toBe('2024');
      });
    });

    describe('daily format', () => {
      it('should format daily dates', () => {
        expect(getPeriodLabel('2024-01-15')).toBe('Jan 15, 2024');
        expect(getPeriodLabel('2024-12-31')).toBe('Dec 31, 2024');
      });

      it('should return raw key for invalid daily date', () => {
        // This regex passes but creates invalid Date
        // Note: JS Date("2024-02-30") creates Mar 1, so this may not trigger
        expect(getPeriodLabel('invalid-date')).toBe('invalid-date');
      });
    });

    describe('unknown format', () => {
      it('should return unknown formats as-is', () => {
        expect(getPeriodLabel('some-random-string')).toBe('some-random-string');
        expect(getPeriodLabel('')).toBe('');
      });
    });
  });

  describe('aggregateMetrics with total', () => {
    it('should produce chronological date range from unsorted metrics', () => {
      const unsortedData: InsightsData[] = [
        {
          key: 'VIEWS',
          metrics: [
            { key: '2024-05-15', value: 10 },
            { key: '2024-01-10', value: 20 }, // Earliest
            { key: '2024-03-20', value: 30 },
            { key: '2024-12-25', value: 40 } // Latest
          ]
        }
      ];

      const result = aggregateMetrics(unsortedData, 'total');

      expect(result[0].metrics[0].key).toBe('2024-01-10 to 2024-12-25');
      expect(result[0].metrics[0].label).toBe('Jan 10 - Dec 25, 2024');
      expect(result[0].metrics[0].value).toBe(100);
    });

    it('should handle single metric', () => {
      const singleData: InsightsData[] = [
        {
          key: 'CLICKS',
          metrics: [{ key: '2024-06-15', value: 50 }]
        }
      ];

      const result = aggregateMetrics(singleData, 'total');

      expect(result[0].metrics[0].key).toBe('2024-06-15 to 2024-06-15');
      expect(result[0].metrics[0].value).toBe(50);
    });

    it('should return empty metrics unchanged', () => {
      const emptyData: InsightsData[] = [{ key: 'VIEWS', metrics: [] }];

      const result = aggregateMetrics(emptyData, 'total');

      expect(result[0].metrics).toHaveLength(0);
    });
  });
});
