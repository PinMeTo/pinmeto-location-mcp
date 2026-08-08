# Desktop install split: `.mcpb` server + skill-only plugin

**Status:** approved design, ready for implementation planning
**Date:** 2026-08-08
**Repos touched:** `PinMeTo/pinmeto-location-mcp` (this repo) and `PinMeTo/claude-plugins`

## Problem

Customers install the PinMeTo offering in **Claude Desktop**. The plugin-bundling
work (PR #54, marketplace repo `claude-plugins`) shipped a single marketplace
plugin that bundles both the MCP server and the reports skill, with the server's
credentials declared via `userConfig` in `plugin.json` and `${user_config.*}` in
`.mcp.json`.

That credential mechanism **does not work in Claude Desktop**. Verified empirically
(plugin enabled, v4.0.1, latest Desktop): no credential prompt appears, no
"Customize" panel exists, and the server's env stays as literal
`${user_config.*}`. The server reads its three credentials at startup
([src/configs.ts](../../../src/configs.ts)) and throws before connecting when they
are missing ([src/index.ts](../../../src/index.ts) constructs the server before
`.connect()`), so it never appears as a connected server.

Root cause is a platform boundary, not a config bug:

- Plugin `userConfig` / `${user_config.*}` prompting is a **Claude Code CLI**
  feature. Claude Desktop installs plugins (skills included) but does not render
  the userConfig dialog.
- The **`.mcpb`** Desktop Extension format *does* render a credential dialog in
  Claude Desktop (`user_config` in `manifest.json`, sensitive values in the OS
  keychain, `${user_config.*}` substituted at launch). It cannot carry skills.

So in Claude Desktop no single artifact can deliver both a credentialed server and
skills. A remote OAuth connector would, but that needs a hosted backend, which is
explicitly out of scope.

Sources: [Building Desktop Extensions with MCPB](https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb),
[Build a desktop extension with MCPB](https://claude.com/docs/connectors/building/mcpb),
[Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## Approach (chosen: Approach 1)

Split the two pieces along what Claude Desktop can actually do, and remove the dead
server that is confusing customers.

- **`.mcpb` Desktop Extension** (this repo) is the one and only MCP server.
  Double-click install; the credential dialog collects the three keys into the OS
  keychain. Already built and attached to GitHub releases by `release:draft`. No
  change to how it works.
- **Marketplace plugin** (`claude-plugins`) becomes **skill-only**: it delivers the
  `pinmeto-location-reports` and `pinmeto-setup` skills and nothing else. Its dead
  MCP server is removed, which also eliminates the silent duplicate-tools risk when
  a customer has both the plugin and the `.mcpb`.

Rejected alternatives: (2) fold reports into the server as MCP tools so one `.mcpb`
does everything — large rewrite of local PDF/PPTX generation, not ship-now;
(3) status quo plus docs — leaves the dead/duplicate server in place.

## Changes by repo

### `claude-plugins` (marketplace, skill-only plugin)

- Delete `plugins/pinmeto-locations/.mcp.json`.
- Remove the `userConfig` block from `plugins/pinmeto-locations/.claude-plugin/plugin.json`.
- Remove the vendored `plugins/pinmeto-locations/server/` directory and the
  server-copy step from `.github/workflows/sync.yml`. The sync workflow now vendors
  only the skill(s).
- Simplify versioning (see Decision A): `components.json` drops `server` and keeps
  `skill`; `scripts/bump-version.mjs` (and its tests) derive the plugin version from
  the skill only, moving forward from the current `4.x` line.
- Update `README.md` and the plugin's entry in `.claude-plugin/marketplace.json`:
  the plugin is the *reports skill*; the data connection is the `.mcpb`.

### `pinmeto-location-mcp` (this repo)

- Rewrite the `pinmeto-setup` skill onboarding text to the `.mcpb`-first flow
  below, and delete the false line *"Claude prompts for these when the plugin is
  enabled."* **The plan must first locate the skill's source of truth:** the copy
  at `claude-plugins/plugins/pinmeto-locations/skills/pinmeto-setup/SKILL.md` is
  vendored by `sync.yml` and marked "must not be hand-edited", so the edit belongs
  in whatever upstream `sync.yml` pulls from (confirm: this repo, the
  `pinmeto-location-reports-skill` repo, or authored directly in `claude-plugins`).
- Update `README.md` / `docs/` install instructions to lead with the `.mcpb` for
  Desktop and document the Claude Code CLI path separately (see Decision B).
- Close out the Phase 0 spike in
  [docs/superpowers/specs/2026-07-31-plugin-bundling-design.md](2026-07-31-plugin-bundling-design.md):
  record that Claude Desktop does not render plugin `userConfig`, which is why the
  fallback (skill-only plugin + `.mcpb` server) is now the design.

## Onboarding flow (the `pinmeto-setup` skill)

1. **Data connection (required):** download `PinMeTo.mcpb` from the GitHub release,
   double-click (or drag into Settings), and enter Account ID, App ID, and App
   Secret from [Account Settings → API](https://places.pinmeto.com/account-settings/pinmeto/api/v3).
2. **Reports (optional):** add the `PinMeTo/claude-plugins` marketplace and install
   the plugin to get the report skill.
3. **Verify:** call `pinmeto_get_locations` with no arguments. Locations = done;
   `UNAUTHORIZED` = a wrong key (usually the Account ID short name); tool not found
   = server did not start, fully quit and reopen Claude Desktop.
4. **Conflict check (rewritten):** the risk is now *two servers* — a leftover old
   plugin (≤ 4.0.1, which still bundled a server) or a second `.mcpb`. Both expose
   the same twelve tool names; Claude picks one silently and token usage roughly
   doubles.

## Decisions

**A. Plugin versioning.** The server is no longer vendored, so the plugin version
tracks the **skill** only. Keep the number moving *forward* from the current
`4.0.1` (do not reset to the skill's `1.2.x`; a visible regression reads as broken
to customers). `components.json` becomes `{ "skill": "<x.y.z>" }`;
`bump-version.mjs` derives the next plugin version from the skill delta alone,
retaining its downgrade guard.

**B. Claude Code CLI users.** Removing the server from the plugin means CLI users
lose the plugin-bundled server (it worked there via `userConfig`). Accepted:
customers are on Desktop. Documented CLI path is the npm package / manual
`claude mcp add`, not the plugin.

## Out of scope (YAGNI)

- No remote OAuth backend / hosted MCP server.
- No rewriting the reports skill into server-side MCP tools.
- No Connectors Directory submission this round (a good no-backend follow-on for
  in-app discoverability, but it carries a review process — not ship-now).

## Success criteria

- A Claude Desktop customer installs `PinMeTo.mcpb`, is prompted for the three
  credentials, and `pinmeto_get_locations` returns data.
- Installing the marketplace plugin adds the report skill with no second server and
  no duplicate-tools warning.
- The `pinmeto-setup` skill's instructions match the shipped behavior end to end.
