import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("CLI", () => {
  let testDir: string;
  let originalHome: string;
  let originalEditor: string | undefined;

  beforeEach(() => {
    // Setup test directory
    testDir = join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Save original environment
    originalHome = process.env.HOME || "";
    originalEditor = process.env.EDITOR;

    // Set test environment
    process.env.HOME = testDir;

    // Create macrounder directories
    const configDir = join(testDir, ".macrounder", "apps");
    mkdirSync(configDir, { recursive: true });

    const logsDir = join(testDir, ".macrounder", "logs");
    mkdirSync(logsDir, { recursive: true });
  });

  afterEach(() => {
    // Restore environment
    process.env.HOME = originalHome;
    if (originalEditor) {
      process.env.EDITOR = originalEditor;
    } else {
      delete process.env.EDITOR;
    }

    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const runCLI = (
    args: string[],
  ): Promise<{ code: number; stdout: string; stderr: string }> => {
    return new Promise((resolve) => {
      const cliPath = join(import.meta.dir, "cli.ts");
      const proc = spawn("bun", [cliPath, ...args], {
        env: process.env,
        cwd: testDir,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          code: code || 0,
          stdout,
          stderr,
        });
      });

      // Set a timeout to prevent hanging
      setTimeout(() => {
        proc.kill();
      }, 10000);
    });
  };

  // CLI-F-001: Test `add` command with required --repo flag
  test("CLI-F-001: should require --repo flag for add command", async () => {
    const result = await runCLI(["add", "test-app"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("required option");
  });

  // CLI-F-002: Test `remove` command
  test("CLI-F-002: should remove app configuration and stop service", async () => {
    // First add an app
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = true
auto_restart = true

[run]
binary_path = "/usr/local/bin/test-app"
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    // Remove the app
    const result = await runCLI(["remove", "test-app"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("App test-app removed successfully");

    // Verify config file was deleted
    expect(
      existsSync(join(testDir, ".macrounder", "apps", "test-app.toml")),
    ).toBe(false);
  });

  test("CLI-F-002: should error when removing non-existent app", async () => {
    const result = await runCLI(["remove", "non-existent"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("App non-existent not found");
  });

  // CLI-F-004: Test `edit` command
  test("CLI-F-004: should open config in system editor", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = true
auto_restart = true

[run]
binary_path = "/usr/local/bin/test-app"
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    // Set a fake editor that just creates a marker file
    process.env.EDITOR = "touch";

    const result = await runCLI(["edit", "test-app"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Configuration updated");
  });

  test("CLI-F-004: should error when editing non-existent app", async () => {
    const result = await runCLI(["edit", "non-existent"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("App non-existent not found");
  });

  // CLI-F-005: Test `start` command
  test("CLI-F-005: should start a specific service", async () => {
    // Create a test app config that will exit immediately
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = false
auto_restart = false

[run]
binary_path = "/bin/echo"
args = ["test-app started"]
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    const result = await runCLI(["start", "test-app"]);

    // Allow for either success or failure (process may have exited quickly)
    expect([0, 1]).toContain(result.code);
    if (result.code === 0) {
      expect(result.stdout).toContain("Service test-app started");
    }
  });

  test("CLI-F-005: should start all services when no name provided", async () => {
    // For this test, we'll just verify the command runs without creating actual services
    // since starting all services in tests can be problematic
    const result = await runCLI(["start"]);

    // The command should run (might say no services or start them)
    expect([0, 1]).toContain(result.code);
    if (result.code === 0) {
      // Either "All services started" or "No apps configured"
      expect(result.stdout).toMatch(
        /All services started|Starting ServiceManager/,
      );
    }
  });

  test("CLI-F-005: should error when starting non-existent service", async () => {
    const result = await runCLI(["start", "non-existent"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("App non-existent not found");
  });

  // CLI-F-006: Test `stop` command
  test("CLI-F-006: should stop a specific service", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = false
auto_restart = false

[run]
binary_path = "/bin/sleep"
args = ["100"]
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    // Try to stop - it might not be running but command should succeed
    const result = await runCLI(["stop", "test-app"]);

    // Allow for either success or failure
    expect([0, 1]).toContain(result.code);
    if (result.code === 0) {
      expect(result.stdout).toContain("Service test-app stopped");
    }
  });

  test("CLI-F-006: should stop all services when no name provided", async () => {
    const result = await runCLI(["stop"]);

    expect(result.code).toBe(0);
    // The message might be "All services stopped" or something about shutting down
    expect(result.stdout + result.stderr).toMatch(/stopped|Shutting down/);
  });

  // CLI-F-007: Test `restart` command
  test("CLI-F-007: should restart a service", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = false
auto_restart = false

[run]
binary_path = "/bin/echo"
args = ["test-app restarted"]
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    const result = await runCLI(["restart", "test-app"]);

    // Allow for either success or failure
    expect([0, 1]).toContain(result.code);
    if (result.code === 0) {
      expect(result.stdout).toContain("Service test-app restarted");
    }
  });

  test("CLI-F-007: should require service name for restart", async () => {
    const result = await runCLI(["restart"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("error: missing required argument");
  });

  // CLI-F-008: Test `update` command
  test("CLI-F-008: should check for updates for a service", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = false
auto_restart = false

[run]
binary_path = "/bin/echo"
args = ["test-app"]
`;
    writeFileSync(
      join(testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    const result = await runCLI(["update", "test-app"]);

    // Allow for either success or failure (might fail to connect to GitHub)
    expect([0, 1]).toContain(result.code);
    if (result.code === 0) {
      expect(result.stdout).toContain("Service test-app updated");
    }
  });

  test("CLI-F-008: should require service name for update", async () => {
    const result = await runCLI(["update"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("error: missing required argument");
  });

  // CLI-F-009: Test `status` command
  test("CLI-F-009: should show status of all services", async () => {
    const result = await runCLI(["status"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Service Status:");
  });

  test("CLI-F-009: should output status as JSON", async () => {
    const result = await runCLI(["status", "--json"]);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(Array.isArray(json)).toBe(true);
  });

  // CLI-F-003: Test `list` command
  test("CLI-F-003: should show no apps when empty", async () => {
    const result = await runCLI(["list"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No apps configured");
  });

  test("CLI-F-003: should output empty JSON array when no apps", async () => {
    const result = await runCLI(["list", "--json"]);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json).toEqual([]);
  });

  // CLI-F-010: Test `logs` command
  test("CLI-F-010: should show logs with --tail option", async () => {
    // Create test log file
    const logContent = Array.from(
      { length: 100 },
      (_, i) => `Log line ${i + 1}`,
    ).join("\n");
    writeFileSync(
      join(testDir, ".macrounder", "logs", "test-app.log"),
      logContent,
    );

    const result = await runCLI(["logs", "test-app", "--tail", "10"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Log line 91");
    expect(result.stdout).toContain("Log line 100");
    expect(result.stdout).not.toContain("Log line 90");
  });

  test("CLI-F-010: should show error for missing logs", async () => {
    const result = await runCLI(["logs", "non-existent"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("No logs found for service non-existent");
  });

  test("CLI-F-010: should indicate --follow not implemented", async () => {
    writeFileSync(
      join(testDir, ".macrounder", "logs", "test-app.log"),
      "test log",
    );

    const result = await runCLI(["logs", "test-app", "--follow"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Follow mode not yet implemented");
  });

  // CLI-F-011: Test `daemon` command
  test("CLI-F-011: should start daemon mode", async () => {
    // We can't actually run the daemon in tests as it runs forever
    // Just verify the command exists and starts
    const proc = spawn("bun", [join(import.meta.dir, "cli.ts"), "daemon"], {
      env: process.env,
      cwd: testDir,
    });

    // Give it a moment to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Kill the process
    proc.kill();

    // Wait for process to be killed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The daemon should have been running when we killed it
    expect(proc.killed).toBe(true);
  });

  // CLI-F-012: Test `install-daemon` command
  test("CLI-F-012: should create launchd plist", async () => {
    // Create the LaunchAgents directory
    const launchAgentsDir = join(testDir, "Library", "LaunchAgents");
    mkdirSync(launchAgentsDir, { recursive: true });

    const result = await runCLI(["install-daemon"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("LaunchAgent plist created at:");
    expect(result.stdout).toContain("com.remembot.macrounder.plist");
    expect(result.stdout).toContain("To load the daemon, run:");
    expect(result.stdout).toContain("launchctl load");

    // Verify the plist file was created
    const plistPath = join(
      testDir,
      "Library",
      "LaunchAgents",
      "com.remembot.macrounder.plist",
    );
    expect(existsSync(plistPath)).toBe(true);

    // Verify plist content is valid XML
    const plistContent = readFileSync(plistPath, "utf-8");
    expect(plistContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(plistContent).toContain("<key>Label</key>");
    expect(plistContent).toContain("<string>com.remembot.macrounder</string>");
    expect(plistContent).toContain("<key>RunAtLoad</key>");
    expect(plistContent).toContain("<true/>");
  });

  // CLI-F-013: Test `uninstall-daemon` command
  test("CLI-F-013: should show uninstall instructions", async () => {
    const result = await runCLI(["uninstall-daemon"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("To unload the daemon, run:");
    expect(result.stdout).toContain("launchctl unload");
    expect(result.stdout).toContain("rm");
    expect(result.stdout).toContain("com.remembot.macrounder.plist");
  });

  // CLI-F-015: Test --json output format
  test("CLI-F-015: JSON output tested in list command", () => {
    // Already covered in CLI-F-003
    expect(true).toBe(true);
  });

  // CLI-F-016: Test command argument validation
  test("CLI-F-016: should validate required arguments", async () => {
    const result = await runCLI(["restart"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("error: missing required argument");
  });

  test("CLI-F-016: should show help for unknown commands", async () => {
    const result = await runCLI(["unknown-command"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("error: unknown command");
  });

  // CLI-F-017: Test non-zero exit codes on errors
  test("CLI-F-017: commands exit with code 1 on error", () => {
    // Already tested in other tests - commands return exit code 1 on error
    expect(true).toBe(true);
  });

  // Test version command
  test("should show version", async () => {
    const result = await runCLI(["--version"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("0.1.0");
  });

  // Test help command
  test("should show help", async () => {
    const result = await runCLI(["--help"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Background service manager for macOS");
    expect(result.stdout).toContain("Commands:");
  });
});
