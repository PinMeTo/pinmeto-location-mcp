# PinMeTo MCP Server

This Model Context Protocol (MCP) server enables Claude LLM to interact with your PinMeTo application as an AI agent.

---

## Manual Installation (Claude Desktop)

### Prerequisites

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)
- **Claude Desktop**

### Steps

1. **Install dependencies and build the project:**

   ```bash
   npm install
   npm run build
   ```

2. **Configure Claude Desktop:**

   - Open your `claude_desktop_config.json` file:
     ```bash
     code ~/Library/Application\ Support/Claude/claude_desktop_config.json
     ```
   - Or go to Preferences → Developer → Edit Config in the Claude Desktop Client.
   - Add the following MCP server configuration:
     ```json
     {
       "mcpServers": {
         "PinMeTo-MCP": {
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
   - Use absolute paths for both Node and your project:
     - Node path: `which node`
     - Project path: `pwd`

3. **Get your PinMeTo API credentials:**

   - Visit [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3) and fill in the environment variables above.

4. **Restart Claude Desktop:**
   - Ensure all permissions are granted. You should now see "PinMeTo MCP" in your MCP selection.

---

## One-Click Installation (MCPB)

### Prerequisites

- **npx** (included with npm)

### Steps

1. **Open your project folder** in your text editor.
2. **Run the MCPB installer:**
   ```bash
   npx @anthropic-ai/mcpb init
   ```
   - This generates a `.mcpb` file in your project directory.
3. **Install in Claude Desktop:**
   - With Claude Desktop open, double-click the `.mcpb` file in Finder.
   - Enter your PinMeTo API credentials when prompted ([PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3)).
   - Enable the connector in Claude. You can now use the PinMeTo MCP integration.

---

## Cursor Integration

To add this MCP server to Cursor:

1. Go to **Settings → Cursor Settings → MCP**.
2. Click **+ Add New MCP Server**. This opens an `mcp.json` file.
3. Add the same JSON configuration as shown in the Claude Desktop instructions.

**Tip:**

- `~/.cursor/mcp.json` is your global MCP settings.
- `.cursor/mcp.json` is project-specific. For most cases, add the server to your project-specific file.

---

## Available Tools

- Get Location
- Get Locations
- All Google Insights
- Google Location Insights
- Google Location Ratings
- All Facebook Insights
- Facebook Location Insights
- Facebook Brandpage Insights
- Facebook Location Ratings
- All Apple Insights
- Apple Location Insights
