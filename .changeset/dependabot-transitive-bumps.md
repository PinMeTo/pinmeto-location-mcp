---
"@pinmeto/pinmeto-location-mcp": patch
---

Clear every open dependency advisory. Both scanners now report zero: **Dependabot 7 alerts → 0**, **`npm audit` 6 findings → 0**.

The two totals differ because the tools count differently, and neither is wrong:

- **Dependabot lists one alert per advisory**: 7 alerts (4 high, 2 moderate, 1 low) across 4 packages.
- **`npm audit` groups advisories per package**: 6 findings (3 high, 2 moderate, 1 low) — and it additionally flagged `postcss`, which Dependabot did not report.

Five packages were bumped in total:

| Package | To | Comes from | Advisories | Flagged by |
|---|---|---|---|---|
| `fast-uri` | 3.1.4 | sdk → ajv | 2 high | both |
| `js-yaml` | 3.15.0 / 4.3.0 | `@changesets/cli` (dev) | 2 high, 1 moderate | both |
| `@hono/node-server` | 2.0.12 | sdk | 1 moderate | both |
| `body-parser` | 2.3.0 | sdk → express | 1 low | both |
| `postcss` | 8.5.25 | vitest → vite (dev) | 1 high | `npm audit` only |

That is 8 distinct advisories across the two scanners — 7 seen by Dependabot plus the `postcss` one only `npm audit` caught.

Lockfile only: every fix landed inside an existing semver range, so `package.json` is unchanged and no `overrides` entry was needed.

Worth noting for triage: all five are transitive, and the `body-parser`, `express`, and `@hono/node-server` advisories describe DoS and path traversal **in HTTP request handling**, which this server never reaches — it runs on stdio only, and those packages arrive as unused dependencies of `@modelcontextprotocol/sdk`'s HTTP transport. The practical exposure was minimal; these bumps buy a clean audit rather than close a reachable hole.

Typecheck, 233 tests, and build all pass, and the built server was smoke-tested over stdio.
