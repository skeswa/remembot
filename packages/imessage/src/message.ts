/**
 * @fileoverview Polls the @remembot/imessage database for new messages and emits them as events.
 * Handles message conversion, deduplication, and error propagation.
 */

import type { Handle } from "./handle";
import type { AppleScriptExecutor } from "./applescript";

/**
 * Represents a file attachment to a message.
 */
export interface AttachedFile {
  /** Path to the file attachment. */
  readonly path: string;
  /** MIME type of the attachment. */
  readonly mimeType: string;
}

/**
 * Represents a single iMessage message, including text, sender, group, and optional attachment.
 */
export interface Message {
  /** File attachment, if present. */
  readonly attachedFile: AttachedFile | null;
  /** Date the message was sent or received. */
  readonly date: Date;
  /** Phone number, email, or contact name of the sender. */
  readonly handle: Handle;
  /** Whether the message is sent by the current user. */
  readonly isFromMe: boolean;
  /** Group chat ID, or null if not a group. */
  readonly group: string | null;
  /** Unique message identifier. */
  readonly guid: string;
  /** Text content of the message, or null if not present. */
  readonly text: string | null;
}

/**
 * Raw message as returned from the @remembot/imessage database query.
 */
export interface RawMessage {
  /** Path to the message's attachment, or null if none. */
  readonly attachmentMimeType: string | null;
  /** Path to the message's attachment, or null if none. */
  readonly attachmentPath: string | null;
  /** Group chat identifier, or null if not a group. */
  readonly chatId: string | null;
  /** Apple CoreData timestamp. */
  readonly date: number;
  /** Whether the message was sent by the user. */
  readonly isFromMe: number;
  /** Sender's handle (e.g., +15555555555). */
  readonly handleId: string;
  /** Unique message identifier. */
  readonly guid: string;
  /** Unique numeric ID for the message (ROWID). */
  readonly rowId: number;
  /** Service name. */
  readonly service: string;
  /** Text content of the message, or null if not present. */
  readonly text: string | null;
}

/**
 * Sends a file to the specified handle.
 * @param handle The user or group to send the file to.
 * @param filePath The full path of the file to be sent.
 * @returns A promise that resolves when the file is sent.
 */
export async function sendFileMessage(
  executor: AppleScriptExecutor,
  handle: Handle,
  filePath: string
): Promise<void> {
  const sanitizedHandleId = handle.id.replace(/"/g, '\\"');
  const sanitizedFilePath = filePath.replace(/"/g, '\\"');

  const script = `
tell application "Messages"
  set targetBuddy to "${sanitizedHandleId}"
  set theFile to POSIX file "${sanitizedFilePath}"
  set targetService to 1st service whose service type = iMessage
	set theBuddy to buddy targetBuddy of targetService
  send theFile to theBuddy
end tell
`;

  try {
    await executor.execute(script);
  } catch (err: unknown) {
    throw new Error(`Failed to send file message to ${handle.id}: ${err}`);
  }
}

/**
 * Sends a message to the specified handle.
 * @param handle The user or group to send the message to.
 * @param text The content of the message to be sent.
 * @returns A promise that resolves when the message is sent.
 */
export async function sendMessage(
  executor: AppleScriptExecutor,
  handle: Handle,
  text: string
): Promise<void> {
  const sanitizedHandleId = handle.id.replace(/"/g, '\\"');
  const sanitizedText = text.replace(/"/g, '\\"');

  const script = `
tell application "Messages"
	set targetBuddy to "${sanitizedHandleId}"
	set textMessage to "${sanitizedText}"
	set targetService to 1st service whose service type = iMessage
	set theBuddy to buddy targetBuddy of targetService
	send textMessage to theBuddy
end tell
  `;

  try {
    await executor.execute(script);
  } catch (error) {
    console.error(`Failed to send message to ${handle.id}:`, error);
    throw new Error(`Failed to send message to ${handle.id}: ${error}`);
  }
}
