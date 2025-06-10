/**
 * @fileoverview Main entry point for @remembot/imessage automation and querying utilities.
 * Provides functions to send messages/files, look up contacts, and listen for new messages.
 * Re-exports types for convenience.
 */

import { EventEmitter } from "events";

import { executeAppleScript } from "@/applescript";
import * as contact from "@/contact";
import type { Handle } from "@/handle";
import type { Chat } from "@/chat";
import type { Message } from "@/message";
import * as message from "@/message";

const SEND_MESSAGE_APPLESCRIPT = (target: Handle, message: string) => `
tell application "Messages"
  set targetBuddy to "${target.id}"
  set targetService to id of 1st account whose service type = iMessage
  set textMessage to "${message}"
  set theBuddy to buddy targetBuddy of service targetService
  send textMessage to theBuddy
end tell
`;

const SEND_FILE_APPLESCRIPT = (target: Handle, filePath: string) => `
tell application "Messages"
  set targetBuddy to "${target.id}"
  set targetService to id of 1st account whose service type = iMessage
  set theFile to POSIX file "${filePath}"
  set theBuddy to buddy targetBuddy of service targetService
  send theFile to theBuddy
end tell
`;

/**
 * Sends a message to the specified handle.
 * @param handle The user or group to send the message to.
 * @param text The content of the message to be sent.
 * @returns A promise that resolves when the message is sent.
 */
export async function send(handle: Handle, text: string): Promise<void> {
  if (!handle || !text) {
    throw new Error("Handle and text must be provided.");
  }
  const script = SEND_MESSAGE_APPLESCRIPT(handle, text.replace(/"/g, '\\"'));
  try {
    await executeAppleScript(script);
  } catch (error) {
    console.error(`Failed to send message to ${handle.id}:`, error);
    throw error;
  }
}

/**
 * Sends a file to the specified handle.
 * @param handle The user or group to send the file to.
 * @param filePath The full path of the file to be sent.
 * @returns A promise that resolves when the file is sent.
 */
export async function sendFile(
  handle: Handle,
  filePath: string
): Promise<void> {
  if (!handle || !filePath) {
    throw new Error("Handle and filePath must be provided.");
  }
  const script = SEND_FILE_APPLESCRIPT(handle, filePath.replace(/"/g, '\\"'));
  try {
    await executeAppleScript(script);
  } catch (error) {
    console.error(`Failed to send file to ${handle.id}:`, error);
    throw error;
  }
}

/**
 * Get a handle for a given name.
 * @param name The full name of the desired contact, as displayed in `Messages.app`.
 * @returns A promise that resolves with the `handle` of the contact, or null if not found.
 */
export async function handleForName(name: string): Promise<Handle | null> {
  return contact.handleForName(name);
}

/**
 * Get the name associated with a given handle.
 * @param handle The handle of a contact.
 * @returns A promise that resolves with the full name of the desired contact, as displayed in `Messages.app`.
 */
export async function nameForHandle(handle: Handle): Promise<string | null> {
  return contact.nameForHandle(handle);
}

/**
 * Begins polling the local @remembot/imessage database for new messages.
 * @param interval Polling interval in milliseconds. Defaults to 1000ms.
 * @returns EventEmitter that emits 'message' and 'error' events.
 */
export function listen(interval?: number): EventEmitter {
  return message.listen(interval);
}

/**
 * Stops polling for new iMessages.
 */
export function stopListening(): void {
  message.stopListening();
}

export { listChats } from "@/chat";
export { applyNamesToHandles } from "@/handle";

export type { Message, Chat, Handle };
