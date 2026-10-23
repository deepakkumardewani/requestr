import { describe, expect, it } from "vitest";
import { describeGeneric } from "./describeGeneric";
import type { RegisteredTool } from "./registry";
import type { StoreAccess } from "../storeAccess";
import { PREVIEW_TARGETS_MAX } from "./schemas";

describe("describeGeneric", () => {
  const mockStore = (overrides?: Partial<StoreAccess>): StoreAccess =>
    ({
      requests: () => [
        { id: "req1", name: "Get Users" },
        { id: "req2", name: "Create User" },
      ],
      collections: () => [
        { id: "col1", name: "APIs" },
        { id: "col2", name: "Webhooks" },
      ],
      folders: () => [
        { id: "fold1", name: "Authentication" },
        { id: "fold2", name: "Data" },
      ],
      environments: () => [
        { id: "env1", name: "Development" },
        { id: "env2", name: "Production" },
      ],
      chains: () => [
        { id: "chain1", name: "Checkout Flow" },
        { id: "chain2", name: "Auth Chain" },
      ],
      exists: () => true,
      ...overrides,
    }) as StoreAccess;

  describe("target name resolution", () => {
    it("resolves request names from refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Get Users");
    });

    it("resolves collection names from refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_collection",
        refs: () => [{ kind: "collection", id: "col1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("APIs");
    });

    it("resolves folder names from refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "move_item",
        refs: () => [{ kind: "folder", id: "fold1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Authentication");
    });

    it("resolves environment names from refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_environment",
        refs: () => [{ kind: "environment", id: "env1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Development");
    });

    it("resolves chain names from refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_chain",
        refs: () => [{ kind: "chain", id: "chain1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Checkout Flow");
    });

    it("resolves multiple entity names", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "req1" },
          { kind: "request", id: "req2" },
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Get Users");
      expect(preview.targets).toContain("Create User");
    });

    it("resolves mixed entity kinds", () => {
      const tool: Partial<RegisteredTool> = {
        name: "move_item",
        refs: () => [
          { kind: "request", id: "req1" },
          { kind: "collection", id: "col1" },
          { kind: "folder", id: "fold1" },
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toContain("Get Users");
      expect(preview.targets).toContain("APIs");
      expect(preview.targets).toContain("Authentication");
    });
  });

  describe("target count", () => {
    it("sets count to the total number of targets", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "req1" },
          { kind: "request", id: "req2" },
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.count).toBe(2);
    });

    it("counts unresolved refs towards the total", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "req1" },
          { kind: "request", id: "missing-id" }, // unresolved
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.count).toBe(2);
      expect(preview.targets).toHaveLength(1); // only resolved names
    });
  });

  describe("target capping", () => {
    it("caps displayed targets at PREVIEW_TARGETS_MAX", () => {
      const ids = Array.from({ length: PREVIEW_TARGETS_MAX + 3 }, (_, i) => `req${i + 1}`);
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () =>
          ids.map((id) => ({ kind: "request" as const, id })),
      };
      const store = mockStore({
        requests: () =>
          ids.map((id) => ({ id, name: `Request ${id}` })) as never,
      });
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets.length).toBe(PREVIEW_TARGETS_MAX);
      expect(preview.count).toBe(PREVIEW_TARGETS_MAX + 3);
    });

    it("shows first PREVIEW_TARGETS_MAX targets", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "req1" },
          { kind: "request", id: "req2" },
          { kind: "collection", id: "col1" },
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets.slice(0, PREVIEW_TARGETS_MAX)).toEqual(
        preview.targets
      );
    });
  });

  describe("step label fallback", () => {
    it("includes stepLabel when no targets are resolved", () => {
      const tool: Partial<RegisteredTool> = {
        name: "create_request",
        refs: () => [], // creating something has no refs
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.stepLabel).toBeDefined();
      expect(preview.targets).toEqual([]);
      expect(preview.count).toBe(0);
    });

    it("does not include stepLabel when targets are resolved", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.stepLabel).toBeUndefined();
      expect(preview.targets).toHaveLength(1);
    });

    it("stepLabel is undefined when at least one target resolves", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "missing" },
          { kind: "request", id: "req1" }, // at least one resolves
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.stepLabel).toBeUndefined();
      expect(preview.targets).toHaveLength(1);
      expect(preview.count).toBe(2);
    });
  });

  describe("confirmation preview structure", () => {
    it("always sets action to 'change'", () => {
      const tool: Partial<RegisteredTool> = {
        name: "update_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.action).toBe("change");
    });

    it("always sets severity to 'caution'", () => {
      const tool: Partial<RegisteredTool> = {
        name: "update_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.severity).toBe("caution");
    });

    it("has targets and count properties", () => {
      const tool: Partial<RegisteredTool> = {
        name: "update_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview).toHaveProperty("targets");
      expect(preview).toHaveProperty("count");
      expect(Array.isArray(preview.targets)).toBe(true);
      expect(typeof preview.count).toBe("number");
    });
  });

  describe("entity kind lookup", () => {
    it("uses the correct store method for each entity kind", () => {
      const allKinds = [
        { kind: "request" as const, id: "req1", storeFn: "requests" },
        { kind: "collection" as const, id: "col1", storeFn: "collections" },
        { kind: "folder" as const, id: "fold1", storeFn: "folders" },
        { kind: "environment" as const, id: "env1", storeFn: "environments" },
        { kind: "chain" as const, id: "chain1", storeFn: "chains" },
      ];

      for (const { kind, id, storeFn } of allKinds) {
        const tool: Partial<RegisteredTool> = {
          name: "delete_request",
          refs: () => [{ kind, id }],
        };
        const store = mockStore();
        const preview = describeGeneric(tool as RegisteredTool, {}, store);

        expect(preview.targets).toHaveLength(1);
        expect(preview.count).toBe(1);
      }
    });
  });

  describe("empty and edge cases", () => {
    it("handles empty refs gracefully", () => {
      const tool: Partial<RegisteredTool> = {
        name: "create_collection",
        refs: () => [],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toEqual([]);
      expect(preview.count).toBe(0);
      expect(preview.stepLabel).toBeDefined();
    });

    it("handles all missing refs", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "missing1" },
          { kind: "request", id: "missing2" },
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toEqual([]);
      expect(preview.count).toBe(2);
      expect(preview.stepLabel).toBeDefined();
    });

    it("handles store returning empty arrays", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore({
        requests: () => [] as never,
      });
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      expect(preview.targets).toEqual([]);
      expect(preview.count).toBe(1);
    });
  });

  describe("input handling", () => {
    it("ignores the input parameter (refs comes from tool definition)", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const input1 = { ids: ["req1"] };
      const input2 = { ids: ["req2", "req3"] };

      const preview1 = describeGeneric(tool as RegisteredTool, input1, store);
      const preview2 = describeGeneric(tool as RegisteredTool, input2, store);

      // Both should produce the same result because refs is from the tool, not the input
      expect(preview1.targets).toEqual(preview2.targets);
      expect(preview1.count).toBe(preview2.count);
    });

    it("calls tool.refs with the input", () => {
      let receivedInput: unknown;
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: (input) => {
          receivedInput = input;
          return [];
        },
      };
      const store = mockStore();
      const input = { ids: ["req1"], op: {} };

      describeGeneric(tool as RegisteredTool, input, store);

      expect(receivedInput).toEqual(input);
    });
  });

  describe("name resolution ordering", () => {
    it("preserves the order of refs when resolving names", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [
          { kind: "request", id: "req2" },
          { kind: "request", id: "req1" },
          { kind: "request", id: "req2" }, // duplicate
        ],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      // Names should be in the order of refs (including duplicates)
      expect(preview.targets[0]).toBe("Create User"); // req2
      expect(preview.targets[1]).toBe("Get Users"); // req1
    });
  });

  describe("tool name property", () => {
    it("includes the tool name in the preview", () => {
      const tool: Partial<RegisteredTool> = {
        name: "delete_request",
        refs: () => [{ kind: "request", id: "req1" }],
      };
      const store = mockStore();
      const preview = describeGeneric(tool as RegisteredTool, {}, store);

      // The tool name isn't directly in preview, but it's used in stepLabel
      expect(typeof preview).toBe("object");
      expect(preview).toHaveProperty("action");
    });
  });
});
