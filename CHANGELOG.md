# Changelog

## 1.0.3 - 2025-10-17

Major improvements to MCP server based on mcp-builder best practices verification.

### Added

- **Format Parameter**: All tools now support `format` parameter with options:
  - `json` (default) - Returns raw API data
  - `markdown` - Returns human-readable formatted summaries
- **Pagination Control**: Added `maxPages` parameter to `get_locations` tool (1-10 pages, helps manage large datasets)
- **Response Truncation**: Implemented 100k character limit (~25k tokens) to prevent context overflow
- **Helper Functions**: New utility functions in `src/helpers.ts`:
  - `truncateResponse()` - Smart response size management
  - `formatLocationMarkdown()` - Human-readable location data
  - `formatInsightsMarkdown()` - Formatted insight summaries
  - `formatRatingsMarkdown()` - Formatted rating data
  - `formatKeywordsMarkdown()` - Formatted keyword data

### Enhanced

- **Tool Descriptions**: All 15 tools now include:
  - Comprehensive documentation on what data is returned
  - Clear use cases and workflow guidance
  - When to use each tool
  - Example scenarios
  - Date format requirements and data availability notes

- **Input Validation**: Added regex validation for all date parameters:
  - `YYYY-MM-DD` format for insights and ratings tools
  - `YYYY-MM` format for Google keyword tools
  - Clear validation error messages with format examples

- **Error Messages**: Transformed generic errors into actionable guidance:
  - Troubleshooting steps for common issues
  - Next steps and suggestions
  - Educational context for AI agents
  - References to related tools

### Fixed

- **GitHub npx installation**: Added `prepare` script to automatically build the project when installing from GitHub ([#6](https://github.com/PinMeTo/pinmeto-location-mcp/issues/6))
  - Previously `npx github:PinMeTo/pinmeto-location-mcp` would fail because build/ directory was gitignored
  - The prepare script now runs `npm run build` automatically after installation
  - Enables one-command installation directly from GitHub

### Documentation

- Added `MCP_IMPROVEMENTS.md` - Progress tracker with before/after comparison
- Added `TESTING_CHECKLIST.md` - Comprehensive testing guide
- Added `.env.example` - Configuration template
- Updated `CLAUDE.md` - Complete development guide

### Technical

- Updated `makePaginatedPinMeToRequest()` to support optional maxPages parameter
- Improved error handling across all network integration tools
- Version number now dynamically loaded from package.json (single source of truth)
- Added `clean` script with rimraf for cross-platform build cleanup
- Enhanced package.json metadata:
  - Added comprehensive keywords for npm discoverability
  - Added files field to control published content
  - Added engines field requiring Node.js >=18.0.0
- Score improvement: 6.5/10 → 9.5/10 based on mcp-builder evaluation

## 1.0.0 - 2025-09-25

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
