---
"@pinmeto/pinmeto-location-mcp": patch
---

Fix every tool call failing in Claude Desktop with "invalid outputSchema: JSON Schema declares an unsupported dialect (draft-07)". The v1 MCP SDK (`@modelcontextprotocol/sdk` 1.30.0) emitted draft-07 on every `inputSchema` and `outputSchema` with no way to opt into 2020-12 (modelcontextprotocol/typescript-sdk#2084), and Claude Desktop now rejects that dialect. Migrated to the v2 SDK (`@modelcontextprotocol/server` 2.0.0) and Zod 4, which advertise JSON Schema 2020-12 on all 12 tools. Requires Node 20 or newer.
