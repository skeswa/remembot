import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Daemon } from "../../src/daemon/daemon";
import { IPCClient } from "../../src/client/ipc-client";
import { IPCEvent, type LogLineEventPayload } from "../../src/ipc/types";
import { createTestEnvironment } from "../test-helper";

describe("Daemon Log Streaming", () => {
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

  test("should stream log lines when following", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-streamer"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/bash"
args = ["-c", "for i in {1..5}; do echo 'Log line '$i; sleep 0.1; done"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-streamer.toml"),
      tomlContent,
    );

    // Subscribe to log events
    await client.subscribe([IPCEvent.LogLine], ["test-streamer"]);

    // Collect log lines
    const logLines: string[] = [];
    client.on(IPCEvent.LogLine, (payload: LogLineEventPayload) => {
      if (payload.service === "test-streamer") {
        logLines.push(payload.line);
      }
    });

    // Start the service
    await client.startService("test-streamer");

    // Wait a bit for the service to start writing logs
    await Bun.sleep(100);

    // Start streaming logs
    await client.streamLogs("test-streamer", 0);

    // Wait for service to finish and logs to be collected
    await Bun.sleep(2000);

    // Stop streaming
    await client.stopLogStream("test-streamer");

    // Verify we received log lines
    expect(logLines.length).toBeGreaterThan(0);
    expect(logLines.some((line) => line.includes("Log line"))).toBe(true);
  });

  test("should stream initial lines when requested", async () => {
    const logDir = join(testEnv.testDir, ".macrounder", "logs");
    const logFile = join(logDir, "test-initial.log");

    // Create log file with some initial content
    const initialLines = [
      "[2024-01-01T00:00:00.000Z] [STDOUT] Initial line 1",
      "[2024-01-01T00:00:01.000Z] [STDOUT] Initial line 2",
      "[2024-01-01T00:00:02.000Z] [STDOUT] Initial line 3",
    ];
    writeFileSync(logFile, initialLines.join("\n") + "\n");

    // Create a test app config
    const tomlContent = `[app]
name = "test-initial"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/echo"
args = ["test"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-initial.toml"),
      tomlContent,
    );

    // Subscribe to log events
    await client.subscribe([IPCEvent.LogLine], ["test-initial"]);

    // Collect log lines
    const logLines: string[] = [];
    client.on(IPCEvent.LogLine, (payload: LogLineEventPayload) => {
      if (payload.service === "test-initial") {
        logLines.push(payload.line);
      }
    });

    // Start streaming logs with initial lines
    await client.streamLogs("test-initial", 2);

    // Wait a bit for initial lines to be sent
    await Bun.sleep(200);

    // Stop streaming
    await client.stopLogStream("test-initial");

    // Verify we received the last 2 initial lines
    expect(logLines.length).toBe(2);
    expect(logLines[0]).toContain("Initial line 2");
    expect(logLines[1]).toContain("Initial line 3");
  });

  test("should stop streaming when requested", async () => {
    // Create a test app config
    const tomlContent = `[app]
name = "test-stop"
repository = "owner/repo"
check_interval = 300
auto_start = false

[run]
binary_path = "/bin/bash"
args = ["-c", "while true; do echo 'Continuous log'; sleep 0.1; done"]
`;
    writeFileSync(
      join(testEnv.testDir, ".macrounder", "apps", "test-stop.toml"),
      tomlContent,
    );

    // Subscribe to log events
    await client.subscribe([IPCEvent.LogLine], ["test-stop"]);

    // Collect log lines
    const logLines: string[] = [];
    client.on(IPCEvent.LogLine, (payload: LogLineEventPayload) => {
      if (payload.service === "test-stop") {
        logLines.push(payload.line);
      }
    });

    // Start the service
    await client.startService("test-stop");

    // Wait a bit for service to start and write some logs
    await Bun.sleep(200);

    // Start streaming logs
    await client.streamLogs("test-stop", 0);

    // Wait for some logs
    await Bun.sleep(500);

    const countBeforeStop = logLines.length;
    expect(countBeforeStop).toBeGreaterThan(0);

    // Stop streaming
    await client.stopLogStream("test-stop");

    // Wait a bit more
    await Bun.sleep(500);

    // Verify no new logs after stopping
    expect(logLines.length).toBe(countBeforeStop);

    // Stop the service
    await client.stopService("test-stop");
  });
});
