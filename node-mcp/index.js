#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import {
  makePmtRequest,
  makePaginatedPmtRequest,
  formatListResponse,
} from "./src/helpers.js";
import { getPmtAccessToken } from "./src/token.js";

// Load environment variables
dotenv.config();

// Global variables
let PMT_API_URL;
let ACCOUNT_ID;

/**
 * Get location details for a store from PinMeTo API.
 * @param {string} storeId - The store ID to look up.
 */
async function getLocation(storeId) {
  if (!PMT_API_URL || !ACCOUNT_ID) {
    return "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable.";
  }

  const url = `${PMT_API_URL}/listings/v3/${ACCOUNT_ID}/locations/${storeId}`;
  const data = await makePmtRequest(url);

  if (!data) {
    return "Unable to fetch location data.";
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Get all location details for the site from PinMeTo API.
 * You can use this endpoint to find store ids for locations, used in other calls.
 */
async function getLocations() {
  if (!PMT_API_URL || !ACCOUNT_ID) {
    return "Missing PINMETO_API_URL or PINMETO_ACCOUNT_ID environment variable.";
  }

  const url = `${PMT_API_URL}/listings/v3/${ACCOUNT_ID}/locations?pagesize=100`;
  const [data, areAllPagesFetched] = await makePaginatedPmtRequest(url);

  if (!data) {
    return "Unable to fetch location data.";
  }

  return formatListResponse(data, areAllPagesFetched);
}

/**
 * Create and configure the MCP server
 */
async function createServer() {
  const server = new Server(
    {
      name: "pinmeto-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_location",
          description: "Get location details for a store from PinMeTo API.",
          inputSchema: {
            type: "object",
            properties: {
              store_id: {
                type: "string",
                description: "The store ID to look up.",
              },
            },
            required: ["store_id"],
          },
        },
        {
          name: "get_locations",
          description:
            "Get all location details for the site from PinMeTo API. You can use this endpoint to find store ids for locations, used in other calls.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;
      switch (name) {
        case "get_location":
          if (!args.store_id) {
            throw new Error("store_id is required");
          }
          result = await getLocation(args.store_id);
          break;

        case "get_locations":
          result = await getLocations();
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main function to start the server
 */
async function main() {
  // Initialize token and environment variables
  try {
    const token = await getPmtAccessToken();
    PMT_API_URL = process.env.PINMETO_API_URL;
    ACCOUNT_ID = process.env.PINMETO_ACCOUNT_ID;

    if (!PMT_API_URL || !ACCOUNT_ID) {
      throw new Error(
        "Missing required environment variables: PINMETO_API_URL, PINMETO_ACCOUNT_ID"
      );
    }
  } catch (error) {
    console.error("Failed to initialize:", error.message);
    process.exit(1);
  }

  // Create and start the server
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Handle cleanup
process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.exit(0);
});

// Start the server
main().catch((error) => {
  process.exit(1);
});
