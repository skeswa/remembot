# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Remembot is an iMessage-based todo management application built as a monorepo using Turborepo. It allows users to manage their todos directly through iMessage conversations.

## Essential Commands

### Development

- `bun dev` - Start all development servers concurrently
- `bun dev --filter=web` - Start only the web app dev server
- `bun dev --filter=api` - Start only the API dev server
- `bun dev --filter=courier` - Start only the courier dev server

### Building

- `bun build` - Build all packages and apps
- `bun build --filter=@remembot/imessage` - Build specific package
- `bun build --filter=api` - Build specific app

### Testing

- `bun test` - Run all tests using Bun's built-in test runner
- `bun test packages/imessage/src/send.spec.ts` - Run specific test file
- Test files follow the pattern `*.spec.ts` and use `describe`, `test`, `expect`, and `mock` from `bun:test`

### Code Quality

- `bun lint` - Run ESLint across all packages
- `bun fmt` - Format code with Prettier
- `bun check-types` - Run TypeScript type checking

### Other

- `bun clean` - Clean all build artifacts
- `bun release` - Run the custom release script

## Architecture

### Monorepo Structure (Angreal Pattern)

- **apps/** - Deployable applications
  - **api** - Backend API service (compiled to native binary)
  - **courier** - WebSocket client service (compiled to native binary)
  - **web** - Next.js frontend application
- **packages/** - Shared packages
  - **@remembot/imessage** - Core iMessage integration using AppleScript and SQLite
  - **@remembot/imessage-cli** - CLI wrapper for iMessage operations
  - **@repo/ui** - Shared React components
  - **@repo/eslint-config** - Shared ESLint configurations
  - **@repo/typescript-config** - Shared TypeScript configurations

Each app and package includes:

- `package.json` with `version` field and `release` field for tracking deployment/publishing state
- Apps also contain `Dockerfile` and `k8s/` directory for deployment

### Key Technologies

- **Runtime**: Bun 1.2.11
- **Framework**: Next.js 15.3.0 (web), custom Bun servers (api/courier)
- **Language**: TypeScript 5.8.2
- **Testing**: Bun's built-in test runner
- **Deployment**: Docker containers with Kubernetes configurations

### iMessage Integration

The `@remembot/imessage` package provides:

- Sending messages via AppleScript/OSA
- Reading messages directly from SQLite database
- Contact management through AppleScript
- Event-based message listening with polling

### Build System

- Uses Turborepo for task orchestration
- Native compilation: API and Courier compile to standalone executables using `bun build --compile`
- Docker multi-stage builds optimize for production (Turborepo-optimized with pruning)
- Environment variables are automatically set up from `.env.example` files

#### Docker Build Pattern

Multi-stage Turborepo-optimized builds:

```dockerfile
FROM oven/bun:1.2.11-alpine AS base
FROM base AS builder
RUN bun add -d turbo@2.5.2
COPY . .
RUN bunx turbo prune --scope=app --docker

FROM base AS installer
COPY --from=builder /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN bun run build

FROM base AS runner
COPY --from=installer /app/apps/app/dist/index ./
USER bunuser
EXPOSE 3000
CMD ["./index"]
```

### CI/CD Workflows

#### Core Workflows

##### Release Workflow (`.github/workflows/release.yaml`)
- Triggered on push to main
- Uses changesets/action to manage versions
- Runs custom `bun release` script to create git tags for changed packages
- Triggers `publish-drifted-apps-and-packages` workflow when releases are created

##### Publish Drifted Apps & Packages (`.github/workflows/publish-drifted-apps-and-packages.yaml`)
- Finds all packages where `version` differs from `release.publish.version`
- Filters by release strategy (k8s, npm, or local)
- Triggers `publish-app-or-package` workflow for each drifted package

##### Publish App or Package (`.github/workflows/publish-app-or-package.yaml`)
- Unified workflow for publishing both apps and packages
- For k8s apps:
  - Builds multi-arch Docker images
  - Pushes to GitHub Container Registry
  - Updates k8s deployment manifests with new image tags
  - Updates `release.publish` field
  - Triggers deployment
- For npm packages:
  - Updates `release.publish` field
  - (NPM publishing to be implemented)

#### Deployment Workflows

##### Deploy App (`.github/workflows/deploy-app.yaml`)
- Reads `release.strategy`, `release.k8s.configDirPath`, and `release.k8s.kubeconfigSecretName` from package.json
- Uses the specified GitHub secret to access the target Kubernetes cluster
- Applies k8s manifests in order
- Updates `release.deploy` field after successful deployment

##### Deploy Changed Apps (`.github/workflows/deploy-changed-apps.yaml`)
- Triggered when YAML/JSON files change in apps/
- Detects which apps were affected by working backwards from changed files
- Only deploys if:
  - App has k8s strategy
  - K8s config files changed
  - Published version differs from deployed version

##### Deploy All Apps (`.github/workflows/deploy-all-apps.yaml`)
- Manual workflow to deploy all k8s apps
- Finds apps by checking `release.strategy` in package.json
- Verifies k8s config directories exist

### Release Process (Angreal Pattern)

This project uses the Angreal deployment pattern - a comprehensive workflow for TypeScript monorepos with Turborepo, Changesets, GitHub Actions, Docker, and Kubernetes.

#### Version Management

- **Changesets** handles version bumping and changelog generation
- Custom release system (`scripts/release.ts`) that:
  - Compares `version` with `release.publish.version` to detect drift
  - Creates git tags in format `packageName@version` for changed packages
  - Works with three release strategies:
    - **k8s**: For deployable applications with Docker/Kubernetes
    - **npm**: For publishable packages to npm registry  
    - **local**: For internal packages that aren't published externally

#### Release Field Structure

Each package.json contains a `release` field that tracks deployment and publishing information:

```json
// For apps (k8s strategy)
"release": {
  "strategy": "k8s",
  "k8s": {
    "configDirPath": "./k8s",             // Where k8s manifests are stored (relative to package.json)
    "kubeconfigSecretName": "RHUIDEAN_KUBECONFIG"  // GitHub secret containing kubeconfig for target cluster
  },
  "deploy": {
    "timestamp": "2025-06-19T12:00:00.000Z",  // When last deployed to cluster
    "version": "0.2.5"                         // Version currently running in cluster
  },
  "publish": {
    "timestamp": "2025-06-19T12:00:00.000Z",  // When Docker image was built
    "version": "0.2.5"                         // Version of published Docker image
  }
}

// For packages (npm strategy)
"release": {
  "strategy": "npm",
  "publish": {
    "timestamp": "2025-06-19T12:00:00.000Z",  // When published to npm
    "version": "0.2.0"                         // Version published to npm
  }
}

// For internal packages (local strategy)
"release": {
  "strategy": "local"  // No external publishing
}
```

#### How Version Tracking Works

1. **Version Drift Detection**: The release script compares `version` (in package.json) with `release.publish.version`
2. **Publishing**: When versions differ, git tags are created triggering publish workflows
3. **Deployment**: For k8s apps, deployment only happens when:
   - Configuration files change AND
   - `release.publish.version` differs from `release.deploy.version`
4. **Tracking Updates**:
   - `release.publish` is updated when Docker images are built or npm packages published
   - `release.deploy` is updated after successful k8s deployment

#### Release Flow

1. Make code changes
2. Run `bun changeset` to describe changes
3. Create PR with changeset file
4. Merge PR after validation
5. Changesets creates "Version Packages" PR
6. Merge triggers custom release script
7. Script creates git tags for packages where `version` != `release.publish.version`
8. Tags trigger publish workflows:
   - For k8s apps: Build Docker images, update manifests, deploy
   - For npm packages: Update publish tracking
9. `release.publish` field updated with version and timestamp
10. Deploy workflows update `release.deploy` field after successful deployment

## Development Patterns

### Testing

- Mock external dependencies using `mock()` from `bun:test`
- Test files colocated with source files as `*.spec.ts`
- Comprehensive error handling and edge case testing

### Code Style

- Prettier for formatting (configured for TS, TSX, MD)
- ESLint with custom configs per environment
- All ESLint errors are warnings (using `only-warn` plugin)

### Deployment

- All apps use Alpine-based Docker images with multi-stage builds
- Apps run as non-root user (`bunuser`)
- Kubernetes configurations in `k8s/` directories:
  - `deployment.yaml` - versioned container images
  - `namespace.yaml`, `service.yaml`, `ingress.yaml` - standard k8s resources
  - Target cluster specified via `release.k8s.kubeconfigSecretName` in package.json
- Container images tagged with versions from package.json
- Multi-cluster support via per-app deployment targets
- Atomic git operations with retry logic for concurrent pushes

### Environment Setup

- `.env` files are automatically created from `.env.example` on install
- Required for Apple Developer Account credentials for iMessage
- Needs permissions for Messages and Contacts access on macOS

## Key Deployment Patterns (Angreal)

### Version Drift Detection

- **Publishing**: Compares `version` with `release.publish.version`
- **Deployment**: Compares `release.publish.version` with `release.deploy.version`
- Triggers updates only when drift detected
- Prevents unnecessary builds and deployments

### Release Field Tracking

- Comprehensive `release` field in package.json
- Tracks deployment and publishing separately with timestamps
- Three strategies: k8s (Docker/Kubernetes), npm (packages), local (internal)
- Enables independent version bumping, publishing, and deployment
- Supports custom k8s config directories via `release.k8s.configDirPath`

### Multi-Cluster Support

- Per-app deployment targets via `release.k8s.kubeconfigSecretName` in package.json
- Environment-specific KUBECONFIG secrets stored in GitHub
- Flexible cluster assignment per application

### Atomic Git Operations

- Retry logic for concurrent git pushes
- Ensures k8s manifest updates succeed
- Maintains consistency between git and deployments
