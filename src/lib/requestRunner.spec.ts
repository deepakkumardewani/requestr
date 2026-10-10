import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { runGraphQLRequest, runRequest } from "./requestRunner";

function proxyJsonResponse(
  payload: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    error?: string;
    code?: string;
  },
  init?: { ok?: boolean }
) {
  const ok = init?.ok ?? !payload.error;
  return {
    ok,
    headers: new Headers({ "x-elapsed": "12" }),
    json: async () => payload,
  };
}

describe("runRequest", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      proxyJsonResponse({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: '{"a":1}',
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts merged headers and JSON body to the proxy", async () => {
    await runRequest({
      method: "POST",
      url: "https://api.example.com/x",
      headers: [
        { id: "1", key: "X-App", value: "test", enabled: true },
        { id: "2", key: "Ignored", value: "x", enabled: false },
      ],
      body: { type: "json", content: '{"q":1}' },
      auth: { type: "bearer", token: "tok" },
      sslVerify: false,
      followRedirects: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const sent = JSON.parse(init.body as string);
    expect(sent.url).toBe("https://api.example.com/x");
    expect(sent.method).toBe("POST");
    expect(sent.sslVerify).toBe(false);
    expect(sent.followRedirects).toBe(false);
    expect(sent.headers.Authorization).toBe("Bearer tok");
    expect(sent.headers["Content-Type"]).toBe("application/json");
    expect(sent.headers["X-App"]).toBe("test");
    expect(sent.body).toBe('{"q":1}');
  });

  it("appends api-key to query when addTo is query", async () => {
    await runRequest({
      method: "GET",
      url: "https://api.example.com/items",
      headers: [],
      body: { type: "none", content: "" },
      auth: {
        type: "api-key",
        key: "api_key",
        value: "secret",
        addTo: "query",
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.url).toContain("api_key=");
    expect(sent.url).toContain("secret");
  });

  it("throws network RequestError when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    await expect(
      runRequest({
        method: "GET",
        url: "https://x.test",
        headers: [],
        body: { type: "none", content: "" },
        auth: { type: "none" },
      })
    ).rejects.toMatchObject({
      type: "network",
      message: "Failed to reach the proxy server",
    });
  });

  it("throws parse RequestError when proxy body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });

    await expect(
      runRequest({
        method: "GET",
        url: "https://x.test",
        headers: [],
        body: { type: "none", content: "" },
        auth: { type: "none" },
      })
    ).rejects.toMatchObject({
      type: "parse",
      message: "Failed to parse proxy response",
    });
  });

  it("throws proxy RequestError when response is not ok or payload has error", async () => {
    fetchMock.mockResolvedValueOnce(
      proxyJsonResponse(
        {
          status: 502,
          statusText: "Bad",
          headers: {},
          body: "",
          error: "upstream failed",
          code: "E_UPSTREAM",
        },
        { ok: false }
      )
    );

    await expect(
      runRequest({
        method: "GET",
        url: "https://x.test",
        headers: [],
        body: { type: "none", content: "" },
        auth: { type: "none" },
      })
    ).rejects.toMatchObject({
      type: "proxy",
      message: "upstream failed",
      cause: "E_UPSTREAM",
    });
  });

  it("passes AbortSignal to fetch", async () => {
    const ac = new AbortController();
    await runRequest(
      {
        method: "GET",
        url: "https://x.test",
        headers: [],
        body: { type: "none", content: "" },
        auth: { type: "none" },
      },
      ac.signal
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(ac.signal);
  });
});

describe("runRequest body and header building", () => {
  const fetchMock = vi.fn();

  type RunInput = Parameters<typeof runRequest>[0];

  const baseRequest: RunInput = {
    method: "POST",
    url: "https://api.example.com/x",
    headers: [],
    body: { type: "none", content: "" },
    auth: { type: "none" },
  };

  async function sentPayload(overrides: Partial<RunInput>) {
    await runRequest({ ...baseRequest, ...overrides });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string) as {
      headers: Record<string, string>;
      body?: string;
      sslVerify: boolean;
      followRedirects: boolean;
      timeoutMs: number;
    };
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      proxyJsonResponse({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("percent-encodes enabled urlencoded fields and joins them with ampersands", async () => {
    const sent = await sentPayload({
      body: {
        type: "urlencoded",
        content: "",
        formData: [
          { id: "1", key: "a b", value: "x&y=z", enabled: true },
          { id: "2", key: "skip", value: "no", enabled: false },
          { id: "3", key: "", value: "nokey", enabled: true },
          { id: "4", key: "ü", value: "1", enabled: true },
        ],
      },
    });

    expect(sent.body).toBe("a%20b=x%26y%3Dz&%C3%BC=1");
  });

  it("omits the body when no urlencoded field is enabled with a key", async () => {
    const sent = await sentPayload({
      body: {
        type: "urlencoded",
        content: "",
        formData: [{ id: "1", key: "a", value: "1", enabled: false }],
      },
    });

    expect(sent).not.toHaveProperty("body");
  });

  it.each([
    ["json", "application/json"],
    ["xml", "application/xml"],
    ["urlencoded", "application/x-www-form-urlencoded"],
  ] as const)(
    "defaults Content-Type for a %s body to %s",
    async (type, expected) => {
      const sent = await sentPayload({
        body: { type, content: "c", formData: [] },
      });

      expect(sent.headers["Content-Type"]).toBe(expected);
    }
  );

  it.each([["text"], ["html"]] as const)(
    "sends %s body content without adding a Content-Type",
    async (type) => {
      const sent = await sentPayload({ body: { type, content: "<p>hi</p>" } });

      expect(sent.body).toBe("<p>hi</p>");
      expect(sent.headers).not.toHaveProperty("Content-Type");
    }
  );

  it("sends null body (omitted) for an empty json body", async () => {
    const sent = await sentPayload({ body: { type: "json", content: "" } });

    expect(sent).not.toHaveProperty("body");
  });

  it("falls through to raw content for form-data bodies", async () => {
    const sent = await sentPayload({
      body: { type: "form-data", content: "raw-part" },
    });

    expect(sent.body).toBe("raw-part");
    expect(sent.headers).not.toHaveProperty("Content-Type");
  });

  it.each(["Content-Type", "content-type", "CONTENT-TYPE"])(
    "keeps a single user-supplied %s header and does not add a default",
    async (key) => {
      const sent = await sentPayload({
        headers: [{ id: "1", key, value: "text/custom", enabled: true }],
        body: { type: "json", content: "{}" },
      });

      expect(Object.keys(sent.headers)).toEqual([key]);
      expect(sent.headers[key]).toBe("text/custom");
    }
  );

  it("encodes basic auth credentials as base64 user:password", async () => {
    const sent = await sentPayload({
      auth: { type: "basic", username: "user", password: "pässwörd" },
    });

    expect(sent.headers.Authorization).toBe(`Basic ${btoa("user:pässwörd")}`);
  });

  it("rejects when the basic auth password contains characters outside Latin-1", async () => {
    // Characterization: btoa cannot encode these, so the request never reaches the proxy.
    await expect(
      runRequest({
        ...baseRequest,
        auth: { type: "basic", username: "user", password: "密码" },
      })
    ).rejects.toMatchObject({ name: "InvalidCharacterError" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an empty bearer token as a bare Bearer prefix", async () => {
    const sent = await sentPayload({ auth: { type: "bearer", token: "" } });

    expect(sent.headers.Authorization).toBe("Bearer ");
  });

  it("applies sslVerify, followRedirects and timeout defaults when unset", async () => {
    const sent = await sentPayload({});

    expect(sent.sslVerify).toBe(true);
    expect(sent.followRedirects).toBe(true);
    expect(sent.timeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it("forwards explicit sslVerify, followRedirects and timeoutMs", async () => {
    const sent = await sentPayload({
      sslVerify: false,
      followRedirects: false,
      timeoutMs: 1234,
    });

    expect(sent.sslVerify).toBe(false);
    expect(sent.followRedirects).toBe(false);
    expect(sent.timeoutMs).toBe(1234);
  });

  it("throws timeout RequestError when the proxy reports code TIMEOUT", async () => {
    fetchMock.mockResolvedValueOnce(
      proxyJsonResponse(
        {
          status: 504,
          statusText: "Gateway Timeout",
          headers: {},
          body: "",
          error: "Request timed out after 5s",
          code: "TIMEOUT",
        },
        { ok: false }
      )
    );

    await expect(runRequest(baseRequest)).rejects.toEqual({
      type: "timeout",
      message: "Request timed out after 5s",
      cause: "TIMEOUT",
    });
  });
});

describe("runGraphQLRequest", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      proxyJsonResponse({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("builds POST body with query, variables, and operationName", async () => {
    await runGraphQLRequest({
      url: "https://gql.test/graphql",
      headers: [],
      auth: { type: "none" },
      query: "{ __typename }",
      variablesJson: '{"id": 1}',
      operationName: "Op",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.method).toBe("POST");
    const gqlBody = JSON.parse(sent.body as string);
    expect(gqlBody.query).toBe("{ __typename }");
    expect(gqlBody.variables).toEqual({ id: 1 });
    expect(gqlBody.operationName).toBe("Op");
  });

  async function sentHeaders(headers: { key: string; value: string }[]) {
    await runGraphQLRequest({
      url: "https://gql.test/graphql",
      headers: headers.map((h, i) => ({ id: `${i}`, enabled: true, ...h })),
      auth: { type: "none" },
      query: "{ __typename }",
      variablesJson: "",
      operationName: "",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string)
      .headers as Record<string, string>;
  }

  it("adds application/json Content-Type when the user sets none", async () => {
    const headers = await sentHeaders([]);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("respects a lowercase user content-type without duplicating it", async () => {
    const headers = await sentHeaders([
      { key: "content-type", value: "application/graphql" },
    ]);
    const contentTypes = Object.entries(headers).filter(
      ([k]) => k.toLowerCase() === "content-type"
    );
    expect(contentTypes).toEqual([["content-type", "application/graphql"]]);
  });

  it("throws parse RequestError when variables JSON is not an object", async () => {
    await expect(
      runGraphQLRequest({
        url: "https://gql.test/graphql",
        headers: [],
        auth: { type: "none" },
        query: "{}",
        variablesJson: "[1,2]",
        operationName: "",
      })
    ).rejects.toMatchObject({
      type: "parse",
      message: "Variables must be a JSON object",
    });
  });
});
