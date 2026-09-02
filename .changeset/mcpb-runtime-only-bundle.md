---
"@pinmeto/pinmeto-location-mcp": patch
---

Fix the `.mcpb` installer bundle. The first v4.1.0 asset failed to install in Claude Desktop ("Unsafe file path detected ... Path traversal or absolute paths are not allowed") because the packer bundled an untracked local directory containing files named `review-<sha>..<sha>.diff`. It would also have crashed on startup: an unanchored `dist` rule in `.mcpbignore` matched `node_modules/*/dist` and stripped the SDK's compiled files. `.mcpbignore` is now a deny-by-default allowlist that ships only the runtime (`build/`, `node_modules/`, `package.json`, `manifest.json`, icon, README, LICENSE), and `release:draft` and `pack:test` now run `scripts/verify-mcpb.mjs`, which rejects unsafe paths and unexpected top-level entries and starts the packed server to confirm it answers `tools/list`. The published v4.1.0 asset was rebuilt and replaced.
