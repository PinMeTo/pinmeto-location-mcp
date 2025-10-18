import { z } from 'zod';
import {
  formatListResponse,
  truncateResponse,
  formatLocationMarkdown,
  handleToolResponse
} from '../../helpers';
import { PinMeToMcpServer } from '../../mcp_server';

export function getLocation(server: PinMeToMcpServer) {
  server.tool(
    'pinmeto_get_location',
    `Retrieve comprehensive details for a specific PinMeTo location by storeId.

Returns complete location data including:
- Store identification and contact information (phone, email, website)
- Address and geographic coordinates
- Operating hours (regular, special, and holiday hours)
- Network integration status (Google Business Profile, Facebook, Apple Maps)
- Categories, attributes, and service items
- Custom data and business-specific fields

**When to use this tool:**
- When you need detailed information about a single location
- To verify location data before fetching network-specific insights
- To check if a location has active network integrations
- As a first step before using insight/rating tools

**Workflow example:**
1. Use get_locations first to find the storeId
2. Use this tool to get location details
3. Use network-specific tools (get_google_location_insights, etc.) with the same storeId

**Note:** If you don't know the storeId, use get_locations first to list all locations and their IDs.`,
    {
      storeId: z
        .string()
        .min(1)
        .describe('The PinMeTo store ID (use get_locations to find IDs)'),
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
    async ({ storeId, format }: { storeId: string; format?: 'json' | 'markdown' }) => {
      const { locationsApiBaseUrl, accountId } = server.configs;
      const locationUrl = `${locationsApiBaseUrl}/v4/${accountId}/locations/${storeId}`;

      return handleToolResponse(
        () => server.makePinMeToRequest(locationUrl),
        format || 'markdown',
        {
          errorMessage: `Unable to fetch location data for storeId "${storeId}".

**Troubleshooting steps:**
1. Verify the storeId exists using pinmeto_get_locations tool
2. Confirm you're using the correct PINMETO_ACCOUNT_ID
3. Check if the location is active in your PinMeTo account
4. Ensure the storeId format is correct (no extra spaces or characters)

**Common issues:**
- StoreId does not exist in this account
- Location has been deleted or deactivated
- Incorrect account configuration

Try using pinmeto_get_locations first to see all available locations and their storeIds.`,
          markdownFormatter: (data) => formatLocationMarkdown(data)
        }
      );
    }
  );
}

export function getLocations(server: PinMeToMcpServer) {
  const validFieldsList = [
    '_id',
    'type',
    'site',
    'name',
    'alternativeNames',
    'location',
    'locationDescriptor',
    'isActive',
    'storeId',
    'address',
    'openHours',
    'isAlwaysOpen',
    'specialOpenHours',
    'permanentlyClosed',
    'openingDate',
    'temporarilyClosedUntil',
    'temporarilyClosedMessage',
    'contact',
    'google',
    'fb',
    'networkCategories',
    'networkActionLinks',
    'networkAttributes',
    'networkServiceItems',
    'networkCustomName',
    'shortDescription',
    'longDescription',
    'customData',
    'wifiSsid',
    'serviceAreas'
  ] as const;
  const FieldsEnum = z.enum(validFieldsList);
  server.tool(
    'pinmeto_get_locations',
    `Retrieve a list of all locations in your PinMeTo account with optional field filtering.

This is the primary tool for discovering storeIds, which are required by most other tools. Returns a paginated list of all locations with customizable field selection.

**Common use cases:**
- Find storeIds for use in other tools (insights, ratings, etc.)
- Get overview of all locations in an account
- Filter to specific fields to reduce response size
- Identify active vs inactive locations

**Field filtering:**
Use the 'fields' parameter to limit response size when you only need specific information:
- Basic info: ['storeId', 'name', 'isActive']
- Contact: ['storeId', 'name', 'contact', 'address']
- Network status: ['storeId', 'name', 'google', 'fb']
- Omit fields parameter to get all available data

**Available fields:**
_id, type, site, name, alternativeNames, location, locationDescriptor, isActive, storeId, address, openHours, isAlwaysOpen, specialOpenHours, permanentlyClosed, openingDate, temporarilyClosedUntil, temporarilyClosedMessage, contact, google, fb, networkCategories, networkActionLinks, networkAttributes, networkServiceItems, networkCustomName, shortDescription, longDescription, customData, wifiSsid, serviceAreas

**Pagination:**
- Returns up to 1000 locations per page
- Use maxPages to limit response size (helpful for large accounts)
- Default behavior: fetches all pages automatically

**Typical workflow:**
1. Use this tool to get list of locations (often with fields=['storeId', 'name', 'isActive'])
2. Identify the location(s) you want to analyze
3. Use network-specific tools with the storeId(s) from step 1

**Performance tip:** For large accounts (100+ locations), use field filtering and maxPages to get faster responses.`,
    {
      fields: z
        .array(FieldsEnum)
        .optional()
        .describe(
          'Array of field names to include in response. Omit to get all fields. Examples: ["storeId", "name", "isActive"] for basic info, or ["storeId", "name", "contact", "address"] for contact details.'
        ),
      maxPages: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(
          'Maximum number of pages to fetch (1-10). Each page contains up to 1000 locations. Omit to fetch all pages. Use to limit response size for large accounts.'
        )
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    async ({ fields, maxPages }: { fields?: string[]; maxPages?: number }) => {
      let fieldsParam: string;

      if (!fields) {
        fieldsParam = '';
      } else {
        fieldsParam = `&fields=${fields.join(',')}`;
      }

      const { locationsApiBaseUrl, accountId } = server.configs;

      const url = `${locationsApiBaseUrl}/v4/${accountId}/locations?pagesize=1000${fieldsParam}`;
      const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(
        url,
        maxPages
      );
      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Unable to fetch location data.

**Troubleshooting steps:**
1. Verify your PINMETO_ACCOUNT_ID is correct
2. Confirm your account has active locations
3. Check that your API credentials have permission to access locations
4. Try without the fields parameter to ensure it's not a field name issue

**Common issues:**
- No locations exist in this account yet
- Account ID is incorrect
- API credentials lack necessary permissions
- Network connectivity issue with PinMeTo API

If your account should have locations, verify your configuration and try again.`
            }
          ]
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: formatListResponse(data, areAllPagesFetched)
          }
        ]
      };
    }
  );
}
