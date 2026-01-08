# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Project Overview

This is an MCP (Model Context Protocol) server that provides AI agents like Claude with access to PinMeTo's location management platform. It exposes tools for fetching location data, insights from Google/Facebook/Apple, ratings, and keywords.

## Environment Configuration

The server requires these environment variables (loaded via `--env-file=.env.local` in npm scripts):
- `PINMETO_ACCOUNT_ID` - PinMeTo account identifier
- `PINMETO_APP_ID` - OAuth application ID
- `PINMETO_APP_SECRET` - OAuth application secret
- `PINMETO_API_URL` - (Optional, dev only) Override API base URL
- `PINMETO_LOCATION_API_URL` - (Optional, dev only) Override locations API base URL

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

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

**Adding Changes (Contributors)**:
```bash
npx changeset add          # Add a changeset for your changes
# Select: major/minor/patch
# Write: summary (appears in CHANGELOG)
git add .changeset/ && git commit -m "docs: add changeset"
```

**⚠️ REQUIRED**: Every PR must include a changeset. CI will reject PRs without one.

**Version Guidelines**:
- **patch**: Bug fixes, documentation, internal changes
- **minor**: New features, enhancements (backwards compatible)
- **major**: Breaking changes (API changes, removed features)

**Release Commands**:
```bash
npm run release:prepare    # Preview pending changesets
npm run release:version    # Bump version + update CHANGELOG + README badges
npm run release:draft      # Test, build, pack, create draft GitHub release
npm run release:publish    # Publish the draft release (or use GitHub UI)
npm run clean              # Remove build directory
```

**Release Flow (Maintainers)**:
1. Run `npm run release:prepare` to see pending changes
2. Run `npm run release:version` to apply version bump
3. Commit: `git add -A && git commit -m "chore: release vX.Y.Z"`
4. Run `npm run release:draft` to create draft release
5. Review draft on GitHub, then run `npm run release:publish`
6. Push: `git push && git push --tags`

## Beads Workflow (CRITICAL)

**Bead Statuses:**
| Status | Description |
|--------|-------------|
| `open` | New/pending work, not yet started |
| `in_progress` | Currently being worked on |
| `blocked` | Waiting on dependency or external blocker |
| `closed` | Completed |

**Hierarchical IDs** (for epics with tasks/sub-tasks):
```
bd-a3f8       # Epic
bd-a3f8.1     # Task under epic
bd-a3f8.1.1   # Sub-task under task
```

**Protected Branch Workflow:**

This project uses a separate `beads-sync` branch for beads metadata:
- Beads daemon auto-commits to `beads-sync` (not main)
- Main branch stays protected from beads auto-commits
- Beads changes are merged to main periodically

```bash
# Check sync status
bd sync --status

# Merge beads changes to main (when needed)
bd sync --merge --dry-run  # Preview
bd sync --merge            # Execute merge to main
```

**Important**: `bd sync` commits to `beads-sync` branch, NOT main. Code changes and beads changes are separate workflows.

```bash
# Create a main bead (epic or feature) with description (REQUIRED)
bd create "Implement user authentication" -t epic -p 1 \
  -d "Add OAuth2 authentication flow with JWT tokens. Includes login, logout, and session management.

## Completion Checklist
- [ ] Implementation complete
- [ ] Tests added and passing
- [ ] Manual testing performed
- [ ] README.md updated (if applicable)
- [ ] Other documentation updated (if applicable)"

# Create sub-tasks under the main bead using --parent
bd create "Set up OAuth2 provider" -t task --parent bd-xxxx \
  -d "Configure OAuth2 provider settings and environment variables."
bd create "Implement login endpoint" -t task --parent bd-xxxx \
  -d "Create POST /auth/login endpoint with credential validation."
bd create "Add session management" -t task --parent bd-xxxx \
  -d "Implement JWT token generation and refresh logic."

# Update issues
bd update bd-a1b2 --status in_progress

# Close issues
bd close bd-a1b2 "Completed authentication"
```

**Critical Rules:**
- Create a bead BEFORE starting any work (not after)
- Create a feature branch BEFORE making any code changes
- Do not set a bead to closed before its PR has been approved
- When starting on a new bead, set it to in-progress and assign it to the current git user
- Always create a new bead(s) for new tasks/issues/fixes so all changes are tracked
- NEVER commit directly to main - always use feature branches and PRs

**Bead Creation Rules:**
- **ALWAYS include a description (`-d`)** - Never create a bead with just a title
- **Use hierarchical structure** - Create a main bead (epic/feature) then sub-tasks with `--parent`
- **Main beads must include a completion checklist** in the description
- **Available types:** `bug|feature|task|epic|chore`

**Main Bead Description Template:**
```
<Brief description of the feature/task>

## Completion Checklist
- [ ] Implementation complete
- [ ] Tests added and passing
- [ ] Manual testing performed
- [ ] README.md updated (if applicable)
- [ ] Other documentation updated (if applicable)
```

## AI Agent Workflow (MANDATORY)

When an AI agent receives a task that requires implementation:

1. **Plan First** - Analyze the task and create an implementation plan
2. **Create Main Bead** - Create an epic/feature bead for the overall task with full description
3. **Break Down Plan** - Create sub-task beads for each step of the plan using `--parent`
4. **Then Implement** - Only start coding after all beads are created

**Example workflow:**
```bash
# Step 1: Agent analyzes task and creates plan
# Plan: 1) Add API endpoint, 2) Create UI component, 3) Write tests

# Step 2: Create main bead
bd create "Add search functionality" -t feature -p 2 \
  -d "Implement search feature allowing users to find locations by name.

## Completion Checklist
- [ ] Implementation complete
- [ ] Tests added and passing
- [ ] Manual testing performed
- [ ] README.md updated (if applicable)
- [ ] Other documentation updated (if applicable)"

# Step 3: Break down plan into sub-tasks (returns bd-xxxx)
bd create "Add search API endpoint" -t task --parent bd-xxxx \
  -d "Create GET /api/search endpoint with query parameter."
bd create "Create search UI component" -t task --parent bd-xxxx \
  -d "Build search input with results dropdown."
bd create "Write search tests" -t task --parent bd-xxxx \
  -d "Add unit and integration tests for search functionality."

# Step 4: Now start implementing (create feature branch first!)
```

⚠️ **NEVER start implementing before creating beads for the plan**

## Feature Development Workflow (MANDATORY)

Before starting ANY feature, bug fix, or enhancement, follow this workflow:

### Step 1: Create or Claim a Bead
```bash
# Create main bead with full description (types: bug|feature|task|epic|chore)
bd create "Add user profile page" -t feature -p 2 \
  -d "Create user profile page showing account details and settings.

## Completion Checklist
- [ ] Implementation complete
- [ ] Tests added and passing
- [ ] Manual testing performed
- [ ] README.md updated (if applicable)
- [ ] Other documentation updated (if applicable)"

# Break down into sub-tasks using --parent
bd create "Create profile API endpoint" -t task --parent <main-bead-id> \
  -d "Add GET /api/user/profile endpoint returning user data."
bd create "Build profile UI component" -t task --parent <main-bead-id> \
  -d "Create React component for displaying profile information."

# Or claim existing bead
bd update <id> --status in_progress --assignee=$(git config user.name)
```

### Step 2: Create Feature Branch
```bash
# NEVER work directly on main
git checkout main
git pull origin main
git checkout -b <branch-name>  # e.g., feature/add-apple-ratings, fix/auth-timeout
```

**Branch Naming Convention:**
- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `refactor/<description>` - Code refactoring
- `docs/<description>` - Documentation only

### Step 3: Do the Work
- Make commits to your feature branch
- Run tests: `npm test`
- Run build: `npm run build`

### Step 4: Create Pull Request
```bash
# Push branch and create PR
git push -u origin <branch-name>
gh pr create --title "feat: description" --body "Closes #<bead-id>"
```

### Step 5: Get PR Approved
- Request review
- Address feedback
- **NEVER merge without approval**

### Step 6: Merge and Clean Up
```bash
# After PR approval
gh pr merge --squash  # or via GitHub UI
git checkout main
git pull origin main
bd close <id>
bd sync
```

⚠️ **WORKFLOW CRITICAL RULES:**
- NEVER commit directly to main without explicit user approval
- ALWAYS create a feature branch for any code changes
- ALWAYS create a bead BEFORE starting work
- ALWAYS create a PR for features and fixes

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
    'pinmeto_get_location',
    {
      description: 'Get details for a SINGLE location by store ID',
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

**Time Aggregation & Comparison** (`src/helpers.ts`) - Client-side metric processing:
- `aggregateInsights()` - Aggregate metrics by time period (daily, weekly, monthly, quarterly, half-yearly, yearly, total)
- `calculatePriorPeriod()` - Calculate date ranges for MoM/QoQ/YoY comparisons
- `finalizeInsights()` - Merge comparison data and format response with metadata
- Defaults to `total` aggregation and `none` comparison for maximum token efficiency

### Directory Structure

```
src/
├── index.ts              # Entry point, sets up stdio transport
├── mcp_server.ts         # Server class and tool registration
├── configs.ts            # Environment config validation
├── helpers.ts            # Time aggregation and response formatting
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

## Tool Naming Convention

All tools follow the MCP best practice naming pattern: `pinmeto_{action}_{network}_{resource}`

| Pattern | Example | Description |
|---------|---------|-------------|
| `pinmeto_get_{resource}` | `pinmeto_get_location` | Single resource retrieval |
| `pinmeto_get_{resource}s` | `pinmeto_get_locations` | Bulk resource retrieval (ALL) |
| `pinmeto_search_{resource}s` | `pinmeto_search_locations` | Search/discovery tools |
| `pinmeto_get_{network}_{resource}` | `pinmeto_get_google_insights` | Network-specific data (single or all) |

### Available Tools (12 total)

| Tool | Description |
|------|-------------|
| `pinmeto_get_location` | Single location by storeId |
| `pinmeto_get_locations` | All locations (paginated, cached) |
| `pinmeto_search_locations` | Search locations |
| `pinmeto_get_google_insights` | Google metrics with aggregation and period comparison |
| `pinmeto_get_google_ratings` | Google rating aggregates (averageRating, totalReviews, distribution) |
| `pinmeto_get_google_reviews` | Google reviews with pagination and filtering (for sentiment analysis) |
| `pinmeto_get_google_keywords` | Google keywords (storeId optional) |
| `pinmeto_get_google_review_insights` | AI-powered review analysis (requires MCP Sampling support) |
| `pinmeto_get_facebook_insights` | Facebook metrics with aggregation and period comparison |
| `pinmeto_get_facebook_brandpage_insights` | Facebook brand page metrics with aggregation and period comparison |
| `pinmeto_get_facebook_ratings` | Facebook ratings (storeId optional) |
| `pinmeto_get_apple_insights` | Apple metrics with aggregation and period comparison |

**Unified Single/Bulk Pattern**: Network tools accept an optional `storeId` parameter:
- **Without storeId**: Fetch data for all locations
- **With storeId**: Fetch data for a single location

**Insights Tools Parameters**: All insights tools support these additional parameters:
- `aggregation`: Time aggregation level (`total`, `daily`, `weekly`, `monthly`, `quarterly`, `half-yearly`, `yearly`)
- `compare_with`: Period comparison mode (`none`, `prior_period`, `prior_year`)

**Ratings vs Reviews Split** (Google):
- `pinmeto_get_google_ratings`: Returns aggregate statistics (averageRating, totalReviews, distribution) - lightweight for context efficiency
- `pinmeto_get_google_reviews`: Returns individual reviews with text for sentiment analysis - supports:
  - **Pagination**: `limit` (default: 50, max: 500), `offset`
  - **Rating filter**: `minRating`, `maxRating` (1-5)
  - **Response filter**: `hasResponse` (true for responded, false for unresponded)
  - **Caching**: Shared 5-minute cache with ratings tool, `forceRefresh` to bypass

## Adding New Tools

1. Create tool registration function in appropriate module under `src/tools/`
2. **Name the tool** following the `pinmeto_{action}_{network}_{resource}` pattern
3. Define Zod schema for input validation
4. Add `response_format: ResponseFormatSchema` to input schema
5. Define or reuse output schema from `src/schemas/output.ts`
6. Implement handler using `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()`
7. Use `formatContent()` helper to format response based on `response_format`
8. Return both `content` (text) and `structuredContent` (typed data) from handler
9. For insights tools, use `aggregateInsights()` and `finalizeInsights()` helpers
10. Add appropriate tool annotations (see Tool Annotations section below)
11. Register tool in `createMcpServer()` function in `src/mcp_server.ts`

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

- **InsightsOutputSchema** - For Google, Facebook, and Apple insights tools (supports aggregation and comparison)
- **RatingsOutputSchema** - For ratings tools across all networks
- **KeywordsOutputSchema** - For Google keywords tools
- **LocationOutputSchema** - For single location retrieval
- **LocationsOutputSchema** - For multiple locations with pagination status
- **SearchResultOutputSchema** - For lightweight search results with pagination metadata

### Insights Response Structure

Insights tools return data with metadata about aggregation and comparison:

```typescript
// Total aggregation (default) - single value per metric
{
  insights: [
    {
      metric: "views",
      value: 1500,
      priorValue?: 1200,      // Only with compare_with
      delta?: 300,            // Absolute change
      deltaPercent?: 25       // Percentage change
    }
  ],
  periodRange: { from: "2024-01-01", to: "2024-01-31" },
  priorPeriodRange?: { from: "2023-01-01", to: "2023-01-31" },  // Only with compare_with
  timeAggregation: "total",
  compareWith: "prior_year"  // or "prior_period" or "none"
}

// Time series aggregation (daily, weekly, monthly, etc.)
{
  insights: [
    {
      metric: "views",
      values: [
        {
          period: "2024-01",
          periodLabel: "January 2024",
          value: 500,
          priorValue?: 400,
          delta?: 100,
          deltaPercent?: 25
        }
      ]
    }
  ],
  periodRange: { from: "2024-01-01", to: "2024-12-31" },
  timeAggregation: "monthly",
  compareWith: "none"
}
```

### Output Pattern

All tools return both `content` (text representation) and `structuredContent` (typed data):

```typescript
// Success response
return {
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: { data: aggregatedData }
};

// Error response (MCP compliant)
return {
  isError: true,  // MCP error flag
  content: [{ type: 'text', text: 'Error: Resource not found. Verify the store ID exists.' }],
  structuredContent: {
    error: 'Error: Resource not found. Verify the store ID exists.',
    errorCode: 'NOT_FOUND',
    retryable: false
  }
};
```

### Error Handling

All tools return structured errors following MCP best practices:

**Error Response Fields:**
- `isError: true` - MCP flag indicating an error response
- `error`: Human-readable message prefixed with "Error:" for MCP compliance
- `errorCode`: One of: `AUTH_INVALID_CREDENTIALS`, `AUTH_APP_DISABLED`, `BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `SERVER_ERROR`, `NETWORK_ERROR`, `UNKNOWN_ERROR`
- `retryable`: `true` if the operation can be retried (rate limits, server errors, network issues)

**Error Code Meanings:**

| Code | HTTP Status | Retryable | Guidance |
|------|-------------|-----------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | No | Check PINMETO_APP_ID and PINMETO_APP_SECRET |
| `AUTH_APP_DISABLED` | 403 | No | Contact PinMeTo support |
| `BAD_REQUEST` | 400 | No | Check date formats and store IDs |
| `NOT_FOUND` | 404 | No | Verify the store ID exists |
| `RATE_LIMITED` | 429 | Yes | Wait before retrying (includes Retry-After timing) |
| `SERVER_ERROR` | 500/502/503/504 | Yes | Try again later |
| `NETWORK_ERROR` | N/A | Yes | Check network (specific guidance for timeout/DNS/connection) |
| `UNKNOWN_ERROR` | Various | No | Check error message for details |

AI agents should use `errorCode` for programmatic handling and `retryable` to decide retry strategy.

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

Use `pinmeto_search_locations` for quick location discovery, then `pinmeto_get_location` for full details:

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

`pinmeto_get_locations` supports pagination, filtering, and uses an in-memory cache for efficient queries on large datasets (5000+ locations).

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

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH AND CREATE PR** - This is MANDATORY:
   ```bash
   # If on feature branch (normal case):
   git push -u origin <branch-name>
   gh pr create --title "..." --body "..."  # If PR doesn't exist
   bd sync

   # If on main (only for documentation-only changes with user approval):
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Sync beads metadata** (if beads were updated):
   ```bash
   bd sync              # Commits to beads-sync branch
   bd sync --merge      # Optional: merge beads to main if desired
   ```
6. **Clean up** - Clear stashes, prune remote branches
7. **Verify** - All changes committed AND pushed
8. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- NEVER push directly to main for code changes - use feature branches and PRs
- Documentation-only changes MAY go to main with explicit user approval
- Always ask user before any direct main branch operations

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
