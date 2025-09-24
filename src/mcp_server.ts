import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  InitializeRequestSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  LATEST_PROTOCOL_VERSION,
  Implementation
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
import { Configs, getConfigs } from './configs';
import packageJson from '../package.json';
import { ServerOptions } from '@modelcontextprotocol/sdk/server';

const TOKEN_CACHE_SECONDS = 59 * 60;

export class PinMeToMcpServer extends McpServer {
  private _configs: Configs;

  constructor(serverInfo: Implementation, options?: ServerOptions) {
    super(serverInfo, options);
    this._configs = getConfigs();
  }

  public get configs() {
    return this._configs;
  }

  public async makePinMeToRequest(url: string) {
    try {
      const token = await this._getPinMeToAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`
      };

      const response = await axios.get(url, { headers, timeout: 30000 });
      return response.data;
    } catch (e: any) {
      console.error(`Request failed, reason: ${e}`);
      return null;
    }
  }

  public async makePaginatedPinMeToRequest(url: string): Promise<[any[], boolean]> {
    const allData: any[] = [];
    let nextUrl: string | undefined = url;
    let areAllPagesFetched = true;

    while (nextUrl) {
      const resp = await this.makePinMeToRequest(nextUrl);
      if (!resp) {
        console.warn("Couldn't fetch all pages for the request");
        areAllPagesFetched = false;
        break;
      }
      const pageData: any[] = resp['data'] || [];
      allData.push(...pageData);
      const paging = resp['paging'] || {};
      nextUrl = paging['nextUrl'];
      if (!nextUrl || pageData.length == 0) break;
    }
    return [allData, areAllPagesFetched];
  }

  private async _getPinMeToAccessToken(): Promise<string> {
    const now = Date.now() / 1000;
    if (this._configs.accessToken && now - this._configs.accessTokenTime < TOKEN_CACHE_SECONDS) {
      return this._configs.accessToken;
    }
    const token = await this._getAndStoreToken();
    this._configs.accessToken = token;
    this._configs.accessTokenTime = now;
    return token;
  }

  private async _getAndStoreToken(): Promise<string> {
    const tokenUrl = `${this._configs.apiBaseUrl}/oauth/token`;
    const appId = this._configs.appId;
    const appSecret = this._configs.appSecret;

    const credentials = `${appId}:${appSecret}`;
    const b64Credentials = Buffer.from(credentials).toString('base64');
    const headers = {
      Authorization: `Basic ${b64Credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const data = new URLSearchParams({ grant_type: 'client_credentials' });

    const response = await axios.post(tokenUrl, data, {
      headers,
      timeout: 30000
    });
    const respData = response.data;
    const token = respData['access_token'];
    if (!token) {
      throw new Error('No access_token in response.');
    }
    return token;
  }
}

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
  const mcpServer = new PinMeToMcpServer(serverInfo);

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
