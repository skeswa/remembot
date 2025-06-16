/**
 * @fileoverview Polls the @remembot/imessage database for new messages and
 * emits them as events.
 */

import { EventEmitter } from "events";
import pino from "pino";

import { MessageDatabase } from "./message-database";
import type { Message, RawMessage } from "./message";
import { convertAppleTime } from "./helpers";

/**
 * Class responsible for polling and emitting iMessage events.
 */
export class MessageListener {
  /**
   * The last message row ID that we have processed.
   *
   * We use -1 to mean "we have not initialized yet".
   */
  private lastMessageRowId = -1;

  private readonly eventEmitter = new EventEmitter();
  private isListening: boolean = false;
  private pollingTimeout: NodeJS.Timeout | null = null;

  /**
   * Creates a new message listener.
   *
   * @param db the message database to listen to
   * @param logger the logger to use
   * @param pollIntervalMs the interval in milliseconds to poll for new messages
   */
  constructor(
    private readonly db: MessageDatabase,
    private readonly logger: pino.Logger,
    private readonly pollIntervalMs: number
  ) {}

  /**
   * Disposes of the message listener and stops listening for new messages.
   */
  dispose(): void {
    this.stopListening();
    this.eventEmitter.removeAllListeners();

    this.logger.info("Message listener disposed");
  }

  /**
   * Adds a listener for a specific event.
   *
   * @param event event kind to listen for
   * @param listener function invoked when the event occurs
   */
  public on(event: "message", listener: (message: Message) => void): void;
  public on(event: "error", listener: (error: unknown) => void): void;
  public on(
    event: "message" | "error",
    listener: ((message: Message) => void) | ((error: unknown) => void)
  ): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Begins polling the local @remembot/imessage database for new messages.
   *
   * Emits 'message' events for each new message and 'error' events on failure.
   */
  public startListening(): void {
    if (this.isListening) {
      return;
    }

    try {
      const result = this.db.query<{ maxId?: number }>(
        "SELECT MAX(ROWID) as maxId FROM message;"
      );

      const maxId = result[0]?.maxId;

      if (!maxId) {
        this.logger.warn("No messages found in the database");

        this.lastMessageRowId = 0;
      } else {
        this.logger.debug("Initializing last message ID to %d", maxId);

        this.lastMessageRowId = maxId;
      }
    } catch (err: unknown) {
      this.logger.error(
        { err },
        "Failed to initialize last message ID for listening"
      );
      this.eventEmitter.emit(
        "error",
        new Error("Failed to initialize message listener")
      );

      return;
    }

    this.isListening = true;

    this.pollForAndEmitNewMessages();

    this.logger.info("Started listening for new messages");
  }

  /**
   * Stops polling for new @remembot/imessage messages and clears the polling
   * interval.
   */
  public stopListening(): void {
    this.isListening = false;

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }

    this.logger.info("Stopped listening for new messages");
  }

  /**
   * Emits a 'message' event for each new message in the database.
   */
  private emitNewMessages(): void {
    const newRawMessages = this.listNewRawMessages();

    for (const rawMsg of newRawMessages) {
      const message = convertRawMessage(rawMsg);
      this.eventEmitter.emit("message", message);
      this.lastMessageRowId = Math.max(this.lastMessageRowId, rawMsg.rowId);
    }
  }

  /**
   * Lists all new raw messages from the database.
   *
   * @returns A list of raw messages
   */
  private listNewRawMessages(): RawMessage[] {
    return this.db.query<RawMessage>(
      `
SELECT
  m.ROWID AS rowId,
  m.guid,
  m.text,
  h.id AS handleId,
  m.service,
  m.date,
  m.is_from_me AS isFromMe,
  chat.chat_identifier AS chatId,
  att.filename AS attachmentPath,
  att.mime_type AS attachmentMimeType
FROM message m
LEFT JOIN handle h ON m.handle_id = h.ROWID
LEFT JOIN message_attachment_join maj ON m.ROWID = maj.message_id
LEFT JOIN attachment att ON maj.attachment_id = att.ROWID
LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
LEFT JOIN chat ON cmj.chat_id = chat.ROWID
WHERE m.ROWID > ? AND (m.text IS NOT NULL OR att.filename IS NOT NULL)
ORDER BY m.ROWID ASC;`,
      [this.lastMessageRowId]
    );
  }

  /**
   * Polls for new messages and emits them as events.
   */
  private pollForAndEmitNewMessages(): void {
    const startTime = performance.now();

    try {
      this.emitNewMessages();
    } catch (err: unknown) {
      this.logger.error({ err }, "Failed to emit new messages");
      this.eventEmitter.emit("error", err);
    }

    const elapsedTime = performance.now() - startTime;

    const remainingTime = this.pollIntervalMs - elapsedTime;

    if (this.isListening) {
      this.pollingTimeout = setTimeout(
        () => this.pollForAndEmitNewMessages(),
        remainingTime
      );
    }
  }
}

/**
 * Converts a raw message from the @remembot/imessage database to a `Message`.
 *
 * @param rawMsg The raw message from the @remembot/imessage database.
 * @returns The converted Message object.
 */
function convertRawMessage(rawMsg: RawMessage): Message {
  return {
    attachedFile: rawMsg.attachmentPath
      ? {
          path: rawMsg.attachmentPath,
          mimeType: rawMsg.attachmentMimeType || "application/octet-stream",
        }
      : null,
    date: convertAppleTime(rawMsg.date),
    group: rawMsg.chatId,
    guid: rawMsg.guid,
    handle: { id: rawMsg.handleId, name: null },
    isFromMe: !!rawMsg.isFromMe,
    text: rawMsg.text,
  };
}
