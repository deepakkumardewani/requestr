import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "./messages";

const RELAY_FILES = ["relay.json", "relayDock.json"];
/** The shell file is registered eagerly; the dock file ships with the lazy dock chunk. */
const SHELL_FILE = "relay.json";
const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const SOURCE_LOCALE = "en";
const TARGET_LOCALES = ["fr", "ja"] as const;
const ALL_LOCALES = [SOURCE_LOCALE, ...TARGET_LOCALES] as const;

/** Keys whose translation is legitimately identical to en (the product name). */
// "collection" is spelled the same in French, so its count phrase equals en.
const UNTRANSLATED_ALLOWLIST: string[] = [
  "title",
  "toggleLabel",
  "settings.title",
  "changes.summary.count.collection",
];

type Messages = Record<string, unknown>;

function loadFile(locale: string, file: string): Messages {
  return JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, locale, file), "utf8"),
  ) as Messages;
}

function load(locale: string, files: string[] = RELAY_FILES): Messages {
  return Object.assign({}, ...files.map((file) => loadFile(locale, file)));
}

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (value === null || typeof value !== "object") return {};
  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => ({
      ...acc,
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

const en = flatten(load(SOURCE_LOCALE));
const locales = {
  en,
  fr: flatten(load("fr")),
  ja: flatten(load("ja")),
};

describe("relay messages locale parity", () => {
  it("has shell strings in en", () => {
    expect(Object.keys(en).length).toBeGreaterThan(0);
  });

  it.each(TARGET_LOCALES)("%s has exactly the en key set", (locale) => {
    const enKeys = new Set(Object.keys(en));
    const localeKeys = new Set(Object.keys(locales[locale]));
    const missing = [...enKeys].filter((key) => !localeKeys.has(key));
    const extra = [...localeKeys].filter((key) => !enKeys.has(key));

    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  describe.each(TARGET_LOCALES)("%s translations", (locale) => {
    const translatable = Object.keys(en).filter(
      (key) => !UNTRANSLATED_ALLOWLIST.includes(key),
    );

    it.each(translatable)("%s is translated, not copied from en", (key) => {
      expect(locales[locale][key], key).toBeTruthy();
      expect(locales[locale][key], key).not.toBe(en[key]);
    });
  });

  it.each(ALL_LOCALES)("%s registers the relay namespace", (locale) => {
    const registered = flatten(MESSAGES[locale].relay);
    expect(registered).toEqual(flatten(load(locale, [SHELL_FILE])));
  });

  it.each(ALL_LOCALES)("%s dock keys stay out of the eager namespace", (locale) => {
    const eager = Object.keys(flatten(MESSAGES[locale].relay));
    const dock = Object.keys(flatten(loadFile(locale, "relayDock.json")));
    expect(eager.filter((key) => dock.includes(key))).toEqual([]);
  });
});
