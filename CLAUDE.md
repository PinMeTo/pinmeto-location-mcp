# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PinMeTo Location MCP is a Model Context Protocol server that integrates the PinMeTo platform with AI agents, enabling natural language interaction with location analytics data from Google, Facebook, and Apple.

## Claude Code Documentation

**Documentation Directory**
- All Claude-related markdown files (context notes, todos, planning documents, etc.) should be created in `.claude/documentations/`
- This keeps AI-generated documentation organized and separate from project documentation
- The `.claude/` directory structure should not be committed to version control

## Development Commands

### Build and Run
- `npm run build` - Compiles TypeScript, generates manifest.json, and copies package.json to build/
- `npm run build:test` - Builds a test version with "-test" suffix (e.g., "1.0.4-test") for testing before release
- `npm start` - Runs the MCP server in development mode (requires .env file)
- `npm run inspector` - Launches MCP inspector for debugging tools

### Testing and Formatting
- `npm test` - Runs test suite with Vitest
- `npm run format` - Formats code with Prettier

**IMPORTANT - Running Tests:**
- **ALWAYS use the test-runner-reporter agent** when running tests during development
- DO NOT run `npm test` directly with the Bash tool
- The test-runner-reporter agent provides accurate test counts, detailed analysis, and generates reports
- Use Task tool with subagent_type="test-runner-reporter" instead of raw npm commands

**Example - Correct way to run tests:**
```
Use Task tool:
- subagent_type: "test-runner-reporter"
- prompt: "Run the complete test suite to verify [changes made]. Report total tests, pass/fail status, and any issues."
```

**Why this matters:**
- Raw npm test output is ~10,000 lines and easy to misread
- The agent accurately counts tests (currently 193 tests)
- The agent validates specific changes and provides context-aware analysis
- Eliminates manual counting errors and provides professional reports

### Packaging
- `npx @anthropic-ai/mcpb pack` - Creates .mcpb installer file for Claude Desktop (run after build)
- `npm run pack:test` - Builds test version AND creates .mcpb installer in one command (convenience shortcut)

### Build Variants

**Production Build** (`npm run build`):
- Uses the exact version from package.json (e.g., "1.0.4")
- For final releases and publishing to npm

**Test Build** (`npm run build:test`):
- Appends "-test" to version (e.g., "1.0.4-test")
- Use for testing changes before releasing
- Creates a separate .mcpb installer that won't conflict with production version
- Allows side-by-side installation in Claude Desktop for testing

**Workflow for testing new features:**
```bash
# Quick method (one command):
npm run pack:test
# Builds test version AND creates .mcpb installer

# Or step-by-step:
# 1. Build test version
npm run build:test

# 2. Create test installer
npx @anthropic-ai/mcpb pack
# Creates: pinmeto-location-mcp.mcpb with version "1.0.4-test-{hash}-{timestamp}"

# 3. Install in Claude Desktop and test
# The test version appears separately from production version

# 4. When ready to release, build production version
npm run build
npx @anthropic-ai/mcpb pack
```

### Important Build Notes
- The build process has three steps: `node manifest.js && tsc && cp package.json build/`
- Test builds use `VERSION_POSTFIX=test` environment variable
- Always run the complete build before packaging or testing
- The `build/` directory is gitignored and contains compiled output

## Architecture

### Core Components

**Entry Point (`src/index.ts`)**
- Sets up stdio transport for MCP communication
- Loads environment variables in development mode
- Initializes and connects the MCP server

**Server Core (`src/mcp_server.ts`)**
- `PinMeToMcpServer` extends `McpServer` from @modelcontextprotocol/sdk
- Manages OAuth2 authentication with 59-minute token caching
- Provides utility methods:
  - `makePinMeToRequest(url)` - Single API request with automatic auth
  - `makePaginatedPinMeToRequest(url)` - Handles paginated responses
- The `createMcpServer()` function registers all tools

**Configuration (`src/configs.ts`)**
- Validates required environment variables (PINMETO_ACCOUNT_ID, PINMETO_APP_ID, PINMETO_APP_SECRET)
- Supports development-mode API URL overrides
- Returns immutable config object used throughout the server

### Tool Organization

Tools are organized by domain in separate directories:

**Location Tools (`src/tools/locations/locations.ts`)**
- `get_location` - Fetch single location by storeId
- `get_locations` - Fetch all locations with optional field filtering (uses pagination)

**Network-Specific Tools (`src/tools/networks/`)**
- `google.ts` - Google insights, ratings, and keyword tools (6 tools)
- `facebook.ts` - Facebook location/brandpage insights and ratings (5 tools)
- `apple.ts` - Apple location insights (2 tools)

### Tool Implementation Pattern

Each tool follows this pattern:
```typescript
export function toolName(server: PinMeToMcpServer) {
  server.tool(
    'tool_name',           // snake_case identifier
    'Description',         // Human-readable description
    {                      // Zod schema for parameters
      param: z.string().describe('Param description')
    },
    async ({ param }) => { // Handler function
      const { apiBaseUrl, accountId } = server.configs;
      const data = await server.makePinMeToRequest(url);
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }]
      };
    }
  );
}
```

## API Integration

**Authentication Flow**
1. Server exchanges app credentials for OAuth2 bearer token on first request
2. Token cached for 59 minutes in memory
3. Automatic refresh when token expires

**API Endpoints**
- Base API: `https://api.pinmeto.com`
- Locations API: `https://locations.api.pinmeto.com`
- All requests include custom User-Agent with client and server version info

**Date Format Requirements**
- Most endpoints use `YYYY-MM-DD` format
- Google keywords use `YYYY-MM` format (month granularity only)

**Data Availability & Lag Times**
- ⚠️ **Google insights:** Delayed by ~10 days - request dates at least 10 days in the past
- ⚠️ **Facebook insights:** Delayed by ~3 days - request dates at least 3 days in the past
- ⚠️ **Apple insights:** Delayed by ~4 days - request dates at least 4 days in the past
- ⚠️ **Google keywords:** Updated monthly - data for a given month becomes available a few days after the month ends

## Configuration

**Environment Variables (Required)**
- `PINMETO_ACCOUNT_ID` - Account identifier
- `PINMETO_APP_ID` - Application ID
- `PINMETO_APP_SECRET` - Application secret

**Development-Only Variables (Optional)**
- `NODE_ENV=development` - Enables .env file loading and API URL overrides
- `PINMETO_API_URL` - Override default API base URL
- `PINMETO_LOCATION_API_URL` - Override default locations API URL

## TypeScript Configuration

- Target: ES2022 with Node16 modules
- Output: `build/` directory (mirrors `src/` structure)
- Strict mode enabled with all type checking
- Uses ES modules (.js extensions in imports)

## Testing

- Framework: Vitest with Node environment
- Test files: `tests/**/*.test.ts`
- Automatically sets `NODE_ENV=development` for tests

## Manifest Generation

`manifest.js` generates `manifest.json` for MCPB packaging:
- Pulls version and metadata from package.json
- Defines user configuration schema with validation
- Configures cross-platform compatibility (darwin, win32, linux)
- Sets up environment variable mapping for runtime

## Adding New Tools

1. Create tool function in appropriate `src/tools/` subdirectory
2. Export function following the established pattern
3. Import and register in `createMcpServer()` in `src/mcp_server.ts`
4. Use `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()` for API calls
5. Add test coverage in `tests/`

## Common Development Tasks

**Adding a new network integration:**
1. Create new file in `src/tools/networks/` (e.g., `instagram.ts`)
2. Implement tools following the pattern from existing network files
3. Import and register tools in `src/mcp_server.ts`
4. Update README.md with new tool descriptions

**Modifying API requests:**
- API base URLs are in `src/configs.ts`
- Authentication logic is in `PinMeToMcpServer._getPinMeToAccessToken()`
- Request helpers are in `src/mcp_server.ts` (makePinMeToRequest, makePaginatedPinMeToRequest)

**Debugging:**
- Use `npm run inspector` to test tools interactively
- Check console.error output - server logs to stderr
- Set `NODE_ENV=development` and create .env file for local testing

## Git Best Practices

**Commit Messages:**
- Do NOT reference Claude, Claude Code, or AI assistance in commit messages
- Write clear, professional commit messages that focus on what changed and why
- Use conventional commit format when appropriate (feat:, fix:, docs:, etc.)
- Keep commit messages relevant to the technical changes made

**Example - Good commit message:**
```
Add format parameter to all tools for flexible output

- Implements JSON and Markdown output formats
- Updates tool descriptions with format documentation
- Adds helper functions for Markdown formatting
```

**Example - Avoid:**
```
Add format parameter (suggested by Claude)
Generated with Claude Code
```
