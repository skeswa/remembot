import { createConnection, type Socket } from "node:net";
import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import { getSocketPath } from "../config/paths";
import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  IPCMethod,
  IPCEvent,
  type PingResult,
  type VersionResult,
  type DaemonStatusResult,
  type ServiceListResult,
  type ServiceStatusResult,
  type UpdateCheckResult,
} from "../ipc/types";
import {
  frameMessage,
  parseFramedMessages,
  generateRequestId,
  isResponse,
  isNotification,
} from "../ipc/framing";
import type { AppConfig } from "../types";

interface IPCClientOptions {
  socketPath?: string;
  timeout?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  timer: NodeJS.Timeout;
}

export class IPCClient extends EventEmitter {
  private readonly socketPath: string;
  private readonly timeout: number;
  private readonly autoReconnect: boolean;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  private socket: Socket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private pendingRequests: Map<string | number, PendingRequest<unknown>> =
    new Map();
  private buffer: Buffer = Buffer.alloc(0);

  constructor(options: IPCClientOptions = {}) {
    super();

    this.socketPath = options.socketPath || getSocketPath();
    this.timeout = options.timeout || 30000; // 30 seconds
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectInterval = options.reconnectInterval || 1000; // 1 second
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
  }

  /**
   * Check if daemon is running
   */
  isDaemonRunning(): boolean {
    return existsSync(this.socketPath);
  }

  /**
   * Connect to the daemon
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = createConnection(this.socketPath);

      const onConnect = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();

        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode === "ENOENT") {
          reject(new Error("Daemon is not running"));
        } else if (errorCode === "ECONNREFUSED") {
          reject(new Error("Connection refused by daemon"));
        } else {
          reject(error);
        }
      };

      const cleanup = () => {
        this.socket?.off("connect", onConnect);
        this.socket?.off("error", onError);
      };

      this.socket.once("connect", onConnect);
      this.socket.once("error", onError);

      // Setup persistent event handlers
      this.socket.on("data", this.handleData.bind(this));
      this.socket.on("close", this.handleClose.bind(this));
      this.socket.on("error", this.handleError.bind(this));
    });
  }

  /**
   * Disconnect from the daemon
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.socket) {
      return;
    }

    // Cancel all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Client disconnected"));
    }
    this.pendingRequests.clear();

    // Close socket
    this.socket.destroy();
    this.socket = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);

    this.emit("disconnected");
  }

  /**
   * Send a request to the daemon
   */
  private async request<T>(method: IPCMethod, params?: unknown): Promise<T> {
    if (!this.connected || !this.socket) {
      throw new Error("Not connected to daemon");
    }

    const requestId = generateRequestId();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: requestId,
    };

    return new Promise((resolve, reject) => {
      // Setup timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      // Send request
      try {
        this.socket!.write(frameMessage(request));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    const { messages, remaining } = parseFramedMessages(this.buffer);
    this.buffer = remaining;

    for (const message of messages) {
      if (isResponse(message)) {
        this.handleResponse(message);
      } else if (isNotification(message)) {
        this.handleNotification(message);
      }
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(response: JsonRpcResponse): void {
    const { id, result, error } = response;

    const pending = this.pendingRequests.get(id as string | number);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(id as string | number);
    clearTimeout(pending.timer);

    if (error) {
      const err = new Error(error.message);
      (err as { code?: number; data?: unknown }).code = error.code;
      (err as { code?: number; data?: unknown }).data = error.data;
      pending.reject(err);
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Handle notification message
   */
  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;

    // Emit event for the notification
    this.emit(method, params);
  }

  /**
   * Handle socket close
   */
  private handleClose(): void {
    this.connected = false;
    this.socket = null;

    // Cancel all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    this.emit("disconnected");

    // Attempt reconnection if enabled
    if (
      this.autoReconnect &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.reconnectAttempts++;

      setTimeout(() => {
        this.connect().catch((error) => {
          this.emit("reconnectFailed", error);
        });
      }, this.reconnectInterval * this.reconnectAttempts);
    }
  }

  /**
   * Handle socket error
   */
  private handleError(error: Error): void {
    this.emit("error", error);
  }

  // Public API Methods

  async ping(): Promise<PingResult> {
    return this.request<PingResult>(IPCMethod.Ping);
  }

  async getVersion(): Promise<VersionResult> {
    return this.request<VersionResult>(IPCMethod.GetVersion);
  }

  async getDaemonStatus(): Promise<DaemonStatusResult> {
    return this.request<DaemonStatusResult>(IPCMethod.GetStatus);
  }

  async shutdown(): Promise<{ shuttingDown: boolean }> {
    return this.request(IPCMethod.Shutdown);
  }

  async addService(
    name: string,
    repository: string,
    config?: AppConfig,
  ): Promise<{ success: boolean }> {
    return this.request(IPCMethod.AddService, { name, repository, config });
  }

  async removeService(name: string): Promise<{ success: boolean }> {
    return this.request(IPCMethod.RemoveService, { name });
  }

  async listServices(): Promise<ServiceListResult> {
    return this.request<ServiceListResult>(IPCMethod.ListServices);
  }

  async getService(name: string): Promise<AppConfig> {
    return this.request<AppConfig>(IPCMethod.GetService, { name });
  }

  async startService(name: string): Promise<{ success: boolean }> {
    return this.request(IPCMethod.StartService, { name });
  }

  async stopService(name: string): Promise<{ success: boolean }> {
    return this.request(IPCMethod.StopService, { name });
  }

  async restartService(name: string): Promise<{ success: boolean }> {
    return this.request(IPCMethod.RestartService, { name });
  }

  async getServiceStatus(name: string): Promise<ServiceStatusResult> {
    return this.request<ServiceStatusResult>(IPCMethod.GetServiceStatus, {
      name,
    });
  }

  async getAllStatuses(): Promise<ServiceStatusResult[]> {
    return this.request<ServiceStatusResult[]>(IPCMethod.GetAllStatuses);
  }

  async checkUpdate(name: string): Promise<UpdateCheckResult> {
    return this.request<UpdateCheckResult>(IPCMethod.CheckUpdate, { name });
  }

  async applyUpdate(name: string): Promise<{ success: boolean }> {
    return this.request(IPCMethod.ApplyUpdate, { name });
  }

  async getLogs(
    service: string,
    lines?: number,
    follow?: boolean,
  ): Promise<{ logs: string[] }> {
    return this.request(IPCMethod.GetLogs, { service, lines, follow });
  }

  async streamLogs(
    service: string,
    lines?: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(IPCMethod.StreamLogs, { service, lines });
  }

  async stopLogStream(
    service: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(IPCMethod.StopLogStream, { service });
  }

  async subscribe(
    events: IPCEvent[],
    services?: string[],
  ): Promise<{ subscribed: boolean }> {
    return this.request(IPCMethod.Subscribe, { events, services });
  }

  async unsubscribe(): Promise<{ unsubscribed: boolean }> {
    return this.request(IPCMethod.Unsubscribe);
  }
}
