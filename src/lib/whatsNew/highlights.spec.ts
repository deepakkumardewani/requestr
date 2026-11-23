import { afterEach, describe, expect, it } from "vitest";
import {
  getHighlights,
  HIGHLIGHTS,
  pickLatestWithHighlights,
  type HighlightLocale,
  type VersionHighlights,
} from "./highlights";

const LOCALES: HighlightLocale[] = ["en", "fr", "ja"];

const CONVENTIONAL_PREFIX =
  /\b(?:feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)(?:\([^)]*\))?!?:/i;
const COMMIT_HASH = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/i;
const PR_OR_ISSUE_NUMBER =
  /(?:^|[\s(])#\d+\b|\b(?:PR|pull request|issue)\s*#?\d+\b/i;
const FILE_PATH =
  /(?:^|\s)(?:\.{1,2}\/|~\/|\/)?[\w.-]+\/[\w./-]+|\b[\w-]+\.(?:tsx?|jsx?|mjs|json|md|css|ya?ml)\b/;
const CODE_IDENTIFIER = /`|\b[a-z]+[A-Z]\w*\b|\b[a-z]+_[a-z_]+\b|\w+\(\)/;

const FORBIDDEN: Array<[string, RegExp]> = [
  ["a conventional-commit prefix", CONVENTIONAL_PREFIX],
  ["a commit hash", COMMIT_HASH],
  ["a PR or issue number", PR_OR_ISSUE_NUMBER],
  ["a file path", FILE_PATH],
  ["a code identifier", CODE_IDENTIFIER],
];

/** Returns one message per rule a bullet breaks; empty when the bullet is user-facing prose. */
function violations(bullet: string): string[] {
  return FORBIDDEN.filter(([, pattern]) => pattern.test(bullet)).map(
    ([label]) => `contains ${label}: "${bullet}"`
  );
}

/** Validates one release entry: English is required, every present locale holds clean prose. */
function validateEntry(version: string, entry: Partial<VersionHighlights>) {
  const problems: string[] = [];
  if (!entry.en?.length) problems.push(`${version}: en highlights missing`);
  for (const locale of LOCALES) {
    for (const bullet of entry[locale] ?? []) {
      if (bullet.trim() === "")
        problems.push(`${version}/${locale}: empty bullet`);
      for (const message of violations(bullet))
        problems.push(`${version}/${locale}: ${message}`);
    }
  }
  return problems;
}

const entry = (en: string[], fr: string[] = [], ja: string[] = []) => ({
  en,
  fr,
  ja,
});

const seeded: string[] = [];
afterEach(() => {
  for (const version of seeded.splice(0)) delete HIGHLIGHTS[version];
});

function seed(version: string, value: VersionHighlights) {
  HIGHLIGHTS[version] = value;
  seeded.push(version);
}

describe("HIGHLIGHTS content validation", () => {
  const versions = Object.keys(HIGHLIGHTS);

  it("ships at least one release entry to validate", () => {
    expect(versions).toContain("0.1.0");
  });

  it.each(versions)("%s has valid, user-facing highlights", (version) => {
    expect(validateEntry(version, HIGHLIGHTS[version])).toEqual([]);
  });

  it.each(versions)("%s is keyed by a dotted numeric version", (version) => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe("the validator itself", () => {
    it("accepts plain-language prose", () => {
      expect(
        validateEntry(
          "1.0.0",
          entry(["Send requests faster, with no account needed."])
        )
      ).toEqual([]);
    });

    it("requires English highlights", () => {
      expect(validateEntry("1.0.0", { fr: ["Bonjour"] })).toEqual([
        "1.0.0: en highlights missing",
      ]);
    });

    it.each([
      ["feat: add dark mode", "a conventional-commit prefix"],
      ["fix(ui): button overlap", "a conventional-commit prefix"],
      ["Improved speed in 3f9a2c1", "a commit hash"],
      ["Faster imports (#123)", "a PR or issue number"],
      ["Updated src/lib/notes/readme.ts", "a file path"],
      ["Updated notes.ts", "a file path"],
      ["Uses the getHighlights helper", "a code identifier"],
      ["Set `theme` in settings", "a code identifier"],
      ["Emits whats_new_shown", "a code identifier"],
    ])("rejects %j", (bullet, label) => {
      const problems = validateEntry("1.0.0", entry([bullet]));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(label);
    });

    it("rejects a bad entry in a non-English locale", () => {
      expect(
        validateEntry("1.0.0", entry(["Fine."], ["feat: nouveau"]))
      ).toHaveLength(1);
    });

    it("rejects an empty bullet", () => {
      expect(validateEntry("1.0.0", entry(["Fine.", "  "]))).toEqual([
        "1.0.0/en: empty bullet",
      ]);
    });

    it("treats a seeded bad entry in HIGHLIGHTS as a failure", () => {
      seed("9.9.9", entry(["feat: ship the thing (#42) in 3f9a2c1"]));
      expect(
        validateEntry("9.9.9", HIGHLIGHTS["9.9.9"]).length
      ).toBeGreaterThan(0);
    });
  });
});

describe("getHighlights", () => {
  it("returns the bullets for the requested locale", () => {
    seed("1.0.0", entry(["EN one"], ["FR un"], ["JA ichi"]));
    expect(getHighlights("1.0.0", "fr")).toEqual(["FR un"]);
    expect(getHighlights("1.0.0", "ja")).toEqual(["JA ichi"]);
    expect(getHighlights("1.0.0", "en")).toEqual(["EN one"]);
  });

  it("falls back to English when the locale has no bullets", () => {
    seed("1.0.0", entry(["EN one"], [], ["JA ichi"]));
    expect(getHighlights("1.0.0", "fr")).toEqual(["EN one"]);
  });

  it("falls back to English for an unsupported locale", () => {
    seed("1.0.0", entry(["EN one"], ["FR un"]));
    expect(getHighlights("1.0.0", "de")).toEqual(["EN one"]);
  });

  it("returns an empty list for a version with no entry", () => {
    expect(getHighlights("0.0.404", "en")).toEqual([]);
  });

  it("returns an empty list when even English is empty", () => {
    seed("1.0.0", entry([], ["FR un"]));
    expect(getHighlights("1.0.0", "fr")).toEqual(["FR un"]);
    expect(getHighlights("1.0.0", "de")).toEqual([]);
  });
});

describe("pickLatestWithHighlights", () => {
  const build = () => {
    seed("1.0.0", entry(["one"]));
    seed("1.2.0", entry(["two"]));
    seed("1.10.0", entry(["ten"]));
    seed("1.11.0", entry([]));
  };

  it("returns the newest version up to current for a never-seen user", () => {
    build();
    expect(pickLatestWithHighlights(null, "1.2.0")).toBe("1.2.0");
  });

  it("compares numerically, not lexically", () => {
    build();
    expect(pickLatestWithHighlights("1.2.0", "1.10.0")).toBe("1.10.0");
  });

  it("skips a newer version whose highlights are empty", () => {
    build();
    expect(pickLatestWithHighlights("1.2.0", "1.11.0")).toBe("1.10.0");
  });

  it("returns null when the user has already seen the latest highlights", () => {
    build();
    expect(pickLatestWithHighlights("1.10.0", "1.11.0")).toBeNull();
  });

  it("excludes versions newer than current", () => {
    build();
    expect(pickLatestWithHighlights("1.0.0", "1.1.0")).toBeNull();
  });

  it("returns null when lastSeen equals current", () => {
    build();
    expect(pickLatestWithHighlights("1.2.0", "1.2.0")).toBeNull();
  });

  it("ignores pre-release and build suffixes", () => {
    build();
    expect(pickLatestWithHighlights("1.0.0", "1.2.0-beta.1+abc")).toBe("1.2.0");
  });

  it("treats missing or non-numeric parts as zero", () => {
    seed("2", entry(["two"]));
    seed("2.x.1", entry(["odd"]));
    expect(pickLatestWithHighlights("1.9.9", "2")).toBe("2");
    expect(pickLatestWithHighlights("2", "2.0.1")).toBe("2.x.1");
  });
});
