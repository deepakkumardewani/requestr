import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One JSON file per feature area — drop a new `<feature>.json` into this
 * directory rather than growing an existing one; it's picked up
 * automatically. Each file may contribute top-level array keys (records
 * merged across files, deduped by `id`) or top-level object/scalar keys
 * (must be unique across files).
 *
 * Resolved from the repo root because every consumer (Playwright, vitest,
 * `bun run qa:seed:build`) runs from there, and it avoids depending on
 * `import.meta`/`__dirname`, which differ between those loaders.
 */
const SEED_DIR = path.resolve(process.cwd(), "e2e/fixtures/seed");

function readSeedFiles(): Record<string, unknown>[] {
  return readdirSync(SEED_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(SEED_DIR, name), "utf8")));
}

export type QaSeedData = {
  environments: unknown[];
  collections: unknown[];
  requests: unknown[];
  chains: unknown[];
  legacyChainConfig: Record<string, unknown>;
  legacyStandaloneChain: Record<string, unknown>;
  [key: string]: unknown;
};

function hasId(record: unknown): record is { id: string } {
  return (
    typeof record === "object" &&
    record !== null &&
    "id" in record &&
    typeof (record as { id: unknown }).id === "string"
  );
}

/**
 * Merges the per-feature seed files into a single seed data object.
 * Throws if two files declare the same record `id` within an array key, or
 * the same non-array top-level key — both indicate a copy/paste mistake
 * rather than intentional growth.
 */
export function loadSeedData(): QaSeedData {
  const merged: Record<string, unknown> = {};
  const seenIds = new Set<string>();

  for (const file of readSeedFiles()) {
    for (const [key, value] of Object.entries(file)) {
      if (Array.isArray(value)) {
        const bucket = (merged[key] as unknown[] | undefined) ?? [];
        for (const record of value) {
          if (hasId(record)) {
            if (seenIds.has(record.id)) {
              throw new Error(`Duplicate seed record id: "${record.id}"`);
            }
            seenIds.add(record.id);
          }
          bucket.push(record);
        }
        merged[key] = bucket;
      } else {
        if (key in merged) {
          throw new Error(`Duplicate seed key across files: "${key}"`);
        }
        merged[key] = value;
      }
    }
  }

  return merged as QaSeedData;
}
