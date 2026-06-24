---
"@pinmeto/pinmeto-location-mcp": minor
---

Adopt MCP spec 2025-11-25 `Implementation` metadata on `serverInfo`: a human-readable `description`, a `websiteUrl`, and the PinMeTo brand `icon` (embedded 48x48 PNG data URI). Clients now receive richer context and branding during initialization.

Per-tool icons (SEP-973) were evaluated but deferred: the high-level `McpServer.registerTool` API in `@modelcontextprotocol/sdk` 1.29.0 does not forward an `icons` field to `tools/list`, so surfacing them would require overriding the list handler via SDK internals. Tool calling in sampling requests (`tools`/`toolChoice`) was also evaluated and is not needed: the single sampling-based tool summarizes review text already supplied in the prompt.
