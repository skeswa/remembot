# Macrounder Test TODO List

This document tracks test coverage for all requirements defined in docs/requirements.md. Each TODO item maps to a specific requirement and indicates where the test should be implemented.

## Test File Structure

- Unit tests: `*.spec.ts` files colocated with source files
- Integration tests: Create `tests/integration/` directory
- E2E tests: Create `tests/e2e/` directory

## Configuration Management Tests (CONF)

### config-manager.spec.ts

- [x] **CONF-F-001**: Test storing app configurations as TOML files in ~/.macrounder/apps/ directory
- [x] **CONF-F-002**: Test global configuration support in ~/.macrounder/config.toml for log level and log directory
- [x] **CONF-F-011**: Test expansion of tilde (~) in file paths to user home directory
- [x] **CONF-F-012**: Test automatic creation of configuration directories if they don't exist

### app-config.spec.ts

- [x] **CONF-F-003**: Test mandatory fields validation (name, repository format owner/repo)
- [x] **CONF-F-004**: Test optional fields support (check_interval, auto_start, auto_restart, binary_path, working_directory, args, env)
- [x] **CONF-F-005**: Test default values for optional fields (check_interval: 300s, auto_start: true, auto_restart: true)
- [x] **CONF-F-006**: Test automatic binary path detection using common patterns
- [x] **CONF-F-007**: Test repository format validation as owner/repo pattern
- [x] **CONF-F-008**: Test app name validation (non-empty strings)
- [x] **CONF-F-009**: Test prevention of duplicate app names

## Process Management Tests (PROC)

### process-manager.spec.ts

- [x] **PROC-F-001**: Test starting configured services as child processes
- [x] **PROC-F-002**: Test graceful stop with SIGTERM (30s timeout) before SIGKILL
- [x] **PROC-F-003**: Test restart functionality (stop and start)
- [x] **PROC-F-004**: Test process status tracking (running, stopped, updating, error)
- [x] **PROC-F-005**: Test PID tracking when process is running
- [x] **PROC-F-006**: Test uptime calculation and tracking
- [x] **PROC-F-007**: Test auto-start when configured with auto_start=true
- [x] **PROC-F-008**: Test auto-restart on failure when auto_restart=true
- [x] **PROC-F-009**: Test auto-restart limit (5 attempts with 5s delay)
- [x] **PROC-F-010**: Test passing environment variables to child processes
- [x] **PROC-F-011**: Test passing command-line arguments to child processes
- [x] **PROC-F-012**: Test using configured working directory for child processes
- [x] **PROC-F-013**: Test capturing stdout and stderr from child processes
- [x] **PROC-F-014**: Test event emission for process lifecycle (started, stopped, error)
- [x] **PROC-F-015**: Test 10-second timeout for process spawn confirmation
- [x] **PROC-F-016**: Test starting all configured services simultaneously
- [x] **PROC-F-017**: Test stopping all services simultaneously

## Update Management Tests (UPDT)

### update-manager.spec.ts

- [x] **UPDT-F-001**: Test update checks at configured intervals (minimum 60s)
- [x] **UPDT-F-002**: Test downloading binary assets from GitHub releases
- [x] **UPDT-F-003**: Test file size verification for downloads
- [x] **UPDT-F-004**: Test backup creation before update installation
- [x] **UPDT-F-005**: Test backup restoration on update failure
- [x] **UPDT-F-006**: Test making downloaded binaries executable (chmod 755)
- [x] **UPDT-F-007**: Test macOS-compatible asset detection from release assets
- [x] **UPDT-F-008**: Test asset prioritization (darwin-arm64 > darwin-x64 > darwin > macos > mac > service name)
- [x] **UPDT-F-009**: Test service stop before update and restart after success
- [x] **UPDT-F-010**: Test cleanup of downloads older than 24 hours
- [ ] **UPDT-F-011**: Test event emission for update lifecycle (skipped - not implemented)
- [x] **UPDT-F-012**: Test SHA-256 checksum calculation for downloads
- [x] **UPDT-F-013**: Test download directory creation if missing

## GitHub Integration Tests (GHUB)

### github-monitor.spec.ts

- [x] **GHUB-F-001**: Test fetching latest release from GitHub API
- [x] **GHUB-F-002**: Test fetching all releases with pagination
- [x] **GHUB-F-003**: Test graceful handling of GitHub API 404 responses
- [x] **GHUB-F-004**: Test parsing release data (tag name, assets, metadata)
- [x] **GHUB-F-005**: Test semantic version comparison for updates
- [x] **GHUB-F-006**: Test version normalization (remove 'v', 'release-' prefixes)
- [x] **GHUB-F-007**: Test version comparison with different segments (1.0 vs 1.0.0)
- [x] **GHUB-F-008**: Test User-Agent header in API requests
- [x] **GHUB-F-009**: Test current version tracking for comparison
- [ ] **GHUB-F-010**: Test filtering pre-release and draft releases (skipped - not implemented)

## CLI Tests (CLI)

### cli.spec.ts

- [x] **CLI-F-001**: Test `add` command with required --repo flag
- [ ] **CLI-F-002**: Test `remove` command (delete config and stop service)
- [x] **CLI-F-003**: Test `list` command showing all configured apps
- [ ] **CLI-F-004**: Test `edit` command opening config in system editor
- [ ] **CLI-F-005**: Test `start` command for starting services
- [ ] **CLI-F-006**: Test `stop` command for stopping services
- [ ] **CLI-F-007**: Test `restart` command for restarting services
- [ ] **CLI-F-008**: Test `update` command for manual update checks
- [ ] **CLI-F-009**: Test `status` command showing service information
- [x] **CLI-F-010**: Test `logs` command with --tail and --follow options
- [ ] **CLI-F-011**: Test `daemon` command for background daemon mode
- [ ] **CLI-F-012**: Test `install-daemon` command creating launchd plist
- [x] **CLI-F-013**: Test `uninstall-daemon` command showing removal instructions
- [x] **CLI-F-015**: Test --json output format for list and status commands
- [x] **CLI-F-016**: Test command argument validation and error messages
- [x] **CLI-F-017**: Test non-zero exit codes on errors

## Logging & Monitoring Tests (LOG)

### logger.spec.ts (NEW)

- [x] **LOG-F-001**: Test writing logs to configurable directory (default: ~/.macrounder/logs)
- [ ] **LOG-F-002**: Test log level support (debug, info, warn, error)
- [ ] **LOG-F-003**: Test separate log files for each service
- [ ] **LOG-F-004**: Test daemon stdout/stderr to separate log files
- [ ] **LOG-F-005**: Test timestamp inclusion in log entries
- [ ] **LOG-F-006**: Test logging service lifecycle events
- [ ] **LOG-F-007**: Test logging update events
- [ ] **LOG-F-008**: Test logging child process stdout and stderr
- [x] **LOG-F-009**: Test log directory creation if missing
- [ ] **LOG-F-010**: Test structured logging with contextual information

## System Integration Tests (SYS)

### tests/integration/system.spec.ts

- [x] **SYS-F-001**: Test macOS launchd integration for automatic startup
- [x] **SYS-F-002**: Test launchd plist generation with correct paths
- [x] **SYS-F-003**: Test SIGINT and SIGTERM handling for graceful shutdown
- [x] **SYS-F-004**: Test system EDITOR environment variable usage
- [x] **SYS-F-005**: Test import.meta.path resolution for CLI location
- [x] **SYS-F-006**: Test .macrounder directory structure creation

## Non-Functional Requirements Tests

### Performance Tests (PERF) - tests/performance/

- [ ] **PERF-NF-001**: Test service start within 10 seconds
- [ ] **PERF-NF-002**: Test non-blocking update checks
- [ ] **PERF-NF-003**: Test concurrent service management
- [ ] **PERF-NF-004**: Test resource limiting via check intervals
- [ ] **PERF-NF-005**: Test old download cleanup for disk space

### Security Tests (SEC) - tests/security/

- [x] **SEC-NF-001**: Test Zod schema validation for all inputs
- [x] **SEC-NF-002**: Test file path sanitization against directory traversal
- [x] **SEC-NF-003**: Test file size verification before installation
- [x] **SEC-NF-004**: Test file permission setting (755) on executables
- [x] **SEC-NF-005**: Test sensitive information is not logged
- [x] **SEC-NF-006**: Test HTTPS usage for GitHub API requests
- [x] **SEC-NF-007**: Test services don't run with elevated privileges

### Compatibility Tests (COMP) - tests/compatibility/

- [ ] **COMP-NF-001**: Test macOS-only operation
- [ ] **COMP-NF-002**: Test Bun runtime 1.2.11+ compatibility
- [ ] **COMP-NF-003**: Test Node.js-style module imports
- [ ] **COMP-NF-004**: Test macOS binary variant detection (arm64, x64)
- [ ] **COMP-NF-005**: Test TOML configuration format support

### Reliability Tests (REL) - tests/integration/

- [ ] **REL-NF-001**: Test daemon continues when individual service fails
- [ ] **REL-NF-002**: Test graceful handling of network failures during updates
- [ ] **REL-NF-003**: Test service state restoration after system restart
- [ ] **REL-NF-004**: Test retry logic with exponential backoff
- [x] **REL-NF-005**: Test configuration validation before applying
- [ ] **REL-NF-006**: Test service availability during updates
- [x] **REL-NF-007**: Test handling of missing binaries and configs

### Usability Tests (USE) - tests/e2e/

- [ ] **USE-NF-001**: Test clear error messages for common failures
- [ ] **USE-NF-002**: Test TOML configuration readability
- [ ] **USE-NF-003**: Test sensible configuration defaults
- [ ] **USE-NF-004**: Test progress feedback for long operations
- [ ] **USE-NF-005**: Test JSON and human-readable output formats
- [ ] **USE-NF-006**: Test command help and examples

### Maintainability Tests (MAINT)

- [x] **MAINT-NF-001**: Verify TypeScript usage throughout codebase
- [x] **MAINT-NF-002**: Verify module separation and architecture
- [x] **MAINT-NF-003**: Track and maintain test coverage metrics
- [x] **MAINT-NF-004**: Verify ESLint compliance
- [x] **MAINT-NF-005**: Verify structured logging implementation
- [x] **MAINT-NF-006**: Verify API and configuration documentation
- [x] **MAINT-NF-007**: Verify semantic versioning in releases

## Test Implementation Priority

### Phase 1: Critical Path (MVP Requirements)

1. Configuration tests: CONF-F-001, CONF-F-003, CONF-F-004
2. Process tests: PROC-F-001, PROC-F-002, PROC-F-004
3. Update tests: UPDT-F-001, UPDT-F-002, UPDT-F-004
4. GitHub tests: GHUB-F-001, GHUB-F-005
5. CLI tests: CLI-F-001, CLI-F-005, CLI-F-006, CLI-F-009
6. Logging tests: LOG-F-001, LOG-F-002
7. All security tests (SEC-NF-\*)

### Phase 2: Full Coverage

- Remaining functional requirements
- Performance and reliability tests
- Integration and E2E tests

### Phase 3: Non-Functional

- Usability tests
- Maintainability verification
- Compatibility edge cases

## Notes

- Use Bun's built-in test runner for all tests
- Mock external dependencies (GitHub API, file system where appropriate)
- Create test fixtures for configuration files
- Use test containers or isolated environments for integration tests
- Maintain test coverage above 80% for critical components
