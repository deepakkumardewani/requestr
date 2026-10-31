import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOKEN_SHAPE_CORPUS } from "../redact.corpus";
import { relayToolRegistry } from "./registry";

/**
 * Audit: every registered tool must be exercised by a sibling spec whose test
 * titles carry [success] and [invalid], and [undo] when the tool writes.
 */
const TOOLS_DIR = __dirname;
const SELF = "coverage.spec.ts";
const WRITE_KINDS = new Set(["auto", "confirm"]);
/**
 * Writes that leave no workspace change to undo: network calls, view state,
 * file exports, and a backup import (a merge-only restore with no change-log entry).
 */
const NOT_UNDOABLE = new Set([
  "send_request",
  "run_chain",
  "open_item",
  "open_page",
  "show_sidebar_tab",
  "export_backup",
  "import_backup",
  "export_postman",
  "set_active_environment",
]);
const TEST_START = /\n\s*(?:it|test)(?:\.each\((?:.|\n)*?\))?\(\s*["'`]/;
const TAGS = /^(?:\[(?:success|invalid|undo)\])+/;

type TestBlock = { tags: string[]; body: string; group: string };

const GROUP_TITLE = /describe\(\s*["'`]([^"'`]+)["'`]/g;

/** Title of the nearest describe above `offset`, which usually names the tool. */
function groupAt(source: string, offset: number): string {
  const titles = [...source.slice(0, offset).matchAll(GROUP_TITLE)];
  return titles.at(-1)?.[1] ?? "";
}

/** Splits a spec into tests; an it.each table stays with its own test. */
function testBlocks(source: string): TestBlock[] {
  const starts = [...source.matchAll(new RegExp(TEST_START.source, "g"))];
  return starts.flatMap((start, index) => {
    const end = starts[index + 1]?.index ?? source.length;
    const body = source.slice(start.index, end);
    // The title (and its tags) follows the matched opener.
    const title = source.slice(start.index + start[0].length, end);
    const tags = TAGS.exec(title)?.[0].match(/[a-z]+/g);
    return tags ? [{ tags, body, group: groupAt(source, start.index) }] : [];
  });
}

const blocks = readdirSync(TOOLS_DIR)
  .filter((file) => file.endsWith(".spec.ts") && file !== SELF)
  .flatMap((file) => testBlocks(readFileSync(join(TOOLS_DIR, file), "utf8")));

function tagsFor(tool: string): Set<string> {
  const quoted = new RegExp(`["'\`]${tool}["'\`]`);
  return new Set(
    blocks.filter((block) => block.group === tool || quoted.test(block.body)).flatMap((block) => block.tags),
  );
}

describe("tool coverage audit", () => {
  it.each([...relayToolRegistry.values()].map((t) => [t.name, t.kind]))(
    "%s (%s) has success, invalid and, when it writes, undo tests",
    (name, kind) => {
      const tags = tagsFor(name);
      const required = ["success", "invalid"];
      if (WRITE_KINDS.has(kind) && !NOT_UNDOABLE.has(name)) required.push("undo");
      expect(required.filter((tag) => !tags.has(tag))).toEqual([]);
    },
  );

  it("ships a non-empty redaction corpus", () => {
    expect(TOKEN_SHAPE_CORPUS.length).toBeGreaterThan(0);
  });
});
