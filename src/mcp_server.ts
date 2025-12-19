import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  InitializeRequestSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  LATEST_PROTOCOL_VERSION,
  Implementation
} from '@modelcontextprotocol/sdk/types.js';
import axios, { isAxiosError } from 'axios';
import os from 'os';
import { ApiResult, ApiError, AuthError, mapAxiosErrorToApiError } from './errors';
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
   * Returns [data, allPagesFetched, error] to propagate error info to cache.
   */
  private async _fetchAllLocations(): Promise<[any[], boolean, ApiError | null]> {
    const url = `${this._configs.locationsApiBaseUrl}/v4/${this._configs.accountId}/locations?pagesize=1000`;
    return await this.makePaginatedPinMeToRequest(url);
  }

  public async makePinMeToRequest<T = any>(url: string): Promise<ApiResult<T>> {
    try {
      const token = await this._getPinMeToAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      const response = await axios.get(url, { headers, timeout: 30000 });
      return { ok: true, data: response.data };
    } catch (e: unknown) {
      const error = mapAxiosErrorToApiError(e);
      console.error(`Request failed [${url}]: ${error.code} - ${error.message}`);
      return { ok: false, error };
    }
  }

  public async makePaginatedPinMeToRequest(
    url: string
  ): Promise<[any[], boolean, ApiError | null]> {
    type PaginatedResponse = { data?: any[]; paging?: { nextUrl?: string } };
    const allData: any[] = [];
    let nextUrl: string | undefined = url;
    let areAllPagesFetched = true;
    let lastError: ApiError | null = null;

    while (nextUrl) {
      const result: ApiResult<PaginatedResponse> =
        await this.makePinMeToRequest<PaginatedResponse>(nextUrl);
      if (!result.ok) {
        const pageContext =
          allData.length > 0 ? `after ${allData.length} records` : '(first page)';
        console.warn(
          `Couldn't fetch page ${pageContext}: ${result.error.code} - ${result.error.message}`
        );
        areAllPagesFetched = false;
        lastError = result.error;
        break;
      }
      const pageData: any[] = result.data.data || [];
      allData.push(...pageData);
      const paging: { nextUrl?: string } = result.data.paging || {};
      nextUrl = paging.nextUrl;
      if (!nextUrl || pageData.length == 0) break;
    }
    return [allData, areAllPagesFetched, lastError];
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

    try {
      const response = await axios.post(tokenUrl, data, {
        headers,
        timeout: 30000
      });
      const respData = response.data;
      const token = respData['access_token'];
      if (!token) {
        throw new AuthError(
          'AUTH_INVALID_CREDENTIALS',
          'No access_token in response. Check PINMETO_APP_ID and PINMETO_APP_SECRET.'
        );
      }
      return token;
    } catch (e: unknown) {
      // Re-throw AuthErrors as-is
      if (e instanceof AuthError) {
        throw e;
      }

      // Handle Axios errors with specific auth messages
      if (isAxiosError(e)) {
        const status = e.response?.status;
        if (status === 401) {
          console.error('Authentication failed: Invalid credentials (401)');
          throw new AuthError(
            'AUTH_INVALID_CREDENTIALS',
            'Invalid credentials. Verify PINMETO_APP_ID and PINMETO_APP_SECRET are correct.'
          );
        }
        if (status === 403) {
          console.error('Authentication failed: OAuth app disabled (403)');
          throw new AuthError(
            'AUTH_APP_DISABLED',
            'OAuth application is disabled or revoked. Contact PinMeTo support to re-enable.'
          );
        }
        if (status === 400) {
          console.error('Authentication failed: Bad request (400)');
          throw new AuthError(
            'BAD_REQUEST',
            'Malformed authentication request. Check OAuth configuration.'
          );
        }
        // Network errors during auth
        if (!e.response) {
          const detail = e.code || e.message || 'Unknown network error';
          console.error(`Authentication failed: Network error - ${detail}`);
          throw new AuthError('NETWORK_ERROR', `Authentication failed: ${detail}`);
        }
      }

      // Fallback for unknown errors
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`Authentication failed: ${errorMessage}`);
      throw new AuthError('UNKNOWN_ERROR', `Authentication failed: ${errorMessage}`);
    }
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
