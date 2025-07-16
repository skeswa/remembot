import { resolve } from "node:path";
import { homedir } from "node:os";

/**
 * Get the macrounder home directory path.
 * Uses MACROUNDER_HOME environment variable if set, otherwise defaults to ~/.macrounder
 */
export function getMacrounderHome(): string {
  return process.env.MACROUNDER_HOME || resolve(homedir(), ".macrounder");
}

/**
 * Get the Unix domain socket path for IPC communication
 */
export function getSocketPath(): string {
  return resolve(getMacrounderHome(), "daemon.sock");
}

/**
 * Get the directory where app configurations are stored
 */
export function getAppsDir(): string {
  return resolve(getMacrounderHome(), "apps");
}

/**
 * Get the directory where logs are stored
 */
export function getLogsDir(): string {
  return resolve(getMacrounderHome(), "logs");
}

/**
 * Get the path to the global configuration file
 */
export function getConfigPath(): string {
  return resolve(getMacrounderHome(), "config.toml");
}
