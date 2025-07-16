#!/usr/bin/env bun

import { Command } from "commander";
import { ServiceManager } from "./service-manager";
import { AppConfigManager } from "./app-config-manager";
import { createDefaultAppConfig } from "./app-config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

const program = new Command();

program
  .name("macrounder")
  .description("Background service manager for macOS with automatic updates")
  .version("0.1.0");

// Add a new app
program
  .command("add <name>")
  .description("Add a new app configuration")
  .requiredOption("--repo <repository>", "GitHub repository (owner/repo)")
  .option("--binary <path>", "Path to the binary")
  .option("--interval <seconds>", "Update check interval", "300")
  .option("--no-auto-start", "Don't start the app automatically")
  .option("--no-auto-restart", "Don't restart the app on failure")
  .action(async (name, opts) => {
    try {
      const configManager = new AppConfigManager();

      if (configManager.appExists(name)) {
        console.error(`App ${name} already exists`);
        process.exit(1);
      }

      const appConfig = createDefaultAppConfig(name, opts.repo);

      // Override with provided options
      if (opts.binary) {
        appConfig.run.binary_path = opts.binary;
      }
      if (opts.interval) {
        appConfig.app.check_interval = parseInt(opts.interval);
      }
      appConfig.app.auto_start = opts.autoStart;
      appConfig.app.auto_restart = opts.autoRestart;

      configManager.saveApp(appConfig);
      console.log(`App ${name} added successfully`);
      console.log(`Configuration saved to: ~/.macrounder/apps/${name}.toml`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// Remove an app
program
  .command("remove <name>")
  .description("Remove an app configuration")
  .action(async (name) => {
    try {
      const configManager = new AppConfigManager();
      const manager = new ServiceManager();

      if (!configManager.appExists(name)) {
        console.error(`App ${name} not found`);
        process.exit(1);
      }

      // Stop the service if running
      try {
        await manager.stopService(name);
      } catch (error) {
        // Service might not be running
      }

      configManager.deleteApp(name);
      console.log(`App ${name} removed successfully`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// List all apps
program
  .command("list")
  .description("List all configured apps")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const configManager = new AppConfigManager();
      const apps = configManager.listApps();

      if (opts.json) {
        console.log(JSON.stringify(apps, null, 2));
      } else {
        if (apps.length === 0) {
          console.log("No apps configured");
        } else {
          console.log("Configured apps:");
          apps.forEach((app) => console.log(`  - ${app}`));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// Edit an app configuration
program
  .command("edit <name>")
  .description("Open app configuration in editor")
  .action(async (name) => {
    try {
      const configManager = new AppConfigManager();

      if (!configManager.appExists(name)) {
        console.error(`App ${name} not found`);
        process.exit(1);
      }

      const configPath = resolve(
        homedir(),
        ".macrounder",
        "apps",
        `${name}.toml`,
      );
      const editor = process.env.EDITOR || "vi";

      const child = spawn(editor, [configPath], {
        stdio: "inherit",
      });

      child.on("exit", (code) => {
        if (code === 0) {
          console.log("Configuration updated");
        } else {
          console.error("Editor exited with error");
          process.exit(1);
        }
      });
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// Start managing services
program
  .command("start [name]")
  .description("Start managing service(s)")
  .action(async (name) => {
    try {
      const manager = new ServiceManager();

      if (name) {
        // Start specific service
        const configManager = new AppConfigManager();
        if (!configManager.appExists(name)) {
          console.error(`App ${name} not found`);
          process.exit(1);
        }

        await manager.startServiceProcess(name);
        console.log(`Service ${name} started`);
      } else {
        // Start all services
        await manager.start();
        console.log("All services started");
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("stop [name]")
  .description("Stop a managed service")
  .action(async (name) => {
    try {
      const manager = new ServiceManager();

      if (name) {
        await manager.stopService(name);
        console.log(`Service ${name} stopped`);
      } else {
        await manager.shutdown();
        console.log("All services stopped");
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("restart <name>")
  .description("Restart a managed service")
  .action(async (name) => {
    try {
      const manager = new ServiceManager();
      await manager.restartService(name);
      console.log(`Service ${name} restarted`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("update <name>")
  .description("Check and apply updates for a service")
  .action(async (name) => {
    try {
      const manager = new ServiceManager();
      await manager.updateService(name);
      console.log(`Service ${name} updated`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show status of all managed services")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const manager = new ServiceManager();
      const statuses = manager.getAllStatuses();

      if (opts.json) {
        console.log(JSON.stringify(statuses, null, 2));
      } else {
        console.log("Service Status:");
        console.log("─".repeat(60));

        for (const status of statuses) {
          console.log(`Name: ${status.name}`);
          console.log(`Status: ${status.status}`);
          if (status.pid) console.log(`PID: ${status.pid}`);
          if (status.uptime) {
            const hours = Math.floor(status.uptime / 3600000);
            const minutes = Math.floor((status.uptime % 3600000) / 60000);
            console.log(`Uptime: ${hours}h ${minutes}m`);
          }
          if (status.currentVersion) {
            console.log(`Current Version: ${status.currentVersion}`);
          }
          if (status.latestVersion) {
            console.log(`Latest Version: ${status.latestVersion}`);
          }
          if (status.lastError) {
            console.log(`Last Error: ${status.lastError}`);
          }
          console.log("─".repeat(60));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("logs <name>")
  .description("View service logs")
  .option("--tail <lines>", "Number of lines to show", "50")
  .option("--follow", "Follow log output")
  .action(async (name, opts) => {
    try {
      const logDir = resolve(homedir(), ".macrounder", "logs");
      const logFile = resolve(logDir, `${name}.log`);

      if (!existsSync(logFile)) {
        console.error(`No logs found for service ${name}`);
        process.exit(1);
      }

      // Simple log viewing - in production would use a proper tailing library
      if (opts.follow) {
        console.log("Following logs (Ctrl+C to stop)...");
        // This would need a proper implementation with file watching
        console.log("Follow mode not yet implemented");
      } else {
        const logs = readFileSync(logFile, "utf-8");
        const lines = logs.split("\n");
        const tail = lines.slice(-parseInt(opts.tail));
        console.log(tail.join("\n"));
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("daemon")
  .description("Run macrounder as a daemon")
  .action(async () => {
    try {
      console.log("Starting macrounder daemon...");
      const manager = new ServiceManager();

      await manager.start();

      console.log("Macrounder daemon started");
      console.log("Press Ctrl+C to stop");

      // Keep the process running
      await new Promise(() => {});
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("install-daemon")
  .description("Install macrounder as a launchd service")
  .action(async () => {
    try {
      const plistPath = resolve(
        homedir(),
        "Library",
        "LaunchAgents",
        "com.remembot.macrounder.plist",
      );

      const binaryPath = process.argv[0]; // Path to bun
      const scriptPath = import.meta.path; // Path to this CLI script

      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.remembot.macrounder</string>
    <key>ProgramArguments</key>
    <array>
        <string>${binaryPath}</string>
        <string>${scriptPath}</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${homedir()}/.macrounder/logs/daemon.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${homedir()}/.macrounder/logs/daemon.stderr.log</string>
    <key>WorkingDirectory</key>
    <string>${homedir()}</string>
</dict>
</plist>`;

      writeFileSync(plistPath, plist);
      console.log(`LaunchAgent plist created at: ${plistPath}`);
      console.log("To load the daemon, run:");
      console.log(`launchctl load ${plistPath}`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program
  .command("uninstall-daemon")
  .description("Uninstall macrounder launchd service")
  .action(async () => {
    try {
      const plistPath = resolve(
        homedir(),
        "Library",
        "LaunchAgents",
        "com.remembot.macrounder.plist",
      );

      console.log("To unload the daemon, run:");
      console.log(`launchctl unload ${plistPath}`);
      console.log(`rm ${plistPath}`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

// Migration command
program
  .command("migrate")
  .description("Migrate from old JSON configuration to TOML")
  .action(async () => {
    try {
      const configManager = new AppConfigManager();
      await configManager.migrateFromJson();
      console.log("Migration completed successfully");
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
