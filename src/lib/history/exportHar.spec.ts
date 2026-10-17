import { describe, expect, it } from "vitest";
import { historyEntry } from "../relay/testing/historyFixtures";
import { buildHar } from "./exportHar";

describe("buildHar", () => {
  it("emits a HAR 1.2 envelope with the creator", () => {
    const { har, excludedCount } = buildHar([]);
    expect(har).toEqual({
      log: { version: "1.2", creator: { name: "requestr", version: "1.0" }, entries: [] },
    });
    expect(excludedCount).toBe(0);
  });

  it("maps a GET entry to request, response, cache and timings", () => {
    const { har } = buildHar([
      historyEntry({
        request: {
          headers: [
            { id: "k1", key: "Accept", value: "*/*", enabled: true },
            { id: "k2", key: "X-Off", value: "no", enabled: false },
            { id: "k3", key: "", value: "blank", enabled: true },
          ],
        },
      }),
    ]);
    expect(har.log.entries).toHaveLength(1);
    expect(har.log.entries[0]).toEqual({
      startedDateTime: "2026-05-02T10:30:00.000Z",
      time: 120.6,
      request: {
        method: "GET",
        url: "https://api.test/items?a=1&b=two",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: [{ name: "Accept", value: "*/*" }],
        queryString: [
          { name: "a", value: "1" },
          { name: "b", value: "two" },
        ],
        headersSize: -1,
        bodySize: 0,
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: [{ name: "Content-Type", value: "application/json" }],
        content: { size: 42, mimeType: "application/json", text: '{"ok":true}' },
        redirectURL: "",
        headersSize: -1,
        bodySize: 42,
      },
      cache: {},
      timings: { blocked: -1, dns: -1, connect: -1, send: 0, wait: 120.6, receive: 0, ssl: -1 },
    });
  });

  it("includes graphql entries and excludes websocket and socketio with the exact count", () => {
    const entries = [
      historyEntry({ id: "a", type: "http" }),
      historyEntry({ id: "b", type: "graphql" }),
      historyEntry({ id: "c", type: "websocket" }),
      historyEntry({ id: "d", type: "socketio" }),
      historyEntry({ id: "e", type: "websocket" }),
    ];
    const { har, excludedCount } = buildHar(entries);
    expect(har.log.entries).toHaveLength(2);
    expect(excludedCount).toBe(3);
  });

  it("returns an empty query string for an unparseable url", () => {
    const { har } = buildHar([historyEntry({ url: "/relative/{{path}}" })]);
    expect(har.log.entries[0].request.queryString).toEqual([]);
  });

  it("matches the response content-type header case-insensitively and falls back to empty", () => {
    const lower = buildHar([historyEntry({ headers: { "content-type": "text/html" } })]);
    expect(lower.har.log.entries[0].response.content.mimeType).toBe("text/html");
    const none = buildHar([historyEntry({ headers: {} })]);
    expect(none.har.log.entries[0].response.content.mimeType).toBe("");
  });

  it.each([
    ["json", "application/json"],
    ["xml", "application/xml"],
    ["text", "text/plain"],
    ["html", "text/html"],
  ])("exports a %s body as postData with mime %s", (type, mimeType) => {
    const { har } = buildHar([
      historyEntry({ request: { body: { type, content: "payload" } as never } }),
    ]);
    const request = har.log.entries[0].request;
    expect(request.postData).toEqual({ mimeType, text: "payload" });
    expect(request.bodySize).toBe(7);
  });

  it("falls back to text/plain for an unknown body type", () => {
    const { har } = buildHar([
      historyEntry({ request: { body: { type: "binary", content: "xyz" } as never } }),
    ]);
    expect(har.log.entries[0].request.postData).toEqual({ mimeType: "text/plain", text: "xyz" });
  });

  it("omits postData when the body type is none", () => {
    const { har } = buildHar([historyEntry()]);
    expect(har.log.entries[0].request).not.toHaveProperty("postData");
  });

  it("encodes enabled urlencoded and form-data pairs", () => {
    const formData = [
      { key: "a b", value: "c&d", enabled: true },
      { key: "off", value: "x", enabled: false },
    ];
    const urlencoded = buildHar([
      historyEntry({ request: { body: { type: "urlencoded", content: "raw", formData } as never } }),
    ]);
    expect(urlencoded.har.log.entries[0].request.postData).toEqual({
      mimeType: "application/x-www-form-urlencoded",
      text: "a%20b=c%26d",
    });
    const multipart = buildHar([
      historyEntry({ request: { body: { type: "form-data", content: "raw", formData } as never } }),
    ]);
    expect(multipart.har.log.entries[0].request.postData?.mimeType).toBe("multipart/form-data");
  });

  it("falls back to body content when no form pairs are enabled or present", () => {
    const disabled = buildHar([
      historyEntry({
        request: {
          body: { type: "urlencoded", content: "raw", formData: [{ key: "k", value: "v", enabled: false }] } as never,
        },
      }),
    ]);
    expect(disabled.har.log.entries[0].request.postData?.text).toBe("raw");
    const missing = buildHar([
      historyEntry({ request: { body: { type: "form-data", content: "fallback" } as never } }),
    ]);
    expect(missing.har.log.entries[0].request.postData?.text).toBe("fallback");
  });
});
