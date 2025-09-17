import { z } from "zod";
import { makePmtRequest } from "../../helpers";

export const getGoogleLocationInsights = (server: any) => {
  return server.tool(
    "get_google_location_insights",
    "Fetch Google metrics for a single location belonging to a specific account.",
    {
      storeId: z.string().describe("The store ID to look up"),
      from: z.string().describe("	The start date format YYYY-MM-DD"),
      to: z.string().describe("	The end date format YYYY-MM-DD"),
    },
    async ({
      storeId,
      from,
      to,
    }: {
      storeId: string;
      from: string;
      to: string;
    }) => {
      if (!process.env.PINMETO_API_URL || !process.env.PINMETO_ACCOUNT_ID) {
        return {
          content: [
            {
              type: "text",
              text: "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable.",
            },
          ],
        };
      }
      const apiUrl = process.env.PINMETO_API_URL;
      const accountId = process.env.PINMETO_ACCOUNT_ID;

      const locationUrl = `${apiUrl}/listings/v4/${accountId}/locations/${storeId}/insights/google?from=${from}&to=${to}`;
      const locationData = await makePmtRequest(locationUrl);

      if (!locationData) {
        return {
          content: [
            {
              type: "text",
              text: "Unable to fetch insights data.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(locationData),
          },
        ],
      };
    }
  );
};

export const getAllGoogleInsights = (server: any) => {
  return server.tool(
    "get_all_google_insights",
    "Fetch Google metrics for all locations belonging to a specific account.",
    {
      from: z.string().describe("The start date format YYYY-MM-DD"),
      to: z.string().describe("	The end date format YYYY-MM-DD"),
    },
    async ({ from, to }: { from: string; to: string }) => {
      if (!process.env.PINMETO_API_URL || !process.env.PINMETO_ACCOUNT_ID) {
        return {
          content: [
            {
              type: "text",
              text: "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable.",
            },
          ],
        };
      }
      const apiUrl = process.env.PINMETO_API_URL;
      const accountId = process.env.PINMETO_ACCOUNT_ID;
      const url = `${apiUrl}/listings/v4/${accountId}/locations/insights/google?from=${from}&to=${to}`;
      const insightsData = await makePmtRequest(url);
      if (!insightsData) {
        return {
          content: [
            {
              type: "text",
              text: "Unable to fetch insights data.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(insightsData),
          },
        ],
      };
    }
  );
};
