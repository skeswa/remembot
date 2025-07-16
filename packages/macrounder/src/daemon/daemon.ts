import { EventEmitter } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pino, { type Logger } from "pino";
import { getMacrounderHome, getLogsDir, getAppsDir } from "../config/paths";
import { ServiceManager } from "../service-manager";
import { AppConfigManager } from "../app-config-manager";
import { createDefaultAppConfig, type AppConfig } from "../app-config";
import { IPCServer } from "./ipc-server";
import { FileSystemWatcher } from "./filesystem-watcher";
import { readLogFile, followLogFile } from "../logger";
import { IPCError } from "../ipc/error";
import {
  IPCMethod,
  IPCEvent,
  IPCErrorCode,
  IPC_PROTOCOL_VERSION,
  type AddServiceParams,
  type ServiceNameParams,
  type GetLogsParams,
  type StreamLogsParams,
  type StopLogStreamParams,
} from "../ipc/types";

interface DaemonOptions {
  socketPath?: string;
  logDir?: string;
  configDir?: string;
}

export class Daemon extends EventEmitter {
  private readonly logger: Logger;
  private readonly serviceManager: ServiceManager;
  private readonly configManager: AppConfigManager;
  private readonly ipcServer: IPCServer;
  private readonly fsWatcher: FileSystemWatcher;
  private readonly startTime: Date;
  private isRunning = false;
  private logStreams: Map<string, AbortController> = new Map();

  constructor(options: DaemonOptions = {}) {
    super();

    // Setup directories
    const baseDir = getMacrounderHome();
    const logDir = options.logDir || getLogsDir();
    const configDir = options.configDir || getAppsDir();

    this.ensureDirectories([baseDir, logDir, configDir]);

    // Setup logger
    this.logger = pino({
      name: "macrounder-daemon",
      level: "info",
      transport: {
        targets: [
          {
            target: "pino/file",
            options: {
              destination: resolve(logDir, "daemon.log"),
              mkdir: true,
            },
          },
          {
            target: "pino-pretty",
            options: {
              colorize: true,
            },
          },
        ],
      },
    });

    // Initialize components
    this.serviceManager = new ServiceManager({ logDir });
    this.configManager = new AppConfigManager();
    this.ipcServer = new IPCServer({
      socketPath: options.socketPath,
      logger: this.logger.child({ component: "ipc-server" }),
    });
    this.fsWatcher = new FileSystemWatcher({
      watchPath: configDir,
      logger: this.logger.child({ component: "fs-watcher" }),
    });

    this.startTime = new Date();

    this.setupEventHandlers();
    this.registerIPCHandlers();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Daemon is already running");
    }

    this.logger.info("Starting macrounder daemon...");

    try {
      // Start IPC server
      await this.ipcServer.start();

      // Start filesystem watcher
      await this.fsWatcher.start();

      // Start service manager
      await this.serviceManager.start();

      this.isRunning = true;
      this.logger.info("Macrounder daemon started successfully");
    } catch (error) {
      this.logger.error({ error }, "Failed to start daemon");
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("Stopping macrounder daemon...");

    try {
      // Stop service manager
      await this.serviceManager.shutdown();

      // Stop filesystem watcher
      await this.fsWatcher.stop();

      // Stop IPC server
      await this.ipcServer.stop();

      this.isRunning = false;
      this.logger.info("Macrounder daemon stopped");
    } catch (error) {
      this.logger.error({ error }, "Error stopping daemon");
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward service manager events to IPC clients
    this.serviceManager.on("started", (data) => {
      this.ipcServer.sendNotification(IPCEvent.ServiceStarted, {
        service: data.service,
        status: "running",
        pid: data.pid,
      });
    });

    this.serviceManager.on("stopped", (data) => {
      this.ipcServer.sendNotification(IPCEvent.ServiceStopped, {
        service: data.service,
        status: "stopped",
      });
    });

    this.serviceManager.on("error", (data) => {
      this.ipcServer.sendNotification(IPCEvent.ServiceError, {
        service: data.service,
        status: "error",
        error: data.error.message,
      });
    });

    this.serviceManager.on("updateAvailable", (data) => {
      this.ipcServer.sendNotification(IPCEvent.UpdateAvailable, {
        service: data.service,
        currentVersion: data.update.currentVersion,
        latestVersion: data.update.latestVersion,
      });
    });

    this.serviceManager.on("updateStarted", (data) => {
      this.ipcServer.sendNotification(IPCEvent.UpdateStarted, {
        service: data.service,
        version: data.version,
      });
    });

    this.serviceManager.on("updateCompleted", (data) => {
      this.ipcServer.sendNotification(IPCEvent.UpdateCompleted, {
        service: data.service,
        version: data.version,
      });
    });

    this.serviceManager.on("updateFailed", (data) => {
      this.ipcServer.sendNotification(IPCEvent.UpdateFailed, {
        service: data.service,
        error: data.error.message,
      });
    });

    // Handle filesystem watcher events
    this.fsWatcher.on("configCreated", async (data) => {
      this.logger.info({ path: data.path }, "New configuration file detected");
      await this.handleConfigCreated(data.path);
    });

    this.fsWatcher.on("configUpdated", async (data) => {
      this.logger.info({ path: data.path }, "Configuration file updated");
      await this.handleConfigUpdated(data.path);
    });

    this.fsWatcher.on("configDeleted", async (data) => {
      this.logger.info({ path: data.path }, "Configuration file deleted");
      await this.handleConfigDeleted(data.path);
    });

    // Handle process signals
    process.on("SIGINT", () => this.handleShutdown("SIGINT"));
    process.on("SIGTERM", () => this.handleShutdown("SIGTERM"));
  }

  /**
   * Register IPC method handlers
   */
  private registerIPCHandlers(): void {
    // Daemon management
    this.ipcServer.registerMethod(IPCMethod.GetVersion, () => ({
      version: "0.1.0", // TODO: Get from package.json
      protocolVersion: IPC_PROTOCOL_VERSION,
    }));

    this.ipcServer.registerMethod(IPCMethod.GetStatus, () => ({
      running: this.isRunning,
      pid: process.pid,
      uptime: Date.now() - this.startTime.getTime(),
      servicesCount: this.serviceManager.getAllStatuses().length,
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
      },
    }));

    this.ipcServer.registerMethod(IPCMethod.Shutdown, async () => {
      this.logger.info("Shutdown requested via IPC");
      setTimeout(() => this.stop(), 100); // Delay to allow response
      return { shuttingDown: true };
    });

    // Service management
    this.ipcServer.registerMethod(IPCMethod.AddService, async (params) => {
      const typedParams = params as AddServiceParams;
      const { name, repository, config } = typedParams;

      if (this.configManager.appExists(name)) {
        throw {
          code: IPCErrorCode.ServiceAlreadyExists,
          message: `Service ${name} already exists`,
        };
      }

      const appConfig = config
        ? (config as AppConfig)
        : createDefaultAppConfig(name, repository);

      this.configManager.saveApp(appConfig);
      await this.serviceManager.startServiceProcess(name);

      return { success: true };
    });

    this.ipcServer.registerMethod(IPCMethod.RemoveService, async (params) => {
      const { name } = params as ServiceNameParams;

      if (!this.configManager.appExists(name)) {
        throw {
          code: IPCErrorCode.ServiceNotFound,
          message: `Service ${name} not found`,
        };
      }

      await this.serviceManager.stopService(name);
      this.configManager.deleteApp(name);

      return { success: true };
    });

    this.ipcServer.registerMethod(IPCMethod.ListServices, () => {
      return this.configManager.listApps();
    });

    this.ipcServer.registerMethod(IPCMethod.GetService, (params) => {
      const { name } = params as ServiceNameParams;

      if (!this.configManager.appExists(name)) {
        throw {
          code: IPCErrorCode.ServiceNotFound,
          message: `Service ${name} not found`,
        };
      }

      return this.configManager.loadApp(name);
    });

    this.ipcServer.registerMethod(IPCMethod.StartService, async (params) => {
      const { name } = params as ServiceNameParams;

      if (!this.configManager.appExists(name)) {
        throw {
          code: IPCErrorCode.ServiceNotFound,
          message: `Service ${name} not found`,
        };
      }

      await this.serviceManager.startServiceProcess(name);
      return { success: true };
    });

    this.ipcServer.registerMethod(IPCMethod.StopService, async (params) => {
      const { name } = params as ServiceNameParams;

      await this.serviceManager.stopService(name);
      return { success: true };
    });

    this.ipcServer.registerMethod(IPCMethod.RestartService, async (params) => {
      const { name } = params as ServiceNameParams;

      await this.serviceManager.restartService(name);
      return { success: true };
    });

    this.ipcServer.registerMethod(IPCMethod.GetServiceStatus, (params) => {
      const { name } = params as ServiceNameParams;
      const statuses = this.serviceManager.getAllStatuses();
      const status = statuses.find((s) => s.name === name);

      if (!status) {
        throw {
          code: IPCErrorCode.ServiceNotFound,
          message: `Service ${name} not found`,
        };
      }

      return status;
    });

    this.ipcServer.registerMethod(IPCMethod.GetAllStatuses, () => {
      return this.serviceManager.getAllStatuses();
    });

    // Update management
    this.ipcServer.registerMethod(IPCMethod.CheckUpdate, async () => {
      // TODO: Implement update check
      return {
        available: false,
        currentVersion: "0.1.0",
        latestVersion: "0.1.0",
      };
    });

    this.ipcServer.registerMethod(IPCMethod.ApplyUpdate, async (params) => {
      const { name } = params as ServiceNameParams;

      await this.serviceManager.updateService(name);
      return { success: true };
    });

    // Log management
    this.ipcServer.registerMethod(
      IPCMethod.GetLogs,
      async (params: unknown) => {
        const validatedParams = params as GetLogsParams;
        const { service, lines } = validatedParams;

        // Check if service exists
        const allServices = this.serviceManager.getAllStatuses();
        const serviceNames = allServices.map((s) => s.name);
        if (!serviceNames.includes(service)) {
          throw new IPCError(
            IPCErrorCode.ServiceNotFound,
            `Service ${service} not found`,
          );
        }

        // Get log file path from process manager
        const logFilePath = this.serviceManager.getLogFilePath(service);
        if (!logFilePath) {
          return { logs: [] };
        }

        try {
          const logs = await readLogFile(logFilePath, lines);
          return { logs };
        } catch (error) {
          this.logger.error({ error, service }, "Failed to read log file");
          return { logs: [] };
        }
      },
    );

    // Start log streaming
    this.ipcServer.registerMethod(
      IPCMethod.StreamLogs,
      async (params: unknown) => {
        const validatedParams = params as StreamLogsParams;
        const { service, lines } = validatedParams;

        // Check if service exists
        const allServices = this.serviceManager.getAllStatuses();
        const serviceNames = allServices.map((s) => s.name);
        if (!serviceNames.includes(service)) {
          throw new IPCError(
            IPCErrorCode.ServiceNotFound,
            `Service ${service} not found`,
          );
        }

        // Get log file path from process manager
        const logFilePath = this.serviceManager.getLogFilePath(service);
        if (!logFilePath) {
          return { success: false, message: "No log file found" };
        }

        // Start streaming logs
        this.startLogStream(service, logFilePath, lines);

        return { success: true, message: "Log streaming started" };
      },
    );

    // Stop log streaming
    this.ipcServer.registerMethod(
      IPCMethod.StopLogStream,
      async (params: unknown) => {
        const validatedParams = params as StopLogStreamParams;
        const { service } = validatedParams;

        // Stop streaming logs
        this.stopLogStream(service);

        return { success: true, message: "Log streaming stopped" };
      },
    );
  }

  /**
   * Handle configuration file creation
   */
  private async handleConfigCreated(path: string): Promise<void> {
    try {
      // Extract app name from filename
      const filename = path.split("/").pop();
      if (!filename?.endsWith(".toml")) {
        return;
      }

      const appName = filename.replace(".toml", "");

      // Load and validate configuration
      let appConfig;
      try {
        appConfig = this.configManager.loadApp(appName);
      } catch {
        return;
      }

      // Start service if auto_start is enabled
      if (appConfig.app.auto_start) {
        await this.serviceManager.startServiceProcess(appName);
      }

      // Send notification
      this.ipcServer.sendNotification(IPCEvent.ConfigChanged, {
        service: appName,
        action: "created",
        path,
      });
    } catch (error) {
      this.logger.error({ error, path }, "Failed to handle config creation");
    }
  }

  /**
   * Handle configuration file update
   */
  private async handleConfigUpdated(path: string): Promise<void> {
    try {
      // Extract app name from filename
      const filename = path.split("/").pop();
      if (!filename?.endsWith(".toml")) {
        return;
      }

      const appName = filename.replace(".toml", "");

      // Reload configuration (loadApp will re-read from disk)
      this.configManager.loadApp(appName);

      // Restart service to apply changes
      const statuses = this.serviceManager.getAllStatuses();
      const status = statuses.find((s) => s.name === appName);

      if (status && status.status === "running") {
        await this.serviceManager.restartService(appName);
      }

      // Send notification
      this.ipcServer.sendNotification(IPCEvent.ConfigChanged, {
        service: appName,
        action: "updated",
        path,
      });

      this.ipcServer.sendNotification(IPCEvent.ConfigReloaded, {
        service: appName,
      });
    } catch (error) {
      this.logger.error({ error, path }, "Failed to handle config update");
    }
  }

  /**
   * Handle configuration file deletion
   */
  private async handleConfigDeleted(path: string): Promise<void> {
    try {
      // Extract app name from filename
      const filename = path.split("/").pop();
      if (!filename?.endsWith(".toml")) {
        return;
      }

      const appName = filename.replace(".toml", "");

      // Stop service
      await this.serviceManager.stopService(appName);

      // Send notification
      this.ipcServer.sendNotification(IPCEvent.ConfigChanged, {
        service: appName,
        action: "deleted",
        path,
      });
    } catch (error) {
      this.logger.error({ error, path }, "Failed to handle config deletion");
    }
  }

  /**
   * Handle shutdown signals
   */
  private async handleShutdown(signal: string): Promise<void> {
    this.logger.info({ signal }, "Received shutdown signal");

    // Send shutdown notification
    this.ipcServer.sendNotification(IPCEvent.DaemonShutdown, {
      signal,
    });

    await this.stop();
    process.exit(0);
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(dirs: string[]): void {
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Start streaming logs for a service
   */
  private async startLogStream(
    service: string,
    logFilePath: string,
    initialLines: number,
  ): Promise<void> {
    // Stop existing stream if any
    this.stopLogStream(service);

    this.logger.info(
      { service, logFilePath, initialLines },
      "Starting log stream",
    );

    // Create abort controller for this stream
    const abortController = new AbortController();
    this.logStreams.set(service, abortController);

    // Start streaming in background
    (async () => {
      try {
        for await (const line of followLogFile(
          logFilePath,
          initialLines,
          abortController.signal,
        )) {
          // Send log line to all subscribed clients
          this.ipcServer.sendNotification(
            IPCEvent.LogLine,
            {
              service,
              line,
              timestamp: new Date().toISOString(),
            },
            (connection) => {
              // Only send to clients that have subscribed to this specific service
              return (
                connection.serviceFilter.size === 0 ||
                connection.serviceFilter.has(service)
              );
            },
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          this.logger.error({ error, service }, "Error streaming logs");
        }
      } finally {
        this.logStreams.delete(service);
      }
    })();
  }

  /**
   * Stop streaming logs for a service
   */
  private stopLogStream(service: string): void {
    const abortController = this.logStreams.get(service);
    if (abortController) {
      abortController.abort();
      this.logStreams.delete(service);
    }
  }
}
