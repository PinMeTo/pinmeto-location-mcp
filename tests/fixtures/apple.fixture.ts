/**
 * Mock Apple Maps data for testing
 * Based on actual PinMeTo API responses
 */

// Apple Location Insights - single location
export const mockAppleLocationInsights = {
  storeId: 'downtown-store-001',
  period: {
    from: '2024-01-01',
    to: '2024-01-31'
  },
  metrics: {
    impressions: {
      total: 1245,
      search: 678,
      maps: 567
    },
    actions: {
      directionsRequests: 89,
      phoneCallClicks: 45,
      websiteClicks: 23,
      total: 157
    },
    views: {
      mapViews: 456,
      locationCardViews: 234
    },
    engagement: {
      rate: 0.126,
      uniqueUsers: 892
    }
  },
  deviceBreakdown: {
    iPhone: 756,
    iPad: 234,
    Mac: 255
  },
  topInteractionTypes: [
    { type: 'directions', count: 89 },
    { type: 'phone_call', count: 45 },
    { type: 'website_click', count: 23 }
  ]
};

// All Apple Insights (array format - multiple locations)
export const mockAllAppleInsights = [
  {
    storeId: 'downtown-store-001',
    period: {
      from: '2024-01-01',
      to: '2024-01-31'
    },
    metrics: {
      impressions: {
        total: 1245,
        search: 678,
        maps: 567
      },
      actions: {
        directionsRequests: 89,
        phoneCallClicks: 45,
        websiteClicks: 23,
        total: 157
      },
      views: {
        mapViews: 456,
        locationCardViews: 234
      },
      engagement: {
        rate: 0.126,
        uniqueUsers: 892
      }
    },
    deviceBreakdown: {
      iPhone: 756,
      iPad: 234,
      Mac: 255
    },
    topInteractionTypes: [
      { type: 'directions', count: 89 },
      { type: 'phone_call', count: 45 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    period: {
      from: '2024-01-01',
      to: '2024-01-31'
    },
    metrics: {
      impressions: {
        total: 987,
        search: 534,
        maps: 453
      },
      actions: {
        directionsRequests: 67,
        phoneCallClicks: 34,
        websiteClicks: 18,
        total: 119
      },
      views: {
        mapViews: 345,
        locationCardViews: 178
      },
      engagement: {
        rate: 0.121,
        uniqueUsers: 678
      }
    },
    deviceBreakdown: {
      iPhone: 598,
      iPad: 189,
      Mac: 200
    },
    topInteractionTypes: [
      { type: 'directions', count: 67 },
      { type: 'phone_call', count: 34 }
    ]
  }
];

// Empty Apple insights (no data available)
export const mockAppleInsightsEmpty = {
  storeId: 'closed-store-003',
  period: {
    from: '2024-01-01',
    to: '2024-01-31'
  },
  metrics: {
    impressions: {
      total: 0,
      search: 0,
      maps: 0
    },
    actions: {
      directionsRequests: 0,
      phoneCallClicks: 0,
      websiteClicks: 0,
      total: 0
    },
    views: {
      mapViews: 0,
      locationCardViews: 0
    },
    engagement: {
      rate: 0,
      uniqueUsers: 0
    }
  },
  deviceBreakdown: {
    iPhone: 0,
    iPad: 0,
    Mac: 0
  },
  topInteractionTypes: []
};

// Paginated Apple insights
export const mockAppleInsightsPaginatedPage1 = [
  {
    storeId: 'downtown-store-001',
    period: {
      from: '2024-01-01',
      to: '2024-01-31'
    },
    metrics: {
      impressions: {
        total: 1245,
        search: 678,
        maps: 567
      },
      actions: {
        directionsRequests: 89,
        phoneCallClicks: 45,
        websiteClicks: 23,
        total: 157
      },
      views: {
        mapViews: 456,
        locationCardViews: 234
      },
      engagement: {
        rate: 0.126,
        uniqueUsers: 892
      }
    },
    deviceBreakdown: {
      iPhone: 756,
      iPad: 234,
      Mac: 255
    },
    topInteractionTypes: [
      { type: 'directions', count: 89 }
    ]
  },
  {
    storeId: 'uptown-store-002',
    period: {
      from: '2024-01-01',
      to: '2024-01-31'
    },
    metrics: {
      impressions: {
        total: 987,
        search: 534,
        maps: 453
      },
      actions: {
        directionsRequests: 67,
        phoneCallClicks: 34,
        websiteClicks: 18,
        total: 119
      },
      views: {
        mapViews: 345,
        locationCardViews: 178
      },
      engagement: {
        rate: 0.121,
        uniqueUsers: 678
      }
    },
    deviceBreakdown: {
      iPhone: 598,
      iPad: 189,
      Mac: 200
    },
    topInteractionTypes: [
      { type: 'directions', count: 67 }
    ]
  }
];

export const mockAppleInsightsPaginatedPage2 = [
  {
    storeId: 'another-store-003',
    period: {
      from: '2024-01-01',
      to: '2024-01-31'
    },
    metrics: {
      impressions: {
        total: 543,
        search: 298,
        maps: 245
      },
      actions: {
        directionsRequests: 45,
        phoneCallClicks: 23,
        websiteClicks: 12,
        total: 80
      },
      views: {
        mapViews: 234,
        locationCardViews: 112
      },
      engagement: {
        rate: 0.147,
        uniqueUsers: 456
      }
    },
    deviceBreakdown: {
      iPhone: 345,
      iPad: 98,
      Mac: 100
    },
    topInteractionTypes: [
      { type: 'directions', count: 45 }
    ]
  }
];
