---
"@pinmeto/pinmeto-location-mcp": patch
---

Resolve Dependabot security alerts by updating dependencies. Raised the `axios` range floor to `^1.16.0` (resolving to 1.18.1 in the lockfile; fixes prototype pollution, proxy credential leak, ReDoS, MITM) and refreshed transitive dependencies in the lockfile: `form-data` 4.0.6, `hono` 4.12.27, `qs` 6.15.2, `fast-uri` 3.1.2 (runtime), plus dev tooling `vite` 7.3.5 and `vitest` 3.2.6 (fixes the critical Vitest UI file-read/exec advisory). Clears all 1 critical and 10 high severity alerts.
