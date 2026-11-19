import path from "node:path";
import { defineConfig } from "vitest/config";

/** Files excluded from coverage totals (adapters, UI-only, or covered via e2e). */
const COVERAGE_EXCLUDE = [
  "src/**/*.spec.ts",
  "src/**/*.spec.tsx",
  "src/**/*.test.ts",
  "src/vitest-setup.ts",
  "**/*.d.ts",
  "src/components/reactbits/**",
  "src/lib/openapiParser.ts",
  "src/lib/openapiParser.test.ts",
  "src/lib/postmanExporter.ts",
  "src/lib/scriptLinter.ts",
  "src/lib/graphqlIntrospection.ts",
  "src/lib/historyExport.ts",
  "src/lib/chainUtils.ts",
  "src/lib/importScanner.ts",
  "src/lib/dotenvImport.ts",
  "src/lib/dotenvImport.test.ts",
  "src/lib/requestTemplates.ts",
  "src/stores/useCollectionsStore.ts",
  "src/stores/useDataSchemaStore.ts",
  "src/stores/useFolderExpandStore.ts",
  "src/stores/useJsonVisualizeStore.ts",
  "src/hooks/useMethodTheme.ts",
];

/**
 * Resource caps. Vitest defaults to (cores - 1) workers; several concurrent
 * runs of that exhausted memory on a 12-core / 32 GB machine. Override per run
 * with `--maxWorkers=<n>` (Vitest 4 moved `poolOptions.forks.maxForks` to the
 * top-level `maxWorkers`).
 */
const MAX_TEST_WORKERS = 3;
/** Per-fork V8 heap cap (MB); applies to direct `vitest` invocations too. */
const WORKER_MAX_OLD_SPACE_MB = 3072;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    passWithNoTests: false,
    setupFiles: ["./src/vitest-setup.ts"],
    pool: "forks",
    maxWorkers: MAX_TEST_WORKERS,
    execArgv: [
      // Node 25+ ships a global `localStorage` that shadows jsdom's and is undefined without a file.
      "--no-experimental-webstorage",
      `--max-old-space-size=${WORKER_MAX_OLD_SPACE_MB}`,
    ],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      include: [
        "src/lib/**/*.ts",
        "src/stores/**/*.ts",
        "src/hooks/**/*.ts",
        "src/app/api/**/*.ts",
        "src/components/chain/canvas/hooks/**/*.ts",
      ],
      exclude: COVERAGE_EXCLUDE,
      thresholds: {
        lines: 90,
        branches: 70,
        functions: 90,
        statements: 85,
        "src/lib/**": { lines: 85 },
        "src/stores/**": { lines: 90 },
        "src/hooks/**": { lines: 95 },
        "src/components/chain/canvas/hooks/**": { lines: 95 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
