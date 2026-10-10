import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runPostScript,
  runPreScript,
  type ScriptRequestContext,
} from "./scriptRunner";

vi.mock("@/lib/utils", () => ({
  generateId: vi.fn(() => "id-mock"),
}));

describe("runPreScript", () => {
  const baseRequest: ScriptRequestContext = {
    url: "https://a.test",
    method: "GET",
    headers: [{ id: "h1", key: "X-Old", value: "1", enabled: true }],
    body: { type: "json", content: "{}" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error and echoes request when script is empty", () => {
    const env = { store: {} as Record<string, string> };
    const out = runPreScript(
      "   ",
      baseRequest,
      (k) => env.store[k],
      (k, v) => {
        env.store[k] = v;
      }
    );
    expect(out.error).toBeUndefined();
    expect(out.logs).toEqual([]);
    expect(out.requestOverrides?.url).toBe("https://a.test");
  });

  it("captures console output and mutations to request", () => {
    const env = { store: {} as Record<string, string> };
    const script = `
      console.log("hi", { a: 1 });
      console.warn("w");
      requestly.request.url.set("https://b.test");
      requestly.request.headers.set("X-Old", "2");
      requestly.request.headers.set("X-New", "3");
      requestly.request.body.set("{}");
    `;
    const out = runPreScript(
      script,
      baseRequest,
      (k) => env.store[k],
      (k, v) => {
        env.store[k] = v;
      }
    );
    expect(out.error).toBeUndefined();
    expect(out.logs[0]).toContain("hi");
    expect(out.logs[1]).toMatch(/^\[warn\]/);
    expect(out.requestOverrides?.url).toBe("https://b.test");
    const headers = out.requestOverrides?.headers ?? [];
    expect(headers.find((h) => h.key === "X-Old")?.value).toBe("2");
    expect(headers.find((h) => h.key === "X-New")?.value).toBe("3");
    expect(out.requestOverrides?.body?.content).toBe("{}");
  });

  it("returns script error message when evaluation throws", () => {
    const out = runPreScript(
      "throw new Error('boom');",
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.error).toBe("boom");
    expect(out.logs).toEqual([]);
  });

  it("writes environment.set values through the provided setter and reads them back", () => {
    const env = { store: {} as Record<string, string> };
    const out = runPreScript(
      'requestly.environment.set("K", "v"); console.log(requestly.environment.get("K"));',
      baseRequest,
      (k) => env.store[k],
      (k, v) => {
        env.store[k] = v;
      }
    );
    expect(env.store.K).toBe("v");
    expect(out.logs).toEqual(["v"]);
  });

  it("returns an empty string from environment.get for an unknown key", () => {
    const out = runPreScript(
      'console.log(JSON.stringify(requestly.environment.get("MISSING")));',
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(['""']);
  });

  it("prefixes console levels other than log and leaves log unprefixed", () => {
    const out = runPreScript(
      'console.log("l"); console.info("i"); console.warn("w"); console.error("e", 1, null, undefined);',
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual([
      "l",
      "[info] i",
      "[warn] w",
      "[error] e 1 null undefined",
    ]);
  });

  it("reads, deletes and re-reads headers case-insensitively", () => {
    const out = runPreScript(
      `
      console.log(requestly.request.headers.get("x-OLD"));
      requestly.request.headers.delete("X-OLD");
      console.log(String(requestly.request.headers.get("X-Old")));
      requestly.request.headers.delete("Never-There");
      `,
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(["1", "undefined"]);
    expect(out.requestOverrides?.headers).toEqual([]);
  });

  it("does not mutate the original request context", () => {
    runPreScript(
      'requestly.request.headers.set("X-Old", "changed"); requestly.request.body.set("new"); requestly.request.url.set("https://c.test");',
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(baseRequest.headers[0].value).toBe("1");
    expect(baseRequest.body.content).toBe("{}");
    expect(baseRequest.url).toBe("https://a.test");
  });

  it("exposes current url and body to the script via getters", () => {
    const out = runPreScript(
      "console.log(requestly.request.url.get(), requestly.request.body.get());",
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(["https://a.test {}"]);
  });

  it("does not wait for async work: logs after an await are not captured and no error is reported", () => {
    // Characterization: execute() is synchronous and ignores the returned promise.
    const out = runPreScript(
      `(async () => {
        console.log("before");
        await Promise.resolve();
        console.log("after");
      })();`,
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.error).toBeUndefined();
    expect(out.logs).toEqual(["before"]);
  });

  it("does not surface a rejected promise as a script error", () => {
    // Characterization: rejections raised outside the synchronous call are invisible to the runner.
    const out = runPreScript(
      'Promise.reject(new Error("late")).catch(() => {});',
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.error).toBeUndefined();
  });

  it("imposes no iteration guard on long-running synchronous loops", () => {
    // Characterization only: an unbounded loop would hang the tab, so a large finite loop stands in.
    const out = runPreScript(
      "let n = 0; for (let i = 0; i < 2000000; i++) { n += 1; } console.log(n);",
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.error).toBeUndefined();
    expect(out.logs).toEqual(["2000000"]);
  });

  it("does not sandbox scripts: they can reach globals such as globalThis", () => {
    // Characterization: scripts run via new Function with full global access.
    const out = runPreScript(
      "console.log(typeof globalThis.setTimeout);",
      baseRequest,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(["function"]);
  });
});

describe("runPostScript", () => {
  const response = {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    body: '{"x":true}',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes response helpers and parses JSON", () => {
    const out = runPostScript(
      "const j = requestly.response.json(); console.log(j.x);",
      response,
      () => undefined,
      () => {}
    );
    expect(out.error).toBeUndefined();
    expect(out.logs).toEqual(["true"]);
  });

  it("reads headers case-insensitively", () => {
    const out = runPostScript(
      'console.log(requestly.response.headers.get("Content-Type"));',
      response,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(["application/json"]);
  });

  it("reports a parse error message when response.json() gets invalid JSON", () => {
    const out = runPostScript(
      "requestly.response.json();",
      { ...response, body: "not json" },
      () => undefined,
      () => {}
    );
    expect(out.error).toMatch(/JSON/i);
  });

  it("exposes status, statusText and raw text of the response", () => {
    const out = runPostScript(
      "console.log(requestly.response.status, requestly.response.statusText, requestly.response.text());",
      response,
      () => undefined,
      () => {}
    );
    expect(out.logs).toEqual(['200 OK {"x":true}']);
  });

  it("returns error when script throws", () => {
    const out = runPostScript(
      "requestly.response.json(",
      response,
      () => undefined,
      () => {}
    );
    expect(out.error).toBeTruthy();
  });
});
