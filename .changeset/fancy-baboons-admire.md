---
"@pinmeto/pinmeto-location-mcp": patch
---

fix: improve MCP Sampling detection to check client capabilities

Previously, the sampling support check only verified if the `createMessage` method existed on the SDK server, which was always true. This caused sampling attempts on clients like Claude Desktop that don't support sampling, resulting in confusing `-32601: Method not found` errors in the response.

Now the detection properly checks if the connected client advertised sampling support during initialization via `getClientCapabilities().sampling`. This provides a cleaner experience where clients without sampling support simply get statistical analysis without any error messages.
