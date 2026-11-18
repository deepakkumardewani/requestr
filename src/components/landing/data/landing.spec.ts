import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pickActiveSection } from "../hooks/useActiveSection";
import { APPROVAL_ROWS } from "./approvals";
import { COMMAND_PALETTE_MEDIA, DATA_STEPS } from "./copy";
import { NAV_LINKS, navLinkForSection, SECTION_IDS } from "./links";
import { TOOL_ENTRIES, toDarkScreenshot } from "./toolbox";

const PUBLIC_DIR = join(process.cwd(), "public");
const inPublic = (path: string) => existsSync(join(PUBLIC_DIR, path));

describe("navLinkForSection", () => {
  it("marks nothing above the first linked section", () => {
    expect(navLinkForSection(null)).toBeNull();
    expect(navLinkForSection(SECTION_IDS.hero)).toBeNull();
  });

  it("keeps The client active across every section it covers", () => {
    const labels = [
      SECTION_IDS.commandPalette,
      SECTION_IDS.importBackup,
      SECTION_IDS.toolbox,
    ].map((id) => navLinkForSection(id)?.label);
    expect(labels).toEqual(["The client", "The client", "The client"]);
  });

  it("gives every link a target it also covers", () => {
    for (const link of NAV_LINKS) {
      expect(link.covers).toContain(link.sectionId);
    }
  });
});

describe("pickActiveSection", () => {
  const sections = [
    { id: "a", top: 0 },
    { id: "b", top: 500 },
    { id: "c", top: 1000 },
  ];

  it("returns the last section whose top has passed the line", () => {
    expect(pickActiveSection(sections, 600)).toBe("b");
    expect(pickActiveSection(sections, 5000)).toBe("c");
  });

  it("returns null before the first section", () => {
    expect(pickActiveSection(sections, -1)).toBeNull();
  });
});

describe("approval rows", () => {
  const outcomes = Object.fromEntries(
    APPROVAL_ROWS.map((row) => [row.id, row.outcomes]),
  );

  it("matches what the section copy says about each mode", () => {
    expect(outcomes).toEqual({
      read: { "always-ask": "runs", review: "runs", skip: "runs" },
      rename: { "always-ask": "asks", review: "runs", skip: "runs" },
      headers: { "always-ask": "asks", review: "runs", skip: "runs" },
      bulk: { "always-ask": "asks", review: "asks", skip: "runs" },
      scripts: { "always-ask": "asks", review: "asks", skip: "runs" },
      send: { "always-ask": "asks", review: "asks", skip: "runs" },
      delete: { "always-ask": "asks", review: "asks", skip: "runs" },
      backup: { "always-ask": "asks", review: "asks", skip: "asks" },
    });
  });
});

describe("media the page points at", () => {
  it("has a dark capture for every tool", () => {
    expect(TOOL_ENTRIES.length).toBeGreaterThan(0);
    for (const tool of TOOL_ENTRIES) {
      expect(inPublic(tool.screenshot.src), tool.screenshot.src).toBe(true);
    }
  });

  it("has a capture for every import and backup step", () => {
    for (const step of DATA_STEPS) {
      expect(inPublic(step.screenshot.src), step.screenshot.src).toBe(true);
    }
  });

  it("has both encodes and the poster for the command palette clip", () => {
    const files = [
      `${COMMAND_PALETTE_MEDIA.src}.webm`,
      `${COMMAND_PALETTE_MEDIA.src}.mp4`,
      COMMAND_PALETTE_MEDIA.poster,
    ];
    for (const file of files) expect(inPublic(file), file).toBe(true);
  });

  it("swaps only the light suffix", () => {
    expect(toDarkScreenshot("/screens/chains-light.webp")).toBe(
      "/screens/chains-dark.webp",
    );
    expect(toDarkScreenshot("/media/relay/relay-poster.webp")).toBe(
      "/media/relay/relay-poster.webp",
    );
  });
});
