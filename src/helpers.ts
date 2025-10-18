import { PinMeToApiError } from './mcp_server.js';

const MAX_RESPONSE_CHARS = 25000; // ~25k tokens (MCP best practice)

export function formatListResponse(
  response: any[],
  areAllPagesFetched: boolean,
  options?: {
    offset?: number;
    limit?: number;
    total?: number;
  }
): string {
  if (response.length === 0) {
    return 'The response was empty...';
  }

  // Build structured pagination response following MCP best practices
  const paginatedResponse: any = {
    count: response.length,
    items: response
  };

  // Add offset if provided
  if (options?.offset !== undefined) {
    paginatedResponse.offset = options.offset;
  }

  // Add total if known
  if (options?.total !== undefined) {
    paginatedResponse.total = options.total;
  }

  // Add pagination metadata
  paginatedResponse.has_more = !areAllPagesFetched;

  // Calculate next_offset if there's more data
  if (!areAllPagesFetched && options?.offset !== undefined) {
    paginatedResponse.next_offset = options.offset + response.length;
  }

  // Add helpful message if not all pages fetched
  if (!areAllPagesFetched) {
    paginatedResponse.message =
      'Not all pages were fetched. Use offset parameter or increase maxPages to see more results.';
  }

  return JSON.stringify(paginatedResponse, null, 2);
}

export function truncateResponse(data: any): [string, boolean] {
  const jsonStr = JSON.stringify(data, null, 2);

  // Handle when JSON.stringify returns undefined (e.g., for undefined input)
  if (jsonStr === undefined) {
    return ['undefined', false];
  }

  if (jsonStr.length <= MAX_RESPONSE_CHARS) {
    return [jsonStr, false]; // [content, wasTruncated]
  }

  const truncated = jsonStr.substring(0, MAX_RESPONSE_CHARS);
  const message =
    '\n\n[Response truncated due to size. Use more specific filters or query individual items.]';

  return [truncated + message, true];
}

export function formatLocationMarkdown(location: any): string {
  if (!location) return 'No location data available.';

  let md = '# Location Details\n\n';
  md += `**Store ID:** ${location.storeId || 'N/A'}\n`;
  md += `**Name:** ${location.name || 'N/A'}\n`;
  md += `**Status:** ${location.permanentlyClosed === false ? 'Active' : 'Inactive'}\n\n`;

  if (location.address) {
    md += '## Address\n';
    md += `${location.address.street || ''}\n`;
    md += `${location.address.zip || ''} ${location.address.city || ''}\n`;
    md += `${location.address.country || ''}\n\n`;
  }

  if (location.contact) {
    md += '## Contact\n';
    if (location.contact.phone) md += `**Phone:** ${location.contact.phone}\n`;
    if (location.contact.email) md += `**Email:** ${location.contact.email}\n`;
    if (location.contact.website || location.contact.homepage) {
      md += `**Website:** ${location.contact.website || location.contact.homepage}\n`;
    }
    md += '\n';
  }

  if (location.openHours) {
    md += '## Operating Hours\n';
    md += '```\n';
    md += JSON.stringify(location.openHours, null, 2);
    md += '\n```\n\n';
  }

  return md;
}

export function formatInsightsMarkdown(
  platform: string,
  insights: any,
  storeId?: string
): string {
  if (!insights) return `No ${platform} insights available.`;

  let md = `# ${platform} Insights\n\n`;
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  // Generic insights formatter - customize based on actual API response structure
  md += '## Metrics\n\n';
  md += '```json\n';
  md += JSON.stringify(insights, null, 2);
  md += '\n```\n\n';

  return md;
}

export function formatRatingsMarkdown(platform: string, ratings: any, storeId?: string): string {
  if (!ratings) return `No ${platform} ratings available.`;

  let md = `# ${platform} Ratings\n\n`;
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  // Generic ratings formatter - customize based on actual API response structure
  md += '## Rating Details\n\n';
  md += '```json\n';
  md += JSON.stringify(ratings, null, 2);
  md += '\n```\n\n';

  return md;
}

export function formatKeywordsMarkdown(keywords: any, storeId?: string): string {
  if (!keywords) return 'No keyword data available.';

  let md = '# Google Keywords\n\n';
  if (storeId) md += `**Store ID:** ${storeId}\n\n`;

  md += '## Keywords\n\n';
  md += '```json\n';
  md += JSON.stringify(keywords, null, 2);
  md += '\n```\n\n';

  return md;
}

/**
 * Format API errors with specific, actionable messages
 * Provides guidance based on error type and status code
 */
export function formatApiError(error: unknown, context?: string): string {
  if (error instanceof PinMeToApiError) {
    const contextStr = context ? ` ${context}` : '';

    if (error.statusCode === 404) {
      return `Error: Resource not found${contextStr}. Please verify the ID is correct and the resource exists.`;
    } else if (error.statusCode === 403) {
      return `Error: Permission denied${contextStr}. Check your PINMETO_APP_ID and PINMETO_APP_SECRET credentials.`;
    } else if (error.statusCode === 429) {
      return `Error: Rate limit exceeded${contextStr}. Please wait before making more requests.`;
    } else if (error.statusCode === 401) {
      return `Error: Authentication failed${contextStr}. Verify your API credentials are correct.`;
    } else if (error.errorType === 'timeout') {
      return `Error: Request timed out${contextStr}. The PinMeTo API may be slow. Please try again.`;
    } else if (error.errorType === 'network_error') {
      return `Error: Network error${contextStr}. Unable to reach the PinMeTo API. Check your internet connection.`;
    } else if (error.statusCode) {
      return `Error: API request failed with status ${error.statusCode}${contextStr}.`;
    }
  }

  return `Error: Unexpected error occurred${context ? ` ${context}` : ''}: ${
    error instanceof Error ? error.message : String(error)
  }`;
}

/**
 * Helper to handle tool responses with consistent error handling and formatting
 * Reduces code duplication across tool implementations
 */
export async function handleToolResponse<T>(
  dataFetcher: () => Promise<T>,
  format: 'json' | 'markdown',
  options: {
    errorMessage: string;
    markdownFormatter?: (data: T) => string;
  }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const data = await dataFetcher();

    // Handle markdown format
    if (format === 'markdown' && options.markdownFormatter) {
      return {
        content: [
          {
            type: 'text',
            text: options.markdownFormatter(data)
          }
        ]
      };
    }

    // Handle JSON format with truncation
    const [responseText] = truncateResponse(data);
    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  } catch (error) {
    // Format error with context
    return {
      content: [
        {
          type: 'text',
          text: `${options.errorMessage}\n\n${formatApiError(error)}`
        }
      ]
    };
  }
}
