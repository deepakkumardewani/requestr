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

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    passWithNoTests: false,
    setupFiles: ["./src/vitest-setup.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      include: [
        "src/lib/**/*.ts",
        "src/stores/**/*.ts",
        "src/hooks/**/*.ts",
        "src/app/api/**/*.ts",
      ],
      exclude: COVERAGE_EXCLUDE,
      thresholds: {
        lines: 80,
        "src/lib/**": { lines: 85 },
        "src/stores/**": { lines: 90 },
        "src/hooks/**": { lines: 95 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
