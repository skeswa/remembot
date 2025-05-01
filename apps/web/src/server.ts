import express, { type Express } from "express";
import * as http from "http";
import * as stream from "stream";
import next from "next";
import { parse } from "url";
import { WebSocket, WebSocketServer } from "ws";

import { CourierServer } from "@/lib/courier";
import { logger } from "@/lib/logger";

const COURIER_CLIENT_ID_HEADER = "x-client-id";
const COURIER_CLIENT_SECRET_HEADER = "x-client-secret";
const COURIER_ROUTE = "/api/courier";
const IS_DEV = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3001;

async function initServer(expressApp: Express, httpServer: http.Server) {
  const nextApp = next({ dev: IS_DEV });

  await nextApp.prepare();

  expressApp.use((req, res) => {
    const nextRequestHandler = nextApp.getRequestHandler();
    const parsedUrl = parse(req.url, /* parseQueryString= */ true);

    nextRequestHandler(req, res, parsedUrl);
  });

  const courierServer = new CourierServer();
  const wss = new WebSocketServer({ noServer: true });

  type CourierClientCredentials = {
    clientId: string;
    clientSecret: string;
  };

  async function validateCourierClientCredentials(
    req: http.IncomingMessage,
  ): Promise<CourierClientCredentials | null> {
    const clientId = req.headers[COURIER_CLIENT_ID_HEADER] as string;
    const clientSecret = req.headers[COURIER_CLIENT_SECRET_HEADER] as string;

    if (!clientId || !clientSecret) {
      logger.debug(
        "Missing courier client ID and/or secret - terminating connection",
      );

      return null;
    }

    // TODO: skeswa - validate client ID and secret

    return { clientId, clientSecret };
  }

  async function onCourierClientConnection(
    ws: WebSocket,
    req: http.IncomingMessage,
  ) {
    const clientCredentials = await validateCourierClientCredentials(req);

    if (!clientCredentials) {
      logger.warn(
        "Invalid courier client ID and/or secret - terminating connection",
      );

      ws.close();

      return;
    }

    courierServer.connectClient(clientCredentials.clientId, ws);
  }

  function onCourierUpgrade(
    req: http.IncomingMessage,
    socket: stream.Duplex,
    head: Buffer,
  ) {
    wss.handleUpgrade(
      req,
      socket,
      head,
      (ws: WebSocket, request: http.IncomingMessage) => {
        wss.emit("connection", ws, request);
      },
    );
  }

  function onNextUpgrade(
    req: http.IncomingMessage,
    socket: stream.Duplex,
    head: Buffer,
  ) {
    const nextUpgradeHandler = nextApp.getUpgradeHandler();

    nextUpgradeHandler(req, socket, head);
  }

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "/", true);

    if (pathname === COURIER_ROUTE) {
      onCourierUpgrade(req, socket, head);
    } else if (pathname?.startsWith("/_next")) {
      onNextUpgrade(req, socket, head);
    } else {
      logger.debug("Unhandled upgrade request", {
        pathname,
        headers: req.headers,
      });

      socket.destroy();
    }
  });

  wss.on("connection", onCourierClientConnection);
}

const expressApp = express();
const server = http.createServer(expressApp);

server
  .listen(PORT, () => {
    logger.info(`✔︎ Server listening on port ${PORT}`);

    initServer(expressApp, server).catch((err) => {
      logger.error(`😵 Failed to initialize server components:\n`, err);

      process.exit(2);
    });
  })
  .on("error", (err) => {
    logger.error(`😵 Failed to start server on port ${PORT}:\n`, err);

    process.exit(1);
  });
