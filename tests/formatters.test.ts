import { describe, it, expect } from 'vitest';
import {
  formatLocationAsMarkdown,
  formatLocationsListAsMarkdown,
  formatSearchResultsAsMarkdown
} from '../src/formatters/locations';
import {
  formatInsightsAsMarkdown,
  formatLocationInsightsAsMarkdown
} from '../src/formatters/insights';
import { formatRatingsAsMarkdown, formatLocationRatingsAsMarkdown } from '../src/formatters/ratings';
import {
  formatKeywordsAsMarkdown,
  formatLocationKeywordsAsMarkdown
} from '../src/formatters/keywords';
import { formatContent, MARKDOWN_TABLE_MAX_ROWS } from '../src/helpers';

describe('Markdown Formatters', () => {
  describe('Location Formatters', () => {
    describe('formatLocationAsMarkdown', () => {
      it('should format a complete location with all fields', () => {
        const location = {
          storeId: '1337',
          name: 'PinMeTo HQ',
          locationDescriptor: 'Main Office',
          type: 'location',
          permanentlyClosed: false,
          address: {
            street: 'Adelgatan 9',
            city: 'Malmö',
            zip: '211 22',
            country: 'Sweden'
          },
          contact: {
            phone: '+46 40 123456',
            email: 'info@pinmeto.com',
            homepage: 'https://pinmeto.com'
          },
          openHours: {
            monday: '09:00-17:00',
            tuesday: '09:00-17:00',
            wednesday: '09:00-17:00',
            thursday: '09:00-17:00',
            friday: '09:00-17:00',
            saturday: null,
            sunday: null
          }
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('## Location: PinMeTo HQ');
        expect(result).toContain('**Store ID:** 1337');
        expect(result).toContain('**Descriptor:** Main Office');
        expect(result).toContain('**Status:** Open');
        expect(result).toContain('### Address');
        expect(result).toContain('Malmö');
        expect(result).toContain('### Contact');
        expect(result).toContain('+46 40 123456');
        expect(result).toContain('### Opening Hours');
        expect(result).toContain('| Monday | 09:00-17:00 |');
        expect(result).toContain('| Saturday | Closed |');
      });

      it('should handle minimal location data', () => {
        const location = {
          storeId: '123',
          name: 'Test Store'
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('## Location: Test Store');
        expect(result).toContain('**Store ID:** 123');
        expect(result).not.toContain('### Address');
        expect(result).not.toContain('### Contact');
      });

      it('should handle null/undefined location', () => {
        const result = formatLocationAsMarkdown(null as any);
        expect(result).toContain('No location data available');
      });

      it('should show permanently closed status', () => {
        const location = {
          storeId: '123',
          name: 'Closed Store',
          permanentlyClosed: true
        };

        const result = formatLocationAsMarkdown(location);
        expect(result).toContain('**Status:** Permanently Closed');
      });
    });

    describe('formatLocationsListAsMarkdown', () => {
      it('should format a list of locations as a table', () => {
        const response = {
          data: [
            {
              storeId: '1',
              name: 'Store One',
              address: { city: 'Stockholm', country: 'Sweden' },
              permanentlyClosed: false
            },
            {
              storeId: '2',
              name: 'Store Two',
              address: { city: 'Malmö', country: 'Sweden' },
              permanentlyClosed: true
            }
          ],
          totalCount: 2,
          hasMore: false,
          offset: 0,
          limit: 50
        };

        const result = formatLocationsListAsMarkdown(response);

        expect(result).toContain('## Locations');
        expect(result).toContain('**Total:** 2 locations');
        expect(result).toContain('| Store ID | Name | City | Country | Status |');
        expect(result).toContain('| 1 | Store One | Stockholm | Sweden | Open |');
        expect(result).toContain('| 2 | Store Two | Malmö | Sweden | Closed |');
      });

      it('should show cache info when available', () => {
        const response = {
          data: [{ storeId: '1', name: 'Store' }],
          totalCount: 1,
          hasMore: false,
          offset: 0,
          limit: 50,
          cacheInfo: { cached: true, ageSeconds: 120, totalCached: 100 }
        };

        const result = formatLocationsListAsMarkdown(response);
        expect(result).toContain('(cached 120s ago)');
      });

      it('should truncate at MARKDOWN_TABLE_MAX_ROWS', () => {
        const locations = Array.from({ length: 100 }, (_, i) => ({
          storeId: String(i),
          name: `Store ${i}`
        }));

        const response = {
          data: locations,
          totalCount: 100,
          hasMore: false,
          offset: 0,
          limit: 100
        };

        const result = formatLocationsListAsMarkdown(response);
        expect(result).toContain(`... and ${100 - MARKDOWN_TABLE_MAX_ROWS} more locations`);
      });

      it('should show pagination hint when hasMore is true', () => {
        const response = {
          data: [{ storeId: '1', name: 'Store' }],
          totalCount: 100,
          hasMore: true,
          offset: 0,
          limit: 1
        };

        const result = formatLocationsListAsMarkdown(response);
        expect(result).toContain('More results available');
        expect(result).toContain('offset: 1');
      });
    });

    describe('formatSearchResultsAsMarkdown', () => {
      it('should format search results as a table', () => {
        const response = {
          data: [
            {
              storeId: '1',
              name: 'IKEA Malmö',
              locationDescriptor: 'Svågertorp',
              addressSummary: 'Svågertorp, Malmö, Sweden'
            }
          ],
          totalMatches: 1,
          hasMore: false
        };

        const result = formatSearchResultsAsMarkdown(response);

        expect(result).toContain('## Search Results');
        expect(result).toContain('**Found:** 1 matching locations');
        expect(result).toContain('| IKEA Malmö |');
        expect(result).toContain('| Svågertorp |');
      });

      it('should handle empty results', () => {
        const response = {
          data: [],
          totalMatches: 0,
          hasMore: false
        };

        const result = formatSearchResultsAsMarkdown(response);
        expect(result).toContain('No locations found matching your query');
      });
    });
  });

  describe('Insights Formatters', () => {
    describe('formatInsightsAsMarkdown', () => {
      it('should format insights data with tables', () => {
        const data = [
          {
            key: 'views',
            metrics: [
              { key: '2024-01-01', value: 100 },
              { key: '2024-01-02', value: 150 }
            ]
          },
          {
            key: 'clicks',
            metrics: [{ key: '2024-01-01 to 2024-01-31', value: 500 }]
          }
        ];

        const result = formatInsightsAsMarkdown(data);

        expect(result).toContain('## Insights');
        expect(result).toContain('### Views');
        expect(result).toContain('| Period | Value |');
        expect(result).toContain('| 2024-01-01 | 100 |');
        expect(result).toContain('### Clicks');
        expect(result).toContain('| 2024-01-01 to 2024-01-31 | 500 |');
      });

      it('should handle empty data', () => {
        const result = formatInsightsAsMarkdown([]);
        expect(result).toContain('No insights data available');
      });

      it('should format metric names nicely', () => {
        const data = [
          {
            key: 'total_clicks',
            metrics: [{ key: 'total', value: 100 }]
          }
        ];

        const result = formatInsightsAsMarkdown(data);
        expect(result).toContain('### Total Clicks');
      });
    });

    describe('formatLocationInsightsAsMarkdown', () => {
      it('should include store ID in header', () => {
        const data = [
          {
            key: 'views',
            metrics: [{ key: '2024-01-01', value: 100 }]
          }
        ];

        const result = formatLocationInsightsAsMarkdown(data, '1337');
        expect(result).toContain('## Insights for Store: 1337');
      });
    });
  });

  describe('Ratings Formatters', () => {
    describe('formatRatingsAsMarkdown', () => {
      it('should format array of ratings as table', () => {
        const data = [
          { storeId: '1', averageRating: 4.5, totalReviews: 100 },
          { storeId: '2', averageRating: 3.8, totalReviews: 50 }
        ];

        const result = formatRatingsAsMarkdown(data);

        expect(result).toContain('## Ratings (All Locations)');
        expect(result).toContain('| Store ID | Avg Rating | Total Reviews |');
        expect(result).toContain('| 1 | 4.5 | 100 |');
        expect(result).toContain('| 2 | 3.8 | 50 |');
      });

      it('should format single rating with distribution', () => {
        const data = {
          averageRating: 4.2,
          totalReviews: 500,
          distribution: {
            '5': 300,
            '4': 100,
            '3': 50,
            '2': 30,
            '1': 20
          }
        };

        const result = formatRatingsAsMarkdown(data);

        expect(result).toContain('## Rating Summary');
        expect(result).toContain('**Average Rating:** 4.2 / 5.0');
        expect(result).toContain('**Total Reviews:** 500');
        expect(result).toContain('### Rating Distribution');
        expect(result).toContain('| 5 ⭐ |');
      });

      it('should handle null data', () => {
        const result = formatRatingsAsMarkdown(null);
        expect(result).toContain('No ratings data available');
      });
    });

    describe('formatLocationRatingsAsMarkdown', () => {
      it('should include store ID in output', () => {
        const data = { averageRating: 4.0, totalReviews: 10 };
        const result = formatLocationRatingsAsMarkdown(data, '1337');
        expect(result).toContain('**Store ID:** 1337');
      });
    });
  });

  describe('Keywords Formatters', () => {
    describe('formatKeywordsAsMarkdown', () => {
      it('should format keywords with CTR calculation', () => {
        const data = [
          { keyword: 'pizza', impressions: 1000, clicks: 100 },
          { keyword: 'restaurant', impressions: 500, clicks: 25 }
        ];

        const result = formatKeywordsAsMarkdown(data);

        expect(result).toContain('## Google Keywords');
        expect(result).toContain('| Keyword | Impressions | Clicks | CTR |');
        expect(result).toContain('| pizza | 1,000 | 100 | 10.0% |');
        expect(result).toContain('| restaurant | 500 | 25 | 5.0% |');
      });

      it('should handle zero impressions', () => {
        const data = [{ keyword: 'test', impressions: 0, clicks: 0 }];

        const result = formatKeywordsAsMarkdown(data);
        expect(result).toContain('| test | 0 | 0 | - |');
      });

      it('should handle empty data', () => {
        const result = formatKeywordsAsMarkdown([]);
        expect(result).toContain('No keywords data available');
      });
    });

    describe('formatLocationKeywordsAsMarkdown', () => {
      it('should include store ID in header', () => {
        const data = [{ keyword: 'test', impressions: 100, clicks: 10 }];

        const result = formatLocationKeywordsAsMarkdown(data, '1337');
        expect(result).toContain('## Google Keywords for Store: 1337');
      });
    });
  });

  describe('formatContent Helper', () => {
    it('should return JSON for json format', () => {
      const data = { foo: 'bar' };
      const result = formatContent(data, 'json', () => 'markdown');
      expect(result).toBe('{"foo":"bar"}');
    });

    it('should call formatter for markdown format', () => {
      const data = { foo: 'bar' };
      const result = formatContent(data, 'markdown', d => `Formatted: ${JSON.stringify(d)}`);
      expect(result).toBe('Formatted: {"foo":"bar"}');
    });

    it('should default to json when format is undefined', () => {
      const data = { foo: 'bar' };
      const result = formatContent(data, undefined as any, () => 'markdown');
      expect(result).toBe('{"foo":"bar"}');
    });
  });
});
