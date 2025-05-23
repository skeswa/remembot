# `@remembot/imessage`

## Goal

`@remembot/imessage` is a Node.js/TypeScript package for automating and integrating with Apple iMessage on macOS. It enables sending and receiving iMessages, sending files, querying recent chats, and resolving contacts—all programmatically, with a modern, type-safe API.

## Inspiration & Capabilities

This package is inspired by [`better-osa-imessage`](https://github.com/Bubba8291/better-osa-imessage), a popular Node.js library for iMessage automation. Like its predecessor, `@remembot/imessage` leverages AppleScript (OSA) to interact with the Messages and Contacts apps, but is designed for:

- Modern ESM/TypeScript projects
- Improved type safety and maintainability
- Extensibility and testability
- Direct access to the iMessage SQLite database for richer querying

**Capabilities:**

- Send iMessages and files to individuals or groups
- Listen for new incoming messages (with attachments)
- Look up contacts by name or handle
- Query recent chats and participants

## How It Works

- **Sending messages/files:** Uses AppleScript via `node-osascript` to control the Messages app.
- **Receiving messages:** Polls the local iMessage SQLite database (`chat.db`) for new messages and emits them as events.
- **Contact resolution:** Uses AppleScript to query the Contacts app for handles and names.
- **Chat queries:** Reads from the iMessage database to provide chat and participant metadata.

## Architecture

### High-Level Overview

```mermaid
graph TD
  A[Your Node.js App] -- API Calls --> B(@remembot/imessage package)
  B -- AppleScript (OSA) --> C(Messages.app & Contacts.app)
  B -- SQLite Queries --> D[chat.db (iMessage database)]
  C -- Sends/Receives Messages --> E[Apple iMessage Service]
  D -- Stores Messages/Chats --> B
```

### Internal Module Structure

```mermaid
graph TD
  subgraph @remembot/imessage
    I1[index.ts]
    I2[applescript.ts]
    I3[db.ts]
    I4[message.ts]
    I5[chat.ts]
    I6[contact.ts]
    I7[types.ts]
  end
  I1 -- send/sendFile --> I2
  I1 -- listen --> I4
  I1 -- getRecentChats --> I5
  I1 -- handleForName/nameForHandle --> I6
  I4 -- queryDb --> I3
  I5 -- queryDb --> I3
  I6 -- executeAppleScript --> I2
  I2 -- node-osascript --> OSA[AppleScript]
  I3 -- sqlite3 --> DB[chat.db]
```

## Public API

### Send a message

```ts
import { send } from "@remembot/imessage";
await send("+15555555555", "Hello World!");
```

### Send a file

```ts
import { sendFile } from "@remembot/imessage";
await sendFile("+15555555555", "/path/to/file.png");
```

### Listen for new messages

```ts
import { listen } from "@remembot/imessage";
listen().on("message", (msg) => {
  if (!msg.fromMe) console.log(`Received: ${msg.text}`);
});
```

### Get a handle for a contact name

```ts
import { handleForName } from "@remembot/imessage";
const handle = await handleForName("Tim Cook");
```

### Get the name for a handle

```ts
import { nameForHandle } from "@remembot/imessage";
const name = await nameForHandle("+15555555555");
```

### Get recent chats

```ts
import { getRecentChats } from "@remembot/imessage";
const chats = await getRecentChats(10);
```

## Types

- `Message`: Represents a single iMessage (text, sender, group, attachments, etc.)
- `Chat`: Represents a chat (group or 1:1), with participants and last message
- `Handle`: A phone, email, or group chat ID

## Requirements

- macOS with iMessage enabled
- Node.js (ESM support)
- Permissions to access Messages and Contacts

## License

MIT
