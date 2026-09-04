# Changelog

All notable changes to this project will be documented in this file.

## [4.2.0] - 2026-09-04

### Added

- Serve MCP protocol revision 2026-07-28 over stdio while retaining legacy client support. Preserve request-scoped client identity in outbound PinMeTo API User-Agent headers for both protocol eras. (`25e6a83`)

## [4.1.1] - 2026-09-02

### Fixed

- Fix the `.mcpb` installer bundle. The first v4.1.0 asset failed to install in Claude Desktop ("Unsafe file path detected ... Path traversal or absolute paths are not allowed") because the packer bundled an untracked local directory containing files named `review-<sha>..<sha>.diff`. It would also have crashed on startup: an unanchored `dist` rule in `.mcpbignore` matched `node_modules/*/dist` and stripped the SDK's compiled files. `.mcpbignore` is now a deny-by-default allowlist that ships only the runtime (`build/`, `node_modules/`, `package.json`, `manifest.json`, icon, README, LICENSE), and `release:draft` and `pack:test` now run `scripts/verify-mcpb.mjs`, which rejects unsafe paths and unexpected top-level entries and starts the packed server to confirm it answers `tools/list`. The published v4.1.0 asset was rebuilt and replaced. (`2d0cdb4`)

## [4.1.0] - 2026-09-02

### Added

- Add a single-file esbuild bundle build target for plugin distribution, and resolve the package name and version at build time instead of reading package.json at runtime. (`03a315c`)

### Fixed

- Add display titles to all 12 tools and document the privacy policy, both required for directory submission. (`03a315c`)
- Fix every tool call failing in Claude Desktop with "invalid outputSchema: JSON Schema declares an unsupported dialect (draft-07)". The v1 MCP SDK (`@modelcontextprotocol/sdk` 1.30.0) emitted draft-07 on every `inputSchema` and `outputSchema` with no way to opt into 2020-12 (modelcontextprotocol/typescript-sdk#2084), and Claude Desktop now rejects that dialect. Migrated to the v2 SDK (`@modelcontextprotocol/server` 2.0.0) and Zod 4, which advertise JSON Schema 2020-12 on all 12 tools. Requires Node 20 or newer. (`c374497`)

## [4.0.0] - 2026-07-30

### Changed

- Remove MCP Sampling support and stop overriding the SDK's `initialize` handler. (`7bc9e96`)

### Added

- Advertise MCP spec 2025-11-25 `Implementation` metadata on `serverInfo`: a human-readable `description` and a `websiteUrl`. (`903070f`)

### Fixed

- Clear every open dependency advisory. Both scanners now report zero: **Dependabot 7 alerts → 0**, **`npm audit` 6 findings → 0**. (`ac50769`)
- Resolve Dependabot security alerts by updating dependencies. Raised the `axios` range floor to `^1.16.0` (resolving to 1.18.1 in the lockfile; fixes prototype pollution, proxy credential leak, ReDoS, MITM) and refreshed transitive dependencies in the lockfile: `form-data` 4.0.6, `hono` 4.12.27, `qs` 6.15.2, `fast-uri` 3.1.2 (runtime), plus dev tooling `vite` 7.3.5 and `vitest` 3.2.6 (fixes the critical Vitest UI file-read/exec advisory). Clears all 1 critical and 10 high severity alerts. (`2a85969`)
- Fix `-32602` output-validation crash in `pinmeto_get_google_ratings`. A single-store query for a period with no reviews returned `averageRating: 0`, which the ratings output schema rejected (`averageRating` had a `min(1)` floor), killing the call. The floor is relaxed to `min(0)` so a zero-review store returns a clean summary (`averageRating: 0, totalReviews: 0`) instead of failing. The all-locations path was unaffected because it omits stores with no reviews. (`2c72cfb`)
- Unblock `@modelcontextprotocol/sdk` upgrades (now on 1.29.0). (`9941b2a`)

## [3.2.2] - 2026-02-06

### Fixed

- fix: update dependencies to resolve security vulnerabilities (`6d9eadb`)

## [3.2.1] - 2026-01-19

### Fixed

- Update hono transitive dependency to 4.11.4 to fix HIGH severity JWT algorithm confusion vulnerabilities in unused middleware (CVE-2026-22818, CVE-2026-22817) (`bcfe5d8`)
- Restructure documentation for non-technical users with simplified README and dedicated docs folder (`2e21bbb`)

## [3.2.0] - 2026-01-08

### Added

- Split Google ratings into separate ratings and reviews tools (`37cd73a`)

### Fixed

- fix: improve MCP Sampling detection to check client capabilities (`8cc39bf`)
- Fix incomplete regex sanitization in release script (CodeQL alert #7) (`0854ca6`)
- Fix high severity security vulnerabilities (CVE-2024-3127, CVE-2025-29927): (`d162bc6`)

## [3.1.0] - 2025-12-22

### Added

- **Period Comparison Support** ([#30](https://github.com/PinMeTo/pinmeto-location-mcp/pull/30)): All insights tools (Google, Facebook, Apple) now support a `compare_with` parameter:
  - `compare_with="prior_period"` - Compare with same-duration period immediately before (MoM for monthly, QoQ for quarterly)
  - `compare_with="prior_year"` - Compare with same dates in previous year (YoY)
  - Returns `priorValue`, `delta`, and `deltaPercent` for each metric
- **Human-Readable Period Labels**: Aggregated metrics now include a `periodLabel` field:
  - "2024-01" → "January 2024"
  - "2024-Q1" → "Q1 2024"
  - "2024-H1" → "H1 2024"
- **Google Data Lag Warnings**: Google tools validate the `to` date and return a warning if data may be incomplete due to Google's ~10 day reporting lag
- **Concrete Output Schemas** ([#27](https://github.com/PinMeTo/pinmeto-location-mcp/pull/27)): Replace z.unknown() with concrete Zod schemas for better type safety
  - Add `AddressSchema`, `ContactSchema`, `OpenHoursSchema` for location data
  - Add `KeywordDataSchema` for Google keywords API
  - Add `RatingsSummarySchema`, `ReviewSchema`, `LocationRatingsSummarySchema` for ratings data
- **Improved Error Messages** ([#28](https://github.com/PinMeTo/pinmeto-location-mcp/pull/28)): MCP-compliant error handling with actionable guidance
  - Add `isError: true` flag and "Error:" prefix to all error responses
  - Enhance network error specificity for timeout/DNS/connection failures
  - Add Retry-After header parsing for rate limit errors

### Changed

- Enhanced markdown output with comparison tables (Period | Current | Prior | Change | % Change)
- Migrate release tooling from release-it to Changesets
- Add CI check to require changesets on pull requests

## [3.0.0] - 2025-12-21

### BREAKING CHANGES

- **Tool Consolidation**: Merged 7 single-location tools into their bulk counterparts (17 → 10 tools)
  - Network tools now accept optional `storeId` parameter
  - Without `storeId`: fetch data for all locations
  - With `storeId`: fetch data for single location
  - ~44% reduction in context tokens (~5,500 tokens saved per request)

- **Removed Tools** (use base tool with `storeId` parameter instead):
  - `pinmeto_get_google_insights_location` → `pinmeto_get_google_insights`
  - `pinmeto_get_google_ratings_location` → `pinmeto_get_google_ratings`
  - `pinmeto_get_google_keywords_location` → `pinmeto_get_google_keywords`
  - `pinmeto_get_facebook_insights_location` → `pinmeto_get_facebook_insights`
  - `pinmeto_get_facebook_ratings_location` → `pinmeto_get_facebook_ratings`
  - `pinmeto_get_apple_insights_location` → `pinmeto_get_apple_insights`

- **Removed Prompts**: Prompts capability removed entirely
  - `pinmeto_analyze_location`
  - `pinmeto_summarize_insights`

### Changed

- Tool descriptions updated to reflect unified single/bulk pattern
- Documentation updated with migration guide and new tool patterns

### Added

- Test coverage for consolidated tools with optional `storeId` behavior ([#26](https://github.com/PinMeTo/pinmeto-location-mcp/pull/26))

## [2.0.0] - 2025-12-21

### BREAKING CHANGES

- **Tool Naming**: All 16 tools renamed with `pinmeto_` prefix following MCP best practices
  - Location tools: `get_location` → `pinmeto_get_location`, etc.
  - Network tools follow pattern: `pinmeto_get_{network}_{resource}[_location]`
  - Single-location tools use `_location` suffix for clarity
  - See [MIGRATION.md](MIGRATION.md) for complete mapping

- **Prompt Naming**: All 2 prompts renamed with `pinmeto_` prefix
  - `analyze location` → `pinmeto_analyze_location`
  - `summarize all insights` → `pinmeto_summarize_insights`

### Changed

- Tool descriptions now explicitly state scope ("ALL locations" vs "SINGLE location")
- Documentation updated with new tool names and naming convention section

## [1.1.0] - 2025-12-21

### Added

- **Pagination, filtering, and caching** for `get_locations` tool with 5-minute TTL cache ([#20](https://github.com/PinMeTo/pinmeto-location-mcp/pull/20))
- **`search_locations`** lightweight discovery tool for quick location lookup ([#19](https://github.com/PinMeTo/pinmeto-location-mcp/pull/19))
- **Output schemas** (Zod) for all 15 tools with `structuredContent` returns ([#18](https://github.com/PinMeTo/pinmeto-location-mcp/pull/18))
- **Tool annotations** (`readOnlyHint`, etc.) for better AI agent planning ([#17](https://github.com/PinMeTo/pinmeto-location-mcp/pull/17))
- **Time aggregation** for insights tools (daily, weekly, monthly, quarterly, yearly, total) with `total` as default ([#10](https://github.com/PinMeTo/pinmeto-location-mcp/pull/10))
- **Structured error handling** for API requests with typed error responses ([#23](https://github.com/PinMeTo/pinmeto-location-mcp/pull/23))
- **Automated release workflow** with release-it and conventional commits
- One-click install badges for VS Code and Cursor ([#21](https://github.com/PinMeTo/pinmeto-location-mcp/pull/21))

### Changed

- Remove duplicate type definitions from helpers.ts ([#22](https://github.com/PinMeTo/pinmeto-location-mcp/pull/22))
- Remove dotenv dependency in favor of Node's native `--env-file` flag ([#14](https://github.com/PinMeTo/pinmeto-location-mcp/pull/14))
- Add cross-platform build cleaning with prepare script ([#11](https://github.com/PinMeTo/pinmeto-location-mcp/pull/11))
- Add explicit permissions to GitHub Actions workflows ([#13](https://github.com/PinMeTo/pinmeto-location-mcp/pull/13))

### Fixed

- Replace hardcoded PACKAGE_VERSION with dynamic import from package.json

### Security

- Bump body-parser from 2.2.0 to 2.2.1 ([#16](https://github.com/PinMeTo/pinmeto-location-mcp/pull/16))
- Bump vite from 7.1.7 to 7.1.11 ([#12](https://github.com/PinMeTo/pinmeto-location-mcp/pull/12))

### Dependencies

- Bump @modelcontextprotocol/sdk from 1.18.0 to 1.24.0 ([#15](https://github.com/PinMeTo/pinmeto-location-mcp/pull/15))

## [1.0.0] - 2025-09-25

Initial release

### Added

- Location API integrations:
  - `Get Location` - Get pinmeto data on single location.
  - `Get Locations` - Get all location data for site.
- Network location insights:
  - `All Google Insights` - Get all Google insights for site locations.
  - `Google Location Insights` - Get Google location insights for specific location.
  - `Google Location Ratings` - Get Google location ratings for specific location.
  - `All Google Keywords` - Get all Google keywords for your locations.
  - `Google Location Keywords` - Get Google location keywords for a specific location.
  - `All Facebook Insights` - Get all Facebook location insights for specific location.
  - `Facebook Location Insights` - Get Facebook location insights for specific location.
  - `Facebook Brandpage Insights` - Get Facebook insights for specific brandpage.
  - `Facebook Location Ratings` Get Facebook location ratings for specific location.
  - `All Apple Insights` Get all Apple location insights for site locations.
  - `Apple Location Insights` Get Apple location insights for specific location.
