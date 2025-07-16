# Macrounder Requirements Specification

## Overview

This document enumerates all functional and non-functional requirements for Macrounder, a background service manager for macOS that automatically updates and manages running applications by monitoring GitHub releases.

## Requirement Identification System

- **Functional Requirements**: `<CATEGORY>-F-<NUMBER>`
- **Non-Functional Requirements**: `<CATEGORY>-NF-<NUMBER>`

### Categories:

- **CONF**: Configuration Management
- **PROC**: Process Management
- **UPDT**: Update Management
- **GHUB**: GitHub Integration
- **CLI**: Command Line Interface
- **LOG**: Logging & Monitoring
- **SYS**: System Integration
- **PERF**: Performance
- **SEC**: Security
- **COMP**: Compatibility
- **REL**: Reliability
- **USE**: Usability
- **MAINT**: Maintainability

---

## Functional Requirements

### Configuration Management (CONF)

**CONF-F-001**: The system SHALL store individual app configurations as TOML files in `~/.macrounder/apps/` directory.

**CONF-F-002**: The system SHALL support global configuration in `~/.macrounder/config.toml` for log level and log directory settings.

**CONF-F-003**: Each app configuration SHALL include mandatory fields: name, repository (format: owner/repo).

**CONF-F-004**: Each app configuration SHALL support optional fields: check_interval (minimum 60 seconds), auto_start, auto_restart, binary_path, working_directory, args, environment variables, and build command.

**CONF-F-005**: The system SHALL provide default values for optional configuration fields (check_interval: 300s, auto_start: true, auto_restart: true).

**CONF-F-006**: The system SHALL automatically detect binary paths using common patterns (`./dist/<name>`, `./build/<name>`, `./bin/<name>`, etc.) when not explicitly specified.

**CONF-F-007**: The system SHALL validate repository format as `owner/repo` pattern.

**CONF-F-008**: The system SHALL validate app names are non-empty strings.

**CONF-F-009**: The system SHALL prevent duplicate app names in configuration.

**CONF-F-011**: The system SHALL expand tilde (~) in file paths to user home directory.

**CONF-F-012**: The system SHALL create configuration directories automatically if they don't exist.

### Process Management (PROC)

**PROC-F-001**: The system SHALL start configured services as child processes.

**PROC-F-002**: The system SHALL stop running services gracefully using SIGTERM with a 30-second timeout before SIGKILL.

**PROC-F-003**: The system SHALL restart services by stopping and starting them.

**PROC-F-004**: The system SHALL track process status (running, stopped, updating, error).

**PROC-F-005**: The system SHALL track process PID when running.

**PROC-F-006**: The system SHALL calculate and track service uptime.

**PROC-F-007**: The system SHALL auto-start services when configured with auto_start=true.

**PROC-F-008**: The system SHALL auto-restart services on failure when configured with auto_restart=true.

**PROC-F-009**: The system SHALL limit auto-restart attempts to 5 with a 5-second delay between attempts.

**PROC-F-010**: The system SHALL pass configured environment variables to child processes.

**PROC-F-011**: The system SHALL pass configured command-line arguments to child processes.

**PROC-F-012**: The system SHALL use configured working directory for child processes.

**PROC-F-013**: The system SHALL capture stdout and stderr from child processes.

**PROC-F-014**: The system SHALL emit events for process lifecycle (started, stopped, error).

**PROC-F-015**: The system SHALL wait up to 10 seconds for process spawn confirmation.

**PROC-F-016**: The system SHALL support starting all configured services simultaneously.

**PROC-F-017**: The system SHALL support stopping all services simultaneously.

### Update Management (UPDT)

**UPDT-F-001**: The system SHALL check for updates at configured intervals (minimum 60 seconds).

**UPDT-F-002**: The system SHALL download binary assets from GitHub releases.

**UPDT-F-003**: The system SHALL verify downloaded file size matches expected size.

**UPDT-F-004**: The system SHALL backup current binary before update installation.

**UPDT-F-005**: The system SHALL restore backup binary if update installation fails.

**UPDT-F-006**: The system SHALL make downloaded binaries executable (chmod 755).

**UPDT-F-007**: The system SHALL detect macOS-compatible assets from release assets using name patterns.

**UPDT-F-008**: The system SHALL prioritize asset selection (darwin-arm64 > darwin-x64 > darwin > macos > mac > service name).

**UPDT-F-009**: The system SHALL stop service before update and restart after successful update.

**UPDT-F-010**: The system SHALL clean up temporary downloads older than 24 hours.

**UPDT-F-011**: The system SHALL emit events for update lifecycle (available, started, completed, failed).

**UPDT-F-012**: The system SHALL calculate SHA-256 checksums for downloaded files.

**UPDT-F-013**: The system SHALL create download directory if it doesn't exist.

### GitHub Integration (GHUB)

**GHUB-F-001**: The system SHALL fetch latest release information from GitHub API.

**GHUB-F-002**: The system SHALL fetch all releases with pagination support.

**GHUB-F-003**: The system SHALL handle GitHub API 404 responses gracefully.

**GHUB-F-004**: The system SHALL parse GitHub release data including tag name, assets, and metadata.

**GHUB-F-005**: The system SHALL compare semantic versions to determine if update is available.

**GHUB-F-006**: The system SHALL normalize version strings (remove 'v' prefix, 'release-' prefix).

**GHUB-F-007**: The system SHALL support version comparison with different segment counts (1.0 vs 1.0.0).

**GHUB-F-008**: The system SHALL include User-Agent header in GitHub API requests.

**GHUB-F-009**: The system SHALL track current version for comparison.

**GHUB-F-010**: The system SHALL filter out pre-release and draft releases.

### Command Line Interface (CLI)

**CLI-F-001**: The system SHALL provide `add` command to create new app configuration with required --repo flag.

**CLI-F-002**: The system SHALL provide `remove` command to delete app configuration and stop service.

**CLI-F-003**: The system SHALL provide `list` command to show all configured apps.

**CLI-F-004**: The system SHALL provide `edit` command to open app configuration in system editor.

**CLI-F-005**: The system SHALL provide `start` command to start service(s).

**CLI-F-006**: The system SHALL provide `stop` command to stop service(s).

**CLI-F-007**: The system SHALL provide `restart` command to restart a specific service.

**CLI-F-008**: The system SHALL provide `update` command to manually check and apply updates.

**CLI-F-009**: The system SHALL provide `status` command to show service status information.

**CLI-F-010**: The system SHALL provide `logs` command to view service logs with --tail and --follow options.

**CLI-F-011**: The system SHALL provide `daemon` command to run as background daemon.

**CLI-F-012**: The system SHALL provide `install-daemon` command to create launchd plist.

**CLI-F-013**: The system SHALL provide `uninstall-daemon` command to show removal instructions.

**CLI-F-015**: The system SHALL support --json output format for list and status commands.

**CLI-F-016**: The system SHALL validate command arguments and show appropriate error messages.

**CLI-F-017**: The system SHALL exit with non-zero code on errors.

### Logging & Monitoring (LOG)

**LOG-F-001**: The system SHALL write logs to configurable directory (default: ~/.macrounder/logs).

**LOG-F-002**: The system SHALL support log levels: debug, info, warn, error.

**LOG-F-003**: The system SHALL write separate log files for each service.

**LOG-F-004**: The system SHALL write daemon stdout/stderr to separate log files.

**LOG-F-005**: The system SHALL include timestamps in log entries.

**LOG-F-006**: The system SHALL log service lifecycle events (start, stop, restart, error).

**LOG-F-007**: The system SHALL log update events (check, download, install, success, failure).

**LOG-F-008**: The system SHALL log child process stdout and stderr.

**LOG-F-009**: The system SHALL create log directory if it doesn't exist.

**LOG-F-010**: The system SHALL use structured logging with contextual information.

### System Integration (SYS)

**SYS-F-001**: The system SHALL integrate with macOS launchd for automatic startup.

**SYS-F-002**: The system SHALL generate launchd plist with correct binary paths and working directory.

**SYS-F-003**: The system SHALL handle SIGINT and SIGTERM for graceful shutdown.

**SYS-F-004**: The system SHALL use system EDITOR environment variable for editing configs.

**SYS-F-005**: The system SHALL resolve import.meta.path for CLI script location.

**SYS-F-006**: The system SHALL create .macrounder directory structure in user home.

---

## Non-Functional Requirements

### Performance (PERF)

**PERF-NF-001**: The system SHALL start services within 10 seconds of spawn request.

**PERF-NF-002**: The system SHALL check for updates without blocking service operations.

**PERF-NF-003**: The system SHALL support concurrent management of multiple services.

**PERF-NF-004**: The system SHALL limit resource usage through configurable check intervals.

**PERF-NF-005**: The system SHALL clean up old downloads to prevent disk space exhaustion.

### Security (SEC)

**SEC-NF-001**: The system SHALL validate all configuration inputs using Zod schemas.

**SEC-NF-002**: The system SHALL sanitize file paths to prevent directory traversal.

**SEC-NF-003**: The system SHALL verify downloaded file sizes before installation.

**SEC-NF-004**: The system SHALL set appropriate file permissions (755) on executables.

**SEC-NF-005**: The system SHALL not expose sensitive information in logs.

**SEC-NF-006**: The system SHALL use HTTPS for all GitHub API requests.

**SEC-NF-007**: The system SHALL not run services with elevated privileges.

### Compatibility (COMP)

**COMP-NF-001**: The system SHALL run exclusively on macOS.

**COMP-NF-002**: The system SHALL use Bun runtime version 1.2.11 or higher.

**COMP-NF-003**: The system SHALL support Node.js-style module imports.

**COMP-NF-004**: The system SHALL detect macOS binary variants (arm64, x64).

**COMP-NF-005**: The system SHALL support TOML configuration format.

### Reliability (REL)

**REL-NF-001**: The system SHALL continue running if individual service fails.

**REL-NF-002**: The system SHALL handle network failures gracefully during updates.

**REL-NF-003**: The system SHALL restore service state after system restart via launchd.

**REL-NF-004**: The system SHALL implement retry logic for auto-restart with backoff.

**REL-NF-005**: The system SHALL validate configuration before applying changes.

**REL-NF-006**: The system SHALL maintain service availability during update process.

**REL-NF-007**: The system SHALL handle missing binaries and configuration files gracefully.

### Usability (USE)

**USE-NF-001**: The system SHALL provide clear error messages for common failures.

**USE-NF-002**: The system SHALL use human-readable TOML format for configuration.

**USE-NF-003**: The system SHALL provide sensible defaults for optional configuration.

**USE-NF-004**: The system SHALL show progress feedback during long operations.

**USE-NF-005**: The system SHALL support both JSON and human-readable output formats.

**USE-NF-006**: The system SHALL provide helpful command descriptions and examples.

### Maintainability (MAINT)

**MAINT-NF-001**: The system SHALL use TypeScript for type safety.

**MAINT-NF-002**: The system SHALL separate concerns into distinct modules.

**MAINT-NF-003**: The system SHALL include comprehensive test coverage.

**MAINT-NF-004**: The system SHALL follow consistent code style with ESLint.

**MAINT-NF-005**: The system SHALL use structured logging for debugging.

**MAINT-NF-006**: The system SHALL document all public APIs and configuration options.

**MAINT-NF-007**: The system SHALL use semantic versioning for releases.

---

## Requirement Traceability

### Critical Requirements for MVP

- CONF-F-001, CONF-F-003, CONF-F-004
- PROC-F-001, PROC-F-002, PROC-F-004
- UPDT-F-001, UPDT-F-002, UPDT-F-004
- GHUB-F-001, GHUB-F-005
- CLI-F-001, CLI-F-005, CLI-F-006, CLI-F-009
- LOG-F-001, LOG-F-002
- All security requirements (SEC-NF-\*)

### Test Coverage Mapping

- Configuration tests: CONF-F-\*
- Process manager tests: PROC-F-\*
- Update manager tests: UPDT-F-\*
- GitHub monitor tests: GHUB-F-\*
- Integration tests: SYS-F-_, REL-NF-_

---

## Revision History

| Version | Date       | Author | Description                        |
| ------- | ---------- | ------ | ---------------------------------- |
| 1.0.0   | 2025-01-16 | System | Initial requirements specification |
