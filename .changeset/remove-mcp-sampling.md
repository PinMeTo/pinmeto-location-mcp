---
"@pinmeto/pinmeto-location-mcp": major
---

Remove MCP Sampling support and stop overriding the SDK's `initialize` handler.

**Breaking: `pinmeto_get_google_review_insights` no longer produces LLM-written
prose.** The tool previously asked the connected client for a completion via MCP
Sampling (`sampling/createMessage`) and fell back to statistical analysis when
that was unavailable. No client our customers use ever implemented Sampling, so
the fallback was the only path that ever ran in practice. MCP `2026-07-28`
additionally deprecates Sampling outright (alongside Roots and Logging), so the
code path had no future.

The tool keeps working and keeps its full input schema. It now always returns
statistical insights: average rating, rating and sentiment distributions,
per-location comparison, and keyword-derived themes. Its description no longer
claims AI analysis, so agents will summarize the returned data themselves rather
than expecting prose.

Output schema changes for consumers of `structuredContent.metadata`:

- `analysisMethod` is now always `"statistical"`; the `"ai_sampling"` variant is
  gone. The field is retained so existing parsers keep working.
- The `SAMPLING_NOT_SUPPORTED` warning code is removed. `SAMPLED_ANALYSIS`,
  `LARGE_DATASET_WARNING`, and `INCOMPLETE_DATA` are unchanged.

Note that `samplingStrategy` / `samplingNote` and the `full` /
`representative` / `recent_weighted` options are **unrelated** to MCP Sampling —
they select *which reviews* get analyzed and are unchanged.

Removed internals: the `src/sampling/` module (prompt building, response
parsing, batching), `checkSamplingSupport()`, and a per-request location lookup
that existed only to name the location inside a sampling prompt. Single-location
analyses now issue one fewer API call.

**Also: the custom `initialize` request handler is gone.** It hand-wrote the
capability list, which advertised a `resources` capability this server has never
implemented — a client calling `resources/list` would have received a
"method not found" error. Capabilities are now derived by the SDK from the tools
actually registered.

The outbound `User-Agent` for PinMeTo API calls is now resolved per request and
sent as a request header, instead of being latched during `initialize` into the
process-global `axios.defaults`. The value is unchanged when a client has
identified itself, and falls back to the server identity alone when it has not.
This also removes a global mutation shared across every axios consumer in the
process, and prepares for MCP `2026-07-28`, which removes the initialize
handshake and moves client identity into each request's `_meta`.
