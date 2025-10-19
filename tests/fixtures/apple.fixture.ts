/**
 * Mock Apple Maps data for testing
 * Based on actual PinMeTo API responses
 */

// Apple Location Insights - single location (real API format)
export const mockAppleLocationInsights = [
  {
    key: 'PLACECARD_VIEW',
    metrics: [
      { key: '2024-01-01', value: 245 },
      { key: '2024-01-02', value: 289 },
      { key: '2024-01-03', value: 267 },
      { key: '2024-01-04', value: 312 },
      { key: '2024-01-05', value: 298 }
    ]
  },
  {
    key: 'PLACECARD_TAP_DIRECTION',
    metrics: [
      { key: '2024-01-01', value: 18 },
      { key: '2024-01-02', value: 21 },
      { key: '2024-01-03', value: 17 },
      { key: '2024-01-04', value: 25 },
      { key: '2024-01-05', value: 22 }
    ]
  },
  {
    key: 'PLACECARD_TAP_CALL',
    metrics: [
      { key: '2024-01-01', value: 9 },
      { key: '2024-01-02', value: 11 },
      { key: '2024-01-03', value: 8 },
      { key: '2024-01-04', value: 13 },
      { key: '2024-01-05', value: 10 }
    ]
  },
  {
    key: 'PLACECARD_TAP_WEBSITE',
    metrics: [
      { key: '2024-01-01', value: 5 },
      { key: '2024-01-02', value: 7 },
      { key: '2024-01-03', value: 4 },
      { key: '2024-01-04', value: 8 },
      { key: '2024-01-05', value: 6 }
    ]
  },
  {
    key: 'SEARCH_LOCATION_TAP_NAME',
    metrics: [
      { key: '2024-01-01', value: 135 },
      { key: '2024-01-02', value: 156 },
      { key: '2024-01-03', value: 142 },
      { key: '2024-01-04', value: 178 },
      { key: '2024-01-05', value: 165 }
    ]
  }
];

// All Apple Insights (array format - multiple locations)
// Real API returns same format as single location - array of metric objects
export const mockAllAppleInsights = [
  {
    key: 'PLACECARD_VIEW',
    metrics: [
      { key: '2024-01-01', value: 245 },
      { key: '2024-01-02', value: 289 },
      { key: '2024-01-03', value: 267 },
      { key: '2024-01-04', value: 312 },
      { key: '2024-01-05', value: 298 }
    ]
  },
  {
    key: 'PLACECARD_TAP_DIRECTION',
    metrics: [
      { key: '2024-01-01', value: 18 },
      { key: '2024-01-02', value: 21 },
      { key: '2024-01-03', value: 17 },
      { key: '2024-01-04', value: 25 },
      { key: '2024-01-05', value: 22 }
    ]
  },
  {
    key: 'PLACECARD_TAP_CALL',
    metrics: [
      { key: '2024-01-01', value: 9 },
      { key: '2024-01-02', value: 11 },
      { key: '2024-01-03', value: 8 },
      { key: '2024-01-04', value: 13 },
      { key: '2024-01-05', value: 10 }
    ]
  },
  {
    key: 'PLACECARD_TAP_WEBSITE',
    metrics: [
      { key: '2024-01-01', value: 5 },
      { key: '2024-01-02', value: 7 },
      { key: '2024-01-03', value: 4 },
      { key: '2024-01-04', value: 8 },
      { key: '2024-01-05', value: 6 }
    ]
  },
  {
    key: 'SEARCH_LOCATION_TAP_NAME',
    metrics: [
      { key: '2024-01-01', value: 135 },
      { key: '2024-01-02', value: 156 },
      { key: '2024-01-03', value: 142 },
      { key: '2024-01-04', value: 178 },
      { key: '2024-01-05', value: 165 }
    ]
  }
];

// Empty Apple insights - for inactive location (real API format)
export const mockAppleInsightsEmpty: any[] = [];

// Paginated Apple insights - same format as single location
export const mockAppleInsightsPaginatedPage1 = [
  {
    key: 'PLACECARD_VIEW',
    metrics: [
      { key: '2024-01-01', value: 120 },
      { key: '2024-01-02', value: 145 }
    ]
  },
  {
    key: 'PLACECARD_TAP_DIRECTION',
    metrics: [
      { key: '2024-01-01', value: 10 },
      { key: '2024-01-02', value: 12 }
    ]
  }
];

export const mockAppleInsightsPaginatedPage2 = [
  {
    key: 'PLACECARD_TAP_CALL',
    metrics: [
      { key: '2024-01-01', value: 5 },
      { key: '2024-01-02', value: 7 }
    ]
  },
  {
    key: 'PLACECARD_TAP_WEBSITE',
    metrics: [
      { key: '2024-01-01', value: 3 },
      { key: '2024-01-02', value: 4 }
    ]
  }
];
