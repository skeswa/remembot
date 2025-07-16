import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  chmodSync,
  createReadStream,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import type { GitHubAsset, GitHubRelease, ServiceConfig } from "./types";
import type { Logger } from "pino";

export class UpdateManager {
  private readonly logger: Logger;
  private readonly downloadDir: string;

  constructor(logger: Logger, downloadDir = "/tmp/macrounder-downloads") {
    this.logger = logger;
    this.downloadDir = downloadDir;
    this.ensureDownloadDir();
  }

  private ensureDownloadDir(): void {
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async downloadAndInstall(
    service: ServiceConfig,
    release: GitHubRelease,
  ): Promise<void> {
    this.logger.info(
      { service: service.name, version: release.tagName },
      "Starting update",
    );

    try {
      // Find the appropriate asset for macOS
      const asset = this.findMacOSAsset(release.assets, service.name);
      if (!asset) {
        throw new Error(`No macOS binary found in release ${release.tagName}`);
      }

      // Download the asset
      const downloadPath = await this.downloadAsset(asset, service.name);

      // Backup current binary
      const backupPath = await this.backupCurrentBinary(service.binaryPath);

      try {
        // Install new binary
        await this.installBinary(downloadPath, service.binaryPath);

        // Clean up backup
        if (backupPath && existsSync(backupPath)) {
          unlinkSync(backupPath);
        }

        this.logger.info(
          { service: service.name, version: release.tagName },
          "Update completed successfully",
        );
      } catch (error) {
        // Restore backup on failure
        if (backupPath && existsSync(backupPath)) {
          this.logger.warn("Update failed, restoring backup");
          renameSync(backupPath, service.binaryPath);
        }
        throw error;
      } finally {
        // Clean up download
        if (existsSync(downloadPath)) {
          unlinkSync(downloadPath);
        }
      }
    } catch (error) {
      this.logger.error(
        { error, service: service.name },
        "Failed to update service",
      );
      throw error;
    }
  }

  private findMacOSAsset(
    assets: GitHubAsset[],
    serviceName: string,
  ): GitHubAsset | undefined {
    // Priority order for finding macOS assets
    const patterns = [
      new RegExp(`${serviceName}.*darwin.*arm64`, "i"),
      new RegExp(`${serviceName}.*darwin.*x64`, "i"),
      new RegExp(`${serviceName}.*darwin`, "i"),
      new RegExp(`${serviceName}.*macos`, "i"),
      new RegExp(`${serviceName}.*mac`, "i"),
      new RegExp(`${serviceName}$`, "i"), // Just the service name
    ];

    for (const pattern of patterns) {
      const asset = assets.find((a) => pattern.test(a.name));
      if (asset) return asset;
    }

    return undefined;
  }

  private async downloadAsset(
    asset: GitHubAsset,
    serviceName: string,
  ): Promise<string> {
    const filename = `${serviceName}-${Date.now()}-${basename(asset.name)}`;
    const downloadPath = join(this.downloadDir, filename);

    this.logger.debug(
      { url: asset.downloadUrl, path: downloadPath },
      "Downloading asset",
    );

    const response = await fetch(asset.downloadUrl, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "macrounder/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download asset: ${response.status} ${response.statusText}`,
      );
    }

    const writeStream = createWriteStream(downloadPath);
    await pipeline(response.body as any, writeStream);

    // Verify download size
    const stats = statSync(downloadPath);
    if (stats.size !== asset.size) {
      unlinkSync(downloadPath);
      throw new Error(
        `Downloaded file size mismatch: expected ${asset.size}, got ${stats.size}`,
      );
    }

    return downloadPath;
  }

  private async backupCurrentBinary(
    binaryPath: string,
  ): Promise<string | null> {
    if (!existsSync(binaryPath)) {
      return null;
    }

    const backupPath = `${binaryPath}.backup-${Date.now()}`;
    renameSync(binaryPath, backupPath);
    return backupPath;
  }

  private async installBinary(
    sourcePath: string,
    targetPath: string,
  ): Promise<void> {
    // Ensure target directory exists
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Move the binary
    renameSync(sourcePath, targetPath);

    // Make it executable
    chmodSync(targetPath, 0o755);
  }

  async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest("hex");
  }

  cleanupDownloads(): void {
    if (!existsSync(this.downloadDir)) {
      return;
    }

    try {
      const files = readdirSync(this.downloadDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = join(this.downloadDir, file);
        const stats = statSync(filePath);

        // Clean up files older than 24 hours
        if (now - stats.mtimeMs > maxAge) {
          unlinkSync(filePath);
          this.logger.debug({ file }, "Cleaned up old download");
        }
      }
    } catch (error) {
      this.logger.warn({ error }, "Failed to cleanup downloads");
    }
  }
}
