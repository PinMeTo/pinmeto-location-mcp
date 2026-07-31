# Agent Instructions

## Project Overview

This is an MCP (Model Context Protocol) server that provides AI agents like Claude with access to PinMeTo's location management platform. It exposes tools for fetching location data, insights from Google/Facebook/Apple, ratings, and keywords.

## Environment Configuration

The server requires these environment variables (loaded via `--env-file=.env.local` in npm scripts):
- `PINMETO_ACCOUNT_ID` - PinMeTo account identifier
- `PINMETO_APP_ID` - OAuth application ID
- `PINMETO_APP_SECRET` - OAuth application secret
- `PINMETO_API_URL` - (Optional, dev only) Override API base URL
- `PINMETO_LOCATION_API_URL` - (Optional, dev only) Override locations API base URL

## Releases and Changesets

**⚠️ REQUIRED**: Every PR must include a changeset. CI will reject PRs without one. For changes that don't affect the published package (docs, internal tooling), add an empty changeset with `npx changeset add --empty`.

For the full release workflow (version guidelines, release commands, maintainer flow), use the `release` skill.

## Feature Development Workflow

Before starting any feature, bug fix, or enhancement:

### Step 1: Create a Feature Branch
```bash
# NEVER work directly on main
git checkout main
git pull origin main
git checkout -b <branch-name>  # e.g., feature/add-apple-ratings, fix/auth-timeout
```

**Branch Naming Convention:**
- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `refactor/<description>` - Code refactoring
- `docs/<description>` - Documentation only
- `chore/<description>` - Tooling, dependencies, maintenance

### Step 2: Do the Work
- Make commits to your feature branch
- Run tests: `npm test`
- Run build: `npm run build`
- Add a changeset: `npx changeset add` (or `--empty` for non-release changes)

### Step 3: Create a Pull Request
```bash
git push -u origin <branch-name>
gh pr create --title "feat: description" --body "..."
```

### Step 4: Get the PR Approved
- Request review
- Address feedback
- **NEVER merge without approval**

### Step 5: Merge and Clean Up
```bash
# After PR approval and passing CI
gh pr merge --squash --delete-branch
git checkout main
git pull origin main
```

⚠️ **WORKFLOW CRITICAL RULES:**
- NEVER commit directly to main without explicit user approval
- ALWAYS create a feature branch for any code changes
- ALWAYS create a PR for features and fixes
- Documentation-only changes MAY go to main with explicit user approval

## Tool Naming Convention

All tools follow the MCP best practice naming pattern: `pinmeto_{action}_{network}_{resource}`

| Pattern | Example | Description |
|---------|---------|-------------|
| `pinmeto_get_{resource}` | `pinmeto_get_location` | Single resource retrieval |
| `pinmeto_get_{resource}s` | `pinmeto_get_locations` | Bulk resource retrieval (ALL) |
| `pinmeto_search_{resource}s` | `pinmeto_search_locations` | Search/discovery tools |
| `pinmeto_get_{network}_{resource}` | `pinmeto_get_google_insights` | Network-specific data (single or all) |

**Unified Single/Bulk Pattern**: Network tools accept an optional `storeId` parameter — without it they fetch all locations, with it a single location.

For the step-by-step process of adding a tool, use the `add-tool` skill.

## Tool Annotations

Every tool in this server sets `readOnlyHint: true` and a human-readable `title` — the
server only fetches data and never modifies state, and directory submission requires a
title on every tool. All other annotations use SDK defaults. If a future tool writes, set
`readOnlyHint: false` and consider `destructiveHint: true` for deletes/overwrites and
`idempotentHint: true` where repeated calls have no additional effect.

## Failure Contracts

These are easy to get wrong from reading the call sites alone:

- `makePinMeToRequest()` never throws and never returns `null`. It returns an `ApiResult<T>` discriminated union (`src/errors.ts`): `{ ok: true, data }` or `{ ok: false, error }`. Narrow on `ok` before touching `data`; failures are also logged to stderr.
- `makePaginatedPinMeToRequest()` returns a **three**-element tuple: `[data[], areAllPagesFetched, lastError]`. Destructuring only the first two silently drops the error. `areAllPagesFetched: false` means pagination broke off partway, so partial data alongside a non-null `lastError` is the expected shape — not an empty dataset.
- Insights tools default to `total` aggregation and `none` comparison. This is deliberate, for token efficiency — don't "helpfully" change the defaults to time series.

## Protocol Notes

- **Don't override the SDK's `initialize` handler.** Capabilities are derived from what `createMcpServer()` registers. A previous hand-written override advertised a `resources` capability this server never implemented.
- **Client identity is resolved per request** in `PinMeToMcpServer._userAgent()`, not latched at connection time and never written to `axios.defaults`. MCP `2026-07-28` removes the initialize handshake and moves client identity into each request's `_meta`, so that method is the single seam to change when we migrate.
- **`serverInfo.description` / `websiteUrl` are sent to every client regardless of negotiated protocol version.** This is settled, not an oversight — don't "fix" it. Those fields are new in `2025-11-25`, but the SDK returns `serverInfo` verbatim with no hook to vary it by version, and MCP client schemas are plain Zod objects that strip unknown keys rather than reject (verified: only a hand-rolled `.strict()` schema errors). Gating them would require restoring the initialize override removed above.
- **MCP Sampling, Roots, and Logging are deprecated** as of MCP `2026-07-28`. Sampling support was removed in v4.0.0 — no client our customers use implemented it. Don't reintroduce them. Log to stderr (already the convention here); that *is* the recommended replacement for the Logging feature.
- **"Sampling" in this codebase now means review subsetting only** (`applySamplingStrategy`, `samplingStrategy`, `samplingNote`) — choosing which reviews to analyze. It has nothing to do with MCP Sampling. Keep `samplingNote` for messages about *which reviews* were analyzed (subset strategy, partial store failures); use `analysisNote` for messages about *what analysis* was performed.
- **Cached responses must carry the same `warningCode` as the fresh response** they stand in for. `InsightsCacheEntry` stores it for exactly this reason — the insights cache key includes `analysisType` and `samplingStrategy`, so a dropped warning makes the second identical request look cleaner than the first.
- **`warningCode` reports the single most actionable condition, not the most severe.** `LARGE_DATASET_WARNING` and `INCOMPLETE_DATA` outrank `UNDIFFERENTIATED_ANALYSIS_TYPE` because callers key off the first two to decide whether to re-call. Secondary context belongs in `analysisNote` (top level when the response has no `metadata`, e.g. the confirmation paths) rather than displacing the code.
- **`pinmeto_get_google_review_insights` only differentiates `summary` and `comparison`.** `performStatisticalAnalysis()` populates *only* `summary`; `performStatisticalLocationComparison()` adds `locationComparison`. Nothing populates `themes`, `issues`, or `trends`, and the `themes` parameter is ignored. Those `analysisType` values are accepted and flagged with `UNDIFFERENTIATED_ANALYSIS_TYPE`. If you implement real extraction, remove the flag and the description caveat together.

## Testing

Tests use Vitest with axios mocking. When writing tests:
- Mock axios for all API interactions
- Set required environment variables in `beforeAll`
- Use `StdioServerTransport` to simulate MCP protocol messages
- Test both success paths and error handling

## Session Completion

When ending a work session, work is NOT complete until `git push` succeeds.

1. **Run quality gates** (if code changed) - Tests, linters, build
2. **Add a changeset** (if not already present) - `npx changeset add` or `--empty`
3. **Push and create PR**:
   ```bash
   # Feature branch (normal case):
   git push -u origin <branch-name>
   gh pr create --title "..." --body "..."

   # Main (only for documentation-only changes with user approval):
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
4. **Clean up** - Clear stashes, prune remote branches
5. **Verify** - All changes committed AND pushed

**Critical rules:**
- Work is NOT complete until `git push` succeeds
- NEVER push directly to main for code changes - use feature branches and PRs
- Documentation-only changes MAY go to main with explicit user approval
- Always ask the user before any direct main branch operations
