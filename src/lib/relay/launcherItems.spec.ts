import { describe, expect, it } from "vitest";
import type { SlashCommand, SlashCommandId } from "./slashCommands";
import {
  buildLauncherSections,
  launcherFilter,
  type LauncherRecent,
  isListAttach,
  LAUNCHER_LIST_KINDS,
  type LauncherAttachId,
} from "./launcherItems";
import { LAUNCHER_ACTION_IDS, RELAY_RECENTS_CAP } from "./constants";

const mockSlashCommand = (id: SlashCommandId, over: Partial<SlashCommand> = {}): SlashCommand => ({
  id,
  name: `/${id}`,
  descriptionKey: `slash.${id}.description`,
  group: "chat",
  icon: "new",
  requiresTarget: null,
  ...over,
});

const recentChip = (id: string, kind: "request" | "chain" | "collection" | "environment" = "request"): LauncherRecent => ({
  kind,
  id,
  name: `${kind} ${id}`,
});

describe("buildLauncherSections", () => {
  describe("section order and structure", () => {
    it("renders sections in fixed order: recent, attach, actions, settings", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      expect(sections.map((s) => s.id)).toEqual([
        "recent",
        "attach",
        "actions",
        "settings",
      ]);
    });

    it("omits empty sections", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
      });

      expect(sections.map((s) => s.id)).toEqual(["attach", "settings"]);
    });

    it("adds a Permission mode row carrying the current mode label", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
        permissionMode: "always-ask",
      });

      expect(sections.at(-1)?.rows).toEqual([
        expect.objectContaining({
          key: "setting:permission",
          section: "settings",
          valueLabel: "permission.option.always-ask.label",
          target: { type: "setting", setting: "permission" },
        }),
        expect.objectContaining({
          key: "setting:capabilities",
          section: "settings",
          name: "launcher.settings.capabilities.label",
          target: { type: "setting", setting: "capabilities" },
        }),
      ]);
    });

    it("renders all four sections when all are populated", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain"), mockSlashCommand("run")],
      });

      expect(sections).toHaveLength(4);
    });
  });

  describe("recent section", () => {
    it("excludes items already attached", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1"), recentChip("r2")],
        attachedKeys: new Set(["request:r1"]),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows.map((r) => r.key)).toEqual(["recent:request:r2"]);
    });

    it("caps recent rows at RELAY_RECENTS_CAP", () => {
      const recents = Array.from({ length: RELAY_RECENTS_CAP + 2 }, (_, i) => recentChip(`r${i}`));
      const sections = buildLauncherSections({
        recents,
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows).toHaveLength(RELAY_RECENTS_CAP);
    });

    it("uses chipKey format for recent row key", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1", "chain")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].key).toBe("recent:chain:r1");
    });

    it("embeds the chip in the target with correct label", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1", "chain")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      const row = recentSection?.rows[0];
      expect(row?.target).toEqual({
        type: "recent",
        chip: { kind: "chain", id: "r1", label: "chain r1" },
      });
    });

    it("does not mark recent rows as opensList", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].opensList).toBe(false);
    });

    it("does not disable recent rows", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: false,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].disabled).toBe(false);
    });

    it("uses translated kind label in description", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = { "context.kindChain": "Chain (translated)" };
        return map[key] || key;
      };

      const sections = buildLauncherSections({
        recents: [recentChip("c1", "chain")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
        translate,
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].description).toBe("Chain (translated)");
    });

    it("includes the kind label in searchable value", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = { "context.kindRequest": "Request Type" };
        return map[key] || key;
      };

      const sections = buildLauncherSections({
        recents: [recentChip("r1", "request")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
        translate,
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].value).toContain("Request Type");
    });
  });

  describe("attach section", () => {
    it("includes all attach kinds in fixed order", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
      });

      const attachSection = sections.find((s) => s.id === "attach");
      expect(attachSection?.rows.map((r) => r.key)).toEqual([
        "attach:currentTab",
        "attach:request",
        "attach:collection",
        "attach:environment",
        "attach:chain",
        "attach:pasteCurl",
      ]);
    });

    it("disables currentTab when hasTab is false", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: false,
        slashCommands: [],
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const currentTab = attachSection?.rows.find((r) => r.key === "attach:currentTab");
      expect(currentTab?.disabled).toBe(true);
    });

    it("does not disable currentTab when hasTab is true", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const currentTab = attachSection?.rows.find((r) => r.key === "attach:currentTab");
      expect(currentTab?.disabled).toBe(false);
    });

    it("marks kinds that open a list as opensList", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const request = attachSection?.rows.find((r) => r.key === "attach:request");
      const pasteCurl = attachSection?.rows.find((r) => r.key === "attach:pasteCurl");

      expect(request?.opensList).toBe(true);
      expect(pasteCurl?.opensList).toBe(false);
    });

    it("uses translated label in attach row name", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = { "launcher.attach.request.label": "Petition (translated)" };
        return map[key] || key;
      };

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
        translate,
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const request = attachSection?.rows.find((r) => r.key === "attach:request");
      expect(request?.name).toBe("Petition (translated)");
    });

    it("uses unavailable description when currentTab is disabled", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = {
          "launcher.attach.currentTab.unavailable": "No open tab (translated)",
        };
        return map[key] || key;
      };

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: false,
        slashCommands: [],
        translate,
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const currentTab = attachSection?.rows.find((r) => r.key === "attach:currentTab");
      expect(currentTab?.description).toBe("No open tab (translated)");
    });

    it("uses regular description when currentTab is enabled", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = {
          "launcher.attach.currentTab.description": "Use the current tab (translated)",
        };
        return map[key] || key;
      };

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
        translate,
      });

      const attachSection = sections.find((s) => s.id === "attach");
      const currentTab = attachSection?.rows.find((r) => r.key === "attach:currentTab");
      expect(currentTab?.description).toBe("Use the current tab (translated)");
    });
  });

  describe("actions section", () => {
    it("renders only actions in LAUNCHER_ACTION_IDS", () => {
      const commands = [
        mockSlashCommand("explain"),
        mockSlashCommand("run"),
        mockSlashCommand("summarize"), // not in LAUNCHER_ACTION_IDS
      ];

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: commands,
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows.map((r) => r.key)).toEqual([
        "action:explain",
        "action:run",
      ]);
    });

    it("renders action rows in the order of LAUNCHER_ACTION_IDS", () => {
      const commands = LAUNCHER_ACTION_IDS.map((id) => mockSlashCommand(id));

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: commands,
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows.map((r) => r.key)).toEqual(
        LAUNCHER_ACTION_IDS.map((id) => `action:${id}`),
      );
    });

    it("skips actions that are not in the provided commands list", () => {
      const commands = [mockSlashCommand("explain"), mockSlashCommand("run")];

      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: commands,
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows.map((r) => r.key)).toEqual(["action:explain", "action:run"]);
    });

    it("action rows carry the slash command in their target", () => {
      const command = mockSlashCommand("explain");
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [command],
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      const row = actionsSection?.rows[0];
      expect(row?.target).toEqual({ type: "action", command });
    });

    it("uses translated description key from the command", () => {
      const translate = (key: string) => {
        const map: Record<string, string> = {
          "slash.explain.description": "Understand this (translated)",
        };
        return map[key] || key;
      };

      const command = mockSlashCommand("explain");
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [command],
        translate,
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows[0].description).toBe("Understand this (translated)");
    });

    it("does not mark action rows as opensList", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows[0].opensList).toBe(false);
    });

    it("does not disable action rows", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: false,
        slashCommands: [mockSlashCommand("explain")],
      });

      const actionsSection = sections.find((s) => s.id === "actions");
      expect(actionsSection?.rows[0].disabled).toBe(false);
    });
  });

  describe("row properties common to all sections", () => {
    it("makes row keys unique across sections and kinds", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1", "request"), recentChip("r1", "chain")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const allKeys = sections.flatMap((s) => s.rows.map((r) => r.key));
      expect(new Set(allKeys).size).toBe(allKeys.length);
    });

    it("includes the name in every searchable value", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const rows = sections.flatMap((s) => s.rows);
      for (const row of rows) {
        expect(row.value).toContain(row.name);
      }
    });

    it("searchable values are trimmed", () => {
      const sections = buildLauncherSections({
        recents: [],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [],
      });

      const rows = sections.flatMap((s) => s.rows);
      for (const row of rows) {
        expect(row.value).toBe(row.value.trim());
      }
    });
  });

  describe("translate function", () => {
    it("uses identity function when translate is not provided", () => {
      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
      });

      const recentSection = sections.find((s) => s.id === "recent");
      expect(recentSection?.rows[0].description).toBe("context.kindRequest");
    });

    it("applies translate to all translatable strings", () => {
      const translate = (key: string) => `${key}:translated`;

      const sections = buildLauncherSections({
        recents: [recentChip("r1")],
        attachedKeys: new Set(),
        hasTab: true,
        slashCommands: [mockSlashCommand("explain")],
        translate,
      });

      expect(sections.flatMap((s) => s.rows.map((r) => r.description))).toEqual(
        expect.arrayContaining([expect.stringContaining(":translated")]),
      );
    });
  });
});

describe("launcherFilter", () => {
  describe("matching logic", () => {
    it("matches when all words are found in the value", () => {
      const score = launcherFilter("get users POST", "get post");
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 when any word is missing", () => {
      const score = launcherFilter("get users", "get missing");
      expect(score).toBe(0);
    });

    it("is case-insensitive", () => {
      const score = launcherFilter("Get Users POST", "GET post");
      expect(score).toBeGreaterThan(0);
    });

    it("matches word order independently", () => {
      const score = launcherFilter("Users get POST", "post get");
      expect(score).toBeGreaterThan(0);
    });

    it("matches partial words", () => {
      const score = launcherFilter("Request users", "requ");
      expect(score).toBeGreaterThan(0);
    });

    it("returns constant score for all matches", () => {
      const score1 = launcherFilter("get users", "get");
      const score2 = launcherFilter("get users POST", "get post");
      expect(score1).toBe(score2);
      expect(score1).toBeGreaterThan(0);
    });

    it("ignores whitespace-only searches", () => {
      const score = launcherFilter("get users", "   ");
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 when search is empty after filtering whitespace", () => {
      const score = launcherFilter("get users", "");
      expect(score).toBeGreaterThan(0);
    });

    it("handles empty value", () => {
      const score = launcherFilter("", "get");
      expect(score).toBe(0);
    });

    it("handles multiple spaces between words", () => {
      const score = launcherFilter("get   users", "get users");
      expect(score).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("matches unicode characters", () => {
      const score = launcherFilter("café naïve", "café");
      expect(score).toBeGreaterThan(0);
    });

    it("handles special characters in value", () => {
      const score = launcherFilter("get/users@example.com", "get users");
      expect(score).toBeGreaterThan(0);
    });

    it("fails to match only part of a word", () => {
      const score = launcherFilter("request", "rq");
      expect(score).toBe(0);
    });
  });

  describe("with keywords (cmdk integration)", () => {
    it("matches when all words are found in keywords", () => {
      const score = launcherFilter("recent:request:r1", "get", ["Get users Request"]);
      expect(score).toBeGreaterThan(0);
    });

    it("searches keywords instead of value when keywords are provided", () => {
      // value is "attach:request", but keywords contain "Search"
      // searching for "search" matches keywords, not the value
      const score = launcherFilter("attach:request", "search", [
        "Request",
        "Search your saved requests",
      ]);
      expect(score).toBeGreaterThan(0);
    });

    it("does not match value when keywords are provided", () => {
      // searching for "attach" when keywords are ["Request Search your saved requests"]
      // should not match because "attach" is not in the keywords
      const score = launcherFilter("attach:request", "attach", [
        "Request",
        "Search your saved requests",
      ]);
      expect(score).toBe(0);
    });

    it("is case-insensitive with keywords", () => {
      const score = launcherFilter("recent:request:r1", "GET", ["Get users Request"]);
      expect(score).toBeGreaterThan(0);
    });

    it("matches multiple search terms all found in keywords", () => {
      const score = launcherFilter("action:run", "get users", ["Get users Request"]);
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 when not all search terms are in keywords", () => {
      const score = launcherFilter("action:run", "get missing", ["Get users Request"]);
      expect(score).toBe(0);
    });

    it("handles empty keywords array (falls back to value)", () => {
      const score = launcherFilter("get users", "get", []);
      expect(score).toBeGreaterThan(0);
    });
  });
});

describe("isListAttach", () => {
  it("returns true for request, collection, environment, chain", () => {
    expect(isListAttach("request")).toBe(true);
    expect(isListAttach("collection")).toBe(true);
    expect(isListAttach("environment")).toBe(true);
    expect(isListAttach("chain")).toBe(true);
  });

  it("returns false for currentTab and pasteCurl", () => {
    expect(isListAttach("currentTab")).toBe(false);
    expect(isListAttach("pasteCurl")).toBe(false);
  });

  it("returns false for unknown kinds", () => {
    expect(isListAttach("unknown" as LauncherAttachId)).toBe(false);
  });
});

describe("LAUNCHER_LIST_KINDS", () => {
  it("matches request, collection, environment, chain to their respective kinds", () => {
    expect(LAUNCHER_LIST_KINDS.request).toBe("request");
    expect(LAUNCHER_LIST_KINDS.collection).toBe("collection");
    expect(LAUNCHER_LIST_KINDS.environment).toBe("environment");
    expect(LAUNCHER_LIST_KINDS.chain).toBe("chain");
  });

  it("does not include currentTab or pasteCurl", () => {
    expect(LAUNCHER_LIST_KINDS).not.toHaveProperty("currentTab");
    expect(LAUNCHER_LIST_KINDS).not.toHaveProperty("pasteCurl");
  });

  it("aligns with isListAttach predicate", () => {
    for (const [key] of Object.entries(LAUNCHER_LIST_KINDS)) {
      expect(isListAttach(key as LauncherAttachId)).toBe(true);
    }
  });
});
