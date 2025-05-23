import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import os from "os";

import { EventEmitter } from "events";
import { listen, stopListening } from "@/message";
import type { Message } from "@/types";

interface QueryDbMock {
  calls: unknown[][];
  _queue: Array<{ type: "resolve"; val: unknown } | { type: "reject"; err: unknown }>;
  mockClear: () => void;
  mockResolvedValueOnce: (val: unknown) => void;
  mockRejectedValueOnce: (err: unknown) => void;
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
    mockRejectedValueOnce: (err: unknown) => {
      queryDbMock!._queue.push({ type: "reject", err });
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
        if (next.type === "reject") throw next.err;
      }
      return [];
    },
  };
  return { queryDb: queryDbMock.fn, closeDbConnection: () => {} };
});

// Manual mock for os.homedir
mock.module("os", () => {
  return {
    ...os,
    homedir: () => "/mock/home",
  };
});

describe("message utility - listen and stopListening", () => {
  let messageEmitter: EventEmitter;

  beforeEach(() => {
    queryDbMock.mockClear();
    queryDbMock.mockResolvedValueOnce([{ max_id: 100 }]);
    queryDbMock.mockResolvedValueOnce([]);
    messageEmitter = listen(1000);
  });

  afterEach(() => {
    stopListening();
    messageEmitter.removeAllListeners();
  });

  it("should initialize lastMessageRowId with MAX(ROWID) from message table", async () => {
    // Wait for the initial fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(queryDbMock.calls[0][0]).toBe(
      "SELECT MAX(ROWID) as max_id FROM message;",
    );
  });

  it('should emit "message" events for new messages', async () => {
    const mockMessageHandler = (...args: unknown[]) => {
      mockMessageHandler.calls.push(args);
    };
    mockMessageHandler.calls = [] as Array<unknown[]>;
    messageEmitter.on("message", mockMessageHandler);

    const newDbMessages = [
      {
        ROWID: 101,
        guid: "msgGuid1",
        text: "Hello from test",
        handle_id: "+111",
        service: "iMessage",
        date: 1677800000,
        is_from_me: 0,
        chat_identifier: "chatGroup1",
        attachment_path: null,
        attachment_mime_type: null,
      },
      {
        ROWID: 102,
        guid: "msgGuid2",
        text: "Another message",
        handle_id: "+222",
        service: "iMessage",
        date: 1677800005,
        is_from_me: 1,
        chat_identifier: null,
        attachment_path: "~/Library/Attachments/file.jpg",
        attachment_mime_type: "image/jpeg",
      },
    ];

    queryDbMock.mockResolvedValueOnce(newDbMessages);
    // Wait for the poll interval
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(mockMessageHandler.calls.length).toBe(2);
    const expectedMessage1: Message = {
      guid: "msgGuid1",
      text: "Hello from test",
      handle: "+111",
      group: "chatGroup1",
      date: new Date(Date.UTC(2001, 0, 1) + 1677800000 * 1000),
      fromMe: false,
      file: null,
      fileType: null,
    };
    const expectedMessage2: Message = {
      guid: "msgGuid2",
      text: "Another message",
      handle: "+222",
      group: null,
      date: new Date(Date.UTC(2001, 0, 1) + 1677800005 * 1000),
      fromMe: true,
      file: "/mock/home/Library/Attachments/file.jpg",
      fileType: "image/jpeg",
    };
    expect(mockMessageHandler.calls[0]?.[0]).toMatchObject(expectedMessage1);
    expect(mockMessageHandler.calls[1]?.[0]).toMatchObject(expectedMessage2);
  });

  it("should not emit messages if they have no text and no attachment", async () => {
    const mockMessageHandler = (...args: unknown[]) => {
      mockMessageHandler.calls.push(args);
    };
    mockMessageHandler.calls = [] as Array<unknown[]>;
    messageEmitter.on("message", mockMessageHandler);

    const newDbMessages = [
      {
        ROWID: 101,
        guid: "emptyGuid",
        text: null,
        handle_id: "+333",
        service: "iMessage",
        date: 1677900000,
        is_from_me: 0,
        chat_identifier: null,
        attachment_path: null,
        attachment_mime_type: null,
      },
    ];
    queryDbMock.mockResolvedValueOnce(newDbMessages);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(mockMessageHandler.calls.length).toBe(0);
  });

  it('should emit "error" if database query fails during polling', async () => {
    const mockErrorHandler = (...args: unknown[]) => {
      mockErrorHandler.calls.push(args);
    };
    mockErrorHandler.calls = [] as Array<unknown[]>;
    messageEmitter.on("error", mockErrorHandler);

    const dbError = new Error("DB Read Error");
    queryDbMock.mockRejectedValueOnce(dbError);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(mockErrorHandler.calls[0]?.[0]).toBe(dbError);
  });

  it("should stop polling when stopListening() is called", async () => {
    const initialCallCount = queryDbMock.calls.length;
    stopListening();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryDbMock.calls.length).toBe(initialCallCount);
  });

  it("should handle failure during initial MAX(ROWID) query and emit error", async () => {
    stopListening();
    queryDbMock.mockReset();
    const mockErrorHandler = (...args: unknown[]) => {
      mockErrorHandler.calls.push(args);
    };
    mockErrorHandler.calls = [] as Array<{ message?: string }[]>;
    const initError = new Error("Initial MAX_ID failed");
    queryDbMock.mockRejectedValueOnce(initError);
    const newEmitter = listen(1000);
    newEmitter.on("error", mockErrorHandler);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(mockErrorHandler.calls[0]?.[0]?.message).toContain(
      "Failed to initialize message listener",
    );
    newEmitter.removeAllListeners();
  });
});
