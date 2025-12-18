import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  InitializeRequestSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  LATEST_PROTOCOL_VERSION,
  Implementation
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import os from 'os';
import { LocationCache } from './cache/location-cache';
import { getLocations, getLocation, searchLocations } from './tools/locations/locations';
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

import { ServerOptions } from '@modelcontextprotocol/sdk/server';

const PACKAGE_NAME = '@pinmeto/pinmeto-location-mcp';
const PACKAGE_VERSION = '1.0.2';
const TOKEN_CACHE_SECONDS = 59 * 60;

export class PinMeToMcpServer extends McpServer {
  private _configs: Configs;
  private _locationCache: LocationCache;

  constructor(serverInfo: Implementation, options?: ServerOptions) {
    super(serverInfo, options);
    this._configs = getConfigs();
    this._locationCache = new LocationCache(() => this._fetchAllLocations(), 5);
  }

  public get configs() {
    return this._configs;
  }

  public get locationCache() {
    return this._locationCache;
  }

  /**
   * Fetches all locations from the API.
   * Used by LocationCache for cache population.
   */
  private async _fetchAllLocations(): Promise<[any[], boolean]> {
    const url = `${this._configs.locationsApiBaseUrl}/v4/${this._configs.accountId}/locations?pagesize=1000`;
    return this.makePaginatedPinMeToRequest(url);
  }

  public async makePinMeToRequest(url: string) {
    try {
      const token = await this._getPinMeToAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
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
    version: PACKAGE_VERSION,
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
      `${request.params.clientInfo.name}/${request.params.clientInfo.version} ${PACKAGE_NAME}-${PACKAGE_VERSION} (${os.type()}; ${os.arch()}; ${os.release()})`;

    const requestedVersion = request.params.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : LATEST_PROTOCOL_VERSION;

    return {
      protocolVersion,
      capabilities: serverInfo.capabilities,
      serverInfo
    };
  });

  // Locations
  getLocation(mcpServer);
  getLocations(mcpServer);
  searchLocations(mcpServer);

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
