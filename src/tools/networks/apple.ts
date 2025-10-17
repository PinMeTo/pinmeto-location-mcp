import { z } from 'zod';
import { PinMeToMcpServer } from '../../mcp_server';
import { truncateResponse, formatInsightsMarkdown } from '../../helpers';

export function getAppleLocationInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_apple_location_insights',
    `Fetch Apple Maps performance metrics for a specific location over a date range.

Returns comprehensive Apple Maps insights including:
- **Impressions**: How many times your location appeared in Apple Maps searches
- **Actions**: Customer actions (directions requests, phone calls, website taps)
- **Views**: Map views and location card views
- **Engagement**: Interactions with your Apple Maps listing
- **Devices**: Breakdown by iPhone, iPad, Mac usage

**When to use this tool:**
- Analyzing individual location performance on Apple Maps
- Comparing time periods for a single location (e.g., month-over-month)
- Investigating drops or spikes in Apple Maps visibility
- Understanding Apple ecosystem user behavior for a specific store
- Measuring effectiveness of Apple Maps Connect optimizations

**Workflow:**
1. Use get_locations first to find the storeId (if you don't know it)
2. Use this tool with the storeId and date range
3. For comparing across multiple locations, use get_all_apple_insights instead

**Date range notes:**
- Historical data availability depends on when Apple integration was activated
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Insights are typically available 48-72 hours after the date
- Apple Maps insights may have more limited history than Google/Facebook

**Example use case:**
"Compare last month's Apple Maps performance to the previous month for the downtown store to see if our updated photos improved engagement"`,
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
        .default('json')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
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

      const locationUrl = `${apiBaseUrl}/listings/v4/${accountId}/locations/${storeId}/insights/apple?from=${from}&to=${to}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: `Unable to fetch Apple Maps insights for storeId "${storeId}" (${from} to ${to}).

**Troubleshooting steps:**
1. Verify the storeId exists using get_locations tool
2. Confirm the location has Apple Maps integration active
3. Check if the date range is within available historical data
4. Ensure dates are valid and 'from' date is before 'to' date
5. Apple Maps insights may take 48-72 hours to become available for recent dates

**Common issues:**
- Location not yet synced with Apple Maps Connect
- Date range before Apple integration was activated
- Invalid storeId for this account
- Location's Apple integration is disconnected or pending
- Dates in wrong format (must be YYYY-MM-DD)
- Apple Maps data not yet available for this location

Try using get_location first to verify the location exists. Note: Apple Maps integration may not be available for all locations depending on your PinMeTo plan.`
            }
          ]
        };
      }

      if (format === 'markdown') {
        return {
          content: [
            {
              type: 'text',
              text: formatInsightsMarkdown('Apple Maps', locationData, storeId)
            }
          ]
        };
      }

      const [responseText] = truncateResponse(locationData);
      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    }
  );
}

export function getAllAppleInsights(server: PinMeToMcpServer) {
  server.tool(
    'get_all_apple_insights',
    `Fetch Apple Maps performance metrics for ALL locations in your account over a date range.

Returns aggregated Apple Maps insights across all locations including:
- **Impressions**: Total visibility across Apple Maps for all locations
- **Actions**: Aggregated customer actions (directions, calls, website taps)
- **Views**: Combined map views and location card views
- **Engagement**: Total interactions with Apple Maps listings
- **Devices**: Device breakdown (iPhone, iPad, Mac) across all locations

**When to use this tool:**
- Getting a high-level overview of Apple Maps performance across your entire business
- Comparing overall performance between time periods
- Understanding Apple ecosystem reach across all locations
- Monthly/quarterly reporting on Apple Maps performance
- Analyzing aggregate trends for iOS/macOS users

**Workflow:**
1. Use this tool to get aggregate metrics for all locations
2. Use get_apple_location_insights for specific locations that need deeper analysis
3. Combine with get_locations to map storeIds to location names

**vs. get_apple_location_insights:**
- Use this tool for: Overall business performance on Apple Maps, multi-location comparisons, executive summaries
- Use single location tool for: Individual location deep-dives, specific store performance analysis

**Date range notes:**
- Historical data availability depends on when Apple integration was activated
- Use YYYY-MM-DD format (e.g., "2024-01-15")
- Insights typically available 48-72 hours after the date
- Response includes data for all locations with active Apple Maps integrations

**Example use case:**
"Show me total Apple Maps impressions and actions for all our locations last quarter to understand our iOS/macOS customer reach"`,
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
        .default('json')
        .describe('Response format: json (raw data) or markdown (human-readable summary)')
    },
    async ({ from, to, format }: { from: string; to: string; format?: 'json' | 'markdown' }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v4/${accountId}/locations/insights/apple?from=${from}&to=${to}`;
      const insightsData = await server.makePinMeToRequest(url);
      if (!insightsData) {
        return {
          content: [
            {
              type: 'text',
              text: `Unable to fetch Apple Maps insights for all locations (${from} to ${to}).

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm you have locations with active Apple Maps integrations
3. Check if the date range is within available historical data
4. Ensure dates are valid and 'from' date is before 'to' date
5. Apple Maps insights may take 48-72 hours to become available for recent dates

**Common issues:**
- No locations in account have Apple Maps integration active
- Account ID is incorrect
- Date range before Apple integrations were activated
- All locations have disconnected Apple integrations
- Dates in wrong format (must be YYYY-MM-DD)
- Apple Maps feature not included in your PinMeTo plan

Try using get_locations first to verify you have locations. Note: Apple Maps integration may not be available for all PinMeTo accounts or plans.`
            }
          ]
        };
      }

      if (format === 'markdown') {
        return {
          content: [
            {
              type: 'text',
              text: formatInsightsMarkdown('Apple Maps (All Locations)', insightsData)
            }
          ]
        };
      }

      const [responseText] = truncateResponse(insightsData);
      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    }
  );
}
