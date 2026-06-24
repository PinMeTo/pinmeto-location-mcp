---
"@pinmeto/pinmeto-location-mcp": patch
---

Unblock `@modelcontextprotocol/sdk` upgrades (now on 1.29.0).

The build was pinned to SDK 1.26.0 because newer versions exposed the bare
`@modelcontextprotocol/sdk/server` subpath with an unconditional ESM `types`
entry, which `tsc` under the older `Node16` module resolution rejected with
TS1479 ("CommonJS module cannot `require` an ECMAScript module").

**Decision: migrate module resolution to `nodenext`.** `tsconfig` `module` and
`moduleResolution` are now `nodenext` instead of `Node16`. The newer resolution
algorithm correctly applies the package's CommonJS `require` condition for the
bare subpath, so the import resolves without error. The package remains
CommonJS (no `"type": "module"`) — `nodenext` keys module format off
`package.json` `"type"`, so emit is still `require(...)` and no entrypoint /
`__dirname` plumbing changes were needed. `nodenext` floats to current Node
resolution semantics, so this also future-proofs against later SDK subpath
changes (unlike `Node16`, which is pinned to Node 16-era behavior).

The `ServerOptions` import is also tightened to `import type` (it is used only
as a type annotation), erasing it at compile time.
