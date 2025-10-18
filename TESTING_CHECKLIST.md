# Testing Checklist for MCP Server Improvements

## ✅ Build & Setup
- [ ] `npm run build` completes without errors
- [ ] `build/` directory contains compiled files
- [ ] `npm run inspector` launches successfully

## ✅ Tool Descriptions
- [ ] Inspector shows comprehensive descriptions for all tools
- [ ] Each tool description includes:
  - [ ] What data it returns
  - [ ] When to use it
  - [ ] Workflow examples
  - [ ] Example use cases

## ✅ Input Validation

### Date Validation (YYYY-MM-DD)
- [ ] Valid date "2024-01-15" works
- [ ] Invalid date "01/15/2024" shows validation error
- [ ] Invalid date "2024-1-5" shows validation error
- [ ] Error message suggests correct format

### Date Validation (YYYY-MM for keywords)
- [ ] Valid month "2024-01" works for keyword tools
- [ ] Invalid format "2024-01-15" shows validation error
- [ ] Error message explains month-only format

### Other Validation
- [ ] Empty storeId shows validation error
- [ ] maxPages outside 1-10 range shows validation error

## ✅ Format Parameter

### Test with get_location
- [ ] Default (no format param) returns JSON
- [ ] `format: "json"` returns JSON
- [ ] `format: "markdown"` returns human-readable markdown
- [ ] Markdown includes headers, sections, and formatting

### Test with insights tools
- [ ] `format: "json"` returns raw API data
- [ ] `format: "markdown"` returns formatted summary

## ✅ Error Messages

### Test with invalid storeId
- [ ] Error message includes "Troubleshooting steps" section
- [ ] Error message lists "Common issues"
- [ ] Error message suggests next steps
- [ ] Error mentions using get_locations to verify

### Test with invalid date range
- [ ] Error explains date format requirement
- [ ] Error suggests checking date range
- [ ] Error is actionable (not generic)

### Test with missing data
- [ ] Error explains why data might not be available
- [ ] Error doesn't just say "Unable to fetch"

## ✅ Pagination Control

### Test get_locations with maxPages
- [ ] Without maxPages: fetches all pages
- [ ] `maxPages: 1`: stops after 1 page
- [ ] `maxPages: 3`: stops after 3 pages
- [ ] Response indicates if more pages available

## ✅ Character Limits

### Test with large response
- [ ] Small responses return complete data
- [ ] Very large responses get truncated
- [ ] Truncated responses include message about truncation
- [ ] Message suggests using filters

## ✅ Workflow Testing

### Complete workflow test
1. [ ] Get all locations: `get_locations`
2. [ ] Pick a storeId from results
3. [ ] Get location details: `get_location` with that storeId
4. [ ] Get insights: `get_google_location_insights` with storeId and dates
5. [ ] Try markdown format: Same with `format: "markdown"`
6. [ ] Compare platforms: Get Facebook and Apple insights for same location

### Cross-tool consistency
- [ ] All network tools accept same date format
- [ ] All tools with storeId parameter work consistently
- [ ] All tools with format parameter work consistently
- [ ] Error messages are consistent across tools

## ✅ Claude Desktop Integration

### Installation
- [ ] MCPB pack creates .mcpb file
- [ ] Double-clicking .mcpb opens Claude Desktop
- [ ] Configuration form appears
- [ ] Can enter API credentials
- [ ] Server appears in Claude Desktop tools list

### Usage in Claude Desktop
- [ ] Claude can discover and list tools
- [ ] Claude understands tool descriptions
- [ ] Claude correctly uses workflow (get_locations first)
- [ ] Claude uses format parameter appropriately
- [ ] Claude handles errors gracefully

## ✅ Performance

- [ ] Tools respond within reasonable time (<30s for most)
- [ ] Pagination doesn't timeout
- [ ] Large responses don't crash the server
- [ ] Multiple requests in sequence work correctly

## 📝 Notes

**Test Environment:**
- Node version:
- MCP SDK version: 1.18.0
- Date of testing:
- Tester name:

**Issues Found:**
(Document any issues discovered during testing)

**Additional Observations:**
(Any other notes about the testing experience)
