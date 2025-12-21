# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides AI agents like Claude with access to PinMeTo's location management platform. It exposes tools for fetching location data, insights from Google/Facebook/Apple, ratings, and keywords.

Use mcp builders skill when developing on the MCP server (/document-skills:mcp-builder). It should be used for reviewing and best practices when developing the MCP.

See [AGENTS.md](@AGENTS.md) for issue tracking workflow using **bd** (beads) and session completion guidelines.
## Beads
```bash
# Create issues
bd create "Implement user authentication" -t feature -p 1

# Update issues
bd update bd-a1b2 --status in_progress

# Close issues
bd close bd-a1b2 "Completed authentication"
```

Do not set a bead to closed before its PR have been approved.
When starting on a new bead set it to in-progres and asign it to the curent git user

## Development Commands

### Build and Test
```bash
npm run build              # Clean build with TypeScript compilation
npm run build:test         # Build with timestamped test version
npm test                   # Run vitest tests
npm run pack:test          # Build and pack for testing
```

### Development
```bash
npm run start              # Run built server in development mode
npm run inspector          # Launch MCP inspector for debugging
npm run format             # Format code with Prettier
```

### Release

This project uses [release-it](https://github.com/release-it/release-it) with conventional commits for automated versioning and changelog generation.

**Commit Message Format** (determines version bump):
```bash
feat: add new tool        # Minor bump (1.0.0 → 1.1.0)
fix: correct API handling # Patch bump (1.0.0 → 1.0.1)
feat!: breaking change    # Major bump (1.0.0 → 2.0.0)
docs: update readme       # No version bump (non-releasable)
```

**Release Commands**:
```bash
npm run release:prepare    # Dry-run: preview version bump and changelog
npm run release:draft      # Create draft GitHub release with .mcpb artifact
npm run release:publish    # Publish the draft release (or use GitHub UI)
npm run clean              # Remove build directory
```

**Release Flow**:
1. Ensure commits follow conventional format
2. Run `npm run release:prepare` to preview changes
3. Run `npm run release:draft` to create draft release
4. Review draft on GitHub, then publish

## Environment Configuration

The server requires these environment variables (loaded via `--env-file=.env.local` in npm scripts):
- `PINMETO_ACCOUNT_ID` - PinMeTo account identifier
- `PINMETO_APP_ID` - OAuth application ID
- `PINMETO_APP_SECRET` - OAuth application secret
- `PINMETO_API_URL` - (Optional, dev only) Override API base URL
- `PINMETO_LOCATION_API_URL` - (Optional, dev only) Override locations API base URL

## Architecture

### Core Components

**PinMeToMcpServer** (`src/mcp_server.ts`) - Custom MCP server extending `McpServer` with:
- OAuth token management with 59-minute cache
- `makePinMeToRequest()` - Authenticated single API requests
- `makePaginatedPinMeToRequest()` - Automatic pagination handling
- Configuration management via `src/configs.ts`

**Tool Registration Pattern** - Each tool module exports registration functions that accept the server instance:
```typescript
export function getLocation(server: PinMeToMcpServer) {
  server.registerTool(
    'get_location',
    {
      description: 'Get location details for a store from PinMeTo API',
      inputSchema: {
        storeId: z.string().describe('The store ID to look up')
      },
      outputSchema: LocationOutputSchema,  // Zod schema for output validation
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => {
      const data = await server.makePinMeToRequest(url);
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }],
        structuredContent: { data }  // Typed output for AI clients
      };
    }
  );
}
```

**Time Aggregation** (`src/helpers.ts`) - Client-side metric aggregation to reduce token consumption:
- Supports daily, weekly, monthly, quarterly, half-yearly, yearly, and total
- Defaults to `total` (single aggregated value) for maximum token efficiency
- Applied to all insights tools via `aggregateMetrics()` function

### Directory Structure

```
src/
├── index.ts              # Entry point, sets up stdio transport
├── mcp_server.ts         # Server class and tool registration
├── configs.ts            # Environment config validation
├── helpers.ts            # Time aggregation and response formatting
├── prompts.ts            # Prompt templates for common workflows
├── formatters/           # Markdown formatters for response_format support
│   ├── index.ts          # Module entry point
│   ├── locations.ts      # Location/search formatters
│   ├── insights.ts       # Insights formatters (Google/FB/Apple)
│   ├── ratings.ts        # Ratings formatters
│   └── keywords.ts       # Keywords formatters
├── schemas/
│   └── output.ts         # Shared Zod output schemas for tools
└── tools/
    ├── locations/        # Location data tools
    │   └── locations.ts
    └── networks/         # Network-specific insights tools
        ├── google.ts
        ├── facebook.ts
        └── apple.ts
```

## Adding New Tools

1. Create tool registration function in appropriate module under `src/tools/`
2. Define Zod schema for input validation
3. Add `response_format: ResponseFormatSchema` to input schema
4. Define or reuse output schema from `src/schemas/output.ts`
5. Implement handler using `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()`
6. Use `formatContent()` helper to format response based on `response_format`
7. Return both `content` (text) and `structuredContent` (typed data) from handler
8. For insights tools, apply `aggregateMetrics()` before formatting
9. Add appropriate tool annotations (see Tool Annotations section below)
10. Register tool in `createMcpServer()` function in `src/mcp_server.ts`

## Tool Annotations

All tools use MCP tool annotations to provide hints about their behavior to AI agents:

**Current Annotations**:
- `readOnlyHint: true` - All tools are read-only (only fetch data, never modify state)

**Other Annotations** (using SDK defaults):
- `destructiveHint: false` - Tools do not perform destructive updates
- `idempotentHint: false` - Metrics may change between calls (not idempotent)
- `openWorldHint: true` - Tools interact with external PinMeTo APIs

### Adding New Tools with Annotations

When creating new tools, include the annotations in the tool configuration:

```typescript
server.registerTool(
  'tool_name',
  {
    description: 'Tool description explaining what it does',
    inputSchema: {
      param1: z.string().describe('Parameter description'),
      // ... more parameters
    },
    annotations: {
      readOnlyHint: true  // For read-only tools (current pattern)
    }
  },
  async (args) => {
    // Handler implementation
  }
);
```

**For future write/modify tools:**
- Set `readOnlyHint: false` if the tool modifies data
- Consider `destructiveHint: true` for destructive operations (deletes, overwrites)
- Set `idempotentHint: true` if repeated calls with same args have no additional effect

Tool annotations are defined in the [MCP specification](https://modelcontextprotocol.io/docs/concepts/tools) and help AI agents plan better by understanding tool side effects.

## Output Schemas

All tools define output schemas using Zod, enabling AI clients to understand and validate response structures. Tools return both text content and structured data for maximum compatibility.

### Available Output Schemas (`src/schemas/output.ts`)

- **InsightsOutputSchema** - For Google, Facebook, and Apple insights tools
- **RatingsOutputSchema** - For ratings tools across all networks
- **KeywordsOutputSchema** - For Google keywords tools
- **LocationOutputSchema** - For single location retrieval
- **LocationsOutputSchema** - For multiple locations with pagination status
- **SearchResultOutputSchema** - For lightweight search results with pagination metadata

### Output Pattern

All tools return both `content` (text representation) and `structuredContent` (typed data):

```typescript
// Success response
return {
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: { data: aggregatedData }
};

// Error response
return {
  content: [{ type: 'text', text: 'Unable to fetch data.' }],
  structuredContent: { error: 'Unable to fetch data.' }
};
```

### Creating New Output Schemas

When adding tools with new response structures:

1. Define the schema in `src/schemas/output.ts` using Zod
2. Export both the schema object and TypeScript type
3. Include `data` wrapper for the main response and optional `error` field

```typescript
export const NewOutputSchema = {
  data: z.array(z.object({
    id: z.string(),
    value: z.number()
  })).describe('Description of the data'),
  error: z.string().optional().describe('Error message if request failed')
};
```

## Response Formats

All tools support a `response_format` parameter for flexible output formatting:

| Format | Description | Use Case |
|--------|-------------|----------|
| `json` (default) | Compact JSON string | Token-efficient, programmatic processing |
| `markdown` | Human-readable with headers and tables | Reports, debugging, human review |

### Usage Examples

```typescript
// JSON format (default) - maximum token efficiency
{ storeId: "1337" }

// Markdown format - human-readable tables
{ storeId: "1337", response_format: "markdown" }

// Insights with markdown output
{ from: "2024-01-01", to: "2024-12-31", response_format: "markdown" }
```

### Format Behavior

- **content.text**: Formatted according to `response_format` parameter
- **structuredContent**: Always contains typed data (unaffected by format)
- **Errors**: Always returned as JSON (not affected by response_format)
- **Large datasets**: Markdown tables truncate at 50 rows with "... and X more" message

### Markdown Output Examples

**Locations**: Table with Store ID, Name, City, Country, Status columns
**Insights**: Sections per metric with Period/Value tables
**Ratings**: Summary stats with visual distribution bars
**Keywords**: Table with Keyword and Impressions columns

### Formatters Module (`src/formatters/`)

Centralized Markdown formatters for consistent output:
- `formatLocationAsMarkdown()` - Single location details
- `formatLocationsListAsMarkdown()` - Paginated location table
- `formatSearchResultsAsMarkdown()` - Search results table
- `formatInsightsAsMarkdown()` - Insights data with sections
- `formatRatingsAsMarkdown()` - Ratings with distribution
- `formatKeywordsAsMarkdown()` - Keywords with CTR calculation

## Location Discovery Workflow

Use `search_locations` for quick location discovery, then `get_location` for full details:

### Search Examples

```typescript
// Search by name - finds "IKEA Malmö", "IKEA Stockholm", etc.
{ query: "IKEA" }

// Search by city - finds all locations in Stockholm
{ query: "Stockholm" }

// Search by storeId - exact match on store identifier
{ query: "1337" }

// Search by location descriptor
{ query: "Headquarters" }

// Limit results for large result sets
{ query: "Sweden", limit: 10 }
```

### Search Fields

The search matches against these fields (case-insensitive substring):
- `name` - Location name
- `storeId` - Unique store identifier
- `locationDescriptor` - Additional location description
- `address.street` - Street address
- `address.city` - City name
- `address.country` - Country name

### Response Structure

```typescript
{
  data: [
    { storeId: "1337", name: "PinMeTo Malmö", locationDescriptor: "HQ", addressSummary: "Adelgatan 9, Malmö, Sweden" }
  ],
  totalMatches: 5,   // Total matching locations
  hasMore: true      // More results exist beyond limit
}
```

## Pagination, Filtering, and Caching

`get_locations` supports pagination, filtering, and uses an in-memory cache for efficient queries on large datasets (5000+ locations).

### Caching

- **TTL**: 5 minutes (data refreshes automatically)
- **forceRefresh**: Set to `true` to bypass cache
- **cacheInfo**: Response includes cache status (cached, ageSeconds, totalCached)

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results (max: 1000) |
| `offset` | number | 0 | Skip N results |
| `permanentlyClosed` | boolean | - | Filter by closure status |
| `type` | string | - | "location" or "serviceArea" |
| `city` | string | - | Filter by city (case-insensitive) |
| `country` | string | - | Filter by country (case-insensitive) |
| `forceRefresh` | boolean | false | Bypass cache TTL |
| `fields` | array | all | Specific fields to return |

### Response Structure

```typescript
{
  data: [...],                          // Paginated location objects
  totalCount: 150,                      // Total matching filters
  hasMore: true,                        // More results available
  offset: 0,                            // Current position
  limit: 50,                            // Requested limit
  cacheInfo: {
    cached: true,                       // Was data from cache?
    ageSeconds: 120,                    // Cache age in seconds
    totalCached: 5000                   // Total locations in cache
  }
}
```

### Examples

```typescript
// First page (default: limit=50)
{ }

// Next page
{ offset: 50 }

// Custom page size
{ limit: 100, offset: 200 }

// Filter by city (case-insensitive)
{ city: "Stockholm" }

// Filter by country
{ country: "Sweden" }

// Only open locations
{ permanentlyClosed: false }

// Combined filters
{ city: "Stockholm", permanentlyClosed: false, limit: 20 }

// Force fresh data (bypass cache)
{ forceRefresh: true }

// Select specific fields only
{ fields: ["storeId", "name", "address"] }
```

## Testing

Tests use Vitest with axios mocking. When writing tests:
- Mock axios for all API interactions
- Set required environment variables in `beforeAll`
- Use `StdioServerTransport` to simulate MCP protocol messages
- Test both success paths and error handling

## Build Process

1. `npm run clean` - Removes existing build directory
2. `node manifest.js` - Generates `manifest.json` from package.json metadata
3. `tsc` - TypeScript compilation to `build/` directory
4. `cp package.json build/` - Copy package.json to build
5. `node update-build-version.js` - Sync version in build/package.json

The manifest.json is used by `@anthropic-ai/mcpb` to create single-click installers for Claude Desktop.

## API Communication

All API requests:
- Use OAuth 2.0 client credentials flow
- Include Bearer token in Authorization header
- Have 30-second timeout
- Return null on error (logged to stderr)
- Use User-Agent with client info, package name, and OS details

Pagination:
- Follows `paging.nextUrl` in API responses
- Returns tuple of `[data[], areAllPagesFetched: boolean]`
- Stops on empty page or missing nextUrl
