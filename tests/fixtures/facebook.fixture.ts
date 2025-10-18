/**
 * Mock Facebook Page data for testing
 * Based on actual PinMeTo API responses
 */

// Facebook Location Insights - single location
export const mockFacebookLocationInsights = {
  metrics: [
    { key: '2024-01-01', value: 145 },
    { key: '2024-01-02', value: 132 },
    { key: '2024-01-03', value: 156 },
    { key: '2024-01-04', value: 178 },
    { key: '2024-01-05', value: 167 },
    { key: '2024-01-06', value: 153 },
    { key: '2024-01-07', value: 142 },
    { key: '2024-01-08', value: 159 },
    { key: '2024-01-09', value: 148 },
    { key: '2024-01-10', value: 171 }
  ]
};

// Facebook Brandpage Insights (aggregated)
export const mockFacebookBrandpageInsights = {
  metrics: [
    { key: '2024-01-01', value: 567 },
    { key: '2024-01-02', value: 534 },
    { key: '2024-01-03', value: 612 },
    { key: '2024-01-04', value: 689 },
    { key: '2024-01-05', value: 645 }
  ]
};

// All Facebook Insights (array format - multiple locations)
export const mockAllFacebookInsights = [
  {
    storeId: 'downtown-store-001',
    metrics: [
      { key: '2024-01-01', value: 145 },
      { key: '2024-01-02', value: 132 },
      { key: '2024-01-03', value: 156 },
      { key: '2024-01-04', value: 178 },
      { key: '2024-01-05', value: 167 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    metrics: [
      { key: '2024-01-01', value: 98 },
      { key: '2024-01-02', value: 87 },
      { key: '2024-01-03', value: 105 },
      { key: '2024-01-04', value: 121 },
      { key: '2024-01-05', value: 112 }
    ]
  }
];

// Facebook Location Ratings
export const mockFacebookLocationRatings = [
  {
    id: 'fb_review_abc123',
    date: '2024-01-28',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  },
  {
    id: 'fb_review_def456',
    date: '2024-01-27',
    rating: 4,
    hasAnswer: false,
    storeId: 'downtown-store-001'
  },
  {
    id: 'fb_review_ghi789',
    date: '2024-01-26',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  }
];

// All Facebook Ratings (array format)
export const mockAllFacebookRatings = [
  {
    id: 'fb_review_abc123',
    date: '2024-01-28',
    rating: 5,
    hasAnswer: true,
    storeId: 'downtown-store-001'
  },
  {
    id: 'fb_review_def456',
    date: '2024-01-27',
    rating: 4,
    hasAnswer: false,
    storeId: 'downtown-store-001'
  },
  {
    id: 'fb_review_xyz789',
    date: '2024-01-29',
    rating: 5,
    hasAnswer: true,
    storeId: 'uptown-store-002'
  },
  {
    id: 'fb_review_uvw012',
    date: '2024-01-28',
    rating: 4,
    hasAnswer: true,
    storeId: 'uptown-store-002'
  }
];

// Empty Facebook insights (no data available)
export const mockFacebookInsightsEmpty = {
  metrics: []
};

// Paginated Facebook insights
export const mockFacebookInsightsPaginatedPage1 = [
  {
    storeId: 'downtown-store-001',
    metrics: [
      { key: '2024-01-01', value: 145 },
      { key: '2024-01-02', value: 132 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    metrics: [
      { key: '2024-01-01', value: 98 },
      { key: '2024-01-02', value: 87 }
    ]
  }
];

export const mockFacebookInsightsPaginatedPage2 = [
  {
    storeId: 'another-store-003',
    metrics: [
      { key: '2024-01-01', value: 65 },
      { key: '2024-01-02', value: 54 }
    ]
  }
];
