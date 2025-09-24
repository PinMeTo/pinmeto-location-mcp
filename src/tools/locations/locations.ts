import { z } from 'zod';
import { formatListResponse } from '../../helpers';
import { PinMeToMcpServer } from '../../mcp_server';

export function getLocation(server: PinMeToMcpServer) {
  server.tool(
    'get_location',
    'Get location details for a store from PinMeTo API',
    {
      storeId: z.string().describe('The store ID to look up')
    },
    async ({ storeId }: { storeId: string }) => {
      const { apiBaseUrl, accountId } = server.configs;

      const locationUrl = `${apiBaseUrl}/listings/v3/${accountId}/locations/${storeId}`;
      const locationData = await server.makePinMeToRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch location data.'
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(locationData)
          }
        ]
      };
    }
  );
}

export function getLocations(server: PinMeToMcpServer) {
  server.tool(
    'get_locations',
    'Get all location details for the site from PinMeTo API. Use this to find store ids for locations.',
    {},
    async () => {
      const { apiBaseUrl, accountId } = server.configs;

      const url = `${apiBaseUrl}/listings/v3/${accountId}/locations?pagesize=100`;
      const [data, areAllPagesFetched] = await server.makePaginatedPinMeToRequest(url);
      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Unable to fetch location data.'
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
