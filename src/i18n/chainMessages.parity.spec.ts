import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CHAIN_FILE = "chain.json";
const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const SOURCE_LOCALE = "en";
const TARGET_LOCALES = ["fr", "ja"] as const;
const PLURAL_START = /\{\s*\w+\s*,\s*plural\s*,/g;

/**
 * Keys added by the chain-UI-polish feature. Each task that adds a chain key
 * appends it here so fr/ja are proven to be real translations, not en copies.
 */
const FEATURE_KEYS: string[] = [
  "startNodeDefaultOutput",
  "runLogCountPassed",
  "runLogCountFailed",
  "runLogCountSkipped",
  "runLogCountStopped",
  "runLogNoStepsShort",
  "runLogCollapsedStatusPassed",
  "runLogCollapsedStatusFailed",
  "runLogCollapsedStatusStopped",
  "runLogCollapsedStatusRunning",
  "clearNodesButton",
  "clearNodesTitle",
  "clearNodesDescription",
  "clearNodesConfirm",
  "clearEdgesDescription",
  "clearRunResults",
  "headerLastRun",
  "headerNotYetRun",
  "headerLastRunCounts",
  "headerLastRunNoSteps",
  "headerOpenLastRun",
  "headerNodeCount",
  "headerMoreActions",
];

/** Keys whose translation is legitimately identical to en (brand names, tokens). */
const UNTRANSLATED_ALLOWLIST: string[] = [];

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  return JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, locale, CHAIN_FILE), "utf8")
  ) as Messages;
}

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (value === null || typeof value !== "object") return {};
  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => ({
      ...acc,
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    }),
    {}
  );
}

/** Index of the brace closing the one opened at `openIndex`. */
function matchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") depth -= 1;
    if (depth === 0) return i;
  }
  return text.length - 1;
}

/** Category selectors (`one`, `other`, `=0`…) of the options at depth 1 of a plural body. */
function categoriesOf(body: string): string[] {
  const categories: string[] = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("{", i);
    if (open === -1) break;
    categories.push(body.slice(i, open).trim());
    i = matchingBrace(body, open) + 1;
  }
  return categories;
}

/** One category list per ICU plural expression in `message`. */
function pluralCategories(message: string): string[][] {
  return [...message.matchAll(PLURAL_START)].map((match) => {
    const start = match.index ?? 0;
    const end = matchingBrace(message, start);
    const body = message.slice(start + match[0].length, end);
    return categoriesOf(body);
  });
}

const en = flatten(load(SOURCE_LOCALE));
const locales = {
  en,
  fr: flatten(load("fr")),
  ja: flatten(load("ja")),
};

describe("chain.json locale parity", () => {
  it.each(TARGET_LOCALES)("%s has exactly the en key set", (locale) => {
    const enKeys = new Set(Object.keys(en));
    const localeKeys = new Set(Object.keys(locales[locale]));
    const missing = [...enKeys].filter((key) => !localeKeys.has(key));
    const extra = [...localeKeys].filter((key) => !enKeys.has(key));

    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  const pluralKeys = Object.keys(en).filter(
    (key) => pluralCategories(en[key]).length > 0
  );

  it("finds ICU plurals in en", () => {
    expect(pluralKeys.length).toBeGreaterThan(0);
  });

  it.each(pluralKeys)("en plural %s defines one and other", (key) => {
    pluralCategories(en[key]).forEach((categories) => {
      expect(categories, key).toEqual(expect.arrayContaining(["one", "other"]));
    });
  });

  it.each(pluralKeys)("fr plural %s defines one and other", (key) => {
    const blocks = pluralCategories(locales.fr[key] ?? "");
    expect(blocks, key).toHaveLength(pluralCategories(en[key]).length);
    blocks.forEach((categories) => {
      expect(categories, key).toEqual(expect.arrayContaining(["one", "other"]));
    });
  });

  it.each(pluralKeys)("ja plural %s uses other only when plural", (key) => {
    const blocks = pluralCategories(locales.ja[key] ?? "");
    // ja may phrase a count without ICU plural; any plural it does use must be `other`-only.
    expect(blocks.length, key).toBeLessThanOrEqual(
      pluralCategories(en[key]).length
    );
    blocks.forEach((categories) => {
      expect(categories, key).toContain("other");
      expect(categories, key).not.toContain("one");
    });
  });

  describe.each(TARGET_LOCALES)("%s feature keys", (locale) => {
    const translatable = FEATURE_KEYS.filter(
      (key) => !UNTRANSLATED_ALLOWLIST.includes(key)
    );

    it("lists only keys that exist in en", () => {
      expect(translatable.filter((key) => !(key in en))).toEqual([]);
    });

    it.each(translatable)("%s is translated, not copied from en", (key) => {
      expect(locales[locale][key], key).toBeDefined();
      expect(locales[locale][key], key).not.toBe(en[key]);
    });
  });
});
