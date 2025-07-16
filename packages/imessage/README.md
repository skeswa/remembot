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
- **Receiving messages:** Polls the local iMessage SQLite database (`chat.db`) for new messages and emits them as events via the `MessageListener`.
- **Contact resolution:** Reads from the iMessage database to provide `Handle` metadata.
- **Chat queries:** Reads from the iMessage database to provide `Chat` metadata.

## Usage

Before using the API, you need to instantiate an `AppleScriptExecutor` for sending messages and a `MessageDatabase` for querying chat information.

The following example shows how to set up the necessary components and use the main features of the library.

> **Note:** To query the iMessage database, you must grant **Full Disk Access** to your terminal application (e.g., Terminal, iTerm2) or the application running your Node.js script.

```ts
import {
  AppleScriptExecutor,
  MessageDatabase,
  MessageListener,
  applyNamesToHandles,
  listChats,
  sendMessage,
  sendFileMessage,
} from "@remembot/imessage";
import pino from "pino";

// Executor for sending messages and interacting with Contacts.
const executor = new AppleScriptExecutor();

// Database for querying chat history.
const db = MessageDatabase.default();

// You must open the database connection before using it.
db.open();

// --- Examples ---

// 1. Send a message
// The handle can be a phone number, email, or chat ID.
const handle = { id: "+15555555555", name: null };
await sendMessage(executor, handle, "Hello from Remembot!");

// 2. Send a file with an optional message
const filePath = "/path/to/your/image.jpg";
await sendFileMessage(executor, handle, filePath);

// 3. Get recent chats
// Get the 10 most recent chats.
const recentChats = listChats(db, 10);

// 4. Add contact names to chats
// Enrich chat participants with names from your Contacts app.
const chatsWithNames = await applyNamesToHandles(
  executor,
  recentChats.flatMap((c) => c.participants),
);
console.log(JSON.stringify(chatsWithNames, null, 2));

// 5. Listen for new messages
const logger = pino();
// Poll every 5 seconds.
const listener = new MessageListener(db, logger, 5000);

listener.on("message", (msg) => {
  if (!msg.fromMe) {
    console.log(`Received: ${msg.text} from ${msg.handle.id}`);
  }
});

listener.on("error", (err) => {
  console.error("Message listener error:", err);
});

listener.startListening();
console.log("Listening for new messages...");

// --- Cleanup ---

// When you're done, stop the listener and close the database connection.
// This is important for graceful shutdown.
//
// listener.stopListening();
// db.close();
```

## Types

- `Message`: Represents a single iMessage (text, sender, group, attachments, etc.)
- `Chat`: Represents a chat (group or 1:1), with participants and last message
- `Handle`: A phone, email, or group chat ID
- `AttachedFile`: Represents a file attached to a message.

## Requirements

- macOS with iMessage enabled
- Node.js (ESM support)
- Permissions to access Messages and Contacts

## License

MIT
