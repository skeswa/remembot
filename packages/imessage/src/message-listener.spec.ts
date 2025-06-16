import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { MessageListener } from "./message-listener";
import { MessageDatabase } from "./message-database";
import type { Message, RawMessage } from "./message";
import pino from "pino";

describe("MessageListener", () => {
  let mockDb: MessageDatabase;
  let mockLogger: pino.Logger;
  let listener: MessageListener;

  beforeEach(() => {
    // Mock the database
    const mockQuery = mock((sql: string, _: unknown[] = []) => {
      if (sql.includes("MAX(ROWID)")) {
        return [{ maxId: 100 }];
      }
      if (sql.includes("error")) {
        throw new Error("Test database error");
      }
      return [
        {
          rowId: 101,
          guid: "test-guid",
          text: "Test message",
          handleId: "test@example.com",
          service: "iMessage",
          date: 1234567890,
          isFromMe: 0,
          chatId: "group-chat-id",
          attachmentPath: null,
          attachmentMimeType: null,
        } as RawMessage,
      ];
    });

    mockDb = {
      query: mockQuery,
      open: mock(() => {}),
      close: mock(() => {}),
    } as unknown as MessageDatabase;

    // Mock the logger
    mockLogger = {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    } as unknown as pino.Logger;

    listener = new MessageListener(mockDb, mockLogger, 1000);
  });

  afterEach(() => {
    listener.dispose();
  });

  describe("startListening", () => {
    test("should initialize with max message ID", () => {
      listener.startListening();
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT MAX(ROWID) as maxId FROM message;",
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Initializing last message ID to %d",
        100,
      );
    });

    test("should handle database error during initialization", () => {
      const errorHandler = mock(() => {});
      listener.on("error", errorHandler);

      mockDb.query = mock(() => {
        throw new Error("Test error");
      });

      listener.startListening();
      expect(errorHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test("should not start listening if already listening", () => {
      listener.startListening();
      const initialCallCount = (mockDb.query as any).mock.calls.length;
      listener.startListening();
      expect((mockDb.query as any).mock.calls.length).toBe(initialCallCount);
    });
  });

  describe("stopListening", () => {
    test("should stop polling for messages", () => {
      listener.startListening();
      listener.stopListening();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Stopped listening for new messages",
      );
    });
  });

  describe("message events", () => {
    test("should emit message events for new messages", () => {
      const messageHandler = mock((_: Message) => {});
      listener.on("message", messageHandler);

      listener.startListening();
      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          guid: "test-guid",
          text: "Test message",
          handle: { id: "test@example.com", name: null },
        }),
      );
    });

    test("should emit error events when query fails", () => {
      const errorHandler = mock(() => {});
      listener.on("error", errorHandler);

      mockDb.query = mock(() => {
        throw new Error("Test error");
      });

      listener.startListening();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    test("should stop listening and remove all listeners", () => {
      const messageHandler1 = mock(() => {});
      listener.on("message", messageHandler1);

      listener.startListening();

      expect(messageHandler1).toHaveBeenCalled();

      listener.dispose();

      const messageHandler2 = mock(() => {});
      listener.on("message", messageHandler2);

      listener.startListening();

      expect(messageHandler2).toHaveBeenCalled();
      expect(messageHandler1).not.toHaveBeenCalledTimes(2);
    });
  });
});
