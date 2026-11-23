import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// File-system checks on README.md: no browser page is used.
const REPO_ROOT = path.resolve(__dirname, "../../..");
const README = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

const REQUIRED_HEADINGS = [
  "Table of contents",
  "Why Requestr",
  "Features",
  "Quick start",
  "Privacy & analytics",
  "Tech stack",
  "Contributing",
  "License",
];
const MIN_RELATIVE_TARGETS = 10;
const EXTERNAL_TARGET = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** Heading lines outside fenced code blocks, as { level, text }. */
function headings(markdown: string): { level: number; text: string }[] {
  const result: { level: number; text: string }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const match = !inFence && /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) result.push({ level: match[1].length, text: match[2] });
  }
  return result;
}

/** Targets of markdown links/images and HTML src/href attributes. */
function linkTargets(markdown: string): string[] {
  const targets: string[] = [];
  const patterns = [
    /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    /\b(?:src|href)="([^"]+)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) targets.push(match[1]);
  }
  return targets;
}

test.describe("README structure and links @qa", () => {
  test("README contains hero, TOC, Why, Features, Quick start, Privacy & analytics, Tech stack, Contributing, License headings in order @critical", () => {
    const h2 = headings(README)
      .filter((h) => h.level === 2)
      .map((h) => h.text);
    const positions = REQUIRED_HEADINGS.map((name) => h2.indexOf(name));

    expect(positions.filter((p) => p === -1)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    // Hero: a top-level title and logo appear before the first H2.
    const firstH2 = README.search(/^##\s/m);
    const hero = README.slice(0, firstH2);
    expect(hero).toMatch(/<h1>\s*Requestr\s*<\/h1>|^#\s+Requestr/m);
    expect(hero).toMatch(/<img[^>]+src="public\/logo\.png"/);

    // Every TOC entry points at a real heading slug.
    const slugs = new Set(
      headings(README).map((h) =>
        h.text
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, "")
          .replace(/ /g, "-")
      )
    );
    const tocBlock = README.split(/^## Table of contents$/m)[1].split(/^## /m)[0];
    const tocAnchors = [...tocBlock.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(tocAnchors.length).toBe(REQUIRED_HEADINGS.length - 1);
    for (const anchor of tocAnchors) expect(slugs.has(anchor), anchor).toBe(true);
  });

  test("every relative link and image in README resolves to a file @critical", () => {
    const relative = linkTargets(README)
      .filter((t) => !EXTERNAL_TARGET.test(t) && !t.startsWith("#"))
      .map((t) => decodeURI(t.split("#")[0].split("?")[0]))
      .filter(Boolean);

    // Guards against a vacuous pass from a broken extractor.
    expect(relative.length).toBeGreaterThanOrEqual(MIN_RELATIVE_TARGETS);
    const missing = relative.filter(
      (t) => !existsSync(path.join(REPO_ROOT, t))
    );
    expect(missing).toEqual([]);
  });

  test('the old "Self-hosting" and "no analytics" claims are absent @medium', () => {
    expect(README).not.toMatch(/self-?host/i);
    expect(README).not.toMatch(/\bno analytics\b/i);
    expect(README).not.toMatch(/no (usage )?(tracking|telemetry)/i);
    // Sanity: the file read is the real README, not an empty string.
    expect(README).toContain("## Privacy & analytics");
  });
});
