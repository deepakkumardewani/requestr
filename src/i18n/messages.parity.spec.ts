import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const SOURCE_LOCALE = "en";
const TARGET_LOCALES = ["fr", "ja"] as const;
/** Namespaces the Relay feature writes to; each must stay in the directory-wide parity sweep. */
const RELAY_NAMESPACES = [
  "relayDock.json",
  "relay.json",
  "settings.json",
  "common.json",
  "errors.json",
];

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

  it.each(RELAY_NAMESPACES)("%s is part of the parity sweep", (file) => {
    expect(namespaceFiles).toContain(file);
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

  describe("keys added by the relay improvements", () => {
    it.each([
      ["common.json", "history"],
      ["navigation.json", "breadcrumbHome"],
    ])("%s keeps %s in every locale", (file, key) => {
      for (const locale of [SOURCE_LOCALE, ...TARGET_LOCALES]) {
        const keys = readKeys(locale, file);
        expect(
          keys.some((k) => k === key || k.startsWith(`${key}.`)),
          `${locale}/${file}`,
        ).toBe(true);
      }
    });
  });
});
