import { describe, it, expect } from "vitest";
import {
  CAPABILITY_ACTIONS,
  CAPABILITY_CATEGORIES,
  CAPABILITY_CATEGORY_BY_TOOL,
  actionsFor,
  capabilityBadge,
} from "./capabilities";
import type { RelayPermissionMode } from "./permission";
import { RELAY_PERMISSION_MODES } from "./permission";
import { RELAY_TOOL_SCHEMAS, approvalNeeded } from "./tools/schemas";

describe("capabilities: tools by category", () => {
  it("has exactly 56 tools in RELAY_TOOL_SCHEMAS mapped to categories", () => {
    expect(Object.keys(CAPABILITY_CATEGORY_BY_TOOL).length).toBe(56);
  });

  it("every tool in RELAY_TOOL_SCHEMAS is mapped to exactly one category", () => {
    const toolNames = Object.keys(RELAY_TOOL_SCHEMAS);
    const mappedTools = Object.keys(CAPABILITY_CATEGORY_BY_TOOL);
    const mapped = new Set(mappedTools);
    const missing = toolNames.filter((name) => !mapped.has(name));
    const unknown = mappedTools.filter((name) => !toolNames.includes(name));
    expect({ missing, unknown }).toEqual({ missing: [], unknown: [] });
  });

  it("all mapped tools are in one of the five categories", () => {
    const validCategories = new Set(["read", "write", "run", "organize", "transfer"]);
    const invalidCategories = Object.values(CAPABILITY_CATEGORY_BY_TOOL).filter(
      (cat) => !validCategories.has(cat),
    );
    expect(invalidCategories).toEqual([]);
  });
});

describe("capabilities: actions list", () => {
  it("every action's tools sit in the action's category", () => {
    for (const action of CAPABILITY_ACTIONS) {
      for (const tool of action.tools) {
        const toolCategory = CAPABILITY_CATEGORY_BY_TOOL[tool];
        expect(toolCategory).toBe(action.category);
      }
    }
  });

  it("actions for each category have the expected ids", () => {
    expect(actionsFor("read").map((a) => a.id)).toEqual(["read-1", "read-2"]);
    expect(actionsFor("write").map((a) => a.id)).toEqual([
      "write-1",
      "write-2",
      "write-3",
    ]);
    expect(actionsFor("run").map((a) => a.id)).toEqual(["run-1", "run-2", "run-3"]);
    expect(actionsFor("organize").map((a) => a.id)).toEqual([
      "organize-1",
      "organize-2",
      "organize-3",
    ]);
    expect(actionsFor("transfer").map((a) => a.id)).toEqual([
      "transfer-1",
      "transfer-2",
    ]);
  });
});

describe("capabilities: categories", () => {
  it("renders in the expected order with correct ids", () => {
    expect(CAPABILITY_CATEGORIES.map((cat) => cat.id)).toEqual([
      "read",
      "write",
      "run",
      "organize",
      "transfer",
    ]);
  });

  it("each category has 2-3 examples", () => {
    for (const category of CAPABILITY_CATEGORIES) {
      expect(category.examples.length).toBeGreaterThanOrEqual(2);
      expect(category.examples.length).toBeLessThanOrEqual(3);
    }
  });

  it("read category has examples with correct requiresTarget flags", () => {
    const read = CAPABILITY_CATEGORIES[0];
    expect(read.id).toBe("read");
    expect(read.examples.length).toBe(3);
    expect(read.examples[0].requiresTarget).toBe("request");
    expect(read.examples[1].requiresTarget).toBeUndefined();
    expect(read.examples[2].requiresTarget).toBeUndefined();
  });

  it("write category has examples with correct requiresTarget flags", () => {
    const write = CAPABILITY_CATEGORIES[1];
    expect(write.id).toBe("write");
    expect(write.examples.length).toBe(3);
    expect(write.examples[0].requiresTarget).toBeUndefined();
    expect(write.examples[1].requiresTarget).toBe("request");
    expect(write.examples[2].requiresTarget).toBeUndefined();
  });

  it("run category has all examples requiring a request target", () => {
    const run = CAPABILITY_CATEGORIES[2];
    expect(run.id).toBe("run");
    expect(run.examples.length).toBe(3);
    for (const example of run.examples) {
      expect(example.requiresTarget).toBe("request");
    }
  });

  it("organize category has examples with correct requiresTarget flags", () => {
    const organize = CAPABILITY_CATEGORIES[3];
    expect(organize.id).toBe("organize");
    expect(organize.examples.length).toBe(3);
    expect(organize.examples[0].requiresTarget).toBeUndefined();
    expect(organize.examples[1].requiresTarget).toBeUndefined();
    expect(organize.examples[2].requiresTarget).toBeUndefined();
  });

  it("transfer category has examples with correct requiresTarget flags", () => {
    const transfer = CAPABILITY_CATEGORIES[4];
    expect(transfer.id).toBe("transfer");
    expect(transfer.examples.length).toBe(3);
    expect(transfer.examples[0].requiresTarget).toBeUndefined();
    expect(transfer.examples[1].requiresTarget).toBe("request");
    expect(transfer.examples[2].requiresTarget).toBeUndefined();
  });
});

describe("capabilities: i18n keys exist in en, fr, ja", () => {
  // Load messages from relayDock.json
  const fs = require("node:fs");
  const path = require("node:path");

  const MESSAGES_DIR = path.resolve(__dirname, "../../../messages");
  function loadFile(locale: string): Record<string, unknown> {
    return JSON.parse(
      fs.readFileSync(path.join(MESSAGES_DIR, locale, "relayDock.json"), "utf8"),
    ) as Record<string, unknown>;
  }

  function getNestedValue(obj: unknown, keyPath: string): string | null {
    const keys = keyPath.split(".");
    let value: unknown = obj;
    for (const key of keys) {
      if (value === null || typeof value !== "object") return null;
      value = (value as Record<string, unknown>)[key];
    }
    return typeof value === "string" ? value : null;
  }

  const locales = {
    en: loadFile("en"),
    fr: loadFile("fr"),
    ja: loadFile("ja"),
  };

  function buildMessageKeys(): string[] {
    const keys: string[] = [];

    // Category keys
    for (const category of CAPABILITY_CATEGORIES) {
      keys.push(category.titleKey);
      keys.push(category.descriptionKey);
      for (const example of category.examples) {
        keys.push(example.promptKey);
      }
    }

    // Action keys
    for (const action of CAPABILITY_ACTIONS) {
      keys.push(action.labelKey);
    }

    // See-list and badge keys (under capabilities.*)
    const seeKeys = [
      "capabilities.see.attached",
      "capabilities.see.index",
      "capabilities.see.lookups",
      "capabilities.see.envValues",
      "capabilities.see.secrets",
      "capabilities.see.settingsLink",
      "capabilities.badge.asks",
      "capabilities.badge.runs",
      "capabilities.badge.asksBulk",
      "capabilities.tab.can",
      "capabilities.tab.see",
      "capabilities.changeMode",
      "capabilities.title",
      "capabilities.empty.title",
      "capabilities.empty.description",
    ];

    return [...new Set([...keys, ...seeKeys])];
  }

  const messageKeys = buildMessageKeys();

  it.each(messageKeys)("locale parity for %s", (key) => {
    for (const locale of ["en", "fr", "ja"] as const) {
      const value = getNestedValue(locales[locale], key);
      expect(value, `${locale}.${key}`).toBeTruthy();
    }
  });
});

describe("capabilities: badge computation", () => {
  // Badge derivation from SPEC section 5 approval rules:
  // - read kind: never asks
  // - ui kind: never asks
  // - confirm kind: asks in always-ask and review, runs in skip
  // - navigation tools (open_item, close_tab, close_all_tabs): never ask
  // - auto kind: asks in always-ask, runs in review and skip
  // - bulk_update_requests: asks when > 10 items
  const badgeTable: Record<string, Record<RelayPermissionMode, string>> = {
    // read-1: all read kind → runs in all modes
    "read-1": { "always-ask": "runs", review: "runs", skip: "runs" },
    // read-2: read kind → runs in all modes
    "read-2": { "always-ask": "runs", review: "runs", skip: "runs" },
    // write-1: all auto kind → asks, runs, runs
    "write-1": { "always-ask": "asks", review: "runs", skip: "runs" },
    // write-2: all auto kind → asks, runs, runs
    "write-2": { "always-ask": "asks", review: "runs", skip: "runs" },
    // write-3: bulk_update_requests (auto) → asks, asksBulk, runs
    "write-3": { "always-ask": "asks", review: "asksBulk", skip: "runs" },
    // run-1: send_request (confirm kind) → asks, asks, runs
    "run-1": { "always-ask": "asks", review: "asks", skip: "runs" },
    // run-2: run_chain (confirm kind) → asks, asks, runs
    "run-2": { "always-ask": "asks", review: "asks", skip: "runs" },
    // run-3: generate_tests (auto kind) → asks, runs, runs
    "run-3": { "always-ask": "asks", review: "runs", skip: "runs" },
    // organize-1: all auto kind → asks, runs, runs
    "organize-1": { "always-ask": "asks", review: "runs", skip: "runs" },
    // organize-2: all confirm kind (delete_*) → asks, asks, runs
    "organize-2": { "always-ask": "asks", review: "asks", skip: "runs" },
    // organize-3: navigation tools (open_item, close_tab) → runs in all modes
    "organize-3": { "always-ask": "runs", review: "runs", skip: "runs" },
    // transfer-1: import_curl (auto kind) → asks, runs, runs
    "transfer-1": { "always-ask": "asks", review: "runs", skip: "runs" },
    // transfer-2: export_curl (read) + export_history (auto) → asks, runs, runs
    "transfer-2": { "always-ask": "asks", review: "runs", skip: "runs" },
  };

  it.each(
    CAPABILITY_ACTIONS.flatMap((action) =>
      (RELAY_PERMISSION_MODES as readonly RelayPermissionMode[]).map((mode) => [
        action.id,
        mode,
        badgeTable[action.id]?.[mode],
      ]),
    ),
  )("action %s badge in %s mode is %s", (actionId, mode, expectedBadge) => {
    const action = CAPABILITY_ACTIONS.find((a) => a.id === actionId)!;
    const badge = capabilityBadge(action.tools, mode as RelayPermissionMode);
    expect(badge).toBe(expectedBadge);
  });

  it("empty tool list returns runs", () => {
    expect(capabilityBadge([], "always-ask")).toBe("runs");
    expect(capabilityBadge([], "review")).toBe("runs");
    expect(capabilityBadge([], "skip")).toBe("runs");
  });

  it("reduces to strictest badge when tools have different severities", () => {
    // Test case 1: weaker tool then stricter tool
    // (send_request = confirm, get_request = read)
    // In "review" mode: send_request asks, get_request runs → strictest is asks
    const badge1 = capabilityBadge(["send_request", "get_request"], "review");
    expect(badge1).toBe("asks");

    // Test case 2: stricter tool then weaker tool
    // (run_chain = confirm, get_collection = read)
    // In "review" mode: run_chain asks, get_collection runs → strictest is asks
    const badge2 = capabilityBadge(["run_chain", "get_collection"], "review");
    expect(badge2).toBe("asks");

    // Test case 3: bulk tool with single-item tool
    // (bulk_update_requests asks when > 10, update_request = auto)
    // In "review" mode: bulk asks with 11 items, update runs with 1 item
    // Badge logic probes both, so strictest is asksBulk
    const badge3 = capabilityBadge(["bulk_update_requests", "update_request"], "review");
    expect(badge3).toBe("asksBulk");
  });
});

describe("capabilities: badge parity with approvalNeeded", () => {
  // Per RP-206 AC: capabilityBadge equals the live approvalNeeded result.
  // Verify every tool's badge reflects the approval rule correctly.

  it("badge matches approvalNeeded for every tool in every mode", () => {
    const smallInput = { ids: ["probe-0"] };
    const largeInput = { ids: Array.from({ length: 11 }, (_, i) => `probe-${i}`) };

    for (const action of CAPABILITY_ACTIONS) {
      for (const mode of RELAY_PERMISSION_MODES) {
        // Compute the expected badge as the strictest among all tools in the action
        let expectedBadge: "runs" | "asks" | "asksBulk" = "runs";
        for (const tool of action.tools) {
          const smallAsks = approvalNeeded(tool, smallInput, mode);
          const largeAsks = approvalNeeded(tool, largeInput, mode);

          let toolBadge: "runs" | "asks" | "asksBulk";
          if (smallAsks) toolBadge = "asks";
          else if (largeAsks) toolBadge = "asksBulk";
          else toolBadge = "runs";

          // Keep the strictest badge: asks > asksBulk > runs
          if (toolBadge === "asks") expectedBadge = "asks";
          else if (toolBadge === "asksBulk" && expectedBadge !== "asks") expectedBadge = "asksBulk";
        }

        // Verify the parity: capabilityBadge computes the same strictest badge
        // that the approval rules for the action's tools would produce
        const badge = capabilityBadge(action.tools, mode);
        expect(badge).toBe(expectedBadge);
      }
    }
  });
});
