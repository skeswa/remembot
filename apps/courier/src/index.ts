import { connectWebSocket } from "./websocket-client";

const PORT = process.env.PORT;

if (!process.env.PORT) {
  console.error("Error: PORT environment variable is required!");

  if (process.env.NODE_ENV !== "production") {
    console.log("psst: make sure you have a .env file");

    process.exit(1);
  }

  process.exit(1);
}

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

console.log(`Health check server listening on port ${PORT}`);

// Main application entry point that manages WebSocket connection lifecycle
async function main() {
  console.log("Starting Courier application with persistent connection...");

  // Initialize exponential backoff for reconnection attempts
  let currentBackoff = INITIAL_BACKOFF_MS;

  // Main connection loop - will run indefinitely to maintain connection
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

      // Implement exponential backoff with a maximum limit
      // This helps prevent overwhelming the server during reconnection attempts
      currentBackoff = Math.min(
        currentBackoff * BACKOFF_FACTOR,
        MAX_BACKOFF_MS,
      );
    }
  }
}

// Serve health checks
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const path = new URL(req.url).pathname;

    if (path === "/health") {
      return Response.json({ status: "OK" }, { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Listening on ${server.url}`);

// Global error handler for unexpected errors outside the main loop
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

console.log(
  "Courier application setup complete. Waiting for WebSocket events...",
);

// Note: The process needs to be kept alive for WebSocket communication.
// Bun might exit if there's no other long-running task or server.
// You might need to add logic here to keep the application running,
// depending on what 'courier' is supposed to do.
