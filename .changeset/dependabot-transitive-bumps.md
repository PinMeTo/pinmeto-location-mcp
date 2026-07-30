---
"@pinmeto/pinmeto-location-mcp": patch
---

Clear all 7 open Dependabot alerts (3 high, 2 moderate, 1 low, plus one npm-audit-only finding) via `npm audit fix`. Lockfile only — no `package.json` change was needed, since every fix landed inside an existing semver range.

| Package | To | Source | Severity |
|---|---|---|---|
| `fast-uri` | 3.1.4 | sdk → ajv | high ×2 |
| `js-yaml` | 3.15.0 / 4.3.0 | @changesets/cli (dev) | high ×2, moderate |
| `postcss` | 8.5.25 | vitest → vite (dev) | high |
| `@hono/node-server` | 2.0.12 | sdk | moderate |
| `body-parser` | 2.3.0 | sdk → express | low |

All are transitive. Worth noting for triage: the `body-parser`, `express`, and `@hono/node-server` advisories describe DoS and path-traversal in HTTP request handling, which this server never reaches — it runs on stdio only and those packages arrive as unused dependencies of `@modelcontextprotocol/sdk`'s HTTP transport. So the practical exposure was minimal; the bumps are for a clean audit rather than to close a reachable hole.

`npm audit` now reports 0 vulnerabilities. Tests, typecheck, and build all pass, and the built server was smoke-tested over stdio.
