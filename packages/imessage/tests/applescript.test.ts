import { describe, it, expect, beforeEach, mock } from "bun:test";

import { executeAppleScript } from "@/applescript";

// Mocks
interface ExecMock {
  calls: string[];
  mockClear: () => void;
  mockResolvedValue: (val: unknown) => void;
  mockRejectedValue: (err: unknown) => void;
  _resolve: unknown;
  _reject: unknown;
  exec: (script: string) => Promise<unknown>;
}

let execMock: ExecMock;

mock.module("node-osascript", () => {
  execMock = {
    calls: [],
    mockClear: () => {
      execMock!.calls = [];
    },
    mockResolvedValue: (val: unknown) => {
      execMock!._resolve = val;
      execMock!._reject = undefined;
    },
    mockRejectedValue: (err: unknown) => {
      execMock!._reject = err;
      execMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    async exec(script: string) {
      execMock!.calls.push(script);
      if (execMock!._reject !== undefined) throw execMock!._reject;
      return execMock!._resolve;
    },
  };
  return { exec: execMock.exec };
});

describe("applescript utility", () => {
  beforeEach(() => {
    execMock.mockClear();
    execMock._resolve = undefined;
    execMock._reject = undefined;
  });

  it("should execute AppleScript successfully", async () => {
    const script = 'tell application "Finder" to get name of front window';
    const expectedResult = "Finder Window Name";
    execMock.mockResolvedValue(expectedResult);

    const result = await executeAppleScript(script);

    expect(execMock.calls).toContain(script);
    expect(result).toBe(expectedResult);
  });

  it("should throw an error if AppleScript execution fails", async () => {
    const script = 'tell application "NonExistentApp" to do something';
    const errorMessage = "Application not found";
    execMock.mockRejectedValue(new Error(errorMessage));

    await expect(executeAppleScript(script)).rejects.toThrow(
      `AppleScript execution failed: ${errorMessage}`,
    );
    expect(execMock.calls).toContain(script);
  });

  it("should handle errors without a message property", async () => {
    const script = "some script";
    const errorObject = { customError: "An error occurred" };
    execMock.mockRejectedValue(errorObject);

    await expect(executeAppleScript(script)).rejects.toThrow(
      `AppleScript execution failed: ${errorObject}`,
    );
  });
});
