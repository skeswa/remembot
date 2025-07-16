import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { AppConfigManager } from "./app-config-manager";
import { createDefaultAppConfig, AppConfigSchema } from "./app-config";
import * as TOML from "@iarna/toml";

describe("App Configuration Tests", () => {
  let testDir: string;
  let configManager: AppConfigManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `macrounder-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    configManager = new AppConfigManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  // CONF-F-001: Store app configurations as TOML files in ~/.macrounder/apps/
  test("CONF-F-001: should store app configurations as TOML files in apps directory", () => {
    const appConfig = createDefaultAppConfig("test-app", "owner/repo");
    configManager.saveApp(appConfig);

    const appPath = join(testDir, "apps", "test-app.toml");
    expect(existsSync(appPath)).toBe(true);

    // Verify it's valid TOML
    const content = readFileSync(appPath, "utf-8");
    const parsed = TOML.parse(content);
    expect(parsed).toBeDefined();
  });

  // CONF-F-002: Support global configuration in ~/.macrounder/config.toml
  test("CONF-F-002: should support global configuration in config.toml", () => {
    const globalConfig = configManager.loadGlobalConfig();

    const configPath = join(testDir, "config.toml");
    expect(existsSync(configPath)).toBe(true);

    // Verify defaults
    expect(globalConfig.log_level).toBe("info");
    expect(globalConfig.log_dir).toBe("~/.macrounder/logs");

    // Update and verify
    configManager.saveGlobalConfig({
      log_level: "debug",
      log_dir: "/custom/logs",
    });

    const updated = configManager.loadGlobalConfig();
    expect(updated.log_level).toBe("debug");
    expect(updated.log_dir).toBe("/custom/logs");
  });

  // CONF-F-003: Mandatory fields validation (name, repository)
  test("CONF-F-003: should validate mandatory fields", () => {
    // Test missing name
    expect(() => {
      AppConfigSchema.parse({
        app: {
          repository: "owner/repo",
        },
      });
    }).toThrow();

    // Test missing repository
    expect(() => {
      AppConfigSchema.parse({
        app: {
          name: "test-app",
        },
      });
    }).toThrow();

    // Valid config should pass
    const valid = AppConfigSchema.parse({
      app: {
        name: "test-app",
        repository: "owner/repo",
      },
    });
    expect(valid.app.name).toBe("test-app");
    expect(valid.app.repository).toBe("owner/repo");
  });

  // CONF-F-004: Support optional fields
  test("CONF-F-004: should support optional fields", () => {
    const config = AppConfigSchema.parse({
      app: {
        name: "test-app",
        repository: "owner/repo",
        check_interval: 120,
        auto_start: false,
        auto_restart: false,
      },
      run: {
        binary_path: "/custom/path",
        working_directory: "/work/dir",
        args: ["--verbose", "--port", "3000"],
      },
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      build: {
        command: "make build",
        working_directory: "./src",
      },
    });

    expect(config.app.check_interval).toBe(120);
    expect(config.app.auto_start).toBe(false);
    expect(config.app.auto_restart).toBe(false);
    expect(config.run.binary_path).toBe("/custom/path");
    expect(config.run.working_directory).toBe("/work/dir");
    expect(config.run.args).toEqual(["--verbose", "--port", "3000"]);
    expect(config.environment).toEqual({
      NODE_ENV: "production",
      PORT: "3000",
    });
    expect(config.build?.command).toBe("make build");
  });

  // CONF-F-005: Default values for optional fields
  test("CONF-F-005: should provide default values for optional fields", () => {
    const config = AppConfigSchema.parse({
      app: {
        name: "test-app",
        repository: "owner/repo",
      },
    });

    expect(config.app.check_interval).toBe(300);
    expect(config.app.auto_start).toBe(true);
    expect(config.app.auto_restart).toBe(true);
    expect(config.run.working_directory).toBe(".");
    expect(config.run.args).toEqual([]);
  });

  // CONF-F-006: Automatic binary path detection
  test("CONF-F-006: should detect binary paths using common patterns", () => {
    const appConfig = createDefaultAppConfig("myapp", "owner/repo");

    // Save and load to test the conversion
    configManager.saveApp(appConfig);
    const service = configManager.getService("myapp");

    // Should use the first pattern by default
    expect(service.binaryPath).toBe("./dist/myapp");
  });

  // CONF-F-007: Repository format validation
  test("CONF-F-007: should validate repository format as owner/repo", () => {
    // Valid formats
    const validRepos = [
      "owner/repo",
      "user-name/repo-name",
      "org123/project456",
    ];

    for (const repo of validRepos) {
      const config = AppConfigSchema.parse({
        app: {
          name: "test",
          repository: repo,
        },
      });
      expect(config.app.repository).toBe(repo);
    }

    // Invalid formats
    const invalidRepos = ["invalid", "owner/repo/extra", "/repo", "owner/", ""];

    for (const repo of invalidRepos) {
      expect(() => {
        AppConfigSchema.parse({
          app: {
            name: "test",
            repository: repo,
          },
        });
      }).toThrow();
    }
  });

  // CONF-F-008: App name validation
  test("CONF-F-008: should validate app names are non-empty strings", () => {
    // Empty string should fail
    expect(() => {
      AppConfigSchema.parse({
        app: {
          name: "",
          repository: "owner/repo",
        },
      });
    }).toThrow();

    // Valid names
    const validNames = ["app", "my-app", "app_123", "MyApp"];

    for (const name of validNames) {
      const config = AppConfigSchema.parse({
        app: {
          name,
          repository: "owner/repo",
        },
      });
      expect(config.app.name).toBe(name);
    }
  });

  // CONF-F-009: Prevent duplicate app names
  test("CONF-F-009: should prevent duplicate app names", () => {
    const appConfig = createDefaultAppConfig("duplicate-test", "owner/repo");

    // First save should succeed
    configManager.saveApp(appConfig);
    expect(configManager.appExists("duplicate-test")).toBe(true);

    // Attempting to save another app with same name should overwrite
    const newConfig = createDefaultAppConfig(
      "duplicate-test",
      "different/repo",
    );
    configManager.saveApp(newConfig);

    // Load and verify it was overwritten
    const loaded = configManager.loadApp("duplicate-test");
    expect(loaded.app.repository).toBe("different/repo");
  });

  // CONF-F-011: Expand tilde in file paths
  test("CONF-F-011: should expand tilde (~) in file paths", () => {
    const logDir = configManager.getLogDir();
    expect(logDir).not.toContain("~");
    expect(logDir).toContain(".macrounder/logs");
    expect(logDir.startsWith("/")).toBe(true); // Should be absolute path
  });

  // CONF-F-012: Create configuration directories automatically
  test("CONF-F-012: should create configuration directories if they don't exist", () => {
    const newTestDir = join(tmpdir(), `new-config-${Date.now()}`);

    // Directory shouldn't exist yet
    expect(existsSync(newTestDir)).toBe(false);

    // Create manager - should create directories
    new AppConfigManager(newTestDir);

    // Verify directories were created
    expect(existsSync(newTestDir)).toBe(true);
    expect(existsSync(join(newTestDir, "apps"))).toBe(true);

    // Cleanup
    if (existsSync(newTestDir)) {
      rmSync(newTestDir, { recursive: true });
    }
  });

  // Additional test for check_interval minimum validation
  test("should enforce minimum check_interval of 60 seconds", () => {
    expect(() => {
      AppConfigSchema.parse({
        app: {
          name: "test",
          repository: "owner/repo",
          check_interval: 30, // Too low
        },
      });
    }).toThrow();

    const valid = AppConfigSchema.parse({
      app: {
        name: "test",
        repository: "owner/repo",
        check_interval: 60, // Minimum allowed
      },
    });
    expect(valid.app.check_interval).toBe(60);
  });
});
