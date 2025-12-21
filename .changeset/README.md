# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

## Adding a Changeset

When you make changes that should be released, run:

```bash
npx changeset add
```

This will prompt you to:
1. Select the version bump type (major/minor/patch)
2. Write a summary of your changes (this appears in CHANGELOG.md)

A markdown file will be created in this folder describing your change.

## Version Guidelines

- **patch**: Bug fixes, documentation, internal changes
- **minor**: New features, enhancements (backwards compatible)
- **major**: Breaking changes (API changes, removed features)

## For Maintainers

See the release workflow in CLAUDE.md.
