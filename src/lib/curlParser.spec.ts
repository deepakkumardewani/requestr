import { describe, expect, it } from "vitest";
import { CurlParseError, parseCurl } from "./curlParser";

describe("parseCurl", () => {
  it("parses GET with URL and infers method", () => {
    const out = parseCurl(`curl 'https://example.com/path'`);
    expect(out.method).toBe("GET");
    expect(out.url).toBe("https://example.com/path");
    expect(out.body.type).toBe("none");
  });

  it("parses -X POST and JSON body with content-type", () => {
    const out = parseCurl(
      `curl -X POST 'https://api.test/x' -H 'Content-Type: application/json' -d '{"a":1}'`
    );
    expect(out.method).toBe("POST");
    expect(out.body).toEqual({ type: "json", content: '{"a":1}' });
  });

  it("infers POST when body present without explicit method", () => {
    const out = parseCurl(`curl 'https://x.test' -d 'plain'`);
    expect(out.method).toBe("POST");
    expect(out.body.type).toBe("text");
  });

  it("parses -H headers and Bearer from Authorization", () => {
    const out = parseCurl(
      `curl 'https://x.test' -H 'Authorization: Bearer tok' -H 'X-Custom: 1'`
    );
    expect(out.auth).toEqual({ type: "bearer", token: "tok" });
    expect(out.headers.map((h) => [h.key, h.value])).toEqual([["Authorization", "Bearer tok"], ["X-Custom", "1"]]);
  });

  it("parses basic auth -u user:pass", () => {
    const out = parseCurl(`curl -u 'alice:secret' 'https://x.test'`);
    expect(out.auth).toEqual({
      type: "basic",
      username: "alice",
      password: "secret",
    });
  });

  it("parses --data-urlencode into urlencoded body", () => {
    const out = parseCurl(
      `curl 'https://x.test' --data-urlencode 'a=b' --data-urlencode 'c=d'`
    );
    expect(out.body.type).toBe("urlencoded");
    expect(out.body.content).toBe("a=b&c=d");
    expect(out.body.formData?.map((f) => [f.key, f.value])).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("joins line continuations", () => {
    const out = parseCurl(`curl https://a.test \\
  -H 'X: 1'`);
    expect(out.url).toBe("https://a.test");
  });

  it("respects boolean flags without consuming next token as URL", () => {
    const out = parseCurl(`curl -L -k https://secure.test`);
    expect(out.url).toBe("https://secure.test");
  });

  it("throws when input does not start with curl", () => {
    expect(() => parseCurl(`wget x`)).toThrow(CurlParseError);
  });

  it("throws on unknown method", () => {
    expect(() => parseCurl(`curl -X TEAPOT https://x.test`)).toThrow(
      CurlParseError
    );
  });

  it("throws when URL missing", () => {
    expect(() => parseCurl(`curl -X GET`)).toThrow(CurlParseError);
  });

  it("throws on malformed header", () => {
    expect(() => parseCurl(`curl https://x.test -H 'BadHeader'`)).toThrow(
      CurlParseError
    );
  });

  describe("flags that change method, body or URL", () => {
    it("treats -F before the URL as a form field, not the URL", () => {
      const out = parseCurl(`curl -F 'a=b' https://x.test`);
      expect(out.url).toBe("https://x.test");
      expect(out.method).toBe("POST");
      expect(out.body.type).toBe("form-data");
      expect(out.body.formData?.map((f) => [f.key, f.value])).toEqual([
        ["a", "b"],
      ]);
    });

    it("parses repeated --form after the URL into form-data fields", () => {
      const out = parseCurl(`curl https://x.test --form 'a=b' -F 'c=d'`);
      expect(out.method).toBe("POST");
      expect(out.body.formData?.map((f) => [f.key, f.value])).toEqual([
        ["a", "b"],
        ["c", "d"],
      ]);
    });

    it("keeps -F key=@file as a literal text field", () => {
      const out = parseCurl(`curl https://x.test -F 'f=@a.png'`);
      expect(out.body.formData?.map((f) => [f.key, f.value])).toEqual([
        ["f", "@a.png"],
      ]);
    });

    it("treats --json before the URL as the body, not the URL", () => {
      const out = parseCurl(`curl --json '{"a":1}' https://x.test`);
      expect(out.url).toBe("https://x.test");
      expect(out.body).toEqual({ type: "json", content: '{"a":1}' });
    });

    it("--json defaults to POST and adds JSON Content-Type and Accept", () => {
      const out = parseCurl(`curl https://x.test --json '{"a":1}'`);
      expect(out.method).toBe("POST");
      expect(out.body).toEqual({ type: "json", content: '{"a":1}' });
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([
        ["Content-Type", "application/json"],
        ["Accept", "application/json"],
      ]);
    });

    it("--json keeps user-supplied Content-Type/Accept in any case", () => {
      const out = parseCurl(
        `curl https://x.test -H 'content-type: application/vnd.api+json' -H 'ACCEPT: text/plain' --json '{}'`
      );
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([
        ["content-type", "application/vnd.api+json"],
        ["ACCEPT", "text/plain"],
      ]);
    });

    it("-G moves -d data into the query string and uses GET", () => {
      const out = parseCurl(`curl -G https://x.test -d 'a=1' -d 'b=2'`);
      expect(out.method).toBe("GET");
      expect(out.url).toBe("https://x.test?a=1&b=2");
      expect(out.body).toEqual({ type: "none", content: "" });
    });

    it("-G appends to an existing query and encodes --data-urlencode", () => {
      const out = parseCurl(
        `curl --get 'https://x.test?z=0' --data-urlencode 'q=a b'`
      );
      expect(out.url).toBe("https://x.test?z=0&q=a%20b");
      expect(out.method).toBe("GET");
    });

    it("-I sets HEAD", () => {
      const out = parseCurl(`curl -I https://x.test`);
      expect(out.method).toBe("HEAD");
      expect(out.url).toBe("https://x.test");
    });

    it("--head sets HEAD", () => {
      expect(parseCurl(`curl --head https://x.test`).method).toBe("HEAD");
    });

    it("an explicit -X wins over -I", () => {
      expect(parseCurl(`curl -I -X GET https://x.test`).method).toBe("GET");
    });

    it("reads the URL from --url because it is the first bare token", () => {
      expect(parseCurl(`curl --url https://x.test`).url).toBe("https://x.test");
    });

    it("turns -b into a Cookie header", () => {
      const out = parseCurl(`curl https://x.test -b 'k=v; a=b'`);
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([
        ["Cookie", "k=v; a=b"],
      ]);
    });

    it("turns --cookie into a Cookie header", () => {
      const out = parseCurl(`curl --cookie 'k=v' https://x.test`);
      expect(out.url).toBe("https://x.test");
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([
        ["Cookie", "k=v"],
      ]);
    });

    it("keeps -d @file as the literal text '@file.json' without reading the file", () => {
      const out = parseCurl(`curl https://x.test -d @file.json`);
      expect(out.method).toBe("POST");
      expect(out.body).toEqual({ type: "text", content: "@file.json" });
    });

    it("joins several -d values with &", () => {
      const out = parseCurl(`curl https://x.test -d 'a=1' -d 'b=2'`);
      expect(out.body).toEqual({ type: "text", content: "a=1&b=2" });
    });

    it("recognises the attached -XPOST form", () => {
      expect(parseCurl(`curl -XPOST https://x.test`).method).toBe("POST");
    });

    it("recognises --request=PUT", () => {
      expect(parseCurl(`curl --request=PUT https://x.test`).method).toBe("PUT");
    });

    it("never treats the value of an ignored value flag as the URL", () => {
      const out = parseCurl(`curl -o out.txt -A agent https://x.test`);
      expect(out.url).toBe("https://x.test");
    });

    it("drops -d bodies when --data-urlencode is also present", () => {
      const out = parseCurl(
        `curl https://x.test -d 'a' --data-urlencode 'b=c'`
      );
      expect(out.body.type).toBe("urlencoded");
      expect(out.body.content).toBe("b=c");
    });
  });

  describe("body flags", () => {
    it("treats --data-binary as a text body and infers POST", () => {
      const out = parseCurl(`curl https://x.test --data-binary 'raw'`);
      expect(out.method).toBe("POST");
      expect(out.body).toEqual({ type: "text", content: "raw" });
    });

    it.each(["--data", "--data-raw"])("accepts %s as a body flag", (flag) => {
      const out = parseCurl(`curl https://x.test ${flag} 'v'`);
      expect(out.body).toEqual({ type: "text", content: "v" });
    });

    it("detects a JSON body without a content-type header", () => {
      const out = parseCurl(`curl https://x.test -d '{"a":1}'`);
      expect(out.body).toEqual({ type: "json", content: '{"a":1}' });
    });

    it("maps an xml content-type to an xml body", () => {
      const out = parseCurl(
        `curl https://x.test -H 'Content-Type: application/xml' -d '<a/>'`
      );
      expect(out.body).toEqual({ type: "xml", content: "<a/>" });
    });

    it("maps a form content-type to a urlencoded body without formData", () => {
      const out = parseCurl(
        `curl https://x.test -H 'Content-Type: application/x-www-form-urlencoded' -d 'a=1'`
      );
      expect(out.body).toEqual({ type: "urlencoded", content: "a=1" });
    });

    it("percent-encodes --data-urlencode content and splits key from value at the first =", () => {
      const out = parseCurl(
        `curl https://x.test --data-urlencode 'a b=c=d' --data-urlencode 'flag'`
      );
      expect(out.body.content).toBe("a%20b=c%3Dd&flag=");
      expect(out.body.formData?.map((f) => [f.key, f.value])).toEqual([
        ["a b", "c=d"],
        ["flag", ""],
      ]);
    });
  });

  describe("quoting and escapes", () => {
    it("unescapes backslash-escaped double quotes inside a double-quoted token", () => {
      const out = parseCurl(`curl https://x.test -d "say \\"hi\\""`);
      expect(out.body.content).toBe('say "hi"');
    });

    it("keeps everything after the first colon as the header value", () => {
      const out = parseCurl(`curl 'https://x.test' -H 'A: b: c'`);
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([["A", "b: c"]]);
    });

    it("reads the URL from a double-quoted token", () => {
      expect(parseCurl(`curl "https://x.test/p?a=1&b=2"`).url).toBe(
        "https://x.test/p?a=1&b=2"
      );
    });

    it("joins CRLF line continuations", () => {
      const out = parseCurl("curl https://a.test \\\r\n  -H 'X: 1'");
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([["X", "1"]]);
    });
  });

  describe("headers and auth edge cases", () => {
    it("throws for an empty -H value", () => {
      expect(() => parseCurl(`curl https://x.test -H ''`)).toThrow(
        "Missing header value after -H"
      );
    });

    it("throws when -H is the last token", () => {
      expect(() => parseCurl(`curl https://x.test -H`)).toThrow(
        "Missing header value after -H"
      );
    });

    it("parses -u with no colon as a username with empty password", () => {
      expect(parseCurl(`curl -u alice https://x.test`).auth).toEqual({
        type: "basic",
        username: "alice",
        password: "",
      });
    });

    it("truncates a password containing a colon at the second colon", () => {
      expect(parseCurl(`curl -u a:b:c https://x.test`).auth).toEqual({
        type: "basic",
        username: "a",
        password: "b",
      });
    });

    it("leaves auth as none for a non-Bearer Authorization header but keeps the header", () => {
      const out = parseCurl(
        `curl https://x.test -H 'Authorization: Basic abc'`
      );
      expect(out.auth).toEqual({ type: "none" });
      expect(out.headers.map((h) => [h.key, h.value])).toEqual([
        ["Authorization", "Basic abc"],
      ]);
    });

    it("prefers -u over an Authorization Bearer header", () => {
      const out = parseCurl(
        `curl -u a:b https://x.test -H 'Authorization: Bearer t'`
      );
      expect(out.auth).toEqual({ type: "basic", username: "a", password: "b" });
    });
  });
});
