import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Daemon } from "../../src/daemon/daemon";
import { IPCClient } from "../../src/client/ipc-client";
import { existsSync } from "node:fs";
import { createTestEnvironment } from "../test-helper";

describe("Daemon", () => {
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let daemon: Daemon | null = null;
  let client: IPCClient | null = null;

  beforeEach(() => {
    // Create test environment
    testEnv = createTestEnvironment();
  });

  afterEach(async () => {
    // Stop daemon if running
    if (daemon) {
      await daemon.stop();
      daemon = null;
    }

    // Disconnect client
    if (client) {
      await client.disconnect();
      client = null;
    }

    // Clean up test environment
    testEnv.cleanup();
  });

  describe("Daemon Lifecycle", () => {
    test("should start and stop daemon", async () => {
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });

      await daemon.start();
      expect(existsSync(testEnv.socketPath)).toBe(true);

      await daemon.stop();
      expect(existsSync(testEnv.socketPath)).toBe(false);
    });

    test("should reject starting daemon twice", async () => {
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });

      await daemon.start();

      await expect(daemon.start()).rejects.toThrow("Daemon is already running");
    });

    test("should handle stop when not running", async () => {
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });

      // Should not throw
      await daemon.stop();
    });
  });

  describe("Client Connection", () => {
    test("should connect client to daemon", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      // Test ping
      const result = await client.ping();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });

    test("should reject connection when daemon not running", async () => {
      client = new IPCClient({ socketPath: testEnv.socketPath });

      await expect(client.connect()).rejects.toThrow("Daemon is not running");
    });

    test("should get daemon version", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      const version = await client.getVersion();
      expect(version.version).toBeDefined();
      expect(version.protocolVersion).toBe("1.0.0");
    });

    test("should get daemon status", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      const status = await client.getDaemonStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(process.pid);
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.servicesCount).toBe(0);
      expect(status.memory).toBeDefined();
    });
  });

  describe("Service Management via IPC", () => {
    test("should add service via IPC", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      // Add service
      const result = await client.addService("test-app", "owner/repo");
      expect(result.success).toBe(true);

      // List services
      const services = await client.listServices();
      expect(services).toContain("test-app");
    });

    test("should reject duplicate service", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      // Add service
      await client.addService("test-app", "owner/repo");

      // Try to add again
      await expect(client.addService("test-app", "owner/repo")).rejects.toThrow(
        "already exists",
      );
    });

    test("should remove service via IPC", async () => {
      // Start daemon
      daemon = new Daemon({
        socketPath: testEnv.socketPath,
        configDir: testEnv.appsDir,
        logDir: testEnv.logsDir,
      });
      await daemon.start();

      // Connect client
      client = new IPCClient({ socketPath: testEnv.socketPath });
      await client.connect();

      // Add service
      await client.addService("test-app", "owner/repo");

      // Remove service
      const result = await client.removeService("test-app");
      expect(result.success).toBe(true);

      // List services
      const services = await client.listServices();
      expect(services).not.toContain("test-app");
    });
  });
});
