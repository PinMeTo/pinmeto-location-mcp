# Building PinMeTo Location MCP

This guide covers how to build, develop, and manually install the PinMeTo Location MCP server.

## Prerequisites

- **Node.js v22+** (recommended: [NVM](https://github.com/nvm-sh/nvm))
- **npm** (included with Node.js)
- **Claude Desktop** or **Cursor** (for testing)

---

## Building from Source

### 1. Clone the Repository

```bash
git clone https://github.com/PinMeTo/pinmeto-location-mcp.git
cd pinmeto-location-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript, generates `manifest.json`, and copies `package.json` to the `build/` directory.

**Build variants:**

- **Production build**: `npm run build` (uses version from package.json)
- **Test build**: `npm run build:test` (appends "-test" to version)

### 4. Run Tests

```bash
npm test
```

All 189 tests should pass.

---

## Creating the .mcpb Installer

The `.mcpb` file is a single-click installer for Claude Desktop.

### Generate Installer

```bash
npm run build
npx @anthropic-ai/mcpb pack
```

This creates `pinmeto-location-mcp.mcpb` in your project directory.

### Quick Test Build + Installer

```bash
npm run pack:test
```

This creates a test version with "-test" suffix that can be installed alongside the production version.

---

## Manual Installation

### Claude Desktop: Manual Setup

#### 1. Build the Project

```bash
npm install
npm run build
```

#### 2. Configure Claude Desktop

Open your `claude_desktop_config.json` file:

**Mac:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
code %APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
code ~/.config/Claude/claude_desktop_config.json
```

#### 3. Add Server Configuration

**Option A: Using Node directly**

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

**Option B: Using npx** (requires published package)

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

**Find absolute paths:**
- Node path: `which node`
- Project path: `pwd`

#### 4. Get API Credentials

Visit [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3) to get:
- Account ID
- App ID
- App Secret

#### 5. Restart Claude Desktop

The PinMeTo MCP server should now appear in your MCP selection.

---

### Cursor: Manual Setup

#### 1. Build the Project

```bash
npm install
npm run build
```

#### 2. Configure Cursor

Go to **Settings → Cursor Settings → MCP** and click **+ Add New MCP Server**.

This opens `mcp.json` (located at `~/.cursor/mcp.json` for global or `.cursor/mcp.json` for project-specific).

#### 3. Add Server Configuration

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

**Tip:** For most cases, add the server to your project-specific file (`.cursor/mcp.json`).

---

## Development

### Project Structure

```
pinmeto-location-mcp/
├── src/
│   ├── index.ts              # Entry point
│   ├── mcp_server.ts         # Server core and tool registration
│   ├── configs.ts            # Configuration and validation
│   ├── helpers.ts            # Formatting and aggregation helpers
│   └── tools/
│       ├── locations/        # Location management tools
│       ├── networks/         # Platform-specific tools (Google, Facebook, Apple)
│       └── reports/          # Composite reporting tools
├── tests/                    # Test suite (189 tests)
├── build/                    # Compiled output (gitignored)
├── manifest.js               # Manifest generator
└── package.json
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build production version |
| `npm run build:test` | Build test version with "-test" suffix |
| `npm test` | Run test suite (189 tests) |
| `npm run format` | Format code with Prettier |
| `npm start` | Run server in development mode |
| `npm run inspector` | Launch MCP inspector for debugging |
| `npm run pack:test` | Build test version AND create .mcpb installer |
| `npm run clean` | Remove build directory |

### Testing Changes

#### Option 1: Test Build (Recommended)

```bash
# Build test version and create installer
npm run pack:test

# Install the .mcpb file in Claude Desktop
# The test version can be installed alongside production
```

#### Option 2: Direct Development

```bash
# Set up development environment
npm start

# Or use MCP inspector
npm run inspector
```

### Environment Variables

**Required (Production):**
- `PINMETO_ACCOUNT_ID` - Your account identifier
- `PINMETO_APP_ID` - Application ID
- `PINMETO_APP_SECRET` - Application secret

**Optional (Development):**
- `NODE_ENV=development` - Enables .env file loading
- `PINMETO_API_URL` - Override API base URL
- `PINMETO_LOCATION_API_URL` - Override locations API URL

### Adding New Tools

1. Create tool function in appropriate `src/tools/` subdirectory
2. Export function following the established pattern
3. Import and register in `createMcpServer()` in `src/mcp_server.ts`
4. Use `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()` for API calls
5. Add test coverage in `tests/`

**Tool pattern:**
```typescript
export function myTool(server: PinMeToMcpServer) {
  server.tool(
    'tool_name',
    'Description',
    {
      param: z.string().describe('Parameter description')
    },
    async ({ param }) => {
      const { apiBaseUrl, accountId } = server.configs;
      const data = await server.makePinMeToRequest(url);
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }]
      };
    }
  );
}
```

---

## Troubleshooting

### Build Issues

**Error: `tsc` command not found**
```bash
npm install
```

**Error: Cannot find module**
```bash
npm run clean
npm install
npm run build
```

### Runtime Issues

**Error: "Missing required environment variables"**

Ensure all three credentials are set:
- PINMETO_ACCOUNT_ID
- PINMETO_APP_ID
- PINMETO_APP_SECRET

**Error: "Unable to connect to PinMeTo API"**

Check your API credentials at [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3).

### Testing Issues

**Some tests failing**

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
npm test
```

All 189 tests should pass. If tests fail, check:
1. Node.js version (v22+ required)
2. Dependencies are up to date
3. No syntax errors in recent changes

---

## Publishing

### Creating a Release

1. **Update version in `package.json`**
   ```json
   {
     "version": "1.0.5"
   }
   ```

2. **Build and test**
   ```bash
   npm run build
   npm test
   ```

3. **Create .mcpb installer**
   ```bash
   npx @anthropic-ai/mcpb pack
   ```

4. **Commit and tag**
   ```bash
   git add package.json
   git commit -m "Release v1.0.5"
   git tag v1.0.5
   git push origin main --tags
   ```

5. **Create GitHub release**
   - Go to GitHub repository → Releases → Create new release
   - Upload the `.mcpb` file
   - Add release notes

### Publishing to npm

```bash
npm publish
```

Users can then install via:
```bash
npx @pinmeto/pinmeto-location-mcp
```

---

## Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/mcp)
- [PinMeTo API Documentation](https://places.pinmeto.com/account-settings/pinmeto/api/v3)
- [Project Issues](https://github.com/PinMeTo/pinmeto-location-mcp/issues)
