---
---

Retire the unused single-file server bundle. The `npm run bundle` script, `scripts/build-bundle.mjs`, its `release:draft` step, the `dist/index.mjs` release asset, and `tests/bundle.test.ts` existed only to feed the `PinMeTo/claude-plugins` marketplace, which became skill-only and no longer vendors the bundle. No published-package impact — the `.mcpb` Desktop deliverable (`build/index.js`) is unchanged.
