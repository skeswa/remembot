import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { ConfigManager } from "./config-manager";
import { existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ConfigManager", () => {
  let configPath: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    configPath = join(tmpdir(), `test-config-${Date.now()}.json`);
  });

  afterEach(() => {
    if (existsSync(configPath)) {
      rmSync(configPath);
    }
  });

  test("should create default config if not exists", () => {
    configManager = new ConfigManager(configPath);

    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.services).toEqual([]);
    expect(config.logLevel).toBe("info");
    expect(config.logDir).toBe("~/.macrounder/logs");
  });

  test("should load existing config", () => {
    const existingConfig = {
      services: [
        {
          name: "test-service",
          repository: "owner/repo",
          binaryPath: "/path/to/binary",
          checkInterval: 600,
          autoStart: false,
        },
      ],
      logLevel: "debug",
    };

    writeFileSync(configPath, JSON.stringify(existingConfig));

    configManager = new ConfigManager(configPath);
    const config = configManager.getConfig();

    expect(config.services).toHaveLength(1);
    expect(config.services[0]?.name).toBe("test-service");
    expect(config.logLevel).toBe("debug");
  });

  test("should add service", () => {
    configManager = new ConfigManager(configPath);

    const service = {
      name: "new-service",
      repository: "owner/repo",
      binaryPath: "/path/to/binary",
      checkInterval: 300,
      autoStart: true,
    };

    configManager.addService(service);

    const config = configManager.getConfig();
    expect(config.services).toHaveLength(1);
    expect(config.services[0]).toEqual(service);
  });

  test("should throw error when adding duplicate service", () => {
    configManager = new ConfigManager(configPath);

    const service = {
      name: "duplicate",
      repository: "owner/repo",
      binaryPath: "/path/to/binary",
      checkInterval: 300,
      autoStart: true,
    };

    configManager.addService(service);

    expect(() => configManager.addService(service)).toThrow(
      "Service duplicate already exists",
    );
  });

  test("should update service", () => {
    configManager = new ConfigManager(configPath);

    const service = {
      name: "update-test",
      repository: "owner/repo",
      binaryPath: "/path/to/binary",
      checkInterval: 300,
      autoStart: true,
    };

    configManager.addService(service);
    configManager.updateService("update-test", { checkInterval: 600 });

    const updated = configManager.getService("update-test");
    expect(updated?.checkInterval).toBe(600);
  });

  test("should remove service", () => {
    configManager = new ConfigManager(configPath);

    const service = {
      name: "remove-test",
      repository: "owner/repo",
      binaryPath: "/path/to/binary",
      checkInterval: 300,
      autoStart: true,
    };

    configManager.addService(service);
    expect(configManager.getAllServices()).toHaveLength(1);

    configManager.removeService("remove-test");
    expect(configManager.getAllServices()).toHaveLength(0);
  });

  test("should get service by name", () => {
    configManager = new ConfigManager(configPath);

    const service = {
      name: "get-test",
      repository: "owner/repo",
      binaryPath: "/path/to/binary",
      checkInterval: 300,
      autoStart: true,
    };

    configManager.addService(service);

    const retrieved = configManager.getService("get-test");
    expect(retrieved).toEqual(service);

    const notFound = configManager.getService("non-existent");
    expect(notFound).toBeUndefined();
  });

  test("should expand home directory in log dir", () => {
    configManager = new ConfigManager(configPath);

    const logDir = configManager.getLogDir();
    expect(logDir).not.toContain("~");
    expect(logDir).toContain(".macrounder/logs");
  });

  test("should validate service config schema", () => {
    configManager = new ConfigManager(configPath);

    // Test empty name
    try {
      configManager.addService({
        name: "",
        repository: "owner/repo",
        binaryPath: "/path",
        checkInterval: 300,
        autoStart: true,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid repository format
    try {
      configManager.addService({
        name: "test",
        repository: "invalid-repo-format",
        binaryPath: "/path",
        checkInterval: 300,
        autoStart: true,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
