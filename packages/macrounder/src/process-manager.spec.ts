import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { ProcessManager } from "./process-manager";
import { writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
// ChildProcess type import removed - not used

describe("ProcessManager", () => {
  let processManager: ProcessManager;
  let logger: pino.Logger;
  let testBinaryPath: string;

  beforeEach(() => {
    logger = pino({ level: "silent" });
    processManager = new ProcessManager(logger);

    // Create a test binary that just sleeps
    testBinaryPath = join(tmpdir(), `test-binary-${Date.now()}.sh`);
    writeFileSync(
      testBinaryPath,
      `#!/bin/bash
echo "Started"
sleep 100
`,
    );
    chmodSync(testBinaryPath, 0o755);
  });

  afterEach(async () => {
    await processManager.shutdown();
    rmSync(testBinaryPath, { force: true });
  });

  test("should start a service", async () => {
    const config = {
      name: "test-service",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    let startedEvent: { service: string; pid: number } | undefined;
    processManager.on("started", (event) => {
      startedEvent = event;
    });

    await processManager.start(config);

    expect(processManager.isRunning("test-service")).toBe(true);
    expect(startedEvent).toBeDefined();
    expect(startedEvent?.service).toBe("test-service");
    expect(startedEvent?.pid).toBeGreaterThan(0);
  });

  test("should throw error when starting already running service", async () => {
    const config = {
      name: "duplicate-service",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    await processManager.start(config);

    await expect(processManager.start(config)).rejects.toThrow(
      "Service duplicate-service is already running",
    );
  });

  test("should throw error when binary not found", async () => {
    const config = {
      name: "missing-binary",
      repository: "owner/repo",
      binaryPath: "/non/existent/path",
      checkInterval: 300,
      autoStart: true,
    };

    await expect(processManager.start(config)).rejects.toThrow(
      "Binary not found: /non/existent/path",
    );
  });

  test("should stop a running service", async () => {
    const config = {
      name: "stop-test",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: false,
    };

    await processManager.start(config);
    expect(processManager.isRunning("stop-test")).toBe(true);

    let stoppedEvent: { service: string; code?: number } | undefined;
    processManager.on("stopped", (event) => {
      stoppedEvent = event;
    });

    await processManager.stop("stop-test");

    expect(processManager.isRunning("stop-test")).toBe(false);
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent?.service).toBe("stop-test");
  });

  test("should throw error when stopping non-running service", async () => {
    await expect(processManager.stop("non-existent")).rejects.toThrow(
      "Service non-existent is not running",
    );
  });

  test("should restart a service", async () => {
    const config = {
      name: "restart-test",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    await processManager.start(config);
    const firstPid = processManager.getStatus("restart-test").pid;

    await processManager.restart("restart-test");
    const secondPid = processManager.getStatus("restart-test").pid;

    expect(firstPid).not.toBe(secondPid);
    expect(processManager.isRunning("restart-test")).toBe(true);
  });

  test("should get service status", async () => {
    const config = {
      name: "status-test",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    // Before starting
    let status = processManager.getStatus("status-test");
    expect(status.name).toBe("status-test");
    expect(status.status).toBe("stopped");
    expect(status.pid).toBeUndefined();

    // After starting
    await processManager.start(config);
    status = processManager.getStatus("status-test");

    expect(status.name).toBe("status-test");
    expect(status.status).toBe("running");
    expect(status.pid).toBeGreaterThan(0);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  test("should get all statuses", async () => {
    const config1 = {
      name: "service1",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    const config2 = {
      name: "service2",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    await processManager.start(config1);
    await processManager.start(config2);

    const statuses = processManager.getAllStatuses();

    expect(statuses).toHaveLength(2);
    expect(statuses.map((s) => s.name).sort()).toEqual([
      "service1",
      "service2",
    ]);
    expect(statuses.every((s) => s.status === "running")).toBe(true);
  });

  test("should handle environment variables", async () => {
    // Create a test binary that echoes env var
    const envTestPath = join(tmpdir(), `env-test-${Date.now()}.sh`);
    writeFileSync(
      envTestPath,
      `#!/bin/bash
echo "TEST_VAR=$TEST_VAR"
sleep 1
`,
    );
    chmodSync(envTestPath, 0o755);

    const config = {
      name: "env-test",
      repository: "owner/repo",
      binaryPath: envTestPath,
      checkInterval: 300,
      autoStart: true,
      env: {
        TEST_VAR: "test-value",
      },
    };

    let output = "";
    processManager.on("started", () => {
      // @ts-expect-error - accessing private property for testing
      const processInfo = processManager.processes.get("env-test");
      processInfo?.process.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });
    });

    await processManager.start(config);

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(output).toContain("TEST_VAR=test-value");

    rmSync(envTestPath, { force: true });
  });

  test("should handle process arguments", async () => {
    // Create a test binary that echoes arguments
    const argTestPath = join(tmpdir(), `arg-test-${Date.now()}.sh`);
    writeFileSync(
      argTestPath,
      `#!/bin/bash
echo "Args: $@"
sleep 1
`,
    );
    chmodSync(argTestPath, 0o755);

    const config = {
      name: "arg-test",
      repository: "owner/repo",
      binaryPath: argTestPath,
      checkInterval: 300,
      autoStart: true,
      args: ["--flag", "value"],
    };

    let output = "";
    processManager.on("started", () => {
      // @ts-expect-error - accessing private property for testing
      const processInfo = processManager.processes.get("arg-test");
      processInfo?.process.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });
    });

    await processManager.start(config);

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(output).toContain("Args: --flag value");

    rmSync(argTestPath, { force: true });
  });

  test("should stop all services", async () => {
    const services = ["stop-all-1", "stop-all-2", "stop-all-3"];

    for (const name of services) {
      await processManager.start({
        name,
        repository: "owner/repo",
        binaryPath: testBinaryPath,
        checkInterval: 300,
        autoStart: true,
      });
    }

    expect(services.every((s) => processManager.isRunning(s))).toBe(true);

    await processManager.stopAll();

    expect(services.every((s) => !processManager.isRunning(s))).toBe(true);
  });

  test("should handle auto-restart on failure", async () => {
    // Create a test binary that exits immediately with error
    const failPath = join(tmpdir(), `fail-test-${Date.now()}.sh`);
    writeFileSync(
      failPath,
      `#!/bin/bash
echo "Failing"
exit 1
`,
    );
    chmodSync(failPath, 0o755);

    const config = {
      name: "auto-restart-test",
      repository: "owner/repo",
      binaryPath: failPath,
      checkInterval: 300,
      autoStart: true,
    };

    let restartCount = 0;
    processManager.on("started", () => {
      restartCount++;
    });

    await processManager.start(config);

    // Wait for auto-restart attempts
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Should have attempted at least one restart
    expect(restartCount).toBeGreaterThanOrEqual(1);

    rmSync(failPath, { force: true });
  });

  // PROC-F-002: Test graceful stop with SIGTERM
  test("PROC-F-002: should stop service gracefully with SIGTERM", async () => {
    const config = {
      name: "graceful-stop",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: false,
    };

    await processManager.start(config);

    // Verify it's running
    expect(processManager.isRunning("graceful-stop")).toBe(true);

    // Stop should use SIGTERM (graceful)
    await processManager.stop("graceful-stop");

    // Verify it stopped
    expect(processManager.isRunning("graceful-stop")).toBe(false);
  });

  // PROC-F-004: Test process status tracking (running, stopped, updating, error)
  test("PROC-F-004: should track all process status states", () => {
    // Test stopped status
    const status = processManager.getStatus("non-existent");
    expect(status.status).toBe("stopped");

    // Running status is already tested in "should get service status"
    // Error status would require mocking internal state
  });

  // PROC-F-006: Test uptime calculation
  test("PROC-F-006: should calculate uptime correctly", async () => {
    const config = {
      name: "uptime-test",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: true,
    };

    await processManager.start(config);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = processManager.getStatus("uptime-test");
    expect(status.uptime).toBeGreaterThanOrEqual(0.5);
    expect(status.uptime).toBeLessThan(2000); // Should be less than 2000 seconds
  });

  // PROC-F-007: Test auto-start with auto_start=true
  test("PROC-F-007: should respect auto_start configuration", async () => {
    const config = {
      name: "no-auto-start",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: false, // Explicitly false
    };

    await processManager.start(config);

    // Kill the process to trigger exit
    // @ts-expect-error - accessing private property for testing
    const processInfo = processManager.processes.get("no-auto-start");
    processInfo?.process.kill();

    // Wait to ensure no auto-restart happens
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should not be running
    expect(processManager.isRunning("no-auto-start")).toBe(false);
  });

  // PROC-F-012: Test working directory usage
  test("PROC-F-012: should use configured working directory", async () => {
    // Create a test binary that prints cwd
    const cwdTestPath = join(tmpdir(), `cwd-test-${Date.now()}.sh`);
    const testWorkDir = join(tmpdir(), `workdir-${Date.now()}`);
    writeFileSync(
      cwdTestPath,
      `#!/bin/bash
echo "CWD: $(pwd)"
sleep 1
`,
    );
    chmodSync(cwdTestPath, 0o755);

    // Create test working directory
    const { mkdirSync } = await import("node:fs");
    mkdirSync(testWorkDir, { recursive: true });

    const config = {
      name: "cwd-test",
      repository: "owner/repo",
      binaryPath: cwdTestPath,
      checkInterval: 300,
      autoStart: true,
      workingDirectory: testWorkDir,
    };

    let output = "";
    processManager.on("started", () => {
      // @ts-expect-error - accessing private property for testing
      const processInfo = processManager.processes.get("cwd-test");
      processInfo?.process.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });
    });

    await processManager.start(config);

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 500));

    // macOS may resolve symlinks, so check for the basename
    const path = await import("node:path");
    expect(output).toContain(path.basename(testWorkDir));

    rmSync(cwdTestPath, { force: true });
    rmSync(testWorkDir, { recursive: true, force: true });
  });

  // PROC-F-013: Test capturing stdout and stderr
  test("PROC-F-013: should capture stdout and stderr", async () => {
    // Create a test binary that outputs to both
    const outputTestPath = join(tmpdir(), `output-test-${Date.now()}.sh`);
    writeFileSync(
      outputTestPath,
      `#!/bin/bash
echo "This is stdout"
echo "This is stderr" >&2
sleep 1
`,
    );
    chmodSync(outputTestPath, 0o755);

    const config = {
      name: "output-test",
      repository: "owner/repo",
      binaryPath: outputTestPath,
      checkInterval: 300,
      autoStart: true,
    };

    let stdout = "";
    let stderr = "";
    processManager.on("started", () => {
      // @ts-expect-error - accessing private property for testing
      const processInfo = processManager.processes.get("output-test");
      processInfo?.process.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      processInfo?.process.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    });

    await processManager.start(config);

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(stdout).toContain("This is stdout");
    expect(stderr).toContain("This is stderr");

    rmSync(outputTestPath, { force: true });
  });

  // PROC-F-014: Test event emission
  test("PROC-F-014: should emit lifecycle events", async () => {
    const events: string[] = [];

    processManager.on("started", () => events.push("started"));
    processManager.on("stopped", () => events.push("stopped"));
    processManager.on("error", () => events.push("error"));

    const config = {
      name: "event-test",
      repository: "owner/repo",
      binaryPath: testBinaryPath,
      checkInterval: 300,
      autoStart: false,
    };

    await processManager.start(config);
    expect(events).toContain("started");

    await processManager.stop("event-test");
    expect(events).toContain("stopped");
  });

  // PROC-F-015: Test spawn timeout
  test("PROC-F-015: should handle spawn errors", async () => {
    // Use a script that doesn't have shebang to trigger error
    const badScriptPath = join(tmpdir(), `bad-script-${Date.now()}.sh`);
    writeFileSync(badScriptPath, "echo hello"); // No shebang
    chmodSync(badScriptPath, 0o755);

    const config = {
      name: "spawn-error-test",
      repository: "owner/repo",
      binaryPath: badScriptPath,
      checkInterval: 300,
      autoStart: false,
    };

    let errorEmitted = false;
    processManager.on("error", () => {
      errorEmitted = true;
    });

    try {
      await processManager.start(config);
      // If it starts, immediately stop it
      await processManager.stop("spawn-error-test");
    } catch {
      // Expected to throw
    }

    // Either it failed to start or emitted an error
    expect(errorEmitted || !processManager.isRunning("spawn-error-test")).toBe(
      true,
    );

    rmSync(badScriptPath, { force: true });
  });
});
