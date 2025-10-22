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

- `Get Location` - Get pinmeto data on single location.
- `Get Locations` - Get all location data for site.
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
- Google: `get_google_location_insights`, `get_all_google_insights`
- Facebook: `get_facebook_location_insights`, `get_all_facebook_insights`, `get_all_facebook_brandpage_insights`
- Apple: `get_apple_location_insights`, `get_all_apple_insights`

### How It Works

1. The MCP server fetches daily metrics from the PinMeTo API
2. Metrics are grouped by the specified time period (week, month, etc.)
3. Values are summed within each period
4. Aggregated data is returned in the same format as daily data

This client-side aggregation ensures compatibility with the PinMeTo API while dramatically reducing token consumption for AI interactions.
