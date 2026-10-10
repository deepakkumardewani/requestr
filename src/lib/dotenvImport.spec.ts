import { describe, expect, it } from "vitest";
import { consumeDotEnvBulkPaste, parseDotEnvContent } from "./dotenvImport";

describe("parseDotEnvContent", () => {
  it("parses KEY=VALUE and skips blanks and comments", () => {
    const raw = `
# comment
FOO=bar

BAZ=qux
`;
    expect(parseDotEnvContent(raw)).toEqual([
      { key: "FOO", value: "bar" },
      { key: "BAZ", value: "qux" },
    ]);
  });

  it("later duplicate key wins", () => {
    expect(
      parseDotEnvContent(`A=1
A=2`),
    ).toEqual([{ key: "A", value: "2" }]);
  });

  it("strips matching quotes", () => {
    expect(parseDotEnvContent(`X="hello"`)).toEqual([
      { key: "X", value: "hello" },
    ]);
  });
});

describe("parseDotEnvContent quoted values with trailing comments", () => {
  it("unquotes a single-quoted value followed by a trailing comment", () => {
    expect(parseDotEnvContent("K='a#b' # c")).toEqual([
      { key: "K", value: "a#b" },
    ]);
  });

  it("unquotes a double-quoted value followed by a trailing comment", () => {
    expect(parseDotEnvContent('K="a#b" # c')).toEqual([
      { key: "K", value: "a#b" },
    ]);
  });
});

describe("parseDotEnvContent edge cases", () => {
  it("keeps everything after the first = when the value contains =", () => {
    expect(parseDotEnvContent("TOKEN=abc==")).toEqual([
      { key: "TOKEN", value: "abc==" },
    ]);
  });

  it("parses CRLF line endings without leaving carriage returns in values", () => {
    expect(parseDotEnvContent("A=1\r\nB=2\r\n")).toEqual([
      { key: "A", value: "1" },
      { key: "B", value: "2" },
    ]);
  });

  it("keeps a key with an empty value as an empty string", () => {
    expect(parseDotEnvContent("EMPTY=\nNEXT=1")).toEqual([
      { key: "EMPTY", value: "" },
      { key: "NEXT", value: "1" },
    ]);
  });

  it("ignores a leading BOM so the first key is not corrupted", () => {
    expect(parseDotEnvContent("\uFEFFFIRST=1\nSECOND=2")).toEqual([
      { key: "FIRST", value: "1" },
      { key: "SECOND", value: "2" },
    ]);
  });

  it("skips lines with no key before the =", () => {
    expect(parseDotEnvContent("=novalue\nOK=1")).toEqual([
      { key: "OK", value: "1" },
    ]);
  });

  it("strips the export prefix from the key", () => {
    expect(parseDotEnvContent("export API_KEY=v")).toEqual([
      { key: "API_KEY", value: "v" },
    ]);
  });

  it("strips an inline comment from an unquoted value", () => {
    expect(parseDotEnvContent("HOST=localhost # dev")).toEqual([
      { key: "HOST", value: "localhost" },
    ]);
  });

  it("keeps # inside a quoted value", () => {
    expect(parseDotEnvContent('A="x # y"\nB=\'p # q\'')).toEqual([
      { key: "A", value: "x # y" },
      { key: "B", value: "p # q" },
    ]);
  });

  it("keeps # that is not preceded by whitespace", () => {
    expect(parseDotEnvContent("URL=http://x/#frag")).toEqual([
      { key: "URL", value: "http://x/#frag" },
    ]);
  });
});

describe("consumeDotEnvBulkPaste", () => {
  it("returns pairs for multi-line paste", () => {
    expect(consumeDotEnvBulkPaste("A=1\nB=2")).toEqual([
      { key: "A", value: "1" },
      { key: "B", value: "2" },
    ]);
  });

  it("returns null for single-line (normal cell edit)", () => {
    expect(consumeDotEnvBulkPaste("A=1")).toBeNull();
  });
});
