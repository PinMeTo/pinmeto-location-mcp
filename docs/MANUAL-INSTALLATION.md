# Manual Installation

This guide covers manual installation methods for developers and advanced users. For most users, we recommend the [one-click installation](../README.md) instead.

---

## Claude Desktop: Manual Installation

### Prerequisites

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)
- **Claude Desktop**

### Steps

1. **Clone the repository:**

    ```bash
    git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
    cd pinmeto-location-mcp
    ```

2. **Install dependencies and build:**

   ```bash
   npm install
   npm run build
   ```

3. **Configure Claude Desktop:**

   Open your `claude_desktop_config.json` file:
   - **Mac**: Preferences → Developer → Edit Config, or:
     ```bash
     code ~/Library/Application\ Support/Claude/claude_desktop_config.json
     ```
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

4. **Add the MCP server configuration:**

   **Option A: Using npx (recommended)**
   ```json
   {
     "mcpServers": {
       "PinMeTo": {
         "command": "npx",
         "args": ["-y", "@pinmeto/pinmeto-location-mcp"],
         "env": {
           "PINMETO_ACCOUNT_ID": "your-account-id",
           "PINMETO_APP_ID": "your-app-id",
           "PINMETO_APP_SECRET": "your-app-secret"
         }
       }
     }
   }
   ```

   **Option B: Using local node**
   ```json
   {
     "mcpServers": {
       "PinMeTo": {
         "command": "/absolute/path/to/node",
         "args": ["/absolute/path/to/project/build/index.js"],
         "env": {
           "PINMETO_ACCOUNT_ID": "your-account-id",
           "PINMETO_APP_ID": "your-app-id",
           "PINMETO_APP_SECRET": "your-app-secret"
         }
       }
     }
   }
   ```

   To find the absolute paths:
   - Node path: `which node`
   - Project path: `pwd`

5. **Get your PinMeTo API credentials:**

   Visit [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3) to create or retrieve your API credentials.

6. **Restart Claude Desktop**

   After restarting, you should see "PinMeTo" in your MCP server list.

---

## Building the Installer Package

If you want to create the one-click installer (.mcpb file) yourself:

### Prerequisites

- npm and npx

### Steps

1. Clone and build the project:
   ```bash
   git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
   cd pinmeto-location-mcp
   npm install
   npm run build
   ```

2. Generate the installer:
   ```bash
   npx @anthropic-ai/mcpb pack
   ```

3. This creates a `.mcpb` file in your project directory.

4. Double-click the `.mcpb` file with Claude Desktop open to install.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PINMETO_ACCOUNT_ID` | Yes | Your PinMeTo account identifier |
| `PINMETO_APP_ID` | Yes | OAuth application ID |
| `PINMETO_APP_SECRET` | Yes | OAuth application secret |
| `PINMETO_API_URL` | No | Override API base URL (development only) |
| `PINMETO_LOCATION_API_URL` | No | Override locations API URL (development only) |

---

## Next Steps

- [Getting Started Guide](GETTING-STARTED.md) - First steps after installation
- [Example Prompts](USE-CASES.md) - What you can ask Claude
- [Tools Reference](TOOLS-REFERENCE.md) - Complete tool documentation
