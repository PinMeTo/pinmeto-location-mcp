import { z } from 'zod';
import { formatErrorResponse, formatContent } from '../../helpers';
import { PinMeToMcpServer } from '../../mcp_server';
import {
  LocationOutputSchema,
  LocationsOutputSchema,
  SearchResultOutputSchema,
  ResponseFormatSchema,
  ResponseFormat
} from '../../schemas/output';
import {
  formatLocationAsMarkdown,
  formatLocationsListAsMarkdown,
  formatSearchResultsAsMarkdown
} from '../../formatters';

export function getLocation(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_get_location',
    {
      description:
        'Get details for a SINGLE location by store ID. Returns structured location data including address, contact info, and network connections.\n\n' +
        'Error Handling:\n' +
        '  - Not found (404): errorCode="NOT_FOUND" if store ID doesn\'t exist\n' +
        '  - Auth failure (401): errorCode="AUTH_INVALID_CREDENTIALS"\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up'),
        response_format: ResponseFormatSchema
      },
      outputSchema: LocationOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      storeId,
      response_format = 'json'
    }: {
      storeId: string;
      response_format?: ResponseFormat;
    }) => {
      const { locationsApiBaseUrl, accountId } = server.configs;

      const locationUrl = `${locationsApiBaseUrl}/v4/${accountId}/locations/${storeId}`;
      const result = await server.makePinMeToRequest(locationUrl);

      if (!result.ok) {
        return formatErrorResponse(result.error, `storeId '${storeId}'`);
      }

      const textContent = formatContent(result.data, response_format, formatLocationAsMarkdown);

      return {
        content: [{ type: 'text', text: textContent }],
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
    'pinmeto_get_locations',
    {
      description:
        'Get ALL locations with pagination and filtering. Uses in-memory cache (5-min TTL) for fast queries on large datasets.\n\n' +
        'Examples:\n' +
        '- Get first 50 locations: {}\n' +
        '- Get next page: { offset: 50 }\n' +
        '- Filter by city: { city: "Stockholm", limit: 20 }\n' +
        '- Only open locations: { permanentlyClosed: false }\n' +
        '- Force cache refresh: { forceRefresh: true }\n\n' +
        'Error Handling:\n' +
        '  - Partial results may be returned on API errors (check incomplete field)\n' +
        '  - Stale cache data returned with warning if fresh fetch fails\n' +
        '  - Check errorCode (string) and retryable (boolean) in structuredContent',
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
          .describe('Force cache refresh (bypasses 5-minute TTL)'),
        response_format: ResponseFormatSchema
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
      response_format?: ResponseFormat;
    }) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const forceRefresh = args.forceRefresh ?? false;

      // 1. Get data from cache (or fetch if expired/forced)
      const cacheResult = await server.locationCache.getLocations(forceRefresh);
      const { data: allData, allPagesFetched, error, stale, staleAgeSeconds } = cacheResult;

      // Handle complete API failure (no data and no stale cache)
      if (allData.length === 0 && !allPagesFetched && error) {
        return formatErrorResponse(error, 'pinmeto_get_locations');
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
      let errorMessage: string | undefined;
      if (stale && staleAgeSeconds !== undefined && error) {
        warning = `CAUTION: Returning stale cached data (${staleAgeSeconds}s old) due to API failure. Use forceRefresh: true to retry.`;
        // Set error field explicitly so AI agents can detect staleness programmatically
        errorMessage = `Data is stale due to API failure: ${error.code} - ${error.message}`;
      } else if (!allPagesFetched && error) {
        // Include specific error details in pagination warning
        warning = `Data may be incomplete (${error.code}: ${error.message}). Use forceRefresh: true to retry.`;
      } else if (!allPagesFetched) {
        warning =
          'Data may be incomplete due to API pagination errors. Use forceRefresh: true to retry.';
      }

      // Build structured content
      const structuredContent = {
        data: paginatedData,
        totalCount,
        hasMore,
        offset,
        limit,
        incomplete: !allPagesFetched,
        warning,
        ...(errorMessage ? { error: errorMessage } : {}),
        ...(error ? { errorCode: error.code, retryable: error.retryable } : {}),
        cacheInfo: {
          cached: cacheInfo.cached,
          ageSeconds: cacheInfo.age,
          totalCached: cacheInfo.size,
          stale
        }
      };

      // Format response text based on response_format
      const response_format = args.response_format ?? 'json';
      let responseText: string;

      if (response_format === 'markdown') {
        responseText = formatLocationsListAsMarkdown({
          data: paginatedData,
          totalCount,
          hasMore,
          offset,
          limit,
          cacheInfo: structuredContent.cacheInfo
        });
        if (warning) {
          responseText += `\n\n**Warning:** ${warning}`;
        }
      } else {
        responseText = JSON.stringify(paginatedData);
        if (stale && warning) {
          responseText += `\n\nWARNING: ${warning}`;
        }
      }

      // Add isStale at top level for easier detection by AI clients
      // Note: isError is NOT set because we ARE returning data (albeit stale)
      return {
        ...(stale ? { isStale: true } : {}),
        content: [{ type: 'text', text: responseText }],
        structuredContent
      };
    }
  );
}

export function searchLocations(server: PinMeToMcpServer) {
  server.registerTool(
    'pinmeto_search_locations',
    {
      description:
        'Search ALL locations by name, address, store ID, or location descriptor. Returns lightweight results for quick discovery. Use pinmeto_get_location with storeId for full details.\n\n' +
        'Error Handling:\n' +
        '  - Network issues: errorCode="NETWORK_ERROR", retryable=true\n' +
        '  - Auth failure (401): errorCode="AUTH_INVALID_CREDENTIALS"\n' +
        '  - All errors: check structuredContent.errorCode and .retryable for programmatic handling',
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
          .describe('Maximum results to return (default: 20, max: 100)'),
        response_format: ResponseFormatSchema
      },
      outputSchema: SearchResultOutputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      query,
      limit = 20,
      response_format = 'json'
    }: {
      query: string;
      limit?: number;
      response_format?: ResponseFormat;
    }) => {
      const { locationsApiBaseUrl, accountId } = server.configs;

      // NOTE: pinmeto_search_locations intentionally bypasses LocationCache and fetches directly.
      // Rationale:
      // 1. Search only needs minimal fields (storeId, name, address) - cache stores full objects
      // 2. Search is a discovery tool - users expect fresh results to find new locations
      // 3. Search doesn't have stale-cache fallback - this is intentional to ensure accurate results
      // For bulk operations with resilience, use pinmeto_get_locations which uses the cached data.
      const fieldsParam = 'fields=storeId,name,locationDescriptor,address';
      const url = `${locationsApiBaseUrl}/v4/${accountId}/locations?pagesize=1000&${fieldsParam}`;
      const [data, areAllPagesFetched, lastError] = await server.makePaginatedPinMeToRequest(url);

      // Detect API failure: empty array + incomplete pagination = first page failed
      if (data.length === 0 && !areAllPagesFetched && lastError) {
        const errorMessage = `Error: Failed for search query '${query}': ${lastError.message}`;
        return {
          isError: true,
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

      const structuredContent = { data: results, totalMatches, hasMore };

      // Format response based on response_format
      let resultText: string;
      if (response_format === 'markdown') {
        resultText = formatSearchResultsAsMarkdown(structuredContent);
      } else {
        resultText =
          results.length === 0
            ? `No locations found matching "${query}".`
            : JSON.stringify(results);
      }

      return {
        content: [{ type: 'text', text: resultText }],
        structuredContent
      };
    }
  );
}
