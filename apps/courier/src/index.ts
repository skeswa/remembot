import { connectWebSocket } from "./websocket-client";

async function main() {
  console.log("Starting Courier application...");

  try {
    console.log("Attempting to connect to WebSocket server...");
    // Connect to the WebSocket server and wait for the session to complete or fail
    await connectWebSocket();
    console.log("WebSocket session completed successfully.");
  } catch (error) {
    console.error("WebSocket session failed:", error);
    // Handle the error appropriately, maybe exit or retry
    process.exit(1); // Exit with an error code
  }

  console.log("Courier application finished.");
}

main();

// Note: The process will now naturally exit after the main function completes
// (either resolves or rejects), unless there are other async operations
// or listeners keeping it alive.

// You can now use the 'socket' variable if needed, for example:
// socket.send("Another message from index.ts");

console.log("Courier application setup complete. Waiting for WebSocket events...");

// Note: The process needs to be kept alive for WebSocket communication.
// Bun might exit if there's no other long-running task or server.
// You might need to add logic here to keep the application running,
// depending on what 'courier' is supposed to do.