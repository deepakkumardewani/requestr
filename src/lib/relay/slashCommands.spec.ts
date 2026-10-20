import { describe, expect, it } from "vitest";
import enDock from "../../../messages/en/relayDock.json";
import frDock from "../../../messages/fr/relayDock.json";
import jaDock from "../../../messages/ja/relayDock.json";
import {
  filterSlashCommands,
  findSlashQuery,
  needsClearConfirm,
  orderSlashCommands,
  SLASH_COMMAND_ICONS,
  SLASH_COMMANDS,
  SLASH_GROUP_ORDER,
  type SlashCommandId,
  type SlashTargetKind,
} from "./slashCommands";

const byId = (id: string) => {
  const command = SLASH_COMMANDS.find((c) => c.id === id);
  if (!command) throw new Error(`missing ${id}`);
  return command;
};

const describeEn = (key: `slash.${string}.description`) => {
  const parts = key.split(".");
  const id = parts[1];
  const node = (enDock.slash as Record<string, { description?: string }>)[id];
  return node?.description ?? key;
};

const slashLocales = {
  en: enDock,
  fr: frDock,
  ja: jaDock,
} as const;

const EXPECTED_REQUIRES_TARGET: Record<
  SlashCommandId,
  SlashTargetKind | null
> = {
  explain: "request",
  summarize: null,
  docs: "collection",
  new: null,
  import: null,
  chain: null,
  env: null,
  assert: "request",
  tests: "request",
  run: "request",
  fix: "request",
  diff: "request",
  curl: "request",
  export: null,
  clear: null,
};

describe("SLASH_COMMANDS", () => {
  it("[success] defines fifteen unique commands in group order", () => {
    expect(SLASH_COMMANDS).toHaveLength(15);
    expect(new Set(SLASH_COMMANDS.map((c) => c.id)).size).toBe(15);
    const groups = SLASH_COMMANDS.map((c) => c.group);
    expect([...new Set(groups)]).toEqual([...SLASH_GROUP_ORDER]);
  });

  it("[success] walks groups in SLASH_GROUP_ORDER without skipping", () => {
    const groupRank = new Map(
      SLASH_GROUP_ORDER.map((group, index) => [group, index]),
    );
    let lastRank = -1;
    for (const command of SLASH_COMMANDS) {
      const rank = groupRank.get(command.group);
      expect(rank).toBeDefined();
      expect(rank!).toBeGreaterThanOrEqual(lastRank);
      lastRank = rank!;
    }
    expect(lastRank).toBe(SLASH_GROUP_ORDER.length - 1);
  });

  it("[success] exposes an icon name for every command id", () => {
    for (const command of SLASH_COMMANDS) {
      expect(SLASH_COMMAND_ICONS[command.id]).toBeDefined();
      expect(command.icon).toBe(command.id);
    }
  });

  it("[success] maps requiresTarget metadata per RP-217", () => {
    for (const command of SLASH_COMMANDS) {
      expect(command.requiresTarget).toBe(EXPECTED_REQUIRES_TARGET[command.id]);
      expect(command.name).toBe(`/${command.id}`);
      expect(command.descriptionKey).toBe(`slash.${command.id}.description`);
      if (command.id !== "clear") {
        expect(command.promptKey).toBe(`slash.${command.id}.prompt`);
      } else {
        expect(command.promptKey).toBeUndefined();
      }
    }
  });

  it("[success] loads description and prompt strings in en, fr, and ja", () => {
    for (const command of SLASH_COMMANDS) {
      for (const [locale, dock] of Object.entries(slashLocales)) {
        const entry = (
          dock.slash as Record<
            string,
            { description?: string; prompt?: string }
          >
        )[command.id];
        expect(entry?.description, `${command.id} ${locale} description`).toBeTruthy();
        if (command.id !== "clear") {
          expect(entry?.prompt, `${command.id} ${locale} prompt`).toBeTruthy();
        }
      }
    }
  });

  it("[success] maps commands to their tools", () => {
    expect(byId("assert").tool).toBe("generate_tests");
    expect(byId("curl").tool).toBe("export_curl");
    expect(byId("docs").tool).toBe("generate_docs");
    expect(byId("import").tool).toBe("import_curl");
    expect(byId("run").tool).toBe("send_request");
    expect(byId("diff").tool).toBe("diff_responses");
    expect(byId("explain").tool).toBeUndefined();
    expect(byId("clear").tool).toBeUndefined();
  });

  it("[success] maps prompts and descriptions to message keys", () => {
    expect(byId("assert").promptKey).toBe("slash.assert.prompt");
    expect(byId("curl").promptKey).toBe("slash.curl.prompt");
    expect(byId("docs").promptKey).toBe("slash.docs.prompt");
    expect(byId("explain").promptKey).toBe("slash.explain.prompt");
    expect(byId("clear").promptKey).toBeUndefined();
    expect(byId("clear").descriptionKey).toBe("slash.clear.description");
  });
});

describe("findSlashQuery", () => {
  it("[success] returns an empty query for a lone slash", () => {
    expect(findSlashQuery("/")).toBe("");
  });

  it("[success] returns the lowercased text typed after the slash", () => {
    expect(findSlashQuery("/CuR")).toBe("cur");
  });

  it("[invalid] stays closed when the slash is not at the start", () => {
    expect(findSlashQuery("hello /curl")).toBeNull();
    expect(findSlashQuery(" /curl")).toBeNull();
  });

  it("[invalid] stays closed once a space or newline is typed", () => {
    expect(findSlashQuery("/curl ")).toBeNull();
    expect(findSlashQuery("/curl\nx")).toBeNull();
  });

  it("[success] returns null for empty or plain text", () => {
    expect(findSlashQuery("")).toBeNull();
    expect(findSlashQuery("curl")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("[success] returns every command for an empty query", () => {
    expect(filterSlashCommands("")).toHaveLength(15);
  });

  it("[success] narrows by id prefix", () => {
    expect(filterSlashCommands("ru").map((c) => c.id)).toEqual(["run"]);
    expect(filterSlashCommands("c").map((c) => c.id)).toEqual([
      "chain",
      "curl",
      "clear",
    ]);
    expect(filterSlashCommands("cu").map((c) => c.id)).toEqual(["curl"]);
  });

  it("[success] matches translated descriptions when a describe fn is passed", () => {
    const filtered = filterSlashCommands("assertion", describeEn);
    expect(filtered.map((c) => c.id)).toContain("assert");
  });

  it("[success] ignores descriptions when no describe fn is passed", () => {
    expect(filterSlashCommands("assertion")).toEqual([]);
  });

  it("[success] normalizes the query case when filtering by id", () => {
    expect(filterSlashCommands("RU").map((c) => c.id)).toEqual(["run"]);
  });

  it("[success] returns nothing for an unknown prefix or a mid-word match", () => {
    expect(filterSlashCommands("zzz")).toEqual([]);
    expect(filterSlashCommands("url")).toEqual([]);
  });
});

describe("orderSlashCommands", () => {
  it("[success] preserves canonical order for a subset", () => {
    const subset = filterSlashCommands("c");
    expect(orderSlashCommands(subset).map((c) => c.id)).toEqual([
      "chain",
      "curl",
      "clear",
    ]);
  });

  it("[success] returns the full registry order for an unfiltered list", () => {
    expect(orderSlashCommands(SLASH_COMMANDS).map((c) => c.id)).toEqual(
      SLASH_COMMANDS.map((c) => c.id),
    );
  });

  it("[success] keeps group order when reordering a shuffled subset", () => {
    const shuffled = [
      byId("clear"),
      byId("run"),
      byId("explain"),
      byId("import"),
    ];
    expect(orderSlashCommands(shuffled).map((c) => c.id)).toEqual([
      "explain",
      "import",
      "run",
      "clear",
    ]);
  });
});

describe("needsClearConfirm", () => {
  it("[success] confirms /clear only when the thread has messages", () => {
    expect(needsClearConfirm(byId("clear"), true)).toBe(true);
    expect(needsClearConfirm(byId("clear"), false)).toBe(false);
  });

  it("[success] never confirms other commands", () => {
    for (const id of ["explain", "assert", "curl", "docs", "run"]) {
      expect(needsClearConfirm(byId(id), true)).toBe(false);
    }
  });
});
