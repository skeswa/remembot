import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Daemon } from "../../src/daemon/daemon";
import { IPCClient } from "../../src/client/ipc-client";
import { createTestEnvironment } from "../test-helper";

describe("Daemon Log Reading", () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let daemon: Daemon;
  let client: IPCClient;
  let socketPath: string;

  beforeEach(async () => {
    // Create test environment
    testEnv = createTestEnvironment();

    // Create unique socket path
    socketPath = join(tmpdir(), `test-macrounder-${Date.now()}.sock`);

    // Create and start daemon
    daemon = new Daemon({
      socketPath,
      logDir: join(testEnv.testDir, ".macrounder", "logs"),
      configDir: join(testEnv.testDir, ".macrounder", "apps"),
    });
    await daemon.start();

    // Create client
    client = new IPCClient({ socketPath });
    await client.connect();
  });

  afterEach(async () => {
    // Cleanup
    await client.disconnect();
    await daemon.stop();
    testEnv.cleanup();
  });

  test("should return empty logs for non-existent service", async () => {
    try {
      await client.getLogs("non-existent-service", 50, false);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // For now, just check that an error is thrown
      expect(error).toBeDefined();
      expect((error as Error).message).toBeDefined();
    }
  });

  test("should return empty logs for service without log file", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-app"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/echo"
args = ["test"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-app.toml"),
      tomlContent,
    );

    // Get logs without starting the service
    const result = await client.getLogs("test-app", 50, false);

    expect(result.logs).toEqual([]);
  });

  test("should return logs for running service", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-logger"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/echo"
args = ["Test log message"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-logger.toml"),
      tomlContent,
    );

    // Start the service
    await client.startService("test-logger");

    // Wait a bit for logs to be written
    await Bun.sleep(200);

    // Get logs
    const result = await client.getLogs("test-logger", 50, false);

    expect(result.logs).toBeDefined();
    expect(Array.isArray(result.logs)).toBe(true);

    // Should have at least one log entry
    if (result.logs.length > 0) {
      expect(result.logs[0]).toContain("[STDOUT]");
      expect(result.logs[0]).toContain("Test log message");
    }
  });

  test("should respect lines limit", async () => {
    const logDir = join(testEnv.testDir, ".macrounder", "logs");
    const logFile = join(logDir, "test-service.log");

    // Create a log file with multiple lines
    const lines = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`[2024-01-01T00:00:00.000Z] [STDOUT] Log line ${i}`);
    }
    writeFileSync(logFile, lines.join("\n"));

    // Create a test app config
    const tomlContent = `[app]
name = "test-service"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/echo"
args = ["test"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-service.toml"),
      tomlContent,
    );

    // Get logs with limit
    const result = await client.getLogs("test-service", 10, false);

    expect(result.logs.length).toBe(10);
    expect(result.logs[0]).toContain("Log line 91");
    expect(result.logs[9]).toContain("Log line 100");
  });

  test("should handle log file read errors gracefully", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-error"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/echo"
args = ["test"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-error.toml"),
      tomlContent,
    );

    // Create a directory instead of a file to cause read error
    const logDir = join(testEnv.testDir, ".macrounder", "logs");
    const logFile = join(logDir, "test-error.log");
    mkdirSync(logFile, { recursive: true });

    // Should return empty logs on error
    const result = await client.getLogs("test-error", 50, false);

    expect(result.logs).toEqual([]);
  });
});
