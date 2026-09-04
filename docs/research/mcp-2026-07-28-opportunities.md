# MCP 2026-07-28 opportunities for PinMeTo Location MCP

Date: 2026-09-04

## Recommendation

Add cache hints first. Then prototype Multi Round-Trip Request (MRTR) elicitation for the existing large-review confirmation flow, while preserving its current explicit re-call response for clients that do not advertise elicitation support. Server instructions are a smaller, useful cleanup. The other major additions in MCP 2026-07-28 do not fit this stdio-only, read-only server today.

The current release already covers the essential protocol migration. It serves both eras through `serveStdio`, lets the SDK provide `server/discover`, reads modern client identity from the per-request envelope, and relies on the SDK to stamp modern results with server identity and `resultType` ([entry point](../../src/index.ts#L3), [server identity and client context](../../src/mcp_server.ts#L83), [dual-era process test](../../tests/stdio-protocol-eras.test.ts#L49)). This matches the official [2026-07-28 lifecycle](https://modelcontextprotocol.io/specification/2026-07-28/changelog) and the TypeScript SDK's [protocol-era guidance](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions).

## Ranked opportunities

| Rank | Change | Value | Effort | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Cache `tools/list` and `server/discover` | High | Low | Do next |
| 2 | MRTR elicitation for review-analysis choices | Medium-high | Medium | Prototype behind capability detection |
| 3 | Add concise server instructions | Medium | Low | Bundle with a nearby protocol change |
| 4 | Propagate trace context | Low-medium | Low | Forward approved W3C trace headers |

### 1. Advertise real cache hints

MCP 2026-07-28 adds required `ttlMs` and `cacheScope` fields to cacheable results. The SDK currently emits the safe defaults, `ttlMs: 0` and `cacheScope: "private"`, unless `ServerOptions.cacheHints` supplies a policy. A zero TTL means clients cannot reuse the result ([protocol schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.json), [SDK cache-hint documentation](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28#cache-fields-and-cache-hints)).

This server registers a fixed set of twelve tools when each process starts, and its discovery metadata does not vary by account credentials ([registration](../../src/mcp_server.ts#L237)). Set positive, `public` cache hints for `tools/list` and `server/discover`; one hour is a conservative starting TTL. Also add a test that pins the current deterministic tool order. The protocol now recommends stable `tools/list` ordering because it improves response caching and model prompt-cache hits ([official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog#minor-changes)).

Do not add cache hints to `tools/call`. Tool results contain account data, and `tools/call` is not one of the cacheable operations in the new protocol.

### 2. Use MRTR for the existing review-analysis choice

MRTR lets a tool return `input_required`, ask the client for typed input, and finish when the client retries the original call with `inputResponses`. The TypeScript SDK exposes this as `inputRequired(...)` and `acceptedContent(...)`; its legacy shim can run the same handler for capable 2025-era clients ([MCP release explanation](https://blog.modelcontextprotocol.io/posts/2026-07-28/#multi-round-trip-requests-mrtr), [SDK input-required guide](https://ts.sdk.modelcontextprotocol.io/v2/servers/input-required)).

`pinmeto_get_google_review_insights` already implements this interaction manually. It returns `requiresConfirmation` plus full, representative, or recent-weighted options and asks the model to call the tool again ([large dataset path](../../src/tools/networks/google.ts#L1091), [medium dataset path](../../src/tools/networks/google.ts#L1153)). A form elicitation could present those choices directly and reduce model-driven re-calls.

Keep the current structured warning when the request's client capabilities do not include elicitation. That retains compatibility with clients that can use the tool but cannot complete MRTR. No `requestState` is needed for a one-round choice; if the flow later carries trusted facts across rounds, use the SDK's signed state codec and verification hook rather than accepting an unsigned state string.

### 3. Add server-level instructions

`server/discover` can return short instructions for how an LLM should use the server. `ServerOptions.instructions` also reaches legacy initialization through the SDK ([discovery specification](https://modelcontextprotocol.io/specification/2026-07-28/server/discover), [SDK `ServerOptions`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/src/server/server.ts)).

The current server sets an implementation description but no instructions ([constructor](../../src/mcp_server.ts#L242)). A short block could explain when to use location search versus bulk location retrieval, when to choose raw reviews versus review insights, and how to respond to `warningCode`. Keep it brief because clients may place it in model context.

### 4. Propagate approved trace context

The revision standardizes W3C `traceparent`, `tracestate`, and `baggage` keys in request `_meta`, allowing a trace to continue through the MCP server to downstream calls ([official changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog#minor-changes)). The request context already reaches the outbound Axios seam ([request helper](../../src/mcp_server.ts#L100)), so this has a clear implementation point.

The follow-up review confirmed that both downstream API paths use OpenTelemetry HTTP instrumentation. The Locations API explicitly enables the W3C `tracecontext` propagator. This gives valid `traceparent` and `tracestate` values a consumer and keeps the implementation useful even though MCP clients are not required to send them.

Forward valid `traceparent` values unchanged. Forward a valid, bounded `tracestate` only when its `traceparent` is valid. Do not forward `baggage`: it may contain arbitrary client-controlled data, and the Locations API does not enable the baggage propagator. Keep the values request-scoped and drop malformed metadata without failing the tool call.

## Changes not worth adding now

- **Tasks extension:** The tools are ordinary reads and currently complete synchronously. Tasks add polling, cancellation, persistence, and expiry semantics intended for durable long-running work. Reconsider only if a tool becomes a genuinely asynchronous export or report job. The redesign is summarized in the [protocol changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog#major-changes).
- **Subscriptions:** The tool catalog is fixed for a process, and this server exposes no MCP resources. There is nothing useful to publish through `subscriptions/listen` today.
- **MCP Apps:** An interactive map or analytics view could become a separate product feature, but it would add UI assets and host-specific testing to a focused data connector. The repository has already kept report presentation outside the server ([current scope decision](../superpowers/specs/2026-08-08-desktop-install-split-design.md#out-of-scope-yagni)).
- **HTTP routing headers and OAuth changes:** `Mcp-Method`, `Mcp-Name`, issuer validation, and client registration changes apply to Streamable HTTP or MCP OAuth. This package runs over stdio and authenticates directly to PinMeTo with configured client credentials, so they do not change its server interface.
- **Roots, Sampling, or MCP Logging:** MCP 2026-07-28 deprecates all three and tells new implementations not to adopt them. Continue logging to stderr. The review-insights implementation has already removed MCP Sampling ([current implementation](../../src/tools/networks/google.ts#L1229), [deprecation notice](https://modelcontextprotocol.io/specification/2026-07-28/changelog#deprecated)).
- **Non-object `structuredContent`:** The new schema permits any JSON value, but the current object-shaped responses are useful, tested, and compatible with both protocol eras. Changing their root shape would create consumer churn with no clear benefit.

## Suggested sequence

1. Add `public` cache hints for `tools/list` and `server/discover`, plus wire-level tests for the TTL, scope, and stable order.
2. Add concise server instructions in the same small release if the wording is settled.
3. Prototype MRTR on the two review-insights confirmation branches and test modern elicitation, capable legacy elicitation, and no-capability fallback.
4. Propagate approved W3C trace context at the shared outbound request seam.
