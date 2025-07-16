export * from "./types";
export * from "./app-config";
export { ServiceManager } from "./service-manager";
export { GitHubMonitor } from "./github-monitor";
export { ProcessManager } from "./process-manager";
export { UpdateManager } from "./update-manager";
export { AppConfigManager } from "./app-config-manager";

// Daemon-client architecture exports
export { Daemon } from "./daemon/daemon";
export { IPCClient } from "./client/ipc-client";
export { IPCServer } from "./daemon/ipc-server";
export { FileSystemWatcher } from "./daemon/filesystem-watcher";
export * from "./ipc/types";
export * from "./ipc/framing";
