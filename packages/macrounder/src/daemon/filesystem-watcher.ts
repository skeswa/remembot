import { EventEmitter } from "node:events";
import { watch, type FSWatcher, type WatchEventType } from "node:fs";
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pino, { type Logger } from "pino";

interface FileSystemWatcherOptions {
  watchPath: string;
  logger?: Logger;
  debounceMs?: number;
}

interface WatchEvent {
  type: "created" | "updated" | "deleted";
  path: string;
  timestamp: Date;
}

export class FileSystemWatcher extends EventEmitter {
  private readonly watchPath: string;
  private readonly logger: Logger;
  private readonly debounceMs: number;
  private watcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private fileStates: Map<string, { mtime: number; size: number }> = new Map();

  constructor(options: FileSystemWatcherOptions) {
    super();

    this.watchPath = options.watchPath;
    this.debounceMs = options.debounceMs || 500;
    this.logger =
      options.logger ||
      pino({
        name: "fs-watcher",
        level: "info",
      });
  }

  /**
   * Start watching the filesystem
   */
  async start(): Promise<void> {
    if (this.watcher) {
      throw new Error("FileSystemWatcher is already running");
    }

    // Ensure watch path exists
    if (!existsSync(this.watchPath)) {
      throw new Error(`Watch path does not exist: ${this.watchPath}`);
    }

    // Initialize file states
    this.initializeFileStates();

    // Start watching
    this.watcher = watch(
      this.watchPath,
      { persistent: true, recursive: false },
      this.handleWatchEvent.bind(this),
    );

    this.watcher.on("error", (error) => {
      this.logger.error({ error, watchPath: this.watchPath }, "Watch error");
      this.emit("error", error);
    });

    this.logger.info(
      { watchPath: this.watchPath },
      "Started watching directory",
    );
  }

  /**
   * Stop watching the filesystem
   */
  async stop(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.fileStates.clear();
    this.logger.info("Stopped watching directory");
  }

  /**
   * Initialize file states for change detection
   */
  private initializeFileStates(): void {
    try {
      const files = this.getTomlFiles();

      for (const file of files) {
        const filepath = resolve(this.watchPath, file);
        const stat = statSync(filepath);

        this.fileStates.set(file, {
          mtime: stat.mtimeMs,
          size: stat.size,
        });
      }

      this.logger.debug({ fileCount: files.length }, "Initialized file states");
    } catch (error) {
      this.logger.error({ error }, "Failed to initialize file states");
    }
  }

  /**
   * Handle filesystem watch events
   */
  private handleWatchEvent(
    _eventType: WatchEventType,
    filename: string | null,
  ): void {
    if (!filename) {
      return;
    }

    // Only watch TOML files
    if (!filename.endsWith(".toml")) {
      return;
    }

    const filepath = resolve(this.watchPath, filename);

    // Debounce the event
    this.debounceEvent(filename, () => {
      this.processFileChange(filepath, filename);
    });
  }

  /**
   * Process a file change after debouncing
   */
  private processFileChange(filepath: string, filename: string): void {
    try {
      const exists = existsSync(filepath);
      const previousState = this.fileStates.get(filename);

      if (!exists && previousState) {
        // File was deleted
        this.fileStates.delete(filename);
        this.emitConfigEvent("deleted", filepath);
      } else if (exists && !previousState) {
        // File was created
        const stat = statSync(filepath);
        this.fileStates.set(filename, {
          mtime: stat.mtimeMs,
          size: stat.size,
        });
        this.emitConfigEvent("created", filepath);
      } else if (exists && previousState) {
        // File might have been updated
        const stat = statSync(filepath);

        if (
          stat.mtimeMs !== previousState.mtime ||
          stat.size !== previousState.size
        ) {
          this.fileStates.set(filename, {
            mtime: stat.mtimeMs,
            size: stat.size,
          });
          this.emitConfigEvent("updated", filepath);
        }
      }
    } catch (error) {
      this.logger.error({ error, filepath }, "Error processing file change");
    }
  }

  /**
   * Emit a configuration event
   */
  private emitConfigEvent(
    type: "created" | "updated" | "deleted",
    path: string,
  ): void {
    const event: WatchEvent = {
      type,
      path,
      timestamp: new Date(),
    };

    this.logger.info({ type, path }, `Configuration file ${type}`);

    // Emit specific event
    switch (type) {
      case "created":
        this.emit("configCreated", event);
        break;
      case "updated":
        this.emit("configUpdated", event);
        break;
      case "deleted":
        this.emit("configDeleted", event);
        break;
    }

    // Emit generic event
    this.emit("configChanged", event);
  }

  /**
   * Debounce filesystem events
   */
  private debounceEvent(key: string, callback: () => void): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      callback();
    }, this.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Get list of TOML files in watch directory
   */
  private getTomlFiles(): string[] {
    try {
      const files = readdirSync(this.watchPath);
      return files.filter((file: string) => file.endsWith(".toml"));
    } catch (error) {
      this.logger.error({ error }, "Failed to read directory");
      return [];
    }
  }
}
