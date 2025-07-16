import { z } from "zod";

// JSON-RPC 2.0 Protocol Version
export const IPC_PROTOCOL_VERSION = "1.0.0";

// JSON-RPC 2.0 Base Types
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number()]),
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});

export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.unknown().optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;

// IPC Error Codes
export enum IPCErrorCode {
  // JSON-RPC 2.0 Standard Errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Custom Application Errors
  DaemonNotRunning = -32000,
  ServiceNotFound = -32001,
  ServiceAlreadyExists = -32002,
  ServiceOperationFailed = -32003,
  ConfigurationInvalid = -32004,
  PermissionDenied = -32005,
  VersionMismatch = -32006,
  UpdateFailed = -32007,
  FileSystemError = -32008,
}

// IPC Methods
export enum IPCMethod {
  // Daemon Management
  Ping = "daemon.ping",
  GetVersion = "daemon.getVersion",
  GetStatus = "daemon.getStatus",
  Shutdown = "daemon.shutdown",

  // Service Management
  AddService = "service.add",
  RemoveService = "service.remove",
  ListServices = "service.list",
  GetService = "service.get",
  UpdateService = "service.update",
  StartService = "service.start",
  StopService = "service.stop",
  RestartService = "service.restart",
  GetServiceStatus = "service.getStatus",
  GetAllStatuses = "service.getAllStatuses",

  // Update Management
  CheckUpdate = "update.check",
  ApplyUpdate = "update.apply",

  // Log Management
  GetLogs = "log.get",
  StreamLogs = "log.stream",
  StopLogStream = "log.stopStream",

  // Configuration Management
  ValidateConfig = "config.validate",
  ReloadConfig = "config.reload",

  // Event Subscription
  Subscribe = "event.subscribe",
  Unsubscribe = "event.unsubscribe",
}

// IPC Event Types
export enum IPCEvent {
  ServiceStarted = "service.started",
  ServiceStopped = "service.stopped",
  ServiceError = "service.error",
  ServiceStatusChanged = "service.statusChanged",
  UpdateAvailable = "update.available",
  UpdateStarted = "update.started",
  UpdateCompleted = "update.completed",
  UpdateFailed = "update.failed",
  ConfigChanged = "config.changed",
  ConfigReloaded = "config.reloaded",
  DaemonShutdown = "daemon.shutdown",
  LogLine = "log.line",
}

// Method Parameter Schemas
export const AddServiceParamsSchema = z.object({
  name: z.string(),
  repository: z.string(),
  config: z.unknown().optional(), // AppConfig type
});

export const ServiceNameParamsSchema = z.object({
  name: z.string(),
});

export const UpdateServiceParamsSchema = z.object({
  name: z.string(),
  config: z.unknown(), // Partial AppConfig
});

export const GetLogsParamsSchema = z.object({
  service: z.string(),
  lines: z.number().optional().default(100),
  follow: z.boolean().optional().default(false),
});

export const StreamLogsParamsSchema = z.object({
  service: z.string(),
  lines: z.number().optional().default(10), // Initial lines to show
});

export const StopLogStreamParamsSchema = z.object({
  service: z.string(),
});

export const SubscribeParamsSchema = z.object({
  events: z.array(z.nativeEnum(IPCEvent)),
  services: z.array(z.string()).optional(), // Filter by service names
});

// Method Result Schemas
export const PingResultSchema = z.object({
  timestamp: z.string(),
  uptime: z.number(),
});

export const VersionResultSchema = z.object({
  version: z.string(),
  protocolVersion: z.string(),
});

export const DaemonStatusResultSchema = z.object({
  running: z.boolean(),
  pid: z.number(),
  uptime: z.number(),
  servicesCount: z.number(),
  memory: z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
  }),
});

export const ServiceListResultSchema = z.array(z.string());

export const ServiceStatusResultSchema = z.object({
  name: z.string(),
  pid: z.number().optional(),
  status: z.enum(["running", "stopped", "updating", "error"]),
  currentVersion: z.string().optional(),
  latestVersion: z.string().optional(),
  lastChecked: z.string().optional(),
  lastError: z.string().optional(),
  uptime: z.number().optional(),
});

export const UpdateCheckResultSchema = z.object({
  available: z.boolean(),
  currentVersion: z.string().optional(),
  latestVersion: z.string().optional(),
  releaseNotes: z.string().optional(),
});

// Event Payload Schemas
export const ServiceEventPayloadSchema = z.object({
  service: z.string(),
  status: z.enum(["running", "stopped", "updating", "error"]),
  pid: z.number().optional(),
  error: z.string().optional(),
});

export const UpdateEventPayloadSchema = z.object({
  service: z.string(),
  version: z.string(),
  error: z.string().optional(),
});

export const ConfigEventPayloadSchema = z.object({
  service: z.string(),
  action: z.enum(["created", "updated", "deleted"]),
  path: z.string(),
});

export const LogLineEventPayloadSchema = z.object({
  service: z.string(),
  line: z.string(),
  timestamp: z.string(),
});

// Type exports
export type AddServiceParams = z.infer<typeof AddServiceParamsSchema>;
export type ServiceNameParams = z.infer<typeof ServiceNameParamsSchema>;
export type UpdateServiceParams = z.infer<typeof UpdateServiceParamsSchema>;
export type GetLogsParams = z.infer<typeof GetLogsParamsSchema>;
export type StreamLogsParams = z.infer<typeof StreamLogsParamsSchema>;
export type StopLogStreamParams = z.infer<typeof StopLogStreamParamsSchema>;
export type SubscribeParams = z.infer<typeof SubscribeParamsSchema>;

export type PingResult = z.infer<typeof PingResultSchema>;
export type VersionResult = z.infer<typeof VersionResultSchema>;
export type DaemonStatusResult = z.infer<typeof DaemonStatusResultSchema>;
export type ServiceListResult = z.infer<typeof ServiceListResultSchema>;
export type ServiceStatusResult = z.infer<typeof ServiceStatusResultSchema>;
export type UpdateCheckResult = z.infer<typeof UpdateCheckResultSchema>;

export type ServiceEventPayload = z.infer<typeof ServiceEventPayloadSchema>;
export type UpdateEventPayload = z.infer<typeof UpdateEventPayloadSchema>;
export type ConfigEventPayload = z.infer<typeof ConfigEventPayloadSchema>;
export type LogLineEventPayload = z.infer<typeof LogLineEventPayloadSchema>;

// Message framing for socket communication
export interface IPCMessage {
  type: "request" | "response" | "notification";
  data: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;
}

// Client connection metadata
export interface IPCClientConnection {
  id: string;
  socket: import("node:net").Socket;
  subscriptions: Set<IPCEvent>;
  serviceFilter: Set<string>;
  authenticated: boolean;
  connectedAt: Date;
}
