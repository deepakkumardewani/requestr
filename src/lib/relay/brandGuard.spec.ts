/** @vitest-environment node */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findBannedTokens } from "./server/bannedTokens";

const ROOT = path.resolve(__dirname, "../../..");

/** Relay-owned surfaces: mirrors the BRAND_GREP list in TASKS.md. */
const GUARDED_PATHS = [
  "messages/en/relay.json",
  "messages/en/relayDock.json",
  "messages/fr/relay.json",
  "messages/fr/relayDock.json",
  "messages/ja/relay.json",
  "messages/ja/relayDock.json",
  "messages/en/common.json",
  "messages/fr/common.json",
  "messages/ja/common.json",
  "messages/en/navigation.json",
  "messages/fr/navigation.json",
  "messages/ja/navigation.json",
  "messages/en/shortcuts.json",
  "messages/en/settings.json",
  "src/components/relay",
  "src/components/ai-elements",
  "src/components/settings/RelaySection.tsx",
  "src/components/history",
  "src/lib/relay",
  "src/lib/history",
  "src/lib/historyExport.ts",
  "src/hooks/useRelayChat.ts",
  "src/hooks/useRelayPickerItems.ts",
  "src/hooks/useSpeechDictation.ts",
  "src/hooks/useRelayShortcut.ts",
  "src/hooks/useRelayFocus.ts",
  "src/hooks/useOnlineStatus.ts",
  "src/hooks/useAI.ts",
  "src/stores/useRelayStore.ts",
  "src/app/settings",
  "src/app/api/relay",
  "e2e/fixtures/relayRoutes.ts",
  "e2e/fixtures/relayE2eHelpers.ts",
  "e2e/fixtures/speechStub.ts",
  "e2e/fixtures/seed/relay-e2e.json",
  "e2e/fixtures/seed/relay-improvements.json",
];

/** The one place that may name the provider (exact path, not any `server` dir). */
const SERVER_DIR = "src/lib/relay/server";
const SPEC_FILE = /\.spec\.[cm]?[jt]sx?$/;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json)$/;
const PROVIDER_PATTERNS = ["@ai-sdk/deepseek", "DEEPSEEK_API_KEY"];

type SourceFile = { path: string; content: string };
type Finding = { path: string; line: number; tokens: string[] };

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

function isExcluded(relative: string): boolean {
  return (
    relative === SERVER_DIR ||
    relative.startsWith(`${SERVER_DIR}/`) ||
    SPEC_FILE.test(relative)
  );
}

function collect(relative: string, out: SourceFile[]): void {
  if (isExcluded(relative)) return;
  const absolute = path.join(ROOT, relative);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    // A guarded path may not exist yet (later phases add it); nothing to scan.
    return;
  }
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolute)) {
      collect(`${relative}/${entry}`, out);
    }
    return;
  }
  if (SOURCE_FILE.test(relative)) {
    out.push({ path: relative, content: readFileSync(absolute, "utf8") });
  }
}

function listFiles(roots: readonly string[]): SourceFile[] {
  const out: SourceFile[] = [];
  for (const root of roots) collect(toPosix(root), out);
  return out;
}

function scanBannedTokens(files: SourceFile[]): Finding[] {
  return files.flatMap((file) =>
    file.content.split("\n").flatMap((text, index) => {
      const tokens = findBannedTokens(text);
      return tokens.length ? [{ path: file.path, line: index + 1, tokens }] : [];
    }),
  );
}

function formatFindings(findings: Finding[]): string {
  return findings
    .map((f) => `${f.path}:${f.line} -> ${f.tokens.join(", ")}`)
    .join("\n");
}

describe("scanBannedTokens", () => {
  const clean: SourceFile = {
    path: "src/components/relay/Scratch.tsx",
    content: '<p>{t("title")}</p>',
  };

  it("fails on a planted token in a scratch UI string and passes after removal", () => {
    const planted = { ...clean, content: `${clean.content}\n<p>Powered by DeepSeek</p>` };
    const findings = scanBannedTokens([planted]);
    expect(findings).toEqual([
      { path: planted.path, line: 2, tokens: ["deepseek"] },
    ]);
    expect(formatFindings(findings)).toContain("Scratch.tsx:2");
    expect(scanBannedTokens([clean])).toEqual([]);
  });

  it.each(["OpenAI", "Anthropic", "Claude", "GPT-4", "deepseek-flash"])(
    "catches %s",
    (word) => {
      expect(scanBannedTokens([{ ...clean, content: word }])).toHaveLength(1);
    },
  );
});

describe("path exclusions", () => {
  it("excludes only the exact server dir and spec files", () => {
    expect(isExcluded("src/lib/relay/server/model.ts")).toBe(true);
    expect(isExcluded("src/lib/relay/errors.spec.ts")).toBe(true);
    expect(isExcluded("src/components/relay/Foo.spec.tsx")).toBe(true);
    expect(isExcluded("src/lib/relay/serverless/model.ts")).toBe(false);
    expect(isExcluded("src/components/relay/server/Foo.tsx")).toBe(false);
  });
});

describe("Relay-owned surfaces (FR-62, FR-63, AC-15)", () => {
  it("scans real files", () => {
    const files = listFiles(GUARDED_PATHS);
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.path === "src/hooks/useAI.ts")).toBe(true);
    expect(files.some((f) => f.path.startsWith(`${SERVER_DIR}/`))).toBe(false);
  });

  it("covers the history, speech, navigation and fixture surfaces", () => {
    const paths = listFiles(GUARDED_PATHS).map((f) => f.path);
    const required = [
      "src/lib/history/exportHar.ts",
      "src/components/history/HistoryList.tsx",
      "src/hooks/useSpeechDictation.ts",
      "src/lib/historyExport.ts",
      "messages/ja/common.json",
      "messages/fr/navigation.json",
      "e2e/fixtures/speechStub.ts",
      "e2e/fixtures/seed/relay-improvements.json",
    ];
    expect(required.filter((file) => !paths.includes(file))).toEqual([]);
  });

  it("names no vendor or model", () => {
    const findings = scanBannedTokens(listFiles(GUARDED_PATHS));
    expect(formatFindings(findings)).toBe("");
  });
});

describe("provider isolation (FR-63)", () => {
  it("imports the provider package and reads its env alias only under src/lib/relay/server", () => {
    const files = listFiles(["src"]);
    const offenders = files
      .filter((f) => PROVIDER_PATTERNS.some((p) => f.content.includes(p)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("finds the provider import inside the server dir", () => {
    const model = readFileSync(path.join(ROOT, SERVER_DIR, "model.ts"), "utf8");
    expect(model).toContain("@ai-sdk/deepseek");
  });
});
