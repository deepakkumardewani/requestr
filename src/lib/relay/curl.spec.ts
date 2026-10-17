import { describe, expect, it } from "vitest";
import type { AuthConfig, BodyConfig, KVPair } from "@/types";
import {
  buildCurl,
  CURL_MAX_CHARS,
  type CurlDraft,
  parseCurl,
  templateSecrets,
} from "./curl";
import { buildRedactContext, REDACTED } from "./redact";

const parseOk = (text: string) => {
  const result = parseCurl(text);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.draft;
};
const parseError = (text: string) => {
  const result = parseCurl(text);
  if (result.ok) throw new Error("expected an error");
  return result.error;
};

describe("parseCurl", () => {
  it("parses a sample curl into method, url, headers and body", () => {
    const draft = parseOk(
      `curl -X POST 'https://api.example.test/users' -H 'Content-Type: application/json' -H "Accept: text/plain" -d '{"name":"ada"}'`,
    );
    expect(draft).toEqual({
      method: "POST",
      url: "https://api.example.test/users",
      headers: [
        { key: "Content-Type", value: "application/json" },
        { key: "Accept", value: "text/plain" },
      ],
      body: { type: "json", content: '{"name":"ada"}' },
      basicAuth: null,
    });
  });

  it("defaults to GET without data and POST with data", () => {
    expect(parseOk("curl https://a.test/x").method).toBe("GET");
    expect(parseOk("curl https://a.test/x -d a=1").method).toBe("POST");
  });

  it("uses HEAD for -I and --head unless a method is given", () => {
    expect(parseOk("curl -I https://a.test").method).toBe("HEAD");
    expect(parseOk("curl --head https://a.test").method).toBe("HEAD");
    expect(parseOk("curl -I -X get https://a.test").method).toBe("GET");
  });

  it("joins backslash-continued lines and is case-insensitive on the command", () => {
    const draft = parseOk("CURL \\\n  -X PUT \\\r\n  https://a.test/x");
    expect(draft.method).toBe("PUT");
    expect(draft.url).toBe("https://a.test/x");
  });

  it("accepts attached short flags and = long flags", () => {
    const draft = parseOk(
      "curl -XPATCH --header=X-One:1 -HX-Two:2 --url=https://a.test/p",
    );
    expect(draft.method).toBe("PATCH");
    expect(draft.url).toBe("https://a.test/p");
    expect(draft.headers).toEqual([
      { key: "X-One", value: "1" },
      { key: "X-Two", value: "2" },
    ]);
  });

  it("takes the url from --url and keeps the first positional url otherwise", () => {
    expect(parseOk("curl --url https://a.test/one").url).toBe("https://a.test/one");
    expect(parseOk("curl https://a.test/first https://a.test/second").url).toBe(
      "https://a.test/first",
    );
  });

  it("reads cookies, user agent and basic auth", () => {
    const draft = parseOk(
      "curl https://a.test -b 'a=1' -A 'tester/1' -u ada:pw:with:colons",
    );
    expect(draft.headers).toEqual([
      { key: "Cookie", value: "a=1" },
      { key: "User-Agent", value: "tester/1" },
    ]);
    expect(draft.basicAuth).toEqual({ username: "ada", password: "pw:with:colons" });
  });

  it("allows basic auth without a password", () => {
    expect(parseOk("curl https://a.test --user ada").basicAuth).toEqual({
      username: "ada",
      password: "",
    });
  });

  it("joins repeated data flags with & and infers the body type", () => {
    const form = parseOk(
      "curl https://a.test -H 'content-type: application/x-www-form-urlencoded' --data-raw a=1 --data-urlencode b=2",
    );
    expect(form.body).toEqual({ type: "urlencoded", content: "a=1&b=2" });
    const jsonByHeader = parseOk(
      "curl https://a.test -H 'Content-Type: application/vnd.api+json' --data-binary 'nope'",
    );
    expect(jsonByHeader.body?.type).toBe("json");
    expect(parseOk("curl https://a.test -d '[1,2]'").body?.type).toBe("json");
    expect(parseOk("curl https://a.test --data-ascii hello").body).toEqual({
      type: "text",
      content: "hello",
    });
  });

  it("skips ignored value flags and unknown boolean flags with their values", () => {
    const draft = parseOk(
      "curl -s -L --compressed -o out.txt --max-time 5 https://a.test/x",
    );
    expect(draft.url).toBe("https://a.test/x");
    expect(draft.method).toBe("GET");
  });

  it("honours quote and escape rules", () => {
    const draft = parseOk(
      `curl https://a.test -H 'X-Q: it\\ stays' -H "X-D: say \\"hi\\"" -H X-E:a\\ b`,
    );
    expect(draft.headers).toEqual([
      { key: "X-Q", value: "it\\ stays" },
      { key: "X-D", value: 'say "hi"' },
      { key: "X-E", value: "a b" },
    ]);
  });

  it("treats a trailing backslash as a literal character", () => {
    expect(parseOk("curl https://a.test/x\\").url).toBe("https://a.test/x\\");
  });

  it("accepts templated urls and websocket schemes", () => {
    expect(parseOk("curl '{{baseUrl}}/users'").url).toBe("{{baseUrl}}/users");
    expect(parseOk("curl wss://a.test").url).toBe("wss://a.test");
  });

  it.each([
    ["", "the command must start with curl"],
    ["   ", "the command must start with curl"],
    ["wget https://a.test", "the command must start with curl"],
    ["curl 'https://a.test", "unbalanced quotes in the command"],
    ["curl -X", "missing value for -X"],
    ["curl -X TEACH https://a.test", "unsupported method: TEACH"],
    ["curl -H nocolon https://a.test", "malformed header: nocolon"],
    ["curl -H ':novalue' https://a.test", "malformed header: :novalue"],
    ["curl -H ' : x' https://a.test", "malformed header:  : x"],
    ["curl -s", "no URL found in the command"],
    ["curl ftp://a.test/file", "unsupported URL: ftp://a.test/file"],
  ])("returns a structured error for %j", (input, error) => {
    expect(parseCurl(input)).toEqual({ ok: false, error });
  });

  it("rejects input over the length cap", () => {
    expect(parseError(`curl https://a.test/${"a".repeat(CURL_MAX_CHARS)}`)).toBe(
      "the curl command is too long",
    );
  });
});

describe("templateSecrets", () => {
  const draft = (overrides: Partial<CurlDraft>): CurlDraft => ({
    method: "GET",
    url: "https://a.test",
    headers: [],
    body: null,
    basicAuth: null,
    ...overrides,
  });

  it("replaces a literal bearer token, keeping the scheme, and lists the variable", () => {
    const out = templateSecrets(
      draft({
        headers: [
          { key: "Authorization", value: "Bearer abcdef123456" },
          { key: "Accept", value: "application/json" },
        ],
      }),
    );
    expect(out.draft.headers).toEqual([
      { key: "Authorization", value: "Bearer {{Authorization}}" },
      { key: "Accept", value: "application/json" },
    ]);
    expect(out.needsValue).toEqual(["Authorization"]);
  });

  it("leaves a header that is already a variable reference", () => {
    const out = templateSecrets(
      draft({ headers: [{ key: "Authorization", value: "Bearer {{token}}" }] }),
    );
    expect(out.draft.headers[0].value).toBe("Bearer {{token}}");
    expect(out.needsValue).toEqual([]);
  });

  it("names variables from the header, replacing non-word characters", () => {
    const out = templateSecrets(
      draft({ headers: [{ key: "X-Api-Key", value: "abc" }] }),
    );
    expect(out.draft.headers[0].value).toBe("{{X_Api_Key}}");
    expect(out.needsValue).toEqual(["X_Api_Key"]);
  });

  it("templates a basic auth password but keeps the username", () => {
    const out = templateSecrets(
      draft({ basicAuth: { username: "ada", password: "hunter2-correct-horse" } }),
    );
    expect(out.draft.basicAuth).toEqual({
      username: "ada",
      password: "{{basic_password}}",
    });
    expect(out.needsValue).toEqual(["basic_password"]);
  });

  it("keeps an empty basic auth password empty", () => {
    const out = templateSecrets(
      draft({ basicAuth: { username: "ada", password: "" } }),
    );
    expect(out.draft.basicAuth).toEqual({ username: "ada", password: "" });
    expect(out.needsValue).toEqual([]);
  });

  it("templates secret query parameters and leaves the rest", () => {
    const out = templateSecrets(
      draft({
        url: "https://a.test/v1?access_token=abc123&page=2&key=zzz&flag&token={{t}}",
      }),
    );
    expect(out.draft.url).toBe(
      "https://a.test/v1?access_token={{access_token}}&page=2&key={{key}}&flag&token={{t}}",
    );
    expect(out.needsValue).toEqual(["access_token", "key"]);
  });

  it("returns a url without a query unchanged and lists each variable once", () => {
    const plain = templateSecrets(draft({ url: "https://a.test/x" }));
    expect(plain.draft.url).toBe("https://a.test/x");
    const twice = templateSecrets(
      draft({
        url: "https://a.test/?token=aaa",
        headers: [{ key: "token", value: "bbb" }],
      }),
    );
    expect(twice.needsValue).toEqual(["token"]);
  });

  it("lists header variables before query variables", () => {
    const out = templateSecrets(
      draft({
        headers: [{ key: "Authorization", value: "abc" }],
        url: "https://a.test/?key=abc",
      }),
    );
    expect(out.needsValue).toEqual(["Authorization", "key"]);
  });
});

describe("buildCurl", () => {
  const kv = (key: string, value: string, enabled = true): KVPair => ({
    id: key,
    key,
    value,
    enabled,
  });
  const base = {
    method: "GET" as const,
    url: "https://a.test/x",
    headers: [] as KVPair[],
    body: { type: "none", content: "" } as BodyConfig,
    auth: { type: "none" } as AuthConfig,
  };

  it("builds a minimal command", () => {
    expect(buildCurl(base)).toBe("curl -X GET 'https://a.test/x'");
  });

  it("includes enabled headers only and redacts secret ones", () => {
    const out = buildCurl({
      ...base,
      headers: [
        kv("Accept", "application/json"),
        kv("Cookie", "session=abc123def456ghi789"),
        kv("X-Off", "off", false),
      ],
    });
    expect(out).toBe(
      `curl -X GET 'https://a.test/x' -H 'Accept: application/json' -H 'Cookie: ${REDACTED}'`,
    );
  });

  it("renders every auth type without its secret", () => {
    expect(buildCurl({ ...base, auth: { type: "bearer", token: "tok-live-123456" } })).toBe(
      `curl -X GET 'https://a.test/x' -H 'Authorization: Bearer ${REDACTED}'`,
    );
    expect(
      buildCurl({ ...base, auth: { type: "basic", username: "ada", password: "pw-secret-1" } }),
    ).toBe(`curl -X GET 'https://a.test/x' -u 'ada:${REDACTED}'`);
    expect(
      buildCurl({ ...base, auth: { type: "api-key", key: "X-Key", value: "v-secret-1", addTo: "header" } }),
    ).toBe(`curl -X GET 'https://a.test/x' -H 'X-Key: ${REDACTED}'`);
  });

  it("puts a query api key in the url as [redacted], joining with ? or &", () => {
    const auth: AuthConfig = { type: "api-key", key: "api_key", value: "v-secret-1", addTo: "query" };
    const plain = buildCurl({ ...base, auth });
    expect(plain).not.toContain("v-secret-1");
    expect(plain).toContain(`https://a.test/x?api_key=${REDACTED}`);
    expect(buildCurl({ ...base, url: "https://a.test/x?a=1", auth })).toContain(
      `https://a.test/x?a=1&api_key=${REDACTED}`,
    );
  });

  it("redacts tokens in the url and secret fields in the body", () => {
    const out = buildCurl({
      ...base,
      method: "POST",
      url: "https://a.test/x?access_token=abc123&page=2",
      body: { type: "json", content: '{"user":"ada","password":"hunter2-correct-horse"}' },
    });
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("hunter2-correct-horse");
    expect(out).toContain("page=2");
    expect(out).toContain("--data-raw");
    expect(out).toContain('"user": "ada"');
  });

  it("omits the body for none and for empty content", () => {
    expect(buildCurl({ ...base, body: { type: "json", content: "" } })).not.toContain("--data-raw");
    expect(buildCurl({ ...base, body: { type: "none", content: "x" } })).not.toContain("--data-raw");
  });

  it("escapes single quotes for the shell", () => {
    const out = buildCurl({ ...base, headers: [kv("X-Note", "it's fine")] });
    expect(out).toContain(`-H 'X-Note: it'\\''s fine'`);
  });

  it("scrubs a resolved environment secret using the supplied context", () => {
    const context = buildRedactContext([
      {
        id: "e",
        name: "E",
        createdAt: 0,
        updatedAt: 0,
        variables: [
          { id: "v", key: "token", initialValue: "", currentValue: "plain-env-secret-value-9981", isSecret: true },
        ],
      },
    ]);
    const out = buildCurl(
      { ...base, headers: [kv("X-Trace", "plain-env-secret-value-9981")] },
      context,
    );
    expect(out).not.toContain("plain-env-secret-value-9981");
    expect(out).toContain("{{token}}");
  });
});
