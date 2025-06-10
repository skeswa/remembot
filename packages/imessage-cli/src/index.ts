import { Command } from "commander";

import {
  applyNamesToHandles,
  handleForName,
  listen,
  nameForHandle,
  listChats,
  send,
  sendFile,
} from "@remembot/imessage";
import type { Message } from "@remembot/imessage";

const program = new Command();

program
  .name("imessage-cli")
  .description("Test @remembot/imessage features")
  .version("0.1.0");

program
  .command("shoop")
  .description("Shoop da woop")
  .action(async () => {
    try {
      const chats = await listChats();

      console.log(chats);

      const handles = await applyNamesToHandles(
        chats.flatMap((chat) => chat.participants),
      );

      console.log(handles);
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
    try {
      await send(opts.handle, opts.text);
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
    try {
      await sendFile(opts.handle, opts.file);
      console.log(`File sent to ${opts.handle}`);
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("handle-for-name")
  .description("Look up a handle by contact name")
  .requiredOption("--name <name>", "The contact name")
  .action(async (opts) => {
    try {
      const handle = await handleForName(opts.name);
      if (handle) {
        console.log(handle);
      } else {
        console.log(`No handle found for name: ${opts.name}`);
      }
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("name-for-handle")
  .description("Look up a contact name by handle")
  .requiredOption("--handle <handle>", "The handle")
  .action(async (opts) => {
    try {
      const name = await nameForHandle(opts.handle);
      if (name) {
        console.log(name);
      } else {
        console.log(`No name found for handle: ${opts.handle}`);
      }
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program
  .command("listen")
  .description("Listen for new messages (prints to stdout)")
  .action(() => {
    try {
      console.log("Listening for new messages. Press Ctrl+C to stop.");
      const emitter = listen();
      emitter.on("message", (msg: Message) => {
        console.log(
          `[${msg.date.toISOString()}] ${msg.fromMe ? "Me" : msg.handle}: ${msg.text}`,
        );
        if (msg.file) {
          console.log(
            `  Attachment: ${msg.file} (${msg.fileType || "unknown type"})`,
          );
        }
      });
      emitter.on("error", (err: unknown) => {
        console.error("Error:", err);
      });

      return new Promise(() => {});
    } catch (err: unknown) {
      console.error("Error:", err);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
