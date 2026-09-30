import { describe, expect, it } from "vitest";
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
});
