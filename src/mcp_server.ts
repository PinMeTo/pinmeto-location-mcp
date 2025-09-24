import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  InitializeRequestSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  LATEST_PROTOCOL_VERSION
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import os from 'os';
import { getLocations, getLocation } from './tools/locations/locations';
import {
  getAllGoogleInsights,
  getAllGoogleKeywords,
  getAllGoogleRatings,
  getGoogleKeywordsForLocation,
  getGoogleLocationInsights,
  getGoogleLocationRatings
} from './tools/networks/google';
import {
  getAllFacebookBrandpageInsights,
  getAllFacebookInsights,
  getAllFacebookRatings,
  getFacebookLocationRatings,
  getFacebookLocationsInsights
} from './tools/networks/facebook';
import { getAllAppleInsights, getAppleLocationInsights } from './tools/networks/apple';
import { analyzeLocationPrompt, summarizeAllInsightsPrompt } from './prompts';
import packageJson from '../package.json';

export function createMcpServer() {
  const serverInfo = {
    name: 'PinMeTo Location MCP',
    version: packageJson.version,
    capabilities: {
      prompts: {},
      resources: {},
      tools: {}
    }
  };
  const mcpServer = new McpServer(serverInfo);

  mcpServer.server.setRequestHandler(InitializeRequestSchema, async request => {
    // Set a custom User-Agent for all axios requests
    axios.defaults.headers.common['User-Agent'] =
      `${request.params.clientInfo.name}/${request.params.clientInfo.version} ${packageJson.name}-${packageJson.version} (${os.type()}; ${os.arch()}; ${os.release()})`;

    const requestedVersion = request.params.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : LATEST_PROTOCOL_VERSION;

    return {
      protocolVersion,
      capabilities: request.params.capabilities,
      serverInfo
    };
  });

  // Locations
  getLocation(mcpServer);
  getLocations(mcpServer);

  // Google
  getGoogleLocationInsights(mcpServer);
  getAllGoogleInsights(mcpServer);
  getAllGoogleRatings(mcpServer);
  getGoogleLocationRatings(mcpServer);
  getAllGoogleKeywords(mcpServer);
  getGoogleKeywordsForLocation(mcpServer);

  // Facebook
  getAllFacebookBrandpageInsights(mcpServer);
  getFacebookLocationsInsights(mcpServer);
  getAllFacebookInsights(mcpServer);
  getAllFacebookRatings(mcpServer);
  getFacebookLocationRatings(mcpServer);

  // Apple
  getAppleLocationInsights(mcpServer);
  getAllAppleInsights(mcpServer);

  // Prompts
  analyzeLocationPrompt(mcpServer);
  summarizeAllInsightsPrompt(mcpServer);

  return mcpServer;
}
