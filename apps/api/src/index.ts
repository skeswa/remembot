const PORT = process.env.PORT;

if (!process.env.PORT) {
  console.error("Error: PORT environment variable is required!");

  if (process.env.NODE_ENV !== "production") {
    console.log("psst: make sure you have a .env file");

    process.exit(1);
  }

  process.exit(1);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req): Promise<Response | undefined> {
    const path = new URL(req.url).pathname;

    // Health check endpoint
    if (path === "/health") {
      return Response.json({ status: "OK" }, { status: 200 });
    }

    if (path === "/courier") {
      console.log("Upgrading to WebSocket:", req);

      const success = server.upgrade(req);

      if (success) {
        console.log("WebSocket upgrade succeeded");
        // Bun automatically returns a 101 Switching Protocols
        // if the upgrade succeeds
        return undefined;
      }

      return new Response("Upgrade failed", { status: 400 });
    }

    // respond with text/html
    if (path === "/") return new Response("Welcome to Bun!");

    // redirect
    if (path === "/abc") return Response.redirect("/source", 301);

    // send back a file (in this case, *this* file)
    if (path === "/source") return new Response(Bun.file(import.meta.path));

    // respond with JSON
    if (path === "/api") return Response.json({ some: "buns", for: "you" });

    // receive JSON data to a POST request
    if (req.method === "POST" && path === "/api/post") {
      const data = await req.json();
      console.log("Received JSON:", data);
      return Response.json({ success: true, data });
    }

    // receive POST data from a form
    if (req.method === "POST" && path === "/form") {
      const data = await req.formData();
      console.log(data.get("someField"));
      return new Response("Success");
    }

    // 404s
    return new Response("Page not found", { status: 404 });
  },
  websocket: {
    open: () => {
      console.log("Client connected");
    },
    // this is called when a message is received
    async message(ws, message) {
      console.log(`Received ${message}`);
      // send back a message
      ws.send(`You said: ${message}`);
    },
    close: () => {
      console.log("Client disconnected");
    },
  },
});

console.log(`Listening on ${server.url}`);
