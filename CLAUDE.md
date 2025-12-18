# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides AI agents like Claude with access to PinMeTo's location management platform. It exposes tools for fetching location data, insights from Google/Facebook/Apple, ratings, and keywords.

Use mcp bulders skill when developing on the MCP server. It should be used for reviewing and best practices when developing the MCP.

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
```bash
npm run release            # Publish to npm from build directory
npm run clean              # Remove build directory
```

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
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => { /* handler implementation */ }
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
3. Implement handler using `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()`
4. For insights tools, apply `aggregateMetrics()` before returning data
5. Add appropriate tool annotations (see Tool Annotations section below)
6. Register tool in `createMcpServer()` function in `src/mcp_server.ts`

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
