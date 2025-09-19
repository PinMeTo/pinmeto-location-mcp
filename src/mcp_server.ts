import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import dotenv from "dotenv";
import { getLocationsTool, getLocationTool } from "./tools/locations/locations";
import {
  getAllGoogleInsights,
  getAllGoogleKeywords,
  getAllGoogleRatings,
  getGoogleKeywordsForLocation,
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

import { analyzeLocationPrompt, summarizeAllInsightsPrompt } from "./prompts";

export function createMcpServer() {
  dotenv.config({ path: ".env" });

  const server = new McpServer({
    name: "PinMeTo-MCP",
    version: "1.0.0",
    capabilities: {
      prompts: {},
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
  getAllGoogleKeywords(server);
  getGoogleKeywordsForLocation(server);

  // Facebook
  getAllFacebookBrandpageInsights(server);
  getFacebookLocationsInsights(server);
  getAllFacebookInsights(server);
  getAllFacebookRatings(server);
  getFacebookLocationRatings(server);

  // Apple
  getAppleLocationInsights(server);
  getAllAppleInsights(server);

  // Prompts
  analyzeLocationPrompt(server);
  summarizeAllInsightsPrompt(server);

  return server;
}
