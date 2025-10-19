# PinMeTo Location MCP

The [PinMeTo](https://www.pinmeto.com/) MCP Server enables seamless integration between the [PinMeTo platform](https://places.pinmeto.com/) and AI agents such as Claude LLM, allowing users to interact with their location data and business insights through natural language. This server exposes a suite of tools that let you retrieve, analyze, and summarize data from PinMeTo, through multiple sources—including Google, Facebook, and Apple—covering metrics such as impressions, clicks, ratings, and more.

---

## Installation

### One-Click Installation for Claude Desktop

**Step 1:** Download the latest installer

Visit the [Releases page](https://github.com/PinMeTo/pinmeto-location-mcp/releases) and download the latest `.mcpb` file:

📦 **[Download Latest Release →](https://github.com/PinMeTo/pinmeto-location-mcp/releases/latest)**

**Step 2:** Install in Claude Desktop

1. Double-click the downloaded `.mcpb` file (Claude Desktop must be open)
2. Enter your PinMeTo API credentials when prompted:
   - Get your credentials from [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3)
   - You'll need: Account ID, App ID, and App Secret

<img width="655" height="596" alt="PinMeTo MCP Installation" src="https://github.com/user-attachments/assets/30af64b3-81c3-4bb1-9b05-656831004757" />

**Step 3:** Enable and use

Enable the PinMeTo connector in Claude Desktop. You can now interact with your location data through natural language!

---

**For developers:** Want to build from source or contribute? See [BUILDING.md](BUILDING.md) for development instructions.

---

## Quick Start

Once installed, here's how to get started with PinMeTo MCP:

### 1. Find Your Locations
```
"Show me all my locations"
```
This returns storeIds you'll need for other queries.

### 2. Get a Quick Overview
```
"Get complete overview for store [storeId] for last month"
```
Returns location details, network links, and insights from all platforms in one call.

### 3. Generate Reports

**For all locations:**
```
"Get multi-platform insights for all locations from [start-date] to [end-date]"
```

**Year-over-year comparison:**
```
"Compare current quarter to same quarter last year for all platforms"
```

**Remember:** Account for data lag when selecting dates:
- Google: 10 days
- Facebook: 3 days
- Apple: 4 days

---

## Available Tools

The PinMeTo MCP Server provides 18 comprehensive tools organized by category. All tools support both JSON (raw data) and Markdown (human-readable summaries) output formats.

> **✨ New: Smart Data Aggregation**
>
> All insight tools now support automatic data aggregation to reduce context usage by up to 97%! By default, daily data is aggregated into totals, but you can also request weekly, monthly, quarterly, or yearly breakdowns. See [Aggregation Feature](#aggregation-feature) for details.

> **⚠️ Important: Data Availability Lag**
>
> Insights data from different platforms have varying delay periods:
> - **Google insights:** ~10 days lag - request dates at least 10 days in the past
> - **Facebook insights:** ~3 days lag - request dates at least 3 days in the past
> - **Apple insights:** ~4 days lag - request dates at least 4 days in the past
> - **Google keywords:** Updated monthly - data for a given month becomes available a few days after the month ends

### Location Management (2 tools)

#### `get_location`
Retrieve comprehensive details for a specific location by storeId.

**Returns:**
- Store identification and contact information
- Address and geographic coordinates
- Operating hours (regular, special, holiday)
- Network integration status (Google, Facebook, Apple)
- Categories, attributes, and service items

**Parameters:**
- `storeId` (required) - The PinMeTo store ID
- `format` (optional) - Response format: `json` (default) or `markdown`

**Use case:** Get detailed information about a single location before fetching network-specific insights.

---

#### `get_locations`
Retrieve a list of all locations in your PinMeTo account with optional field filtering and pagination control.

**Returns:**
- Paginated list of all locations with customizable fields
- Location names, storeIds, and status
- Contact information, addresses, and network integrations

**Parameters:**
- `fields` (optional) - Array of field names to include in response. Omit for all fields.
  - Example: `["storeId", "name", "isActive"]` for basic info
  - Example: `["storeId", "name", "contact", "address"]` for contact details
- `maxPages` (optional) - Maximum number of pages to fetch (1-10). Each page contains up to 1000 locations.

**Use case:** Find storeIds for use in other tools. This is typically the first tool to use in any workflow.

---

### Google Business Profile (6 tools)

#### `get_google_location_insights`
Fetch Google Business Profile performance metrics for a specific location over a date range.

**Returns:**
- Impressions (Search, Maps, total)
- Actions (calls, website visits, direction requests, bookings)
- Photo views and counts

**Parameters:**
- `storeId` (required) - The PinMeTo store ID
- `from` (required) - Start date in YYYY-MM-DD format (e.g., "2024-01-01")
- `to` (required) - End date in YYYY-MM-DD format (e.g., "2024-01-31")
- `format` (optional) - Response format: `json` or `markdown` (default: `markdown`)
- `aggregation` (optional) - Data aggregation level: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)

**Use case:** Analyze how a specific location performs on Google Search and Maps over time.

---

#### `get_all_google_insights`
Get Google insights for all locations in your account.

**Parameters:** Same as `get_google_location_insights` (except storeId - includes `aggregation` parameter)
**Use case:** Compare Google performance across all locations.

---

#### `get_google_location_ratings`
Get Google ratings and reviews for a specific location.

**Parameters:**
- `storeId` (required)
- `from` (required) - YYYY-MM-DD format
- `to` (required) - YYYY-MM-DD format
- `format` (optional) - `json` or `markdown`

**Use case:** Monitor customer feedback and rating trends for a location.

---

#### `get_all_google_ratings`
Get Google ratings for all locations in your account.

**Parameters:** Same as `get_google_location_ratings` (except storeId)
**Use case:** Identify locations with rating issues across your entire network.

---

#### `get_google_keywords`
Get Google search keywords for all locations.

**Returns:** Search terms that customers used to find your locations on Google.

**Parameters:**
- `from` (required) - Start month in YYYY-MM format (e.g., "2024-01")
- `to` (required) - End month in YYYY-MM format (e.g., "2024-12")
- `format` (optional) - `json` or `markdown`

**Note:** Uses month format (YYYY-MM) instead of full dates.

**Use case:** Understand what search terms drive traffic to your locations.

---

#### `get_google_keywords_for_location`
Get Google search keywords for a specific location.

**Parameters:** Same as `get_google_keywords` plus `storeId`
**Use case:** Analyze search term performance for a single location.

---

### Facebook Pages (5 tools)

#### `get_facebook_location_insights`
Fetch Facebook Page performance metrics for a specific location.

**Returns:**
- Page views and impressions
- Post engagement and reach
- Audience demographics

**Parameters:**
- `storeId` (required)
- `from` (required) - YYYY-MM-DD format
- `to` (required) - YYYY-MM-DD format
- `format` (optional) - `json` or `markdown` (default: `markdown`)
- `aggregation` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)

**Use case:** Track Facebook page performance for a specific location.

---

#### `get_all_facebook_insights`
Get Facebook insights for all location pages in your account.

**Parameters:** Same as `get_facebook_location_insights` (except storeId - includes `aggregation` parameter)
**Use case:** Compare Facebook performance across all location pages.

---

#### `get_all_facebook_brandpage_insights`
Get Facebook insights for brand pages in your account.

**Parameters:** Same as `get_facebook_location_insights` (except storeId - includes `aggregation` parameter)
**Use case:** Analyze brand page performance separate from location pages.

---

#### `get_facebook_location_ratings`
Get Facebook ratings and reviews for a specific location.

**Parameters:**
- `storeId` (required)
- `from` (required) - YYYY-MM-DD format
- `to` (required) - YYYY-MM-DD format
- `format` (optional) - `json` or `markdown`

**Use case:** Monitor customer reviews and ratings on Facebook.

---

#### `get_all_facebook_ratings`
Get Facebook ratings for all locations in your account.

**Parameters:** Same as `get_facebook_location_ratings` (except storeId)
**Use case:** Track Facebook rating trends across all locations.

---

### Apple Maps (2 tools)

#### `get_apple_location_insights`
Fetch Apple Maps performance metrics for a specific location.

**Returns:**
- Map views and impressions
- Direction requests
- Customer actions

**Parameters:**
- `storeId` (required)
- `from` (required) - YYYY-MM-DD format
- `to` (required) - YYYY-MM-DD format
- `format` (optional) - `json` or `markdown` (default: `markdown`)
- `aggregation` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)

**Use case:** Track how customers discover and interact with your location on Apple Maps.

---

#### `get_all_apple_insights`
Get Apple Maps insights for all locations in your account.

**Parameters:** Same as `get_apple_location_insights` (except storeId - includes `aggregation` parameter)
**Use case:** Compare Apple Maps performance across all locations.

---

### Composite Reporting Tools (3 tools)

> **⚡ High-Performance Reports**
>
> These composite tools make multiple API calls in parallel and generate unified reports, reducing report generation time from minutes to seconds (up to 6x faster).

#### `get_multi_platform_insights`
Fetch insights from Google, Facebook, and Apple for ALL locations in a single call.

**Returns:**
- Unified report with insights from all selected platforms
- Aggregated metrics by category (Impressions, Customer Actions, etc.)
- Platform-specific performance data

**Parameters:**
- `from` (required) - Start date in YYYY-MM-DD format
- `to` (required) - End date in YYYY-MM-DD format
- `platforms` (optional) - Array of platforms: `['google', 'facebook', 'apple']` (default: all platforms)
- `aggregation` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)
- `format` (optional) - `json` or `markdown` (default: `markdown`)

**Performance:** Makes 3 parallel API calls instead of 3+ sequential agent round-trips.

**Use cases:**
- Executive dashboards and monthly reports
- Multi-platform performance analysis
- Quarterly/yearly reporting for all locations
- Comparing performance across different networks

**Example:**
```
Get multi-platform insights for all locations from October 1 to October 31, 2024
```

---

#### `get_yoy_comparison`
Compare current period performance to the same period last year across multiple platforms.

**Returns:**
- Year-over-year comparison tables with metrics, changes, and percentages
- Separate comparison for each period when using monthly/weekly/daily aggregation
- Optional ratings comparison for Google

**Parameters:**
- `current_from` (required) - Current period start date in YYYY-MM-DD format
- `current_to` (required) - Current period end date in YYYY-MM-DD format
- `platforms` (optional) - Array of platforms: `['google', 'facebook', 'apple']` (default: all platforms)
- `include_ratings` (optional) - Include Google ratings comparison (default: `false`)
- `aggregation` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)
- `format` (optional) - `json` or `markdown` (default: `markdown`)

**Performance:** Makes 6-12 parallel API calls (depending on platforms and ratings) instead of 15+ sequential agent round-trips.

**How it works:**
- Automatically calculates previous year dates (e.g., Oct 2024 → Oct 2023)
- Fetches both current and previous year data in parallel
- Generates comparison with change indicators (📈 increase, 📉 decrease, ➖ no change)

**Use cases:**
- Annual performance reviews
- Year-over-year trend analysis with monthly/quarterly breakdown
- Growth measurement and executive summaries
- Historical context for current performance

**Example:**
```
Compare Q4 2024 (Oct 1 - Dec 31) to Q4 2023 for all platforms with monthly breakdown
(use aggregation: 'monthly')
```

---

#### `get_location_overview`
Get a complete overview for a specific location including insights and ratings from all platforms.

**Returns:**
- Location details (name, address, contact information)
- Network integration links (Google Business Profile, Facebook, Apple Maps)
- Insights from Google, Facebook, and Apple
- Optional ratings data

**Parameters:**
- `storeId` (required) - The PinMeTo store ID
- `from` (required) - Start date in YYYY-MM-DD format
- `to` (required) - End date in YYYY-MM-DD format
- `include_ratings` (optional) - Include ratings data (default: `true`)
- `aggregation` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, or `total` (default: `total`)
- `format` (optional) - `json` or `markdown` (default: `markdown`)

**Performance:** Makes up to 6 parallel API calls instead of 6+ sequential agent round-trips.

**Network integration details displayed:**
- Google Business Profile: Profile link, Place ID, review URL
- Facebook: Profile link, Page ID
- Apple Maps: Profile link

**Use cases:**
- Single location performance review
- Store manager reports
- Location-specific deep-dive analysis
- Troubleshooting individual location issues

**Example:**
```
Get complete overview for store "downtown-store-001" for October 2024
```

---

## API Reference & Best Practices

### Tool Selection Guide

When working with PinMeTo MCP, follow this decision tree to choose the right tool:

```
Need comprehensive reports? ⚡ NEW
├─ Multi-platform insights for all locations → pinmeto_get_multi_platform_insights
├─ Year-over-year comparison → pinmeto_get_yoy_comparison
└─ Complete overview for one location → pinmeto_get_location_overview

Need location data?
├─ All locations → pinmeto_get_locations
│  └─ Filter fields for faster responses: ['storeId', 'name', 'isActive']
└─ Single location → pinmeto_get_location
   └─ Verify network integrations before fetching insights

Need insights data?
├─ Comparing multiple locations → Use "all" tools
│  ├─ pinmeto_get_all_google_insights
│  ├─ pinmeto_get_all_facebook_insights
│  └─ pinmeto_get_all_apple_insights
└─ Analyzing single location → Use single location tools
   ├─ pinmeto_get_google_location_insights
   ├─ pinmeto_get_facebook_location_insights
   └─ pinmeto_get_apple_location_insights

Need ratings/reviews?
├─ All locations → Use "all" ratings tools
└─ Single location → Use single location ratings tools

Need keyword data?
├─ All locations → pinmeto_get_google_keywords
└─ Single location → pinmeto_get_google_keywords_for_location
```

**Pro Tips:**
- **Use composite tools** for comprehensive reports (up to 6x faster)
- **Always start with `pinmeto_get_locations`** to discover storeIds
- **Use field filtering** for large accounts (100+ locations)
- **Use aggregation** to reduce context usage (default: `total`)
- **Use markdown format** for human-readable summaries (default)
- **Check data lag** before requesting recent dates (see table below)

### Data Availability & Historical Limits

| Data Source | Historical Range | Data Lag | Date Format | Update Frequency |
|-------------|------------------|----------|-------------|------------------|
| **Google Insights** | Sep 2021 or 18 months back* | ~10 days | YYYY-MM-DD | Daily |
| **Google Ratings** | Indefinite | 24-48 hours | YYYY-MM-DD | Real-time |
| **Google Keywords** | Aug 2023 or location creation* | Few days after month end | YYYY-MM | Monthly |
| **Facebook Insights** | 2 years | ~3 days | YYYY-MM-DD | Daily |
| **Facebook Ratings** | Indefinite | 24-48 hours | YYYY-MM-DD | Real-time |
| **Apple Insights** | Depends on integration date | ~4 days | YYYY-MM-DD | Daily |

*Whichever is more recent

### Detailed Field Reference

#### Google Business Profile Fields

**Impressions (How customers find you):**
- `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` - Impressions on Google Search (desktop)
- `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` - Impressions on Google Search (mobile)
- `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` - Impressions on Google Maps (desktop)
- `BUSINESS_IMPRESSIONS_MOBILE_MAPS` - Impressions on Google Maps (mobile)

**Actions (What customers do):**
- `BUSINESS_DIRECTION_REQUESTS` - Times customers requested directions
- `CALL_CLICKS` - Times customers clicked to call
- `WEBSITE_CLICKS` - Times customers clicked website link

**Discovery:**
- `QUERIES_DIRECT` - Searches using business name
- `QUERIES_INDIRECT` - Searches using category/product/service

**Engagement:**
- Photo views, customer photo uploads, post impressions

#### Facebook Pages Fields

**Page Impressions:**
- `page_impressions` - Total times your page was viewed
- `page_impressions_unique` - Unique people who viewed your page
- `page_impressions_organic` - Organic (non-paid) page views
- `page_impressions_organic_unique` - Unique organic viewers
- `page_impressions_paid` - Paid (sponsored) page views
- `page_impressions_paid_unique` - Unique paid viewers

**Engagement:**
- `page_total_actions` - Total actions taken on page (clicks, likes, etc.)
- `page_post_engagements` - Total engagement with posts

**Followers:**
- `page_fan_adds` - New page likes in period
- `page_fan_removes` - Page unlikes in period
- `page_fans` - Total page likes at end of period

#### Apple Maps Fields

**Views:**
- `PLACECARD_VIEW` - Times your location card was viewed

**Actions:**
- `PLACECARD_TAP_CALL` - Times customers tapped to call
- `PLACECARD_TAP_DIRECTION` - Times customers tapped for directions
- `PLACECARD_TAP_WEBSITE` - Times customers tapped website link

**Discovery:**
- `SEARCH_LOCATION_TAP_NAME` - Found by searching business name
- `SEARCH_LOCATION_TAP_CATEGORY` - Found by category search
- `SEARCH_LOCATION_TAP_OTHER` - Found by other search methods

### Common Workflows

#### Workflow 1: Executive Monthly Report ⚡

**Goal:** Generate comprehensive monthly report across all platforms

**Best approach:** Use composite tools for 6x faster results

```
1. Multi-platform overview (one call!)
   → pinmeto_get_multi_platform_insights
   → from: "2024-10-01", to: "2024-10-31"
   → aggregation: "total"

   Returns: Google, Facebook, and Apple insights for all locations in one unified report

2. Year-over-year comparison (optional)
   → pinmeto_get_yoy_comparison
   → current_from: "2024-10-01", current_to: "2024-10-31"
   → aggregation: "monthly" (for month-by-month breakdown)

   Returns: Comparison to October 2023 with change indicators

Result: Complete executive report in ~1 minute (vs 10+ minutes with individual tools)
```

**Alternative:** Use individual tools if you need platform-specific customization:
```
1. pinmeto_get_all_google_insights
2. pinmeto_get_all_facebook_insights
3. pinmeto_get_all_apple_insights
```

---

#### Workflow 2: Store Manager Report ⚡

**Goal:** Complete performance overview for a specific location

**Best approach:** Use location overview tool

```
1. Get complete overview (one call!)
   → pinmeto_get_location_overview
   → storeId: "downtown-store-001"
   → from: "2024-10-01", to: "2024-10-31"
   → include_ratings: true (default)

   Returns:
   - Location details with network integration links
   - Google, Facebook, and Apple insights
   - Customer ratings from Google and Facebook

2. Deep-dive into keywords (optional)
   → pinmeto_get_google_keywords_for_location
   → from: "2024-10", to: "2024-10"

Result: Comprehensive single-location report with all platforms
```

**Alternative:** For weekly trends, use individual tools with `aggregation: "weekly"`

---

#### Workflow 3: Year-over-Year Growth Analysis ⚡

**Goal:** Measure annual growth with quarterly breakdown

```
1. Compare full year with quarterly trends
   → pinmeto_get_yoy_comparison
   → current_from: "2024-01-01", current_to: "2024-12-31"
   → aggregation: "quarterly"
   → include_ratings: true

   Returns: Q1-Q4 2024 vs Q1-Q4 2023 comparison with:
   - Metrics changes and percentages
   - Quarterly trend visibility
   - Optional ratings comparison

Result: Executive-ready YoY analysis with quarterly breakdown
```

---

#### Workflow 4: Location Deep-Dive (Custom Analysis)

**Goal:** Detailed analysis with custom metrics and time periods

```
1. Find locations
   → pinmeto_get_locations
   → fields: ['storeId', 'name', 'google', 'fb']

2. Get location details
   → pinmeto_get_location with storeId

3. Get platform-specific insights with custom aggregation
   → pinmeto_get_google_location_insights (aggregation: "weekly")
   → pinmeto_get_facebook_location_insights (aggregation: "weekly")
   → pinmeto_get_apple_location_insights (aggregation: "weekly")

4. Analyze search behavior
   → pinmeto_get_google_keywords_for_location (month format)

Result: Granular weekly trends for custom analysis
```

### Troubleshooting Guide

#### Error: "Unable to fetch insights for storeId"

**Possible causes:**
1. **Invalid storeId** - Verify using `pinmeto_get_locations`
2. **No network integration** - Check location has Google/Facebook/Apple connected
3. **Date range too old** - Check historical limits (see table above)
4. **Date format wrong** - Use YYYY-MM-DD (or YYYY-MM for keywords)
5. **Data not yet available** - Account for data lag (10 days for Google, 3 for Facebook, 4 for Apple)

**Solutions:**
- Use `pinmeto_get_location` to verify network integrations
- Request dates within historical range
- Add data lag buffer to requested dates
- For keywords, use complete month format (YYYY-MM)

#### Error: "No locations found"

**Possible causes:**
1. **Incorrect PINMETO_ACCOUNT_ID** - Verify in PinMeTo account settings
2. **No active locations** - Account has no locations configured
3. **API credentials issue** - App ID or secret incorrect

**Solutions:**
- Double-check environment variables
- Visit PinMeTo dashboard to confirm locations exist
- Regenerate API credentials if needed

#### Issue: Response is too large / truncated

**Solutions:**
1. **Use field filtering** - Specify only needed fields in `pinmeto_get_locations`
   - Example: `fields: ['storeId', 'name', 'isActive']`
2. **Use aggregation** - Default `total` reduces response by 97%
3. **Limit pages** - Use `maxPages` parameter for large accounts
4. **Request smaller date ranges** - Split large requests into smaller periods

#### Issue: Empty insights response

**Possible causes:**
1. **Location integration not active** - Network not connected yet
2. **New location** - Insufficient historical data
3. **Date range before integration** - Requested dates before network was connected

**Solutions:**
- Verify location has network field populated (use `pinmeto_get_location`)
- Try more recent date ranges
- For new locations, wait for data to accumulate (24-72 hours)

#### Issue: Keyword data not available

**Special notes about Google Keywords:**
- Only available from **August 2023** onwards
- **Monthly aggregation only** - must use YYYY-MM format
- Data available **few days after month ends**
- Low-traffic locations may not have keyword data

**Solutions:**
- Use YYYY-MM format (not YYYY-MM-DD)
- Request complete past months only
- For current month, wait until month ends + few days

### Performance Optimization Tips

#### Reduce Context Usage
1. **Use aggregation** (default `total`) - Saves 97% tokens
2. **Use markdown format** (default) - Human-readable summaries vs raw JSON
3. **Filter fields** in `pinmeto_get_locations` - Only request needed data
4. **Limit pages** with `maxPages` - Prevent large account overload

#### Faster Queries
1. **Start with `pinmeto_get_locations`** - Cache storeIds locally
2. **Request parallel data** - Get Google/Facebook/Apple insights simultaneously
3. **Use appropriate aggregation** - `total` for summaries, `monthly` for trends
4. **Limit date ranges** - Request only needed time periods

#### Better Results
1. **Account for data lag** - Don't request very recent dates
2. **Use consistent date ranges** - Compare apples-to-apples across platforms
3. **Check network integrations** - Use `pinmeto_get_location` first
4. **Request complete periods** - Full months for cleaner comparisons

---

## Technical Details

### Smart Data Aggregation

All insight tools automatically aggregate daily data to reduce context usage by up to **97%**.

**Aggregation Levels:**

| Level | Description | Use Case |
|-------|-------------|----------|
| **`total`** (default) | Sum all data into single totals | Quick summaries, period comparisons |
| `daily` | Raw daily breakdown | Detailed day-by-day analysis |
| `weekly` | Group by week | Week-over-week trends |
| `monthly` | Group by month | Month-over-month comparison |
| `quarterly` | Group by quarter | Quarterly business reviews |
| `yearly` | Group by year | Year-over-year analysis |

**Performance Impact:**

| Scenario | Without Aggregation | With Aggregation | Savings |
|----------|---------------------|------------------|---------|
| 30-day single location | ~15,000 tokens | ~500 tokens | **97%** |
| 30-day all platforms | ~45,000 tokens | ~1,500 tokens | **97%** |
| 90-day multi-location | ~90,000 tokens | ~1,200 tokens | **99%** |

**Markdown Output:**

All tools default to markdown format with smart formatting:
- Metrics organized by category (Impressions, Actions, Engagement)
- Human-readable numbers with comma separators
- Period and aggregation level clearly displayed
- Emojis for better readability (ratings, locations)

**Examples:**
```
# Default (total aggregation)
"Get Google insights for store ABC from 2024-01-01 to 2024-03-31"
→ Returns quarterly total

# Weekly breakdown
"Get Google insights for store ABC from 2024-01-01 to 2024-01-31 with weekly aggregation"
→ Returns 4-5 weekly summaries

# Daily data
"Get Google insights for store ABC from 2024-01-01 to 2024-01-07 with daily aggregation"
→ Returns all 7 daily data points
```

### Output Formats

- **Markdown** (default): Human-readable summaries optimized for presentation
- **JSON**: Raw API data for programmatic processing

### Response Size Management

- Automatic 25k character limit prevents context overflow
- Truncated responses include helpful messages suggesting filters
- Use field filtering and pagination for large datasets

---
