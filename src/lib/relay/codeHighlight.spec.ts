import { afterEach, describe, expect, it, vi } from "vitest";
import {
  highlightCode,
  languageFromClassName,
  resolveHighlightLanguage,
} from "./codeHighlight";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveHighlightLanguage", () => {
  it.each([
    ["json", "json"],
    ["JSONC", "json"],
    ["js", "javascript"],
    ["jsx", "javascript"],
    ["TS", "typescript"],
    ["tsx", "typescript"],
    ["bash", "shell"],
    ["zsh", "shell"],
    ["html", "xml"],
    ["xml", "xml"],
  ])("maps %s to %s", (label, expected) => {
    expect(resolveHighlightLanguage(label)).toBe(expected);
  });

  it("returns null for empty, unknown and prototype-named labels", () => {
    expect(resolveHighlightLanguage(null)).toBeNull();
    expect(resolveHighlightLanguage(undefined)).toBeNull();
    expect(resolveHighlightLanguage("")).toBeNull();
    expect(resolveHighlightLanguage("graphql")).toBeNull();
    expect(resolveHighlightLanguage("constructor")).toBeNull();
  });
});

describe("languageFromClassName", () => {
  it("extracts the label from a language- class", () => {
    expect(languageFromClassName("language-json")).toBe("json");
    expect(languageFromClassName("hljs language-ts extra")).toBe("ts");
  });

  it("returns null without a language class", () => {
    expect(languageFromClassName(null)).toBeNull();
    expect(languageFromClassName(undefined)).toBeNull();
    expect(languageFromClassName("hljs")).toBeNull();
  });
});

describe("highlightCode", () => {
  it("resolves null for a language without a grammar", async () => {
    expect(await highlightCode("{ a }", "graphql")).toBeNull();
    expect(await highlightCode("x", null)).toBeNull();
  });

  it("styles json tokens and rebuilds the exact input", async () => {
    const code = '{"a": 1, "b": true}';
    const segments = await highlightCode(code, "json");
    expect(segments?.map((s) => s.text).join("")).toBe(code);
    const styled = (text: string) => segments?.find((s) => s.text === text)?.className;
    expect(styled('"a"')).toContain("text-sky-");
    expect(styled("1")).toContain("text-amber-");
    expect(styled("true")).toContain("text-orange-");
  });

  it.each([
    ["javascript", "const x = 'a'; // note"],
    ["ts", "let n: number = 1"],
    ["sh", "echo \"hi\" # c"],
    ["html", '<a href="x">t</a>'],
  ])("highlights %s and preserves the text", async (label, code) => {
    const segments = await highlightCode(code, label);
    expect(segments).not.toBeNull();
    expect(segments?.map((s) => s.text).join("")).toBe(code);
    expect(segments?.some((s) => s.className !== null)).toBe(true);
  });

  it("returns a single plain segment for text without tokens", async () => {
    expect(await highlightCode("   ", "json")).toEqual([{ text: "   ", className: null }]);
  });

  it("returns an empty list for empty code", async () => {
    expect(await highlightCode("", "json")).toEqual([]);
  });
});

describe("highlightCode when a grammar fails to load", () => {
  it("logs with context and resolves null so plain text stays", async () => {
    vi.resetModules();
    vi.doMock("@codemirror/lang-json", () => {
      throw new Error("chunk failed");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { highlightCode: freshHighlight } = await import("./codeHighlight");

    expect(await freshHighlight("{}", "json")).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "[relay] code highlighting failed",
      expect.objectContaining({ language: "json" }),
    );
    vi.doUnmock("@codemirror/lang-json");
  });
});
