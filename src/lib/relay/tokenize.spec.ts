import { describe, it, expect } from "vitest";
import { isFileLike, tokenizeProse, type ProseToken } from "./tokenize";

describe("tokenizeProse", () => {
  it("extracts HTTP method tokens", () => {
    const tokens = tokenizeProse("Send a GET request to the API");
    expect(tokens).toContainEqual({ type: "method", value: "GET" });
  });

  it("extracts all HTTP methods", () => {
    const text = "GET POST PUT PATCH DELETE HEAD OPTIONS";
    const tokens = tokenizeProse(text);
    const methods = tokens.filter((t) => t.type === "method");
    expect(methods).toHaveLength(7);
    expect(methods.map((m) => m.value)).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ]);
  });

  it("extracts 3-digit status codes", () => {
    const tokens = tokenizeProse("The API returned 404");
    expect(tokens).toContainEqual({ type: "status", value: "404" });
  });

  it("extracts status code at boundary 100", () => {
    const tokens = tokenizeProse("Status 100 Continue");
    expect(tokens).toContainEqual({ type: "status", value: "100" });
  });

  it("extracts status code at boundary 599", () => {
    const tokens = tokenizeProse("Error 599 Network connect timeout");
    expect(tokens).toContainEqual({ type: "status", value: "599" });
  });

  it("rejects 3-digit code below 100", () => {
    const tokens = tokenizeProse("The code 099 is not valid");
    expect(tokens).not.toContainEqual({ type: "status", value: "099" });
  });

  it("rejects 3-digit code above 599", () => {
    const tokens = tokenizeProse("Code 600 is outside range");
    expect(tokens).not.toContainEqual({ type: "status", value: "600" });
  });

  it("preserves plain text between tokens", () => {
    const tokens = tokenizeProse("Try GET request");
    const textTokens = tokens.filter((t) => t.type === "text");
    expect(textTokens.length).toBeGreaterThan(0);
    const fullText = textTokens.map((t) => t.value).join("");
    expect(fullText).toContain("Try");
    expect(fullText).toContain("request");
  });

  it("handles empty string", () => {
    const tokens = tokenizeProse("");
    expect(tokens).toEqual([]);
  });

  it("handles string with only whitespace", () => {
    const tokens = tokenizeProse("   ");
    expect(tokens).toEqual([{ type: "text", value: "   " }]);
  });

  it("does not tokenize numbers with surrounding word characters", () => {
    const tokens = tokenizeProse("model123 and 456test");
    const statusTokens = tokens.filter((t) => t.type === "status");
    expect(statusTokens).toEqual([]);
  });

  it("does not tokenize codes next to decimal points", () => {
    const tokens = tokenizeProse("Version 1.404.2 is available");
    expect(tokens).not.toContainEqual({ type: "status", value: "404" });
  });

  it("does not tokenize codes next to commas with numbers", () => {
    const tokens = tokenizeProse("Costs 1,404 dollars");
    expect(tokens).not.toContainEqual({ type: "status", value: "404" });
  });

  it("handles consecutive tokens", () => {
    const tokens = tokenizeProse("GET 200 POST 201");
    const methods = tokens.filter((t) => t.type === "method");
    const statuses = tokens.filter((t) => t.type === "status");
    expect(methods).toHaveLength(2);
    expect(statuses).toHaveLength(2);
  });

  it("is case-sensitive for HTTP methods", () => {
    const tokens = tokenizeProse("get post put");
    const methods = tokens.filter((t) => t.type === "method");
    expect(methods).toEqual([]);
  });

  it("preserves order of tokens", () => {
    const tokens = tokenizeProse("GET 200 POST");
    expect(tokens[0]?.value).toContain("G");
    const methodStatuses = tokens.filter(
      (t) => t.type === "method" || t.type === "status"
    );
    expect(methodStatuses[0]).toEqual({ type: "method", value: "GET" });
    expect(methodStatuses[1]).toEqual({ type: "status", value: "200" });
    expect(methodStatuses[2]).toEqual({ type: "method", value: "POST" });
  });

  it("handles method at start of string", () => {
    const tokens = tokenizeProse("GET /api");
    expect(tokens[0]).toEqual({ type: "method", value: "GET" });
  });

  it("handles method at end of string", () => {
    const tokens = tokenizeProse("request method is GET");
    const lastMethod = tokens.filter((t) => t.type === "method")[0];
    expect(lastMethod?.value).toBe("GET");
  });

  it("handles status at start", () => {
    const tokens = tokenizeProse("404 error occurred");
    expect(tokens[0]).toEqual({ type: "status", value: "404" });
  });

  it("handles status at end", () => {
    const tokens = tokenizeProse("returned with 500");
    const tokens_arr = tokens.filter((t) => t.type === "status");
    expect(tokens_arr[0]?.value).toBe("500");
  });

  it("does not break on consecutive methods", () => {
    const tokens = tokenizeProse("GET POST PUT");
    const methods = tokens.filter((t) => t.type === "method");
    expect(methods).toHaveLength(3);
  });

  it("handles mixed case text correctly", () => {
    const tokens = tokenizeProse("Return a GET response with 200");
    expect(tokens).toContainEqual({ type: "method", value: "GET" });
    expect(tokens).toContainEqual({ type: "status", value: "200" });
  });

  it("preserves all text in output", () => {
    const input = "Send a GET request with 404 response";
    const tokens = tokenizeProse(input);
    const reconstructed = tokens.map((t) => t.value).join("");
    expect(reconstructed).toBe(input);
  });

  it("tokenizes numeric codes not as text", () => {
    const tokens = tokenizeProse("Result is 200 OK");
    expect(tokens[0]?.type).toBe("text");
    expect(tokens[1]?.type).toBe("status");
  });

  it("handles newlines in text", () => {
    const tokens = tokenizeProse("GET\n200\nOK");
    const methods = tokens.filter((t) => t.type === "method");
    const statuses = tokens.filter((t) => t.type === "status");
    expect(methods).toHaveLength(1);
    expect(statuses).toHaveLength(1);
  });
});

describe("isFileLike", () => {
  it("detects URLs with standard schemes", () => {
    expect(isFileLike("http://example.com")).toBe(true);
    expect(isFileLike("https://example.com/path")).toBe(true);
    expect(isFileLike("ftp://files.example.com")).toBe(true);
  });

  it("detects URLs with port numbers", () => {
    expect(isFileLike("http://localhost:3000")).toBe(true);
    expect(isFileLike("https://api.example.com:8443")).toBe(true);
  });

  it("detects URLs with query strings", () => {
    expect(isFileLike("http://example.com?param=value")).toBe(true);
  });

  it("detects URLs with fragments", () => {
    expect(isFileLike("http://example.com#section")).toBe(true);
  });

  it("matches domain-like strings as file names", () => {
    // "example.com" matches FILE_NAME_LIKE pattern, not URL_LIKE
    expect(isFileLike("example.com")).toBe(true);
  });

  it("rejects URLs with invalid scheme format", () => {
    expect(isFileLike("ht!tp://example.com")).toBe(false);
  });

  it("detects absolute file paths", () => {
    expect(isFileLike("/usr/local/bin")).toBe(true);
    expect(isFileLike("/path/to/file")).toBe(true);
  });

  it("detects relative file paths", () => {
    expect(isFileLike("./src/index.ts")).toBe(true);
    expect(isFileLike("../parent/file")).toBe(true);
  });

  it("detects relative paths with no leading dot", () => {
    expect(isFileLike("src/components/Button.tsx")).toBe(true);
  });

  it("rejects single path segments without slashes", () => {
    expect(isFileLike("filename")).toBe(false);
  });

  it("detects file names with extensions", () => {
    expect(isFileLike("config.json")).toBe(true);
    expect(isFileLike("package.json")).toBe(true);
    expect(isFileLike("document.pdf")).toBe(true);
  });

  it("rejects file names with no extension", () => {
    expect(isFileLike("filename")).toBe(false);
  });

  it("detects file names with multiple dots", () => {
    expect(isFileLike("archive.tar.gz")).toBe(true);
  });

  it("detects file names with hyphens and underscores", () => {
    expect(isFileLike("my-file_name.txt")).toBe(true);
  });

  it("rejects file names with invalid characters", () => {
    expect(isFileLike("file@#$.txt")).toBe(false);
  });

  it("rejects file names with very long extensions", () => {
    expect(isFileLike("file.verylongextension")).toBe(false);
  });

  it("accepts file names with up to 7 character extensions", () => {
    expect(isFileLike("archive.backup")).toBe(true);
  });

  it("detects paths with special allowed characters", () => {
    expect(isFileLike("src/@types/index.ts")).toBe(true);
  });

  it("handles paths with trailing slashes", () => {
    expect(isFileLike("/path/to/directory/")).toBe(true);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(isFileLike("  http://example.com  ")).toBe(true);
    expect(isFileLike("  /path/to/file  ")).toBe(true);
    expect(isFileLike("  config.json  ")).toBe(true);
  });

  it("rejects pure whitespace", () => {
    expect(isFileLike("   ")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isFileLike("")).toBe(false);
  });

  it("does not match hidden files without extension", () => {
    // ".gitignore" doesn't match any pattern (no dot for FILE_NAME_LIKE, no slash for PATH_LIKE)
    expect(isFileLike(".gitignore")).toBe(false);
  });

  it("matches relative paths starting with dot", () => {
    // ".git/config" matches PATH_LIKE
    expect(isFileLike(".git/config")).toBe(true);
  });

  it("detects file names with @ symbol in path", () => {
    expect(isFileLike("src/@babel/core.ts")).toBe(true);
  });

  it("correctly identifies edge case of minimal path", () => {
    expect(isFileLike("a/b")).toBe(true);
  });

  it("handles URLs with multiple slashes in path", () => {
    expect(isFileLike("https://example.com/path/to/resource")).toBe(true);
  });

  it("rejects absolute paths with single segment", () => {
    expect(isFileLike("/file")).toBe(false);
  });

  it("handles file names with numbers", () => {
    expect(isFileLike("file123.txt")).toBe(true);
  });

  it("accepts file names starting with number", () => {
    // "123file.txt" matches FILE_NAME_LIKE pattern
    expect(isFileLike("123file.txt")).toBe(true);
  });

  it("correctly identifies URLs with credentials", () => {
    expect(isFileLike("http://user:pass@example.com")).toBe(true);
  });
});
