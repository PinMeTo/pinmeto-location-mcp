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

Every tool in this server sets `readOnlyHint: true` — the server only fetches data and never modifies state. All other annotations use SDK defaults. If a future tool writes, set `readOnlyHint: false` and consider `destructiveHint: true` for deletes/overwrites and `idempotentHint: true` where repeated calls have no additional effect.

## Failure Contracts

These are easy to get wrong from reading the call sites alone:

- `makePinMeToRequest()` returns `null` on error (logged to stderr) rather than throwing. Callers must handle `null`.
- `makePaginatedPinMeToRequest()` returns a tuple `[data[], areAllPagesFetched]`. Check the flag — `false` means the results are truncated, not that the dataset is empty.
- Insights tools default to `total` aggregation and `none` comparison. This is deliberate, for token efficiency — don't "helpfully" change the defaults to time series.

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
