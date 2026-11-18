import { describe, expect, it } from "vitest";
import { BLOCKED_GLOBALS } from "@/lib/chainEvalLockdown";
import { evaluateInSandbox } from "@/lib/chainEval";

describe("evaluateInSandbox", () => {
  it("returns the output on success (implicit return)", () => {
    const result = evaluateInSandbox({
      code: "data.value + 1",
      data: { value: 1 },
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: 2 });
  });

  it("returns the output on success (explicit return)", () => {
    const result = evaluateInSandbox({
      code: "return inputs.name + env.SUFFIX;",
      data: {},
      inputs: { name: "foo" },
      env: { SUFFIX: "-bar" },
    });
    expect(result).toEqual({ output: "foo-bar" });
  });

  it("returns an error for a syntax error", () => {
    const result = evaluateInSandbox({
      code: "return (((;",
      data: {},
      inputs: {},
      env: {},
    });
    expect("error" in result).toBe(true);
  });

  it("returns an error for a runtime error", () => {
    const result = evaluateInSandbox({
      code: "return data.missing.deeper;",
      data: {},
      inputs: {},
      env: {},
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("undefined");
    }
  });

  it("has no access to DOM globals", () => {
    const result = evaluateInSandbox({
      code: "return typeof document;",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "undefined" });
  });

  it("has no access to the module's local scope", () => {
    const result = evaluateInSandbox({
      code: "return typeof evaluateInSandbox;",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "undefined" });
  });

  it("has no access to localStorage", () => {
    const result = evaluateInSandbox({
      code: "return typeof localStorage;",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "undefined" });
  });

  it("does not treat identifiers containing 'return' as an explicit return", () => {
    const result = evaluateInSandbox({
      code: "data.a.return_url",
      data: { a: { return_url: "https://x" } },
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "https://x" });
  });

  it("does not treat a commented 'return' as an explicit return", () => {
    const result = evaluateInSandbox({
      code: "data.n + 1 // return value",
      data: { n: 1 },
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: 2 });
  });

  it("falls back to a statement body and yields undefined when nothing is returned", () => {
    const result = evaluateInSandbox({
      code: "const a = 1; a + 1",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: undefined });
  });

  it("supports multi-statement bodies with an explicit return", () => {
    const result = evaluateInSandbox({
      code: "const a = 1; return a + 1;",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: 2 });
  });

  it.each(BLOCKED_GLOBALS)("shadows %s inside evaluated code", (name) => {
    const result = evaluateInSandbox({
      code: `return typeof ${name};`,
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "undefined" });
  });

  it("still exposes data, inputs and env alongside the shadowed globals", () => {
    const result = evaluateInSandbox({
      code: "data.a + inputs.b + env.c",
      data: { a: 1 },
      inputs: { b: "2" },
      env: { c: "3" },
    });
    expect(result).toEqual({ output: "123" });
  });

  it.each(["fetch", "indexedDB", "XMLHttpRequest", "WebSocket", "sessionStorage"])(
    "shadows the %s global",
    (name) => {
      const result = evaluateInSandbox({
        code: `return typeof ${name};`,
        data: {},
        inputs: {},
        env: {},
      });
      expect(result).toEqual({ output: "undefined" });
    },
  );

  it("cannot call fetch: it is undefined, so the call throws instead of reaching the network", () => {
    const result = evaluateInSandbox({
      code: "return fetch('https://example.com');",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toHaveProperty("error");
  });

  it("treats a property named like a keyword (data.return_url) as an expression", () => {
    const result = evaluateInSandbox({
      code: "data.return_url",
      data: { return_url: "/home" },
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: "/home" });
  });

  it("survives a trailing line comment on an expression", () => {
    const result = evaluateInSandbox({
      code: "1 + 1 // two",
      data: {},
      inputs: {},
      env: {},
    });
    expect(result).toEqual({ output: 2 });
  });
});
