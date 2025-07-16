import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import type { Config, ServiceConfig } from "./types";
import { ConfigSchema, ServiceConfigSchema } from "./types";

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }

  private getDefaultConfigPath(): string {
    return resolve(homedir(), ".macrounder", "config.json");
  }

  private loadConfig(): Config {
    if (!existsSync(this.configPath)) {
      this.createDefaultConfig();
    }

    try {
      const rawConfig = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(rawConfig);
      return ConfigSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config: ${error.message}`);
      }
      throw error;
    }
  }

  private createDefaultConfig(): void {
    const defaultConfig: Config = {
      services: [],
      logLevel: "info",
      logDir: "~/.macrounder/logs",
    };

    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
  }

  saveConfig(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getConfig(): Config {
    return this.config;
  }

  getService(name: string): ServiceConfig | undefined {
    return this.config.services.find((s) => s.name === name);
  }

  addService(service: ServiceConfig): void {
    const existing = this.config.services.findIndex(
      (s) => s.name === service.name,
    );
    if (existing !== -1) {
      throw new Error(`Service ${service.name} already exists`);
    }

    this.config.services.push(service);
    this.saveConfig();
  }

  updateService(name: string, updates: Partial<ServiceConfig>): void {
    const index = this.config.services.findIndex((s) => s.name === name);
    if (index === -1) {
      throw new Error(`Service ${name} not found`);
    }

    const updatedService = {
      ...this.config.services[index],
      ...updates,
      name, // Ensure name cannot be changed
    };

    // Validate the updated service
    const validated = ServiceConfigSchema.parse(updatedService);
    this.config.services[index] = validated;
    this.saveConfig();
  }

  removeService(name: string): void {
    const index = this.config.services.findIndex((s) => s.name === name);
    if (index === -1) {
      throw new Error(`Service ${name} not found`);
    }

    this.config.services.splice(index, 1);
    this.saveConfig();
  }

  getAllServices(): ServiceConfig[] {
    return this.config.services;
  }

  getLogDir(): string {
    const logDir = this.config.logDir || "~/.macrounder/logs";
    return logDir.replace("~", homedir());
  }

  getLogLevel(): string {
    return this.config.logLevel || "info";
  }
}
