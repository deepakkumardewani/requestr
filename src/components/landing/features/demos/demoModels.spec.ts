import { describe, expect, it } from "vitest";
import { diffJson } from "@/lib/jsonDiff";
import { nodeRunState } from "./chainRun";
import { flattenDiff } from "./compareRows";
import { authSummary, summarizeCurl } from "./curlSummary";
import { displayVariables } from "./EnvSwitchDemo";
import { branchSummary, childEntries, isBranch } from "./jsonTree";
import { nextCycleIndex } from "./useDemoCycle";

describe("nextCycleIndex", () => {
  it("advances and wraps", () => {
    expect(nextCycleIndex(0, 3)).toBe(1);
    expect(nextCycleIndex(2, 3)).toBe(0);
  });

  it("stays at 0 when there is nothing to cycle", () => {
    expect(nextCycleIndex(4, 0)).toBe(0);
  });
});

describe("flattenDiff", () => {
  it("indents children and records the previous value of a changed leaf", () => {
    const { nodes } = diffJson({ user: { name: "a" }, gone: 1 }, { user: { name: "b" }, added: true });
    const rows = flattenDiff(nodes);
    const name = rows.find((row) => row.key === "name");
    expect(rows.find((row) => row.key === "user")).toMatchObject({ depth: 0, value: "" });
    expect(name).toMatchObject({ kind: "changed", depth: 1, value: '"b"', previous: '"a"' });
    expect(rows.find((row) => row.key === "gone")).toMatchObject({ kind: "removed", value: "1" });
    expect(rows.find((row) => row.key === "added")).toMatchObject({ kind: "added", value: "true" });
  });
});

describe("jsonTree", () => {
  it("summarises branches by size", () => {
    expect(branchSummary([1, 2])).toBe("[2]");
    expect(branchSummary({ a: 1, b: 2, c: 3 })).toBe("{3}");
    expect(branchSummary("x")).toBe('"x"');
  });

  it("lists children with JSONPath-style paths", () => {
    expect(childEntries({ a: [true] }, "$")).toEqual([{ key: "a", path: "$.a", value: [true] }]);
    expect(childEntries([null], "$.a")).toEqual([{ key: "0", path: "$.a[0]", value: null }]);
    expect(childEntries(5, "$")).toEqual([]);
  });

  it("treats only objects and arrays as branches", () => {
    expect(isBranch({})).toBe(true);
    expect(isBranch([])).toBe(true);
    expect(isBranch(null)).toBe(false);
  });
});

describe("nodeRunState", () => {
  it("marks finished, running and waiting nodes", () => {
    expect(nodeRunState(0, 1, true)).toBe("done");
    expect(nodeRunState(1, 1, true)).toBe("running");
    expect(nodeRunState(1, 1, false)).toBe("idle");
    expect(nodeRunState(2, 1, true)).toBe("idle");
  });
});

describe("curlSummary", () => {
  it("parses a command with the app's importer", () => {
    const result = summarizeCurl("curl -X POST https://api.example.com/users -H 'Authorization: Bearer abc'");
    if (!("request" in result)) throw new Error(result.error);
    expect(result.request.method).toBe("POST");
    expect(result.request.url).toContain("api.example.com/users");
  });

  it("turns a malformed command into a message", () => {
    expect(summarizeCurl("not a curl command")).toHaveProperty("error");
  });

  it("labels each auth type", () => {
    expect(authSummary({ type: "none" })).toBe("None");
    expect(authSummary({ type: "bearer", token: "t" })).toBe("Bearer token");
    expect(authSummary({ type: "basic", username: "ada", password: "p" })).toBe("Basic · ada");
    expect(authSummary({ type: "api-key", key: "X-Key", value: "v", addTo: "header" })).toBe("API key · X-Key");
  });
});

describe("displayVariables", () => {
  const variables = { baseUrl: "https://api.example.com", apiKey: "sk_live_1" };

  it("masks secrets until they are shown", () => {
    expect(displayVariables(variables, false).apiKey).not.toBe("sk_live_1");
    expect(displayVariables(variables, false).baseUrl).toBe(variables.baseUrl);
    expect(displayVariables(variables, true)).toEqual(variables);
  });
});
