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

interface PackageInfo {
  name: string;
  version: string;
  k8sVersion?: string;
}

/**
 * Extracts version from a k8s deployment file
 * @param deploymentPath Path to the k8s deployment file
 * @returns The version from the image tag or undefined if not found
 */
function getK8sVersion(deploymentPath: string): string | undefined {
  try {
    const deploymentContent = fs.readFileSync(deploymentPath, "utf8");
    const deployment = yaml.load(deploymentContent) as any;

    // Handle different possible container structures
    const containers = deployment?.spec?.template?.spec?.containers || [];
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
 * Gets package version from package.json
 * @param packageJsonPath Path to the package.json file
 * @returns The version from package.json or undefined if not found
 */
function getPackageVersion(packageJsonPath: string): string | undefined {
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);
    return packageJson.version;
  } catch (error) {
    console.error(`Error reading package.json ${packageJsonPath}:`, error);
    return undefined;
  }
}

/**
 * Finds all packages and compares their versions between k8s deployments and
 * package.json
 *
 * @returns Array of package information for packages with different versions
 */
function getChangedPackages(): PackageInfo[] {
  const changedPackages: PackageInfo[] = [];

  // Find all k8s deployment files
  const k8sDeployments = execSync("find . -path '*/k8s/deployment.yaml'", {
    encoding: "utf-8",
  })
    .trim()
    .split("\n");

  for (const deploymentPath of k8sDeployments) {
    // Get the app directory (e.g., apps/api from apps/api/k8s/deployment.yaml)
    const appDir = path.dirname(path.dirname(deploymentPath));
    const packageJsonPath = path.join(appDir, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`No package.json found for ${appDir}`);
      continue;
    }

    const k8sVersion = getK8sVersion(deploymentPath);
    const packageVersion = getPackageVersion(packageJsonPath);

    if (!k8sVersion || !packageVersion) {
      console.warn(`Could not determine versions for ${appDir}`);
      continue;
    }

    if (k8sVersion !== packageVersion) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      changedPackages.push({
        name: packageJson.name,
        version: packageVersion,
        k8sVersion: k8sVersion,
      });
    }
  }

  // Sort for consistent output
  return changedPackages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Main function that processes changed packages and creates git tags.
 * For each changed package, creates and pushes a git tag in the format
 * ${packageName}@${version}. Exits with error if tag creation fails.
 */
function main() {
  const changedPackages = getChangedPackages();

  if (changedPackages.length < 1) {
    console.log(
      "No packages found with different versions " +
        "between k8s and package.json."
    );

    return;
  }

  // Create and push tags for each changed package
  for (const pkg of changedPackages) {
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
