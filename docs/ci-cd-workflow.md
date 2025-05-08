# CI/CD Workflow for k3s Deployment

This document outlines the CI/CD workflow for deploying applications to the k3s cluster using GitHub Actions and GitHub Container Registry (GHCR).

## Workflow Overview

1. Developers make changes to the codebase on feature branches
2. When the feature is ready for review, developers create a changeset to document their changes
3. GitHub Actions validates the PR, ensuring changesets are present and that the build passes
4. When the PR is merged, the Changesets bot creates a new PR to version packages
5. Once the version PR is merged, GitHub Actions builds and pushes Docker images to GHCR
6. Kubernetes manifests are updated with the new image tags
7. Changes to Kubernetes manifests trigger deployment to the k3s cluster

## Required GitHub Secrets

The following secrets need to be configured in your GitHub repository:

- `GITHUB_TOKEN` - Automatically available, used for GHCR access
- `KUBECONFIG` - Your k3s cluster's kubeconfig file contents

## Development Workflow

### 1. Feature Development

Create a feature branch from `main`:

```bash
git checkout -b feature/my-new-feature
```

Make your changes to the codebase and commit them:

```bash
git add .
git commit -m "feat: implement new feature"
```

### 2. Creating Changesets

Before creating a PR, add a changeset to document your changes:

```bash
bun changeset
```

This will start an interactive CLI that guides you through the process:

1. Select the packages that have changed (space to select, enter to confirm)
2. Choose the type of change (patch, minor, major) for each package
3. Write a summary of the changes

The command will create a markdown file in the `.changeset` directory. Commit this file:

```bash
git add .changeset/*.md
git commit -m "chore: add changeset"
```

### 3. Creating a Pull Request

Push your branch to GitHub and create a PR:

```bash
git push -u origin feature/my-new-feature
```

Follow the PR template and ensure you've checked the "Changeset" checkboxes.

### 4. CI Validation

GitHub Actions will automatically:
- Check that a changeset is present for affected packages
- Run type checking, linting, and build steps
- Run tests

Fix any issues that arise before merging.

### 5. Versioning and Release Process

When the PR is approved and all checks pass, merge it to `main`.

The Changesets GitHub Action will:
1. Create a new "Version Packages" PR that updates all package versions
2. Generate changelogs based on your changeset descriptions

When the Version Packages PR is merged:
- GitHub Actions will build Docker images for affected apps
- Images will be tagged with the commit SHA and pushed to GHCR
- Kubernetes manifests will be updated with the new image tags
- Updated manifests will trigger deployment to the k3s cluster

### 6. Monitoring Deployments

You can monitor the deployment progress in the GitHub Actions tab of your repository.

## Kubernetes Manifests Structure

Each application contains its own Kubernetes manifests in its respective `k8s` directory:

```
apps/
├── api/
│   ├── src/
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ...
├── web/
│   ├── src/
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ...
└── courier/
    ├── src/
    ├── k8s/
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ...
```

This structure allows each application to own its deployment configuration.

## Troubleshooting

If deployments fail, check:

1. GitHub Actions logs for build or push errors
2. Kubernetes logs for deployment issues:
   ```bash
   kubectl logs -n default deployment/api
   kubectl logs -n default deployment/web
   kubectl logs -n default deployment/courier
   ```

## Manual Release

In case you need to trigger the versioning process manually:

```bash
# Create a changeset
bun changeset

# Apply the versions from changesets
bun run version-packages

# Publish the packages (this will also trigger the build-and-deploy process)
bun run release
```

If you need to deploy Kubernetes manifests manually:

```bash
# Apply Kubernetes manifests for a specific app
kubectl apply -f apps/api/k8s/
kubectl apply -f apps/web/k8s/
kubectl apply -f apps/courier/k8s/
``` 