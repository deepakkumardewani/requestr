/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { resolveHttpRequestTemplate } from "@/lib/resolveRequest";
import * as utils from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type {
  GraphQLTab,
  HttpTab,
  RequestError,
  ResponseData,
  SocketIOTab,
  WebSocketTab,
} from "@/types";
import { useSendRequest } from "./useSendRequest";

const mocks = vi.hoisted(() => ({
  runRequest: vi.fn(),
  runGraphQLRequest: vi.fn(),
  runPreScript: vi.fn(),
  runPostScript: vi.fn(),
}));

vi.mock("@/lib/requestRunner", () => ({
  runRequest: mocks.runRequest,
  runGraphQLRequest: mocks.runGraphQLRequest,
}));

vi.mock("@/lib/resolveRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resolveRequest")>();
  return {
    ...actual,
    resolveHttpRequestTemplate: vi.fn(actual.resolveHttpRequestTemplate),
  };
});

vi.mock("@/lib/scriptRunner", () => ({
  runPreScript: mocks.runPreScript,
  runPostScript: mocks.runPostScript,
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

import { toast } from "sonner";

function sampleResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body: "{}",
    duration: 42,
    size: 10,
    url: "https://example.com/final",
    method: "GET",
    timestamp: 1000,
    ...overrides,
  };
}

function httpTab(tabId: string, overrides: Partial<HttpTab> = {}): HttpTab {
  return {
    tabId,
    requestId: null,
    name: "Req",
    isDirty: false,
    type: "http",
    url: "https://example.com/path",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "json", content: "{}" },
    preScript: "",
    postScript: "",
    ...overrides,
  };
}

function gqlTab(
  tabId: string,
  overrides: Partial<GraphQLTab> = {},
): GraphQLTab {
  return {
    tabId,
    requestId: null,
    name: "GQL",
    isDirty: false,
    type: "graphql",
    url: "https://example.com/graphql",
    headers: [],
    query: "{ ping }",
    variables: "{}",
    operationName: "",
    auth: { type: "none" },
    ...overrides,
  };
}

function wsTab(tabId: string): WebSocketTab {
  return {
    tabId,
    requestId: null,
    name: "WS",
    isDirty: false,
    type: "websocket",
    url: "wss://example.com",
    headers: [],
    messageLog: [],
  };
}

function socketIoTab(tabId: string): SocketIOTab {
  return {
    tabId,
    requestId: null,
    name: "IO",
    isDirty: false,
    type: "socketio",
    url: "http://example.com",
    headers: [],
    messageLog: [],
  };
}

function resetAllStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useResponseStore.setState({
    responses: {},
    loading: {},
    errors: {},
    scriptLogs: {},
  });
  useHistoryStore.setState({ entries: [] });
  useSettingsStore.setState({
    theme: "dark",
    proxyUrl: "",
    sslVerify: true,
    followRedirects: true,
    showHealthMonitor: true,
    showCodeGen: true,
    codeGenLang: "cURL",
    autoExpandExplainer: true,
    globalBaseUrl: "",
    globalHeaders: [],
    hydrated: false,
  });
}

describe("useSendRequest", () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    mocks.runRequest.mockResolvedValue(sampleResponse());
    mocks.runGraphQLRequest.mockResolvedValue(
      sampleResponse({ method: "POST" }),
    );
    mocks.runPreScript.mockReturnValue({ logs: [] });
    mocks.runPostScript.mockReturnValue({ logs: [] });
    vi.spyOn(utils, "generateId").mockReturnValue("hist-entry-id");
  });

  it("returns early without toast when tab id is missing", async () => {
    const { result } = renderHook(() => useSendRequest("ghost"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.info).not.toHaveBeenCalled();
    expect(mocks.runRequest).not.toHaveBeenCalled();
  });

  it("shows info toast when tab type cannot send", async () => {
    useTabsStore.setState({
      tabs: [wsTab("ws1")],
      activeTabId: "ws1",
    });
    const { result } = renderHook(() => useSendRequest("ws1"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.info).toHaveBeenCalledWith(
      "Send is not available for this tab type",
    );
    expect(mocks.runRequest).not.toHaveBeenCalled();
  });

  it("shows info for socket.io tab type", async () => {
    useTabsStore.setState({
      tabs: [socketIoTab("io1")],
      activeTabId: "io1",
    });
    const { result } = renderHook(() => useSendRequest("io1"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.info).toHaveBeenCalledWith(
      "Send is not available for this tab type",
    );
  });

  it("warns when HTTP URL is blank", async () => {
    useTabsStore.setState({
      tabs: [httpTab("t1", { url: "   " })],
      activeTabId: "t1",
    });
    const { result } = renderHook(() => useSendRequest("t1"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.warning).toHaveBeenCalledWith(
      "Enter a URL to send the request",
    );
    expect(mocks.runRequest).not.toHaveBeenCalled();
  });

  it("warns when GraphQL query resolves empty", async () => {
    useTabsStore.setState({
      tabs: [gqlTab("g1", { query: "   " })],
      activeTabId: "g1",
    });
    const { result } = renderHook(() => useSendRequest("g1"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.warning).toHaveBeenCalledWith("Enter a GraphQL query");
    expect(useResponseStore.getState().loading["g1"]).toBe(false);
    expect(mocks.runGraphQLRequest).not.toHaveBeenCalled();
  });

  it("sendForce bypasses unresolved GraphQL header variables and dispatches", async () => {
    const gqlResponse = sampleResponse({ status: 200, body: "{}" });
    mocks.runGraphQLRequest.mockResolvedValueOnce(gqlResponse);
    useTabsStore.setState({
      tabs: [
        gqlTab("gforce", {
          headers: [
            {
              id: "h1",
              key: "Authorization",
              value: "{{missing}}",
              enabled: true,
            },
          ],
        }),
      ],
      activeTabId: "gforce",
    });
    const { result } = renderHook(() => useSendRequest("gforce"));
    await act(async () => {
      await result.current.sendForce();
    });
    expect(mocks.runGraphQLRequest).toHaveBeenCalledTimes(1);
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("resolves GraphQL variables and operationName from the active environment", async () => {
    const gqlResponse = sampleResponse({ status: 200, body: "{}" });
    mocks.runGraphQLRequest.mockResolvedValueOnce(gqlResponse);
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "Dev",
          variables: [
            {
              id: "v1",
              key: "userId",
              initialValue: "1",
              currentValue: "42",
              isSecret: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "e1",
      hydrated: true,
    });
    useTabsStore.setState({
      tabs: [
        gqlTab("genv", {
          variables: '{"id":"{{userId}}"}',
          operationName: "Op{{userId}}",
        }),
      ],
      activeTabId: "genv",
    });
    const { result } = renderHook(() => useSendRequest("genv"));
    await act(async () => {
      await result.current.send();
    });
    const payload = mocks.runGraphQLRequest.mock.calls[0]?.[0];
    expect(payload?.variablesJson).toBe('{"id":"42"}');
    expect(payload?.operationName).toBe("Op42");
  });

  it("sets GraphQL error state and toast when runGraphQLRequest rejects", async () => {
    const err: RequestError = { type: "network", message: "GraphQL down" };
    mocks.runGraphQLRequest.mockRejectedValueOnce(err);
    useTabsStore.setState({
      tabs: [gqlTab("gerr")],
      activeTabId: "gerr",
    });
    const { result } = renderHook(() => useSendRequest("gerr"));
    await act(async () => {
      await result.current.send();
    });
    expect(useResponseStore.getState().errors["gerr"]).toEqual(err);
    expect(toast.error).toHaveBeenCalled();
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("runs GraphQL request and stores response; GraphQL is intentionally not recorded in history (D1)", async () => {
    const gqlResponse = sampleResponse({ status: 201, body: "[]" });
    mocks.runGraphQLRequest.mockResolvedValueOnce(gqlResponse);
    useTabsStore.setState({
      tabs: [gqlTab("g2")],
      activeTabId: "g2",
    });
    const { result } = renderHook(() => useSendRequest("g2"));
    await act(async () => {
      await result.current.send();
    });
    expect(mocks.runGraphQLRequest).toHaveBeenCalledTimes(1);
    expect(useResponseStore.getState().responses["g2"]).toEqual(gqlResponse);
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(mocks.runPreScript).not.toHaveBeenCalled();
  });

  it("resolves the HTTP request template exactly once per send", async () => {
    useTabsStore.setState({ tabs: [httpTab("h1")], activeTabId: "h1" });
    const { result } = renderHook(() => useSendRequest("h1"));
    await act(async () => {
      await result.current.send();
    });
    expect(resolveHttpRequestTemplate).toHaveBeenCalledTimes(1);
  });

  it("runs HTTP GET and logs history", async () => {
    const res = sampleResponse({ url: "https://example.com/path" });
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [httpTab("h1")],
      activeTabId: "h1",
    });
    const { result } = renderHook(() => useSendRequest("h1"));
    await act(async () => {
      await result.current.send();
    });
    expect(mocks.runRequest).toHaveBeenCalledTimes(1);
    expect(mocks.runRequest.mock.calls[0]?.[0]).toEqual({
      method: "GET",
      url: "https://example.com/path",
      headers: [],
      body: { type: "json", content: "{}" },
      auth: { type: "none" },
      sslVerify: true,
      followRedirects: true,
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    });
    expect(mocks.runRequest.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
    expect(useResponseStore.getState().responses["h1"]).toEqual(res);
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("hist-entry-id");
    expect(entries[0]?.method).toBe("GET");
    expect(entries[0]?.status).toBe(res.status);
  });

  it.each([
    [
      "network error",
      {
        type: "network",
        message: "Failed to reach the proxy server",
        cause: "boom",
      },
    ],
    ["timeout", { type: "timeout", message: "Request timed out" }],
    ["proxy error", { type: "proxy", message: "Proxy returned 502" }],
  ] as const)("records a failed request in history on %s", async (_label, error) => {
    mocks.runRequest.mockRejectedValueOnce(error);
    useTabsStore.setState({ tabs: [httpTab("h1")], activeTabId: "h1" });
    const { result } = renderHook(() => useSendRequest("h1"));
    await act(async () => {
      await result.current.send();
    });
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "hist-entry-id",
      method: "GET",
      status: 0,
      error,
    });
    expect(entries[0]?.request.type).toBe("http");
  });

  it("does not record a history entry when the user cancels the request", async () => {
    mocks.runRequest.mockImplementationOnce(
      (_payload: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject({ type: "network", message: "aborted" }),
          );
        }),
    );
    useTabsStore.setState({ tabs: [httpTab("h1")], activeTabId: "h1" });
    const { result } = renderHook(() => useSendRequest("h1"));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.send();
      await Promise.resolve();
      result.current.cancel();
      await pending;
    });
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(useResponseStore.getState().errors.h1 ?? null).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("records a non-2xx response in history with its status", async () => {
    mocks.runRequest.mockResolvedValueOnce(
      sampleResponse({ status: 500, statusText: "Server Error" }),
    );
    useTabsStore.setState({ tabs: [httpTab("h1")], activeTabId: "h1" });
    const { result } = renderHook(() => useSendRequest("h1"));
    await act(async () => {
      await result.current.send();
    });
    const entries = useHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe(500);
    expect(entries[0]?.error).toBeUndefined();
  });

  it("runs pre-script overrides and merges logs", async () => {
    mocks.runPreScript.mockReturnValueOnce({
      logs: ["pre"],
      requestOverrides: {
        url: "https://override.example",
      },
    });
    mocks.runPostScript.mockReturnValueOnce({ logs: ["post"], error: "pe" });
    const res = sampleResponse();
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [
        httpTab("p1", {
          preScript: "rq.request.url.set('x')",
          postScript: "// x",
        }),
      ],
      activeTabId: "p1",
    });
    const { result } = renderHook(() => useSendRequest("p1"));
    await act(async () => {
      await result.current.send();
    });
    expect(mocks.runRequest.mock.calls[0]?.[0]?.url).toContain(
      "override.example",
    );
    expect(toast.error).toHaveBeenCalledWith("Post-response script error", {
      description: "pe",
    });
    expect(useResponseStore.getState().scriptLogs["p1"]).toEqual([
      "pre",
      "post",
    ]);
  });

  it("applies pre-script header and body overrides", async () => {
    mocks.runPreScript.mockReturnValueOnce({
      logs: [],
      requestOverrides: {
        headers: [
          { id: "h1", key: "X-Override", value: "yes", enabled: true },
        ],
        body: { type: "text", content: "overridden-body" },
      },
    });
    const res = sampleResponse();
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [httpTab("ov1", { preScript: "// override" })],
      activeTabId: "ov1",
    });
    const { result } = renderHook(() => useSendRequest("ov1"));
    await act(async () => {
      await result.current.send();
    });
    const call = mocks.runRequest.mock.calls[0]?.[0];
    expect(call?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "X-Override", value: "yes" }),
      ]),
    );
    expect(call?.body).toEqual({ type: "text", content: "overridden-body" });
  });

  it("surfaces pre-script errors via toast but continues request", async () => {
    mocks.runPreScript.mockReturnValueOnce({
      logs: [],
      error: "pre-fail",
      requestOverrides: {},
    });
    const res = sampleResponse();
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [httpTab("e1", { preScript: "// bad" })],
      activeTabId: "e1",
    });
    const { result } = renderHook(() => useSendRequest("e1"));
    await act(async () => {
      await result.current.send();
    });
    expect(toast.error).toHaveBeenCalledWith("Pre-request script error", {
      description: "pre-fail",
    });
    expect(mocks.runRequest).toHaveBeenCalled();
  });

  it("handles request failure", async () => {
    const err: RequestError = {
      type: "network",
      message: "offline",
      cause: "dns",
    };
    mocks.runRequest.mockRejectedValueOnce(err);
    useTabsStore.setState({
      tabs: [httpTab("err")],
      activeTabId: "err",
    });
    const { result } = renderHook(() => useSendRequest("err"));
    await act(async () => {
      await result.current.send();
    });
    expect(useResponseStore.getState().errors["err"]).toEqual(err);
    expect(toast.error).toHaveBeenCalledWith("Request failed: offline", {
      description: "dns",
    });
  });

  it("cancel clears loading flag", () => {
    useTabsStore.setState({
      tabs: [httpTab("c1")],
      activeTabId: "c1",
    });
    useResponseStore.getState().setLoading("c1", true);
    const { result } = renderHook(() => useSendRequest("c1"));
    act(() => {
      result.current.cancel();
    });
    expect(useResponseStore.getState().loading["c1"]).toBe(false);
  });

  it("exposes loading state from response store", () => {
    useTabsStore.setState({
      tabs: [httpTab("l1")],
      activeTabId: "l1",
    });
    useResponseStore.getState().setLoading("l1", true);
    const { result } = renderHook(() => useSendRequest("l1"));
    expect(result.current.isLoading).toBe(true);
  });

  it("blocks HTTP send when unresolved {{variable}} placeholders remain", async () => {
    useTabsStore.setState({
      tabs: [httpTab("uv1", { url: "https://example.com/{{missingVar}}" })],
      activeTabId: "uv1",
    });
    const { result } = renderHook(() => useSendRequest("uv1"));
    await act(async () => {
      await result.current.send();
    });
    expect(mocks.runRequest).not.toHaveBeenCalled();
    expect(useResponseStore.getState().loading["uv1"]).toBe(false);
  });

  it("bypasses the unresolved-variable guard for HTTP when force=true (sendForce)", async () => {
    const res = sampleResponse();
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [httpTab("uv2", { url: "https://example.com/{{missingVar}}" })],
      activeTabId: "uv2",
    });
    const { result } = renderHook(() => useSendRequest("uv2"));
    await act(async () => {
      await result.current.sendForce();
    });
    expect(mocks.runRequest).toHaveBeenCalledTimes(1);
    expect(useResponseStore.getState().responses["uv2"]).toEqual(res);
  });

  it("blocks GraphQL send when unresolved {{variable}} placeholders remain in headers", async () => {
    useTabsStore.setState({
      tabs: [
        gqlTab("uvg1", {
          headers: [
            {
              id: "h1",
              key: "X-Token",
              value: "{{missingToken}}",
              enabled: true,
            },
          ],
        }),
      ],
      activeTabId: "uvg1",
    });
    const { result } = renderHook(() => useSendRequest("uvg1"));
    await act(async () => {
      await result.current.send();
    });
    expect(mocks.runGraphQLRequest).not.toHaveBeenCalled();
    expect(useResponseStore.getState().loading["uvg1"]).toBe(false);
  });

  it("evaluates no-code assertions on the response when the tab defines them", async () => {
    const res = sampleResponse({ status: 200, body: '{"ok":true}' });
    mocks.runRequest.mockResolvedValueOnce(res);
    useTabsStore.setState({
      tabs: [
        httpTab("assert1", {
          assertions: [
            {
              id: "a1",
              source: "status",
              operator: "eq",
              expectedValue: "200",
              enabled: true,
            },
          ],
        }),
      ],
      activeTabId: "assert1",
    });
    const { result } = renderHook(() => useSendRequest("assert1"));
    await act(async () => {
      await result.current.send();
    });
    const assertionResults =
      useResponseStore.getState().assertionResults?.["assert1"];
    expect(assertionResults).toBeDefined();
    expect(assertionResults?.length).toBe(1);
  });

  describe("variables set at send time", () => {
    function seedEnv(variables: Array<{ key: string; value: string }> = []) {
      useEnvironmentsStore.setState({
        environments: [
          {
            id: "env1",
            name: "E",
            createdAt: 0,
            updatedAt: 0,
            variables: variables.map((v, i) => ({
              id: `v${i}`,
              key: v.key,
              initialValue: v.value,
              currentValue: v.value,
              enabled: true,
              isSecret: false,
            })),
          },
        ],
        activeEnvId: "env1",
      });
    }

    async function sendTab(tab: HttpTab) {
      useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
      const { result } = renderHook(() => useSendRequest(tab.tabId));
      await act(async () => {
        await result.current.send();
      });
      return mocks.runRequest.mock.calls[0]?.[0];
    }

    it("resolves a pre-script environment.set value in url, header and body", async () => {
      seedEnv();
      mocks.runPreScript.mockImplementationOnce(
        (_script: string, _ctx: unknown, _get: unknown, set: (k: string, v: string) => void) => {
          set("token", "x");
          return { logs: [] };
        },
      );

      const sent = await sendTab(
        httpTab("pre1", {
          preScript: 'environment.set("token", "x")',
          url: "https://example.com/{{token}}",
          headers: [
            { id: "h", key: "X-Token", value: "{{token}}", enabled: true },
          ],
          body: { type: "json", content: '{"t":"{{token}}"}' },
        }),
      );

      expect(sent.url).toBe("https://example.com/x");
      expect(sent.headers).toEqual([
        expect.objectContaining({ key: "X-Token", value: "x" }),
      ]);
      expect(sent.body.content).toBe('{"t":"x"}');
      expect(useResponseStore.getState().unresolvedVars?.["pre1"] ?? []).toEqual(
        [],
      );
    });

    it.each([
      [
        "bearer",
        { type: "bearer", token: "{{token}}" },
        { type: "bearer", token: "x" },
      ],
      [
        "basic",
        { type: "basic", username: "{{token}}", password: "{{token}}" },
        { type: "basic", username: "x", password: "x" },
      ],
      [
        "api-key",
        { type: "api-key", key: "{{token}}", value: "{{token}}", addTo: "query" },
        { type: "api-key", key: "x", value: "x", addTo: "query" },
      ],
    ] as const)("resolves {{token}} in %s auth in the runRequest payload", async (_name, auth, expected) => {
      seedEnv([{ key: "token", value: "x" }]);

      const sent = await sendTab(httpTab("auth1", { auth }));

      expect(sent.auth).toEqual(expected);
    });
  });

  describe("request dispatch payload", () => {
    async function sendHttp(tab: HttpTab) {
      useTabsStore.setState({ tabs: [tab], activeTabId: tab.tabId });
      const { result } = renderHook(() => useSendRequest(tab.tabId));
      await act(async () => {
        await result.current.send();
      });
      return mocks.runRequest.mock.calls[0]?.[0];
    }

    it.each([
      ["tab overrides win over global", { sslVerify: false, followRedirects: false, timeoutMs: 5000 }, { sslVerify: true, followRedirects: true }, { sslVerify: false, followRedirects: false, timeoutMs: 5000 }],
      ["global applies when tab has no override", {}, { sslVerify: false, followRedirects: false }, { sslVerify: false, followRedirects: false, timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS }],
      ["tab override true beats global false", { sslVerify: true, followRedirects: true }, { sslVerify: false, followRedirects: false }, { sslVerify: true, followRedirects: true, timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS }],
    ])("sends exact settings when %s", async (_label, tabOverrides, globals, expected) => {
      useSettingsStore.setState(globals);

      const sent = await sendHttp(httpTab("ov", tabOverrides));

      expect(sent).toMatchObject(expected);
    });

    it("sends a falsy tab timeoutMs of 0 instead of falling back to the default", async () => {
      const sent = await sendHttp(httpTab("t0", { timeoutMs: 0 }));

      expect(sent.timeoutMs).toBe(0);
    });

    it.each(["GET", "HEAD"] as const)("sends a %s request with the tab's empty body unchanged", async (method) => {
      const sent = await sendHttp(
        httpTab("nb", { method, body: { type: "none", content: "" } }),
      );

      expect(sent.method).toBe(method);
      expect(sent.body).toEqual({ type: "none", content: "" });
    });

    it("characterizes GET with a body as forwarding the body to runRequest (D8, no fix)", async () => {
      const sent = await sendHttp(
        httpTab("gb", {
          method: "GET",
          body: { type: "json", content: '{"a":1}' },
        }),
      );

      expect(sent.method).toBe("GET");
      expect(sent.body).toEqual({ type: "json", content: '{"a":1}' });
    });
  });

  describe("post-response script", () => {
    it("shows an error toast with the script error and still records history", async () => {
      mocks.runPostScript.mockReturnValueOnce({ logs: [], error: "boom" });
      useTabsStore.setState({
        tabs: [httpTab("ps1", { postScript: "throw 1" })],
        activeTabId: "ps1",
      });
      const { result } = renderHook(() => useSendRequest("ps1"));

      await act(async () => {
        await result.current.send();
      });

      expect(toast.error).toHaveBeenCalledWith("Post-response script error", {
        description: "boom",
      });
      expect(useHistoryStore.getState().entries).toHaveLength(1);
    });

    it("passes the response to the post script and merges pre then post logs", async () => {
      mocks.runPreScript.mockReturnValueOnce({ logs: ["pre1", "pre2"] });
      mocks.runPostScript.mockReturnValueOnce({ logs: ["post1"] });
      mocks.runRequest.mockResolvedValueOnce(
        sampleResponse({ status: 418, statusText: "Teapot", body: "tea" }),
      );
      useTabsStore.setState({
        tabs: [httpTab("ps2", { preScript: "// a", postScript: "// b" })],
        activeTabId: "ps2",
      });
      const { result } = renderHook(() => useSendRequest("ps2"));

      await act(async () => {
        await result.current.send();
      });

      expect(mocks.runPostScript.mock.calls[0]?.[1]).toEqual({
        status: 418,
        statusText: "Teapot",
        headers: {},
        body: "tea",
      });
      expect(useResponseStore.getState().scriptLogs["ps2"]).toEqual([
        "pre1",
        "pre2",
        "post1",
      ]);
    });
  });

  it("aborts the previous in-flight request when sending again", async () => {
    const signals: AbortSignal[] = [];
    mocks.runRequest.mockImplementationOnce(
      (_payload: unknown, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    );
    mocks.runRequest.mockImplementationOnce(
      (_payload: unknown, signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve(sampleResponse());
      },
    );
    useTabsStore.setState({ tabs: [httpTab("re")], activeTabId: "re" });
    const { result } = renderHook(() => useSendRequest("re"));

    await act(async () => {
      void result.current.send();
      await Promise.resolve();
      await result.current.send();
    });

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
