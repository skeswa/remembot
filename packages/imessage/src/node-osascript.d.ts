declare module "node-osascript" {
  export function exec(
    script: string,
    callback?: (error: Error | null, result: unknown) => void,
  ): Promise<unknown>;
  export function execFile(
    filePath: string,
    args?: unknown[],
    callback?: (error: Error | null, result: unknown) => void,
  ): Promise<unknown>;
}
