/**
 * @fileoverview Utility for executing AppleScript code from Node.js using node-osascript.
 * Used for automating interactions with macOS apps like Messages and Contacts.
 */

import { exec } from "node-osascript";

/**
 * Executes the given AppleScript code and returns the result.
 * @param script The AppleScript code to execute.
 * @returns A promise that resolves with the script's result.
 * @throws If AppleScript execution fails.
 */
export async function executeAppleScript(script: string): Promise<unknown> {
  try {
    const result = await exec(script);
    return result;
  } catch (error: unknown) {
    console.error("Error executing AppleScript:", error);

    // Handle specific AppleScript error cases.
    if (error instanceof Error) {
      // Check for common AppleScript error patterns.
      if (error.message.includes("execution of AppleScript failed")) {
        throw new Error(
          `AppleScript syntax or runtime error: ${error.message}`,
        );
      }
      if (error.message.includes("permission denied")) {
        throw new Error(
          "AppleScript execution denied: Check application permissions.",
        );
      }
      if (error.message.includes("not found")) {
        throw new Error(
          "AppleScript target application not found or not running.",
        );
      }
      // Generic error case.
      throw new Error(`AppleScript execution failed: ${error.message}`);
    }

    // Handle non-Error objects.
    throw new Error(`AppleScript execution failed: ${String(error)}`);
  }
}
