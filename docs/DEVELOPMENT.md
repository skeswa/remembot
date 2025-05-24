# Development Guide

## Getting Started

### Environment Setup

1. Install required tools:

   - Bun 1.0+
   - Git

2. Clone the repository:

```bash
git clone https://github.com/skeswa/remembot.git
cd remembot
```

3. Install dependencies:

```bash
bun install
```

4. Set up environment variables etc.:

```bash
punt postinstall
```

5. Start development apps:

```bash
bun dev
```

## Repo Setup

### GitHub Actions Secrets

This document outlines all the secrets required for GitHub Actions workflows in this repository.

#### Deployment Secrets

##### Kubeconfig Secrets

These secrets contain the kubeconfig files for different deployment targets. The secret names are constructed using the format `{TARGET}_KUBECONFIG` where `{TARGET}` is the deployment target name in uppercase.

| Secret Name           | Description                                 | Required For                |
| --------------------- | ------------------------------------------- | --------------------------- |
| `RHUIDEAN_KUBECONFIG` | Kubeconfig for the rhuidean (Ubuntu) server | courier app deployment      |
| `HOMEMAC_KUBECONFIG`  | Kubeconfig for the homemac (macOS) server   | web and api apps deployment |

##### Container Registry Secrets

| Secret Name    | Description                              | Required For                      |
| -------------- | ---------------------------------------- | --------------------------------- |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions | Container registry authentication |

#### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

##### Kubeconfig Setup

For each deployment target:

1. Get the kubeconfig file from your k3s cluster:

   ```bash
   # On the target server
   cat /etc/rancher/k3s/k3s.yaml
   ```

2. Create a new secret in GitHub:
   - Name: `{TARGET}_KUBECONFIG` (e.g., `RHUIDEAN_KUBECONFIG`)
   - Value: Paste the entire contents of the kubeconfig file

###### Relationship with target.yaml

Each app in the monorepo has a `k8s/target.yaml` file that specifies which deployment target it should be deployed to. The workflow uses this file to determine which kubeconfig secret to use:

1. The `target.yaml` file contains a single line with the target name (e.g., `rhuidean` or `homemac`)
2. During deployment, the workflow:
   - Reads the target from `apps/{app}/k8s/target.yaml`
   - Converts the target name to uppercase
   - Uses it to construct the secret name: `{TARGET}_KUBECONFIG`
   - Uses the corresponding secret for deployment

For example:

- If `apps/courier/k8s/target.yaml` contains `rhuidean`, the workflow will use `RHUIDEAN_KUBECONFIG`
- If `apps/web/k8s/target.yaml` contains `homemac`, the workflow will use `HOMEMAC_KUBECONFIG`

## Development Workflow

### Overview

1. Developers make changes to the codebase on feature branches
2. When the feature is ready for review, developers create a changeset to document their changes
3. GitHub Actions validates the PR, ensuring changesets are present and that the build passes
4. When the PR is merged, the Changesets bot creates a new PR to version packages
5. Once the version PR is merged, GitHub Actions builds and pushes Docker images to GHCR
6. Kubernetes manifests are updated with the new image tags
7. Changes to Kubernetes manifests trigger deployment to the k3s cluster

### Process

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

### 3. Linting and Testing

Before preparing to create a new pull request, ensure that your changes do not fail any tests or lints.

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test path/to/test.ts
```

### Linting and Formatting

```bash
# Run linter
bun lint

# Fix linting issues
bun lint:fix

# Format code
bun format
```

### 4. Creating a Pull Request

Push your branch to GitHub and create a PR:

```bash
git push -u origin feature/my-new-feature
```

Follow the PR template and ensure you've checked the "Changeset" checkboxes.

### 5. CI Validation

GitHub Actions will automatically:

- Check that a changeset is present for affected packages
- Run type checking, linting, and build steps
- Run tests

Fix any issues that arise before merging.

### 6. Versioning and Release Process

When the PR is approved and all checks pass, merge it to `main`.

The Changesets GitHub Action will:

1. Create a new "Version Packages" PR that updates all package versions
2. Generate changelogs based on your changeset descriptions

When the Version Packages PR is merged:

- GitHub Actions will build Docker images for affected apps
- Images will be tagged with the commit SHA and pushed to GHCR
- Kubernetes manifests will be updated with the new image tags
- Updated manifests will trigger deployment to the k3s cluster

### 7. Monitoring Deployments

You can monitor the deployment progress in the GitHub Actions tab of your repository.

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Bun Documentation](https://bun.sh/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
