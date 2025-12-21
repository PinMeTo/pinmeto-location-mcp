# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
