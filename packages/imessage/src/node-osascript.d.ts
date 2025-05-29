declare module "node-osascript" {
  import type { ChildProcess } from "child_process";

  /**
   * Execute an AppleScript string, optionally injecting variables.
   * @param script The AppleScript code to execute.
   * @param variables Optional object to inject variables into the script.
   * @param callback Optional callback with (err, result, raw).
   * @returns The spawned ChildProcess.
   */
  export function execute(
    script: string,
    variables?: Record<string, unknown>,
    callback?: (err: Error | null, result: unknown, raw: unknown) => void
  ): ChildProcess;

  /**
   * Execute an AppleScript file, optionally injecting variables.
   * @param path Path to the AppleScript file.
   * @param variables Optional object to inject variables into the script.
   * @param callback Optional callback with (err, result, raw).
   * @returns The spawned ChildProcess.
   */
  export function executeFile(
    path: string,
    variables?: Record<string, unknown>,
    callback?: (err: Error | null, result: unknown, raw: unknown) => void
  ): ChildProcess;
}
