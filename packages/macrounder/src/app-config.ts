import { z } from "zod";

// Schema for build configuration
export const BuildConfigSchema = z
  .object({
    command: z.string().optional(),
    working_directory: z.string().default(".").optional(),
  })
  .optional();

// Schema for runtime configuration
export const RunConfigSchema = z.object({
  binary_path: z.string().optional(), // Can be auto-detected
  working_directory: z.string().default("."),
  args: z.array(z.string()).default([]),
});

// Schema for the main app configuration
export const AppConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    check_interval: z.number().min(60).default(300),
    auto_start: z.boolean().default(true),
    auto_restart: z.boolean().default(true),
  }),
  build: BuildConfigSchema.default({}),
  run: RunConfigSchema.default({
    working_directory: ".",
    args: [],
  }),
  environment: z.record(z.string()).default({}).optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type BuildConfig = z.infer<typeof BuildConfigSchema>;
export type RunConfig = z.infer<typeof RunConfigSchema>;

// Schema for global configuration
export const GlobalConfigSchema = z.object({
  log_level: z
    .enum(["debug", "info", "warn", "error"])
    .default("info")
    .optional(),
  log_dir: z.string().default("~/.macrounder/logs").optional(),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

// Helper to convert AppConfig to the legacy ServiceConfig format
export function appConfigToServiceConfig(appConfig: AppConfig) {
  return {
    name: appConfig.app.name,
    repository: appConfig.app.repository,
    binaryPath: appConfig.run.binary_path || detectBinaryPath(appConfig),
    checkInterval: appConfig.app.check_interval,
    autoStart: appConfig.app.auto_start,
    env: appConfig.environment || {},
    args: appConfig.run.args || [],
    workingDirectory: appConfig.run.working_directory || ".",
  };
}

// Smart defaults for binary path detection
function detectBinaryPath(appConfig: AppConfig): string {
  const name = appConfig.app.name;

  // Common patterns for binary locations
  const patterns = [
    `./dist/${name}`,
    `./build/${name}`,
    `./bin/${name}`,
    `./${name}`,
    `./target/release/${name}`,
    `./target/debug/${name}`,
  ];

  // Return the first pattern as default
  // In real implementation, we could check if files exist
  return patterns[0]!;
}

// Template for new app configuration
export function createDefaultAppConfig(
  name: string,
  repository: string,
): AppConfig {
  return AppConfigSchema.parse({
    app: {
      name,
      repository,
      check_interval: 300,
      auto_start: true,
      auto_restart: true,
    },
    build: {
      working_directory: ".",
    },
    run: {
      binary_path: `./dist/${name}`,
      working_directory: ".",
      args: [],
    },
    environment: {},
  });
}
