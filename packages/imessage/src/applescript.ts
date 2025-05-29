/**
 * @fileoverview Utility for executing AppleScript code from Node.js using
 * node-osascript.
 *
 * Used for automating interactions with macOS apps like Messages and Contacts.
 */

import { execute as executeWithCallback } from "node-osascript";

/**
 * Executes the given AppleScript code and returns the result.
 * @param script The AppleScript code to execute.
 * @returns A promise that resolves with the script's result.
 * @throws If AppleScript execution fails.
 */
export async function executeAppleScript(script: string): Promise<unknown> {
  try {
    const { result } = await executeWithPromise(script);

    return result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`AppleScript execution failed: ${error.message}`);
    }

    throw new Error(`AppleScript execution failed: ${String(error)}`);
  }
}

/**
 * Execute an AppleScript string, optionally injecting variables.
 * @param script The AppleScript code to execute.
 * @param variables Optional object to inject variables into the script.
 * @param callback Optional callback with (err, result, raw).
 * @returns result of the AppleScript execution.
 */
function executeWithPromise(
  script: string,
  variables?: Record<string, unknown>
): Promise<{ result: unknown; raw: unknown }> {
  return new Promise((resolve, reject) => {
    executeWithCallback(script, variables, (err, result, raw) => {
      if (err) {
        reject(err);

        return;
      }

      resolve({ result, raw });
    });
  });
}
