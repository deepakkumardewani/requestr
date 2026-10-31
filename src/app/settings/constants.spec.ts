import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getShortcutGroups, SHORTCUT_GROUPS, sectionFromHash } from "./constants";

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

describe("getShortcutGroups", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function relayRow(onMac: boolean, actionKey = "relayToggle") {
    return getShortcutGroups(onMac)
      .flatMap((g) => g.shortcuts)
      .find((s) => s.actionKey === actionKey);
  }

  it("adds the Mac Relay chord (Cmd+I) to the general group", () => {
    const general = getShortcutGroups(true).find((g) => g.id === "general");
    expect(general?.shortcuts.at(-2)).toMatchObject({
      actionKey: "relayToggle",
      key: "I",
      shift: false,
      ctrlOnly: false,
    });
  });

  it("adds the Ctrl+Shift+L chord on other platforms", () => {
    expect(relayRow(false)).toMatchObject({
      key: "L",
      shift: true,
      ctrlOnly: true,
    });
  });

  it("adds New Relay chat with Cmd+Shift+O on Mac and Ctrl+Shift+O elsewhere", () => {
    expect(relayRow(true, "relayNewChat")).toMatchObject({
      key: "O",
      shift: true,
      ctrlOnly: false,
      noteKey: "relayNewChatNote",
    });
    expect(relayRow(false, "relayNewChat")).toMatchObject({
      key: "O",
      shift: true,
      ctrlOnly: true,
    });
  });

  it("leaves the platform-neutral registry untouched", () => {
    getShortcutGroups(true);
    const keys = SHORTCUT_GROUPS.flatMap((g) => g.shortcuts).map(
      (s) => s.actionKey,
    );
    expect(keys).not.toContain("relayToggle");
  });

  it("drops the Relay row and returns the registry when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(getShortcutGroups(true)).toBe(SHORTCUT_GROUPS);
  });

  it.each(LOCALES)("has a %s translation for the Relay row", (locale) => {
    const messages = JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, locale, "shortcuts.json"), "utf8"),
    ) as Record<string, string>;
    expect(messages.relayToggle).toBeTruthy();
    expect(messages.relayNewChat).toBeTruthy();
    expect(messages.relayNewChatNote).toBeTruthy();
  });
});

describe("sectionFromHash", () => {
  it("maps a known section hash, with or without the #", () => {
    expect(sectionFromHash("#global")).toBe("global");
    expect(sectionFromHash("proxy")).toBe("proxy");
  });

  it("returns null for an empty or unknown hash", () => {
    expect(sectionFromHash("")).toBeNull();
    expect(sectionFromHash("#nope")).toBeNull();
  });
});
