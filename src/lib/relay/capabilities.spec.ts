import { describe, it, expect } from "vitest";
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_CATEGORY_BY_TOOL,
  capabilityBadge,
  categoryBadge,
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

  it("every representative tool sits in its own category", () => {
    for (const category of CAPABILITY_CATEGORIES) {
      expect(category.tools.length).toBeGreaterThan(0);
      for (const tool of category.tools) {
        expect(CAPABILITY_CATEGORY_BY_TOOL[tool]).toBe(category.id);
      }
    }
  });
});

describe("capabilities: area markers", () => {
  it("shows no marker for the read area in every mode", () => {
    const read = CAPABILITY_CATEGORIES[0];
    for (const mode of RELAY_PERMISSION_MODES) {
      expect(categoryBadge(read, mode)).toBe("runs");
    }
  });

  it("marks the areas that change the workspace when approvals are always on", () => {
    const badges = CAPABILITY_CATEGORIES.map((category) =>
      categoryBadge(category, "always-ask"),
    );
    expect(badges).toEqual(["runs", "asks", "asks", "asks", "asks"]);
  });

  it("shows no marker anywhere when approvals are skipped", () => {
    for (const category of CAPABILITY_CATEGORIES) {
      expect(categoryBadge(category, "skip")).toBe("runs");
    }
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
    }

    // Footer and marker keys (under capabilities.*)
    const seeKeys = [
      "capabilities.footer.title",
      "capabilities.footer.attached",
      "capabilities.footer.index",
      "capabilities.footer.valuesOn",
      "capabilities.footer.valuesOff",
      "capabilities.footer.secrets",
      "capabilities.footer.settingsLink",
      "capabilities.marker.asks",
      "capabilities.marker.asksBulk",
      "capabilities.seeEverything",
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
  // Strictest badge per area, from the live approval rules.
  const areaBadges: Record<string, Record<RelayPermissionMode, string>> = {
    read: { "always-ask": "runs", review: "runs", skip: "runs" },
    write: { "always-ask": "asks", review: "asksBulk", skip: "runs" },
    run: { "always-ask": "asks", review: "asks", skip: "runs" },
    organize: { "always-ask": "asks", review: "asks", skip: "runs" },
    transfer: { "always-ask": "asks", review: "runs", skip: "runs" },
  };

  it.each(
    CAPABILITY_CATEGORIES.flatMap((category) =>
      (RELAY_PERMISSION_MODES as readonly RelayPermissionMode[]).map((mode) => [
        category.id,
        mode,
        areaBadges[category.id]?.[mode],
      ]),
    ),
  )("area %s badge in %s mode is %s", (categoryId, mode, expectedBadge) => {
    const category = CAPABILITY_CATEGORIES.find((c) => c.id === categoryId)!;
    expect(categoryBadge(category, mode as RelayPermissionMode)).toBe(expectedBadge);
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

    for (const category of CAPABILITY_CATEGORIES) {
      for (const mode of RELAY_PERMISSION_MODES) {
        // Compute the expected badge as the strictest among all tools in the area
        let expectedBadge: "runs" | "asks" | "asksBulk" = "runs";
        for (const tool of category.tools) {
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
        // that the approval rules for the area's tools would produce
        const badge = capabilityBadge(category.tools, mode);
        expect(badge).toBe(expectedBadge);
      }
    }
  });
});
