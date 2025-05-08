import { EventEmitter } from 'events';

declare module 'better-osa-imessage' {
  /**
   * Represents the data payload emitted for the 'message' event.
   */
  export interface IMessageEventData {
    /** The message content text. */
    text: string | null;
    /** The sender's handle/phone number/email or the handle of the sender in a group chat. */
    handle: string;
    /** The group chat identifier (e.g., 'chat0000...'), or null if not a group message. */
    group: string | null;
    /** Date and time when the message was sent. */
    date: Date;
    /** Whether the message was sent by the current user. */
    fromMe: boolean;
    /** Unique identifier for the message. */
    guid: string;
    /** Full path to the attached file, or null if no file. */
    file: string | null;
    /** MIME type of the attached file, or null if no file. */
    fileType: string | null;
  }

  /**
   * Sends a message to the specified handle.
   * @param handle - The user or group to send the message to (phone number, email, or group chat id).
   * @param text - The content of the message to be sent.
   * @returns A promise that resolves when the message is sent, and rejects if it fails.
   */
  export function send(handle: string, text: string): Promise<void>;

  /**
   * Sends a file to the specified handle.
   * @param handle - The user or group to send the file to (phone number, email, or group chat id).
   * @param filepath - The full path of the file to be sent.
   * @returns A promise that resolves when the file is sent, and rejects if it fails.
   */
  export function sendFile(handle: string, filepath: string): Promise<void>;

  /**
   * Begins polling the local iMessage database for new messages.
   * @param interval - The rate in milliseconds at which the database is polled. Defaults to 1000ms.
   * @returns An EventEmitter that emits 'message' events with IMessageEventData payload.
   */
  export function listen(interval?: number): TypedEventEmitter<IMessageEventData>;

  /**
   * Gets the handle (phone number/email) for a given contact name.
   * @param name - The full name of the desired contact, as displayed in Messages.app.
   * @returns A promise that resolves with the handle of the contact, or rejects if not found.
   */
  export function handleForName(name: string): Promise<string>;

  /**
   * Gets the name associated with a given handle.
   * @param handle - The handle (phone number/email) of a contact.
   * @returns A promise that resolves with the full name of the contact, or rejects if not found.
   */
  export function nameForHandle(handle: string): Promise<string>;

  /**
   * Gets recent chats.
   * @param limit - Amount of recent chats to return. Defaults to 10.
   * @returns A promise that resolves with an array of recent chats (structure not fully defined in docs).
   */
  export function getRecentChats(limit?: number): Promise<any[]>; // Structure unclear from docs

  // Helper type for EventEmitter with typed events
  interface TypedEventEmitter<T> extends EventEmitter {
    on(event: 'message', listener: (data: T) => void): this;
    // Add other event types if the library emits them
  }
} 