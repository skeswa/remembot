import { Command } from "commander";

import {
  AppleScriptExecutor,
  listChats,
  MessageListener,
  sendMessage,
  sendFileMessage,
  MessageDatabase,
} from "@remembot/imessage";
import type { Message } from "@remembot/imessage";
import pino from "pino";

const program = new Command();

program
  .name("imessage-cli")
  .description("Test @remembot/imessage features")
  .version("0.1.0");

program
  .command("chats")
  .description("List all chats")
  .action(async () => {
    const db = MessageDatabase.default();

    try {
      const chats = await listChats(db);

      console.log(chats);
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("send")
  .description("Send a message to a handle")
  .requiredOption("--handle <handle>", "The handle to send to")
  .requiredOption("--text <text>", "The text to send")
  .action(async (opts) => {
    const executor = new AppleScriptExecutor();
    const handle = { id: opts.handle, name: opts.handle };

    try {
      await sendMessage(executor, handle, opts.text);
      console.log(`Message sent to ${opts.handle}`);
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("send-file")
  .description("Send a file to a handle")
  .requiredOption("--handle <handle>", "The handle to send to")
  .requiredOption("--file <path>", "The file to send")
  .action(async (opts) => {
    const executor = new AppleScriptExecutor();
    const handle = { id: opts.handle, name: opts.handle };

    try {
      await sendFileMessage(executor, handle, opts.file);

      console.log(`File sent to ${opts.handle}`);
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("listen")
  .description("Listen for new messages (prints to stdout)")
  .action(() => {
    const db = MessageDatabase.default();
    db.open();

    const listener = new MessageListener(db, pino(), 1000);

    try {
      console.log("Listening for new messages. Press Ctrl+C to stop.");

      listener.on("message", (msg: Message) => {
        console.log(
          `[${msg.date.toISOString()}] ${msg.isFromMe ? "Me" : (msg.handle.name ?? msg.handle.id)}: ${msg.text}`
        );

        if (msg.attachedFile) {
          console.log(
            `  Attachment: ${msg.attachedFile.path} (${msg.attachedFile.mimeType})`
          );
        }
      });
      listener.on("error", (err: unknown) => {
        console.error("Error:", err);
      });

      listener.startListening();

      process.on("SIGINT", () => {
        console.log("\nShutting down...");
        listener.dispose();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        console.log("\nShutting down...");
        listener.dispose();
        process.exit(0);
      });

      return new Promise(() => {});
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
