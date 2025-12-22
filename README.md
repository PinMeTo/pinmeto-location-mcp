# PinMeTo Location MCP

[![version](https://img.shields.io/badge/version-v3.0.0-blue)](https://github.com/PinMeTo/pinmeto-location-mcp/releases/tag/v3.0.0) [![download](https://img.shields.io/badge/download-.mcpb-green)](https://github.com/PinMeTo/pinmeto-location-mcp/releases/download/v3.0.0/pinmeto-location-mcp.mcpb) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-007ACC?logo=visualstudiocode)](vscode:mcp/install?name=pinmeto-location-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40pinmeto%2Fpinmeto-location-mcp%22%5D%2C%22env%22%3A%7B%22PINMETO_ACCOUNT_ID%22%3A%22%24%7Binput%3Apinmeto-account-id%7D%22%2C%22PINMETO_APP_ID%22%3A%22%24%7Binput%3Apinmeto-app-id%7D%22%2C%22PINMETO_APP_SECRET%22%3A%22%24%7Binput%3Apinmeto-app-secret%7D%22%7D%7D) [![Install in Cursor](https://img.shields.io/badge/Cursor-Install-000000?logo=cursor)](cursor://anysphere.cursor-deeplink/mcp/install?name=PinMeTo&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBwaW5tZXRvL3Bpbm1ldG8tbG9jYXRpb24tbWNwIl0sImVudiI6eyJQSU5NRVRPX0FDQ09VTlRfSUQiOiIke2lucHV0OnBpbm1ldG8tYWNjb3VudC1pZH0iLCJQSU5NRVRPX0FQUF9JRCI6IiR7aW5wdXQ6cGlubWV0by1hcHAtaWR9IiwiUElOTUVUT19BUFBfU0VDUkVUIjoiJHtpbnB1dDpwaW5tZXRvLWFwcC1zZWNyZXR9In19)

The [PinMeTo](https://www.pinmeto.com/) MCP Server enables seamless integration between the [PinMeTo platform](https://places.pinmeto.com/) and AI agents such as Claude LLM, allowing users to interact with their location data and business insights through natural language. This server exposes a suite of tools that let you retrieve, analyze, and summarize data from PinMeTo, through multiple sources—including Google, Facebook, and Apple—covering metrics such as impressions, clicks, ratings, and more.

---

## Installation

The MCP Server can be installed with one click in **Claude Desktop**, **VS Code**, or **Cursor** using the badges above. Manual installation instructions are also available below.

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

---

## Available Tools

All tools use the `pinmeto_` prefix following MCP best practices.

### Location Tools
- `pinmeto_get_location` - Get PinMeTo data for a SINGLE location by store ID
- `pinmeto_get_locations` - Get ALL location data with pagination, filtering, and caching
- `pinmeto_search_locations` - Search ALL locations for quick discovery

### Google Tools
- `pinmeto_get_google_insights` - Get Google insights (all locations, or single if `storeId` provided)
- `pinmeto_get_google_ratings` - Get Google ratings (all locations, or single if `storeId` provided)
- `pinmeto_get_google_keywords` - Get Google keywords (all locations, or single if `storeId` provided)

### Facebook Tools
- `pinmeto_get_facebook_insights` - Get Facebook insights (all locations, or single if `storeId` provided)
- `pinmeto_get_facebook_brandpage_insights` - Get Facebook brandpage insights for ALL pages
- `pinmeto_get_facebook_ratings` - Get Facebook ratings (all locations, or single if `storeId` provided)

### Apple Tools
- `pinmeto_get_apple_insights` - Get Apple insights (all locations, or single if `storeId` provided)

---

## Time Aggregation for Token Reduction

All insights tools (Google, Facebook, and Apple) support **time aggregation** to significantly reduce token usage. **By default, all insights are aggregated to a single total value**, providing maximum token efficiency. You can optionally request different aggregation periods for more granular analysis.

### Benefits

- **Total** (default): Single aggregated value - maximum token reduction
- **Daily**: Full granularity, no aggregation
- **Weekly**: ~85% token reduction (7 days → 1 data point)
- **Monthly**: ~96% token reduction (30 days → 1 data point)
- **Quarterly**: ~98% token reduction (90 days → 1 data point)
- **Half-yearly**: ~99% token reduction (180 days → 1 data point)
- **Yearly**: ~99.7% token reduction (365 days → 1 data point)

### Usage

The `aggregation` parameter is optional and defaults to `"total"`:

```json
{
  "storeId": "1337",
  "from": "2024-01-01",
  "to": "2024-12-31"
}
```

**Returns a single total value by default** (maximum token reduction)

To get different time periods, specify the `aggregation` parameter:

```json
{
  "storeId": "1337",
  "from": "2024-01-01",
  "to": "2024-12-31",
  "aggregation": "monthly"
}
```

### Examples

**Get total metrics (default behavior):**
```javascript
// Returns a single aggregated value
{
  "from": "2024-01-01",
  "to": "2024-12-31"
}
```

**Get yearly trends (monthly aggregation):**
```javascript
// Returns 12 data points instead of 365
{
  "storeId": "1337",
  "from": "2024-01-01",
  "to": "2024-12-31",
  "aggregation": "monthly"
}
```

**Get quarterly business review:**
```javascript
// Returns 4 data points for the year
{
  "from": "2024-01-01",
  "to": "2024-12-31",
  "aggregation": "quarterly"
}
```

**Get daily data (full granularity):**
```javascript
// Returns 365 individual data points
{
  "from": "2024-01-01",
  "to": "2024-12-31",
  "aggregation": "daily"
}
```

### Supported Tools

Time aggregation works with all insights tools:
- Google: `pinmeto_get_google_insights`
- Facebook: `pinmeto_get_facebook_insights`, `pinmeto_get_facebook_brandpage_insights`
- Apple: `pinmeto_get_apple_insights`

### How It Works

1. The MCP server fetches daily metrics from the PinMeTo API
2. Metrics are grouped by the specified time period (week, month, etc.)
3. Values are summed within each period
4. Aggregated data is returned in the same format as daily data

This client-side aggregation ensures compatibility with the PinMeTo API while dramatically reducing token consumption for AI interactions.

---

## Period Comparison (MoM, QoQ, YoY)

All insights tools support **period comparison** to analyze trends over time. Compare current metrics against previous periods or the same period last year.

### Comparison Options

| Value | Description | Use Case |
|-------|-------------|----------|
| `none` (default) | No comparison | Standard metrics retrieval |
| `prior_period` | Compare with immediately preceding period | Month-over-Month (MoM), Quarter-over-Quarter (QoQ) |
| `prior_year` | Compare with same period last year | Year-over-Year (YoY) analysis |

### Usage

Add the `compare_with` parameter to any insights request:

```json
{
  "storeId": "1337",
  "from": "2024-01-01",
  "to": "2024-01-31",
  "compare_with": "prior_year"
}
```

### Response with Comparison

When comparison is enabled, each metric includes additional fields:

```json
{
  "insights": [
    {
      "metric": "views",
      "value": 1500,
      "priorValue": 1200,
      "delta": 300,
      "deltaPercent": 25
    }
  ],
  "periodRange": { "from": "2024-01-01", "to": "2024-01-31" },
  "priorPeriodRange": { "from": "2023-01-01", "to": "2023-01-31" },
  "timeAggregation": "total",
  "compareWith": "prior_year"
}
```

### Comparison Fields

| Field | Description |
|-------|-------------|
| `priorValue` | Metric value from the comparison period |
| `delta` | Absolute change (value - priorValue) |
| `deltaPercent` | Percentage change, null if priorValue is 0 |
| `priorPeriodRange` | Date range of the comparison period |

### Examples

**Year-over-Year comparison:**
```json
{
  "from": "2024-01-01",
  "to": "2024-01-31",
  "compare_with": "prior_year"
}
```

**Month-over-Month with monthly aggregation:**
```json
{
  "from": "2024-01-01",
  "to": "2024-12-31",
  "aggregation": "monthly",
  "compare_with": "prior_period"
}
```

### Supported Tools

Period comparison works with all insights tools:
- Google: `pinmeto_get_google_insights`
- Facebook: `pinmeto_get_facebook_insights`, `pinmeto_get_facebook_brandpage_insights`
- Apple: `pinmeto_get_apple_insights`
