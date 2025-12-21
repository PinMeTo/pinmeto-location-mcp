---
"@pinmeto/pinmeto-location-mcp": patch
---

Improve error messages with actionable guidance following MCP best practices:

- Add `isError: true` flag and "Error:" prefix to all error responses (MCP compliance)
- Enhance network error specificity with human-readable messages for timeout/DNS/connection failures
- Add Retry-After header parsing for rate limit errors with specific wait times
- Add "Error Handling:" sections to all 10 tool descriptions documenting error patterns
- Add error message quality tests verifying actionable guidance
