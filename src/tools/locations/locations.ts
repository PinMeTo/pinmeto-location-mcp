import { z } from 'zod';
import { formatListResponse } from '../../helpers';
import { PinMeToMcpServer } from '../../mcp_server';

export function getLocation(server: PinMeToMcpServer) {
  server.registerTool(
    'get_location',
    {
      description: 'Get location details for a store from PinMeTo API',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up')
      },
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
        'Get all location details for the site from PinMeTo API. Use this to find store ids for locations.',
      inputSchema: {
        fields: z
          .array(FieldsEnum)
          .optional()
          .describe('Fields to include in the response (optional, defaults to all)')
      },
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
