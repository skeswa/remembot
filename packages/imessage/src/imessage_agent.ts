import * as imessage from 'better-osa-imessage';

export interface IMessageAgent {
  /**
   * Get all messages from the current user's iMessage account.
   * @returns An array of IMessage objects.
   */
  getMessages(): Promise<IMessage[]>;
}

/** Represents a single iMessage message with its metadata and content. */
export interface IMessage {
  /** Date and time when the message was sent. */
  date: Date;
  /** Whether the message was sent by the current user. */
  fromMe: boolean;
  /** Array of group chat participants' handles. */
  group: string[];
  /** Unique identifier for the message. */
  guid: string;
  /** The sender's handle/phone number. */
  handle: string;
  /** The message content text. */
  text: string;
}

/*

{
                    guid: msg.guid,
                    text: msg.text,
                    handle: msg.handle,
                    group: msg.cache_roomnames,
                    fromMe: !!msg.is_from_me,
                    date: fromAppleTime(msg.date),
                    dateRead: fromAppleTime(msg.date_read),
                    file:
                        msg.attachment !== null
                            ? msg.attachment.replace('~', process.env.HOME)
                            : null,
                    fileType: msg.mime_type,
                });
*/