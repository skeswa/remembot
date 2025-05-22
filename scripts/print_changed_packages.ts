/**
 * Prints output wanted by the publish script option of the @changesets/action.
 *
 * This is the secret sauce that allows us to create releases without needing to
 * do NPM publishes as a by product.
 */

import { execSync } from "child_process";

interface PackageInfo {
  name: string;
  version: string;
}

/**
 * Get the packages that have been changed in the last 20 commits.
 * @returns The list of packages that have been changed in the last 20 commits.
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

/** Print the changed packages.*/
function main() {
  const changedPackages = getChangedPackages();

  if (changedPackages.length < 1) {
    console.log(
      "No commit found that removed changeset files and modified package.json files."
    );
    return;
  }

  changedPackages.forEach((pkg) => {
    console.log(`New tag: ${pkg.name}@${pkg.version}`);
  });
}

main();
