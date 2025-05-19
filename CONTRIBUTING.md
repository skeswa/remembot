# Contributing to Remembot

Thank you for your interest in contributing to Remembot! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### 1. Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/remembot.git
   cd remembot
   ```

### 2. Setup Development Environment

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up environment variables:
   ```bash
   bun run postinstall
   ```

3. Make sure all tests pass:
   ```bash
   bun test
   ```

### 3. Create a Branch

Create a new branch for your feature or bugfix:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bugfix-name
```

### 4. Development Workflow

1. Make your changes
2. Run tests:
   ```bash
   bun test
   ```
3. Run linting:
   ```bash
   bun lint
   ```
4. Format code:
   ```bash
   bun format
   ```

### 5. Commit Your Changes

Follow these commit message guidelines:
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
feat: add new todo creation endpoint

- Add POST /api/todos endpoint
- Implement input validation
- Add error handling

Closes #123
```

### 6. Push and Create Pull Request

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a Pull Request on GitHub
   - Fill out the PR template
   - Link related issues
   - Request review from maintainers

## Development Guidelines

### Development Tools

This project uses several tools to ensure code quality and maintainability:

- [Bun](https://bun.sh/) for package management and running scripts
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Jest](https://jestjs.io/) for testing
- [Turborepo](https://turbo.build/repo) for monorepo management
- [Changesets](https://github.com/changesets/changesets) for versioning and changelog management

### Versioning and Releases

We use Changesets to manage versioning and releases. When making changes that require a version bump:

1. Create a changeset:
   ```bash
   bun changeset
   ```

2. Select the type of change:
   - `patch` for bug fixes and minor changes
   - `minor` for new features that don't break existing functionality
   - `major` for breaking changes

3. Write a description of your changes

4. Commit the changeset file

The maintainers will handle the release process, which includes:
- Version bumping
- Changelog generation
- Publishing packages
- Creating GitHub releases

### Code Style

- Follow the TypeScript style guide
- Use ESLint and Prettier for code formatting
- Write meaningful comments and documentation
- Follow the existing code structure and patterns

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Maintain or improve test coverage
- Include both unit and integration tests where appropriate

### Documentation

- Update documentation for new features
- Add JSDoc comments for new functions
- Update README if necessary
- Document any breaking changes

## Review Process

1. All PRs require at least one review
2. CI checks must pass
3. Code must be up to date with main branch
4. All feedback must be addressed

## Getting Help

- Open an issue for bugs or feature requests
- Join our community discussions
- Check existing documentation

## License

By contributing to Remembot, you agree that your contributions will be licensed under the project's MIT License. 