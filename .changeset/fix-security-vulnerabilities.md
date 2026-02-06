---
"@pinmeto/pinmeto-location-mcp": patch
---

fix: update dependencies to resolve security vulnerabilities

- Update `@modelcontextprotocol/sdk` to 1.26.0 (fixes cross-client data leak via shared server/transport reuse)
- Update `hono` to 4.11.8 (fixes XSS, cache deception, arbitrary key read, and IPv4 validation bypass)
