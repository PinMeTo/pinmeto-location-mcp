# PinMeTo MCP Server (Node.js)

This is the Node.js implementation of the PinMeTo MCP (Model Context Protocol) server, converted from the Python version.

## Features

- **get_location**: Get location details for a specific store by store ID
- **get_locations**: Get all location details for the account (with pagination support)
- OAuth token caching (59 minutes)
- Automatic pagination handling
- Error handling and logging

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file and configure:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your PinMeTo API credentials:
   ```
   PINMETO_API_URL=https://api.pinmeto.com
   PINMETO_ACCOUNT_ID=your_account_id_here
   PINMETO_APP_ID=your_app_id_here
   PINMETO_APP_SECRET=your_app_secret_here
   ```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## MCP Tools

### get_location

Get location details for a specific store.

**Parameters:**

- `store_id` (string, required): The store ID to look up

### get_locations

Get all location details for the account. This endpoint can be used to find store IDs for use in other calls.

**Parameters:** None

## Environment Variables

- `PINMETO_API_URL`: The base URL for the PinMeTo API
- `PINMETO_ACCOUNT_ID`: Your PinMeTo account ID
- `PINMETO_APP_ID`: Your PinMeTo application ID
- `PINMETO_APP_SECRET`: Your PinMeTo application secret

## Architecture

- `index.js`: Main MCP server implementation
- `src/token.js`: OAuth token management with caching
- `src/helpers.js`: HTTP request helpers and pagination logic

The server uses the standard MCP protocol over stdio for communication with MCP clients.

## Claude Desktop Integration

To use this server with Claude Desktop, add it to your configuration:

### Configuration File Location

```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Configuration Example

```json
{
  "mcpServers": {
    "pinmeto": {
      "command": "node",
      "args": ["/absolute/path/to/your/node-mcp/index.js"],
      "env": {
        "PINMETO_API_URL": "https://api.pinmeto.com",
        "PINMETO_ACCOUNT_ID": "your_account_id_here",
        "PINMETO_APP_ID": "your_app_id_here",
        "PINMETO_APP_SECRET": "your_app_secret_here"
      }
    }
  }
}
```

### Alternative: Using .env File

If you prefer to use a `.env` file for credentials:

1. Copy and configure: `cp .env.example .env`
2. Use simplified Claude config:

```json
{
  "mcpServers": {
    "pinmeto": {
      "command": "node",
      "args": ["/absolute/path/to/your/node-mcp/index.js"]
    }
  }
}
```

After updating the configuration, restart Claude Desktop to load the new server.
