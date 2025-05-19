import * as imessage from "better-osa-imessage";

import { type IMessage, type IMessageAgent } from "./imessage_agent";

export class OsaIMessageAgent implements IMessageAgent {
  async getMessages(): Promise<IMessage[]> {
    const chats = await imessage.getRecentChats();
    return chats as IMessage[];
  }
}
