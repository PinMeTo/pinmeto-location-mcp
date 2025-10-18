import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Simple zero-argument prompt for testing
export function locationCountPrompt(server: McpServer) {
  const prompt = server.prompt(
    'location_count',
    'Get a count of all locations you manage',
    async (_extra) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the get_locations tool to retrieve all my locations, then tell me:
1. How many total locations I manage
2. A brief summary of the locations (e.g., by country or region if applicable)

Use the get_locations tool first, then provide your analysis.`
            }
          }
        ]
      };
    }
  );
  prompt.enable();
}

// Example prompts that the user can use
export function analyzeLocationPrompt(server: McpServer) {
  const prompt = server.prompt(
    'analyze_location',
    'Analyze location data from PinMeTo API and provide business insights',
    {
      storeId: z.string().describe('The store ID to analyze'),
      analysisType: z
        .string()
        .optional()
        .describe(
          "Type of analysis to perform: 'summary', 'marketing', 'operational', or 'competitive'. Defaults to 'summary'"
        )
    },
    async (args: { storeId: string; analysisType?: string }, _extra) => {
      const { storeId, analysisType = 'summary' } = args;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the get_location tool to retrieve data for store ID "${storeId}" and then provide a ${analysisType} analysis of this location.
                Focus on key business insights such as:
                - Location details and accessibility
                - Contact information and hours
                - Any operational strengths or areas for improvement
                - Recommendations for optimization

                Use the get_location tool first to fetch the data, then provide your analysis.`
            }
          }
        ]
      };
    }
  );
  prompt.enable();
}

export function summarizeAllInsightsPrompt(server: McpServer) {
  const prompt = server.prompt(
    'summarize_all_insights',
    'Summarize insights across Facebook, Google, and Apple for a location, formatted as a table',
    {
      storeId: z.string().describe('The store ID to summarize insights for')
    },
    async (args: { storeId: string }, _extra) => {
      const { storeId } = args;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the following tools to retrieve insights for store ID "${storeId}":
- get_facebook_location_insights
- get_google_location_insights
- get_apple_location_insights

After fetching the data, summarize the key metrics and business insights from each platform in a single, well-formatted table. The table should include columns for Platform, Impressions, Clicks, Ratings, and any other relevant metrics. Below the table, provide a brief summary of notable trends or recommendations.

Example table format:

| Platform | Impressions | Clicks | Ratings | Other Metrics |
|----------|-------------|--------|---------|---------------|
| Facebook | ...         | ...    | ...     | ...           |
| Google   | ...         | ...    | ...     | ...           |
| Apple    | ...         | ...    | ...     | ...           |

Use the tools above to fetch the data, then present your summary and recommendations below the table.`
            }
          }
        ]
      };
    }
  );
  prompt.enable();
}
