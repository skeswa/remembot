#!/usr/bin/env bun

import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { getMacrounderHome, getAppsDir, getLogsDir } from "./config/paths";
import { Daemon } from "./daemon/daemon";
import { IPCClient } from "./client/ipc-client";
import { createDefaultAppConfig } from "./app-config";
import { IPCErrorCode, IPCEvent, type LogLineEventPayload } from "./ipc/types";

const program = new Command();

// Helper function to safely extract error information
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function getErrorCode(error: unknown): string | number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return (error as { code: unknown }).code as string | number;
  }
  return undefined;
}

program
  .name("macrounder")
  .description("Background service manager for macOS with automatic updates")
  .version("0.1.0");

// Helper function to get or create IPC client
let _client: IPCClient | null = null;
async function getClient(): Promise<IPCClient> {
  if (!_client) {
    _client = new IPCClient();
    await _client.connect();
  }
  return _client;
}

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

      const client = await getClient();
      await client.addService(name, opts.repo, appConfig);

      console.log(`App ${name} added successfully`);
      console.log(
        `Configuration saved to: ${resolve(getAppsDir(), `${name}.toml`)}`,
      );
    } catch (error) {
      if (getErrorCode(error) === IPCErrorCode.ServiceAlreadyExists) {
        console.error(`App ${name} already exists`);
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

// Remove an app
program
  .command("remove <name>")
  .description("Remove an app configuration")
  .action(async (name) => {
    try {
      const client = await getClient();
      await client.removeService(name);
      console.log(`App ${name} removed successfully`);
    } catch (error) {
      if (getErrorCode(error) === IPCErrorCode.ServiceNotFound) {
        console.error(`App ${name} not found`);
      } else {
        console.error("Error:", getErrorMessage(error));
      }
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
      const client = await getClient();
      const apps = await client.listServices();

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
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

// Edit an app configuration (runs locally)
program
  .command("edit <name>")
  .description("Open app configuration in editor")
  .action(async (name) => {
    try {
      // Check if app exists via daemon
      const client = await getClient();
      await client.getService(name); // This will throw if not found

      const configPath = resolve(getAppsDir(), `${name}.toml`);
      const editor = process.env.EDITOR || "vi";

      const child = spawn(editor, [configPath], {
        stdio: "inherit",
      });

      child.on("exit", (code) => {
        if (code === 0) {
          console.log(
            "Configuration updated - daemon will reload automatically",
          );
        } else {
          console.error("Editor exited with error");
          process.exit(1);
        }
      });
    } catch (error) {
      if (getErrorCode(error) === IPCErrorCode.ServiceNotFound) {
        console.error(`App ${name} not found`);
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

// Start managing services
program
  .command("start [name]")
  .description("Start managing service(s)")
  .action(async (name) => {
    try {
      const client = await getClient();

      if (name) {
        // Start specific service
        await client.startService(name);
        console.log(`Service ${name} started`);
      } else {
        // Start all services
        const services = await client.listServices();
        for (const service of services) {
          try {
            await client.startService(service);
            console.log(`Service ${service} started`);
          } catch (error) {
            console.error(
              `Failed to start ${service}: ${getErrorMessage(error)}`,
            );
          }
        }
      }
    } catch (error) {
      if (getErrorCode(error) === IPCErrorCode.ServiceNotFound) {
        console.error(`App ${name} not found`);
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

program
  .command("stop [name]")
  .description("Stop a managed service")
  .action(async (name) => {
    try {
      const client = await getClient();

      if (name) {
        await client.stopService(name);
        console.log(`Service ${name} stopped`);
      } else {
        // Stop all services
        const services = await client.listServices();
        for (const service of services) {
          try {
            await client.stopService(service);
            console.log(`Service ${service} stopped`);
          } catch (error) {
            console.error(
              `Failed to stop ${service}: ${getErrorMessage(error)}`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command("restart <name>")
  .description("Restart a managed service")
  .action(async (name) => {
    try {
      const client = await getClient();
      await client.restartService(name);
      console.log(`Service ${name} restarted`);
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command("update <name>")
  .description("Check and apply updates for a service")
  .action(async (name) => {
    try {
      const client = await getClient();
      const updateInfo = await client.checkUpdate(name);

      if (updateInfo.available) {
        console.log(
          `Update available: ${updateInfo.currentVersion} -> ${updateInfo.latestVersion}`,
        );
        console.log("Applying update...");
        await client.applyUpdate(name);
        console.log(`Service ${name} updated successfully`);
      } else {
        console.log(`Service ${name} is up to date`);
      }
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show status of all managed services")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const client = await getClient();
      const statuses = await client.getAllStatuses();

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
      console.error("Error:", getErrorMessage(error));
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
      const client = await getClient();

      if (opts.follow) {
        console.log("Following logs (Ctrl+C to stop)...");

        // Subscribe to log events
        await client.subscribe([IPCEvent.LogLine], [name]);

        // Start streaming logs
        await client.streamLogs(name, parseInt(opts.tail));

        // Handle log line events
        client.on(IPCEvent.LogLine, (payload: LogLineEventPayload) => {
          if (payload.service === name) {
            console.log(payload.line);
          }
        });

        // Handle Ctrl+C to stop streaming
        process.on("SIGINT", async () => {
          await client.stopLogStream(name);
          await client.disconnect();
          process.exit(0);
        });

        // Keep the process running
        await new Promise(() => {}); // Never resolves, keeps process alive
      } else {
        const result = await client.getLogs(name, parseInt(opts.tail), false);
        console.log(result.logs.join("\n"));
      }
    } catch (error) {
      if (getErrorCode(error) === IPCErrorCode.ServiceNotFound) {
        console.error(`Service ${name} not found`);
      } else {
        console.error("Error:", getErrorMessage(error));
      }
      process.exit(1);
    }
  });

program
  .command("shutdown")
  .description("Shutdown the macrounder daemon")
  .action(async () => {
    try {
      const client = await getClient();
      await client.shutdown();
      console.log("Daemon shutdown initiated");
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command("daemon")
  .description("Run macrounder as a daemon")
  .option("--no-fork", "Run in foreground (don't fork)", false)
  .action(async () => {
    try {
      // Check if daemon is already running
      const client = new IPCClient();
      if (client.isDaemonRunning()) {
        try {
          await client.connect();
          await client.ping();
          console.error("Daemon is already running");
          process.exit(1);
        } catch {
          // Socket exists but daemon not responding, continue
        }
      }

      // Run daemon
      console.log("Starting macrounder daemon...");
      const daemon = new Daemon();

      await daemon.start();

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

      // Check if running as compiled binary
      const isCompiled = process.argv[1] === undefined;
      let programArgs: string[];

      if (isCompiled) {
        // Running as compiled binary
        programArgs = [process.execPath, "daemon"];
      } else {
        // Running with bun runtime
        const scriptPath = import.meta.path.replace("file://", "");
        programArgs = [process.argv[0]!, scriptPath, "daemon"];
      }

      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.remembot.macrounder</string>
    <key>ProgramArguments</key>
    <array>
${programArgs.map((arg) => `        <string>${arg}</string>`).join("\n")}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${getLogsDir()}/daemon.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${getLogsDir()}/daemon.stderr.log</string>
    <key>WorkingDirectory</key>
    <string>${homedir()}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>`;

      writeFileSync(plistPath, plist);
      console.log(`LaunchAgent plist created at: ${plistPath}`);
      console.log("\nTo install and start the daemon:");
      console.log(`launchctl load ${plistPath}`);
      console.log("\nThe daemon will start automatically on login.");
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
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

      console.log("To uninstall the daemon:");
      console.log(`\n1. Stop the daemon:`);
      console.log(`   launchctl unload ${plistPath}`);
      console.log(`\n2. Remove the plist file:`);
      console.log(`   rm ${plistPath}`);
      console.log(`\n3. (Optional) Remove configuration and logs:`);
      console.log(`   rm -rf ${getMacrounderHome()}`);
    } catch (error) {
      console.error("Error:", getErrorMessage(error));
      process.exit(1);
    }
  });

// Check if running daemon command
const isDaemonMode = process.argv.includes("daemon");

if (isDaemonMode) {
  // Run daemon directly
  program.parseAsync(process.argv);
} else {
  // Run as client - check daemon and execute commands
  (async () => {
    try {
      await program.parseAsync(process.argv);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorCode = getErrorCode(error);
      if (errorCode === "ENOENT" || errorMessage === "Daemon is not running") {
        console.error("\nError: Macrounder daemon is not running.");
        console.error("Start the daemon with: macrounder daemon");
        console.error(
          "Or install as a service with: macrounder install-daemon\n",
        );
        process.exit(1);
      } else {
        console.error("Error:", errorMessage);
        process.exit(1);
      }
    }
  })();
}
