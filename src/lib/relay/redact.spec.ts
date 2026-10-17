import { describe, expect, it } from "vitest";
import type { EnvironmentModel, KVPair } from "@/types";
import {
  buildRedactContext,
  DEFAULT_REDACT_CONTEXT,
  hasUnredactedSecret,
  isSensitiveName,
  REDACTED,
  redactBody,
  redactDeep,
  redactEnvironment,
  redactHeaders,
  redactUrl,
  redactValue,
} from "./redact";
import { buildCurl } from "./curl";
import {
  BASIC_CREDENTIALS,
  CURL_CORPUS,
  ENV_SECRET_VALUE,
  PLAIN_PASSWORD,
  SESSION_COOKIE,
  TOKEN_SHAPE_CORPUS,
} from "./redact.corpus";

const env: EnvironmentModel = {
  id: "env-1",
  name: "Staging",
  createdAt: 0,
  updatedAt: 0,
  variables: [
    {
      id: "v1",
      key: "token",
      initialValue: "",
      currentValue: ENV_SECRET_VALUE,
      isSecret: true,
    },
    {
      id: "v2",
      key: "baseUrl",
      initialValue: "https://api.example.test",
      currentValue: "https://api.example.test",
      isSecret: false,
    },
  ],
};

const kv = (key: string, value: string): KVPair => ({
  id: key,
  key,
  value,
  enabled: true,
});

describe("redactValue", () => {
  it.each(TOKEN_SHAPE_CORPUS)("redacts a $name anywhere in text", ({ secret }) => {
    const out = redactValue(`prefix ${secret} suffix`);
    expect(out).not.toContain(secret);
    expect(out).toContain(REDACTED);
  });

  it("redacts bearer and basic credentials but keeps the scheme", () => {
    expect(redactValue("Bearer abcdef123456")).toBe(`Bearer ${REDACTED}`);
    expect(redactValue(`Basic ${BASIC_CREDENTIALS}`)).toBe(`Basic ${REDACTED}`);
  });

  it("keeps variable references", () => {
    expect(redactValue("Bearer {{token}}")).toBe("Bearer {{token}}");
    expect(redactValue("password={{pw}}")).toBe("password={{pw}}");
  });

  it("redacts url userinfo passwords", () => {
    expect(redactValue(`https://me:${PLAIN_PASSWORD}@host.test/x`)).toBe(
      `https://me:${REDACTED}@host.test/x`,
    );
  });

  it("redacts secret-named pairs in plain text", () => {
    const out = redactValue(`password=${PLAIN_PASSWORD}&name=ada`);
    expect(out).toBe(`password=${REDACTED}&name=ada`);
  });

  it("replaces a known resolved secret with its variable name", () => {
    const context = buildRedactContext([env]);
    expect(redactValue(`x-${ENV_SECRET_VALUE}-y`, context)).toBe("x-{{token}}-y");
  });

  it("is idempotent", () => {
    const once = redactValue(`Bearer abcdef123456 ${TOKEN_SHAPE_CORPUS[0].secret}`);
    expect(redactValue(once)).toBe(once);
  });
});

describe("redactHeaders", () => {
  it("redacts Authorization, Cookie and Set-Cookie values", () => {
    const out = redactHeaders([
      kv("Authorization", "Bearer abcdef123456"),
      kv("Cookie", SESSION_COOKIE),
      kv("Set-Cookie", SESSION_COOKIE),
      kv("Accept", "application/json"),
    ]);
    expect(out.map((h) => h.value)).toEqual([
      REDACTED,
      REDACTED,
      REDACTED,
      "application/json",
    ]);
  });

  it("keeps a header that is only a variable reference", () => {
    const out = redactHeaders([kv("Authorization", "Bearer {{token}}")]);
    expect(out[0].value).toBe("Bearer {{token}}");
  });

  it("redacts a literal behind a scheme word that also holds a variable", () => {
    const out = redactHeaders([kv("Authorization", "{{prefix}} literalsecret")]);
    expect(out[0].value).toBe(REDACTED);
  });

  it("redacts token shapes in non-sensitive headers", () => {
    const out = redactHeaders({
      "X-Custom": TOKEN_SHAPE_CORPUS[1].secret,
      "x-api-key": "abc",
    });
    expect(out["X-Custom"]).toBe(REDACTED);
    expect(out["x-api-key"]).toBe(REDACTED);
  });
});

describe("redactUrl", () => {
  it("redacts secret query params and keeps the rest", () => {
    const out = redactUrl(
      `https://api.test/v1?api_key=${PLAIN_PASSWORD}&page=2&token={{t}}`,
    );
    expect(out).toBe(`https://api.test/v1?api_key=${REDACTED}&page=2&token={{t}}`);
  });

  it.each(TOKEN_SHAPE_CORPUS)("redacts a $name placed in a neutral param", ({ secret }) => {
    expect(redactUrl(`https://api.test/?ref=${secret}`)).not.toContain(secret);
  });

  it("redacts url-encoded param names and fragments", () => {
    expect(redactUrl("https://a.test/?access%5Ftoken=abc#frag")).toBe(
      `https://a.test/?access%5Ftoken=${REDACTED}#frag`,
    );
    expect(redactUrl(`https://a.test/#t=${TOKEN_SHAPE_CORPUS[0].secret}`)).not.toContain(
      TOKEN_SHAPE_CORPUS[0].secret,
    );
  });

  it("handles templated and query-less urls", () => {
    expect(redactUrl("{{baseUrl}}/users")).toBe("{{baseUrl}}/users");
    expect(redactUrl("https://a.test/?flag")).toBe("https://a.test/?flag");
  });

  it("redacts userinfo", () => {
    expect(redactUrl(`https://u:${PLAIN_PASSWORD}@a.test/`)).toBe(
      `https://u:${REDACTED}@a.test/`,
    );
  });
});

describe("redactBody", () => {
  it("redacts secret-named fields and token shapes in JSON", () => {
    const body = JSON.stringify({
      user: "ada",
      password: PLAIN_PASSWORD,
      nested: { note: TOKEN_SHAPE_CORPUS[0].secret, access_token: "abc" },
      ref: "{{token}}",
    });
    const out = redactBody(body);
    expect(out).not.toContain(PLAIN_PASSWORD);
    expect(out).not.toContain(TOKEN_SHAPE_CORPUS[0].secret);
    const parsed = JSON.parse(out);
    expect(parsed.user).toBe("ada");
    expect(parsed.nested.access_token).toBe(REDACTED);
    expect(parsed.ref).toBe("{{token}}");
  });

  it("falls back to text patterns for non-JSON bodies", () => {
    expect(redactBody(`grant=1&client_secret=${PLAIN_PASSWORD}`)).toBe(
      `grant=1&client_secret=${REDACTED}`,
    );
    expect(redactBody("42")).toBe("42");
  });

  it("scrubs a known resolved secret from a body", () => {
    const context = buildRedactContext([env]);
    expect(redactBody(`{"a":"${ENV_SECRET_VALUE}"}`, context)).toContain("{{token}}");
  });
});

describe("redactEnvironment", () => {
  it("never exposes a secret value and hides others by default", () => {
    const out = redactEnvironment(env);
    expect(JSON.stringify(out)).not.toContain(ENV_SECRET_VALUE);
    expect(out.variables).toEqual([
      { key: "token", isSecret: true },
      { key: "baseUrl", isSecret: false },
    ]);
  });

  it("exposes only non-secret values when shareValues is on", () => {
    const out = redactEnvironment(env, buildRedactContext([env], true));
    expect(out.variables[1].value).toBe("https://api.example.test");
    expect(out.variables[0]).not.toHaveProperty("value");
  });

  it("still pattern-redacts a shared non-secret value", () => {
    const sneaky: EnvironmentModel = {
      ...env,
      variables: [
        {
          id: "v",
          key: "note",
          initialValue: "",
          currentValue: TOKEN_SHAPE_CORPUS[0].secret,
          isSecret: false,
        },
      ],
    };
    const out = redactEnvironment(sneaky, buildRedactContext([sneaky], true));
    expect(out.variables[0].value).toBe(REDACTED);
  });
});

describe("buildRedactContext", () => {
  it("defaults shareValues to false and only collects secrets", () => {
    const context = buildRedactContext([env]);
    expect(context.shareValues).toBe(false);
    expect(context.secrets.map((s) => s.name)).toEqual(["token"]);
  });

  it("skips values too short to scrub safely", () => {
    const short: EnvironmentModel = {
      ...env,
      variables: [{ id: "s", key: "pin", initialValue: "1", currentValue: "", isSecret: true }],
    };
    expect(buildRedactContext([short]).secrets).toEqual([]);
  });

  it("the default context shares nothing", () => {
    expect(DEFAULT_REDACT_CONTEXT.shareValues).toBe(false);
  });
});

describe("redactDeep and hasUnredactedSecret", () => {
  it("redacts secret key/value pairs and secret-named fields", () => {
    const out = redactDeep({
      headers: [kv("Authorization", "Bearer abcdef123456")],
      auth: { type: "basic", password: PLAIN_PASSWORD },
      count: 3,
      flag: true,
      nothing: null,
    });
    expect(JSON.stringify(out)).not.toContain(PLAIN_PASSWORD);
    expect(out.headers[0].value).toBe(REDACTED);
    expect(out.count).toBe(3);
    expect(out.nothing).toBeNull();
  });

  it("stops at excessive depth instead of recursing forever", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 40; i += 1) deep = { next: deep };
    expect(JSON.stringify(redactDeep(deep))).toContain(REDACTED);
  });

  it("detects a leaked secret and passes clean data", () => {
    expect(hasUnredactedSecret({ a: TOKEN_SHAPE_CORPUS[1].secret })).toBe(true);
    expect(hasUnredactedSecret({ a: "Bearer {{token}}", b: REDACTED })).toBe(false);
  });
});

describe("isSensitiveName", () => {
  it("matches secret names regardless of case and separators", () => {
    for (const name of ["Authorization", "x-api-key", "client_secret", "refreshToken", "PASSWORD"]) {
      expect(isSensitiveName(name)).toBe(true);
    }
  });

  it("does not match ordinary names", () => {
    for (const name of ["name", "tokenVar", "author", "method"]) {
      expect(isSensitiveName(name)).toBe(false);
    }
  });
});

describe("curl export over the redact corpus", () => {
  it.each(CURL_CORPUS)("never lets the $name reach the curl text", (sample) => {
    const out = buildCurl({
      method: "POST",
      url: sample.url,
      headers: sample.headers.map((h) => kv(h.key, h.value)),
      body: { type: "json", content: sample.body },
      auth: { type: "none" },
    });
    expect(out).not.toContain(sample.secret);
    expect(out).toContain(REDACTED);
  });
});
