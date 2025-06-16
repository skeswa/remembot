/**
 * @fileoverview Provides read-only access to the iMessage SQLite database.
 *
 * This module manages connections to the local iMessage database, allowing for
 * querying of messages, chats, and other iMessage data. The connection is
 * read-only to prevent accidental modifications to the database.
 *
 * The database connection is lazy-loaded when needed and cached for subsequent
 * queries. The connection can be explicitly closed using the `close()` method.
 */

import Database from "libsql";
import os from "os";
import path from "path";

/**
 * Provides read-only access to the iMessage SQLite database.
 *
 * This class manages a connection to the local iMessage database, allowing for
 * querying of messages, chats, and other iMessage data. The connection is
 * read-only to prevent accidental modifications to the database.
 *
 * The database connection is lazy-loaded when needed and cached for subsequent
 * queries. The connection can be explicitly closed using the `close()` method.
 *
 * @example
 * ```ts
 * const db = new MessageDatabase("/path/to/chat.db");
 * db.open();
 * const messages = db.query("SELECT * FROM message LIMIT 10");
 * db.close();
 * ```
 */
export class MessageDatabase {
  /**
   * Creates a new `MessageDatabase` instance with all default configuration.
   */
  static default(): MessageDatabase {
    const defaultDbPath = path.join(
      os.homedir(),
      "Library",
      "Messages",
      "chat.db",
    );

    return new MessageDatabase(defaultDbPath);
  }

  private db: Database.Database | null = null;

  /**
   * Creates a new MessageDatabase instance.
   *
   * @param dbPath The path to the iMessage database
   */
  constructor(private readonly dbPath: string) {}

  /**
   * Closes the iMessage database connection if open.
   * @throws {Error} If closing the connection fails.
   */
  public close(): void {
    if (!this.db) {
      return;
    }

    this.db.close();
    this.db = null;
  }

  /**
   * Opens a connection to the iMessage database.
   *
   * This method establishes a read-only connection to the SQLite database at
   * the configured path. The connection is cached and reused for subsequent
   * queries.
   *
   * @throws {Error} If the database cannot be opened, typically due to missing
   * Full Disk Access permissions.
   */
  public open(): void {
    if (this.db) {
      return;
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true });
    } catch (error) {
      throw new Error(
        `Failed to open iMessage DB ` +
          `- ensure this process has Full Disk Access ` +
          `(https://www.huntress.com/blog/ask-the-mac-guy-whats-the-deal-with-full-disk-access) ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Executes a SQL query against the iMessage database.
   * @param sql The SQL query string.
   * @param params Parameters for the SQL query.
   * @returns The query results.
   * @throws {Error} If the query fails to execute.
   */
  public query<T>(sql: string, params: unknown[] = []): T[] {
    try {
      return this.dbOrDie().prepare(sql).all(params) as T[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets the current database connection, throwing an error if not open.
   *
   * @returns The active database connection.
   * @throws {Error} If the database is not open.
   */
  private dbOrDie(): Database.Database {
    if (!this.db) {
      throw new Error("Database not open - call open() first");
    }

    return this.db;
  }
}
