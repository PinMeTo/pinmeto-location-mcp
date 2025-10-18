import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  truncateResponse,
  formatInsightsMarkdown,
  formatRatingsMarkdown,
  handleToolResponse,
  AggregationLevel
} from '../../helpers';

export function getFacebookLocationsInsights(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_facebook_location_insights',
    `Fetch Facebook Page performance metrics for a specific location over a date range.

Returns comprehensive Facebook insights including:
- **Page impressions**: Total (page_impressions), unique (page_impressions_unique), organic (page_impressions_organic, page_impressions_organic_unique), paid (page_impressions_paid, page_impressions_paid_unique)
- **Engagement**: Total page actions (page_total_actions)
- **Followers**: New likes (page_fan_adds), unlikes (page_fan_removes), total fans (page_fans)

**When to use this tool:**
- Analyzing individual location's Facebook Page performance
- Comparing time periods for a single location (e.g., month-over-month)
- Investigating drops or spikes in Facebook engagement
- Measuring effectiveness of Facebook posts and content strategy
- Understanding which content types drive the most engagement

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool with the storeId and date range
3. For comparing across multiple locations, use get_all_facebook_insights instead

**Date range notes:**
- Maximum 2 years of historical data available
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- ⚠️ **Data lag: Facebook insights are delayed by approximately 3 days** - request dates at least 3 days in the past
- Longer date ranges provide better trend analysis

**Example use case:**
"Compare last month's Facebook engagement to the previous month for the downtown store to see if our new post strategy worked"`,
    {
      storeId: z
        .string()
        .min(1)
        .describe('The PinMeTo store ID (use get_locations to find IDs)'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-01")'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format (e.g., "2024-01-31")'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total (all data summed into one period)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({
      storeId,
      from,
      to,
      format,
      aggregation
    }: {
      storeId: string;
      from: string;
      to: string;
      format?: 'json' | 'markdown';
      aggregation?: AggregationLevel;
    }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/facebook?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          aggregation: aggregation || 'total',
          errorMessage: `Unable to fetch Facebook insights for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using get_locations tool
2. Confirm the location has an active Facebook Page integration
3. Check if the date range is within the last 2 years
4. Ensure dates are valid and 'from' date is before 'to' date
5. Facebook insights may take 24-48 hours to become available for recent dates

**Common issues:**
- Location not yet synced with Facebook Pages
- Date range too far in the past (>2 years)
- Invalid storeId for this account
- Location's Facebook integration is disconnected or pending
- Dates in wrong format (must be YYYY-MM-DD)

Try using get_location first to verify the location exists and has the 'fb' field populated, which indicates Facebook Pages is connected.`,
          markdownFormatter: (data, agg) => formatInsightsMarkdown('Facebook', data, storeId, agg)
        }
      );
    }
  );
}

export function getAllFacebookInsights(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_all_facebook_insights',
    `Fetch Facebook Page performance metrics for ALL location pages in your account over a date range.

Returns aggregated Facebook insights across all location pages including:
- **Page impressions**: Total (page_impressions), unique (page_impressions_unique), organic (page_impressions_organic, page_impressions_organic_unique), paid (page_impressions_paid, page_impressions_paid_unique)
- **Engagement**: Total page actions (page_total_actions)
- **Followers**: New likes (page_fan_adds), unlikes (page_fan_removes), total fans (page_fans)

**When to use this tool:**
- Getting a high-level overview of Facebook performance across your entire business
- Comparing overall performance between time periods
- Identifying top-performing locations by comparing against individual location insights
- Monthly/quarterly reporting on Facebook Page performance
- Analyzing aggregate trends and patterns

**Workflow:**
1. Use this tool to get aggregate metrics for all location pages
2. Use get_facebook_location_insights for specific locations that need deeper analysis
3. Combine with get_locations to map storeIds to location names

**vs. get_facebook_location_insights:**
- Use this tool for: Overall business performance, multi-location comparisons, executive summaries
- Use single location tool for: Individual location deep-dives, specific store performance analysis

**Date range notes:**
- Maximum 2 years of historical data available
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- ⚠️ **Data lag: Facebook insights are delayed by approximately 3 days** - request dates at least 3 days in the past
- Response includes data for all locations with active Facebook integrations

**Example use case:**
"Show me total Facebook page views and engagement for all our location pages last quarter compared to the previous quarter"`,
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-01")'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format (e.g., "2024-01-31")'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total (all data summed into one period)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ from, to, format, aggregation }: { from: string; to: string; format?: 'json' | 'markdown'; aggregation?: AggregationLevel }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/facebook?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(url),
        format || 'markdown',
        {
          aggregation: aggregation || 'total',
          errorMessage: `Unable to fetch Facebook insights for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Facebook Page integrations
3. Check if the date range is within the last 2 years
4. Ensure dates are valid and 'from' date is before 'to' date
5. Facebook insights may take 24-48 hours to become available for recent dates

**Common issues:**
- No locations in account have Facebook Pages connected
- Account ID is incorrect
- Date range too far in the past (>2 years)
- All locations have disconnected Facebook integrations
- Dates in wrong format (must be YYYY-MM-DD)

Try using get_locations first to verify you have locations with the 'fb' field populated.`,
          markdownFormatter: (data, agg) => formatInsightsMarkdown('Facebook (All Locations)', data, undefined, agg)
        }
      );
    }
  );
}

export const getAllFacebookBrandpageInsights = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_all_facebook_brandpage_insights',
    `Fetch Facebook Page performance metrics for brand pages (company-level pages, not location-specific).

Returns Facebook insights for brand/corporate pages including:
- **Page impressions**: Total (page_impressions), unique (page_impressions_unique), organic (page_impressions_organic, page_impressions_organic_unique), paid (page_impressions_paid, page_impressions_paid_unique)
- **Engagement**: Total page actions (page_total_actions)
- **Followers**: New likes (page_fan_adds), unlikes (page_fan_removes), total fans (page_fans)

**When to use this tool:**
- Analyzing corporate/brand Facebook Page performance (not location pages)
- Tracking brand-level social media engagement
- Measuring effectiveness of company-wide Facebook campaigns
- Monitoring brand page follower growth
- Comparing brand page performance to location pages

**vs. get_all_facebook_insights:**
- Use this tool for: Corporate brand page metrics, company-wide social strategy
- Use get_all_facebook_insights for: Location-specific pages, store-level performance

**Workflow:**
1. Use this tool to get brand page metrics
2. Compare with get_all_facebook_insights to see location vs brand performance
3. Use for corporate marketing reporting and strategy

**Date range notes:**
- Maximum 2 years of historical data available
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- ⚠️ **Data lag: Facebook insights are delayed by approximately 3 days** - request dates at least 3 days in the past

**Example use case:**
"Show me our corporate Facebook brand page performance for Q4 to measure our company-wide social media campaign effectiveness"`,
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-01")'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format (e.g., "2024-01-31")'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)'),
      aggregation: z
        .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'])
        .optional()
        .default('total')
        .describe('Data aggregation level. Default: total (all data summed into one period)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ from, to, format, aggregation }: { from: string; to: string; format?: 'json' | 'markdown'; aggregation?: AggregationLevel }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const url = `${apiBaseUrl}/listings/v4/${accountId}/brand-page/insights/facebook?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(url),
        format || 'markdown',
        {
          aggregation: aggregation || 'total',
          errorMessage: `Unable to fetch Facebook brand page insights (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have a Facebook brand page configured in your account
3. Check if the date range is within the last 2 years
4. Ensure dates are valid and 'from' date is before 'to' date
5. Facebook insights may take 24-48 hours to become available

**Common issues:**
- No brand page configured (this is separate from location pages)
- Account ID is incorrect
- Brand page integration is disconnected
- Date range too far in the past (>2 years)
- Dates in wrong format (must be YYYY-MM-DD)

Note: Brand pages are company-level Facebook Pages, separate from individual location pages. If you only have location pages, use get_all_facebook_insights instead.`,
          markdownFormatter: (data, agg) => formatInsightsMarkdown('Facebook Brand Page', data, undefined, agg)
        }
      );
    }
  );
};

export const getAllFacebookRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_all_facebook_ratings',
    `Fetch Facebook customer ratings and reviews summary for ALL location pages in your account over a date range.

Returns aggregated Facebook ratings data across all locations including:
- **Average ratings**: Overall star rating across all location pages
- **Total recommendations**: Count of recommendations received in the date range
- **Rating distribution**: Breakdown of star ratings
- **Review velocity**: Rate of review acquisition over time
- **Response rate**: Percentage of recommendations with business responses

**When to use this tool:**
- Monitoring overall reputation across all Facebook location pages
- Tracking review acquisition trends across your business
- Identifying which locations may need attention for review management
- Monthly/quarterly reputation reporting
- Comparing review performance between time periods

**Workflow:**
1. Use this tool to get overall ratings metrics across all locations
2. Use get_facebook_location_ratings for specific locations with issues
3. Combine with get_locations to identify locations by name

**vs. get_facebook_location_ratings:**
- Use this tool for: Company-wide reputation overview, aggregate metrics, executive reports
- Use single location tool for: Individual location review management, specific store reputation analysis

**Date range notes:**
- Recommendations are dated by when they were posted
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Historical review data is typically available indefinitely
- Recent reviews may take 24-48 hours to sync

**Example use case:**
"Show me total Facebook recommendations and average rating across all locations for last quarter"`,
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-01")'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format (e.g., "2024-01-31")'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ from, to, format }: { from: string; to: string; format?: 'json' | 'markdown' }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(url),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Facebook ratings for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Facebook Page integrations
3. Ensure dates are valid and 'from' date is before 'to' date
4. Check that your locations have received reviews/recommendations

**Common issues:**
- No locations in account have Facebook Pages connected
- Account ID is incorrect
- No reviews/recommendations exist for this date range
- All locations have disconnected Facebook integrations
- Dates in wrong format (must be YYYY-MM-DD)

Note: This endpoint returns data only for locations that have reviews. If you have no reviews in the date range, an empty result is expected.`,
          markdownFormatter: (data) => formatRatingsMarkdown('Facebook (All Locations)', data)
        }
      );
    }
  );
};

export const getFacebookLocationRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_facebook_location_ratings',
    `Fetch Facebook customer ratings and recommendations details for a specific location over a date range.

Returns detailed Facebook ratings data for one location including:
- **Average rating**: Star rating for the location in the period
- **Individual recommendations**: Full recommendation text and customer feedback
- **Recommendation timestamps**: When recommendations were posted
- **Business responses**: Owner replies to recommendations (if any)
- **Recommender information**: Basic details about customers who left feedback

**When to use this tool:**
- Deep-diving into reviews for a specific location's Facebook Page
- Responding to customer feedback for a particular store
- Analyzing sentiment and themes in Facebook recommendations for one location
- Investigating sudden rating changes at a specific location
- Preparing for review response campaigns

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool to get review details for that location
3. For overview across all locations, use get_all_facebook_ratings instead

**vs. get_all_facebook_ratings:**
- Use this tool for: Individual location review management, detailed review analysis, responding to specific reviews
- Use all locations tool for: Company-wide metrics, executive reporting, identifying problem locations

**Date range notes:**
- Recommendations are dated by when they were posted
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Historical review data is typically available indefinitely
- Recent reviews may take 24-48 hours to sync

**Example use case:**
"Get all Facebook recommendations for the downtown store from the last 30 days so I can identify common feedback themes"`,
    {
      storeId: z
        .string()
        .min(1)
        .describe('The PinMeTo store ID (use get_locations to find IDs)'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-01")'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
        .describe('End date in YYYY-MM-DD format (e.g., "2024-01-31")'),
      format: z
        .enum(['json', 'markdown'])
        .optional()
        .default('markdown')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({
      storeId,
      from,
      to,
      format
    }: {
      storeId: string;
      from: string;
      to: string;
      format?: 'json' | 'markdown';
    }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/facebook/${storeId}?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Facebook ratings for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using get_locations tool
2. Confirm the location has an active Facebook Page integration
3. Ensure dates are valid and 'from' date is before 'to' date
4. Check if this location has received any reviews/recommendations

**Common issues:**
- Location not yet synced with Facebook Pages
- Invalid storeId for this account
- No reviews/recommendations exist for this location in the date range
- Location's Facebook integration is disconnected
- Dates in wrong format (must be YYYY-MM-DD)

Note: This endpoint returns data only if reviews exist. An empty result means no reviews in the date range, which is normal for new or low-traffic locations.`,
          markdownFormatter: (data) => formatRatingsMarkdown('Facebook', data, storeId)
        }
      );
    }
  );
};
