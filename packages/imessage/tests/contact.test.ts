import { describe, it, expect, afterEach, beforeEach, mock } from "bun:test";

import { handleForName, nameForHandle } from "@/contact";
import type { Handle } from "@/types";

interface ExecuteAppleScriptMock {
  calls: unknown[][];
  mockClear: () => void;
  mockResolvedValue: (val: unknown) => void;
  mockRejectedValue: (err: unknown) => void;
  _resolve: unknown;
  _reject: unknown;
  fn: (...args: unknown[]) => Promise<unknown>;
}

let executeAppleScriptMock: ExecuteAppleScriptMock;
mock.module("@/applescript", () => {
  executeAppleScriptMock = {
    calls: [],
    mockClear: () => {
      executeAppleScriptMock!.calls = [];
    },
    mockResolvedValue: (val: unknown) => {
      executeAppleScriptMock!._resolve = val;
      executeAppleScriptMock!._reject = undefined;
    },
    mockRejectedValue: (err: unknown) => {
      executeAppleScriptMock!._reject = err;
      executeAppleScriptMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    async fn(...args: unknown[]) {
      executeAppleScriptMock!.calls.push(args);
      if (executeAppleScriptMock!._reject !== undefined)
        throw executeAppleScriptMock!._reject;
      return executeAppleScriptMock!._resolve;
    },
  };
  return { executeAppleScript: executeAppleScriptMock.fn };
});

describe("contact utility", () => {
  let origConsoleError: Console["error"];
  let errorCalled = false;
  beforeEach(() => {
    executeAppleScriptMock.mockClear();
    executeAppleScriptMock._resolve = undefined;
    executeAppleScriptMock._reject = undefined;
    origConsoleError = console.error;
    errorCalled = false;
    console.error = () => {
      errorCalled = true;
    };
  });

  afterEach(() => {
    console.error = origConsoleError;
  });

  describe("handleForName", () => {
    it("should return a handle for a known name", async () => {
      const name = "Tim Cook";
      const expectedHandle: Handle = "+15551234567";
      executeAppleScriptMock.mockResolvedValue(expectedHandle);

      const handle = await handleForName(name);

      expect(executeAppleScriptMock.calls[0]?.[0]).toContain(name);
      expect(handle).toBe(expectedHandle);
    });

    it("should return null if name is not found", async () => {
      const name = "Unknown Person";
      executeAppleScriptMock.mockResolvedValue(null);

      const handle = await handleForName(name);
      expect(handle).toBeNull();
    });

    it("should throw an error if name is not provided", async () => {
      await expect(handleForName("")).rejects.toThrow("Name must be provided.");
    });

    it("should handle AppleScript execution errors", async () => {
      const name = "Error Case";
      executeAppleScriptMock.mockRejectedValue(new Error("AppleScript failed"));
      const result = await handleForName(name);
      expect(result).toBeNull();
      expect(errorCalled).toBe(true);
    });
  });

  describe("nameForHandle", () => {
    it("should return a name for a known handle", async () => {
      const handle: Handle = "+15551234567";
      const expectedName = "Tim Cook";
      executeAppleScriptMock.mockResolvedValue(expectedName);

      const name = await nameForHandle(handle);

      expect(executeAppleScriptMock.calls[0]?.[0]).toContain(handle);
      expect(name).toBe(expectedName);
    });

    it("should return null if handle is not found", async () => {
      const handle: Handle = "unknown@example.com";
      executeAppleScriptMock.mockResolvedValue(null);

      const name = await nameForHandle(handle);
      expect(name).toBeNull();
    });

    it("should throw an error if handle is not provided", async () => {
      await expect(nameForHandle("")).rejects.toThrow(
        "Handle must be provided."
      );
    });

    it("should handle AppleScript execution errors", async () => {
      const handle = "error@example.com";
      executeAppleScriptMock.mockRejectedValue(new Error("AppleScript failed"));
      const result = await nameForHandle(handle);
      expect(result).toBeNull();
      expect(errorCalled).toBe(true);
    });
  });
});
