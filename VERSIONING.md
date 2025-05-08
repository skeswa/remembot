# Versioning with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versions and publish packages. This document explains how to use Changesets in your development workflow.

## Creating a Changeset

When you make changes to the codebase that should result in a version bump, you need to create a changeset. To do this, run:

```bash
bun changeset
```

This interactive command will:
1. Ask you which packages have changed (select with space, confirm with enter)
2. Ask you what type of change it is for each package:
   - `patch`: Bug fixes and minor changes (0.0.x)
   - `minor`: New features, non-breaking (0.x.0)
   - `major`: Breaking changes (x.0.0)
3. Ask for a summary of the changes

A markdown file will be created in the `.changeset` directory. Commit this file with your changes.

## Example Changeset Workflow

1. Make your changes to the code
   ```bash
   # Make changes to apps/api
   vim apps/api/src/index.ts
   ```

2. Create a changeset
   ```bash
   bun changeset
   ```

3. Select the packages that changed (e.g., `apps/api`)

4. Choose the semver increment (patch/minor/major)

5. Write a description of your changes

6. Commit both your code changes and the changeset
   ```bash
   git add .
   git commit -m "feat: add new endpoint and changeset"
   ```

## How Versioning Works

When changes are merged to `main`:

1. The Changesets GitHub Action will create a "Version Packages" PR
2. This PR contains all the version bumps and changelog updates
3. When the Version Packages PR is merged, it will:
   - Update all package versions
   - Generate changelogs
   - Trigger the build and deployment process

## Manually Applying Versions

If needed, you can manually apply the versions from changesets:

```bash
# Apply versions from changesets
bun run version-packages

# Build and publish (typically handled by CI)
bun run release
```

## Common Scenarios

### Multiple Changes to the Same Package

If you make multiple PRs with changes to the same package before releasing, all those changes will be included in the next version bump.

### Dependencies Between Packages

If Package A depends on Package B and Package B gets a version bump, Package A will also get a patch bump by default (configurable in `.changeset/config.json`).

### Skipping Changesets

For changes that don't need a version bump (e.g., documentation, CI changes), you don't need to create a changeset. 