/**
 * @fileoverview Main entry point for @remembot/imessage automation and querying utilities.
 * Provides functions to send messages/files, look up contacts, and listen for new messages.
 * Re-exports types for convenience.
 */

export { AppleScriptExecutor } from "./applescript";
export { listChats } from "./chat";
export type { Chat } from "./chat";
export { applyNamesToHandles } from "./handle";
export type { Handle } from "./handle";
export { MessageDatabase } from "./message-database";
export { MessageListener } from "./message-listener";
export { sendFileMessage, sendMessage } from "./message";
export type { AttachedFile, Message } from "./message";
