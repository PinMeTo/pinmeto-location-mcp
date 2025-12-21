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

      it('should handle capitalized day names in opening hours', () => {
        const location = {
          storeId: '123',
          name: 'Test Store',
          openHours: {
            Monday: '09:00-17:00',
            Tuesday: '09:00-17:00',
            Saturday: null
          }
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('### Opening Hours');
        expect(result).toContain('| Monday | 09:00-17:00 |');
        expect(result).toContain('| Tuesday | 09:00-17:00 |');
        expect(result).toContain('| Saturday | Closed |');
      });

      it('should handle array format for opening hours', () => {
        const location = {
          storeId: '123',
          name: 'Test Store',
          openHours: {
            monday: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '17:00' }],
            tuesday: [{ open: '09:00', close: '17:00' }],
            sunday: []
          }
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('### Opening Hours');
        expect(result).toContain('| Monday | 09:00-12:00, 13:00-17:00 |');
        expect(result).toContain('| Tuesday | 09:00-17:00 |');
        expect(result).toContain('| Sunday | Closed |');
      });

      it('should handle PinMeTo format with state and span', () => {
        const location = {
          storeId: '123',
          name: 'Test Store',
          openHours: {
            mon: { state: 'Open', span: [{ open: '0800', close: '1700' }] },
            tue: { state: 'Open', span: [{ open: '0800', close: '1700' }] },
            wed: { state: 'Open', span: [{ open: '0900', close: '1200' }, { open: '1300', close: '1700' }] },
            sat: { state: 'Closed', span: [] },
            sun: { state: 'Closed', span: [] }
          }
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('### Opening Hours');
        expect(result).toContain('| Monday | 08:00-17:00 |');
        expect(result).toContain('| Tuesday | 08:00-17:00 |');
        expect(result).toContain('| Wednesday | 09:00-12:00, 13:00-17:00 |');
        expect(result).toContain('| Saturday | Closed |');
        expect(result).toContain('| Sunday | Closed |');
      });

      it('should handle simple object format for opening hours', () => {
        const location = {
          storeId: '123',
          name: 'Test Store',
          openHours: {
            Mon: { open: '09:00', close: '17:00' },
            Tue: { open: '09:00', close: '17:00' },
            Sat: { isClosed: true }
          }
        };

        const result = formatLocationAsMarkdown(location);

        expect(result).toContain('### Opening Hours');
        expect(result).toContain('| Monday | 09:00-17:00 |');
        expect(result).toContain('| Tuesday | 09:00-17:00 |');
        expect(result).toContain('| Saturday | Closed |');
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

      it('should show temporarily closed status with date', () => {
        const location = {
          storeId: '123',
          name: 'Renovating Store',
          temporarilyClosedUntil: '2025-03-15'
        };

        const result = formatLocationAsMarkdown(location);
        expect(result).toContain('**Status:** Temporarily Closed to 2025-03-15');
      });

      it('should show opening soon status for future opening date', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        const location = {
          storeId: '123',
          name: 'New Store',
          openingDate: futureDateStr
        };

        const result = formatLocationAsMarkdown(location);
        expect(result).toContain(`**Status:** Opening ${futureDateStr}`);
      });

      it('should show open status for past opening date', () => {
        const location = {
          storeId: '123',
          name: 'Established Store',
          openingDate: '2020-01-15'
        };

        const result = formatLocationAsMarkdown(location);
        expect(result).toContain('**Status:** Open');
      });
    });

    describe('formatLocationsListAsMarkdown', () => {
      it('should format a list of locations as a table with all status types', () => {
        // Generate a future date for the "opening soon" test
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        const response = {
          data: [
            {
              storeId: '1',
              name: 'Store One',
              locationDescriptor: 'Main Branch',
              address: { city: 'Stockholm', country: 'Sweden' },
              permanentlyClosed: false
            },
            {
              storeId: '2',
              name: 'Store Two',
              locationDescriptor: 'Mall Location',
              address: { city: 'Malmö', country: 'Sweden' },
              permanentlyClosed: true
            },
            {
              storeId: '3',
              name: 'Store Three',
              locationDescriptor: 'Airport',
              address: { city: 'Göteborg', country: 'Sweden' },
              temporarilyClosedUntil: '2025-04-01'
            },
            {
              storeId: '4',
              name: 'Store Four',
              locationDescriptor: 'New Location',
              address: { city: 'Uppsala', country: 'Sweden' },
              openingDate: futureDateStr
            }
          ],
          totalCount: 4,
          hasMore: false,
          offset: 0,
          limit: 50
        };

        const result = formatLocationsListAsMarkdown(response);

        expect(result).toContain('## Locations');
        expect(result).toContain('**Total:** 4 locations');
        expect(result).toContain('| Store ID | Name | Descriptor | City | Country | Status |');
        expect(result).toContain('| 1 | Store One | Main Branch | Stockholm | Sweden | Open |');
        expect(result).toContain('| 2 | Store Two | Mall Location | Malmö | Sweden | Permanently Closed |');
        expect(result).toContain('| 3 | Store Three | Airport | Göteborg | Sweden | Closed to 2025-04-01 |');
        expect(result).toContain(`| 4 | Store Four | New Location | Uppsala | Sweden | Opening ${futureDateStr} |`);
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

      it('should aggregate individual reviews by store', () => {
        const reviews = [
          { storeId: '7', rating: 5, comment: 'Great!', date: '2025-05-05' },
          { storeId: '1337', rating: 5, comment: '', date: '2025-05-05' },
          { storeId: '7', rating: 4, comment: 'Cool', date: '2025-03-05' }
        ];

        const result = formatRatingsAsMarkdown(reviews);

        expect(result).toContain('## Ratings (All Locations)');
        expect(result).toContain('| 7 | 4.5 | 2 |');
        expect(result).toContain('| 1337 | 5.0 | 1 |');
      });

      it('should handle empty review array', () => {
        const result = formatRatingsAsMarkdown([]);
        expect(result).toContain('No ratings data available');
      });

      it('should calculate correct distribution from reviews', () => {
        const reviews = [
          { storeId: 'A', rating: 5, date: '2025-01-01' },
          { storeId: 'A', rating: 5, date: '2025-01-02' },
          { storeId: 'A', rating: 4, date: '2025-01-03' },
          { storeId: 'A', rating: 3, date: '2025-01-04' }
        ];

        const result = formatRatingsAsMarkdown(reviews);

        // Average should be (5+5+4+3)/4 = 4.25
        expect(result).toContain('| A | 4.3 | 4 |');
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
      it('should format keywords with impressions (value field)', () => {
        const data = [
          { keyword: 'pizza', value: 1000, locationCounts: 5 },
          { keyword: 'restaurant', value: 500, locationCounts: 3 }
        ];

        const result = formatKeywordsAsMarkdown(data);

        expect(result).toContain('## Google Keywords');
        expect(result).toContain('| Keyword | Impressions |');
        expect(result).toContain('| pizza | 1,000 |');
        expect(result).toContain('| restaurant | 500 |');
      });

      it('should handle zero impressions', () => {
        const data = [{ keyword: 'test', value: 0, locationCounts: 1 }];

        const result = formatKeywordsAsMarkdown(data);
        expect(result).toContain('| test | 0 |');
      });

      it('should handle empty data', () => {
        const result = formatKeywordsAsMarkdown([]);
        expect(result).toContain('No keywords data available');
      });
    });

    describe('formatLocationKeywordsAsMarkdown', () => {
      it('should include store ID in header', () => {
        const data = [{ keyword: 'test', value: 100, locationCounts: 1 }];

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
