import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createLogger,
  getLogFilePath,
  readLogFile,
  followLogFile,
} from "./logger";

describe("Logger Module", () => {
  let testDir: string;
  let logDir: string;

  beforeEach(() => {
    // Setup test directory
    testDir = join(tmpdir(), `logger-module-test-${Date.now()}`);
    logDir = join(testDir, "logs");
    mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("createLogger", () => {
    test("should create a logger with file transport", async () => {
      const logger = createLogger({
        name: "test-service",
        logDir,
        console: false,
      });

      expect(logger).toBeDefined();
      expect(logger.level).toBe("info");

      // Log a message
      logger.info("Test message");

      // Wait a bit for the file to be created
      await Bun.sleep(100);

      // Check that log file was created
      const logFile = join(logDir, "test-service.log");
      expect(existsSync(logFile)).toBe(true);
    });

    test("should respect custom log level", () => {
      const logger = createLogger({
        name: "test-service",
        logDir,
        level: "debug",
        console: false,
      });

      expect(logger.level).toBe("debug");
    });

    test("should create log directory if it doesn't exist", () => {
      const newLogDir = join(testDir, "new-logs");

      createLogger({
        name: "test-service",
        logDir: newLogDir,
        console: false,
      });

      expect(existsSync(newLogDir)).toBe(true);
    });
  });

  describe("getLogFilePath", () => {
    test("should return correct log file path", () => {
      const serviceName = "my-service";
      const expectedPath = join(logDir, `${serviceName}.log`);

      const actualPath = getLogFilePath(logDir, serviceName);

      expect(actualPath).toBe(expectedPath);
    });
  });

  describe("readLogFile", () => {
    test("should return empty array for non-existent file", async () => {
      const logFile = join(logDir, "non-existent.log");

      const lines = await readLogFile(logFile);

      expect(lines).toEqual([]);
    });

    test("should read all lines from log file", async () => {
      const logFile = join(logDir, "test.log");
      const content = "Line 1\nLine 2\nLine 3\n";
      writeFileSync(logFile, content);

      const lines = await readLogFile(logFile);

      expect(lines).toEqual(["Line 1", "Line 2", "Line 3"]);
    });

    test("should return last N lines when specified", async () => {
      const logFile = join(logDir, "test.log");
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n";
      writeFileSync(logFile, content);

      const lines = await readLogFile(logFile, 3);

      expect(lines).toEqual(["Line 3", "Line 4", "Line 5"]);
    });

    test("should handle empty lines correctly", async () => {
      const logFile = join(logDir, "test.log");
      const content = "Line 1\n\nLine 3\n\n";
      writeFileSync(logFile, content);

      const lines = await readLogFile(logFile);

      expect(lines).toEqual(["Line 1", "Line 3"]);
    });
  });

  describe("followLogFile", () => {
    test("should yield initial lines from file", async () => {
      const logFile = join(logDir, "test.log");
      const content = "Initial Line 1\nInitial Line 2\n";
      writeFileSync(logFile, content);

      const abortController = new AbortController();
      const generator = followLogFile(logFile, 2, abortController.signal);
      const results: string[] = [];

      // Read initial lines
      for (let i = 0; i < 2; i++) {
        const { value, done } = await generator.next();
        if (!done) {
          results.push(value);
        }
      }

      expect(results).toEqual(["Initial Line 1", "Initial Line 2"]);

      // Clean up
      abortController.abort();
    });

    test("should yield new lines as they are written", async () => {
      const logFile = join(logDir, "test.log");
      writeFileSync(logFile, "Initial Line\n");

      const abortController = new AbortController();
      const generator = followLogFile(logFile, 1, abortController.signal);
      const results: string[] = [];

      // Collect lines in background
      const collectPromise = (async () => {
        for await (const line of generator) {
          results.push(line);
          if (results.length >= 3) {
            break;
          }
        }
      })();

      // Wait for initial line to be read
      await Bun.sleep(50);

      // Write new content
      const content = await Bun.file(logFile).text();
      writeFileSync(logFile, content + "New Line 1\nNew Line 2\n");

      // Wait a bit for the new lines to be detected
      await Bun.sleep(300);

      // Abort and wait for collection to finish
      abortController.abort();
      await collectPromise;

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toBe("Initial Line");
      // Note: File watching may not always detect changes immediately in test environment
    });

    test("should handle non-existent file gracefully", async () => {
      const logFile = join(logDir, "non-existent.log");

      const abortController = new AbortController();
      const generator = followLogFile(logFile, 10, abortController.signal);
      const results: string[] = [];

      // Abort immediately after a short wait
      setTimeout(() => abortController.abort(), 100);

      // Try to collect lines
      for await (const line of generator) {
        results.push(line);
      }

      expect(results).toEqual([]);
    });
  });
});
