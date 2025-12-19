import { z } from 'zod';
import { formatErrorResponse, formatListResponse } from '../../helpers';
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
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data)
          }
        ],
        structuredContent: { data: result.data }
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
  const LocationTypeEnum = z.enum(['location', 'serviceArea']);

  server.registerTool(
    'get_locations',
    {
      description:
        'Get location details with pagination and filtering. Uses in-memory cache (5-min TTL) for fast queries on large datasets.\n\nExamples:\n- Get first 50 locations: {}\n- Get next page: { offset: 50 }\n- Filter by city: { city: "Stockholm", limit: 20 }\n- Only open locations: { permanentlyClosed: false }\n- Force cache refresh: { forceRefresh: true }',
      inputSchema: {
        fields: z
          .array(FieldsEnum)
          .optional()
          .describe('Fields to include in the response (optional, defaults to all)'),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .optional()
          .default(50)
          .describe('Maximum results to return (default: 50, max: 1000)'),
        offset: z
          .number()
          .min(0)
          .optional()
          .default(0)
          .describe('Number of results to skip (default: 0)'),
        permanentlyClosed: z.boolean().optional().describe('Filter by permanently closed status'),
        type: LocationTypeEnum.optional().describe('Filter by location type'),
        city: z.string().optional().describe('Filter by city name (case-insensitive)'),
        country: z.string().optional().describe('Filter by country name (case-insensitive)'),
        forceRefresh: z
          .boolean()
          .optional()
          .default(false)
          .describe('Force cache refresh (bypasses 5-minute TTL)')
      },
      outputSchema: LocationsOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args: {
      fields?: (typeof validFieldsList)[number][];
      limit?: number;
      offset?: number;
      permanentlyClosed?: boolean;
      type?: 'location' | 'serviceArea';
      city?: string;
      country?: string;
      forceRefresh?: boolean;
    }) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const forceRefresh = args.forceRefresh ?? false;

      // 1. Get data from cache (or fetch if expired/forced)
      const cacheResult = await server.locationCache.getLocations(forceRefresh);
      const { data: allData, allPagesFetched, error, stale, staleAgeSeconds } = cacheResult;

      // Handle complete API failure (no data and no stale cache)
      if (allData.length === 0 && !allPagesFetched && error) {
        return formatErrorResponse(error, 'get_locations');
      }

      // 2. Apply filters
      let filtered = allData;
      if (args.permanentlyClosed !== undefined) {
        filtered = filtered.filter(loc => loc.permanentlyClosed === args.permanentlyClosed);
      }
      if (args.type) {
        filtered = filtered.filter(loc => loc.type === args.type);
      }
      if (args.city) {
        const cityLower = args.city.toLowerCase();
        filtered = filtered.filter(loc => (loc.address?.city || '').toLowerCase() === cityLower);
      }
      if (args.country) {
        const countryLower = args.country.toLowerCase();
        filtered = filtered.filter(
          loc => (loc.address?.country || '').toLowerCase() === countryLower
        );
      }

      // 3. Apply field selection (if specified)
      if (args.fields && args.fields.length > 0) {
        filtered = filtered.map(loc => {
          const result: Record<string, unknown> = {};
          for (const field of args.fields!) {
            if (loc[field] !== undefined) result[field] = loc[field];
          }
          return result;
        });
      }

      // 4. Calculate pagination
      const totalCount = filtered.length;
      const paginatedData = filtered.slice(offset, offset + limit);
      const hasMore = totalCount > offset + limit;

      // 5. Get cache info
      const cacheInfo = server.locationCache.getCacheInfo();

      // 6. Build warning message based on data freshness and completeness
      let warning: string | undefined;
      if (stale && staleAgeSeconds !== undefined) {
        warning = `CAUTION: Returning stale cached data (${staleAgeSeconds}s old) due to API failure. Use forceRefresh: true to retry.`;
      } else if (!allPagesFetched) {
        warning = 'Data may be incomplete due to API pagination errors. Use forceRefresh: true to retry.';
      }

      // Include error info if we're returning stale data
      const responseText = stale
        ? `${formatListResponse(paginatedData, allPagesFetched)}\n\nWARNING: ${warning}`
        : formatListResponse(paginatedData, allPagesFetched);

      return {
        content: [{ type: 'text', text: responseText }],
        structuredContent: {
          data: paginatedData,
          totalCount,
          hasMore,
          offset,
          limit,
          incomplete: !allPagesFetched,
          warning,
          // Include error info whenever there's an error (stale cache OR partial pagination failure)
          ...(error ? { errorCode: error.code, retryable: error.retryable } : {}),
          cacheInfo: {
            cached: cacheInfo.cached,
            ageSeconds: cacheInfo.age,
            totalCached: cacheInfo.size,
            stale
          }
        }
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

      // NOTE: search_locations intentionally bypasses LocationCache and fetches directly.
      // Rationale:
      // 1. Search only needs minimal fields (storeId, name, address) - cache stores full objects
      // 2. Search is a discovery tool - users expect fresh results to find new locations
      // 3. Search doesn't have stale-cache fallback - this is intentional to ensure accurate results
      // For bulk operations with resilience, use get_locations which uses the cached data.
      const fieldsParam = 'fields=storeId,name,locationDescriptor,address';
      const url = `${locationsApiBaseUrl}/v4/${accountId}/locations?pagesize=1000&${fieldsParam}`;
      const [data, areAllPagesFetched, lastError] = await server.makePaginatedPinMeToRequest(url);

      // Detect API failure: empty array + incomplete pagination = first page failed
      if (data.length === 0 && !areAllPagesFetched && lastError) {
        const errorMessage = `Failed for search query '${query}': ${lastError.message}`;
        return {
          content: [{ type: 'text', text: errorMessage }],
          structuredContent: {
            data: [],
            totalMatches: 0,
            hasMore: false,
            error: errorMessage,
            errorCode: lastError.code,
            retryable: lastError.retryable
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
