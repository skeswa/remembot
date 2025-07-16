import { EventEmitter } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import pino, { type Logger } from "pino";
import type { ServiceConfig, ServiceStatus } from "./types";
import { AppConfigManager } from "./app-config-manager";
import { ProcessManager } from "./process-manager";
import { GitHubMonitor } from "./github-monitor";
import { UpdateManager } from "./update-manager";

interface ServiceManagerOptions {
  configPath?: string;
  logDir?: string;
  checkInterval?: number;
}

export class ServiceManager extends EventEmitter {
  private readonly appConfigManager: AppConfigManager;
  private readonly processManager: ProcessManager;
  private readonly updateManager: UpdateManager;
  private readonly logger: Logger;
  private readonly monitors: Map<string, GitHubMonitor> = new Map();
  private readonly checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(options: ServiceManagerOptions = {}) {
    super();

    this.appConfigManager = new AppConfigManager();

    // Setup logging
    const logDir = this.resolveLogDir(
      options.logDir || this.appConfigManager.getLogDir(),
    );
    this.ensureLogDir(logDir);

    this.logger = pino({
      level: this.appConfigManager.getLogLevel(),
      transport: {
        targets: [
          {
            target: "pino/file",
            options: {
              destination: resolve(logDir, "macrounder.log"),
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

    this.processManager = new ProcessManager(this.logger, logDir);
    this.updateManager = new UpdateManager(this.logger);

    this.setupEventHandlers();
  }

  private resolveLogDir(logDir: string): string {
    return logDir.replace("~", homedir());
  }

  private ensureLogDir(logDir: string): void {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  private setupEventHandlers(): void {
    // Forward process manager events
    this.processManager.on("started", (data) => {
      this.emit("started", data);
    });

    this.processManager.on("stopped", (data) => {
      this.emit("stopped", data);
    });

    this.processManager.on("error", (data) => {
      this.emit("error", data);
    });

    // Handle process termination
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("ServiceManager is already running");
    }

    this.logger.info("Starting ServiceManager");
    this.isRunning = true;

    const services = this.appConfigManager.getAllServices();

    for (const service of services) {
      try {
        await this.startService(service);
      } catch (error) {
        this.logger.error(
          { service: service.name, error },
          "Failed to start service",
        );
      }
    }

    // Start update monitoring
    this.startUpdateMonitoring();
  }

  async startService(service: ServiceConfig): Promise<void> {
    // Start the process if autoStart is enabled
    if (service.autoStart) {
      await this.processManager.start(service);
    }

    // Create GitHub monitor
    const monitor = new GitHubMonitor(
      service.repository,
      this.logger,
      await this.getCurrentVersion(service),
    );
    this.monitors.set(service.name, monitor);
  }

  private startUpdateMonitoring(): void {
    const services = this.appConfigManager.getAllServices();

    for (const service of services) {
      this.scheduleUpdateCheck(service);
    }
  }

  private scheduleUpdateCheck(service: ServiceConfig): void {
    const checkUpdate = async () => {
      try {
        const monitor = this.monitors.get(service.name);
        if (!monitor) return;

        const updateInfo = await monitor.checkForUpdate();

        if (updateInfo.available && updateInfo.release) {
          this.logger.info(
            {
              service: service.name,
              currentVersion: updateInfo.currentVersion,
              latestVersion: updateInfo.latestVersion,
            },
            "Update available",
          );

          this.emit("updateAvailable", {
            service: service.name,
            update: updateInfo,
          });

          // Perform automatic update if service is running
          if (this.processManager.isRunning(service.name)) {
            await this.updateService(service.name);
          }
        }
      } catch (error) {
        this.logger.error(
          { service: service.name, error },
          "Failed to check for updates",
        );
      }
    };

    // Initial check
    checkUpdate();

    // Schedule periodic checks
    const interval = setInterval(checkUpdate, service.checkInterval * 1000);
    this.checkIntervals.set(service.name, interval);
  }

  async updateService(serviceName: string): Promise<void> {
    const service = this.appConfigManager.getService(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const monitor = this.monitors.get(serviceName);
    if (!monitor) {
      throw new Error(`No monitor found for service ${serviceName}`);
    }

    const updateInfo = await monitor.checkForUpdate();
    if (!updateInfo.available || !updateInfo.release) {
      this.logger.info({ service: serviceName }, "No update available");
      return;
    }

    this.emit("updateStarted", {
      service: serviceName,
      version: updateInfo.latestVersion!,
    });

    try {
      // Stop the service
      const wasRunning = this.processManager.isRunning(serviceName);
      if (wasRunning) {
        await this.processManager.stop(serviceName);
      }

      // Download and install update
      await this.updateManager.downloadAndInstall(service, updateInfo.release);

      // Update the monitor's current version
      monitor.setCurrentVersion(updateInfo.latestVersion!);

      // Restart the service if it was running
      if (wasRunning) {
        await this.processManager.start(service);
      }

      this.emit("updateCompleted", {
        service: serviceName,
        version: updateInfo.latestVersion!,
      });
    } catch (error) {
      this.logger.error(
        { service: serviceName, error },
        "Failed to update service",
      );

      this.emit("updateFailed", {
        service: serviceName,
        error: error as Error,
      });

      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addService(_service: ServiceConfig): Promise<void> {
    throw new Error(
      "Use 'macrounder add' command to add apps with TOML config",
    );
  }

  async removeService(serviceName: string): Promise<void> {
    // Stop monitoring
    const interval = this.checkIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(serviceName);
    }

    // Stop the service
    if (this.processManager.isRunning(serviceName)) {
      await this.processManager.stop(serviceName);
    }

    // Remove from config
    throw new Error(
      "Use 'macrounder remove' command to remove apps with TOML config",
    );
  }

  async stopService(serviceName: string): Promise<void> {
    await this.processManager.stop(serviceName);
  }

  async startServiceProcess(serviceName: string): Promise<void> {
    const service = this.appConfigManager.getService(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    await this.processManager.start(service);
  }

  async restartService(serviceName: string): Promise<void> {
    await this.processManager.restart(serviceName);
  }

  getServiceStatus(serviceName: string): ServiceStatus {
    const status = this.processManager.getStatus(serviceName);
    const monitor = this.monitors.get(serviceName);

    if (monitor) {
      // Add version information if available
      const config = this.appConfigManager.getService(serviceName);
      if (config) {
        status.currentVersion = "unknown"; // Would need to implement version detection
      }
    }

    return status;
  }

  getAllStatuses(): ServiceStatus[] {
    const services = this.appConfigManager.getAllServices();
    return services.map((service) => this.getServiceStatus(service.name));
  }

  getLogFilePath(serviceName: string): string | undefined {
    return this.processManager.getLogFilePath(serviceName);
  }

  private async getCurrentVersion(
    service: ServiceConfig,
  ): Promise<string | undefined> {
    // This would need to be implemented based on how versions are tracked
    // Could read from a version file, parse binary output, etc.
    // For now, return undefined since this is a placeholder
    console.log(`Getting version for service: ${service.name}`);
    return undefined;
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down ServiceManager");
    this.isRunning = false;

    // Clear all update check intervals
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();

    // Stop all processes
    await this.processManager.shutdown();

    // Clean up downloads
    this.updateManager.cleanupDownloads();

    this.removeAllListeners();
    process.exit(0);
  }
}
