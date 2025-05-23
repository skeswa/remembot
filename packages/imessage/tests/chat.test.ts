import { describe, it, expect, beforeEach, mock } from "bun:test";
import os from "os";

import { getRecentChats } from "@/chat";

// Mocks
interface QueryDbMock {
  calls: unknown[][];
  _queue: Array<{ type: "resolve"; val: unknown }>;
  mockClear: () => void;
  mockResolvedValueOnce: (val: unknown) => void;
  mockReset: () => void;
  fn: (...args: unknown[]) => Promise<unknown[]>;
}

let queryDbMock: QueryDbMock;

mock.module("@/db", () => {
  queryDbMock = {
    calls: [],
    _queue: [],
    mockClear: () => {
      queryDbMock!.calls = [];
    },
    mockResolvedValueOnce: (val: unknown) => {
      queryDbMock!._queue.push({ type: "resolve", val });
    },
    mockReset: () => {
      queryDbMock!._queue = [];
    },
    async fn(...args: unknown[]) {
      queryDbMock!.calls.push(args);
      if (queryDbMock!._queue.length > 0) {
        const next = queryDbMock!._queue.shift();
        if (!next) return [];
        if (next.type === "resolve") return [next.val];
      }
      return [];
    },
  };
  return { queryDb: queryDbMock.fn };
});

mock.module("os", () => {
  return {
    ...os,
    homedir: () => "/mock/home",
  };
});

describe("chat utility - getRecentChats", () => {
  beforeEach(() => {
    queryDbMock.mockClear();
    queryDbMock.mockResolvedValueOnce([]);
    queryDbMock.mockResolvedValueOnce([]);
  });

  it("should return an empty array if no chats are found", async () => {
    queryDbMock.mockReset();
    queryDbMock.mockResolvedValueOnce([]);

    const chats = await getRecentChats(5);
    expect(chats).toEqual([]);
    expect(queryDbMock.calls.length).toBe(1);
  });

  it("should correctly parse raw chat messages and fetch participants", async () => {
    queryDbMock.mockReset();
    const rawChatMessages = [
      {
        chat_id: 1,
        chat_identifier: "chat123",
        display_name: "Group Chat 1",
        service_name: "iMessage",
        last_message_text: "Hello there",
        last_message_date: 1677640000,
        last_message_is_from_me: 0,
        last_message_guid: "guid1",
        last_message_handle_id: "+1234567890",
        attachment_path: null,
        attachment_mime_type: null,
      },
      {
        chat_id: 2,
        chat_identifier: "+19876543210",
        display_name: null,
        service_name: "iMessage",
        last_message_text: "Attachment received",
        last_message_date: 1677650000,
        last_message_is_from_me: 1,
        last_message_guid: "guid2",
        last_message_handle_id: "+19876543210",
        attachment_path: "~/Library/Messages/Attachments/some/path/file.png",
        attachment_mime_type: "image/png",
      },
    ];
    const rawParticipants = [
      { chat_id: 1, handle_id: "+1234567890" },
      { chat_id: 1, handle_id: "+1112223333" },
      { chat_id: 2, handle_id: "+19876543210" },
    ];

    queryDbMock.mockResolvedValueOnce(rawChatMessages);
    queryDbMock.mockResolvedValueOnce(rawParticipants);

    const chats = await getRecentChats(2);

    expect(queryDbMock.calls.length).toBe(2);
    expect((queryDbMock.calls[0]![0] as string).toString()).toContain(
      "ORDER BY m.date DESC",
    );
    expect(queryDbMock.calls[0]![1]).toEqual([2]);
    expect((queryDbMock.calls[1]![0] as string).toString()).toContain(
      "WHERE chj.chat_id IN (?,?)",
    );
    expect(queryDbMock.calls[1]![1]).toEqual([1, 2]);

    expect(chats!.length).toBe(2);

    expect(chats![0]!.id).toBe("chat123");
    expect(chats![0]!.displayName).toBe("Group Chat 1");
    expect(chats![0]!.participants).toEqual(["+1234567890", "+1112223333"]);
    expect(chats![0]!.lastMessage).not.toBeNull();
    if (chats![0]!.lastMessage) {
      expect(chats![0]!.lastMessage!.text).toBe("Hello there");
      expect(chats![0]!.lastMessage!.fromMe).toBe(false);
      expect(chats![0]!.lastMessage!.handle).toBe("+1234567890");
      expect(chats![0]!.lastMessage!.group).toBe("chat123");
      expect(chats![0]!.lastMessage!.date).toEqual(
        new Date(Date.UTC(2001, 0, 1) + 1677640000 * 1000),
      );
    }

    expect(chats![1]!.id).toBe("+19876543210");
    expect(chats![1]!.displayName).toBe("+19876543210");
    expect(chats![1]!.participants).toEqual(["+19876543210"]);
    expect(chats![1]!.lastMessage).not.toBeNull();
    if (chats![1]!.lastMessage) {
      expect(chats![1]!.lastMessage!.text).toBe("Attachment received");
      expect(chats![1]!.lastMessage!.fromMe).toBe(true);
      expect(chats![1]!.lastMessage!.file).toBe(
        "/mock/home/Library/Messages/Attachments/some/path/file.png",
      );
      expect(chats![1]!.lastMessage!.fileType).toBe("image/png");
      expect(chats![1]!.lastMessage!.group).toBeNull();
    }
  });

  it("should use default limit of 10 if no limit is provided", async () => {
    queryDbMock.mockReset();
    queryDbMock.mockResolvedValueOnce([]);

    await getRecentChats();
    expect(queryDbMock.calls[0]![1]).toEqual([10]);
  });

  it("should handle chats with no last message (e.g. only last_message_guid is null)", async () => {
    queryDbMock.mockReset();
    const rawChatMessages = [
      {
        chat_id: 1,
        chat_identifier: "chat789",
        display_name: "Empty Chat",
        service_name: "iMessage",
        last_message_text: null,
        last_message_date: 0,
        last_message_is_from_me: 0,
        last_message_guid: null,
        last_message_handle_id: null,
        attachment_path: null,
        attachment_mime_type: null,
      },
    ];
    queryDbMock.mockResolvedValueOnce(rawChatMessages);
    queryDbMock.mockResolvedValueOnce([{ chat_id: 1, handle_id: "+123" }]);

    const chats = await getRecentChats(1);
    expect(chats!.length).toBe(1);
    expect(chats![0]!.id).toBe("chat789");
    expect(chats![0]!.lastMessage).toBeNull();
    expect(chats![0]!.participants).toEqual(["+123"]);
  });
});
