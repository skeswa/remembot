/**
 * A replacement for @changesets/publish that identifies packages that have been
 * released by comparing versions between k8s deployments and package.json
 * files.
 *
 * This script is intended to be used in place of @changesets/publish in your
 * release workflow. Instead of relying on changeset files, it determines which
 * packages need to be released by comparing their current package.json version
 * with their deployed version in k8s.
 *
 * Creates git tags for packages that have different versions in the format of
 * ${packageName}@${version}.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import glob from "fast-glob";

/**
 * Information about a package or app in the monorepo.
 */
interface PackageInfo {
  /** Name of the package or app. */
  readonly name: string;
  /** Version in package.json. */
  readonly version: string;
  /** Version deployed (from k8s) or published, if available. */
  readonly publishedVersion?: string;
}

/**
 * Reads package.json and returns its parsed content.
 *
 * @param packageJsonPath Path to the package.json file
 * @returns Parsed package.json or undefined if not found
 */
function getPackageJson(
  packageJsonPath: string,
): { name: string; version: string; publishedVersion?: string } | undefined {
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    return JSON.parse(packageJsonContent);
  } catch (error) {
    console.error(`Error reading package.json ${packageJsonPath}:`, error);
    return undefined;
  }
}

/**
 * Extracts version from a k8s deployment file.
 *
 * @param deploymentPath Path to the k8s deployment file
 * @returns The version from the image tag or undefined if not found
 */
function getK8sVersion(deploymentPath: string): string | undefined {
  try {
    const deploymentContent = fs.readFileSync(deploymentPath, "utf8");
    const deployment = yaml.load(deploymentContent) as unknown;

    // Handle different possible container structures
    const containers =
      (deployment as any)?.spec?.template?.spec?.containers || [];
    if (!Array.isArray(containers) || containers.length === 0) {
      console.warn(`No containers found in ${deploymentPath}`);
      return undefined;
    }

    // Look for the first container with an image tag
    for (const container of containers) {
      const imageTag = container.image;
      if (!imageTag) continue;

      // Try different version extraction patterns
      // 1. Standard format: registry/repo:version
      // 2. Multi-level format: registry/repo/subpath:version
      // 3. With digest: registry/repo:version@sha256:digest
      const versionMatch = imageTag.match(/:([^:@]+)(?:@|$)/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }

    console.warn(`No valid image tag found in ${deploymentPath}`);
    return undefined;
  } catch (error) {
    console.error(`Error reading k8s deployment ${deploymentPath}:`, error);
    return undefined;
  }
}

/**
 * Gets metadata about all of the apps in the monorepo.
 *
 * @returns package information for apps
 */
function summarizeApps(): PackageInfo[] {
  const apps: PackageInfo[] = [];
  const deploymentPaths = glob.sync("apps/*/k8s/deployment.yaml");

  for (const deploymentPath of deploymentPaths) {
    // Get the app directory (e.g., apps/api from apps/api/k8s/deployment.yaml)
    const appDir = path.dirname(path.dirname(deploymentPath));
    const packageJson = getPackageJson(path.join(appDir, "package.json"));

    if (!packageJson) {
      console.warn(`No package.json found for ${appDir}`);
      continue;
    }

    const k8sVersion = getK8sVersion(deploymentPath);
    const packageVersion = packageJson.version;

    apps.push({
      name: packageJson.name,
      version: packageVersion,
      publishedVersion: k8sVersion,
    });
  }

  return apps;
}

/**
 * Gets metadata about all of the packages in the monorepo.
 *
 * @returns package information for packages
 */
function summarizePackages(): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const packageJsonPaths = glob.sync("packages/*/package.json");

  for (const packageJsonPath of packageJsonPaths) {
    try {
      const packageJson = getPackageJson(packageJsonPath);
      if (!packageJson) {
        throw new Error(
          `Package.json ${packageJsonPath} is invalid or missing`,
        );
      }
      const { name, version, publishedVersion } = packageJson;
      packages.push({
        name,
        version,
        publishedVersion,
      });
    } catch (error) {
      console.warn(`Could not parse ${packageJsonPath}:`, error);
      continue;
    }
  }

  return packages;
}

/**
 * Gets metadata about all of the apps and packages in the monorepo that have
 * differences between their current and published versions.
 *
 * @returns package information for changed apps and packages
 */
function getChangedAppsAndPackages(): PackageInfo[] {
  const apps = summarizeApps();
  const packages = summarizePackages();

  return [...apps, ...packages]
    .filter(({ publishedVersion, version }) => publishedVersion !== version)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Main function that processes changed packages and creates git tags.
 * For each changed package, creates and pushes a git tag in the format
 * ${packageName}@${version}. Exits with error if tag creation fails.
 */
function main(): void {
  const changedAppsAndPackages = getChangedAppsAndPackages();

  if (changedAppsAndPackages.length < 1) {
    console.log(
      "No packages found with different versions " +
        "between k8s and package.json.",
    );
    return;
  }

  // Create and push tags for each changed package
  for (const pkg of changedAppsAndPackages) {
    const tagName = `${pkg.name}@${pkg.version}`;

    try {
      // Check if tag already exists
      try {
        execSync(`git rev-parse --verify ${tagName}`, { stdio: "ignore" });
        console.log(`Tag ${tagName} already exists, skipping...`);
        continue;
      } catch {
        // Tag doesn't exist, proceed with creation
      }

      // Create and push the tag.
      execSync(`git tag ${tagName}`, { stdio: "inherit" });
      execSync(`git push origin ${tagName}`, { stdio: "inherit" });

      console.log(`New tag: ${tagName}`);
    } catch (error) {
      console.error(`Failed to create/push tag ${tagName}:`, error);
      process.exit(1);
    }
  }
}

main();
