import { MARKDOWN_TABLE_MAX_ROWS } from '../helpers';

/**
 * Location data structure (partial - uses passthrough for flexibility)
 */
interface LocationData {
  storeId?: string;
  name?: string;
  locationDescriptor?: string;
  type?: string;
  permanentlyClosed?: boolean;
  temporarilyClosedUntil?: string;
  openingDate?: string;
  address?: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    homepage?: string;
  };
  openHours?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Checks if a date string (YYYY-MM-DD) is in the future.
 */
function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  return date > today;
}

/**
 * Extracts opening/closing times from various object formats.
 * Tries multiple common property names used by different APIs.
 */
function extractTimePeriod(obj: Record<string, unknown>): string | null {
  // Common property name patterns for opening times
  const openKeys = ['open', 'opens', 'start', 'from', 'openTime', 'opening'];
  const closeKeys = ['close', 'closes', 'end', 'to', 'closeTime', 'closing'];

  let openTime: string | null = null;
  let closeTime: string | null = null;

  for (const key of openKeys) {
    if (key in obj && obj[key]) {
      openTime = String(obj[key]);
      break;
    }
  }

  for (const key of closeKeys) {
    if (key in obj && obj[key]) {
      closeTime = String(obj[key]);
      break;
    }
  }

  if (openTime && closeTime) {
    return `${openTime}-${closeTime}`;
  }
  if (openTime) {
    return `${openTime}-`;
  }
  if (closeTime) {
    return `-${closeTime}`;
  }

  // Check for 'hours' or 'time' property that might contain the full string
  if ('hours' in obj && typeof obj.hours === 'string') {
    return obj.hours;
  }
  if ('time' in obj && typeof obj.time === 'string') {
    return obj.time;
  }

  // If it has isClosed/closed flag
  if (obj.isClosed === true || obj.closed === true) {
    return 'Closed';
  }

  return null;
}

/**
 * Formats an opening hours value to a display string.
 * Handles strings, arrays of time periods, null, and other formats.
 */
function formatHoursValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'Closed';
  }
  if (typeof value === 'string') {
    return value || 'Closed';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Closed';
    }
    // Handle array of time period objects
    const periods = value
      .map((period) => {
        if (typeof period === 'string') {
          return period;
        }
        if (period && typeof period === 'object') {
          return extractTimePeriod(period as Record<string, unknown>);
        }
        return null;
      })
      .filter((p): p is string => p !== null);

    return periods.length > 0 ? periods.join(', ') : 'Closed';
  }
  // Handle object format
  if (typeof value === 'object') {
    const result = extractTimePeriod(value as Record<string, unknown>);
    if (result) {
      return result;
    }
    // Last resort: try to find any string values that look like times
    const obj = value as Record<string, unknown>;
    const timeValues = Object.values(obj)
      .filter((v): v is string => typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v));
    if (timeValues.length >= 2) {
      return `${timeValues[0]}-${timeValues[1]}`;
    }
    if (timeValues.length === 1) {
      return timeValues[0];
    }
  }
  return 'Closed';
}

/**
 * Formats location status as a human-readable string.
 * Priority: Permanently Closed > Temporarily Closed > Opening Soon > Open
 * @param location - The location data
 * @param short - If true, returns abbreviated status for tables
 */
function formatStatus(location: LocationData, short = false): string {
  if (location.permanentlyClosed) {
    return 'Permanently Closed';
  }
  if (location.temporarilyClosedUntil) {
    const date = location.temporarilyClosedUntil;
    return short ? `Closed to ${date}` : `Temporarily Closed to ${date}`;
  }
  if (location.openingDate && isFutureDate(location.openingDate)) {
    return short ? `Opening ${location.openingDate}` : `Opening ${location.openingDate}`;
  }
  return 'Open';
}

/**
 * Search result structure
 */
interface SearchResult {
  storeId: string;
  name: string;
  locationDescriptor?: string;
  addressSummary: string;
}

/**
 * Locations list response with pagination metadata
 */
interface LocationsListData {
  data: LocationData[];
  totalCount: number;
  hasMore: boolean;
  offset: number;
  limit: number;
  cacheInfo?: {
    cached: boolean;
    ageSeconds?: number;
    totalCached?: number;
  };
}

/**
 * Search results response with pagination metadata
 */
interface SearchResultsData {
  data: SearchResult[];
  totalMatches: number;
  hasMore: boolean;
}

/**
 * Formats a single location as Markdown.
 */
export function formatLocationAsMarkdown(location: LocationData): string {
  if (!location) {
    return '## Location\n\nNo location data available.';
  }

  let md = `## Location: ${location.name || 'Unknown'}\n\n`;
  md += `**Store ID:** ${location.storeId || 'N/A'}\n`;

  if (location.locationDescriptor) {
    md += `**Descriptor:** ${location.locationDescriptor}\n`;
  }

  if (location.type) {
    md += `**Type:** ${location.type}\n`;
  }

  md += `**Status:** ${formatStatus(location)}\n\n`;

  // Address section
  if (location.address) {
    const addr = location.address;
    md += '### Address\n\n';
    if (addr.street) md += `- **Street:** ${addr.street}\n`;
    if (addr.city) md += `- **City:** ${addr.city}\n`;
    if (addr.zip) md += `- **Postal Code:** ${addr.zip}\n`;
    if (addr.country) md += `- **Country:** ${addr.country}\n`;
    md += '\n';
  }

  // Contact section
  if (location.contact) {
    const contact = location.contact;
    const hasContact = contact.phone || contact.email || contact.homepage;
    if (hasContact) {
      md += '### Contact\n\n';
      if (contact.phone) md += `- **Phone:** ${contact.phone}\n`;
      if (contact.email) md += `- **Email:** ${contact.email}\n`;
      if (contact.homepage) md += `- **Website:** ${contact.homepage}\n`;
      md += '\n';
    }
  }

  // Opening hours section
  if (location.openHours && Object.keys(location.openHours).length > 0) {
    md += '### Opening Hours\n\n';
    md += '| Day | Hours |\n';
    md += '|-----|-------|\n';

    const hours = location.openHours;

    // Day variants: [fullName, abbreviation, displayName]
    const dayVariants: [string, string, string][] = [
      ['monday', 'mon', 'Monday'],
      ['tuesday', 'tue', 'Tuesday'],
      ['wednesday', 'wed', 'Wednesday'],
      ['thursday', 'thu', 'Thursday'],
      ['friday', 'fri', 'Friday'],
      ['saturday', 'sat', 'Saturday'],
      ['sunday', 'sun', 'Sunday']
    ];
    const displayedDays = new Set<string>();

    // Try to display in standard order, checking all variants
    for (const [fullLower, abbrevLower, displayName] of dayVariants) {
      const fullCapitalized = fullLower.charAt(0).toUpperCase() + fullLower.slice(1);
      const abbrevCapitalized = abbrevLower.charAt(0).toUpperCase() + abbrevLower.slice(1);

      // Check all possible key formats
      const keysToCheck = [fullLower, fullCapitalized, abbrevLower, abbrevCapitalized];
      for (const key of keysToCheck) {
        if (key in hours) {
          md += `| ${displayName} | ${formatHoursValue(hours[key])} |\n`;
          displayedDays.add(key);
          break;
        }
      }
    }

    // Show any remaining keys that weren't matched
    for (const key of Object.keys(hours)) {
      if (!displayedDays.has(key)) {
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
        md += `| ${displayKey} | ${formatHoursValue(hours[key])} |\n`;
      }
    }

    md += '\n';
  }

  return md;
}

/**
 * Formats multiple locations as a Markdown table.
 * Truncates at MARKDOWN_TABLE_MAX_ROWS with a summary message.
 */
export function formatLocationsListAsMarkdown(response: LocationsListData): string {
  const { data: locations, totalCount, hasMore, offset, limit, cacheInfo } = response;

  if (!locations || locations.length === 0) {
    return '## Locations\n\nNo locations found.';
  }

  let md = `## Locations\n\n`;
  md += `**Total:** ${totalCount} locations`;
  if (cacheInfo?.cached) {
    md += ` (cached ${cacheInfo.ageSeconds}s ago)`;
  }
  md += '\n\n';

  md += `Showing ${locations.length} results (offset: ${offset}, limit: ${limit})\n\n`;

  // Table header
  md += '| Store ID | Name | Descriptor | City | Country | Status |\n';
  md += '|----------|------|------------|------|---------|--------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(locations.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const loc = locations[i];
    const status = formatStatus(loc, true);
    const descriptor = loc.locationDescriptor || '-';
    const city = loc.address?.city || '-';
    const country = loc.address?.country || '-';
    md += `| ${loc.storeId || '-'} | ${loc.name || 'Unknown'} | ${descriptor} | ${city} | ${country} | ${status} |\n`;
  }

  // Truncation notice
  if (locations.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = locations.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more locations (use structuredContent for full data)*\n`;
  }

  if (hasMore) {
    md += `\n*More results available. Use offset: ${offset + limit} for next page.*\n`;
  }

  return md;
}

/**
 * Formats search results as a Markdown table.
 * Truncates at MARKDOWN_TABLE_MAX_ROWS with a summary message.
 */
export function formatSearchResultsAsMarkdown(response: SearchResultsData): string {
  const { data: results, totalMatches, hasMore } = response;

  if (!results || results.length === 0) {
    return '## Search Results\n\nNo locations found matching your query.';
  }

  let md = `## Search Results\n\n`;
  md += `**Found:** ${totalMatches} matching locations\n\n`;

  // Table header
  md += '| Store ID | Name | Descriptor | Address |\n';
  md += '|----------|------|------------|----------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(results.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const result = results[i];
    md += `| ${result.storeId} | ${result.name} | ${result.locationDescriptor || '-'} | ${result.addressSummary} |\n`;
  }

  // Truncation notice
  if (results.length > MARKDOWN_TABLE_MAX_ROWS) {
    const remaining = results.length - MARKDOWN_TABLE_MAX_ROWS;
    md += `\n*... and ${remaining} more results (use structuredContent for full data)*\n`;
  }

  if (hasMore) {
    md += `\n*More results available. Increase limit to see more.*\n`;
  }

  return md;
}
