/**
 * Mock Google Business Profile data for testing
 * Based on actual PinMeTo API responses
 */

// Google Location Insights - single location (real API format)
export const mockGoogleLocationInsights = [
  {
    key: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    metrics: [
      { key: '2024-01-01', value: 100 },
      { key: '2024-01-02', value: 150 },
      { key: '2024-01-03', value: 120 },
      { key: '2024-01-04', value: 200 },
      { key: '2024-01-05', value: 180 }
    ]
  },
  {
    key: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    metrics: [
      { key: '2024-01-01', value: 50 },
      { key: '2024-01-02', value: 75 },
      { key: '2024-01-03', value: 60 },
      { key: '2024-01-04', value: 100 },
      { key: '2024-01-05', value: 90 }
    ]
  },
  {
    key: 'BUSINESS_DIRECTION_REQUESTS',
    metrics: [
      { key: '2024-01-01', value: 10 },
      { key: '2024-01-02', value: 12 },
      { key: '2024-01-03', value: 8 },
      { key: '2024-01-04', value: 15 },
      { key: '2024-01-05', value: 11 }
    ]
  },
  {
    key: 'WEBSITE_CLICKS',
    metrics: [
      { key: '2024-01-01', value: 5 },
      { key: '2024-01-02', value: 7 },
      { key: '2024-01-03', value: 6 },
      { key: '2024-01-04', value: 9 },
      { key: '2024-01-05', value: 8 }
    ]
  }
];

// All Google Insights (array format - multiple locations)
export const mockAllGoogleInsights = [
  {
    storeId: 'downtown-store-001',
    metrics: [
      { key: '2024-01-01', value: 425 },
      { key: '2024-01-02', value: 398 },
      { key: '2024-01-03', value: 467 },
      { key: '2024-01-04', value: 512 },
      { key: '2024-01-05', value: 489 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    metrics: [
      { key: '2024-01-01', value: 325 },
      { key: '2024-01-02', value: 298 },
      { key: '2024-01-03', value: 367 },
      { key: '2024-01-04', value: 412 },
      { key: '2024-01-05', value: 389 }
    ]
  }
];

// Google Location Ratings
export const mockGoogleLocationRatings = [
  {
    id: 'review_abc123',
    date: '2024-01-28',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  },
  {
    id: 'review_def456',
    date: '2024-01-27',
    rating: 4,
    hasAnswer: false,
    storeId: 'downtown-store-001'
  },
  {
    id: 'review_ghi789',
    date: '2024-01-26',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  }
];

// All Google Ratings (array format)
export const mockAllGoogleRatings = [
  {
    id: 'review_abc123',
    date: '2024-01-28',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  },
  {
    id: 'review_def456',
    date: '2024-01-27',
    rating: 4,
    hasAnswer: false,
    storeId: 'downtown-store-001'
  },
  {
    id: 'review_xyz789',
    date: '2024-01-29',
    rating: 5,
    hasAnswer: true,
    storeId: 'uptown-store-002'
  },
  {
    id: 'review_uvw012',
    date: '2024-01-28',
    rating: 4,
    hasAnswer: true,
    storeId: 'uptown-store-002'
  }
];

// Google Keywords for a specific location
export const mockGoogleKeywordsForLocation = [
  {
    keyword: 'coffee shop',
    value: 1042,
    locationCounts: 2
  },
  {
    keyword: 'downtown coffee',
    value: 567,
    locationCounts: 1
  },
  {
    keyword: 'coffee near me',
    value: 389,
    locationCounts: 2
  },
  {
    keyword: 'best coffee',
    value: 234,
    locationCounts: 1
  },
  {
    keyword: 'artisan coffee',
    value: 156,
    locationCounts: 1
  }
];

// All Google Keywords (array format)
export const mockAllGoogleKeywords = [
  {
    keyword: 'coffee shop',
    value: 1042,
    locationCounts: 6
  },
  {
    keyword: 'coffee near me',
    value: 789,
    locationCounts: 4
  },
  {
    keyword: 'downtown coffee',
    value: 567,
    locationCounts: 2
  },
  {
    keyword: 'best coffee',
    value: 345,
    locationCounts: 3
  },
  {
    keyword: 'artisan coffee',
    value: 234,
    locationCounts: 2
  },
  {
    keyword: 'cafe',
    value: 189,
    locationCounts: 5
  },
  {
    keyword: 'espresso bar',
    value: 123,
    locationCounts: 2
  }
];

// Empty Google insights (no data available)
export const mockGoogleInsightsEmpty = {
  metrics: []
};

// Paginated Google insights
export const mockGoogleInsightsPaginatedPage1 = [
  {
    storeId: 'downtown-store-001',
    metrics: [
      { key: '2024-01-01', value: 425 },
      { key: '2024-01-02', value: 398 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    metrics: [
      { key: '2024-01-01', value: 325 },
      { key: '2024-01-02', value: 298 }
    ]
  }
];

export const mockGoogleInsightsPaginatedPage2 = [
  {
    storeId: 'another-store-003',
    metrics: [
      { key: '2024-01-01', value: 225 },
      { key: '2024-01-02', value: 198 }
    ]
  }
];
