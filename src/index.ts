import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import {
  makePmtRequest,
  makePaginatedPmtRequest,
  formatListResponse,
} from "./helpers";

dotenv.config({ path: ".env" });

const server = new McpServer({
  name: "PinMeTo-MCP",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "get_location",
  "Get location details for a store from PinMeTo API",
  {
    storeId: z.string().describe("The store ID to look up"),
  },
  async ({ storeId }) => {
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

    const locationUrl = `${apiUrl}/listings/v3/${accountId}/locations/${storeId}`;
    const locationData = await makePmtRequest(locationUrl);

    if (!locationData) {
      return {
        content: [
          {
            type: "text",
            text: "Unable to fetch location data.",
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

server.tool(
  "get_locations",
  "Get all location details for the site from PinMeTo API. Use this to find store ids for locations.",
  {},
  async () => {
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
    const url = `${apiUrl}/listings/v3/${accountId}/locations?pagesize=100`;
    const [data, areAllPagesFetched] = await makePaginatedPmtRequest(url);
    if (!data || data.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Unable to fetch location data.",
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: formatListResponse(data, areAllPagesFetched),
        },
      ],
    };
  }
);

server.tool(
  "get_google_location_insights",
  "Fetch Google metrics for a single location belonging to a specific account.",
  {
    storeId: z.string().describe("The store ID to look up"),
    from: z.string().describe("	The start date format YYYY-MM-DD"),
    to: z.string().describe("	The end date format YYYY-MM-DD"),
  },
  async ({ storeId, from, to }) => {
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
            text: "Unable to fetch location data.",
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

server.tool(
  "get_all_google_insights",
  "Fetch Google metrics for all locations belonging to a specific account.",
  {
    from: z.string().describe("	The start date format YYYY-MM-DD"),
    to: z.string().describe("	The end date format YYYY-MM-DD"),
  },
  async ({ from, to }) => {
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
    const url = `${apiUrl}/listings/v4/${accountId}/locations/insights/google`;
    const insightsData = await makePmtRequest(url, from, to);
    if (!insightsData) {
      return {
        content: [
          {
            type: "text",
            text: "Unable to fetch location data.",
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

async function main() {
  dotenv.config({ path: ".env" });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PinMeTo MCP running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
