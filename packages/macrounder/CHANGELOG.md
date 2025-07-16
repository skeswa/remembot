# Changelog

## 0.2.0

### Minor Changes

- 1056f0e: Radically iterated on the deployment process; added a way to run courier on a mac as well

### Patch Changes

- 7bf069b: Fixed type and lint bugs

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-15

### Added

- Initial release of macrounder
- Service management with automatic updates from GitHub releases
- Process lifecycle management (start/stop/restart)
- GitHub release monitoring and version comparison
- Automatic binary downloads and installations
- macOS launchd integration for background operation
- Comprehensive CLI interface
- Logging and observability features
- Configuration management with JSON config files
- Support for environment variables and command arguments
- Auto-restart functionality for failed services
- Cleanup of old download artifacts
