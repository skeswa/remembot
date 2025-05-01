import { WebSocket } from "ws";

type CourierClientId = string;

export class CourierClient {
  private isClosed = false;

  constructor(
    readonly clientId: CourierClientId,
    private readonly clientOwner: CourierClientOwner,
    private readonly ws: WebSocket,
  ) {
    this.clientId = clientId;
    this.ws = ws;

    this.ws.on("message", (message) => this.onMessageReceived(message));
    this.ws.once("close", () => this.onClose());
  }

  close() {
    if (this.isClosed) {
      return;
    }

    this.ws.close();
  }

  private onClose() {
    console.info(`[${this.clientId}] closed`);

    this.isClosed = true;
  }

  private onMessageReceived(message: WebSocket.RawData) {
    console.log(`[${this.clientId}] received: %s`, message);
  }
}

export interface CourierClientOwner {
  onClientClosed(clientId: CourierClientId): void;
}
