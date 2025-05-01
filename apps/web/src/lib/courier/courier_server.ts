import { WebSocketServer, WebSocket } from "ws";
import { type IncomingMessage } from "http";
import url from "url";

import { logger } from "@/lib/logger";

import { CourierClient, CourierClientOwner } from "./courier_client";

export class CourierServer implements CourierClientOwner {
  /** Connected clients, indexed by their respective client IDs. */
  private readonly connectedClients = new Map<ClientId, CourierClient>();

  connectClient(clientId: ClientId, ws: WebSocket) {
    const existingClient = this.connectedClients.get(clientId);

    if (existingClient) {
      logger.warn(
        `Client ${clientId} already connected - throwing out the old one`,
      );

      existingClient.close();

      return;
    }

    const newClient = new CourierClient(clientId, /* clientOwner= */ this, ws);

    this.connectedClients.set(clientId, newClient);

    logger.info(`Client ${clientId} connected`);

    this.connectedClients.set(clientId, newClient);
  }

  /** @override */
  onClientClosed(clientId: string): void {
    logger.info(`Client ${clientId} disconnected`);

    this.connectedClients.delete(clientId);
  }
}

type ClientId = string;
