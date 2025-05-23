import { describe, it, expect, beforeEach, mock } from "bun:test";

import * as imessage from "@/index";
import { EventEmitter } from "events";
import type { Handle, Chat, Message } from "@/types";

interface BaseMock {
  calls: unknown[][];
  mockClear: () => void;
}

interface PromiseMock<T = unknown> extends BaseMock {
  mockResolvedValue: (val: T) => void;
  mockRejectedValue: (err: unknown) => void;
  _resolve: T | undefined;
  _reject: unknown;
  fn: (...args: unknown[]) => Promise<T>;
}

interface SyncMock<T = unknown> extends BaseMock {
  mockReturnValue: (val: T) => void;
  _return: T | undefined;
  fn: (...args: unknown[]) => T;
}

interface VoidMock extends BaseMock {
  fn: (...args: unknown[]) => void;
}

let executeAppleScriptMock: PromiseMock;
let handleForNameMock: PromiseMock;
let nameForHandleMock: PromiseMock;
let getRecentChatsMock: PromiseMock;
let listenMock: SyncMock<EventEmitter>;
let stopListeningMock: VoidMock;
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
mock.module("@/contact", () => {
  handleForNameMock = {
    calls: [],
    mockClear: () => {
      handleForNameMock!.calls = [];
    },
    mockResolvedValue: (val: unknown) => {
      handleForNameMock!._resolve = val;
      handleForNameMock!._reject = undefined;
    },
    mockRejectedValue: (err: unknown) => {
      handleForNameMock!._reject = err;
      handleForNameMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    async fn(...args: unknown[]) {
      handleForNameMock!.calls.push(args);
      if (handleForNameMock!._reject !== undefined)
        throw handleForNameMock!._reject;
      return handleForNameMock!._resolve;
    },
  };
  nameForHandleMock = {
    calls: [],
    mockClear: () => {
      nameForHandleMock!.calls = [];
    },
    mockResolvedValue: (val: unknown) => {
      nameForHandleMock!._resolve = val;
      nameForHandleMock!._reject = undefined;
    },
    mockRejectedValue: (err: unknown) => {
      nameForHandleMock!._reject = err;
      nameForHandleMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    async fn(...args: unknown[]) {
      nameForHandleMock!.calls.push(args);
      if (nameForHandleMock!._reject !== undefined)
        throw nameForHandleMock!._reject;
      return nameForHandleMock!._resolve;
    },
  };
  return {
    handleForName: handleForNameMock.fn,
    nameForHandle: nameForHandleMock.fn,
  };
});
mock.module("@/chat", () => {
  getRecentChatsMock = {
    calls: [],
    mockClear: () => {
      getRecentChatsMock!.calls = [];
    },
    mockResolvedValue: (val: unknown) => {
      getRecentChatsMock!._resolve = val;
      getRecentChatsMock!._reject = undefined;
    },
    mockRejectedValue: (err: unknown) => {
      getRecentChatsMock!._reject = err;
      getRecentChatsMock!._resolve = undefined;
    },
    _resolve: undefined,
    _reject: undefined,
    async fn(...args: unknown[]) {
      getRecentChatsMock!.calls.push(args);
      if (getRecentChatsMock!._reject !== undefined)
        throw getRecentChatsMock!._reject;
      return getRecentChatsMock!._resolve;
    },
  };
  return { getRecentChats: getRecentChatsMock.fn };
});
mock.module("@/message", () => {
  listenMock = {
    calls: [],
    mockClear: () => {
      listenMock!.calls = [];
    },
    mockReturnValue: (val: EventEmitter) => {
      listenMock!._return = val;
    },
    _return: undefined,
    fn: (...args: unknown[]) => {
      listenMock!.calls.push(args);
      return listenMock!._return!;
    },
  };
  stopListeningMock = {
    calls: [],
    mockClear: () => {
      stopListeningMock!.calls = [];
    },
    fn: (...args: unknown[]) => {
      stopListeningMock!.calls.push(args);
    },
  };
  return { listen: listenMock.fn, stopListening: stopListeningMock.fn };
});

describe("iMessage API (index.ts)", () => {
  const mockEmitter = new EventEmitter();

  beforeEach(() => {
    executeAppleScriptMock.mockClear();
    handleForNameMock.mockClear();
    nameForHandleMock.mockClear();
    getRecentChatsMock.mockClear();
    listenMock.mockClear();
    listenMock.mockReturnValue(mockEmitter);
    stopListeningMock.mockClear();
    mockEmitter.removeAllListeners();
  });

  describe("send", () => {
    it("should call executeAppleScript with correct send message script", async () => {
      const handle: Handle = "+12345";
      const text = "Hello there!";
      executeAppleScriptMock.mockResolvedValue(undefined);
      await imessage.send(handle, text);
      expect(executeAppleScriptMock.calls.length).toBe(1);
      expect((executeAppleScriptMock.calls[0]![0] as string).toString()).toContain(
        `send "${text}" to buddy "${handle}"`,
      );
    });

    it("should throw if handle or text is missing for send", async () => {
      await expect(imessage.send("", "text")).rejects.toThrow(
        "Handle and text must be provided.",
      );
      await expect(imessage.send("handle", "")).rejects.toThrow(
        "Handle and text must be provided.",
      );
    });
  });

  describe("sendFile", () => {
    it("should call executeAppleScript with correct send file script", async () => {
      const handle: Handle = "group@example.com";
      const filePath = "/path/to/file.png";
      executeAppleScriptMock.mockResolvedValue(undefined);
      await imessage.sendFile(handle, filePath);
      expect(executeAppleScriptMock.calls.length).toBe(1);
      expect((executeAppleScriptMock.calls[0]![0] as string).toString()).toContain(
        `send POSIX file "${filePath}" to buddy "${handle}"`,
      );
    });

    it("should throw if handle or filePath is missing for sendFile", async () => {
      await expect(imessage.sendFile("", "/path")).rejects.toThrow(
        "Handle and filePath must be provided.",
      );
      await expect(imessage.sendFile("handle", "")).rejects.toThrow(
        "Handle and filePath must be provided.",
      );
    });
  });

  describe("handleForName", () => {
    it("should call contact.handleForName and return its result", async () => {
      const name = "John Doe";
      const expectedHandle: Handle = "johndoe@example.com";
      handleForNameMock.mockResolvedValue(expectedHandle);
      const result = await imessage.handleForName(name);
      expect(handleForNameMock.calls[0]![0]).toBe(name);
      expect(result).toBe(expectedHandle);
    });
  });

  describe("nameForHandle", () => {
    it("should call contact.nameForHandle and return its result", async () => {
      const handle: Handle = "johndoe@example.com";
      const expectedName = "John Doe";
      nameForHandleMock.mockResolvedValue(expectedName);
      const result = await imessage.nameForHandle(handle);
      expect(nameForHandleMock.calls[0]![0]).toBe(handle);
      expect(result).toBe(expectedName);
    });
  });

  describe("getRecentChats", () => {
    it("should call chat.getRecentChats and return its result", async () => {
      const limit = 5;
      const expectedChats: Chat[] = [
        {
          id: "chat1",
          displayName: "Chat 1",
          lastMessage: null,
          participants: [],
        },
      ];
      getRecentChatsMock.mockResolvedValue(expectedChats);
      const result = await imessage.getRecentChats(limit);
      expect(getRecentChatsMock.calls[0]![0]).toBe(limit);
      expect(result).toBe(expectedChats);
    });
  });

  describe("listen", () => {
    it("should call message.listen and return its EventEmitter", () => {
      const interval = 1500;
      listenMock.mockReturnValue(mockEmitter);
      const emitter = imessage.listen(interval);
      expect(listenMock.calls[0]![0]).toBe(interval);
      expect(emitter).toBe(mockEmitter);
    });
  });

  describe("stopListening", () => {
    it("should call message.stopListening", () => {
      imessage.stopListening();
      expect(stopListeningMock.calls.length).toBe(1);
    });
  });

  it("should re-export types correctly", () => {
    const msg: Message = {
      guid: "1",
      text: "hi",
      handle: "h",
      group: null,
      date: new Date(),
      fromMe: false,
    };
    const cht: Chat = {
      id: "c1",
      displayName: "c",
      lastMessage: msg,
      participants: ["h"],
    };
    const hnd: Handle = "handle123";
    expect(msg).toBeDefined();
    expect(cht).toBeDefined();
    expect(hnd).toBeDefined();
  });
});
