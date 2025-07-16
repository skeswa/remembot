import { createServer, type Server, type Socket } from "node:net";
import { existsSync, unlinkSync, chmodSync, mkdirSync } from "node:fs";
import { EventEmitter } from "node:events";
import { dirname } from "node:path";
import pino, { type Logger } from "pino";
import { getSocketPath } from "../config/paths";
import { randomUUID } from "node:crypto";
import {
  type IPCClientConnection,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  IPCMethod,
  IPCErrorCode,
  IPCEvent,
  JsonRpcRequestSchema,
} from "../ipc/types";
import {
  frameMessage,
  parseFramedMessages,
  isRequest,
  isResponse,
  isNotification,
  createErrorResponse,
  createSuccessResponse,
  createNotification,
} from "../ipc/framing";

interface IPCServerOptions {
  socketPath?: string;
  logger?: Logger;
}

type MethodHandler = (
  params: unknown,
  connection: IPCClientConnection,
) => Promise<unknown> | unknown;

export class IPCServer extends EventEmitter {
  private readonly socketPath: string;
  private readonly logger: Logger;
  private server: Server | null = null;
  private connections: Map<string, IPCClientConnection> = new Map();
  private methodHandlers: Map<string, MethodHandler> = new Map();
  private buffers: Map<string, Buffer> = new Map();

  constructor(options: IPCServerOptions = {}) {
    super();

    this.socketPath = options.socketPath || getSocketPath();

    this.logger =
      options.logger ||
      pino({
        name: "ipc-server",
        level: "info",
      });

    this.setupBuiltinHandlers();
  }

  /**
   * Register a method handler
   */
  registerMethod(method: string, handler: MethodHandler): void {
    this.methodHandlers.set(method, handler);
    this.logger.debug({ method }, "Registered IPC method handler");
  }

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    // Ensure parent directory exists
    const socketDir = dirname(this.socketPath);
    if (!existsSync(socketDir)) {
      mkdirSync(socketDir, { recursive: true });
    }

    // Remove existing socket file if it exists
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch (error) {
        this.logger.error(
          { error, socketPath: this.socketPath },
          "Failed to remove existing socket file",
        );
        throw error;
      }
    }

    this.logger.debug(
      { socketPath: this.socketPath, exists: existsSync(this.socketPath) },
      "Starting IPC server",
    );

    // Create the server
    this.server = createServer();

    // Handle new connections
    this.server.on("connection", this.handleConnection.bind(this));

    // Handle server errors
    this.server.on("error", (error: unknown) => {
      const errorObj =
        error instanceof Error
          ? {
              message: error.message,
              code: (error as NodeJS.ErrnoException).code,
              errno: (error as NodeJS.ErrnoException).errno,
              syscall: (error as NodeJS.ErrnoException).syscall,
              path: (error as NodeJS.ErrnoException).path,
            }
          : error;
      this.logger.error(
        { error: errorObj, socketPath: this.socketPath },
        "IPC server error",
      );
      this.emit("error", error);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.socketPath, () => {
        // Set restrictive permissions on socket
        try {
          chmodSync(this.socketPath, 0o600);
        } catch (error) {
          this.logger.error({ error }, "Failed to set socket permissions");
        }

        this.logger.info({ socketPath: this.socketPath }, "IPC server started");
        resolve();
      });

      this.server!.once("error", reject);
    });
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    // Close all connections
    for (const [, connection] of this.connections) {
      connection.socket.destroy();
    }
    this.connections.clear();
    this.buffers.clear();

    // Close the server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info("IPC server stopped");
          resolve();
        });
      });
      this.server = null;
    }

    // Remove socket file
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch (error) {
        this.logger.error({ error }, "Failed to remove socket file");
      }
    }
  }

  /**
   * Send a notification to specific clients
   */
  sendNotification(
    event: IPCEvent,
    params: unknown,
    filter?: (connection: IPCClientConnection) => boolean,
  ): void {
    const notification = createNotification(event, params);
    const message = frameMessage(notification);

    for (const [id, connection] of this.connections) {
      // Check if client is subscribed to this event
      if (!connection.subscriptions.has(event)) {
        continue;
      }

      // Apply custom filter if provided
      if (filter && !filter(connection)) {
        continue;
      }

      try {
        connection.socket.write(message);
      } catch (error) {
        this.logger.error(
          { error, connectionId: id, event },
          "Failed to send notification to client",
        );
      }
    }
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: Socket): void {
    const connectionId = randomUUID();
    const connection: IPCClientConnection = {
      id: connectionId,
      socket,
      subscriptions: new Set(),
      serviceFilter: new Set(),
      authenticated: true, // Authentication via filesystem permissions
      connectedAt: new Date(),
    };

    this.connections.set(connectionId, connection);
    this.buffers.set(connectionId, Buffer.alloc(0));

    this.logger.info({ connectionId }, "New IPC client connected");

    // Handle incoming data
    socket.on("data", (data) => {
      this.handleData(connectionId, data);
    });

    // Handle connection close
    socket.on("close", () => {
      this.connections.delete(connectionId);
      this.buffers.delete(connectionId);
      this.logger.info({ connectionId }, "IPC client disconnected");
    });

    // Handle socket errors
    socket.on("error", (error) => {
      this.logger.error({ error, connectionId }, "Socket error");
      this.connections.delete(connectionId);
      this.buffers.delete(connectionId);
    });
  }

  /**
   * Handle incoming data from client
   */
  private handleData(connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Append to buffer
    const currentBuffer = this.buffers.get(connectionId) || Buffer.alloc(0);
    const newBuffer = Buffer.concat([currentBuffer, data]);

    // Parse messages
    const { messages, remaining } = parseFramedMessages(newBuffer);
    this.buffers.set(connectionId, remaining);

    // Process each message
    for (const message of messages) {
      this.processMessage(connection, message);
    }
  }

  /**
   * Process a single JSON-RPC message
   */
  private async processMessage(
    connection: IPCClientConnection,
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
  ): Promise<void> {
    try {
      if (isRequest(message)) {
        await this.handleRequest(connection, message);
      } else if (isNotification(message)) {
        await this.handleNotification(connection, message);
      } else if (isResponse(message)) {
        // Clients shouldn't send responses to the server
        this.logger.warn(
          { connectionId: connection.id, message },
          "Received unexpected response from client",
        );
      }
    } catch (error) {
      this.logger.error(
        { error, connectionId: connection.id, message },
        "Error processing message",
      );
    }
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleRequest(
    connection: IPCClientConnection,
    request: JsonRpcRequest,
  ): Promise<void> {
    const { method, params, id } = request;

    try {
      // Validate request
      const validation = JsonRpcRequestSchema.safeParse(request);
      if (!validation.success) {
        const response = createErrorResponse(
          id,
          IPCErrorCode.InvalidRequest,
          "Invalid request format",
          validation.error,
        );
        connection.socket.write(frameMessage(response));
        return;
      }

      // Find handler
      const handler = this.methodHandlers.get(method);
      if (!handler) {
        const response = createErrorResponse(
          id,
          IPCErrorCode.MethodNotFound,
          `Method not found: ${method}`,
        );
        connection.socket.write(frameMessage(response));
        return;
      }

      // Execute handler
      const result = await handler(params, connection);

      // Send response
      const response = createSuccessResponse(id, result);
      connection.socket.write(frameMessage(response));
    } catch (error) {
      // Send error response
      const response = createErrorResponse(
        id,
        (error as { code?: number }).code || IPCErrorCode.InternalError,
        (error as Error).message || "Internal error",
        (error as { data?: unknown }).data,
      );
      connection.socket.write(frameMessage(response));
    }
  }

  /**
   * Handle JSON-RPC notification
   */
  private async handleNotification(
    connection: IPCClientConnection,
    notification: JsonRpcNotification,
  ): Promise<void> {
    const { method, params } = notification;

    try {
      // Find handler
      const handler = this.methodHandlers.get(method);
      if (!handler) {
        // Notifications don't send error responses
        this.logger.warn(
          { method, connectionId: connection.id },
          "Received notification for unknown method",
        );
        return;
      }

      // Execute handler (no response for notifications)
      await handler(params, connection);
    } catch (error) {
      // Log error but don't send response for notifications
      this.logger.error(
        { error, method, connectionId: connection.id },
        "Error handling notification",
      );
    }
  }

  /**
   * Setup built-in method handlers
   */
  private setupBuiltinHandlers(): void {
    // Ping handler
    this.registerMethod(IPCMethod.Ping, () => ({
      timestamp: new Date().toISOString(),
      uptime: process.uptime() * 1000,
    }));

    // Event subscription handler
    this.registerMethod(IPCMethod.Subscribe, (params: unknown, connection) => {
      const { events, services } = params as {
        events: IPCEvent[];
        services?: string[];
      };

      // Update subscriptions
      connection.subscriptions.clear();
      for (const event of events) {
        connection.subscriptions.add(event);
      }

      // Update service filter
      connection.serviceFilter.clear();
      if (services && services.length > 0) {
        for (const service of services) {
          connection.serviceFilter.add(service);
        }
      }

      return { subscribed: true };
    });

    // Event unsubscription handler
    this.registerMethod(IPCMethod.Unsubscribe, (_params, connection) => {
      connection.subscriptions.clear();
      connection.serviceFilter.clear();
      return { unsubscribed: true };
    });
  }
}
