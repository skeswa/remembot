/**
 * @fileoverview Provides utilities to query recent chats and their participants
 * from the iMessage database.
 *
 * Handles chat metadata, last message, and participant resolution.
 */

import os from "os";

import { queryDb } from "@/db";
import type { Handle } from "@/handle";
import type { Message } from "@/message";

/**
 * Represents a chat (group or 1:1) in iMessage, including participants and last message.
 */
export interface Chat {
  /** Name of the chat (e.g., contact name or group name). */
  readonly displayName: string;
  /** Unique chat ID (group or 1:1). */
  readonly id: string;
  /** Last message in the chat, or null if none. */
  readonly lastMessage: Message | null;
  /** Handles of participants. */
  readonly participants: readonly string[];
  /** Optional: number of unread messages. */
  readonly unreadCount?: number;
}

/**
 * Gets recent chats from the iMessage database, including their last message and participants.
 *
 * @param limit The number of recent chats to return. Defaults to 10.
 * @returns A promise that resolves with an array of chats.
 */
export async function getRecentChats(limit: number = 10): Promise<Chat[]> {
  const query = `
    SELECT
      c.ROWID AS chat_id,
      c.chat_identifier,
      c.display_name,
      c.service_name,
      m.text AS last_message_text,
      m.date AS last_message_date,
      m.is_from_me AS last_message_is_from_me,
      m.guid AS last_message_guid,
      h_sender.id AS last_message_handle_id,
      (SELECT filename FROM attachment WHERE ROWID = (SELECT attachment_id FROM message_attachment_join WHERE message_id = m.ROWID LIMIT 1)) AS attachment_path,
      (SELECT mime_type FROM attachment WHERE ROWID = (SELECT attachment_id FROM message_attachment_join WHERE message_id = m.ROWID LIMIT 1)) AS attachment_mime_type
    FROM chat c
    JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
    JOIN message m ON cmj.message_id = m.ROWID
    LEFT JOIN handle h_sender ON m.handle_id = h_sender.ROWID
    WHERE m.ROWID = (
      SELECT MAX(message.ROWID)
      FROM message
      JOIN chat_message_join AS latest_cmj ON message.ROWID = latest_cmj.message_id
      WHERE latest_cmj.chat_id = c.ROWID
    )
    ORDER BY m.date DESC
    LIMIT ?;
  `;

  const rawChats = await queryDb<RawChatMessage>(query, [limit]);

  if (!rawChats || rawChats.length === 0) {
    return [];
  }

  const chatIds = rawChats.map((rc) => rc.chatId);

  const participantsQuery = `
    SELECT
      chj.chat_id,
      h.id AS handle_id
    FROM chat_handle_join chj
    JOIN handle h ON chj.handle_id = h.ROWID
    WHERE chj.chat_id IN (${chatIds.map(() => "?").join(",")});
  `;
  const rawParticipants = await queryDb<RawChatParticipant>(
    participantsQuery,
    chatIds,
  );

  // Map of chatId to array of participant handles
  const participantsByChatId = new Map<number, Handle[]>();
  for (const rp of rawParticipants) {
    if (!participantsByChatId.has(rp.chatId)) {
      participantsByChatId.set(rp.chatId, []);
    }
    participantsByChatId.get(rp.chatId)!.push(rp.handleId);
  }

  const chats: Chat[] = rawChats.map((rc) => {
    let lastMessage: Message | null = null;
    if (rc.lastMessageGuid) {
      lastMessage = {
        guid: rc.lastMessageGuid,
        text: rc.lastMessageText,
        handle: rc.lastMessageHandleId,
        group: rc.chatIdentifier.startsWith("chat") ? rc.chatIdentifier : null,
        date: convertAppleTime(rc.lastMessageDate),
        fromMe: !!rc.lastMessageIsFromMe,
        file: rc.attachmentPath
          ? rc.attachmentPath.replace(/^~\//, os.homedir() + "/")
          : null,
        fileType: rc.attachmentMimeType,
      };
    }

    return {
      id: rc.chatIdentifier,
      displayName: rc.displayName || rc.chatIdentifier,
      lastMessage,
      participants: participantsByChatId.get(rc.chatId) || [],
    };
  });

  return chats;
}

/**
 * Represents a raw chat message as returned from the @remembot/imessage database query.
 */
interface RawChatMessage {
  /** Path to the last message's attachment, or null if none. */
  readonly attachmentMimeType: string | null;
  /** Path to the last message's attachment, or null if none. */
  readonly attachmentPath: string | null;
  /** Unique numeric ID for the chat (ROWID). */
  readonly chatId: number;
  /** Unique identifier for the chat (e.g., group or 1:1). */
  readonly chatIdentifier: string;
  /** Display name for the chat, or null if not set. */
  readonly displayName: string | null;
  /** GUID of the last message. */
  readonly lastMessageGuid: string;
  /** Handle ID of the sender of the last message. */
  readonly lastMessageHandleId: string;
  /** Whether the last message was sent by the user. */
  readonly lastMessageIsFromMe: boolean;
  /** Text of the last message in the chat, or null if not available. */
  readonly lastMessageText: string | null;
  /** Timestamp of the last message (Apple CoreData format). */
  readonly lastMessageDate: number;
  /** Name of the service (e.g., iMessage, SMS). */
  readonly serviceName: string;
}

/**
 * Represents a participant in a chat as returned from the iMessage database query.
 */
interface RawChatParticipant {
  /** Numeric chat ID (ROWID) this participant belongs to. */
  readonly chatId: number;
  /** Handle ID of the participant. */
  readonly handleId: string;
}

// --- Non-exported helpers ---

/**
 * Helper to convert Apple CoreData timestamp to JavaScript Date.
 * @param appleTimestamp The timestamp from the iMessage database.
 * @returns The corresponding JavaScript Date.
 */
function convertAppleTime(appleTimestamp: number): Date {
  if (appleTimestamp === 0) return new Date(0);
  return new Date(Date.UTC(2001, 0, 1) + appleTimestamp * 1000);
}
