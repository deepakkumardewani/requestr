import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * R10 backstop: product code reaches analytics only through the public API.
 * No file may import a PostHog package, and `analytics/server/*` is private to
 * `src/lib/analytics/` and `src/app/api/ingest/`.
 */

const SRC_ROOT = path.resolve(__dirname, "../..");
const THIS_FILE = path.resolve(__filename);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const ALLOWED_SERVER_IMPORTERS = ["lib/analytics", "app/api/ingest"];
const SERVER_DIR = "lib/analytics/server";

const IMPORT_PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /^\s*import\s*["']([^"']+)["']/gm,
];

type Violation = { file: string; specifier: string; rule: "posthog" | "server" };

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : listSourceFiles(full);
    }
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function extractSpecifiers(content: string): string[] {
  return IMPORT_PATTERNS.flatMap((pattern) =>
    [...content.matchAll(pattern)].map((match) => match[1]),
  );
}

/** Path of an import target relative to `root`, or null for bare package specifiers. */
function resolveInternal(
  specifier: string,
  importer: string,
  root: string,
): string | null {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (!specifier.startsWith(".")) return null;
  return path
    .relative(root, path.resolve(path.dirname(importer), specifier))
    .split(path.sep)
    .join("/");
}

const isInside = (target: string, folder: string) =>
  target === folder || target.startsWith(`${folder}/`);

function classify(
  specifier: string,
  file: string,
  root: string,
): Violation["rule"] | null {
  if (/^@?posthog/i.test(specifier)) return "posthog";
  const target = resolveInternal(specifier, file, root);
  if (target === null || !isInside(target, SERVER_DIR)) return null;
  const importer = path.relative(root, file).split(path.sep).join("/");
  const allowed = ALLOWED_SERVER_IMPORTERS.some((folder) =>
    isInside(importer, folder),
  );
  return allowed ? null : "server";
}

function findViolations(root: string, skip: string[] = []): Violation[] {
  return listSourceFiles(root)
    .filter((file) => !skip.includes(file))
    .flatMap((file) =>
      extractSpecifiers(fs.readFileSync(file, "utf8")).flatMap((specifier) => {
        const rule = classify(specifier, file, root);
        return rule ? [{ file: path.relative(root, file), specifier, rule }] : [];
      }),
    );
}

const tempRoots: string[] = [];

function makeFixtureRoot(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rq-boundary-"));
  tempRoots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("analytics import boundary (R10)", () => {
  it("has no violations in the real source tree", () => {
    expect(findViolations(SRC_ROOT, [THIS_FILE])).toEqual([]);
  });

  describe("scanner on seeded fixtures", () => {
    it("flags a PostHog package import", () => {
      const root = makeFixtureRoot({
        "components/Bad.ts": 'import posthog from "posthog-js";\n',
      });
      expect(findViolations(root)).toEqual([
        { file: "components/Bad.ts", specifier: "posthog-js", rule: "posthog" },
      ]);
    });

    it("flags scoped, dynamic and require forms of PostHog", () => {
      const root = makeFixtureRoot({
        "a.ts": 'import { x } from "@posthog/core";\n',
        "b.ts": 'const m = await import("posthog-node");\n',
        "c.js": 'const p = require("posthog-js");\n',
        "d.ts": 'import "posthog-js";\n',
      });
      expect(findViolations(root).map((v) => v.file).sort()).toEqual([
        "a.ts",
        "b.ts",
        "c.js",
        "d.ts",
      ]);
    });

    it("flags PostHog even inside the allowed analytics folders", () => {
      const root = makeFixtureRoot({
        "lib/analytics/x.ts": 'import p from "posthog-js";\n',
      });
      expect(findViolations(root)).toHaveLength(1);
    });

    it("flags an alias import of analytics/server from product code", () => {
      const root = makeFixtureRoot({
        "components/Bad.tsx":
          'import { validate } from "@/lib/analytics/server/validate";\n',
      });
      expect(findViolations(root)).toEqual([
        {
          file: "components/Bad.tsx",
          specifier: "@/lib/analytics/server/validate",
          rule: "server",
        },
      ]);
    });

    it("flags a relative import of analytics/server from product code", () => {
      const root = makeFixtureRoot({
        "stores/useBad.ts":
          'import { sink } from "../lib/analytics/server/posthogSink";\n',
      });
      expect(findViolations(root).map((v) => v.rule)).toEqual(["server"]);
    });

    it("flags a re-export from analytics/server", () => {
      const root = makeFixtureRoot({
        "lib/other/index.ts": 'export * from "@/lib/analytics/server/validate";\n',
      });
      expect(findViolations(root).map((v) => v.rule)).toEqual(["server"]);
    });

    it("allows analytics/server imports from the allowed folders", () => {
      const root = makeFixtureRoot({
        "lib/analytics/server/validate.ts": "export const v = 1;\n",
        "lib/analytics/index.ts": 'import { v } from "./server/validate";\n',
        "app/api/ingest/route.ts":
          'import { v } from "@/lib/analytics/server/validate";\n',
      });
      expect(findViolations(root)).toEqual([]);
    });

    it("ignores unrelated imports and non-source files", () => {
      const root = makeFixtureRoot({
        "a.ts": 'import React from "react";\nimport x from "./analytics-server-ish";\n',
        "notes.md": 'import p from "posthog-js"\n',
      });
      expect(findViolations(root)).toEqual([]);
    });

    it("skips node_modules and explicitly skipped files", () => {
      const root = makeFixtureRoot({
        "node_modules/pkg/index.ts": 'import p from "posthog-js";\n',
        "skip.ts": 'import p from "posthog-js";\n',
      });
      expect(findViolations(root, [path.join(root, "skip.ts")])).toEqual([]);
    });
  });
});
