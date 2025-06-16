/**
 * @fileoverview Provides utilities to query recent chats and their participants
 * from the iMessage database.
 *
 * Handles chat metadata, last message, and participant resolution.
 */

import type { Handle } from "./handle";
import { convertAppleTime } from "./helpers";
import { MessageDatabase } from "./message-database";
import type { Service } from "./service";

/**
 * Represents a chat (group or 1:1) in iMessage, including participants and last
 * message.
 */
export interface Chat {
  /** Name of the chat (e.g., contact name or group name). */
  displayName: string;
  /** Unique chat ID (group or 1:1). */
  guid: string;
  /** Information about the most recent message in the chat. */
  mostRecentMessageSummary: {
    messageGuid: string;
    messageTime: Date;
  } | null;
  /** Handles of participants. */
  participants: ChatParticipant[];
  /** Number of unread messages. */
  unreadMessageCount: number;
}

/**
 * Represents a participant in a chat, including their handle and service.
 */
export interface ChatParticipant extends Handle {
  /** Service used to communicate with the participant. */
  service: Service;
}

/**
 * Summarizes chats from the iMessage database, including their last message
 * and participants.
 *
 * @param limit the number of chat summaries to return - defaults to 10
 * @returns a promise that resolves with an array of chat summaries
 */
export function listChats(db: MessageDatabase, limit: number = 10): Chat[] {
  const rows = db.query<ListChatsQueryRow>(LIST_CHATS_QUERY, [limit]);

  const chats = rows.map((row) => {
    let participants: ListChatsQueryRowParticipant[] = [];
    try {
      participants = JSON.parse(row.participantsJson);
    } catch (err: unknown) {
      // Ignore errors parsing the participants JSON.
    }

    const participantHandles = participants.map(
      (participant: ListChatsQueryRowParticipant) => ({
        id: participant.id,
        name: null,
        service: participant.service,
      }),
    );

    return {
      displayName: row.displayName,
      guid: row.guid,
      mostRecentMessageSummary: row.mostRecentMessageGuid
        ? {
            messageGuid: row.mostRecentMessageGuid,
            messageTime: convertAppleTime(row.mostRecentMessageDate),
          }
        : null,
      participants: participantHandles,
      unreadMessageCount: row.unreadMessageCount,
    };
  });

  return chats;
}

/** Query to list chats from the iMessage database. */
const LIST_CHATS_QUERY = `
WITH LastMessage AS (
  -- Find the most recent message for each chat
  SELECT
    cmj.chat_id,
    m.guid AS message_guid,
    m.date AS message_date,
    -- Use ROW_NUMBER to pick only the latest message per chat
    ROW_NUMBER() OVER(PARTITION BY cmj.chat_id ORDER BY m.date DESC) as rn
  FROM chat_message_join cmj
  JOIN message m ON cmj.message_id = m.ROWID
),
UnreadCounts AS (
  -- Count unread messages for each chat
  SELECT
    cmj.chat_id,
    COUNT(m.ROWID) as unread_count
  FROM chat_message_join cmj
  JOIN message m ON cmj.message_id = m.ROWID
  WHERE m.is_read = 0 AND m.is_from_me = 0
  GROUP BY cmj.chat_id
),
Participants AS (
  -- Aggregate all participants for each chat into a single JSON array
  SELECT
    chj.chat_id,
    json_group_array(
      json_object('id', h.id, 'service', h.service)
    ) as participants_json
  FROM chat_handle_join chj
  JOIN handle h ON chj.handle_id = h.ROWID
  GROUP BY chj.chat_id
)
-- Final SELECT statement to assemble the chat objects
SELECT
  c.guid,
  c.display_name AS displayName,
  p.participants_json AS participantsJson,
  -- Ensure unread count is 0 if there are no unread messages
  COALESCE(uc.unread_count, 0) AS unreadMessageCount,
  lm.message_guid AS mostRecentMessageGuid,
  lm.message_date AS mostRecentMessageDate
FROM chat c
-- Join the pre-calculated CTEs to the main chat table
LEFT JOIN Participants p ON c.ROWID = p.chat_id
LEFT JOIN UnreadCounts uc ON c.ROWID = uc.chat_id
LEFT JOIN LastMessage lm ON c.ROWID = lm.chat_id AND lm.rn = 1
-- Exclude archived chats from the results
WHERE c.is_archived = 0
-- Order chats by the most recent message date, descending
ORDER BY lm.message_date DESC
LIMIT ?;
`;

/** A single row resulting from executing `LIST_CHATS_QUERY`. */
interface ListChatsQueryRow {
  /** Name of the chat (e.g., contact name or group name). */
  displayName: string;
  /** Unique chat ID (group or 1:1). */
  guid: string;
  /** Uniquely identifies the most recent message in the chat. */
  mostRecentMessageGuid: string;
  /** When the most recent message in the chat was sent. */
  mostRecentMessageDate: number;
  /** Serialized JSON array of participant handle objects. */
  participantsJson: string;
  /** Number of unread messages. */
  unreadMessageCount: number;
}

/** A single participant in a chat as returned from the iMessage database query. */
interface ListChatsQueryRowParticipant {
  /** The unique ID of the participant (e.g., phone number or email). */
  id: string;
  /** The service used to communicate with the participant. */
  service: ChatParticipant["service"];
}
