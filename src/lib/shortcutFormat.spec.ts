import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS, type Shortcut } from "@/app/settings/constants";
import enShortcuts from "../../messages/en/shortcuts.json";
import {
  buildShortcutsMarkdownTable,
  formatShortcutMarkdown,
  getAliasKeyParts,
  getShortcutKeyParts,
} from "./shortcutFormat";

const README_PATH = path.resolve(__dirname, "../../README.md");
const README_TABLE = /<!-- shortcuts:start -->\n([\s\S]*?)\n<!-- shortcuts:end -->/;

const RUN: Shortcut = { actionKey: "chainRun", key: "Enter" };
const NEW_COLLECTION: Shortcut = {
  actionKey: "registryNewCollection",
  key: "N",
  shift: true,
  ctrlOnly: true,
};
const DELETE: Shortcut = {
  actionKey: "chainDeleteSelection",
  key: "Delete",
  noModifier: true,
  aliases: [{ key: "Backspace", noModifier: true }],
};

describe("getShortcutKeyParts", () => {
  it("uses the platform modifier for mod bindings", () => {
    expect(getShortcutKeyParts(RUN, true)).toEqual(["⌘", "Enter"]);
    expect(getShortcutKeyParts(RUN, false)).toEqual(["Ctrl", "Enter"]);
  });

  it("keeps Ctrl on Mac for ctrlOnly bindings and inserts Shift", () => {
    expect(getShortcutKeyParts(NEW_COLLECTION, true)).toEqual([
      "Ctrl",
      "Shift",
      "N",
    ]);
  });

  it("omits the modifier for noModifier bindings and aliases", () => {
    expect(getShortcutKeyParts(DELETE, true)).toEqual(["Delete"]);
    expect(getAliasKeyParts({ key: "Backspace", noModifier: true }, true)).toEqual(
      ["Backspace"],
    );
  });
});

describe("formatShortcutMarkdown", () => {
  it("renders aliases after the primary chord", () => {
    expect(formatShortcutMarkdown(DELETE)).toBe("`Delete` / `Backspace`");
    expect(formatShortcutMarkdown(RUN)).toBe("`⌘/Ctrl` `Enter`");
  });
});

describe("README shortcut table", () => {
  it("is exactly the table generated from SHORTCUT_GROUPS", () => {
    const readme = readFileSync(README_PATH, "utf8");
    const match = README_TABLE.exec(readme);
    expect(match, "README is missing the shortcuts:start/end markers").not.toBeNull();
    expect(match?.[1]).toBe(buildShortcutsMarkdownTable(SHORTCUT_GROUPS, enShortcuts));
  });
});
