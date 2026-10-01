import { describe, expect, it } from "vitest";
import type { RequestModel } from "@/types";
import type { ChainEdge, ChainInjection } from "@/types/chain";
import { isMergeLaneOpen } from "./executors/merge";
import { CHAIN_ERROR_CODE } from "./errorCodes";
import { applyInjection, InjectionError, isEdgeActive } from "./utils";

const edge = (branchId?: string): ChainEdge => ({
  id: "e",
  sourceRequestId: "s",
  targetRequestId: "t",
  injections: [],
  branchId,
});

describe("isEdgeActive", () => {
  it("is inactive for an unresolved or skipped source", () => {
    expect(isEdgeActive(edge(), undefined)).toBe(false);
    expect(isEdgeActive(edge(), { state: "skipped" })).toBe(false);
  });

  it("follows success only from a passed source and fail only from a failed one", () => {
    expect(isEdgeActive(edge("success"), { state: "passed" })).toBe(true);
    expect(isEdgeActive(edge("success"), { state: "failed" })).toBe(false);
    expect(isEdgeActive(edge("fail"), { state: "failed" })).toBe(true);
    expect(isEdgeActive(edge("fail"), { state: "passed" })).toBe(false);
  });

  it("blocks a plain edge from a failed source", () => {
    expect(isEdgeActive(edge(), { state: "failed" })).toBe(false);
    expect(isEdgeActive(edge(), { state: "passed" })).toBe(true);
  });

  it("follows only the winning Condition branch", () => {
    const won = { state: "passed" as const, activeBranchId: "a" };
    expect(isEdgeActive(edge("a"), won)).toBe(true);
    expect(isEdgeActive(edge("b"), won)).toBe(false);
  });
});

describe("isMergeLaneOpen", () => {
  it("never counts an aborted source as an arrived lane", () => {
    expect(isMergeLaneOpen(edge(), { state: "aborted" })).toBe(false);
  });

  it("follows edge routing otherwise", () => {
    expect(isMergeLaneOpen(edge("fail"), { state: "failed" })).toBe(true);
    expect(isMergeLaneOpen(edge("fail"), { state: "passed" })).toBe(false);
  });
});

describe("applyInjection body", () => {
  const injection: ChainInjection = {
    sourceJsonPath: "$.id",
    targetField: "body",
    targetKey: "$.user.id",
  };
  const req = (body: RequestModel["body"]) =>
    ({ url: "https://x.test", headers: [], body }) as unknown as RequestModel;
  const codeOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      return err instanceof InjectionError ? err.code : "other";
    }
    return undefined;
  };

  it.each(["", "   \n"])("treats an empty body (%j) as {}", (content) => {
    const out = applyInjection(req({ type: "json", content }), injection, "7");
    expect(JSON.parse(out.body.content)).toEqual({ user: { id: "7" } });
  });

  it("rejects non-JSON body types with a typed error", () => {
    const run = () =>
      applyInjection(req({ type: "text", content: "{}" }), injection, "7");
    expect(codeOf(run)).toBe(CHAIN_ERROR_CODE.INJECTION_BODY_TYPE_UNSUPPORTED);
  });

  it("reports malformed JSON as body-not-JSON", () => {
    const run = () =>
      applyInjection(req({ type: "json", content: "{oops" }), injection, "7");
    expect(codeOf(run)).toBe(CHAIN_ERROR_CODE.INJECTION_BODY_NOT_JSON);
  });

  it("does not wrap non-parse failures as body-not-JSON", () => {
    const bad = { ...injection, targetKey: "a.b" };
    const run = () =>
      applyInjection(req({ type: "json", content: '{"a":"str"}' }), bad, "7");
    expect(codeOf(run)).toBeUndefined();
  });
});

describe("applyInjection non-body targets", () => {
  const base = (url: string) =>
    ({ url, headers: [], body: { type: "none" } }) as unknown as RequestModel;
  const inject = (
    targetField: ChainInjection["targetField"],
    targetKey: string,
  ): ChainInjection => ({ sourceJsonPath: "$.id", targetField, targetKey });

  it("adds a header, or overwrites an existing one in place", () => {
    const added = applyInjection(base("https://x.test"), inject("header", "X-Id"), "1");
    expect(added.headers).toHaveLength(1);
    expect(added.headers[0]).toMatchObject({ key: "X-Id", value: "1", enabled: true });

    const again = applyInjection(added, inject("header", "X-Id"), "2");
    expect(again.headers).toHaveLength(1);
    expect(again.headers[0].value).toBe("2");
  });

  it("appends a url query param with ? or & and encodes it", () => {
    expect(applyInjection(base("https://x.test"), inject("url", "q"), "a b").url).toBe(
      "https://x.test?q=a%20b",
    );
    expect(applyInjection(base("https://x.test?a=1"), inject("url", "q"), "2").url).toBe(
      "https://x.test?a=1&q=2",
    );
  });

  it("replaces a :placeholder path segment, else appends the value", () => {
    expect(
      applyInjection(base("https://x.test/users/:id"), inject("path", "id"), "7").url,
    ).toBe("https://x.test/users/7");
    expect(
      applyInjection(base("https://x.test/users/"), inject("path", "id"), "7").url,
    ).toBe("https://x.test/users/7");
  });

  it("prefers targetUrl over the request url for path injection", () => {
    expect(
      applyInjection(base("https://ignored"), inject("path", "id"), "7", "https://x.test/:id")
        .url,
    ).toBe("https://x.test/7");
  });

  it("does not mutate the original request", () => {
    const original = base("https://x.test");
    applyInjection(original, inject("header", "X-Id"), "1");
    expect(original.headers).toHaveLength(0);
  });
});
