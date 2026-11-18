import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { IDB_STORE_NAMES } from "./idbSchema";

const REPO_ROOT = join(__dirname, "../..");

// Maps a top-level seed data key to the IDB store it is written into (see
// e2e/fixtures/qaSeed.ts / scripts/build-qa-seed-js.ts putAll calls).
const SEED_KEY_TO_STORE: Record<string, string> = {
  environments: "environments",
  collections: "collections",
  requests: "requests",
  chains: "chains",
  legacyChainConfig: "chainConfigs",
};

describe("QA seed generator", () => {
  it("committed qa-seed.init.js matches what the generator would output now", async () => {
    // Run the generator via bun in a subprocess and diff its output against
    // the file already committed in e2e/fixtures/, so this fails whenever
    // seed data or the IDB schema changes without regenerating the file
    // (`bun run qa:seed:build`).
    const committed = readFileSync(
      join(REPO_ROOT, "e2e/fixtures/qa-seed.init.js"),
      "utf-8",
    );

    execSync("bun scripts/build-qa-seed-js.ts", { cwd: REPO_ROOT });
    execSync("bunx biome check --write e2e/fixtures/qa-seed.init.js", {
      cwd: REPO_ROOT,
    });

    const regenerated = readFileSync(
      join(REPO_ROOT, "e2e/fixtures/qa-seed.init.js"),
      "utf-8",
    );

    // Restore the committed file so running this test never leaves a dirty
    // working tree when there is in fact no drift.
    if (regenerated !== committed) {
      throw new Error(
        "e2e/fixtures/qa-seed.init.js is stale — run `bun run qa:seed:build` and commit the result.",
      );
    }
  });

  it("every seed data key maps to a store defined in the IDB schema", async () => {
    const { loadSeedData } = await import("../../e2e/fixtures/seed");
    const data = loadSeedData();

    for (const key of Object.keys(SEED_KEY_TO_STORE)) {
      expect(Object.prototype.hasOwnProperty.call(data, key)).toBe(true);
    }

    for (const storeName of Object.values(SEED_KEY_TO_STORE)) {
      expect(IDB_STORE_NAMES).toContain(storeName);
    }
  });
});
