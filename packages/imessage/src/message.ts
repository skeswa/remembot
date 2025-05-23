/**
 * @fileoverview Polls the @remembot/imessage database for new messages and emits them as events.
 * Handles message conversion, deduplication, and error propagation.
 */

import { EventEmitter } from "events";
import os from "os";

import { queryDb, closeDbConnection } from "@/db";

/**
 * Represents a single iMessage message, including text, sender, group, and optional attachment.
 */
export interface Message {
  /** Date the message was sent or received. */
  readonly date: Date;
  /** Whether the message is sent by the current user. */
  readonly fromMe: boolean;
  /** Group chat ID, or null if not a group. */
  readonly group: string | null;
  /** Path to an attachment, if present. */
  readonly file?: string | null;
  /** MIME type of the attachment, if present. */
  readonly fileType?: string | null;
  /** Phone number, email, or contact name of the sender. */
  readonly handle: string;
  /** Unique message identifier. */
  readonly guid: string;
  /** Text content of the message, or null if not present. */
  readonly text: string | null;
}

let lastMessageRowId = 0;
let pollInterval: NodeJS.Timeout | null = null;
const messageEmitter = new EventEmitter();
let isListening = false;

/**
 * Begins polling the local @remembot/imessage database for new messages.
 * Emits 'message' events for each new message and 'error' events on failure.
 * @param interval Polling interval in milliseconds. Defaults to 1000ms.
 * @returns EventEmitter that emits 'message' and 'error' events.
 */
export function listen(interval: number = 1000): EventEmitter {
  if (isListening) {
    return messageEmitter;
  }

  isListening = true;
  lastMessageRowId = 0;

  fetchNewMessages()
    .then(() => {
      if (isListening) {
        pollInterval = setInterval(fetchNewMessages, Math.max(interval, 1000));
      }
    })
    .catch((err) => {
      console.error("Initial fetch failed in listen():", err);
      messageEmitter.emit("error", err);
      isListening = false;
    });

  return messageEmitter;
}

/**
 * Stops polling for new @remembot/imessage messages and clears the polling interval.
 */
export function stopListening(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isListening = false;
}

process.on("SIGINT", () => {
  stopListening();
  closeDbConnection();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopListening();
  closeDbConnection();
  process.exit(0);
});

/**
 * Helper to convert Apple CoreData timestamp to JavaScript Date.
 * @param appleTimestamp The timestamp from the iMessage database.
 * @returns The corresponding JavaScript Date.
 */
function convertAppleTime(appleTimestamp: number): Date {
  if (appleTimestamp === 0) return new Date(0);
  return new Date(Date.UTC(2001, 0, 1) + appleTimestamp * 1000);
}

/**
 * Raw message as returned from the @remembot/imessage database query.
 */
interface RawDbMessage {
  /** Path to the message's attachment, or null if none. */
  readonly attachment_mime_type: string | null;
  /** Path to the message's attachment, or null if none. */
  readonly attachment_path: string | null;
  /** Apple CoreData timestamp. */
  readonly date: number;
  /** Whether the message was sent by the user. */
  readonly is_from_me: number;
  /** Sender's handle (e.g., +15555555555). */
  readonly handle_id: string;
  /** Unique message identifier. */
  readonly guid: string;
  /** Group chat identifier, or null if not a group. */
  readonly chat_identifier: string | null;
  /** Service name. */
  readonly service: string;
  /** Text content of the message, or null if not present. */
  readonly text: string | null;
  /** Unique numeric ID for the message (ROWID). */
  readonly ROWID: number;
}

async function fetchNewMessages() {
  if (lastMessageRowId === 0) {
    const initQuery = `SELECT MAX(ROWID) as max_id FROM message;`;
    try {
      const result = await queryDb<{ max_id: number | null }>(initQuery);
      lastMessageRowId = result[0]?.max_id || 0;
    } catch (error) {
      console.error(
        "Failed to initialize last message ID for listening:",
        error,
      );
      messageEmitter.emit(
        "error",
        new Error("Failed to initialize message listener"),
      );
      stopListening();
      return;
    }
  }

  const query = `
    SELECT
        m.ROWID,
        m.guid,
        m.text,
        h.id AS handle_id,
        m.service,
        m.date,
        m.is_from_me,
        chat.chat_identifier,
        att.filename AS attachment_path,
        att.mime_type AS attachment_mime_type
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    LEFT JOIN message_attachment_join maj ON m.ROWID = maj.message_id
    LEFT JOIN attachment att ON maj.attachment_id = att.ROWID
    LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN chat ON cmj.chat_id = chat.ROWID
    WHERE m.ROWID > ? AND m.text IS NOT NULL OR att.filename IS NOT NULL
    ORDER BY m.ROWID ASC;
  `;

  try {
    const newMessagesRaw = await queryDb<RawDbMessage>(query, [
      lastMessageRowId,
    ]);

    if (newMessagesRaw.length > 0) {
      const processedGuids = new Set<string>();

      for (const rawMsg of newMessagesRaw) {
        if (processedGuids.has(rawMsg.guid)) continue;

        const message: Message = {
          guid: rawMsg.guid,
          text: rawMsg.text,
          handle: rawMsg.handle_id,
          group: rawMsg.chat_identifier,
          date: convertAppleTime(rawMsg.date),
          fromMe: !!rawMsg.is_from_me,
          file: rawMsg.attachment_path
            ? rawMsg.attachment_path.replace(/^~\//, os.homedir() + "/")
            : null,
          fileType: rawMsg.attachment_mime_type,
        };
        messageEmitter.emit("message", message);
        lastMessageRowId = Math.max(lastMessageRowId, rawMsg.ROWID);
        processedGuids.add(rawMsg.guid);
      }
    }
  } catch (error) {
    console.error("Error fetching new messages:", error);
    messageEmitter.emit("error", error);
  }
}
