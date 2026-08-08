# Bundling the MCP server and the reports skill as one plugin

**Date:** 2026-07-31
**Status:** Design approved, not implemented
**Scope:** Spans three repos: `pinmeto-location-mcp`, `pinmeto-location-reports-skill`, and a new `claude-plugins`

## Problem

The MCP server and the Location Reports skill ship as two artifacts on two release
trains, and a customer has to install both by hand.

| | MCP server | Reports skill |
|---|---|---|
| Repo | `PinMeTo/pinmeto-location-mcp` | `PinMeTo/pinmeto-location-reports-skill` |
| Artifact | `.mcpb` bundle + npm package | `.skill` file from GitHub releases |
| Install | double-click / npx | manual copy to `~/.claude/skills/` |
| Version | 4.0.0, driven by changesets | 1.1.0, hand-edited in three files |
| Coupling | none declared | hard-requires MCP >= 4.0.0 |

Two goals, both confirmed with the requester:

1. **One install.** A customer does one thing and gets both halves.
2. **Discoverability.** Someone who installs the server should find the reports
   skill without being told it exists.

Consolidating the source repos is explicitly *not* a goal.

The two artifacts fail differently under version skew, which is what makes the
coupling worth enforcing rather than documenting. The server is self-describing:
a client reads its tool schemas at connect time, so a mismatch surfaces as a
protocol error. The skill is markdown naming tool names and parameters, so a
mismatch surfaces as a plausible-looking wrong answer. That asymmetry is why the
skill pins `>= 4.0.0` in three places while the server pins nothing.

### Audience

Claude Desktop customers: non-technical brand and marketing people at PinMeTo
customers. No terminal. This constraint rules out several otherwise-reasonable
options and drives the open risk in Phase 0.

## Platform findings

Verified against the mcpb tooling and Anthropic's docs, July 2026.

**A `.mcpb` cannot carry a skill.** Unpacking `@anthropic-ai/mcpb@2.1.2` and
diffing the manifest schemas shows v0.1 through v0.4 expose `server`, `tools`,
`prompts`, and `user_config`. There is no `skills` key. The Desktop bundle format
is a dead end for co-shipping.

**The MCP SDK (1.30.0) has no skills primitive.** No occurrence of `skill` in
`types.js`. A server cannot advertise a skill over the wire.

**Plugins are the documented answer.** From [Submitting to the Connectors
Directory](https://claude.com/docs/connectors/building/submission): "Skills are
not a standalone submission type — bundle them in a plugin." From [Submitting
your plugin](https://claude.com/docs/plugins/submit): "Plugins can contain any
MCP, including remote MCPs, local MCPs, and MCPBs."

**Plugins preserve the credential dialog.** The plugins reference documents a
`userConfig` field with the same shape as the `.mcpb` `user_config`. Values
substitute as `${user_config.KEY}` in MCP server configs, and `sensitive: true`
routes the value to the macOS Keychain. `${user_config.*}` is rejected in fields
that run through a shell (hook shell-commands, monitor commands) because that
would be command injection; MCP `env` values are passed to the process directly
and are an allowed substitution site. (Superseded 2026-08-08: this proved false for Claude Desktop — see Phase 0 (resolved 2026-08-08) below and `2026-08-08-desktop-install-split-design.md`.)

**Install in Claude Desktop.** Per [Use plugins in
Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude):
Customize -> Plugins -> Browse plugins -> Install, or `+` -> Add marketplace to
sync from a GitHub repo. Skills work across web chat, Claude Desktop, and Cowork;
hooks and sub-agents are Cowork-only, which does not affect this design.

## Alternatives considered

| | A. One plugin | B. Keep two, bridge | C. Absorb reports into server |
|---|---|---|---|
| User install steps | 1 | 2 | 1 |
| Credential prompt | preserved | preserved | preserved |
| Version drift | eliminated | still manual | eliminated |
| Discoverability | plugin directory | mcpb directory only | connectors directory |
| Cost | moderate | low | high |
| Loses | `.mcpb` as primary path | solves nothing | the skill's narrative flexibility |

**Chosen: A.** It is the only option that meets both goals, and it is the path
Anthropic points third parties at.

C was rejected on cost and capability: it means rewriting `generate_pdf.py` and
`generate_pptx.py` (reportlab, python-pptx, matplotlib) in Node, and it gives up
the skill's ability to write narrative and recommendations that adapt to the data.

## Design

### Repo layout

`PinMeTo/claude-plugins`, new and public. Public is a hard requirement: the
plugin directory does not accept closed-source plugins.

```
.claude-plugin/marketplace.json
plugins/pinmeto-locations/
├── .claude-plugin/plugin.json
├── .mcp.json
├── SETUP.md
├── components.json
├── server/
│   └── index.mjs               synced: single-file esbuild bundle, 1.3 MB
└── skills/
    └── pinmeto-location-reports/   synced: unpacked .skill
        ├── SKILL.md
        ├── references/
        ├── scripts/
        └── assets/
```

Payload is roughly 3 MB (measured 3.1 MB vendored; the reports' brand fonts and
logos account for the growth over the early 1.6 MB estimate). The skill's 38 MB working directory (`node_modules`,
sample `.pdf` and `.pptx` fixtures) must not ship. Syncing from the released
`.skill` artifact rather than from source inherits `package-skill.sh`'s
exclusions and makes leakage structurally impossible.

### plugin.json

```json
{
  "name": "pinmeto-locations",
  "version": "4.0.0",
  "description": "PinMeTo location data and analytics reports for Google, Facebook and Apple.",
  "userConfig": {
    "PINMETO_ACCOUNT_ID": {
      "type": "string",
      "title": "PinMeTo Account ID",
      "description": "Found in Account Settings -> API (example: pinmeto)",
      "required": true
    },
    "PINMETO_APP_ID": {
      "type": "string",
      "title": "PinMeTo App ID",
      "description": "Found in Account Settings -> API",
      "required": true
    },
    "PINMETO_APP_SECRET": {
      "type": "string",
      "title": "PinMeTo App Secret",
      "description": "Found in Account Settings -> API",
      "required": true,
      "sensitive": true
    }
  }
}
```

### .mcp.json

> Amended 2026-08-08: the server key `pinmeto` was later renamed to
> `pinmeto-locations` so Claude's plugin UI shows a branded connector label
> instead of the bare `pinmeto` (PinMeTo/claude-plugins#1). Tool names are
> unaffected; only the `mcp__<key>__*` namespace prefix changes.

```json
{
  "mcpServers": {
    "pinmeto": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.mjs"],
      "env": {
        "PINMETO_ACCOUNT_ID": "${user_config.PINMETO_ACCOUNT_ID}",
        "PINMETO_APP_ID": "${user_config.PINMETO_APP_ID}",
        "PINMETO_APP_SECRET": "${user_config.PINMETO_APP_SECRET}"
      }
    }
  }
}
```

### Three deliberate choices

**One plugin version, not two.** A single `plugin.json` version supersedes both
4.0.0 and 1.1.0. The skill's `>= 4.0.0` requirement becomes structurally
unrepresentable rather than documented in three files. Start at `4.1.0` so the
number reads as continuous with the server line customers already know.
(Amended during execution: the plugin starts at 4.0.0, matching the vendored
server, so the first sync lands 4.1.0 honestly — see the plan's
components.json amendment.)

**`SETUP.md`.** The documented hook for guiding a user through MCP configuration
on install. It holds the "get your credentials from Account Settings -> API"
walkthrough, a `pinmeto_get_locations` smoke test so a failed setup surfaces
immediately rather than on the first report, and the duplicate-server check
described under Migration. (Amended during execution: a root-level SETUP.md is
not a skill location — the file lives at skills/pinmeto-setup/SKILL.md, where
the plugin loader actually discovers it.)

**Vendored single-file bundle, not `npx` and not `npm pack`.** `npx -y
@pinmeto/pinmeto-location-mcp` requires Node on PATH, which this audience does
not have. Vendoring the `npm pack` output does not work either: npm never
includes `node_modules` in a tarball, and this server's production dependencies
measure **25 MB across 3,577 files**, which is not something to commit into a
public git repo on every release. Instead the sync step vendors a single-file
esbuild bundle. See the next section.

### Server bundling prerequisite

Bundling was verified against the current `src/`, and produces a **1.3 MB single
file in about 50 ms**. The bundled server completes an `initialize` handshake and
returns all twelve tools over stdio. Two code changes in `pinmeto-location-mcp`
are required first; both were found by actually running the bundle.

**1. `src/mcp_server.ts:27` reads its own `package.json` at runtime.**

```ts
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
```

This feeds `serverInfo` and the User-Agent. In a bundle it fails with
`ReferenceError: __dirname is not defined in ES module scope`, and it would also
break under any relocation of the entry point.

Replace it with a generated module, `src/generated/version.ts`, written from
`package.json` by a `scripts/generate-version.mjs` that runs in `prebuild` and
`pretest`. The file is committed rather than git-ignored, so a bare `npx tsc` or
`npx vitest` works on a fresh checkout; the hooks still regenerate and overwrite
it, keeping `package.json` the single source of truth:

```ts
export const PACKAGE_NAME = '@pinmeto/pinmeto-location-mcp';
export const PACKAGE_VERSION = '4.1.0';
```

Injecting the same constants with esbuild `--define` was considered and rejected:
it breaks the plain `tsc` build that npm and `.mcpb` consumers use, since
`declare const` type-checks but nothing defines the identifier at runtime. A
generated module keeps `package.json` as the single source of truth and behaves
identically under `tsc`, esbuild, and Vitest.

Lines 4 and 6 of `mcp_server.ts` (`readFileSync` from `fs`, `dirname, join` from
`path`) become dead once line 27 goes; `dirname` is already unused today.

**2. axios pulls CJS dependencies that call `require`.** With ESM output the
bundle dies on `Error: Dynamic require of "util" is not supported`, thrown from
`combined-stream` by way of `form-data`. Fix with a `createRequire` banner:

```
--banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"
```

Invocation, once the generated version module is in place:

```bash
node scripts/generate-version.mjs
esbuild src/index.ts --bundle --platform=node --format=esm --target=node18 \
  --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" \
  --outfile=dist/index.mjs
```

The verification run that produced the 1.3 MB figure used `--define` constants in
place of the generated module, since the module did not exist yet. The bundle
contents are equivalent either way.

esbuild is already in the dependency tree via vitest, and `package.json` pins it
through `overrides`. The bundle is a new build target alongside the existing
`build/` output, not a replacement: npm and `.mcpb` consumers keep using
`build/`.

### Sync and release

Two independent release trains have to write one `plugin.json` version.
Push-based sync means two writers racing on one file and duplicated write logic.
Invert it: `claude-plugins` pulls, and the source repos only notify.

```
pinmeto-location-mcp              pinmeto-location-reports-skill
   changesets -> tag v4.1.0          tag v1.2.0
   npm publish                       GH release: *.skill
        │                                 │
        └────── repository_dispatch ──────┘
                        ↓
                PinMeTo/claude-plugins
                .github/workflows/sync.yml
                concurrency: { group: sync, cancel-in-progress: false }
                        ↓
          1. download bundled index.mjs release asset -> server/
          2. download + unzip *.skill -> skills/pinmeto-location-reports/
          3. node scripts/bump-version.mjs
          4. node scripts/check_mcp_parity.js --server ../../server/index.mjs   (parity gate)
          5. claude plugin validate --strict
          6. commit + push
```

Four properties this buys:

- **One writer.** A single workflow with a `concurrency` group serializes
  releases landing minutes apart. Push-based would need rebase-retry logic in two
  repos.
- **Published artifacts only.** The plugin can only ever contain a combination
  that was actually released, and packaging exclusions come along for free. This
  requires `release:draft` in the MCP repo to attach the bundled `index.mjs` as a
  release asset, next to the `.mcpb` it already attaches.
- **`check-mcp` becomes a real gate.** The skill repo already has tool-surface
  parity checking, run by hand per `PUBLISHING.md`. Running it here against the
  exact server build being vendored means a skill calling a tool the pinned
  server does not expose fails the sync instead of shipping.
- **Source repos need about six lines each.** A `repository_dispatch` step and a
  token. Existing release flows are untouched.

### Version rule

`bump-version.js` derives `plugin.json`'s version from a `components.json` it
also writes:

```json
{ "server": "4.1.0", "skill": "1.2.0" }
```

- **Major** tracks the server major only. Server 5.0.0 gives plugin 5.0.0. Server
  majors are what break the skill, so the plugin major means "this is the server
  generation you are on."
- **Minor** bumps when either component has a minor release.
- **Patch** bumps when either has a patch.

A skill minor and a server minor in the same window collapse into one bump. That
is correct: users install one thing and need one number. `components.json` keeps
the provenance and the generated changelog entry cites both.

Note the plugin versioning footgun: with `version` set in `plugin.json`, users
receive nothing until it is bumped, regardless of new commits. The derived bump
in step 3 is what makes a release visible.

## Phase 0: the spike (resolved 2026-08-08)

The plugins reference is written for Claude Code. No page confirms Claude Desktop
renders the `userConfig` dialog, or that a plugin's stdio server gets Desktop's
bundled Node runtime the way a `.mcpb` does. Build a throwaway plugin, add it
from a local path, and answer four questions in Claude Desktop specifically.

| Question | If no |
|---|---|
| Does `userConfig` render a credential prompt? | Resolved 2026-08-08: Claude Desktop does NOT render the plugin `userConfig` prompt (verified on the latest Desktop — no dialog, no Customize panel, env left as literal `${user_config.*}`). Shipped the fallback: the credentialed server ships as the `.mcpb` Desktop Extension and the marketplace plugin is skill-only. See [2026-08-08-desktop-install-split-design.md](2026-08-08-desktop-install-split-design.md). |
| Does the stdio server start, and with whose Node? | Same fallback. Requiring a user-installed Node kills this for the audience |
| Does the bundled skill activate in Desktop chat? | Approach A is dead; revert to option B |
| Can `generate_pdf.py` run (reportlab, python-pptx, matplotlib)? | Pre-existing condition, not caused by this change. Record and continue |

The fallback is not a failure state. One marketplace install followed by a guided
extension setup still beats downloading a file and copying it into a hidden
folder.

Estimated half a day. Nothing else starts until it resolves.

## Migration

Keep publishing the `.mcpb`. Existing customers keep working. The README leads
with the plugin and demotes the extension to "Other installation options."

**Duplicate-server footgun.** A user with the extension installed who then
installs the plugin ends up with two connected servers exposing the same twelve
tool names. Nothing errors; Claude picks arbitrarily and token usage doubles.
`SETUP.md` must detect this and instruct the user to disable the extension first.

## Directory submission

Two directories, two forms, and there are gaps in both. Both gaps are worth
fixing regardless, since the extension submission needs them too.

**Tool titles are missing.** Submission requires that all tools include a `title`
and the applicable `readOnlyHint` or `destructiveHint`. Confirmed by running
`tools/list` against the server: **0 of 12 tools carry a title, 12 of 12 carry
`readOnlyHint`**. All twelve need a title. This contradicts the line in
`AGENTS.md` under Tool Annotations stating that all other annotations use SDK
defaults, so that line needs updating in the same change.

**Privacy policy is two-thirds done.** `manifest.json:75` has the
`privacy_policies` array with an HTTPS URL. The third requirement is a "Privacy
Policy" section in `README.md`, which does not exist. The docs state that missing
or incomplete privacy policies result in immediate rejection.

**Access.** Plugin submission runs through claude.ai admin settings and needs a
Team or Enterprise org with directory management access, or a Console org at
platform.claude.com. Confirm which PinMeTo has before building toward it. After
publication, GitHub pushes are picked up automatically, so the sync workflow
becomes the release mechanism end to end.

## Out of scope

- Consolidating the two source repos.
- Rewriting the Python report generators.
- The skill's Python runtime dependency. It is a pre-existing condition for
  Desktop users and this design neither fixes nor worsens it.
- Claude Code, VS Code, and Cursor install paths. They keep working through npm
  and the existing badges.

## Open questions

1. Phase 0's four answers. Everything downstream depends on them.
2. Whether PinMeTo has a Team/Enterprise org with directory management access, or
   needs a Console org for submission.
3. Whether the plugin directory surfaces inside Claude Desktop's Browse plugins
   view or only in Cowork and Claude Code. The support docs describe an identical
   install flow in Desktop and web; the submission docs describe the directory as
   serving Cowork and Claude Code. If Desktop does not surface it, the marketplace
   repo still works via "Add marketplace" and goal 1 is met, but goal 2 is only
   partly met and the README carries more of the discovery burden.

## References

- [Submitting to the Connectors Directory](https://claude.com/docs/connectors/building/submission)
- [Submitting your plugin](https://claude.com/docs/plugins/submit)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
