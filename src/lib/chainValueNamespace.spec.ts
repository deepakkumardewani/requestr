import { describe, expect, it } from "vitest";
import {
  buildNamespaceObject,
  isReservedAlias,
  registerAlias,
  registerEdgeAlias,
  resolveInNamespace,
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
