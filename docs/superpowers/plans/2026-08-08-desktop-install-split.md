# Desktop install split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PinMeTo offering install cleanly in Claude Desktop by delivering the credentialed MCP server as a `.mcpb` and reducing the marketplace plugin to skills only.

**Architecture:** Two artifacts, split along Claude Desktop's real capabilities. The `.mcpb` (built in `pinmeto-location-mcp`, already published to GitHub releases) carries the stdio server and uses Desktop's native `user_config` credential dialog. The marketplace plugin (`claude-plugins`) drops its non-functional server and `userConfig` and ships only the `pinmeto-location-reports` and `pinmeto-setup` skills. The server-release → marketplace sync wiring is removed since the plugin no longer vendors the server.

**Tech Stack:** Node.js (ESM), GitHub Actions, Claude Code plugin + MCPB formats, `node --test` for `bump-version.mjs`.

## Global Constraints

- Two repos: `PinMeTo/pinmeto-location-mcp` (this repo, local at `~/Projects/code/pinmeto-location-mcp`) and `PinMeTo/claude-plugins` (local at `~/Projects/code/claude-plugins`).
- Never commit to `main` directly; each repo gets a feature branch + PR. This repo requires a changeset per PR (`npx changeset add`, or `--empty` for docs/tooling-only).
- The server's twelve `pinmeto_*` tool names do not change. The `.mcpb` build (`release:draft` → `mcpb pack`) is not modified.
- Plugin version only ever moves forward from the current `4.0.1`. Do not reset it to the skill's `1.2.x`.
- The `pinmeto-setup` skill is hand-authored in `claude-plugins` (NOT vendored by `sync.yml`); edit it there directly. The `pinmeto-location-reports` skill IS vendored from `PinMeTo/pinmeto-location-reports-skill` — do not hand-edit it in `claude-plugins`.

---

## Repo A — `claude-plugins` (skill-only plugin)

Work in `~/Projects/code/claude-plugins`. Start from an up-to-date `main`:

```bash
cd ~/Projects/code/claude-plugins && git checkout main && git pull --ff-only && git checkout -b fix/skill-only-plugin
```

### Task A1: Rewrite `bump-version.mjs` to derive from the skill only

**Files:**
- Modify: `scripts/bump-version.mjs`
- Modify: `scripts/bump-version.test.mjs`
- Modify: `plugins/pinmeto-locations/components.json`

**Interfaces:**
- Produces: `nextVersion(currentPlugin, before, after, allowDowngrade?)` where `before`/`after` are `{ skill: string }` (no `server` key); returns the next plugin version string or `null`.

- [ ] **Step 1: Update the tests to the skill-only contract (write failing)**

Replace the body of `scripts/bump-version.test.mjs` with tests that use `{ skill }` shapes only:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion, parseFlag } from './bump-version.mjs';

test('skill patch bump increments plugin patch', () => {
  assert.equal(nextVersion('4.0.1', { skill: '1.2.0' }, { skill: '1.2.1' }), '4.0.2');
});

test('skill minor bump increments plugin minor and zeroes patch', () => {
  assert.equal(nextVersion('4.0.1', { skill: '1.2.0' }, { skill: '1.3.0' }), '4.1.0');
});

test('skill major bump increments plugin major and zeroes minor/patch', () => {
  assert.equal(nextVersion('4.0.1', { skill: '1.2.0' }, { skill: '2.0.0' }), '5.0.0');
});

test('no skill change returns null', () => {
  assert.equal(nextVersion('4.0.1', { skill: '1.2.0' }, { skill: '1.2.0' }), null);
});

test('skill downgrade throws unless allowed', () => {
  assert.throws(() => nextVersion('5.0.0', { skill: '1.3.0' }, { skill: '1.2.0' }), /older than/);
  assert.equal(nextVersion('5.0.0', { skill: '1.3.0' }, { skill: '1.2.0' }, true), '5.0.1');
});

test('parseFlag reads --flag value and --flag=value', () => {
  assert.equal(parseFlag(['--skill', '1.2.0'], '--skill'), '1.2.0');
  assert.equal(parseFlag(['--skill=1.2.0'], '--skill'), '1.2.0');
  assert.equal(parseFlag(['--other', 'x'], '--skill'), null);
});

test('parseFlag throws on a dangling flag', () => {
  assert.throws(() => parseFlag(['--skill', '--allow-downgrade'], '--skill'), /requires a value/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/bump-version.test.mjs`
Expected: FAIL (current `nextVersion` still expects `before.server`).

- [ ] **Step 3: Rewrite `nextVersion` and `main` to skill-only**

In `scripts/bump-version.mjs`, replace `nextVersion` with:

```js
/**
 * @param {string} currentPlugin  the plugin's current version
 * @param {{skill: string}} before  previously vendored skill version
 * @param {{skill: string}} after   newly vendored skill version
 * @param {boolean} [allowDowngrade]
 * @returns {string|null} the next plugin version, or null if the skill did not move
 */
export function nextVersion(currentPlugin, before, after, allowDowngrade = false) {
  const plugin = parse(currentPlugin);
  const [bk, ak] = [parse(before.skill), parse(after.skill)];

  if (!allowDowngrade && compareVersions(ak, bk) < 0) {
    throw new Error(
      `skill version ${after.skill} is older than the currently vendored ${before.skill}. Refusing to sync a downgrade. Pass --allow-downgrade to override.`
    );
  }

  if (ak.major !== bk.major) return `${plugin.major + 1}.0.0`;
  if (ak.minor !== bk.minor) return `${plugin.major}.${plugin.minor + 1}.0`;
  if (ak.patch !== bk.patch) return `${plugin.major}.${plugin.minor}.${plugin.patch + 1}`;
  return null;
}
```

In `main()`, drop the `--server` handling and the `before.server` read. The `after` object becomes `{ skill: parseFlag(args, '--skill') ?? before.skill }`, and `components.json` is written as `{ skill: after.skill }`. Update the module docstring to describe skill-only derivation.

- [ ] **Step 4: Update `components.json` to the skill-only shape**

`plugins/pinmeto-locations/components.json`:

```json
{
  "skill": "1.2.0"
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/bump-version.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/bump-version.mjs scripts/bump-version.test.mjs plugins/pinmeto-locations/components.json
git commit -m "refactor: derive plugin version from the skill only"
```

### Task A2: Make the plugin skill-only (remove the server)

**Files:**
- Delete: `plugins/pinmeto-locations/.mcp.json`
- Delete: `plugins/pinmeto-locations/server/` (directory)
- Modify: `plugins/pinmeto-locations/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Remove the server declaration and bundle**

```bash
git rm plugins/pinmeto-locations/.mcp.json
git rm -r plugins/pinmeto-locations/server
```

- [ ] **Step 2: Remove `userConfig` and bump the plugin to 5.0.0**

Edit `plugins/pinmeto-locations/.claude-plugin/plugin.json`: delete the entire `userConfig` block, and set `"version": "5.0.0"`. Rationale: removing the bundled server is a breaking change to the plugin's contract, so it takes a major bump; `bump-version.mjs` then derives future versions from the skill on the `5.x` line.

- [ ] **Step 3: Match the marketplace entry**

Edit `.claude-plugin/marketplace.json`: set the `pinmeto-locations` entry `"version": "5.0.0"` and update its `description` to name it a reports skill, e.g. `"PinMeTo location reports skill for Google, Facebook and Apple (data connection installed separately as a Desktop Extension)."`

- [ ] **Step 4: Validate the plugin still loads**

Run: `npx --yes @anthropic-ai/claude-code plugin validate ./plugins/pinmeto-locations --strict`
Expected: passes with no MCP server and the two skills present.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat!: drop the bundled MCP server; plugin is skill-only"
```

### Task A3: Strip server steps from `sync.yml`

**Files:**
- Modify: `.github/workflows/sync.yml`

- [ ] **Step 1: Remove the server-coupled steps and trigger**

Edit `.github/workflows/sync.yml`:
- In `on.repository_dispatch.types`, remove `server-released` (keep `skill-released`).
- Remove the `server_version` `workflow_dispatch` input and every reference to `SERVER_INPUT`, `CURRENT_SERVER`, `SERVER`, and the server semver check in "Resolve target versions" (keep the skill resolution and its semver check).
- Delete the steps "Vendor the server bundle", "Verify the bundled server starts…", and "Tool-surface parity against the vendored server".
- In "Derive the plugin version", drop the `--server` flag: `NEXT=$(node scripts/bump-version.mjs --skill "$SKILL_VERSION")`.
- In "Commit", drop `SERVER_VERSION` from the env and message: `git commit -m "chore: sync plugin $NEXT_VERSION (skill $SKILL_VERSION)"`.

- [ ] **Step 2: Lint the YAML**

Run: `npx --yes yaml-lint .github/workflows/sync.yml` (or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/sync.yml'))"`).
Expected: parses with no error.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sync.yml
git commit -m "ci: stop vendoring the server in the sync workflow"
```

### Task A4: Rewrite the `pinmeto-setup` skill to the `.mcpb`-first flow

**Files:**
- Modify: `plugins/pinmeto-locations/skills/pinmeto-setup/SKILL.md`

- [ ] **Step 1: Replace the body with the corrected onboarding**

Keep the frontmatter `name`/`description` but update the description to mention the Desktop Extension. Replace the body with:

```markdown
# PinMeTo Locations setup

## 1. Install the data connection (the Desktop Extension)

The location data comes from the **PinMeTo Location MCP** Desktop Extension
(`.mcpb`), not from this plugin. Download the latest `.mcpb` from
https://github.com/PinMeTo/pinmeto-location-mcp/releases, then double-click it (or
drag it into Claude Desktop → Settings → Extensions). Claude Desktop shows an
install dialog that prompts for three values.

## 2. Credentials

All three come from [PinMeTo Account Settings ->
API](https://places.pinmeto.com/account-settings/pinmeto/api/v3):

| Field | Notes |
| --- | --- |
| Account ID | Short identifier, for example `pinmeto` (not the company display name) |
| App ID | Public |
| App Secret | Sensitive; stored in the system keychain |

## 3. Verify the connection

Call `pinmeto_get_locations` with no arguments.

- Locations returned: setup is complete.
- `errorCode: "UNAUTHORIZED"`: one of the three credentials is wrong, most often the
  Account ID.
- Tool not found: the extension did not start. Fully quit and reopen Claude Desktop.

## 4. Avoid running two servers

Only one PinMeTo server should be active. Duplicates expose the same twelve tool
names; Claude picks one silently and token usage roughly doubles. Check for:

- An **older PinMeTo Locations plugin** (version 4.0.1 or earlier) that still
  bundled its own server — update it to the current skill-only plugin.
- A **second copy of the `.mcpb`** extension.

## 5. What is available

Twelve read-only tools covering locations, Google insights, reviews, ratings and
keywords, Facebook insights and ratings, and Apple Maps insights. This plugin's
**PinMeTo Location Reports** skill turns that data into PDF and PowerPoint reports;
it activates on requests like "create a Q4 report".
```

- [ ] **Step 2: Commit**

```bash
git add plugins/pinmeto-locations/skills/pinmeto-setup/SKILL.md
git commit -m "docs: rewrite setup skill for the .mcpb-first Desktop flow"
```

### Task A5: Update the marketplace README and open the PR

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the Install and Versioning sections**

Edit `README.md` so Install reads (Desktop-first):
1. Install the data connection: download the `.mcpb` from the `pinmeto-location-mcp` releases and double-click it; enter the three API credentials when prompted.
2. Add this marketplace (`PinMeTo/claude-plugins`) and install **PinMeTo Locations** for the report skill.
Update the "What is inside" line to say the plugin ships the reports + setup skills and that the MCP server ships separately as the Desktop Extension. In "Versioning", remove the "plugin major tracks the MCP server major" sentence and say the plugin version now tracks the vendored skill; `components.json` records the vendored skill version.

- [ ] **Step 2: Validate and push**

```bash
npx --yes @anthropic-ai/claude-code plugin validate ./plugins/pinmeto-locations --strict
git add README.md
git commit -m "docs: Desktop-first install, skill-only plugin"
git push -u origin fix/skill-only-plugin
gh pr create --title "feat!: skill-only plugin; server ships as the .mcpb" --body "Claude Desktop does not render plugin userConfig, so the bundled server could never authenticate there. Remove the server from the plugin (delete .mcp.json, userConfig, vendored server/, and the server-coupled sync steps), leaving the reports + setup skills. The credentialed server ships as the .mcpb Desktop Extension. Plugin bumped to 5.0.0 (breaking: server removed); versioning now derives from the skill. See pinmeto-location-mcp spec 2026-08-08-desktop-install-split-design.md."
```

---

## Repo B — `pinmeto-location-mcp` (this repo)

Already on branch `feature/desktop-install-split`. Continue here.

### Task B1: Retire the server-release → marketplace notification

**Files:**
- Delete: `.github/workflows/notify-marketplace.yml`

- [ ] **Step 1: Remove the dead dispatch**

The plugin no longer vendors the server, so a server release must not trigger a plugin sync.

```bash
git rm .github/workflows/notify-marketplace.yml
```

- [ ] **Step 2: Confirm nothing else references it**

Run: `grep -rn "server-released\|notify-marketplace\|MARKETPLACE_DISPATCH_TOKEN" .github/`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: stop notifying the marketplace on server release"
```

### Task B2: Update this repo's README/docs to the Desktop-first flow

**Files:**
- Modify: `README.md`
- Modify: `docs/GETTING-STARTED.md`
- Modify: `docs/MANUAL-INSTALLATION.md` (verify only; likely already `.mcpb`/manual)

- [ ] **Step 1: Lead installation with the `.mcpb`**

In `README.md` and `docs/GETTING-STARTED.md`, present the Desktop path first: download the `.mcpb` from releases, double-click, enter the three credentials. Add a short "Reports skill" pointer to the `PinMeTo/claude-plugins` marketplace. Add a "Claude Code (CLI)" subsection stating that CLI users run the npm package or add the server with `claude mcp add` (the plugin no longer bundles a server). Grep first to match existing structure:

Run: `grep -rn "marketplace\|plugin\|mcpb\|user_config" README.md docs/GETTING-STARTED.md`

- [ ] **Step 2: Commit**

```bash
git add README.md docs/GETTING-STARTED.md docs/MANUAL-INSTALLATION.md
git commit -m "docs: Desktop-first install via the .mcpb; document the CLI path"
```

### Task B3: Close the Phase 0 spike and add a changeset

**Files:**
- Modify: `docs/superpowers/specs/2026-07-31-plugin-bundling-design.md`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Record the Phase 0 outcome**

In `docs/superpowers/specs/2026-07-31-plugin-bundling-design.md`, change the heading `## Phase 0: the spike (blocking)` to `## Phase 0: the spike (resolved 2026-08-08)` and replace the first row's "If no" cell to state the actual finding: Claude Desktop does not render the plugin `userConfig` dialog, so the fallback shipped — the server ships as the `.mcpb` and the plugin is skill-only (see `2026-08-08-desktop-install-split-design.md`).

- [ ] **Step 2: Add an empty changeset (docs/CI only in this repo)**

Run: `npx changeset add --empty`
Then edit the generated file's summary to: `Docs and CI: Desktop-first install; retire the marketplace server-release dispatch.`

- [ ] **Step 3: Commit, push, open PR**

```bash
git add docs/superpowers/specs/2026-07-31-plugin-bundling-design.md .changeset
git commit -m "docs: close the Phase 0 spike with the Desktop finding"
git push -u origin feature/desktop-install-split
gh pr create --title "docs+ci: Desktop-first install split" --body "Companion to claude-plugins skill-only PR. Retires the server-release marketplace dispatch, leads install with the .mcpb, documents the CLI path, and closes the Phase 0 spike. Design: docs/superpowers/specs/2026-08-08-desktop-install-split-design.md."
```

---

## Self-review (completed)

- **Spec coverage:** artifacts split (A2, `.mcpb` unchanged) ✓; plugin skill-only (A2) ✓; sync steps + trigger removed (A3); versioning skill-only, forward from 4.0.1 → 5.0.0 (A1/A2, Decision A) ✓; setup skill rewrite located and done (A4, resolves the spec's open question) ✓; README/marketplace copy (A5, B2) ✓; CLI decision documented (B2, Decision B) ✓; notify wiring retired (B1) ✓; Phase 0 closed (B3) ✓.
- **Placeholder scan:** the changeset filename is generated by `changeset add` (not a placeholder); all code/content shown inline.
- **Type consistency:** `nextVersion(currentPlugin, {skill}, {skill}, allowDowngrade?)` and `components.json` `{skill}` shape used consistently across A1 and A3's `--skill` invocation.
