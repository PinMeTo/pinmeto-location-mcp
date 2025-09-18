import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import dotenv from "dotenv";
import { getLocationsTool, getLocationTool } from "./tools/locations/locations";
import {
  getAllGoogleInsights,
  getAllGoogleRatings,
  getGoogleLocationInsights,
  getGoogleLocationRatings,
} from "./tools/networks/google";
import {
  getAllFacebookBrandpageInsights,
  getAllFacebookInsights,
  getAllFacebookRatings,
  getFacebookLocationRatings,
  getFacebookLocationsInsights,
} from "./tools/networks/facebook";
import {
  getAllAppleInsights,
  getAppleLocationInsights,
} from "./tools/networks/apple";

export function createMcpServer() {
  dotenv.config({ path: ".env" });

  const server = new McpServer({
    name: "PinMeTo-MCP",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  // Locations
  getLocationTool(server);
  getLocationsTool(server);

  // Google
  getGoogleLocationInsights(server);
  getAllGoogleInsights(server);
  getAllGoogleRatings(server);
  getGoogleLocationRatings(server);

  // Facebook
  getAllFacebookBrandpageInsights(server);
  getFacebookLocationsInsights(server);
  getAllFacebookInsights(server);
  getAllFacebookRatings(server);
  getFacebookLocationRatings(server);

  // Apple
  getAppleLocationInsights(server);
  getAllAppleInsights(server);

  return server;
}
