import { describe, expect, test, mock } from "bun:test";
import { MessageDatabase } from "./message-database";
import { listChats } from "./chat";

describe("Chat Module", () => {
  describe("listChats", () => {
    test("should return empty array when no chats exist", () => {
      const mockDb = {
        query: mock(() => []),
      } as unknown as MessageDatabase;

      const result = listChats(mockDb);
      expect(result).toEqual([]);
    });

    test("should parse chat data correctly", () => {
      const mockDb = {
        query: mock(() => [
          {
            displayName: "Test Chat",
            guid: "chat-guid",
            mostRecentMessageGuid: "msg-guid",
            mostRecentMessageDate: 1234567890,
            participantsJson: JSON.stringify([
              { id: "test@example.com", service: "iMessage" },
              { id: "+1234567890", service: "SMS" },
            ]),
            unreadMessageCount: 2,
          },
        ]),
      } as unknown as MessageDatabase;

      const result = listChats(mockDb);
      expect(result).toHaveLength(1);
      const chat = result[0];
      expect(chat).toBeDefined();
      if (chat) {
        expect(chat).toEqual({
          displayName: "Test Chat",
          guid: "chat-guid",
          mostRecentMessageSummary: {
            messageGuid: "msg-guid",
            messageTime: expect.any(Date),
          },
          participants: [
            { id: "test@example.com", name: null, service: "iMessage" },
            { id: "+1234567890", name: null, service: "SMS" },
          ],
          unreadMessageCount: 2,
        });
      }
    });

    test("should handle invalid participant JSON gracefully", () => {
      const mockDb = {
        query: mock(() => [
          {
            displayName: "Test Chat",
            guid: "chat-guid",
            mostRecentMessageGuid: "msg-guid",
            mostRecentMessageDate: 1234567890,
            participantsJson: "invalid json",
            unreadMessageCount: 0,
          },
        ]),
      } as unknown as MessageDatabase;

      const result = listChats(mockDb);
      expect(result).toHaveLength(1);
      const chat = result[0];
      expect(chat).toBeDefined();
      if (chat) {
        expect(chat.participants).toEqual([]);
      }
    });

    test("should handle chat with no recent message", () => {
      const mockDb = {
        query: mock(() => [
          {
            displayName: "Test Chat",
            guid: "chat-guid",
            mostRecentMessageGuid: null,
            mostRecentMessageDate: null,
            participantsJson: JSON.stringify([
              { id: "test@example.com", service: "iMessage" },
            ]),
            unreadMessageCount: 0,
          },
        ]),
      } as unknown as MessageDatabase;

      const result = listChats(mockDb);
      expect(result).toHaveLength(1);
      const chat = result[0];
      expect(chat).toBeDefined();
      if (chat) {
        expect(chat.mostRecentMessageSummary).toBeNull();
      }
    });

    test("should respect limit parameter", () => {
      const mockDb = {
        query: mock(() => [
          {
            displayName: "Chat 1",
            guid: "chat-guid-1",
            mostRecentMessageGuid: "msg-guid-1",
            mostRecentMessageDate: 1234567890,
            participantsJson: "[]",
            unreadMessageCount: 0,
          },
          {
            displayName: "Chat 2",
            guid: "chat-guid-2",
            mostRecentMessageGuid: "msg-guid-2",
            mostRecentMessageDate: 1234567890,
            participantsJson: "[]",
            unreadMessageCount: 0,
          },
        ]),
      } as unknown as MessageDatabase;

      const result = listChats(mockDb, 1);
      expect(result).toHaveLength(1);
      const chat = result[0];
      expect(chat).toBeDefined();
      if (chat) {
        expect(chat.displayName).toBe("Chat 1");
      }
    });
  });
}); 