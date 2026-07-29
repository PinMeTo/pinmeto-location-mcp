---
name: add-tool
description: Step-by-step checklist for adding a new tool to this PinMeTo MCP server, covering naming, schemas, handler wiring, and registration. Use when adding or modifying an MCP tool.
---

# Adding a New Tool

1. Create tool registration function in appropriate module under `src/tools/`
2. **Name the tool** following the `pinmeto_{action}_{network}_{resource}` pattern (see AGENTS.md)
3. Define Zod schema for input validation
4. Add `response_format: ResponseFormatSchema` to input schema
5. Define or reuse output schema from `src/schemas/output.ts`
6. Implement handler using `server.makePinMeToRequest()` or `server.makePaginatedPinMeToRequest()`
7. Use `formatContent()` helper to format response based on `response_format`
8. Return both `content` (text) and `structuredContent` (typed data) from handler
9. For insights tools, use `aggregateInsights()` and `finalizeInsights()` helpers
10. Add appropriate tool annotations — `readOnlyHint: true` for read-only tools, which is every tool currently in this server
11. Register tool in `createMcpServer()` function in `src/mcp_server.ts`

Follow the patterns in the existing tool modules rather than inventing new shapes — read a neighbouring tool in the same directory first.
