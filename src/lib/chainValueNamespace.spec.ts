import { describe, expect, it } from "vitest";
import type { ChainBlock, ChainEdge } from "@/types/chain";
import {
  buildNamespaceObject,
  collectDeclaredNamespace,
  compactWarnings,
  detectChainAliasCollisions,
  isReservedAlias,
  registerAlias,
  registerEdgeAlias,
  resolveInNamespace,
  isValidLoopAlias,
} from "./chainValueNamespace";

describe("isReservedAlias", () => {
  it("flags collect. and sub. prefixes as reserved", () => {
    expect(isReservedAlias("collect.foo")).toBe(true);
    expect(isReservedAlias("sub.bar")).toBe(true);
    expect(isReservedAlias("token")).toBe(false);
    expect(isReservedAlias("collection")).toBe(false); // no trailing dot
  });
});

describe("resolveInNamespace", () => {
  it("resolves chainInputs > aliasValues > env, first hit wins", () => {
    const ns = {
      chainInputs: { a: "input" },
      aliasValues: { a: "alias", b: "alias-b" },
      resolveVariables: (text: string) => text.replace(/\{\{c\}\}/g, "env-c"),
    };
    expect(resolveInNamespace("{{a}}-{{b}}-{{c}}", ns)).toBe(
      "input-alias-b-env-c",
    );
  });
});

describe("buildNamespaceObject", () => {
  it("merges env base, alias shadow, chainInputs shadow", () => {
    expect(
      buildNamespaceObject({
        envVars: { a: "env", z: "env-only" },
        aliasValues: { a: "alias" },
        chainInputs: { a: "input" },
      }),
    ).toEqual({ a: "input", z: "env-only" });
  });
});

describe("registerAlias", () => {
  it("writes the value under alias", () => {
    const aliasValues: Record<string, string> = {};
    registerAlias(aliasValues, "token", "abc");
    expect(aliasValues).toEqual({ token: "abc" });
  });

  it("skips null/undefined values", () => {
    const aliasValues: Record<string, string> = {};
    registerAlias(aliasValues, "token", null);
    registerAlias(aliasValues, "token2", undefined);
    expect(aliasValues).toEqual({});
  });

  it("no-ops for reserved-prefix aliases", () => {
    const aliasValues: Record<string, string> = {};
    registerAlias(aliasValues, "collect.foo", "abc");
    registerAlias(aliasValues, "sub.bar", "def");
    expect(aliasValues).toEqual({});
  });
});

describe("registerEdgeAlias", () => {
  it("writes both the plain and edge-scoped keys", () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "edge-1", "userId", "u1");
    expect(aliasValues).toEqual({ userId: "u1", "edge-1:userId": "u1" });
  });

  it("no-ops both keys for a reserved-prefix alias", () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "edge-1", "sub.foo", "u1");
    expect(aliasValues).toEqual({});
  });
});

function edge(id: string, targetKeys: string[]): ChainEdge {
  return {
    id,
    sourceRequestId: `${id}-src`,
    targetRequestId: `${id}-tgt`,
    injections: targetKeys.map((targetKey) => ({
      sourceJsonPath: "$.id",
      targetField: "header",
      targetKey,
    })),
  };
}

describe("detectChainAliasCollisions", () => {
  const start: ChainBlock = {
    id: "s",
    type: "start",
    inputs: [{ key: "id", defaultValue: "", source: "literal" }],
  } as ChainBlock;
  const display = (id: string, targetKey: string): ChainBlock => ({
    id,
    type: "display",
    sourceJsonPath: "$.a",
    targetField: "header",
    targetKey,
  });
  const evaluate = (id: string, outputAlias: string): ChainBlock => ({
    id,
    type: "evaluate",
    code: "",
    outputAlias,
  });
  const loop = (id: string, itemAlias: string): ChainBlock => ({
    id,
    type: "loop",
    sourceJsonPath: "$.items",
    itemAlias,
    maxIterations: 5,
  });

  it("flags an alias written by two edges", () => {
    const edges = [edge("a", ["id"]), edge("b", ["id", "name"]), edge("c", ["x"])];
    expect(detectChainAliasCollisions([], edges)).toEqual({
      id: [
        { kind: "edge", id: "a" },
        { kind: "edge", id: "b" },
      ],
    });
  });

  it.each([
    ["Display targetKey", [display("d", "id")], "display"],
    ["Evaluate outputAlias", [evaluate("e", "id")], "evaluate"],
    ["Loop itemAlias", [loop("l", "id")], "loop"],
    ["Start input", [start], "start"],
  ])("flags an edge colliding with a %s", (_label, blocks, kind) => {
    const result = detectChainAliasCollisions(blocks, [edge("a", ["id"])]);
    expect(result.id.map((s) => s.kind).sort()).toEqual(["edge", kind].sort());
  });

  it("flags a Display block colliding with an Evaluate block", () => {
    const result = detectChainAliasCollisions(
      [display("d", "x"), evaluate("e", "x")],
      [],
    );
    expect(result.x).toHaveLength(2);
  });

  it("flags a user alias `index` against the Loop index, but not two Loops", () => {
    expect(
      detectChainAliasCollisions([loop("l", "item"), loop("m", "row")], []),
    ).toEqual({});
    const result = detectChainAliasCollisions([loop("l", "item")], [edge("a", ["index"])]);
    expect(result.index.map((s) => s.kind).sort()).toEqual(["edge", "loopIndex"]);
  });

  it("does not flag one producer repeating a name, blanks or reserved names", () => {
    expect(detectChainAliasCollisions([], [edge("a", ["id", "id"])])).toEqual({});
    expect(detectChainAliasCollisions([], [edge("a", [""]), edge("b", [""])])).toEqual({});
    expect(
      detectChainAliasCollisions([], [edge("a", ["sub.x"]), edge("b", ["sub.x"])]),
    ).toEqual({});
  });
});

describe("registerAlias collision reporting", () => {
  const edgeOwner = { kind: "edge", id: "e1" } as const;
  const displayOwner = { kind: "display", id: "d1" } as const;

  it("returns a structured warning for a write by a different owner, but still writes", () => {
    const aliasValues: Record<string, string> = {};
    expect(registerAlias(aliasValues, "id", "1", { owner: edgeOwner })).toBeUndefined();
    expect(registerAlias(aliasValues, "id", "2", { owner: displayOwner })).toEqual({
      kind: "alias-collision",
      alias: "id",
      previousOwner: edgeOwner,
      owner: displayOwner,
    });
    expect(aliasValues.id).toBe("2");
  });

  it("does not warn for the same owner re-writing (loop iterations) or ownerless writes", () => {
    const aliasValues: Record<string, string> = {};
    registerAlias(aliasValues, "id", "1", { owner: edgeOwner });
    expect(registerAlias(aliasValues, "id", "2", { owner: { ...edgeOwner } })).toBeUndefined();
    expect(registerAlias(aliasValues, "id", "3")).toBeUndefined();
  });

  it("keeps ownership per run (per aliasValues object)", () => {
    registerAlias({}, "id", "1", { owner: edgeOwner });
    expect(registerAlias({}, "id", "1", { owner: displayOwner })).toBeUndefined();
  });

  it("reports edge-vs-edge collisions from registerEdgeAlias", () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e1", "id", "1");
    expect(registerEdgeAlias(aliasValues, "e1", "id", "1")).toBeUndefined();
    expect(registerEdgeAlias(aliasValues, "e2", "id", "2")?.alias).toBe("id");
  });

  it("compactWarnings drops empties and returns undefined when none remain", () => {
    expect(compactWarnings([undefined, undefined])).toBeUndefined();
    const warning = registerAlias({ id: "x" }, "id", "y");
    expect(compactWarnings([warning])).toBeUndefined();
  });
});

describe("collectDeclaredNamespace", () => {
  it("collects start inputs, edge targetKeys and display/evaluate/loop aliases", () => {
    const blocks: ChainBlock[] = [
      {
        id: "s",
        type: "start",
        inputs: [{ key: "userId", defaultValue: "", source: "literal" }],
      },
      { id: "e", type: "evaluate", code: "", outputAlias: "result" },
      {
        id: "d",
        type: "display",
        sourceJsonPath: "$.a",
        targetField: "header",
        targetKey: "shown",
      },
      {
        id: "l",
        type: "loop",
        sourceJsonPath: "$.items",
        itemAlias: "item",
        maxIterations: 5,
      },
    ];
    const { chainInputs, aliasValues } = collectDeclaredNamespace(blocks, [
      edge("a", ["token", "collect.bad"]),
    ]);
    expect(Object.keys(chainInputs)).toEqual(["userId"]);
    expect(Object.keys(aliasValues).sort()).toEqual(
      ["index", "item", "result", "shown", "token"].sort(),
    );
  });
});

describe("isValidLoopAlias", () => {
  it.each(["item", "user_1", "X"])("accepts %s", (alias) => {
    expect(isValidLoopAlias(alias)).toBe(true);
  });

  it.each(["", "index", "my-var", "collect.x", "a b", "1abc"])("rejects %j", (alias) => {
    expect(isValidLoopAlias(alias)).toBe(false);
  });
});
