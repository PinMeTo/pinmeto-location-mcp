import { z } from 'zod';
import { formatListResponse } from '../../helpers';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  LocationOutputSchema,
  LocationsOutputSchema,
  SearchResultOutputSchema
} from '../../schemas/output';

export function getLocation(server: PinMeToMcpServer) {
  server.registerTool(
    'get_location',
    {
      description:
        'Get location details for a store from PinMeTo API. Returns structured location data including address, contact info, and network connections.',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up')
      },
      outputSchema: LocationOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ storeId }: { storeId: string }) => {
      const { locationsApiBaseUrl, accountId } = server.configs;

      const locationUrl = `${locationsApiBaseUrl}/v4/${accountId}/locations/${storeId}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch location data.'
            }
          ],
          structuredContent: { error: 'Unable to fetch location data.' }
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(locationData)
          }
        ],
        structuredContent: { data: locationData }
      };
    }
  );
}

export function getLocations(server: PinMeToMcpServer) {
  const validFieldsList = [
    '_id',
    'type',
    'site',
    'name',
    'location',
    'locationDescriptor',
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
  server.registerTool(
    'get_locations',
    {
      description:
        'Get all location details for the site from PinMeTo API. Use this to find store ids for locations. Returns an array of locations with pagination status.',
      inputSchema: {
        fields: z
          .array(FieldsEnum)
          .optional()
          .describe('Fields to include in the response (optional, defaults to all)')
      },
      outputSchema: LocationsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ fields }) => {
      let fieldsParam: string;

      if (!fields) {
        fieldsParam = '';
      } else {
        fieldsParam = `&fields=${fields.join(',')}`;
      }

      const { locationsApiBaseUrl, accountId } = server.configs;

      const url = `${locationsApiBaseUrl}/v4/${accountId}/locations?pagesize=1000${fieldsParam}`;
      const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(url);
      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch location data.'
            }
          ],
          structuredContent: {
            data: [],
            allPagesFetched: false,
            error: 'Unable to fetch location data.'
          }
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: formatListResponse(data, areAllPagesFetched)
          }
        ],
        structuredContent: { data, allPagesFetched: areAllPagesFetched }
      };
    }
  );
}

export function searchLocations(server: PinMeToMcpServer) {
  server.registerTool(
    'search_locations',
    {
      description:
        'Search for locations by name, address, store ID, or location descriptor. Returns lightweight results for quick discovery. Use get_location with storeId for full details.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            'Search query - matches against name, storeId, locationDescriptor, street, city, or country'
          ),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe('Maximum results to return (default: 20, max: 100)')
      },
      outputSchema: SearchResultOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ query, limit = 20 }: { query: string; limit?: number }) => {
      const { locationsApiBaseUrl, accountId } = server.configs;

      // Fetch only the fields we need for searching and display
      const fieldsParam = 'fields=storeId,name,locationDescriptor,address';
      const url = `${locationsApiBaseUrl}/v4/${accountId}/locations?pagesize=1000&${fieldsParam}`;
      const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(url);

      // Detect API failure: empty array + incomplete pagination = first page failed
      if (data.length === 0 && !areAllPagesFetched) {
        return {
          content: [{ type: 'text', text: 'Unable to fetch location data for search.' }],
          structuredContent: {
            data: [],
            totalMatches: 0,
            hasMore: false,
            error: 'Unable to fetch location data for search.'
          }
        };
      }

      // Case-insensitive substring matching
      const queryLower = query.toLowerCase();

      const matches = data.filter((location: any) => {
        const name = (location.name || '').toLowerCase();
        const storeId = (location.storeId || '').toLowerCase();
        const locationDescriptor = (location.locationDescriptor || '').toLowerCase();
        const street = (location.address?.street || '').toLowerCase();
        const city = (location.address?.city || '').toLowerCase();
        const country = (location.address?.country || '').toLowerCase();

        return (
          name.includes(queryLower) ||
          storeId.includes(queryLower) ||
          locationDescriptor.includes(queryLower) ||
          street.includes(queryLower) ||
          city.includes(queryLower) ||
          country.includes(queryLower)
        );
      });

      const totalMatches = matches.length;
      const hasMore = totalMatches > limit;
      const limitedMatches = matches.slice(0, limit);

      // Format results with address summary
      const results = limitedMatches.map((location: any) => {
        const address = location.address || {};
        const addressParts = [address.street, address.city, address.country].filter(Boolean);
        const addressSummary = addressParts.join(', ') || 'No address';

        return {
          storeId: location.storeId || '',
          name: location.name || '',
          locationDescriptor: location.locationDescriptor || undefined,
          addressSummary
        };
      });

      const resultText =
        results.length === 0
          ? `No locations found matching "${query}".`
          : `Found ${totalMatches} location(s) matching "${query}"${hasMore ? ` (showing first ${limit})` : ''}:\n${results.map((r: any) => `- ${r.name} (${r.storeId}): ${r.addressSummary}`).join('\n')}`;

      return {
        content: [{ type: 'text', text: resultText }],
        structuredContent: { data: results, totalMatches, hasMore }
      };
    }
  );
}
