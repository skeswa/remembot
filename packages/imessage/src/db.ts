/**
 * @fileoverview Utilities for connecting to and querying the @remembot/imessage SQLite database on macOS.
 * Handles connection management, query execution, and safe closing of the database.
 */

import os from "os";
import path from "path";
import sqlite3 from "sqlite3";

const DB_PATH = path.join(os.homedir(), "Library", "Messages", "chat.db");

let db: sqlite3.Database | null = null;

/**
 * Returns a singleton connection to the @remembot/imessage database, opening it if necessary.
 * Throws an error if the connection fails.
 * @returns The sqlite3.Database instance.
 */
function getDbConnection(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        throw new Error(`Failed to connect to iMessage DB - ensure this process has Full Disk Access (https://www.huntress.com/blog/ask-the-mac-guy-whats-the-deal-with-full-disk-access): ${err.message}`);
      }
    });
  }

  return db;
}

/**
 * Returns a singleton connection to the iMessage database, opening it if necessary.
 * Throws an error if the connection fails.
 * @returns The sqlite3.Database instance.
 */
export function closeDbConnection(): void {
  if (db) {
    db.close((err) => {
      if (err) {
        throw new Error(`Failed to close iMessage DB: ${err.message}`);
      } else {
        db = null;
      }
    });
  }
}

/**
 * Closes the iMessage database connection if open.
 * Logs errors if closing fails.
 */

/**
 * Executes a SQL query against the iMessage database.
 * @param sql The SQL query string.
 * @param params Parameters for the SQL query.
 * @returns A promise that resolves with the query results.
 */
export function queryDb<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const database = getDbConnection();
    database.all(sql, params, (err, rows: T[]) => {
      if (err) {
        console.error("Error executing query:", sql, params, err.message);
        reject(new Error(`Database query failed: ${err.message}`));
      } else {
        resolve(rows);
      }
    });
  });
}

process.on("exit", () => {
  closeDbConnection();
});

// --- For Testing Purposes ---
/**
 * Returns the current database connection instance for testing purposes only.
 * @returns The sqlite3.Database instance or null if not connected.
 */
export function _getDbConnectionInstance_TEST_ONLY(): sqlite3.Database | null {
  return db;
}

/**
 * Sets the database connection instance for testing purposes only.
 * @param newInstance The new sqlite3.Database instance or null.
 */
export function _setDbConnectionInstance_TEST_ONLY(
  newInstance: sqlite3.Database | null,
): void {
  db = newInstance;
}
