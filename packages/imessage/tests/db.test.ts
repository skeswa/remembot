import { describe, it, expect, beforeEach, mock } from "bun:test";
import sqlite3 from "sqlite3";
import os from "os";
import path from "path";

import {
  queryDb,
  closeDbConnection,
  _getDbConnectionInstance_TEST_ONLY,
  _setDbConnectionInstance_TEST_ONLY,
} from "@/db";

interface MockDbInstance {
  all: (...args: unknown[]) => void;
  close: (...args: unknown[]) => void;
  on: (...args: unknown[]) => void;
  _allImpl: (
    _sql: string,
    _params: unknown[],
    cb: (err: Error | null, rows: unknown[]) => void,
  ) => void;
  _closeImpl: (cb: (err: Error | null) => void) => void;
  _onImpl: (...args: unknown[]) => void;
  mockClear: () => void;
}

interface MockSqlite3Database {
  (...args: unknown[]): MockDbInstance;
  _impl?: ((...args: unknown[]) => MockDbInstance) | undefined;
  mockClear: () => void;
  mockImplementationOnce: (fn: (...args: unknown[]) => MockDbInstance) => void;
}

let mockDbInstance: MockDbInstance;
let mockSqlite3Database: MockSqlite3Database;
mock.module("sqlite3", () => {
  mockDbInstance = {
    all: (...args: Parameters<MockDbInstance["all"]>) =>
      mockDbInstance._allImpl(
        ...(args as Parameters<MockDbInstance["_allImpl"]>),
      ),
    close: (...args: Parameters<MockDbInstance["close"]>) =>
      mockDbInstance._closeImpl(
        ...(args as Parameters<MockDbInstance["_closeImpl"]>),
      ),
    on: (...args: Parameters<MockDbInstance["on"]>) =>
      mockDbInstance._onImpl(...args),
    _allImpl: () => {},
    _closeImpl: () => {},
    _onImpl: () => {},
    mockClear: () => {
      mockDbInstance._allImpl = () => {};
      mockDbInstance._closeImpl = () => {};
      mockDbInstance._onImpl = () => {};
    },
  };
  mockSqlite3Database = function (...args: unknown[]) {
    if (mockSqlite3Database._impl) return mockSqlite3Database._impl(...args);
    return mockDbInstance;
  } as MockSqlite3Database;
  mockSqlite3Database._impl = undefined;
  mockSqlite3Database.mockClear = () => {
    mockSqlite3Database._impl = undefined;
  };
  mockSqlite3Database.mockImplementationOnce = (
    fn: (...args: unknown[]) => MockDbInstance,
  ) => {
    mockSqlite3Database._impl = fn;
  };
  return {
    Database: mockSqlite3Database,
    OPEN_READONLY: Symbol.for("OPEN_READONLY"),
  };
});

// Manual mock for os
let homedirMock: unknown;
mock.module("os", () => {
  homedirMock = () => "/mock/home";
  return {
    ...os,
    homedir: homedirMock,
  };
});

const DB_PATH = path.join("/mock/home", "Library", "Messages", "chat.db");

describe("db utility", () => {
  beforeEach(() => {
    mockSqlite3Database.mockClear();
    mockDbInstance.mockClear();
    _setDbConnectionInstance_TEST_ONLY(null);
  });

  describe("getDbConnection (via queryDb)", () => {
    it("should create a new database connection if one does not exist", () => {
      queryDb("SELECT 1").catch(() => {});
      expect(mockSqlite3Database).toHaveBeenCalledTimes(1);
      expect(mockSqlite3Database).toHaveBeenCalledWith(
        DB_PATH,
        sqlite3.OPEN_READONLY,
        expect.any(Function),
      );
    });

    it("should reuse an existing database connection", () => {
      queryDb("SELECT 1").catch(() => {});
      queryDb("SELECT 2").catch(() => {});
      expect(mockSqlite3Database).toHaveBeenCalledTimes(1);
    });

    it("should handle connection error and throw", () => {
      mockSqlite3Database.mockImplementationOnce((...args: unknown[]) => {
        const [, , callback] = args;
        if (typeof callback === "function")
          (callback as (err: Error | null) => void)(
            new Error("Connection failed"),
          );
        return mockDbInstance;
      });
      expect(() => queryDb("SELECT 1")).toThrow(
        "Failed to connect to iMessage DB: Connection failed",
      );
      mockSqlite3Database.mockClear();
    });
  });

  describe("queryDb", () => {
    it("should execute a query and return results", async () => {
      const sql = "SELECT * FROM test WHERE id = ?";
      const params = [1];
      const expectedRows = [{ id: 1, name: "Test" }];
      mockDbInstance._allImpl = (
        _sql: string,
        _params: unknown[],
        cb: (err: Error | null, rows: unknown[]) => void,
      ) => cb(null, expectedRows);

      const result = await queryDb(sql, params);

      expect(result).toEqual(expectedRows);
    });

    it("should reject with an error if query execution fails", async () => {
      const sql = "SELECT * FROM test";
      const errorMessage = "Query failed";
      mockDbInstance._allImpl = (
        _sql: string,
        _params: unknown[],
        cb: (err: Error | null, rows: unknown[]) => void,
      ) => cb(new Error(errorMessage), []);

      await expect(queryDb(sql)).rejects.toThrow(
        `Database query failed: ${errorMessage}`,
      );
    });
  });

  describe("closeDbConnection", () => {
    it("should close the database connection if it exists and nullify instance", (done) => {
      queryDb("SELECT 1").catch(() => {});
      mockDbInstance._closeImpl = (cb: (err: Error | null) => void) => {
        cb(null);
        expect(_getDbConnectionInstance_TEST_ONLY()).toBeNull();
        done();
      };
      closeDbConnection();
    });

    it("should do nothing if connection does not exist", () => {
      closeDbConnection();
      // No error expected
    });

    it("should handle error during close and not nullify instance", (done) => {
      queryDb("SELECT 1").catch(() => {});
      const origError = console.error;
      let errorCalled = false;
      console.error = () => {
        errorCalled = true;
      };
      const closeError = new Error("Close failed");
      mockDbInstance._closeImpl = (cb: (err: Error | null) => void) => {
        cb(closeError);
        expect(errorCalled).toBe(true);
        expect(_getDbConnectionInstance_TEST_ONLY()).not.toBeNull();
        console.error = origError;
        done();
      };
      closeDbConnection();
    });
  });
});

// NOTE: To fully test db.ts, especially the singleton connection `db` variable,
// it needs to be exportable or have its state testable.
// I've assumed `_getDbConnectionInstance_TEST_ONLY` and `_setDbConnectionInstance_TEST_ONLY` are helper exports for testing.
// If not, `getDbConnection` would need to be refactored or tested more indirectly.
