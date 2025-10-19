/**
 * Mock location data for testing
 * Based on actual PinMeTo Locations API responses
 */

export const mockLocation1 = {
  description: {
    short: 'Downtown coffee shop with premium coffee',
    long: 'Your favorite neighborhood coffee shop serving premium artisan coffee and pastries'
  },
  pendingChanges: {},
  location: {
    lat: 37.7749,
    lon: -122.4194
  },
  name: 'Downtown Coffee Shop',
  address: {
    state: 'CA',
    street: '123 Market Street',
    zip: '94102',
    city: 'San Francisco',
    country: 'United States',
    countryAlpha2Code: 'US'
  },
  contact: {
    email: 'downtown@coffeeshop.com',
    phone: '+1-415-555-0123',
    homepage: 'https://www.coffeeshop.com/downtown'
  },
  isAlwaysOpen: false,
  locationDescriptor: 'Downtown location',
  openHours: {
    mon: {
      state: 'Open',
      span: [{ open: '0700', close: '1900' }]
    },
    tue: {
      state: 'Open',
      span: [{ open: '0700', close: '1900' }]
    },
    wed: {
      state: 'Open',
      span: [{ open: '0700', close: '1900' }]
    },
    thu: {
      state: 'Open',
      span: [{ open: '0700', close: '1900' }]
    },
    fri: {
      state: 'Open',
      span: [{ open: '0700', close: '2000' }]
    },
    sat: {
      state: 'Open',
      span: [{ open: '0800', close: '2000' }]
    },
    sun: {
      state: 'Open',
      span: [{ open: '0800', close: '1800' }]
    }
  },
  specialOpenHours: [],
  storeId: 'downtown-store-001',
  permanentlyClosed: false
};

export const mockLocation2 = {
  description: {
    short: 'Uptown coffee shop with fast WiFi',
    long: 'Modern coffee shop perfect for remote work with excellent WiFi'
  },
  pendingChanges: {},
  location: {
    lat: 37.79,
    lon: -122.4
  },
  name: 'Uptown Coffee Shop',
  address: {
    state: 'CA',
    street: '456 Bush Street',
    zip: '94108',
    city: 'San Francisco',
    country: 'United States',
    countryAlpha2Code: 'US'
  },
  contact: {
    email: 'uptown@coffeeshop.com',
    phone: '+1-415-555-0456',
    homepage: 'https://www.coffeeshop.com/uptown'
  },
  isAlwaysOpen: false,
  locationDescriptor: 'Uptown location',
  openHours: {
    mon: {
      state: 'Open',
      span: [{ open: '0630', close: '2000' }]
    },
    tue: {
      state: 'Open',
      span: [{ open: '0630', close: '2000' }]
    },
    wed: {
      state: 'Open',
      span: [{ open: '0630', close: '2000' }]
    },
    thu: {
      state: 'Open',
      span: [{ open: '0630', close: '2000' }]
    },
    fri: {
      state: 'Open',
      span: [{ open: '0630', close: '2100' }]
    },
    sat: {
      state: 'Open',
      span: [{ open: '0700', close: '2100' }]
    },
    sun: {
      state: 'Open',
      span: [{ open: '0700', close: '1900' }]
    }
  },
  specialOpenHours: [],
  storeId: 'uptown-store-002',
  permanentlyClosed: false
};

export const mockLocation3Inactive = {
  description: {
    short: '',
    long: ''
  },
  pendingChanges: {},
  location: {
    lat: 37.76,
    lon: -122.43
  },
  name: 'Closed Location',
  address: {
    state: 'CA',
    street: '789 Mission Street',
    zip: '94103',
    city: 'San Francisco',
    country: 'United States',
    countryAlpha2Code: 'US'
  },
  contact: {
    email: 'closed@coffeeshop.com',
    phone: '+1-415-555-0789',
    homepage: 'https://www.coffeeshop.com/closed'
  },
  isAlwaysOpen: false,
  locationDescriptor: 'Closed location',
  openHours: {
    mon: { state: 'Closed', span: [] },
    tue: { state: 'Closed', span: [] },
    wed: { state: 'Closed', span: [] },
    thu: { state: 'Closed', span: [] },
    fri: { state: 'Closed', span: [] },
    sat: { state: 'Closed', span: [] },
    sun: { state: 'Closed', span: [] }
  },
  specialOpenHours: [],
  storeId: 'closed-store-003',
  permanentlyClosed: true
};

// Paginated locations response
export const mockLocationsPaginatedPage1 = {
  data: [mockLocation1, mockLocation2],
  paging: {
    nextUrl: 'https://locations.api.example.com/v4/test_account/locations?pagesize=2&page=2'
  }
};

export const mockLocationsPaginatedPage2 = {
  data: [mockLocation3Inactive],
  paging: {}
};

// All locations in one response
export const mockLocationsAll = {
  data: [mockLocation1, mockLocation2, mockLocation3Inactive],
  paging: {}
};

// Empty locations response
export const mockLocationsEmpty = {
  data: [],
  paging: {}
};

// Locations with specific fields only (simulating field filtering)
export const mockLocationsFieldsFiltered = {
  data: [
    {
      storeId: 'downtown-store-001',
      name: 'Downtown Coffee Shop',
      permanentlyClosed: false
    },
    {
      storeId: 'uptown-store-002',
      name: 'Uptown Coffee Shop',
      permanentlyClosed: false
    },
    {
      storeId: 'closed-store-003',
      name: 'Closed Location',
      permanentlyClosed: true
    }
  ],
  paging: {}
};
