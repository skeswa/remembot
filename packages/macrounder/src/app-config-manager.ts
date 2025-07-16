import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import * as TOML from "@iarna/toml";
import { getMacrounderHome } from "./config/paths";
import type { AppConfig, GlobalConfig } from "./app-config";
import {
  AppConfigSchema,
  GlobalConfigSchema,
  appConfigToServiceConfig,
} from "./app-config";
import type { ServiceConfig } from "./types";

export class AppConfigManager {
  private readonly baseDir: string;
  private readonly appsDir: string;
  private readonly globalConfigPath: string;
  private globalConfig: GlobalConfig | null = null;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || getMacrounderHome();
    this.appsDir = resolve(this.baseDir, "apps");
    this.globalConfigPath = resolve(this.baseDir, "config.toml");
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    if (!existsSync(this.appsDir)) {
      mkdirSync(this.appsDir, { recursive: true });
    }
  }

  // App management methods
  getApp(name: string): AppConfig {
    return this.loadApp(name);
  }

  loadApp(name: string): AppConfig {
    const configPath = this.getAppConfigPath(name);

    if (!existsSync(configPath)) {
      throw new Error(`App configuration not found: ${name}`);
    }

    try {
      const tomlContent = readFileSync(configPath, "utf-8");
      const parsed = TOML.parse(tomlContent);
      return AppConfigSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load app config for ${name}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  saveApp(config: AppConfig): void {
    const configPath = this.getAppConfigPath(config.app.name);

    try {
      const tomlContent = TOML.stringify(config as TOML.JsonMap);
      writeFileSync(configPath, tomlContent, "utf-8");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to save app config for ${config.app.name}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  deleteApp(name: string): void {
    const configPath = this.getAppConfigPath(name);

    if (!existsSync(configPath)) {
      throw new Error(`App configuration not found: ${name}`);
    }

    try {
      unlinkSync(configPath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to delete app config for ${name}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  listApps(): string[] {
    try {
      const files = readdirSync(this.appsDir);
      return files
        .filter((file) => file.endsWith(".toml"))
        .map((file) => basename(file, ".toml"));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list apps: ${error.message}`);
      }
      throw error;
    }
  }

  appExists(name: string): boolean {
    return existsSync(this.getAppConfigPath(name));
  }

  // Convert to legacy ServiceConfig for compatibility
  getService(name: string): ServiceConfig {
    const appConfig = this.loadApp(name);
    return appConfigToServiceConfig(appConfig);
  }

  getAllServices(): ServiceConfig[] {
    const appNames = this.listApps();
    return appNames.map((name) => this.getService(name));
  }

  // Global configuration methods
  loadGlobalConfig(): GlobalConfig {
    if (this.globalConfig) {
      return this.globalConfig;
    }

    if (!existsSync(this.globalConfigPath)) {
      this.createDefaultGlobalConfig();
    }

    try {
      const tomlContent = readFileSync(this.globalConfigPath, "utf-8");
      const parsed = TOML.parse(tomlContent);
      this.globalConfig = GlobalConfigSchema.parse(parsed);
      return this.globalConfig;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load global config: ${error.message}`);
      }
      throw error;
    }
  }

  saveGlobalConfig(config: GlobalConfig): void {
    try {
      const tomlContent = TOML.stringify(config as TOML.JsonMap);
      writeFileSync(this.globalConfigPath, tomlContent, "utf-8");
      this.globalConfig = config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save global config: ${error.message}`);
      }
      throw error;
    }
  }

  private createDefaultGlobalConfig(): void {
    const defaultConfig: GlobalConfig = {
      log_level: "info",
      log_dir: "~/.macrounder/logs",
    };

    this.saveGlobalConfig(defaultConfig);
  }

  getLogDir(): string {
    const config = this.loadGlobalConfig();
    const logDir = config.log_dir || "~/.macrounder/logs";
    return logDir.replace("~", homedir());
  }

  getLogLevel(): string {
    const config = this.loadGlobalConfig();
    return config.log_level || "info";
  }

  // Helper methods
  private getAppConfigPath(name: string): string {
    return resolve(this.appsDir, `${name}.toml`);
  }
}
