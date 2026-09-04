import { CLIENT_INFO_META_KEY, McpServer, Implementation } from '@modelcontextprotocol/server';
import axios, { isAxiosError } from 'axios';
import os from 'os';
import { ApiResult, ApiError, AuthError, mapAxiosErrorToApiError } from './errors';
import { LocationCache } from './cache/location-cache';
import { getLocations, getLocation, searchLocations } from './tools/locations/locations';
import {
  getGoogleInsights,
  getGoogleRatings,
  getGoogleReviews,
  getGoogleKeywords,
  getGoogleReviewInsights
} from './tools/networks/google';
import {
  getFacebookInsights,
  getFacebookBrandpageInsights,
  getFacebookRatings
} from './tools/networks/facebook';
import { getAppleInsights } from './tools/networks/apple';
import { Configs, getConfigs } from './configs';
import { PACKAGE_NAME, PACKAGE_VERSION } from './generated/version';

import type { ServerContext, ServerOptions } from '@modelcontextprotocol/server';

const TOKEN_CACHE_SECONDS = 59 * 60;

// The tool catalog and discovery metadata are fixed for the lifetime of a
// release, so clients may safely share them. One hour keeps stale discovery
// bounded after a server upgrade.
const DISCOVERY_CACHE_TTL_MS = 60 * 60 * 1000;

const SERVER_INSTRUCTIONS =
  'Use pinmeto_search_locations to find locations by name, address, or store ID; use ' +
  'pinmeto_get_locations only when you need to browse or filter the full location set. ' +
  'Use pinmeto_get_google_reviews for raw review records and ' +
  'pinmeto_get_google_ratings for basic rating statistics; use ' +
  'pinmeto_get_google_review_insights for review analysis. Always inspect warningCode: ' +
  'when LARGE_DATASET_WARNING is returned, choose an offered option and call the tool again; ' +
  'INCOMPLETE_DATA means results are partial or no data matched; inspect the warning and message. ' +
  'Insights use aggregation=total and ' +
  'compare_with=none unless requested otherwise.';

const SERVER_UA_PART = `${PACKAGE_NAME}-${PACKAGE_VERSION} (${os.type()}; ${os.arch()}; ${os.release()})`;

/** Max characters kept from each client-supplied User-Agent component. */
const UA_COMPONENT_MAX_LENGTH = 64;

/**
 * Strips anything an HTTP header cannot carry from a peer-supplied string.
 *
 * `clientInfo` comes off the wire, and Node rejects header values containing
 * control characters or anything outside Latin-1 with `ERR_INVALID_CHAR` - a
 * client named with an em dash would otherwise fail every outbound API call
 * for the whole session. Restricted to printable ASCII, which is all a
 * User-Agent token needs, and length-capped so a long name can't crowd out the
 * server identity that follows it.
 */
function sanitizeUserAgentComponent(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, UA_COMPONENT_MAX_LENGTH);
}

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
  private async _fetchAllLocations(context?: ServerContext): Promise<[any[], boolean, ApiError | null]> {
    const url = `${this._configs.locationsApiBaseUrl}/v4/${this._configs.accountId}/locations?pagesize=1000`;
    return await this.makePaginatedPinMeToRequest(url, context);
  }

  public async getCachedLocations(forceRefresh: boolean, context: ServerContext) {
    return this._locationCache.getLocationsWithFetcher(forceRefresh, () => this._fetchAllLocations(context));
  }

  /**
   * Builds the User-Agent for outbound PinMeTo API calls, prefixed with the
   * connected client's identity when it is known.
   *
   * MCP 2026-07-28 carries client identity in each request envelope. Legacy
   * connections still expose the initialize-scoped identity on the server.
   */
  private _userAgent(context?: ServerContext): string {
    const envelope = context?.mcpReq.envelope as Record<string, unknown> | undefined;
    const requestClientInfo = envelope?.[CLIENT_INFO_META_KEY] as Implementation | undefined;
    const clientInfo = requestClientInfo ?? this.server.getClientVersion();
    const name = sanitizeUserAgentComponent(clientInfo?.name);
    if (!name) return SERVER_UA_PART;
    const version = sanitizeUserAgentComponent(clientInfo?.version) || 'unknown';
    return `${name}/${version} ${SERVER_UA_PART}`;
  }

  public async makePinMeToRequest<T = any>(url: string, context?: ServerContext): Promise<ApiResult<T>> {
    try {
      const token = await this._getPinMeToAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': this._userAgent(context)
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
    url: string,
    context?: ServerContext
  ): Promise<[any[], boolean, ApiError | null]> {
    type PaginatedResponse = { data?: any[]; paging?: { nextUrl?: string } };
    const allData: any[] = [];
    let nextUrl: string | undefined = url;
    let areAllPagesFetched = true;
    let lastError: ApiError | null = null;

    while (nextUrl) {
      const result: ApiResult<PaginatedResponse> =
        await this.makePinMeToRequest<PaginatedResponse>(nextUrl, context);
      if (!result.ok) {
        const pageContext = allData.length > 0 ? `after ${allData.length} records` : '(first page)';
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
        if (status === 429) {
          console.error('Authentication failed: Rate limited (429)');
          throw new AuthError('RATE_LIMITED', 'Authentication rate limited. Wait before retrying.');
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
  // Capabilities are derived from what we register below, so the SDK's own
  // initialize handler advertises them. Overriding that handler would force us
  // to hand-maintain the list, and previously advertised a `resources`
  // capability this server never implemented.
  const mcpServer = new PinMeToMcpServer(
    {
      name: 'PinMeTo Location MCP',
      version: PACKAGE_VERSION,
      // The SDK sends this identity in the legacy initialize result and stamps it
      // into every modern response's serverInfo metadata. No custom handshake
      // handler is needed.
      description:
        'Read-only access to the PinMeTo location management platform: locations, ' +
        'plus Google/Facebook/Apple insights, ratings, reviews, and keywords.',
      websiteUrl: 'https://www.pinmeto.com'
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      cacheHints: {
        'tools/list': { ttlMs: DISCOVERY_CACHE_TTL_MS, cacheScope: 'public' },
        'server/discover': { ttlMs: DISCOVERY_CACHE_TTL_MS, cacheScope: 'public' }
      }
    }
  );

  // Locations
  getLocation(mcpServer);
  getLocations(mcpServer);
  searchLocations(mcpServer);

  // Google
  getGoogleInsights(mcpServer);
  getGoogleRatings(mcpServer);
  getGoogleReviews(mcpServer);
  getGoogleKeywords(mcpServer);
  getGoogleReviewInsights(mcpServer);

  // Facebook
  getFacebookInsights(mcpServer);
  getFacebookBrandpageInsights(mcpServer);
  getFacebookRatings(mcpServer);

  // Apple
  getAppleInsights(mcpServer);

  return mcpServer;
}
