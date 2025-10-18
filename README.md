# PinMeTo Location MCP

The [PinMeTo](https://www.pinmeto.com/) MCP Server enables seamless integration between the [PinMeTo platform](https://places.pinmeto.com/) and AI agents such as Claude LLM, allowing users to interact with their location data and business insights through natural language. This server exposes a suite of tools that let you retrieve, analyze, and summarize data from PinMeTo, through multiple sources—including Google, Facebook, and Apple—covering metrics such as impressions, clicks, ratings, and more.

---

## Installation

The MCP Server can be built from this repository, or a single-click installer is available for Claude Desktop.

---

## Claude Desktop: One-Click Installation

The single-click installer binary for Claude Desktop is available in the "Releases" tab:

<https://github.com/PinMeTo/pinmeto-location-mcp/releases>

Below are instructions on how to generate the binary with `npx`:

### Prerequisites (Claude Desktop: One-Click Installation)

- **npm**
- **npx** (included with npm)
- **Claude Desktop**

### Steps (Claude Desktop: One-Click Installation)

1. **Clone the repository:**

    ```zsh
    git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
    ```

2. **Open your project folder** in your text editor.

    ```zsh
    cd pinmeto-location-mcp
    ```

3. **Build** and **Run the MCPB installer:**

   ```bash
   npm install
   npm run build
   npx @anthropic-ai/mcpb pack
   ```

   - This generates a `.mcpb` file in your project directory.

4. **Install in Claude Desktop:**
   - With Claude Desktop open, double-click the `.mcpb` file.
   - Enter your PinMeTo API credentials when prompted ([PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3)).
     <img width="655" height="596" alt="Screenshot 2025-09-25 at 14 51 20" src="https://github.com/user-attachments/assets/30af64b3-81c3-4bb1-9b05-656831004757" />

- Enable the connector in Claude. You can now use the PinMeTo MCP integration.

---

## Claude Desktop: Manual Installation

Below are instructions on how to manually integrate the PinMeTo MCP with Claude Desktop:

### Prerequisites (Claude Desktop: Manual Installation)

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)
- **Claude Desktop**

### Steps (Claude Desktop: Manual Installation)

1. **Clone the repository:**

    ```zsh
    git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
    ```

2. **Open your project folder** in your text editor.

    ```zsh
    cd pinmeto-location-mcp
    ```

3. **Install dependencies and build the project:**

   ```bash
   npm install
   npm run build
   ```

4. **Configure Claude Desktop:**
    - Open your `claude_desktop_config.json` file. You can go to Preferences → Developer → Edit Config in the Claude Desktop Client. Or use on Mac:

    ```bash
    code ~/Library/Application\ Support/Claude/claude_desktop_config.json
    ```

    - Add the following MCP server configuration (with node)

        ```json
        {
        "mcpServers": {
            "PinMeTo": {
            "command": "/absolute/path/to/node",
            "args": ["/absolute/path/to/project/build/index.js"],
            "env": {
                "PINMETO_API_URL": "",
                "PINMETO_ACCOUNT_ID": "",
                "PINMETO_APP_ID": "",
                "PINMETO_APP_SECRET": ""
            }
            }
        }
        }
        ```

    - Add the following MCP server configuration (with npx)

        ```json
        {
        "mcpServers": {
            "PinMeTo": {
                "command": "npx",
                "args": ["-y", "PinMeTo/pinmeto-location-mcp"],
                "env": {
                    "PINMETO_ACCOUNT_ID": "",
                    "PINMETO_APP_ID": "",
                    "PINMETO_APP_SECRET": ""
                }
            }
        }

        }

        ```

    - Use absolute paths for both Node and your project:
    - Node path: `which node`
    - Project path: `pwd`

5. **Get your PinMeTo API credentials:**
   - Visit [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3) and fill in the environment variables above.

6. **Restart Claude Desktop:**
   - Ensure all permissions are granted. You should now see "PinMeTo MCP" in your MCP selection.

<!-- ---

## Cursor: Direct Link Installation

Below are instructions on how to manually integrate the PinMeTo MCP with Cursor using a direct link:

### Prerequisites (Cursor: Direct Link Installation)

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)

### Installation (Cursor: Direct Link Installation)

1. **Clone the repository:**

    ```zsh
    git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
    ```

2. **Open your project folder** in your text editor.

    ```zsh
    cd pinmeto-location-mcp
    ```

3. **Install dependencies and build the project:**

   ```bash
   npm install
   npm run build
   ```

4. **Copy the link and paste it in your browser.**

    ```bash
    cursor://anysphere.cursor-deeplink/mcp/install?name=PinMeTo&config=eyJlbnYiOnsiUElOTUVUT19BUElfVVJMIjoiIiwiUElOTUVUT19BQ0NPVU5UX0lEIjoiIiwiUElOTUVUT19BUFBfSUQiOiIiLCJQSU5NRVRPX0FQUF9TRUNSRVQiOiIifSwiY29tbWFuZCI6Ii9hYnNvbHV0ZS9wYXRoL3RvL25vZGUgL2Fic29sdXRlL3BhdGgvdG8vcHJvamVjdC9idWlsZC9pbmRleC5qcyJ9
    ```

Enter your credentials.

- Use absolute paths for both Node and your project:
  - Node path: `which node`
  - Project path: `pwd`

![Cursor Configuration](img/cursor_config.png)

---

## Cursor: Manual Installation

Below are instructions on how to manually integrate the PinMeTo MCP with Cursor manually:

### Prerequisites (Cursor: Manual Installation)

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)

### Installation (Cursor: Manual Installation)

1. **Clone the repository:**

    ```zsh
    git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
    ```

2. **Open your project folder** in your text editor.

    ```zsh
    cd pinmeto-location-mcp
    ```

3. **Install dependencies and build the project:**

   ```bash
   npm install
   npm run build
   ```

4. **To add this MCP server to Cursor**:

    1. Go to **Settings → Cursor Settings → MCP**.
    2. Click **+ Add New MCP Server**. This opens an `mcp.json` file.
    3. Add the same JSON configuration as shown in the Claude Desktop instructions.

        ```json
        {
        "mcpServers": {
            "PinMeTo": {
            "command": "/absolute/path/to/node",
            "args": ["/absolute/path/to/project/build/index.js"],
            "env": {
                "PINMETO_API_URL": "",
                "PINMETO_ACCOUNT_ID": "",
                "PINMETO_APP_ID": "",
                "PINMETO_APP_SECRET": ""
            }
            }
        }
        }
        ```

**Tip:**

- `~/.cursor/mcp.json` is your global MCP settings.
- `.cursor/mcp.json` is project-specific. For most cases, add the server to your project-specific file.

--- -->

## Available Tools

The PinMeTo MCP Server provides 15 comprehensive tools organized by category. All tools support both JSON (raw data) and Markdown (human-readable summaries) output formats.

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

## Aggregation Feature

All insight tools support intelligent data aggregation to dramatically reduce context usage while maintaining data insights.

### Why Aggregation Matters

**The Problem:** Insights APIs return daily data points. A 30-day request for Google insights returns 30 separate data objects per metric, which can consume 15,000+ tokens for a single location.

**The Solution:** Automatic aggregation combines daily data into meaningful periods, reducing context usage by up to **97%** while preserving analytical value.

### Aggregation Levels

| Level | Description | Use Case | Example Output |
|-------|-------------|----------|----------------|
| **`total`** (default) | Sum all data into single totals | Quick summaries, period comparisons | 30 days → 1 total |
| `daily` | Raw daily breakdown | Detailed day-by-day analysis | 30 days → 30 data points |
| `weekly` | Group by week | Week-over-week trends | 30 days → 4-5 weeks |
| `monthly` | Group by month | Month-over-month comparison | 90 days → 3 months |
| `quarterly` | Group by quarter | Quarterly business reviews | 1 year → 4 quarters |
| `yearly` | Group by year | Year-over-year analysis | Multi-year → annual totals |

### Context Savings

| Scenario | Without Aggregation | With `aggregation='total'` | Savings |
|----------|---------------------|---------------------------|---------|
| 30-day Google insights (1 location) | ~15,000 tokens | ~500 tokens | **97%** |
| 30-day all networks (3 networks) | ~45,000 tokens | ~1,500 tokens | **97%** |
| 90-day multi-location report | ~90,000 tokens | ~1,200 tokens | **99%** |

### Markdown Output Enhancement

When using `format='markdown'` (the default), responses now show:

**Before (raw JSON dump):**
```
# Google Insights
```json
{ "metrics": [ ... 30 daily objects ... ] }
```
~5,000 tokens

**After (smart summary):**
```
# Google Insights
**Period:** 2024-01-01 to 2024-01-31
**Aggregation:** total

### Impressions & Visibility
- Desktop Search Impressions: 12,450
- Mobile Search Impressions: 8,230
- Desktop Maps Impressions: 3,120

### Customer Actions
- Direction Requests: 892
- Call Clicks: 234
- Website Clicks: 156
```
~200 tokens (96% reduction)

### Usage Examples

```
# Get monthly totals (default behavior)
"Get Google insights for store ABC123 from 2024-01-01 to 2024-03-31"
→ Returns quarterly total automatically

# Weekly breakdown for trend analysis
"Get Google insights for store ABC123 from 2024-01-01 to 2024-01-31 with weekly aggregation"
→ Returns 4-5 weekly summaries

# Daily data when needed
"Get Google insights for store ABC123 from 2024-01-01 to 2024-01-07 with daily aggregation"
→ Returns all 7 daily data points
```

---

## Example Workflows

### Basic Workflow: Analyze a Single Location
```
1. Get all locations: "Show me all my locations"
   → Uses get_locations to find storeIds

2. Get location details: "Show me details for storeId ABC123"
   → Uses get_location (markdown format by default)

3. Get Google insights summary: "Get Google insights for ABC123 from 2024-01-01 to 2024-01-31"
   → Uses get_google_location_insights (automatically aggregates to total)
   → Returns summary with ~500 tokens instead of ~15,000

4. Get weekly trends: "Get Google insights for ABC123 for January with weekly breakdown"
   → Uses get_google_location_insights with aggregation: "weekly"
   → Returns 4-5 weekly summaries for trend analysis

5. Compare platforms: "Get Facebook and Apple insights for the same location and dates"
   → Uses get_facebook_location_insights and get_apple_location_insights
   → Both use automatic aggregation for efficient summaries
```

### Cross-Location Analysis
```
1. Get all locations: "List all my active locations"
   → Uses get_locations with fields: ["storeId", "name", "isActive"]

2. Compare Google performance: "Get Google insights for all locations for last month"
   → Uses get_all_google_insights (automatically aggregates to monthly total)
   → Returns efficient summary across all locations (~1,500 tokens vs ~45,000)

3. Quarterly trends: "Show me quarterly Google insights for all locations this year"
   → Uses get_all_google_insights with aggregation: "quarterly"
   → Returns 4 quarterly summaries for year-over-year analysis

4. Find rating issues: "Show me all Facebook ratings for last month"
   → Uses get_all_facebook_ratings to identify locations needing attention
   → Markdown format shows rating distributions and response rates
```

### Keyword Research
```
1. Get Google keywords: "What search terms brought customers to my locations in January 2024?"
   → Uses get_google_keywords with from: "2024-01", to: "2024-01"

2. Analyze specific location: "Show me keywords for storeId ABC123"
   → Uses get_google_keywords_for_location
```

---

## Features

### Smart Data Aggregation ✨ NEW
- **Automatic daily data aggregation** reduces context usage by up to 97%
- **6 aggregation levels**: daily, weekly, monthly, quarterly, yearly, total
- **Default to total** for maximum efficiency
- Works seamlessly with all insight tools across Google, Facebook, and Apple

### Enhanced Markdown Output ✨ NEW
All tools support two output formats:
- **JSON**: Raw API data for programmatic processing
- **Markdown** (default): Smart summaries with categorized metrics
  - **Insights**: Organized by category (Impressions & Visibility, Customer Actions, Engagement)
  - **Ratings**: Summary stats, distribution charts, and recent reviews
  - **Keywords**: Ranked lists with impression counts and percentages
  - **Locations**: Concise format with emojis for better readability

### Input Validation
- Date parameters use regex validation (YYYY-MM-DD or YYYY-MM)
- Clear error messages with format examples when validation fails
- Helpful troubleshooting steps for common issues

### Pagination Control
- `get_locations` supports `maxPages` parameter (1-10 pages)
- `get_all_apple_insights` supports pagination for large datasets
- Each page contains up to 1000 locations
- Useful for large accounts to limit response size

### Response Size Management
- Smart aggregation reduces typical responses from 15,000 to 500 tokens
- Automatic 25k character limit prevents context overflow
- Truncated responses include helpful messages suggesting filters
- Ensures reliable performance with large datasets

---
