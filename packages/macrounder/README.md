# @remembot/macrounder

A background service manager for macOS that automatically updates and manages running applications by monitoring GitHub releases.

## Overview

Macrounder is designed to run continuously on macOS, providing automatic updates for applications by:

- Monitoring GitHub releases for new versions
- Downloading and installing updates automatically
- Managing service lifecycle (start/stop/restart)
- Providing logging and observability

## Features

- **Automatic Updates**: Polls GitHub releases and updates applications when new versions are available
- **Process Management**: Start, stop, and restart managed services
- **Background Operation**: Integrates with macOS launchd for persistent background operation
- **Logging**: Comprehensive logging with configurable levels and outputs
- **CLI Interface**: Command-line tools for manual control and debugging
- **TOML Configuration**: Human-friendly configuration format for each app

## Installation

```bash
bun install @remembot/macrounder
```

## Configuration

Macrounder uses TOML configuration files stored in `~/.macrounder/apps/`. Each app has its own configuration file.

### App Configuration Example

Create a file `~/.macrounder/apps/courier.toml`:

```toml
[app]
name = "courier"
repository = "remembot/courier"
check_interval = 300  # Check for updates every 5 minutes
auto_start = true     # Start automatically when macrounder starts
auto_restart = true   # Restart on failure

[build]
# Optional: Specify build command if the app needs to be built
command = "bun build --compile --minify --sourcemap --outfile ./dist/courier ./src/index.ts"
working_directory = "."

[run]
# Runtime configuration
binary_path = "./dist/courier"  # Path to the executable
working_directory = "."
args = []  # Command line arguments

[environment]
# Environment variables
NODE_ENV = "production"
LOG_LEVEL = "info"
```

### Global Configuration

Global settings are stored in `~/.macrounder/config.toml`:

```toml
log_level = "info"  # debug, info, warn, error
log_dir = "~/.macrounder/logs"
```

## Usage

### CLI Commands

```bash
# Add a new app
macrounder add courier --repo remembot/courier

# Remove an app
macrounder remove courier

# List all configured apps
macrounder list

# Edit app configuration
macrounder edit courier

# Start managing service(s)
macrounder start          # Start all services
macrounder start courier   # Start specific service

# Stop service(s)
macrounder stop           # Stop all services
macrounder stop courier    # Stop specific service

# Restart a service
macrounder restart courier

# Check and apply updates
macrounder update courier

# View status of all services
macrounder status

# View logs
macrounder logs courier --tail 100

# Install as launchd service
macrounder install-daemon

# Run as daemon
macrounder daemon

# Migrate from old JSON config
macrounder migrate
```

### Programmatic Usage

```typescript
import { ServiceManager, AppConfigManager } from "@remembot/macrounder";

const manager = new ServiceManager();

// Start all configured services
await manager.start();

// Or manage apps programmatically
const configManager = new AppConfigManager();
const appConfig = {
  app: {
    name: "my-app",
    repository: "owner/repo",
    check_interval: 300,
    auto_start: true,
    auto_restart: true,
  },
  run: {
    binary_path: "./dist/my-app",
    working_directory: ".",
    args: [],
  },
  environment: {},
};
configManager.saveApp(appConfig);
```

## Architecture

Macrounder consists of several key components:

- **AppConfigManager**: Manages TOML configuration files for each app
- **ServiceManager**: Core service management and lifecycle control
- **GitHubMonitor**: Monitors GitHub releases for updates
- **ProcessManager**: Handles process spawning and monitoring
- **UpdateManager**: Downloads and installs updates
- **LaunchdIntegration**: macOS launchd integration for background operation

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun build

# Run CLI in development
bun run cli
```

## Smart Defaults

Macrounder provides intelligent defaults to minimize configuration:

- **Binary Path**: Automatically detects common binary locations (`./dist/<name>`, `./build/<name>`, etc.)
- **Working Directory**: Defaults to current directory
- **Check Interval**: 5 minutes by default
- **Auto-start/restart**: Enabled by default for reliability

## Migration from JSON Config

If you're upgrading from an older version that used JSON configuration:

```bash
macrounder migrate
```

This will automatically convert your `~/.macrounder/config.json` to individual TOML files in `~/.macrounder/apps/`.

## License

Private - Part of the Remembot project
