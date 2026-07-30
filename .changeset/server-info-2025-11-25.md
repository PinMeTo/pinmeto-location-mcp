---
"@pinmeto/pinmeto-location-mcp": minor
---

Advertise MCP spec 2025-11-25 `Implementation` metadata on `serverInfo`: a human-readable `description` and a `websiteUrl`.

These are informational only. The spec lists both fields on `Implementation` but attaches no required client behavior to them, and no client is currently known to render them — Claude Desktop sources its display text from the `mcpb` manifest. They are added because they are cheap (roughly 200 bytes, once per session), spec-aligned, and available to any client or registry tooling that does start reading them.

No custom `initialize` handler is needed: the SDK's `ImplementationSchema` declares both fields, so they pass through from the `PinMeToMcpServer` constructor to the initialize result.

They are sent regardless of the negotiated protocol version. The SDK returns `serverInfo` verbatim and exposes no hook to vary it per version, and MCP client schemas are plain Zod objects that strip unknown keys rather than reject them — only a hand-rolled strict validator would error. Gating them would mean restoring the custom initialize handler removed in the previous release, which had been mis-advertising a `resources` capability this server does not implement.

Per-tool icons (SEP-973) were evaluated and deferred: the high-level `McpServer.registerTool` API in `@modelcontextprotocol/sdk` 1.29.0 does not forward an `icons` field to `tools/list`, so surfacing them would require overriding the list handler via SDK internals. A `serverInfo.icons` field was also evaluated and dropped — no current Claude client renders it, and embedding a data URI would add real payload to every initialize response for no benefit.
