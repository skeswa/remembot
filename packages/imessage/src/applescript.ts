/**
 * @fileoverview Provides utilities for executing AppleScript code from Node.js.
 *
 * This module handles the execution of AppleScript code, including error handling
 * and promise-based execution. It provides a clean interface for running
 * AppleScript commands and retrieving their results.
 */

// @ts-expect-error - node-osascript doesn't have types
import { execute as executeWithCallback } from "node-osascript";

/**
 * Executes AppleScript code and manages the execution lifecycle.
 *
 * This class provides a clean interface for running AppleScript commands from Node.js,
 * handling errors and returning results in a promise-based manner. It wraps the
 * underlying node-osascript functionality to provide a more ergonomic API.
 */
export class AppleScriptExecutor {
  /**
   * Executes the given AppleScript code and returns the result.
   *
   * @param script AppleScript code to execute
   * @param timeoutMs Optional timeout in milliseconds (default: 30000)
   * @returns a promise that resolves with the script's result
   * @throws if AppleScript execution fails
   */
  public async execute(
    script: string,
    timeoutMs: number = 30000,
  ): Promise<unknown> {
    try {
      const { result } = await executeWithTimeout(script, timeoutMs);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`AppleScript execution failed: ${error.message}`);
      }

      throw new Error(`AppleScript execution failed: ${String(error)}`);
    }
  }
}

/**
 * Execute an AppleScript string with timeout support
 *
 * @param script The AppleScript code to execute
 * @param timeoutMs Timeout in milliseconds
 * @param variables Optional object to inject variables into the script
 * @returns a promise that resolves with the result and raw output of the
 *    AppleScript execution
 */
function executeWithTimeout(
  script: string,
  timeoutMs: number,
  variables?: Record<string, unknown>,
): Promise<{ result: unknown; raw: unknown }> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    const childProcess = executeWithCallback(
      script,
      variables,
      (err: Error | null, result: unknown, raw: unknown) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (err) {
          reject(err);
          return;
        }
        resolve({ result, raw });
      },
    );

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (childProcess && childProcess.kill) {
        childProcess.kill();
      }
      reject(new Error(`AppleScript execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
