import { describe, expect, test, mock } from "bun:test";
import { MessageDatabase } from "./message-database";
import os from "os";
import path from "path";

mock.module("libsql", () => {
  const mockDb = {
    close: mock(() => {}),
    prepare: mock((sql: string) => ({
      all: mock((_: unknown[]) => {
        if (sql.includes("error")) {
          throw new Error("Test database error");
        }
        return [{ id: 1, text: "Test message" }];
      }),
    })),
  };

  return {
    default: mock((dbPath: string, _: { readonly: boolean }) => {
      if (dbPath.includes("error")) {
        throw new Error("Failed to open database");
      }
      return mockDb;
    }),
  };
});

describe("MessageDatabase", () => {
  describe("default()", () => {
    test("should create instance with default path", () => {
      const db = MessageDatabase.default();
      const expectedPath = path.join(
        os.homedir(),
        "Library",
        "Messages",
        "chat.db",
      );

      expect(db).toBeInstanceOf(MessageDatabase);
      expect(db.dbPath).toBe(expectedPath);
    });
  });

  describe("open()", () => {
    test("should open database connection successfully", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      expect(() => db.open()).not.toThrow();
    });

    test("should not open connection if already open", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      db.open();
      expect(() => db.open()).not.toThrow();
    });

    test("should throw error when database cannot be opened", () => {
      const db = new MessageDatabase("/path/to/error.db");
      expect(() => db.open()).toThrow("Failed to open iMessage DB");
    });
  });

  describe("close()", () => {
    test("should close database connection", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      db.open();
      expect(() => db.close()).not.toThrow();
    });

    test("should not throw when closing already closed connection", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      expect(() => db.close()).not.toThrow();
    });
  });

  describe("query()", () => {
    test("should execute query successfully", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      db.open();
      const result = db.query("SELECT * FROM message");
      expect(result).toEqual([{ id: 1, text: "Test message" }]);
    });

    test("should throw error when database is not open", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      expect(() => db.query("SELECT * FROM message")).toThrow(
        "Database not open",
      );
    });

    test("should throw error when query fails", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      db.open();
      expect(() => db.query("error")).toThrow("Test database error");
    });

    test("should execute query with parameters", () => {
      const db = new MessageDatabase("/path/to/chat.db");
      db.open();
      const result = db.query("SELECT * FROM message WHERE id = ?", [1]);
      expect(result).toEqual([{ id: 1, text: "Test message" }]);
    });
  });
});
