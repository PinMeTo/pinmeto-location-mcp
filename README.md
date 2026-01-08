# PinMeTo Location MCP

[![version](https://img.shields.io/badge/version-v3.2.0-blue)](https://github.com/PinMeTo/pinmeto-location-mcp/releases/tag/v3.2.0) [![download](https://img.shields.io/badge/download-.mcpb-green)](https://github.com/PinMeTo/pinmeto-location-mcp/releases/download/v3.2.0/pinmeto-location-mcp.mcpb) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-007ACC?logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=pinmeto-location-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40pinmeto%2Fpinmeto-location-mcp%22%5D%2C%22env%22%3A%7B%22PINMETO_ACCOUNT_ID%22%3A%22%24%7Binput%3Apinmeto-account-id%7D%22%2C%22PINMETO_APP_ID%22%3A%22%24%7Binput%3Apinmeto-app-id%7D%22%2C%22PINMETO_APP_SECRET%22%3A%22%24%7Binput%3Apinmeto-app-secret%7D%22%7D%7D) [![Install in Cursor](https://img.shields.io/badge/Cursor-Install-000000?logo=cursor)](https://cursor.com/en/install-mcp?name=PinMeTo&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBwaW5tZXRvL3Bpbm1ldG8tbG9jYXRpb24tbWNwIl0sImVudiI6eyJQSU5NRVRPX0FDQ09VTlRfSUQiOiIke2lucHV0OnBpbm1ldG8tYWNjb3VudC1pZH0iLCJQSU5NRVRPX0FQUF9JRCI6IiR7aW5wdXQ6cGlubWV0by1hcHAtaWR9IiwiUElOTUVUT19BUFBfU0VDUkVUIjoiJHtpbnB1dDpwaW5tZXRvLWFwcC1zZWNyZXR9In19)

Connect your [PinMeTo](https://www.pinmeto.com/) locations to Claude AI. Ask questions about your business in natural language and get instant insights from Google, Facebook, and Apple.

---

## What Can You Do With It?

Ask Claude questions like:

- "What's my average Google rating across all locations?"
- "Show me negative reviews that need responses"
- "Compare this quarter's performance to last year"
- "Which locations are performing best?"

See [Example Prompts](docs/USE-CASES.md) for more ideas.

---

## Installation

### Claude Desktop (Recommended)

1. **Download the installer:** [pinmeto-location-mcp.mcpb](https://github.com/PinMeTo/pinmeto-location-mcp/releases/download/v3.2.0/pinmeto-location-mcp.mcpb)

2. **Double-click** the downloaded file (with Claude Desktop open)

3. **Enter your PinMeTo API credentials** when prompted

   <img width="655" alt="Credential dialog" src="https://github.com/user-attachments/assets/30af64b3-81c3-4bb1-9b05-656831004757" />

4. **Done!** Start chatting with Claude about your locations.

### Where to Find Your Credentials

Get your API credentials from [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3).

### Other Installation Options

| Platform | Method |
|----------|--------|
| VS Code | Click the VS Code badge above |
| Cursor | Click the Cursor badge above |
| Manual | See [Manual Installation](docs/MANUAL-INSTALLATION.md) |

---

## Available Features

| Feature | What You Can Do |
|---------|-----------------|
| **Locations** | View all your locations, search by name or city |
| **Google Insights** | Views, searches, direction requests, calls, clicks |
| **Google Reviews** | Read reviews, filter by rating, find unresponded reviews |
| **Google Ratings** | Average rating, review count, star distribution |
| **Google Keywords** | See how customers search for your business |
| **Facebook Insights** | Page engagement and reach metrics |
| **Facebook Ratings** | Ratings and recommendations |
| **Apple Insights** | Apple Maps performance metrics |

All insights support time aggregation (daily, monthly, quarterly) and period comparison (month-over-month, year-over-year).

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/GETTING-STARTED.md) | First steps, FAQ, and troubleshooting |
| [Example Prompts](docs/USE-CASES.md) | Prompts organized by business need |
| [Tools Reference](docs/TOOLS-REFERENCE.md) | Complete tool documentation |
| [Advanced Features](docs/ADVANCED-FEATURES.md) | Time aggregation and comparisons |
| [Manual Installation](docs/MANUAL-INSTALLATION.md) | Developer setup instructions |

---

## Requirements

- [Claude Desktop](https://claude.ai/download) application
- [PinMeTo](https://www.pinmeto.com/) account with API access

---

## Support

- **Setup issues**: See [Troubleshooting](docs/GETTING-STARTED.md#troubleshooting)
- **Feature questions**: See [FAQ](docs/GETTING-STARTED.md#faq)
- **Bug reports**: [GitHub Issues](https://github.com/PinMeTo/pinmeto-location-mcp/issues)
- **PinMeTo account**: [PinMeTo Support](https://www.pinmeto.com/contact)

---

## License

MIT
