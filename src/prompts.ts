import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Example prompts that the user can use
export function analyzeLocationPrompt(server: McpServer) {
  server.prompt(
    'pinmeto_analyze_location',
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
    async (args: { storeId: string; analysisType?: string }) => {
      const { storeId, analysisType = 'summary' } = args;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the pinmeto_get_location tool to retrieve data for store ID "${storeId}" and then provide a ${analysisType} analysis of this location.
                Focus on key business insights such as:
                - Location details and accessibility
                - Contact information and hours
                - Any operational strengths or areas for improvement
                - Recommendations for optimization

                Use the pinmeto_get_location tool first to fetch the data, then provide your analysis.`
            }
          }
        ]
      };
    }
  );
}

export function summarizeAllInsightsPrompt(server: McpServer) {
  server.prompt(
    'pinmeto_summarize_insights',
    'Summarize insights across Facebook, Google, and Apple for a SINGLE location, formatted as a table.',
    {
      storeId: z.string().describe('The store ID to summarize insights for')
    },
    async (args: { storeId: string }) => {
      const { storeId } = args;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the following tools to retrieve insights for store ID "${storeId}":
- pinmeto_get_facebook_insights_location
- pinmeto_get_google_insights_location
- pinmeto_get_apple_insights_location

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
}
