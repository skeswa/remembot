import { connectWebSocket } from "./websocket-client";

// --- Reconnection Logic Configuration ---
const INITIAL_BACKOFF_MS = 1000; // Start with a 1-second delay
const MAX_BACKOFF_MS = 30000; // Cap the delay at 30 seconds
const BACKOFF_FACTOR = 2; // Double the delay each time
// ----------------------------------------

/**
 * Simple promise-based delay function.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting Courier application with persistent connection...");

  let currentBackoff = INITIAL_BACKOFF_MS;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log("Attempting to connect to WebSocket server...");
      // Connect and wait for the session to end (resolve on clean close, reject on error/unclean close)
      await connectWebSocket();
      console.log(
        "WebSocket session ended cleanly. Resetting backoff and reconnecting shortly...",
      );
      // Reset backoff after a successful connection and clean closure
      currentBackoff = INITIAL_BACKOFF_MS;
      // Optional: Add a small delay before reconnecting even after a clean close
      await delay(INITIAL_BACKOFF_MS); // Wait a bit before immediately reconnecting
    } catch (error) {
      console.error("WebSocket connection failed or closed uncleanly:", error);
      console.log(`Retrying in ${currentBackoff / 1000} seconds...`);

      // Wait for the current backoff duration
      await delay(currentBackoff);

      // Increase backoff for the next attempt, respecting the maximum
      currentBackoff = Math.min(
        currentBackoff * BACKOFF_FACTOR,
        MAX_BACKOFF_MS,
      );
    }
  }
}

main().catch((error) => {
  // This catch is primarily for unexpected errors *outside* the main loop,
  // though the loop itself is designed to run indefinitely.
  console.error("Critical error in main execution:", error);
  process.exit(1);
});

// Note: The process should now stay alive indefinitely due to the while(true) loop
// and the asynchronous delays.

// You can now use the 'socket' variable if needed, for example:
// socket.send("Another message from index.ts");

console.log("Courier application setup complete. Waiting for WebSocket events...");

// Note: The process needs to be kept alive for WebSocket communication.
// Bun might exit if there's no other long-running task or server.
// You might need to add logic here to keep the application running,
// depending on what 'courier' is supposed to do.