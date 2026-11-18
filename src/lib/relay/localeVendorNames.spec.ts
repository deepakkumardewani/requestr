/** @vitest-environment node */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = path.resolve(__dirname, "../../../messages");
const VENDOR_NAMES = /grok|xai/i;

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

describe("locale messages (AC7.3)", () => {
  const files = listJsonFiles(MESSAGES_DIR);

  it("scans every locale file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("names no speech vendor in any locale", () => {
    const offenders = files.filter((file) =>
      VENDOR_NAMES.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(MESSAGES_DIR, file))).toEqual([]);
  });

  it("detects a vendor name when one is present", () => {
    expect(VENDOR_NAMES.test('{"mic":"Powered by Grok"}')).toBe(true);
  });
});
