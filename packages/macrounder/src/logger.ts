import { pino } from "pino";
import { join } from "path";
import { mkdirSync } from "fs";
import type { Logger } from "pino";

export interface LoggerOptions {
  name: string;
  logDir: string;
  level?: string;
  console?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
  const { name, logDir, level = "info", console = true } = options;

  // Ensure log directory exists
  mkdirSync(logDir, { recursive: true });

  const logFile = join(logDir, `${name}.log`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targets: any[] = [
    {
      target: "pino/file",
      options: { destination: logFile, mkdir: true },
    },
  ];

  if (console) {
    targets.push({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    });
  }

  return pino(
    {
      level,
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport({
      targets,
    }),
  );
}

export function getLogFilePath(logDir: string, serviceName: string): string {
  return join(logDir, `${serviceName}.log`);
}

export async function readLogFile(
  filePath: string,
  lines?: number,
): Promise<string[]> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    return [];
  }

  const content = await file.text();
  const allLines = content.split("\n").filter((line) => line.length > 0);

  if (lines && lines > 0) {
    return allLines.slice(-lines);
  }

  return allLines;
}

export async function* followLogFile(
  filePath: string,
  initialLines = 10,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  // Read initial lines
  const initial = await readLogFile(filePath, initialLines);
  for (const line of initial) {
    yield line;
  }

  // Watch for new lines
  const file = Bun.file(filePath);
  let lastSize = (await file.exists()) ? file.size : 0;

  while (!signal?.aborted) {
    await Bun.sleep(100); // Poll every 100ms

    const exists = await file.exists();
    if (!exists) {
      continue;
    }

    const currentSize = file.size;
    if (currentSize > lastSize) {
      // Read new content
      const stream = file.stream();
      const reader = stream.getReader();

      // Skip to where we left off
      let bytesRead = 0;
      while (bytesRead < lastSize) {
        const { done, value } = await reader.read();
        if (done) break;

        const remaining = lastSize - bytesRead;
        if (value.length <= remaining) {
          bytesRead += value.length;
        } else {
          bytesRead = lastSize;
        }
      }

      // Read new content
      const newContent: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        newContent.push(value);
      }

      reader.releaseLock();

      if (newContent.length > 0) {
        const text = new TextDecoder().decode(
          Buffer.concat(newContent.map((chunk) => Buffer.from(chunk))),
        );
        const lines = text.split("\n").filter((line) => line.length > 0);
        for (const line of lines) {
          yield line;
        }
      }

      lastSize = currentSize;
    }
  }
}
