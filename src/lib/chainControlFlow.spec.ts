import { describe, expect, it } from "vitest";
import type { ChainEdge } from "@/types/chain";
import {
  detectAliasCollisions,
  evaluateCondition,
  resolveConditionVariable,
  resolveDelay,
} from "./chainControlFlow";

describe("resolveDelay", () => {
  it("resolves after delay when not aborted", async () => {
    await expect(
      resolveDelay(
        { id: "d", type: "delay", delayMs: 5 },
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects immediately when signal already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      resolveDelay({ id: "d", type: "delay", delayMs: 100 }, ac.signal),
    ).rejects.toThrow("Aborted");
  });

  it("rejects when aborted during wait", async () => {
    const ac = new AbortController();
    const p = resolveDelay(
      { id: "d", type: "delay", delayMs: 10_000 },
      ac.signal,
    );
    queueMicrotask(() => ac.abort());
    await expect(p).rejects.toThrow("Aborted");
  });
});

describe("resolveConditionVariable", () => {
  it("strips the braces and surrounding whitespace", () => {
    expect(resolveConditionVariable("{{ role }}")).toBe("role");
    expect(resolveConditionVariable("role")).toBe("role");
  });
});

describe("evaluateCondition", () => {
  const node = {
    id: "c",
    type: "condition" as const,
    variable: "{{role}}",
    branches: [
      { id: "b-admin", label: "admin", expression: `== 'admin'` },
      { id: "b-else", label: "else", expression: "" },
    ],
  };

  it("returns null when no branches", () => {
    expect(
      evaluateCondition({ ...node, branches: [] }, { role: "admin" }),
    ).toBeNull();
  });

  it("matches first string equality branch", () => {
    expect(evaluateCondition(node, { role: "admin" })).toBe("b-admin");
  });

  it("falls through to else branch when no match", () => {
    expect(evaluateCondition(node, { role: "guest" })).toBe("b-else");
  });

  it("matches numeric equality, inequality, ordering, and contains", () => {
    expect(
      evaluateCondition(
        { ...node, branches: [{ id: "e", label: "e", expression: `== 'a'` }] },
        { role: "a" },
      ),
    ).toBe("e");
    expect(
      evaluateCondition(
        { ...node, branches: [{ id: "n", label: "n", expression: "!= 99" }] },
        { role: "10" },
      ),
    ).toBe("n");
    expect(
      evaluateCondition(
        { ...node, branches: [{ id: "g", label: "g", expression: "> 5" }] },
        { role: "10" },
      ),
    ).toBe("g");
    expect(
      evaluateCondition(
        { ...node, branches: [{ id: "l", label: "l", expression: "< 20" }] },
        { role: "10" },
      ),
    ).toBe("l");
    expect(
      evaluateCondition(
        {
          ...node,
          branches: [{ id: "co", label: "co", expression: `contains 'lo'` }],
        },
        { role: "hello" },
      ),
    ).toBe("co");
  });

  it("uses empty string when variable missing from map", () => {
    expect(
      evaluateCondition(
        {
          ...node,
          branches: [{ id: "m", label: "m", expression: `== ''` }],
        },
        {},
      ),
    ).toBe("m");
  });

  it("variable may include braces in config", () => {
    expect(
      evaluateCondition(
        { ...node, variable: "role", branches: node.branches },
        { role: "admin" },
      ),
    ).toBe("b-admin");
  });
});

describe("detectAliasCollisions", () => {
  it("returns empty when no collisions", () => {
    const edges = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.token",
            targetField: "header" as const,
            targetKey: "Authorization",
          },
        ],
      },
      {
        id: "e2",
        sourceRequestId: "c",
        targetRequestId: "d",
        injections: [
          {
            sourceJsonPath: "$.userId",
            targetField: "header" as const,
            targetKey: "x-user-id",
          },
        ],
      },
    ] satisfies ChainEdge[];

    expect(detectAliasCollisions(edges)).toEqual({});
  });

  it("detects duplicate alias across different edges", () => {
    const edges = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.user.id",
            targetField: "header" as const,
            targetKey: "Authorization", // Same alias
          },
        ],
      },
      {
        id: "e2",
        sourceRequestId: "c",
        targetRequestId: "d",
        injections: [
          {
            sourceJsonPath: "$.org.token",
            targetField: "header" as const,
            targetKey: "Authorization", // Collision!
          },
        ],
      },
    ] satisfies ChainEdge[];

    const collisions = detectAliasCollisions(edges);
    expect(collisions.Authorization).toContain("e1");
    expect(collisions.Authorization).toContain("e2");
    expect(collisions.Authorization).toHaveLength(2);
  });

  it("skips routing edges with branchId", () => {
    const edges = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        branchId: "branch1",
        injections: [
          {
            sourceJsonPath: "$.x",
            targetField: "header" as const,
            targetKey: "X-Key",
          },
        ],
      },
      {
        id: "e2",
        sourceRequestId: "c",
        targetRequestId: "d",
        injections: [
          {
            sourceJsonPath: "$.y",
            targetField: "header" as const,
            targetKey: "Y-Key",
          },
        ],
      },
    ] satisfies ChainEdge[];

    // e1 has branchId, so it's ignored; e2 is alone, so no collision
    expect(detectAliasCollisions(edges)).toEqual({});
  });
});
