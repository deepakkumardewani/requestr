import { describe, expect, it } from "vitest";
import { scrubError } from "@/lib/analytics/scrub";

const WITHHELD = "Error: [message withheld]";

const scrub = (message: string, stack?: string) => {
  const error = new Error(message);
  if (stack) error.stack = stack;
  return scrubError(error, "window");
};

/** Real engine output, not a hand-typed guess at it. */
const parseError = (input: string): unknown => {
  try {
    JSON.parse(input);
  } catch (error) {
    return error;
  }
  throw new Error("expected JSON.parse to throw");
};

describe("scrubError corpus", () => {
  it.each([
    ["multi-line quoted value", `value was "multi\nline secret"`, ["multi", "secret"]],
    ["unclosed quote", `Unexpected token 'a', "abc secret-body`, ["abc", "secret-body"]],
    ["unclosed quote past the input cap", `bad "${"s".repeat(2500)}`, ["sss"]],
    ["scheme-less path and query", "GET /v1/users/john.doe?ssn=123456789&dob=1990 failed", ["john.doe", "123456789", "1990"]],
    ["relative path", "Failed to read users/john.doe/profile", ["john.doe", "users"]],
    ["internal host path", "failed 'api.internal.corp/x'", ["corp", "api"]],
    ["unknown-TLD host", "fetch api.internal.corp/x/john", ["corp", "john"]],
    ["backticks", "bad `secretbody` here", ["secretbody"]],
    ["url and header", "https://api.acme.com/v1?token=abc123 Authorization: Bearer sk-live-12345678", ["acme", "abc123", "sk-live"]],
    ["body", 'body {"password":"hunter2"} cookie: a=1; b=2', ["hunter2", "b=2"]],
    ["ip and email", "10.0.0.1 me@x.com", ["10.0.0.1", "me@x.com"]],
    ["explicit secret", "key is zzsecretzz", ["zzsecretzz"]],
  ])("withholds %s", (_name, message, seeds) => {
    const { message: out } = scrub(message);
    for (const seed of seeds) expect(out).not.toContain(seed);
    expect(out).toBe(WITHHELD);
  });

  it.each([
    ["multi-line body", "abc\ndef ghi secret", ["abc", "def", "secret"]],
    ["single-line body", "hunter2 password", ["hunter2", "password"]],
    ["long truncated body", `${"x".repeat(100)}secret${"y".repeat(100)}`, ["xxx", "secret", "yyy"]],
    ["html body", "<html>private</html>", ["html", "private"]],
    ["trailing junk", '{"a":1}junk', ["junk"]],
    ["body line shaped like a frame location", "x\nssn:123456789\ny", ["ssn", "123456789"]],
    ["body line shaped like a script frame", "x\nsecret-john.ts:5\ny", ["secret-john", "secret-john.ts:5"]],
  ])("never echoes a real JSON.parse error for a %s", (_name, input, seeds) => {
    const { message, frames } = scrubError(parseError(input), "promise");
    for (const seed of seeds) {
      expect(message).not.toContain(seed);
      expect(frames).not.toContain(seed);
    }
    expect(message).not.toContain("\n");
  });

  it.each([
    [`Unexpected token 'h', "hunter2 password" is not valid JSON`, "Unexpected token [redacted], [redacted] is not valid JSON"],
    [`Unexpected token 'a', "abc\ndef ghi secret" is not valid JSON`, "Unexpected token [redacted], [redacted] is not valid JSON"],
    ["Script error.", "Script error."],
    [`Unexpected token 'x', "xxxxxxxxxx"... is not valid JSON`, "Unexpected token [redacted], [redacted] is not valid JSON"],
    ["Unexpected non-whitespace character after JSON at position 7 (line 1 column 8)", "Unexpected non-whitespace character after JSON at position 7 (line 1 column 8)"],
    ["Cannot read properties of undefined (reading 'johnSecret')", "Cannot read properties of undefined (reading [redacted])"],
    ["johnSecret is not defined", "[redacted] is not defined"],
    ["Failed to fetch", "Failed to fetch"],
    [
      "Minified React error #418; visit https://react.dev/errors/418?args[]=secret for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
      "Minified React error #418; visit [redacted] for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
    ],
  ])("rebuilds the known shape %j from literals only", (message, expected) => {
    expect(scrub(message).message).toBe(expected);
  });

  it("keeps only known error names", () => {
    const custom = new Error("x");
    custom.name = "sk-live-12345678Error";
    expect(scrubError(custom, "window")).toMatchObject({
      type: "Error",
      message: WITHHELD,
    });
    const typeError = new TypeError("Failed to fetch");
    expect(scrubError(typeError, "window")).toMatchObject({
      type: "TypeError",
      message: "Failed to fetch",
    });
    expect(scrubError(new RangeError("john"), "window").message).toBe(
      "RangeError: [message withheld]",
    );
  });

  it("keeps only file:line for plain script frames and hides token-like names", () => {
    const stack = [
      "Error: x",
      "    at fn (https://acme.com/_next/static/a.js?v=1:12:34)",
      "    at b@https://acme.com/b.js:5:6",
      "    at https://host/a/MYSECRETTOKEN?x=1:1:2",
    ].join("\n");
    expect(scrub("x", stack).frames).toBe("a.js:12\nb.js:5\n<anon>:1");
  });

  it("drops a multi-line V8 header and keeps the first frame of headerless stacks", () => {
    const message = "head\nleak.ts:9\ntail";
    const v8Stack = `Error: ${message}\n    at fn (https://acme.com/a.js:3:4)`;
    expect(scrub(message, v8Stack).frames).toBe("a.js:3");
    const safariStack = "fn@https://acme.com/a.js:3:4\nglobal code@https://acme.com/b.js:7:1";
    expect(scrub("x", safariStack).frames).toBe("a.js:3\nb.js:7");
  });

  it("handles non-Error values, thrown strings and huge input", () => {
    expect(scrubError({ a: 1 }, "promise").message).toBe("Non-Error value thrown");
    expect(scrubError("token=abc123", "promise").message).toBe(WITHHELD);
    expect(scrub("a".repeat(5000)).message).toBe(WITHHELD);
  });
});
