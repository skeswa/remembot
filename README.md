# Remembot

Remembot is an innovative iMessage application that helps users manage their todos directly through iMessage. It provides a seamless experience for creating, updating, and tracking tasks without leaving your favorite messaging platform.

## Features

- Create and manage todos through iMessage
- Set due dates and reminders
- Mark tasks as complete
- View task lists and status
- Natural language processing for task creation

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [CI/CD Overview](./docs/ci-cd-workflow.md)
- [API Documentation](./docs/API.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## Setup Instructions

### Prerequisites

- Bun 1.0 or higher
- Apple Developer Account (for iMessage integration)
- GitHub account

### Local Development Setup

1. Clone the repository:

```bash
git clone https://github.com/skeswa/remembot.git
cd remembot
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

```bash
bun run postinstall
```

Edit `.env` with your configuration values.

4. Start the development server:

```bash
bun run dev
```

### Monorepo Structure

This project uses Turborepo to manage the monorepo. The workspace is organized as follows:

```
remembot/
├── apps/             # Applications
├── packages/         # Shared libraries and other packages
└── docs/             # Documentation
```

### Repository Setup

1. **GitHub Actions Permissions**

   - Go to your repository settings
   - Navigate to Actions > General
   - Under "Workflow permissions":
     - Select "Read and write permissions"
     - Check "Allow GitHub Actions to create and approve pull requests"

2. **Branch Protection**

   - Go to Settings > Branches
   - Add a rule for the `main` branch
   - Enable required status checks
   - Require pull request reviews before merging

3. **Changesets Bot Setup**
   - Go to [changeset-bot GitHub App](https://github.com/apps/changeset-bot)
   - Click "Install App"
   - Select the repositories where you want to use the bot
   - The bot will automatically:
     - Check PRs for changesets
     - Comment on PRs that need changesets
     - Provide links to create changesets directly from PR comments
     - Update comments when PRs are modified

### Development Tools

This project uses several tools to ensure code quality:

- [Bun](https://bun.sh/) for package management and running scripts
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Turborepo](https://turbo.build/repo) for monorepo management
- [Changesets](https://github.com/changesets/changesets) for versioning and changelog management

For detailed information about our CI/CD pipeline and release process, please refer to our [CI/CD Overview](./docs/ci-cd-workflow.md).

### Available Scripts

- `bun dev` - Start development servers for all apps
- `bun build` - Build all packages and apps
- `bun test` - Run tests for all packages and apps
- `bun lint` - Run linting for all packages and apps
- `bun format` - Format code

### Turborepo Commands

```bash
# Run command in specific package of workspace
bun dev --filter=api
bun test --filter=web
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
