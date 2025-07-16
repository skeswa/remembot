import { z } from "zod";

export const ServiceConfigSchema = z.object({
  name: z.string().min(1),
  repository: z.string().regex(/^[^/]+\/[^/]+$/),
  binaryPath: z.string(),
  checkInterval: z.number().min(60).default(300),
  autoStart: z.boolean().default(true),
  env: z.record(z.string()).optional(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

export interface ServiceStatus {
  name: string;
  pid?: number;
  status: "running" | "stopped" | "updating" | "error";
  currentVersion?: string;
  latestVersion?: string;
  lastChecked?: Date;
  lastError?: string;
  uptime?: number;
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion?: string;
  latestVersion?: string;
  release?: GitHubRelease;
}

export interface ServiceEvents {
  started: { service: string; pid: number };
  stopped: { service: string; code?: number };
  error: { service: string; error: Error };
  updateAvailable: { service: string; update: UpdateInfo };
  updateStarted: { service: string; version: string };
  updateCompleted: { service: string; version: string };
  updateFailed: { service: string; error: Error };
}

// Re-export AppConfig for use in IPC types
export type { AppConfig } from "./app-config";
