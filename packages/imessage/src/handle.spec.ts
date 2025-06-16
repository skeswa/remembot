import { describe, expect, test, mock } from "bun:test";
import type { AppleScriptExecutor } from "./applescript";
import { applyNamesToHandles } from "./handle";

describe("Handle Module", () => {
  describe("applyNamesToHandles", () => {
    test("should return empty array for empty input", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => []),
      };

      const result = await applyNamesToHandles(mockExecutor, []);
      expect(result).toEqual([]);
    });

    test("should populate names for handles with matching contacts", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => ["John Doe", "Jane Smith", null]),
      };

      const handles = [
        { id: "+1234567890", name: null },
        { id: "john@example.com", name: null },
        { id: "+9876543210", name: null },
      ];

      const result = await applyNamesToHandles(mockExecutor, handles);
      expect(result).toEqual([
        { id: "+1234567890", name: "John Doe" },
        { id: "john@example.com", name: "Jane Smith" },
        { id: "+9876543210", name: null },
      ]);
    });

    test("should handle AppleScript execution errors gracefully", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => {
          throw new Error("Failed to execute AppleScript");
        }),
      };

      const handles = [
        { id: "+1234567890", name: null },
        { id: "john@example.com", name: null },
      ];

      const result = await applyNamesToHandles(mockExecutor, handles);
      expect(result).toEqual([
        { id: "+1234567890", name: null },
        { id: "john@example.com", name: null },
      ]);
    });

    test("should handle non-array response from AppleScript", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => "not an array"),
      };

      const handles = [
        { id: "+1234567890", name: null },
        { id: "john@example.com", name: null },
      ];

      const result = await applyNamesToHandles(mockExecutor, handles);
      expect(result).toEqual([
        { id: "+1234567890", name: null },
        { id: "john@example.com", name: null },
      ]);
    });

    test("should properly escape special characters in handle IDs", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async (script: string) => {
          expect(script).toContain('"handle\\"with\\"quotes"');
          expect(script).toContain('"handle\\\'with\\\'apostrophes"');
          return ["Test Name"];
        }),
      };

      const handles = [
        { id: 'handle"with"quotes', name: null },
        { id: "handle'with'apostrophes", name: null },
      ];

      await applyNamesToHandles(mockExecutor, handles);
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    });
  });
}); 