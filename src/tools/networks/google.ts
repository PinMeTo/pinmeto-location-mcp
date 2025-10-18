import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  truncateResponse,
  formatInsightsMarkdown,
  formatRatingsMarkdown,
  formatKeywordsMarkdown,
  handleToolResponse,
  AggregationLevel
} from '../../helpers';

export function getGoogleLocationInsights(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_google_location_insights',
    `Fetch Google Business Profile performance metrics for a specific location over a date range.

Returns comprehensive Google insights including:
- **Impressions**: Desktop search (BUSINESS_IMPRESSIONS_DESKTOP_SEARCH), mobile search (BUSINESS_IMPRESSIONS_MOBILE_SEARCH), desktop maps (BUSINESS_IMPRESSIONS_DESKTOP_MAPS), mobile maps (BUSINESS_IMPRESSIONS_MOBILE_MAPS)
- **Actions**: Direction requests (BUSINESS_DIRECTION_REQUESTS), phone calls (CALL_CLICKS), website clicks (WEBSITE_CLICKS)
- **Queries**: Search terms and categories that led customers to find your location
- **Photos**: Photo view counts and customer-uploaded photo metrics
- **Local posts**: Engagement metrics for Google posts

**When to use this tool:**
- Analyzing individual location performance on Google Business Profile
- Comparing time periods for a single location (e.g., month-over-month)
- Investigating drops or spikes in visibility or customer actions
- Understanding which search queries drive the most traffic
- Measuring effectiveness of Google Business Profile optimizations

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool with the storeId and date range
3. For comparing across multiple locations, use get_all_google_insights instead

**Date range notes:**
- Historical data available from **September 2021** or 18 months back, whichever is more recent
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- ⚠️ **Data lag: Google insights are delayed by approximately 10 days** - request dates at least 10 days in the past
- Longer date ranges provide better trend analysis

**Example use case:**
"Compare last month's Google performance to the previous month for the downtown store to see if our new photos improved engagement"`,
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
      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          aggregation: aggregation || 'total',
          errorMessage: `Unable to fetch Google insights for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using pinmeto_get_locations tool
2. Confirm the location has an active Google Business Profile integration
3. Check if the date range is after September 2021 or within the last 18 months
4. Ensure dates are valid and 'from' date is before 'to' date
5. Google insights may take 48-72 hours to become available for recent dates

**Common issues:**
- Location not yet synced with Google Business Profile
- Date range before September 2021 or >18 months in the past
- Invalid storeId for this account
- Location's Google integration is disconnected or pending
- Dates in wrong format (must be YYYY-MM-DD)

Try using pinmeto_get_location first to verify the location exists and has the 'google' field populated.`,
          markdownFormatter: (data, agg) => formatInsightsMarkdown('Google', data, storeId, agg)
        }
      );
    }
  );
}

export function getAllGoogleInsights(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_all_google_insights',
    `Fetch Google Business Profile performance metrics for ALL locations in your account over a date range.

Returns aggregated Google insights across all locations including:
- **Impressions**: Desktop search (BUSINESS_IMPRESSIONS_DESKTOP_SEARCH), mobile search (BUSINESS_IMPRESSIONS_MOBILE_SEARCH), desktop maps (BUSINESS_IMPRESSIONS_DESKTOP_MAPS), mobile maps (BUSINESS_IMPRESSIONS_MOBILE_MAPS)
- **Actions**: Direction requests (BUSINESS_DIRECTION_REQUESTS), phone calls (CALL_CLICKS), website clicks (WEBSITE_CLICKS)
- **Queries**: Top search terms across all locations
- **Photos**: Combined photo engagement metrics
- **Local posts**: Total post engagement across locations

**When to use this tool:**
- Getting a high-level overview of Google performance across your entire business
- Comparing overall performance between time periods
- Identifying top-performing locations by comparing against individual location insights
- Analyzing aggregate trends and patterns
- Monthly/quarterly reporting on Google Business Profile performance

**Workflow:**
1. Use this tool to get aggregate metrics for all locations
2. Use get_google_location_insights for specific locations that need deeper analysis
3. Combine with get_locations to map storeIds to location names

**vs. get_google_location_insights:**
- Use this tool for: Overall business performance, multi-location comparisons, executive summaries
- Use single location tool for: Individual location deep-dives, specific store performance analysis

**Date range notes:**
- Historical data available from **September 2021** or 18 months back, whichever is more recent
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- ⚠️ **Data lag: Google insights are delayed by approximately 10 days** - request dates at least 10 days in the past
- Response includes data for all locations with active Google integrations

**Example use case:**
"Show me total Google impressions and actions for all our locations last month compared to the previous month"`,
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
      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(url),
        format || 'markdown',
        {
          aggregation: aggregation || 'total',
          errorMessage: `Unable to fetch Google insights for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Google Business Profile integrations
3. Check if the date range is after September 2021 or within the last 18 months
4. Ensure dates are valid and 'from' date is before 'to' date
5. Google insights may take 48-72 hours to become available for recent dates

**Common issues:**
- No locations in account have Google Business Profile connected
- Account ID is incorrect
- Date range before September 2021 or >18 months in the past
- All locations have disconnected Google integrations
- Dates in wrong format (must be YYYY-MM-DD)

Try using pinmeto_get_locations first to verify you have locations with the 'google' field populated.`,
          markdownFormatter: (data, agg) => formatInsightsMarkdown('Google (All Locations)', data, undefined, agg)
        }
      );
    }
  );
}

export const getAllGoogleRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_all_google_ratings',
    `Fetch Google customer ratings and reviews summary for ALL locations in your account over a date range.

Returns aggregated Google ratings data across all locations including:
- **Average ratings**: Overall star rating across all locations
- **Total reviews**: Count of reviews received in the date range
- **Rating distribution**: Breakdown by star rating (5-star, 4-star, etc.)
- **Review velocity**: Rate of review acquisition over time
- **Response rate**: Percentage of reviews with business responses

**When to use this tool:**
- Monitoring overall reputation across all Google Business Profile locations
- Tracking review acquisition trends across your business
- Identifying which locations may need attention for review management
- Monthly/quarterly reputation reporting
- Comparing review performance between time periods

**Workflow:**
1. Use this tool to get overall ratings metrics across all locations
2. Use get_google_location_ratings for specific locations with issues
3. Combine with get_locations to identify locations by name

**vs. get_google_location_ratings:**
- Use this tool for: Company-wide reputation overview, aggregate metrics, executive reports
- Use single location tool for: Individual location review management, specific store reputation analysis

**Date range notes:**
- Reviews are dated by when they were posted, not when they occurred
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Historical review data is typically available indefinitely
- Recent reviews may take 24-48 hours to sync

**Example use case:**
"Show me total Google reviews and average rating across all locations for Q4 2024"`,
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
      const url = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(url),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Google ratings for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Google Business Profile integrations
3. Ensure dates are valid and 'from' date is before 'to' date
4. Check that your locations have received reviews

**Common issues:**
- No locations in account have Google Business Profile connected
- Account ID is incorrect
- No reviews exist for this date range
- All locations have disconnected Google integrations
- Dates in wrong format (must be YYYY-MM-DD)

Note: This endpoint returns data only for locations that have reviews. If you have no reviews in the date range, an empty result is expected.`,
          markdownFormatter: (data) => formatRatingsMarkdown('Google (All Locations)', data)
        }
      );
    }
  );
};

export const getGoogleLocationRatings = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_google_location_ratings',
    `Fetch Google customer ratings and reviews details for a specific location over a date range.

Returns detailed Google ratings data for one location including:
- **Average rating**: Star rating for the location in the period
- **Individual reviews**: Full review text, star ratings, and reviewer information
- **Review timestamps**: When reviews were posted
- **Business responses**: Owner replies to reviews (if any)
- **Reviewer photos**: Photos attached to reviews

**When to use this tool:**
- Deep-diving into reviews for a specific location
- Responding to customer feedback for a particular store
- Analyzing sentiment and themes in reviews for one location
- Investigating sudden rating changes at a specific location
- Preparing for review response campaigns

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool to get review details for that location
3. For overview across all locations, use get_all_google_ratings instead

**vs. get_all_google_ratings:**
- Use this tool for: Individual location review management, detailed review analysis, responding to specific reviews
- Use all locations tool for: Company-wide metrics, executive reporting, identifying problem locations

**Date range notes:**
- Reviews are dated by when they were posted
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Historical review data is typically available indefinitely
- Recent reviews may take 24-48 hours to sync

**Example use case:**
"Get all Google reviews for the downtown store from the last 30 days so I can identify common complaints"`,
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
      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/ratings/google/${storeId}?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Google ratings for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using get_locations tool
2. Confirm the location has an active Google Business Profile integration
3. Ensure dates are valid and 'from' date is before 'to' date
4. Check if this location has received any reviews

**Common issues:**
- Location not yet synced with Google Business Profile
- Invalid storeId for this account
- No reviews exist for this location in the date range
- Location's Google integration is disconnected
- Dates in wrong format (must be YYYY-MM-DD)

Note: This endpoint returns data only if reviews exist. An empty result means no reviews in the date range, which is normal for new or low-traffic locations.`,
          markdownFormatter: (data) => formatRatingsMarkdown('Google', data, storeId)
        }
      );
    }
  );
};

export const getAllGoogleKeywords = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_google_keywords',
    `Fetch Google search keywords and queries that led customers to ALL locations in your account.

Returns keyword data aggregated across all locations including:
- **Search terms** (keyword): Actual keywords customers used to find your locations
- **Impression counts** (value): How many times each keyword led to your listing appearing
- **Location coverage** (locationCounts): Number of locations that received traffic from each keyword

**When to use this tool:**
- Understanding how customers discover your business on Google
- SEO and local search optimization
- Identifying brand awareness gaps
- Content strategy for Google Business Profile posts
- Comparing keyword performance across time periods

**Workflow:**
1. Use this tool to get overall keyword trends across all locations
2. Use get_google_keywords_for_location for location-specific keyword analysis
3. Combine with get_all_google_insights to correlate keywords with actions

**vs. get_google_keywords_for_location:**
- Use this tool for: Company-wide search trends, aggregate keyword analysis, SEO strategy
- Use single location tool for: Location-specific optimization, local keyword research

**Date format (IMPORTANT):**
- Keywords use **YYYY-MM** format (month granularity only), unlike other tools
- Example: "2024-01" for January 2024, "2024-12" for December 2024
- Data aggregated by full calendar months
- Historical data available from **August 2023** or when the location was created, whichever is more recent
- ⚠️ **Keywords are updated monthly** - data for a given month becomes available a few days after the month ends

**Example use case:**
"What are the top Google search keywords that brought customers to our locations in Q4 2024?"`,
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format')
        .describe('Start month in YYYY-MM format (e.g., "2024-01" for January 2024)'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format')
        .describe('End month in YYYY-MM format (e.g., "2024-12" for December 2024)'),
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
      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Google keywords for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Google Business Profile integrations
3. Check date format is YYYY-MM (month only, not YYYY-MM-DD)
4. Ensure 'from' month is before or equal to 'to' month
5. Verify date range is after August 2023 or when the location was created

**Common issues:**
- Wrong date format (must be YYYY-MM, e.g., "2024-01")
- No locations have Google Business Profile connected
- Date range before August 2023 or before location creation
- Account ID is incorrect
- Keyword data takes longer to sync (48-72 hours delay)

Note: Keyword data is aggregated monthly and may not be available for very recent months or very new locations.`,
          markdownFormatter: (data) => formatKeywordsMarkdown(data)
        }
      );
    }
  );
};

export const getGoogleKeywordsForLocation = (server: PinMeToMcpServer) => {
  server.tool(
    'pinmeto_get_google_keywords_for_location',
    `Fetch Google search keywords and queries that led customers to a specific location.

Returns keyword data for one location including:
- **Search terms** (keyword): Actual keywords customers used to find this location
- **Impression counts** (value): How many times each keyword led to this listing appearing

**When to use this tool:**
- Optimizing Google Business Profile for a specific location
- Understanding local search behavior at one store
- Identifying location-specific keyword opportunities
- Comparing keywords between locations
- Local SEO strategy for individual stores

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool to get keyword data for that location
3. Compare with get_google_keywords (all locations) to see how this location's keywords differ

**vs. get_google_keywords:**
- Use this tool for: Location-specific SEO, individual store optimization, local keyword research
- Use all locations tool for: Company-wide search trends, aggregate keyword strategy

**Date format (IMPORTANT):**
- Keywords use **YYYY-MM** format (month granularity only), unlike other tools
- Example: "2024-01" for January 2024, "2024-12" for December 2024
- Data aggregated by full calendar months
- Historical data available from **August 2023** or when the location was created, whichever is more recent
- ⚠️ **Keywords are updated monthly** - data for a given month becomes available a few days after the month ends

**Example use case:**
"What search terms are customers using to find our downtown location on Google in the last 6 months?"`,
    {
      storeId: z
        .string()
        .min(1)
        .describe('The PinMeTo store ID (use get_locations to find IDs)'),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format')
        .describe('Start month in YYYY-MM format (e.g., "2024-01" for January 2024)'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format')
        .describe('End month in YYYY-MM format (e.g., "2024-12" for December 2024)'),
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
      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/insights/google-keywords/${storeId}?from=${from}&to=${to}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch Google keywords for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using get_locations tool
2. Confirm the location has an active Google Business Profile integration
3. Check date format is YYYY-MM (month only, not YYYY-MM-DD)
4. Ensure 'from' month is before or equal to 'to' month
5. Verify date range is after September 2021 or within last 18 months

**Common issues:**
- Wrong date format (must be YYYY-MM, e.g., "2024-01")
- Location not synced with Google Business Profile
- Invalid storeId for this account
- Date range before September 2021 or >18 months in the past
- Location is new and has no keyword data yet
- Keyword data takes 48-72 hours to sync

Note: Keyword data is aggregated monthly and requires sufficient search volume. New or low-traffic locations may not have keyword data.`,
          markdownFormatter: (data) => formatKeywordsMarkdown(data, storeId)
        }
      );
    }
  );
};
