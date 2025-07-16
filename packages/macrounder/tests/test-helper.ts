import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { mkdirSync, rmSync, existsSync } from "node:fs";

/**
 * Creates a unique test directory for isolating test files
 * @returns Object with test directory paths and cleanup function
 */
export function createTestEnvironment() {
  const testId = Math.random().toString(36).substring(2, 8);
  const testDir = join(tmpdir(), `mu-${testId}`);
  const macrounderDir = join(testDir, ".macrounder");
  const appsDir = join(macrounderDir, "apps");
  const logsDir = join(macrounderDir, "logs");
  const socketPath = join(macrounderDir, "daemon.sock");

  // Create directories
  mkdirSync(appsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  // Store original environment variables
  const originalHome = process.env.HOME;
  const originalMacrounderHome = process.env.MACROUNDER_HOME;

  // Set test environment variables
  process.env.HOME = testDir;
  process.env.MACROUNDER_HOME = macrounderDir;

  return {
    testDir,
    macrounderDir,
    appsDir,
    logsDir,
    socketPath,
    cleanup: () => {
      // Restore original environment variables
      if (originalHome !== undefined) {
        process.env.HOME = originalHome;
      }
      if (originalMacrounderHome !== undefined) {
        process.env.MACROUNDER_HOME = originalMacrounderHome;
      } else {
        delete process.env.MACROUNDER_HOME;
      }

      // Remove test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Ensures no test is using the real ~/.macrounder directory
 */
export function assertNotUsingRealMacrounderDir(path: string) {
  // Get the real macrounder path (respecting MACROUNDER_HOME if set in non-test environment)
  const savedMacrounderHome = process.env.MACROUNDER_HOME;
  delete process.env.MACROUNDER_HOME;
  const realMacrounderPath =
    process.env.MACROUNDER_HOME || join(homedir(), ".macrounder");
  if (savedMacrounderHome !== undefined) {
    process.env.MACROUNDER_HOME = savedMacrounderHome;
  }

  if (path.includes(realMacrounderPath)) {
    throw new Error(
      `Test is attempting to use real .macrounder directory: ${path}\n` +
        `This is not allowed in tests. Use createTestEnvironment() instead.`,
    );
  }
}
