/**
 * Mock Facebook Page data for testing
 * Based on actual PinMeTo API responses
 */

// Facebook Location Insights - single location (real API format)
export const mockFacebookLocationInsights = [
  {
    key: 'page_impressions',
    metrics: [
      { key: '2024-01-01', value: 145 },
      { key: '2024-01-02', value: 132 },
      { key: '2024-01-03', value: 156 },
      { key: '2024-01-04', value: 178 },
      { key: '2024-01-05', value: 167 }
    ]
  },
  {
    key: 'page_impressions_organic',
    metrics: [
      { key: '2024-01-01', value: 85 },
      { key: '2024-01-02', value: 78 },
      { key: '2024-01-03', value: 92 },
      { key: '2024-01-04', value: 105 },
      { key: '2024-01-05', value: 98 }
    ]
  },
  {
    key: 'page_engaged_users',
    metrics: [
      { key: '2024-01-01', value: 42 },
      { key: '2024-01-02', value: 38 },
      { key: '2024-01-03', value: 45 },
      { key: '2024-01-04', value: 52 },
      { key: '2024-01-05', value: 48 }
    ]
  },
  {
    key: 'page_post_engagements',
    metrics: [
      { key: '2024-01-01', value: 28 },
      { key: '2024-01-02', value: 24 },
      { key: '2024-01-03', value: 31 },
      { key: '2024-01-04', value: 36 },
      { key: '2024-01-05', value: 33 }
    ]
  }
];

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
