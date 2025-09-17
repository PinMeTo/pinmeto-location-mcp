import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { getLocationsTool, getLocationTool } from "./tools/locations/locations";
import {
  getAllGoogleInsights,
  getGoogleLocationInsights,
} from "./tools/networks/google";
import {
  getAllFacebookBrandpageInsights,
  getAllFacebookInsights,
  getFacebookLocationsInsights,
} from "./tools/networks/facebook";
import {
  getAllAppleInsights,
  getAppleLocationInsights,
} from "./tools/networks/apple";

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

// Facebook
getAllFacebookBrandpageInsights(server);
getFacebookLocationsInsights(server);
getAllFacebookInsights(server);

// Apple
getAppleLocationInsights(server);
getAllAppleInsights(server);

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
