import type { GitHubRelease, UpdateInfo } from "./types";
import type { Logger } from "pino";

// GitHub API response types
interface GitHubReleaseResponse {
  id: number;
  tag_name: string;
  name?: string;
  body?: string;
  prerelease?: boolean;
  draft?: boolean;
  published_at: string;
  assets?: GitHubAssetResponse[];
}

interface GitHubAssetResponse {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export class GitHubMonitor {
  private readonly owner: string;
  private readonly repo: string;
  private readonly logger: Logger;
  private currentVersion?: string;

  constructor(repository: string, logger: Logger, currentVersion?: string) {
    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}`);
    }

    this.owner = owner;
    this.repo = repo;
    this.logger = logger;
    this.currentVersion = currentVersion;
  }

  async checkForUpdate(): Promise<UpdateInfo> {
    try {
      const release = await this.getLatestRelease();

      if (!release) {
        return { available: false, currentVersion: this.currentVersion };
      }

      const latestVersion = this.normalizeVersion(release.tagName);
      const currentVersion = this.currentVersion
        ? this.normalizeVersion(this.currentVersion)
        : undefined;

      const available = currentVersion
        ? this.isNewerVersion(currentVersion, latestVersion)
        : true;

      return {
        available,
        currentVersion: this.currentVersion,
        latestVersion: release.tagName,
        release: available ? release : undefined,
      };
    } catch (error) {
      this.logger.error({ error }, "Failed to check for updates");
      throw error;
    }
  }

  async getLatestRelease(): Promise<GitHubRelease | null> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "macrounder/1.0",
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      return this.mapReleaseData(data as GitHubReleaseResponse);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ error: error.message }, "Failed to fetch release");
      }
      throw error;
    }
  }

  async getAllReleases(perPage = 30): Promise<GitHubRelease[]> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases?per_page=${perPage}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "macrounder/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as GitHubReleaseResponse[];

      return data.map((release) => this.mapReleaseData(release));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error({ error: error.message }, "Failed to fetch releases");
      }
      throw error;
    }
  }

  private mapReleaseData(data: GitHubReleaseResponse): GitHubRelease {
    return {
      id: data.id,
      tagName: data.tag_name,
      name: data.name || data.tag_name,
      body: data.body || "",
      prerelease: data.prerelease || false,
      draft: data.draft || false,
      publishedAt: data.published_at,
      assets: (data.assets || []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browser_download_url,
        contentType: asset.content_type,
      })),
    };
  }

  private normalizeVersion(version: string): string {
    // Remove common version prefixes
    return version.replace(/^v/, "").replace(/^release-/, "");
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const currentParts = current.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);

    // Pad arrays to same length
    const maxLength = Math.max(currentParts.length, latestParts.length);
    while (currentParts.length < maxLength) currentParts.push(0);
    while (latestParts.length < maxLength) latestParts.push(0);

    // Compare version parts
    for (let i = 0; i < maxLength; i++) {
      const latest = latestParts[i] ?? 0;
      const current = currentParts[i] ?? 0;
      if (latest > current) return true;
      if (latest < current) return false;
    }

    return false;
  }

  setCurrentVersion(version: string): void {
    this.currentVersion = version;
  }
}
