import { describe, it, expect, beforeEach, mock } from "bun:test";

import { executeAppleScript } from "@/applescript";

// Mocks
interface ExecuteMock {
  calls: Parameters<ExecuteMock["execute"]>[];
  mockClear: () => void;
  mockResolvedValue: (val: { result: unknown; raw: unknown }) => void;
  mockRejectedValue: (err: unknown) => void;
  _resolve: { result: unknown; raw: unknown } | undefined;
  _reject: unknown;
  execute: (
    script: string,
    variables?: Record<string, unknown>,
    callback?: (err: Error | null, result: unknown, raw: unknown) => void,
  ) => unknown;
}

let executeMock: ExecuteMock;

mock.module("node-osascript", () => {
  executeMock = {
    calls: [],
    mockClear: () => {
      executeMock!.calls = [];
    },
    mockResolvedValue: (val: { result: unknown; raw: unknown }) => {
      executeMock!._reject = undefined;
      executeMock!._resolve = val;
    },
    mockRejectedValue: (err: unknown) => {
      executeMock!._reject = err;
      executeMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    execute(
      script: string,
      _variables?: Record<string, unknown>,
      _callback?: (err: Error | null, result: unknown, raw: unknown) => void,
    ): unknown {
      executeMock!.calls.push([script, _variables]);

      if (executeMock!._reject !== undefined) {
        _callback?.(executeMock!._reject as Error, undefined, undefined);

        return;
      }

      _callback?.(
        null,
        executeMock!._resolve?.result,
        executeMock!._resolve?.raw,
      );
    },
  };
  return { execute: executeMock.execute };
});

describe("applescript utility", () => {
  beforeEach(() => {
    executeMock.mockClear();
    executeMock._resolve = undefined;
    executeMock._reject = undefined;
  });

  it("should execute AppleScript successfully", async () => {
    const script = 'tell application "Finder" to get name of front window';
    const expectedResult = "Finder Window Name";
    const expectedRaw = "Finder Window Name";

    executeMock.mockResolvedValue({ result: expectedResult, raw: expectedRaw });

    const result = await executeAppleScript(script);

    expect(executeMock.calls).toContainEqual([script, undefined]);
    expect(result).toBe(expectedResult);
  });

  it("should throw an error if AppleScript execution fails", async () => {
    const script = 'tell application "NonExistentApp" to do something';
    const errorMessage = "Application not found";
    executeMock.mockRejectedValue(new Error(errorMessage));

    await expect(executeAppleScript(script)).rejects.toThrow(
      new Error(`AppleScript execution failed: ${errorMessage}`),
    );
    expect(executeMock.calls).toContainEqual([script, undefined]);
  });

  it("should handle errors without a message property", async () => {
    const script = "some script";
    const errorObject = { customError: "An error occurred" };
    executeMock.mockRejectedValue(errorObject);

    await expect(executeAppleScript(script)).rejects.toThrow(
      `AppleScript execution failed: ${errorObject}`,
    );
  });
});
