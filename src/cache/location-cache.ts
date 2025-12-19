import { ApiError } from '../errors';

/**
 * In-memory cache for location data with TTL-based expiration.
 * Designed to handle large datasets (5000+ locations) efficiently
 * by avoiding repeated API fetches within the TTL window.
 */

interface CacheEntry {
  data: any[];
  timestamp: number;
  allPagesFetched: boolean;
}

export interface CacheInfo {
  cached: boolean;
  age?: number;
  size?: number;
  stale?: boolean;
}

/**
 * Result from cache lookup including data, fetch status, error info, and staleness.
 */
export interface CacheResult {
  data: any[];
  allPagesFetched: boolean;
  error: ApiError | null;
  stale: boolean;
  staleAgeSeconds?: number;
}

export class LocationCache {
  private cache: CacheEntry | null = null;
  private ttlMs: number;
  private fetchFn: () => Promise<[any[], boolean, ApiError | null]>;
  private fetchPromise: Promise<CacheResult> | null = null;

  /**
   * Creates a new LocationCache instance.
   * @param fetchFn - Async function that fetches all locations from the API
   * @param ttlMinutes - Time-to-live in minutes (default: 5)
   */
  constructor(fetchFn: () => Promise<[any[], boolean, ApiError | null]>, ttlMinutes: number = 5) {
    this.fetchFn = fetchFn;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Gets all locations from cache or fetches from API if cache is expired/empty.
   * Uses promise deduplication to prevent concurrent fetches.
   * On complete failure, returns stale cache if available (with stale indicator).
   * @param forceRefresh - Bypass cache and fetch fresh data
   * @returns CacheResult with data, status, error, and staleness info
   */
  async getLocations(forceRefresh = false): Promise<CacheResult> {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.cache && !this.isExpired()) {
      return {
        data: this.cache.data,
        allPagesFetched: this.cache.allPagesFetched,
        error: null,
        stale: false
      };
    }

    // If a fetch is already in progress, wait for it (prevents race condition)
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Start fetch and store promise for deduplication
    this.fetchPromise = this._performFetch();

    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Performs the actual fetch and updates cache appropriately.
   * Only caches successful fetches or partial data.
   * On complete failure, preserves stale cache if available (marked as stale).
   */
  private async _performFetch(): Promise<CacheResult> {
    const [data, allPagesFetched, error] = await this.fetchFn();

    // Complete failure: no data and pagination incomplete
    if (data.length === 0 && !allPagesFetched) {
      // If we have stale cache, return it with stale indicator
      if (this.cache && this.cache.data.length > 0) {
        const staleAgeSeconds = Math.floor((Date.now() - this.cache.timestamp) / 1000);
        console.warn(
          'Location fetch failed completely. Returning stale cache ' +
            `(age: ${staleAgeSeconds}s, size: ${this.cache.data.length})`
        );
        return {
          data: this.cache.data,
          allPagesFetched: this.cache.allPagesFetched,
          error,
          stale: true,
          staleAgeSeconds
        };
      }
      // No stale cache available, return the failure
      return { data, allPagesFetched, error, stale: false };
    }

    // Success or partial success: update cache
    this.cache = { data, timestamp: Date.now(), allPagesFetched };
    return { data, allPagesFetched, error, stale: false };
  }

  /**
   * Checks if the cache has expired based on TTL.
   */
  private isExpired(): boolean {
    return !this.cache || Date.now() - this.cache.timestamp > this.ttlMs;
  }

  /**
   * Invalidates the cache, forcing a fresh fetch on next request.
   */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * Returns information about the current cache state.
   * Useful for debugging and monitoring cache behavior.
   */
  getCacheInfo(): CacheInfo {
    if (!this.cache) return { cached: false };
    return {
      cached: true,
      age: Math.floor((Date.now() - this.cache.timestamp) / 1000),
      size: this.cache.data.length
    };
  }
}
