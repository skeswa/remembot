import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Maintainability Tests", () => {
  const projectRoot = join(import.meta.dir, "..");
  const srcDir = join(projectRoot, "src");

  // MAINT-NF-001: Verify TypeScript usage throughout codebase
  describe("MAINT-NF-001: TypeScript usage", () => {
    test("should use TypeScript for all source files", () => {
      const checkDirectory = (dir: string): void => {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.includes("node_modules")) {
            checkDirectory(fullPath);
          } else if (entry.isFile()) {
            // All source files should be .ts or .tsx
            if (entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) {
              throw new Error(`Found JavaScript file: ${fullPath}`);
            }
          }
        }
      };

      checkDirectory(srcDir);
      expect(true).toBe(true);
    });

    test("should have TypeScript configuration", () => {
      expect(existsSync(join(projectRoot, "tsconfig.json"))).toBe(true);
    });
  });

  // MAINT-NF-002: Verify module separation and architecture
  describe("MAINT-NF-002: Module architecture", () => {
    test("should have clear module separation", () => {
      const modules = [
        "app-config.ts",
        "app-config-manager.ts",
        "config-manager.ts",
        "github-monitor.ts",
        "process-manager.ts",
        "service-manager.ts",
        "update-manager.ts",
        "cli.ts",
        "types.ts",
      ];

      for (const module of modules) {
        expect(existsSync(join(srcDir, module))).toBe(true);
      }
    });

    test("should follow consistent export patterns", () => {
      const typeFile = readFileSync(join(srcDir, "types.ts"), "utf-8");
      expect(typeFile).toContain("export interface");
      expect(typeFile).toContain("export type");
    });
  });

  // MAINT-NF-003: Track and maintain test coverage metrics
  describe("MAINT-NF-003: Test coverage", () => {
    test("should have comprehensive test coverage", () => {
      // Count test files vs source files
      const sourceFiles = readdirSync(srcDir).filter(
        (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts") && f !== "cli.ts",
      );

      const testFiles = readdirSync(srcDir).filter((f) =>
        f.endsWith(".spec.ts"),
      );

      // Most source files should have corresponding test files
      expect(testFiles.length).toBeGreaterThanOrEqual(
        Math.floor(sourceFiles.length * 0.6),
      );
    });
  });

  // MAINT-NF-004: Verify ESLint compliance
  describe("MAINT-NF-004: ESLint compliance", () => {
    test("should have ESLint configuration", () => {
      // Check for ESLint config in package.json or separate file
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, "package.json"), "utf-8"),
      );

      // Should have lint script
      expect(packageJson.scripts?.lint).toBeDefined();
    });
  });

  // MAINT-NF-005: Verify structured logging implementation
  describe("MAINT-NF-005: Structured logging", () => {
    test("should use pino for structured logging", () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, "package.json"), "utf-8"),
      );

      // Should have pino as dependency
      expect(packageJson.dependencies?.pino).toBeDefined();
    });

    test("should use logger consistently", () => {
      const serviceManager = readFileSync(
        join(srcDir, "service-manager.ts"),
        "utf-8",
      );
      expect(serviceManager).toContain("import pino");
      expect(serviceManager).toContain("this.logger");
    });
  });

  // MAINT-NF-006: Verify API and configuration documentation
  describe("MAINT-NF-006: Documentation", () => {
    test("should have README documentation", () => {
      expect(existsSync(join(projectRoot, "README.md"))).toBe(true);
    });

    test("should have requirements documentation", () => {
      expect(existsSync(join(projectRoot, "docs/requirements.md"))).toBe(true);
    });

    test("should have TypeScript type definitions", () => {
      const typesFile = readFileSync(join(srcDir, "types.ts"), "utf-8");
      // Check that types are exported
      expect(typesFile.includes("export")).toBe(true);
    });
  });

  // MAINT-NF-007: Verify semantic versioning in releases
  describe("MAINT-NF-007: Semantic versioning", () => {
    test("should use semantic versioning", () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, "package.json"), "utf-8"),
      );

      // Version should follow semantic versioning pattern
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
