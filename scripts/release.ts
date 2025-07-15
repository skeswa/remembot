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
import glob from "fast-glob";

/**
 * Main function that processes changed packages and creates git tags.
 * For each changed package, creates and pushes a git tag in the format
 * ${packageName}@${version}. Exits with error if tag creation fails.
 */
function main(): void {
  const packageJsons = readPackageJsonsOfChangedPackages();

  if (packageJsons.length < 1) {
    console.info("No packages found with differing deployment versions.");

    return;
  }

  // Create and push tags for each changed package.
  for (const packageJson of packageJsons) {
    const tagName = `${packageJson.name}@${packageJson.version}`;

    try {
      // Check if tag already exists.
      try {
        execSync(`git rev-parse --verify ${tagName}`, { stdio: "ignore" });

        console.info(`Tag ${tagName} already exists, skipping...`);

        continue;
      } catch {
        // Tag doesn't exist, proceed with creation.
      }

      // Create and push the tag.
      execSync(`git tag ${tagName}`, { stdio: "inherit" });
      execSync(`git push origin ${tagName}`, { stdio: "inherit" });

      // NOTE: this is important!! Changesets will not work without this.
      console.log(`New tag: ${tagName}`);
    } catch (error) {
      console.error(`Failed to create/push tag ${tagName}:`, error);

      process.exit(1);
    }
  }
}

/**
 * The relevant fields of a package.json file.
 */
interface PackageJson {
  /** Name of the package or app. */
  name: string;
  /** Version in package.json. */
  version: string;
  /** Release strategy for the app. */
  release?:
    | {
        strategy: "k8s";
        k8s: {
          configDirPath: string;
          kubeconfigSecretName: string;
        };
        deploy?: {
          timestamp: string;
          version: string;
        };
        publish?: {
          timestamp: string;
          version: string;
        };
      }
    | {
        strategy: "npm";
        publish?: {
          timestamp: string;
          version: string;
        };
      }
    | {
        strategy: "local";
        publish?: {
          timestamp: string;
          version: string;
        };
      };
}

/**
 * Reads package.json and returns its parsed content.
 *
 * @param packageJsonPath Path to the package.json file
 * @returns Parsed package.json or undefined if not found
 */
function readPackageJson(packageJsonPath: string): PackageJson | undefined {
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    return JSON.parse(packageJsonContent);
  } catch (error) {
    console.error(`Error reading package.json ${packageJsonPath}:`, error);
    return undefined;
  }
}

/**
 * Reads all of the package.json files in the apps and packages directories.
 *
 * @returns package.json files for all of the packages in the monorepo
 */
function readPackageJsons(): PackageJson[] {
  return glob
    .sync("{apps,packages}/*/package.json")
    .map(readPackageJson)
    .filter((packageJson): packageJson is PackageJson => !!packageJson);
}

/**
 * Reads all of the package.json files in the apps and packages directories
 * that have differences between their current and deployed versions.
 *
 * @returns package.json files for all of the changed packages in the monorepo
 */
function readPackageJsonsOfChangedPackages(): PackageJson[] {
  return readPackageJsons()
    .filter(
      ({ release, version }) => release && version !== release.publish?.version
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

main();
