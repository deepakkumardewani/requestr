import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS } from "./constants";

const MESSAGES_DIR = path.resolve(__dirname, "../../../messages");
const LOCALES = ["en", "fr", "ja"] as const;

describe("SHORTCUT_GROUPS", () => {
  it("has unique group ids", () => {
    const ids = SHORTCUT_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every chain shortcut a handler and no other group one", () => {
    for (const group of SHORTCUT_GROUPS) {
      for (const s of group.shortcuts) {
        expect(Boolean(s.handler), `${group.id}/${s.actionKey}`).toBe(
          group.id === "chain",
        );
      }
    }
  });

  it("documents Backspace and bare / as aliases of Delete and the block menu", () => {
    const chain = SHORTCUT_GROUPS.find((g) => g.id === "chain");
    const byHandler = (h: string) =>
      chain?.shortcuts.find((s) => s.handler === h)?.aliases?.map((a) => a.key);
    expect(byHandler("onDeleteSelection")).toEqual(["Backspace"]);
    expect(byHandler("onOpenBlockMenu")).toEqual(["/"]);
  });

  it("gives every group a labelKey and every shortcut an actionKey", () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(group.labelKey, group.id).toBeTruthy();
      for (const s of group.shortcuts) {
        expect(s.actionKey, group.id).toBeTruthy();
      }
    }
  });

  it.each(LOCALES)("has a %s translation for every label and action key", (locale) => {
    const messages = JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, locale, "shortcuts.json"), "utf8"),
    ) as Record<string, string>;
    const keys = SHORTCUT_GROUPS.flatMap((g) => [
      g.labelKey,
      ...g.shortcuts.map((s) => s.actionKey),
    ]);
    for (const key of keys) expect(messages[key ?? ""], String(key)).toBeTruthy();
  });
});
