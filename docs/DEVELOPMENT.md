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

4. Set up environment variables:

```bash
cp .env.example .env
```

5. Start development services:

```bash
bun dev
```

### Monorepo Structure

This project uses Turborepo to manage the monorepo. The workspace is organized as follows:

```
remembot/
├── apps/
│   ├── api/          # Backend API service
│   └── imessage/     # iMessage integration service
├── packages/
│   ├── config/       # Shared configuration
│   ├── database/     # Database models and migrations
│   ├── types/        # Shared TypeScript types
│   └── utils/        # Shared utilities
├── docs/             # Documentation
└── scripts/          # Build and deployment scripts
```

### Development Workflow

1. Create a new branch for your feature:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit them:

```bash
git add .
git commit -m "feat: your feature description"
```

3. Push your changes:

```bash
git push origin feature/your-feature-name
```

4. Create a pull request on GitHub

### Using Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog management. The changesets bot will automatically check your PRs for changesets.

1. **Creating a Changeset**

   ```bash
   # Create a new changeset
   bun changeset
   ```

   This will prompt you to:

   - Select the type of change (patch, minor, major)
   - Write a description of the changes
   - Select the affected packages

2. **Changeset Format**

   ```markdown
   ---
   "package-name": patch|minor|major
   ---

   Description of changes
   ```

3. **Changesets Bot**

   - The bot will automatically comment on PRs that need changesets
   - It provides a direct link to create a changeset from the PR
   - The bot will update its comments when PRs are modified
   - Documentation-only changes typically don't need changesets

4. **Versioning Guidelines**
   - `patch`: Bug fixes and minor changes
   - `minor`: New features (backwards compatible)
   - `major`: Breaking changes

### Turborepo Commands

```bash
# Run development servers for all apps
bun dev

# Build all packages and apps
bun build

# Run tests for all packages and apps
bun test

# Run linting for all packages and apps
bun lint

# Run specific workspace
bun dev --filter=api
bun dev --filter=imessage

# Run command in specific workspace
bun test --filter=api
bun build --filter=imessage
```

## Code Style

- Follow the TypeScript style guide
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages following conventional commits
- Include tests for new features

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

## Debugging

### Local Development

1. Start the development server with debugging:

```bash
bun dev:debug
```

2. Attach your debugger to port 9229

### Logging

- Use the built-in logger for consistent logging
- Log levels: error, warn, info, debug
- Include relevant context in log messages

## Performance Considerations

- Use appropriate indexes in the database
- Implement caching where necessary
- Monitor memory usage
- Profile slow operations

## Security Best Practices

- Never commit sensitive data
- Use environment variables for secrets
- Implement proper input validation
- Follow OWASP security guidelines

## Troubleshooting

### Common Issues

1. **Database Connection Issues**

   - Check database service status
   - Verify environment variables
   - Check database logs

2. **Build Failures**

   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify dependency versions

3. **Test Failures**
   - Check test environment setup
   - Verify test data
   - Check for timing issues

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Bun Documentation](https://bun.sh/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
