import { describe, expect, test, mock } from "bun:test";
import type { AppleScriptExecutor } from "./applescript";
import type { Handle } from "./handle";
import { sendFileMessage, sendMessage } from "./message";

describe("Message Module", () => {
  describe("sendMessage", () => {
    test("should send a text message successfully", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async (script: string) => {
          expect(script).toContain('tell application "Messages"');
          expect(script).toContain('set targetBuddy to "test@example.com"');
          expect(script).toContain('set textMessage to "Hello, world!"');
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await sendMessage(mockExecutor, handle, "Hello, world!");
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    });

    test("should handle special characters in message text", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async (script: string) => {
          expect(script).toContain('set textMessage to "Hello \\"world\\"!"');
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await sendMessage(mockExecutor, handle, 'Hello "world"!');
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    });

    test("should throw error when message sending fails", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => {
          throw new Error("Failed to execute AppleScript");
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await expect(sendMessage(mockExecutor, handle, "Hello")).rejects.toThrow(
        "Failed to send message to test@example.com",
      );
    });
  });

  describe("sendFileMessage", () => {
    test("should send a file message successfully", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async (script: string) => {
          expect(script).toContain('tell application "Messages"');
          expect(script).toContain('set targetBuddy to "test@example.com"');
          expect(script).toContain('set theFile to POSIX file "/path/to/file"');
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await sendFileMessage(mockExecutor, handle, "/path/to/file");
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    });

    test("should handle special characters in file path", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async (script: string) => {
          expect(script).toContain(
            'set theFile to POSIX file "/path/to/file with \\"quotes\\""',
          );
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await sendFileMessage(
        mockExecutor,
        handle,
        '/path/to/file with "quotes"',
      );
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
    });

    test("should throw error when file sending fails", async () => {
      const mockExecutor: AppleScriptExecutor = {
        execute: mock(async () => {
          throw new Error("Failed to execute AppleScript");
        }),
      };

      const handle: Handle = {
        id: "test@example.com",
        name: "Test User",
      };

      await expect(
        sendFileMessage(mockExecutor, handle, "/path/to/file"),
      ).rejects.toThrow("Failed to send file message to test@example.com");
    });
  });
});
