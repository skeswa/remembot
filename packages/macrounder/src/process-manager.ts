import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceConfig, ServiceStatus } from "./types";
import type { Logger } from "pino";
import { getLogFilePath } from "./logger";
import { createWriteStream, type WriteStream } from "fs";

interface ProcessInfo {
  process: ChildProcess;
  config: ServiceConfig;
  startTime: Date;
  restartCount: number;
  lastError?: Error;
  logStream?: WriteStream;
  logFilePath: string;
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();
  private readonly logger: Logger;
  private readonly maxRestarts = 5;
  private readonly restartDelay = 5000; // 5 seconds
  private readonly logDir: string;

  constructor(logger: Logger, logDir: string) {
    super();
    this.logger = logger;
    this.logDir = logDir;
  }

  async start(config: ServiceConfig): Promise<void> {
    if (this.processes.has(config.name)) {
      throw new Error(`Service ${config.name} is already running`);
    }

    const binaryPath = resolve(config.binaryPath);
    if (!existsSync(binaryPath)) {
      throw new Error(`Binary not found: ${binaryPath}`);
    }

    this.logger.info({ service: config.name }, "Starting service");

    const env = {
      ...process.env,
      ...config.env,
    };

    const cwd = config.workingDirectory
      ? resolve(config.workingDirectory)
      : process.cwd();

    const childProcess = spawn(binaryPath, config.args || [], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Create log file for this service
    const logFilePath = getLogFilePath(this.logDir, config.name);
    const logStream = createWriteStream(logFilePath, { flags: "a" });

    const processInfo: ProcessInfo = {
      process: childProcess,
      config,
      startTime: new Date(),
      restartCount: 0,
      logFilePath,
      logStream,
    };

    this.processes.set(config.name, processInfo);

    // Handle stdout
    childProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      const trimmedOutput = output.trim();

      // Write to service log file
      const timestamp = new Date().toISOString();
      logStream.write(`[${timestamp}] [STDOUT] ${output}`);

      // Also log to main logger
      this.logger.info(
        { service: config.name, output: trimmedOutput },
        "Service output",
      );
    });

    // Handle stderr
    childProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      const trimmedOutput = output.trim();

      // Write to service log file
      const timestamp = new Date().toISOString();
      logStream.write(`[${timestamp}] [STDERR] ${output}`);

      // Also log to main logger
      this.logger.error(
        { service: config.name, error: trimmedOutput },
        "Service error output",
      );
    });

    // Handle process exit
    childProcess.on("exit", (code, signal) => {
      this.logger.warn(
        { service: config.name, code, signal },
        "Service exited",
      );

      // Close log stream
      logStream.end();

      this.processes.delete(config.name);
      this.emit("stopped", { service: config.name, code });

      // Auto-restart if configured
      if (config.autoStart && code !== 0) {
        this.handleAutoRestart(config, processInfo);
      }
    });

    // Handle errors
    childProcess.on("error", (error) => {
      this.logger.error(
        { service: config.name, error: error.message },
        "Service process error",
      );

      // Close log stream
      logStream.end();

      processInfo.lastError = error;
      this.processes.delete(config.name);
      this.emit("error", { service: config.name, error });
    });

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Service failed to start within timeout"));
      }, 10000);

      childProcess.once("spawn", () => {
        clearTimeout(timeout);
        this.emit("started", {
          service: config.name,
          pid: childProcess.pid!,
        });
        resolve();
      });

      childProcess.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async stop(serviceName: string): Promise<void> {
    const processInfo = this.processes.get(serviceName);
    if (!processInfo) {
      throw new Error(`Service ${serviceName} is not running`);
    }

    this.logger.info({ service: serviceName }, "Stopping service");

    return new Promise((resolve, reject) => {
      const { process: childProcess } = processInfo;

      let killed = false;
      const timeout = setTimeout(() => {
        if (!killed) {
          this.logger.warn(
            { service: serviceName },
            "Service did not stop gracefully, force killing",
          );
          childProcess.kill("SIGKILL");
        }
      }, 30000); // 30 second grace period

      childProcess.once("exit", () => {
        clearTimeout(timeout);
        killed = true;
        this.processes.delete(serviceName);
        resolve();
      });

      childProcess.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Send SIGTERM for graceful shutdown
      childProcess.kill("SIGTERM");
    });
  }

  async restart(serviceName: string): Promise<void> {
    const processInfo = this.processes.get(serviceName);
    if (!processInfo) {
      throw new Error(`Service ${serviceName} is not running`);
    }

    const { config } = processInfo;
    await this.stop(serviceName);
    await this.start(config);
  }

  getStatus(serviceName: string): ServiceStatus {
    const processInfo = this.processes.get(serviceName);

    if (!processInfo) {
      return {
        name: serviceName,
        status: "stopped",
      };
    }

    const uptime = Date.now() - processInfo.startTime.getTime();

    return {
      name: serviceName,
      pid: processInfo.process.pid,
      status: "running",
      uptime,
      lastError: processInfo.lastError?.message,
    };
  }

  getAllStatuses(): ServiceStatus[] {
    const statuses: ServiceStatus[] = [];

    for (const [name, info] of this.processes) {
      const uptime = Date.now() - info.startTime.getTime();
      statuses.push({
        name,
        pid: info.process.pid,
        status: "running",
        uptime,
        lastError: info.lastError?.message,
      });
    }

    return statuses;
  }

  isRunning(serviceName: string): boolean {
    return this.processes.has(serviceName);
  }

  getLogFilePath(serviceName: string): string | undefined {
    const processInfo = this.processes.get(serviceName);
    return processInfo?.logFilePath || getLogFilePath(this.logDir, serviceName);
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map((name) =>
      this.stop(name).catch((error) => {
        this.logger.error({ service: name, error }, "Failed to stop service");
      }),
    );

    await Promise.all(stopPromises);
  }

  private async handleAutoRestart(
    config: ServiceConfig,
    previousInfo: ProcessInfo,
  ): Promise<void> {
    if (previousInfo.restartCount >= this.maxRestarts) {
      this.logger.error(
        { service: config.name, restartCount: previousInfo.restartCount },
        "Service exceeded maximum restart attempts",
      );
      return;
    }

    this.logger.info(
      {
        service: config.name,
        attempt: previousInfo.restartCount + 1,
        maxAttempts: this.maxRestarts,
      },
      "Auto-restarting service",
    );

    setTimeout(async () => {
      try {
        await this.start(config);
        // Update restart count if we have the new process info
        const newInfo = this.processes.get(config.name);
        if (newInfo) {
          newInfo.restartCount = previousInfo.restartCount + 1;
        }
      } catch (error) {
        this.logger.error(
          { service: config.name, error },
          "Failed to restart service",
        );
      }
    }, this.restartDelay);
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down all services");
    await this.stopAll();
    this.removeAllListeners();
  }
}
