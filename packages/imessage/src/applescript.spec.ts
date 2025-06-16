import { describe, expect, test, mock } from "bun:test";
import { AppleScriptExecutor } from "./applescript";

mock.module("node-osascript", () => ({
  execute: mock((script: string, _: unknown, callback: Function) => {
    if (script.includes("error")) {
      callback(new Error("Test error"), null, null);
    } else {
      callback(null, "Test result", "Raw output");
    }
  }),
}));

describe("AppleScriptExecutor", () => {
  test("should execute AppleScript successfully", async () => {
    const executor = new AppleScriptExecutor();
    const result = await executor.execute('tell application "Messages" to get name');
    expect(result).toBe("Test result");
  });

  test("should handle AppleScript execution errors", async () => {
    const executor = new AppleScriptExecutor();
    await expect(executor.execute("error")).rejects.toThrow("AppleScript execution failed: Test error");
  });

  test("should handle non-Error objects in error handling", async () => {
    // Mock the module to throw a non-Error object
    mock.module("node-osascript", () => ({
      execute: mock((_: string, __: unknown, callback: Function) => {
        callback("String error", null, null);
      }),
    }));

    const executor = new AppleScriptExecutor();
    await expect(executor.execute("any script")).rejects.toThrow("AppleScript execution failed: String error");
  });
}); 