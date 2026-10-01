import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const SOURCE_LOCALE = "en";
const TARGET_LOCALES = ["fr", "ja"] as const;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function flattenKeys(value: Json, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function readKeys(locale: string, file: string): string[] {
  const json = JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, locale, file), "utf8"),
  ) as Json;
  return flattenKeys(json).sort();
}

const namespaceFiles = readdirSync(path.join(MESSAGES_DIR, SOURCE_LOCALE))
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("locale key parity", () => {
  it("finds namespace files to compare", () => {
    expect(namespaceFiles.length).toBeGreaterThan(0);
  });

  describe.each(namespaceFiles)("%s", (file) => {
    it.each(TARGET_LOCALES)("%s has exactly the en key set", (locale) => {
      expect(readKeys(locale, file)).toEqual(readKeys(SOURCE_LOCALE, file));
    });
  });

  it.each(TARGET_LOCALES)("%s has no extra namespace files", (locale) => {
    const files = readdirSync(path.join(MESSAGES_DIR, locale))
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toEqual(namespaceFiles);
  });
});
