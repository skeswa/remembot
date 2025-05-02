const API_AUTHORITY = process.env.API_AUTHORITY;

const serverUrl = `ws://${API_AUTHORITY}/courier`;

/**
 * Establishes a WebSocket connection and returns a Promise that resolves
 * when the connection closes cleanly, and rejects on error or unclean closure.
 */
function connectWebSocket(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    console.log(`Connecting to WebSocket server at ${serverUrl}...`);

    const socket = new WebSocket(serverUrl);

    socket.addEventListener("open", (event) => {
      console.log("WebSocket connection opened:", event);
      // Send a message after connection is established
      const messageToSend = "Hello from Courier!";
      console.log(`Sending message: ${messageToSend}`);
      socket.send(messageToSend);
    });

    socket.addEventListener("message", (event) => {
      console.log(`Received message: ${event.data}`);
      // Potentially close connection after receiving a response
      // socket.close();
    });

    socket.addEventListener("error", (event) => {
      console.error("WebSocket error:", event);
      // Reject the promise on error
      reject(new Error("WebSocket error occurred")); // You might want to pass the original event or more details
    });

    socket.addEventListener("close", (event) => {
      if (event.wasClean) {
        console.log(
          `WebSocket connection closed cleanly, code=${event.code} reason=${event.reason}`,
        );
        // Resolve the promise on clean closure
        resolve();
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.error("WebSocket connection died");
        // Reject the promise on unclean closure
        reject(new Error(`WebSocket connection died, code=${event.code}`));
      }
    });

    // Note: The socket instance is scoped within the Promise executor.
    // If the caller needs to interact with the socket (e.g., send more messages),
    // this design would need to be adjusted (e.g., passing callbacks, returning the socket differently).
  });
}

// Removed the automatic execution and console log about Ctrl+C

export { connectWebSocket }; 