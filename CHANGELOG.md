# Changelog

## 1.0.4 - 2025-10-18

### Added
- Smart data aggregation system with 6 levels (daily/weekly/monthly/quarterly/yearly/total) - reduces token usage by 97-99%
- MCP tool annotations (readOnlyHint, idempotentHint, openWorldHint)

### Changed
- Default format changed from `json` to `markdown`
- Markdown formatters completely redesigned - 40-85% token reduction
- Insights now show categorized metrics with only non-zero values
- Ratings display with stars, distribution bars, and recent reviews
- Keywords show top 15 by impressions
- Locations show condensed format with emojis and status badges

## 1.0.3 - 2025-10-17

### Added
- Format parameter on all tools (`json` or `markdown`)
- Pagination control with `maxPages` parameter on `get_locations`
- Response truncation (100k character limit)
- Input validation with regex for date parameters
- Comprehensive tool descriptions with use cases and examples

### Changed
- Enhanced error messages with actionable troubleshooting steps

### Fixed
- GitHub npx installation - added `prepare` script to auto-build after install

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
