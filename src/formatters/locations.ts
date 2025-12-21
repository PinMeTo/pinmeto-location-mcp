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
  openHours?: Record<string, string | null>;
  [key: string]: unknown;
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

  md += `**Status:** ${location.permanentlyClosed ? 'Permanently Closed' : 'Open'}\n\n`;

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

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hours = location.openHours;

    for (const day of dayOrder) {
      if (day in hours) {
        const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
        md += `| ${capitalizedDay} | ${hours[day] || 'Closed'} |\n`;
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
  md += '| Store ID | Name | City | Country | Status |\n';
  md += '|----------|------|------|---------|--------|\n';

  // Table rows (truncated)
  const displayCount = Math.min(locations.length, MARKDOWN_TABLE_MAX_ROWS);
  for (let i = 0; i < displayCount; i++) {
    const loc = locations[i];
    const status = loc.permanentlyClosed ? 'Closed' : 'Open';
    const city = loc.address?.city || '-';
    const country = loc.address?.country || '-';
    md += `| ${loc.storeId || '-'} | ${loc.name || 'Unknown'} | ${city} | ${country} | ${status} |\n`;
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
