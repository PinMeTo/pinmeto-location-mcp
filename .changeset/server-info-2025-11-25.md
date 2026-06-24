---
"@pinmeto/pinmeto-location-mcp": minor
---

Adopt MCP spec 2025-11-25 `Implementation` metadata on `serverInfo`: a human-readable `description` and a `websiteUrl`. Clients now receive richer context during initialization, aligning with the registry `server.json` format.

Per-tool icons (SEP-973) were evaluated but deferred: the high-level `McpServer.registerTool` API in `@modelcontextprotocol/sdk` 1.29.0 does not forward an `icons` field to `tools/list`, so surfacing them would require overriding the list handler via SDK internals. A `serverInfo.icons` field was also evaluated and dropped: no current Claude client renders it (Claude Desktop sources its branding from the `mcpb` manifest, which already references the PinMeTo icon; Claude.ai web does not render `serverInfo` icons), so embedding a data URI would only add payload to every initialize response. Tool calling in sampling requests (`tools`/`toolChoice`) was also evaluated and is not needed: the single sampling-based tool summarizes review text already supplied in the prompt.
