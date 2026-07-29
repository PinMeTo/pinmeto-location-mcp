---
name: release
description: Version, changelog, and release workflow for this MCP server using Changesets. Use when adding a changeset, cutting a release, bumping the version, or publishing to npm/GitHub.
---

# Release Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Adding Changes (Contributors)

```bash
npx changeset add          # Add a changeset for your changes
# Select: major/minor/patch
# Write: summary (appears in CHANGELOG)
git add .changeset/ && git commit -m "docs: add changeset"
```

**⚠️ REQUIRED**: Every PR must include a changeset. CI will reject PRs without one. For changes that don't affect the published package (docs, internal tooling), add an empty changeset with `npx changeset add --empty`.

## Version Guidelines

- **patch**: Bug fixes, documentation, internal changes
- **minor**: New features, enhancements (backwards compatible)
- **major**: Breaking changes (API changes, removed features)

## Release Commands

```bash
npm run release:prepare    # Preview pending changesets
npm run release:version    # Bump version + update CHANGELOG + README badges
npm run release:draft      # Test, build, pack, create draft GitHub release
npm run release:publish    # Publish the draft release (or use GitHub UI)
npm run clean              # Remove build directory
```

## Release Flow (Maintainers)

1. Run `npm run release:prepare` to see pending changes
2. Run `npm run release:version` to apply version bump
3. Commit: `git add -A && git commit -m "chore: release vX.Y.Z"`
4. Run `npm run release:draft` to create draft release
5. Review draft on GitHub, then run `npm run release:publish`
6. Push: `git push && git push --tags`
