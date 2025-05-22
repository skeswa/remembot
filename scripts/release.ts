/**
 * Emulates the functionality of @changesets/publish by identifying packages
 * that have been released and creating git tags for them.
 *
 * This script looks for commits that:
 * 1. Remove .changeset files (indicating a release)
 * 2. Modify package.json files (indicating version updates)
 *
 * When such a commit is found, it creates git tags for each released package
 * in the format of ${packageName}@${version}.
 */

import { execSync } from "child_process";

interface PackageInfo {
  name: string;
  version: string;
}

/**
 * Identifies packages that have been released by analyzing recent commits.
 * Looks for commits that removed changeset files and updated package versions.
 * @returns Array of package information (name and version) for released packages
 */
function getChangedPackages(): PackageInfo[] {
  // Get the git log with commit hash and changed files
  // --name-status shows the status of changed files (A, M, D, R)
  // --pretty=format:"%H" only shows the commit hash
  // We will process one commit at a time
  const logOutput = execSync(
    // Look back at most 20 commits
    "git log --pretty=format:'%H' --name-status -n 20",
    { encoding: "utf-8" }
  );

  const commits = logOutput.trim().split("\n\n");

  for (const commitData of commits) {
    const lines = commitData.trim().split("\n");
    if (lines.length < 2) continue;

    const commitHash = lines[0];
    const changedFiles = lines.slice(1);

    const deletedChangesetFiles = changedFiles.filter(
      (file) =>
        file.startsWith("D\t") &&
        file.includes(".changeset/") &&
        file.endsWith(".md")
    );
    const modifiedPackageJsonFiles = changedFiles.filter(
      (file) =>
        (file.startsWith("M\t") || file.startsWith("A\t")) &&
        file.endsWith("package.json")
    );

    if (
      deletedChangesetFiles.length > 0 &&
      modifiedPackageJsonFiles.length > 0
    ) {
      // This is the commit we are looking for
      const packages: PackageInfo[] = [];
      for (const fileStatus of modifiedPackageJsonFiles) {
        const filePath = fileStatus.split("\t")[1];
        try {
          // Get the content of the package.json file at this commit
          const packageJsonContent = execSync(
            `git show ${commitHash}:${filePath}`,
            { encoding: "utf-8" }
          );
          const packageJson = JSON.parse(packageJsonContent);
          if (packageJson.name && packageJson.version) {
            packages.push({
              name: packageJson.name,
              version: packageJson.version,
            });
          }
        } catch (error) {
          console.error(
            `Error processing ${filePath} in commit ${commitHash}:`,
            error
          );
        }
      }

      // Sort for consistent output
      return packages.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return []; // No matching commit found
}

/**
 * Main function that processes released packages and creates git tags.
 * For each released package, creates and pushes a git tag in the format
 * ${packageName}@${version}. Exits with error if tag creation fails.
 */
function main() {
  const changedPackages = getChangedPackages();

  if (changedPackages.length < 1) {
    console.log(
      "No commit found that removed changeset files and modified package.json files."
    );
    return;
  }

  // Create and push tags for each changed package
  changedPackages.forEach((pkg) => {
    const tagName = `${pkg.name}@${pkg.version}`;

    try {
      // Create and push the tag.
      execSync(`git tag ${tagName}`, { stdio: "inherit" });
      execSync(`git push origin ${tagName}`, { stdio: "inherit" });

      console.log(`New tag: ${tagName}`);
    } catch (error) {
      console.error(`Failed to create/push tag ${tagName}:`, error);

      process.exit(1);
    }
  });
}

main();
