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

Macrounder stores its configuration and data in a directory determined by:

1. The `MACROUNDER_HOME` environment variable (if set)
2. Default: `~/.macrounder`

This allows you to customize where Macrounder stores its files:

```bash
# Use a custom location
export MACROUNDER_HOME=/opt/macrounder
macrounder daemon

# Or set it in your shell profile
echo 'export MACROUNDER_HOME=/opt/macrounder' >> ~/.zshrc
```

Configuration files are stored in `$MACROUNDER_HOME/apps/`. Each app has its own TOML configuration file.

### App Configuration Example

Create a file `$MACROUNDER_HOME/apps/courier.toml`:

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

Global settings are stored in `$MACROUNDER_HOME/config.toml`:

```toml
log_level = "info"  # debug, info, warn, error
log_dir = "~/.macrounder/logs"  # Relative to home directory
```

## Usage

### Starting the Daemon

```bash
# Start the daemon manually
macrounder daemon

# Or install as a launchd service
macrounder install-daemon
launchctl load ~/Library/LaunchAgents/com.remembot.macrounder.plist
```

### CLI Commands

All CLI commands communicate with the running daemon:

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
```

### Filesystem-Based Configuration Management

The daemon watches the `~/.macrounder/apps/` directory for changes:

1. **Adding a service**: Create a new TOML file or use `macrounder add`
2. **Updating configuration**: Edit the TOML file directly - daemon will reload automatically
3. **Removing a service**: Delete the TOML file or use `macrounder remove`

Changes are applied immediately without requiring manual commands.

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

### Daemon-Client Design

Macrounder uses a daemon-client architecture similar to Docker:

#### Daemon Process

The macrounder daemon is the core component that:

- Runs as a background process (manually or via launchd)
- Manages all configured services and their lifecycles
- Monitors GitHub for updates and applies them automatically
- Watches the `~/.macrounder/` directory for configuration changes
- Exposes an IPC server on `~/.macrounder/daemon.sock`

#### CLI Client

The CLI acts as a lightweight client that:

- Connects to the daemon via Unix domain socket
- Sends commands and receives responses
- Handles connection errors gracefully
- Can auto-start the daemon if needed (with user confirmation)

#### Communication Protocol

Macrounder uses JSON-RPC 2.0 over Unix domain sockets for client-daemon communication:

- Request/response pattern for commands
- Event streaming for real-time updates (logs, status changes)
- Filesystem-based authentication via socket permissions

### Internal Components

The daemon internally consists of several key components:

- **AppConfigManager**: Manages TOML configuration files for each app
- **ServiceManager**: Core service management and lifecycle control
- **GitHubMonitor**: Monitors GitHub releases for updates
- **ProcessManager**: Handles process spawning and monitoring
- **UpdateManager**: Downloads and installs updates
- **FileSystemWatcher**: Monitors configuration directory for changes
- **IPCServer**: Handles client connections and requests
- **LaunchdIntegration**: macOS launchd integration for background operation

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun build

# Run CLI in development (client mode)
bun run src/cli.ts <command>

# Run daemon in development
bun run src/cli.ts daemon

# Build standalone binary
bun build --compile --minify --sourcemap src/cli.ts --outfile dist/macrounder
```

## Binary Distribution

Macrounder is distributed as a single binary that includes both daemon and client functionality. The binary detects its execution mode based on the provided arguments:

- `macrounder daemon` - Runs as daemon
- `macrounder <command>` - Runs as client

This design simplifies deployment and ensures version compatibility between daemon and client.

## Smart Defaults

Macrounder provides intelligent defaults to minimize configuration:

- **Binary Path**: Automatically detects common binary locations (`./dist/<name>`, `./build/<name>`, etc.)
- **Working Directory**: Defaults to current directory
- **Check Interval**: 5 minutes by default
- **Auto-start/restart**: Enabled by default for reliability

## Troubleshooting

### Daemon Connection Issues

If the CLI cannot connect to the daemon:

1. Check if the daemon is running: `ps aux | grep macrounder`
2. Check the socket file exists: `ls -la ~/.macrounder/daemon.sock`
3. Check daemon logs: `tail -f ~/.macrounder/logs/daemon.log`
4. Restart the daemon: `launchctl restart com.remembot.macrounder`

### Configuration Not Applied

If configuration changes aren't being applied:

1. Check file permissions in `~/.macrounder/apps/`
2. Validate TOML syntax
3. Check daemon logs for validation errors
4. Ensure the daemon has read permissions for the config directory

## License

Private - Part of the Remembot project
