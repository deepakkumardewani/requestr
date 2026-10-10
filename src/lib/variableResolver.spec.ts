import { describe, expect, it } from "vitest";
import { resolveVariables, tokenizeVariables } from "./variableResolver";

describe("resolveVariables", () => {
  it("replaces simple tokens from env", () => {
    expect(resolveVariables("Hello {{name}}", { name: "World" })).toBe(
      "Hello World",
    );
  });

  it("leaves missing keys as original token", () => {
    expect(resolveVariables("{{a}} {{missing}}", { a: "1" })).toBe(
      "1 {{missing}}",
    );
  });

  it("handles multiple occurrences and empty template", () => {
    expect(resolveVariables("", {})).toBe("");
    expect(resolveVariables("{{x}}{{x}}", { x: "0" })).toBe("00");
  });

  it("does not interpolate hyphenated variable names (regex is \\w+ only)", () => {
    expect(resolveVariables("{{a-b}}", { "a-b": "x" })).toBe("{{a-b}}");
    expect(resolveVariables("{{k}}", { k: "ok" })).toBe("ok");
  });
});

describe("resolveVariables edge cases", () => {
  it("leaves whitespace-padded tokens unresolved because the regex has no padding", () => {
    expect(resolveVariables("{{ a }}", { a: "1" })).toBe("{{ a }}");
  });

  it("does not re-expand a value that itself contains a token (single pass)", () => {
    expect(resolveVariables("{{a}}", { a: "{{b}}", b: "deep" })).toBe("{{b}}");
  });

  it("does not resolve a token nested inside another token's braces", () => {
    expect(resolveVariables("{{{{a}}}}", { a: "k", k: "v" })).toBe("{{k}}");
  });

  it("substitutes an empty-string value rather than keeping the token", () => {
    expect(resolveVariables("a{{x}}b", { x: "" })).toBe("ab");
  });

  it("keeps the token when the env value is explicitly undefined", () => {
    const env = { x: undefined } as unknown as Record<string, string>;
    expect(resolveVariables("a{{x}}b", env)).toBe("a{{x}}b");
  });
});

describe("tokenizeVariables", () => {
  it("returns a single literal when no variables", () => {
    expect(tokenizeVariables("plain", {})).toEqual([
      { text: "plain", isVariable: false, resolved: false },
    ]);
  });

  it("marks resolved when key exists in env", () => {
    expect(tokenizeVariables("{{a}}", { a: "1" })).toEqual([
      { text: "{{a}}", isVariable: true, resolved: true },
    ]);
  });

  it("marks unresolved when key missing", () => {
    expect(tokenizeVariables("{{a}}", {})).toEqual([
      { text: "{{a}}", isVariable: true, resolved: false },
    ]);
  });

  it("intersperse literal segments between variables", () => {
    expect(tokenizeVariables("pre{{x}}mid{{y}}", { x: "", y: "z" })).toEqual([
      { text: "pre", isVariable: false, resolved: false },
      { text: "{{x}}", isVariable: true, resolved: true },
      { text: "mid", isVariable: false, resolved: false },
      { text: "{{y}}", isVariable: true, resolved: true },
    ]);
  });
});

describe("tokenizeVariables resolved vs unresolved highlighting", () => {
  it("flags only the missing variable as unresolved in a mixed URL", () => {
    const tokens = tokenizeVariables("{{host}}/users/{{id}}", { host: "h" });
    expect(
      tokens.filter((t) => t.isVariable).map((t) => [t.text, t.resolved]),
    ).toEqual([
      ["{{host}}", true],
      ["{{id}}", false],
    ]);
  });

  it("treats a variable defined with an empty value as resolved, matching resolveVariables", () => {
    const env = { empty: "" };
    expect(tokenizeVariables("{{empty}}", env)[0].resolved).toBe(true);
    expect(resolveVariables("{{empty}}", env)).toBe("");
  });

  it("treats whitespace-padded tokens as plain literal text", () => {
    expect(tokenizeVariables("{{ a }}", { a: "1" })).toEqual([
      { text: "{{ a }}", isVariable: false, resolved: false },
    ]);
  });
});
