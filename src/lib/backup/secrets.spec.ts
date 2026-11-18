import { describe, expect, it } from "vitest";
import { REDACTED_VALUE } from "./constants";
import type { BackupData } from "./schema";
import { SECRET_HEADER_NAMES, applySecretPolicy } from "./secrets";

const S = {
  reqBearer: "SENTINEL_REQ_BEARER",
  reqBasic: "SENTINEL_REQ_BASIC",
  reqApiKey: "SENTINEL_REQ_APIKEY",
  reqHeader: "SENTINEL_REQ_HEADER",
  envInitial: "SENTINEL_ENV_INITIAL",
  envCurrent: "SENTINEL_ENV_CURRENT",
  chainBearer: "SENTINEL_CHAIN_BEARER",
  chainHeader: "SENTINEL_CHAIN_HEADER",
  histBasic: "SENTINEL_HIST_BASIC",
  histHeader: "SENTINEL_HIST_HEADER",
  histRespAuth: "SENTINEL_HIST_RESP_AUTHORIZATION",
  histRespCookie: "SENTINEL_HIST_RESP_COOKIE",
  histRespSetCookie: "SENTINEL_HIST_RESP_SETCOOKIE",
  runReqAuth: "SENTINEL_RUN_REQ_AUTH",
  runRespCookie: "SENTINEL_RUN_RESP_COOKIE",
  globalHeader: "SENTINEL_GLOBAL_HEADER",
  proxyPassword: "SENTINEL_PROXY_PASSWORD",
};

const buildFixture = (): BackupData => ({
  requests: [
    { id: "r1", auth: { type: "bearer", token: S.reqBearer } },
    { id: "r2", auth: { type: "basic", username: "u", password: S.reqBasic } },
    { id: "r3", auth: { type: "api-key", key: "k", value: S.reqApiKey } },
    {
      id: "r4",
      headers: [
        { key: "Authorization", value: S.reqHeader },
        { key: "X-Trace", value: "keep-me" },
      ],
    },
  ],
  environments: [
    {
      id: "e1",
      variables: [
        {
          key: "tok",
          isSecret: true,
          initialValue: S.envInitial,
          currentValue: S.envCurrent,
        },
        { key: "host", isSecret: false, initialValue: "plain-host" },
      ],
    },
  ],
  chains: [
    {
      id: "c1",
      blocks: [
        { auth: { type: "bearer", token: S.chainBearer } },
        { headers: [{ key: "x-api-key", value: S.chainHeader }] },
      ],
    },
  ],
  history: [
    {
      id: "h1",
      request: {
        auth: { type: "basic", password: S.histBasic },
        headers: [{ key: "Cookie", value: S.histHeader }],
      },
      response: {
        headers: {
          Authorization: S.histRespAuth,
          Cookie: S.histRespCookie,
          "Set-Cookie": S.histRespSetCookie,
          "Content-Type": "application/json",
        },
      },
    },
  ],
  chainRuns: [
    {
      id: "cr1",
      steps: [
        {
          request: { headers: { "proxy-authorization": S.runReqAuth } },
          response: { headers: { "X-Auth-Token": S.runRespCookie } },
        },
      ],
    },
  ],
  settings: {
    globalHeaders: [{ key: "X-API-Key", value: S.globalHeader }],
    proxyUrl: `http://user:${S.proxyPassword}@proxy.local:8080`,
  },
});

const sentinels = Object.values(S);

describe("applySecretPolicy", () => {
  it("leaves no sentinel in the serialised JSON when secrets are off", () => {
    const out = JSON.stringify(
      applySecretPolicy(buildFixture(), { includeSecrets: false }),
    );
    for (const sentinel of sentinels) expect(out).not.toContain(sentinel);
  });

  it("keeps every sentinel when secrets are on", () => {
    const out = JSON.stringify(
      applySecretPolicy(buildFixture(), { includeSecrets: true }),
    );
    for (const sentinel of sentinels) expect(out).toContain(sentinel);
  });

  it("returns the same data object when secrets are on", () => {
    const data = buildFixture();
    expect(applySecretPolicy(data, { includeSecrets: true })).toBe(data);
  });

  it("does not mutate its input when blanking", () => {
    const data = buildFixture();
    const before = JSON.stringify(data);
    applySecretPolicy(data, { includeSecrets: false });
    expect(JSON.stringify(data)).toBe(before);
  });

  it("blanks each auth type's secret field and keeps the rest", () => {
    const out = applySecretPolicy(buildFixture(), { includeSecrets: false });
    expect(out.requests).toMatchObject([
      { auth: { type: "bearer", token: REDACTED_VALUE } },
      { auth: { type: "basic", username: "u", password: REDACTED_VALUE } },
      { auth: { type: "api-key", key: "k", value: REDACTED_VALUE } },
      {
        headers: [
          { key: "Authorization", value: REDACTED_VALUE },
          { key: "X-Trace", value: "keep-me" },
        ],
      },
    ]);
  });

  it("blanks only secret environment variables", () => {
    const out = applySecretPolicy(buildFixture(), { includeSecrets: false });
    expect(out.environments).toEqual([
      {
        id: "e1",
        variables: [
          {
            key: "tok",
            isSecret: true,
            initialValue: REDACTED_VALUE,
            currentValue: REDACTED_VALUE,
          },
          { key: "host", isSecret: false, initialValue: "plain-host" },
        ],
      },
    ]);
  });

  it("blanks history response headers case-insensitively and keeps others", () => {
    const out = applySecretPolicy(buildFixture(), { includeSecrets: false });
    expect(
      (out.history as { response: { headers: unknown } }[])[0].response.headers,
    ).toEqual({
      Authorization: REDACTED_VALUE,
      Cookie: REDACTED_VALUE,
      "Set-Cookie": REDACTED_VALUE,
      "Content-Type": "application/json",
    });
  });

  it("strips only the password from the proxy URL", () => {
    const out = applySecretPolicy(buildFixture(), { includeSecrets: false });
    expect(out.settings?.proxyUrl).toBe("http://user:@proxy.local:8080");
  });

  it("leaves a proxy URL without a password alone", () => {
    const data: BackupData = {
      settings: { proxyUrl: "http://proxy.local:8080" },
    };
    const out = applySecretPolicy(data, { includeSecrets: false });
    expect(out.settings?.proxyUrl).toBe("http://proxy.local:8080");
  });

  it("keeps a pure {{var}} reference", () => {
    const data: BackupData = {
      requests: [
        { auth: { type: "bearer", token: "{{token}}" } },
        { headers: [{ key: "Cookie", value: "  {{session}} " }] },
      ],
      environments: [
        {
          variables: [
            { isSecret: true, initialValue: "{{a}}", currentValue: "real" },
          ],
        },
      ],
    };
    const out = applySecretPolicy(data, { includeSecrets: false });
    expect(out.requests).toEqual([
      { auth: { type: "bearer", token: "{{token}}" } },
      { headers: [{ key: "Cookie", value: "  {{session}} " }] },
    ]);
    expect(out.environments).toEqual([
      {
        variables: [
          { isSecret: true, initialValue: "{{a}}", currentValue: REDACTED_VALUE },
        ],
      },
    ]);
  });

  it("blanks a value that merely contains a variable reference", () => {
    const data: BackupData = {
      requests: [{ auth: { type: "bearer", token: "Bearer {{t}} extra" } }],
    };
    const out = applySecretPolicy(data, { includeSecrets: false });
    expect(out.requests).toEqual([
      { auth: { type: "bearer", token: REDACTED_VALUE } },
    ]);
  });

  it("blanks every name in SECRET_HEADER_NAMES", () => {
    for (const name of SECRET_HEADER_NAMES) {
      const out = applySecretPolicy(
        { settings: { globalHeaders: [{ key: name.toUpperCase(), value: "x" }] } },
        { includeSecrets: false },
      );
      expect(out.settings?.globalHeaders).toEqual([
        { key: name.toUpperCase(), value: REDACTED_VALUE },
      ]);
    }
  });

  it("passes through unknown auth types, missing sections and malformed shapes", () => {
    const data = {
      requests: [
        { auth: { type: "none" } },
        { auth: "oops" },
        { headers: "not-a-list" },
        "not-a-record",
        { headers: [{ key: "X-Other", value: "v" }] },
      ],
      history: [{ id: "h", request: "str", response: "str" }, { id: "h2" }],
      chainRuns: [{ steps: [{ id: "s" }, { request: { body: "b" } }, 5] }],
      chains: [{ id: "c" }],
      environments: [{ id: "e" }],
      settings: { theme: "dark" },
    } as unknown as BackupData;
    const out = applySecretPolicy(data, { includeSecrets: false });
    expect(out).toEqual(data);
  });

  it("ignores non-record settings and non-array sections", () => {
    const data = {
      settings: undefined,
      requests: "nope",
      history: { a: 1 },
    } as unknown as BackupData;
    expect(applySecretPolicy(data, { includeSecrets: false })).toEqual(data);
  });

  it("returns an empty object for empty data", () => {
    expect(applySecretPolicy({}, { includeSecrets: false })).toEqual({});
  });

  it("leaves a response with no headers field and a non-string proxyUrl alone", () => {
    const data = {
      history: [{ response: { status: 200 } }],
      settings: { proxyUrl: 42, globalHeaders: [] },
    } as unknown as BackupData;
    expect(applySecretPolicy(data, { includeSecrets: false })).toEqual(data);
  });

  it("leaves a response whose headers are not a record alone", () => {
    const data = {
      history: [{ response: { headers: ["a"] } }],
    } as unknown as BackupData;
    expect(applySecretPolicy(data, { includeSecrets: false })).toEqual(data);
  });

  it("does not add a secret field that the record lacks", () => {
    const data = {
      requests: [{ auth: { type: "bearer" } }],
    } as unknown as BackupData;
    const out = applySecretPolicy(data, { includeSecrets: false });
    expect(out.requests).toEqual([{ auth: { type: "bearer" } }]);
  });
});
