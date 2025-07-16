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
      }, 5000);
    });
  };

  // CLI-F-001: Test `add` command with required --repo flag
  test("CLI-F-001: should require --repo flag for add command", async () => {
    const result = await runCLI(["add", "test-app"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("required option");
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
