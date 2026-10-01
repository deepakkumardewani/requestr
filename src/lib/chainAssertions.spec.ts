import { describe, expect, it } from "vitest";
import type { ResponseData } from "@/types";
import type { ChainAssertion } from "@/types/chain";
import {
  assertionsSummary,
  evaluateAllAssertions,
  evaluateAssertion,
  evaluateSchemaAssertion,
  getOperatorsForSource,
} from "./chainAssertions";

function response(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: { "X-Test": "1" },
    body: '{"id":42,"name":"Ada"}',
    duration: 0,
    size: 0,
    url: "",
    method: "GET",
    timestamp: 0,
    ...overrides,
  };
}

function assert(
  overrides: Partial<ChainAssertion> & Pick<ChainAssertion, "id" | "operator">,
): ChainAssertion {
  return {
    id: overrides.id,
    operator: overrides.operator,
    source: overrides.source ?? "status",
    sourcePath: overrides.sourcePath,
    expectedValue: overrides.expectedValue,
    enabled: overrides.enabled ?? true,
    schema: overrides.schema,
  };
}

describe("evaluateAssertion", () => {
  it("compares status with eq / neq", () => {
    const res = response({ status: 201 });
    expect(
      evaluateAssertion(
        assert({ id: "1", operator: "eq", expectedValue: "201" }),
        res,
      ),
    ).toEqual({ passed: true, actual: "201" });
    expect(
      evaluateAssertion(
        assert({ id: "1", operator: "neq", expectedValue: "200" }),
        res,
      ),
    ).toEqual({ passed: true, actual: "201" });
  });

  it("reads jsonpath and supports contains / not_contains", () => {
    const res = response();
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "contains",
          source: "jsonpath",
          sourcePath: "$.name",
          expectedValue: "Ad",
        }),
        res,
      ).passed,
    ).toBe(true);
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "not_contains",
          source: "jsonpath",
          sourcePath: "$.name",
          expectedValue: "zzz",
        }),
        res,
      ).passed,
    ).toBe(true);
  });

  it("returns not_contains true when jsonpath misses", () => {
    const res = response({ body: "{}" });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "not_contains",
          source: "jsonpath",
          sourcePath: "$.missing",
          expectedValue: "x",
        }),
        res,
      ).passed,
    ).toBe(true);
  });

  it("header source is case-insensitive on key", () => {
    const res = response({
      headers: { "X-Auth": "Bearer z" },
    });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "eq",
          source: "header",
          sourcePath: "x-auth",
          expectedValue: "Bearer z",
        }),
        res,
      ).passed,
    ).toBe(true);
  });

  it("gt / lt compare numeric strings", () => {
    const res = response({ body: '{"n":"10"}' });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "gt",
          source: "jsonpath",
          sourcePath: "$.n",
          expectedValue: "3",
        }),
        res,
      ).passed,
    ).toBe(true);
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "lt",
          source: "jsonpath",
          sourcePath: "$.n",
          expectedValue: "99",
        }),
        res,
      ).passed,
    ).toBe(true);
  });

  it("exists / not_exists reflect null extraction", () => {
    const res = response({ body: "{}" });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "exists",
          source: "jsonpath",
          sourcePath: "$.x",
        }),
        res,
      ).passed,
    ).toBe(false);
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "not_exists",
          source: "jsonpath",
          sourcePath: "$.x",
        }),
        res,
      ).passed,
    ).toBe(true);
  });

  it("matches_regex passes or fails and invalid regex yields failure", () => {
    const res = response({ body: '{"email":"a@b.c"}' });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "matches_regex",
          source: "jsonpath",
          sourcePath: "$.email",
          expectedValue: "^[^@]+@",
        }),
        res,
      ).passed,
    ).toBe(true);
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "matches_regex",
          source: "jsonpath",
          sourcePath: "$.email",
          expectedValue: "[",
        }),
        res,
      ).passed,
    ).toBe(false);
  });

  it("invalid JSON body yields null actual for jsonpath", () => {
    const res = response({ body: "not json" });
    expect(
      evaluateAssertion(
        assert({
          id: "1",
          operator: "eq",
          source: "jsonpath",
          sourcePath: "$.x",
          expectedValue: "1",
        }),
        res,
      ),
    ).toEqual({ passed: false, actual: null });
  });
});

describe("evaluateAllAssertions", () => {
  it("skips disabled assertions", () => {
    const res = response({ status: 404 });
    const results = evaluateAllAssertions(
      [
        assert({ id: "a", operator: "eq", expectedValue: "404" }),
        assert({
          id: "b",
          operator: "eq",
          expectedValue: "200",
          enabled: false,
        }),
      ],
      res,
    );
    expect(results).toHaveLength(1);
    expect(results[0].assertionId).toBe("a");
  });
});

describe("getOperatorsForSource", () => {
  it("returns only exists/not_exists for schema", () => {
    expect(getOperatorsForSource("schema")).toEqual(["exists", "not_exists"]);
  });

  it("excludes string-only operators for status", () => {
    const ops = getOperatorsForSource("status");
    expect(ops).toEqual(expect.arrayContaining(["eq", "neq"]));
    expect(ops).not.toContain("contains");
    expect(ops).not.toContain("not_contains");
    expect(ops).not.toContain("matches_regex");
  });

  it("returns the full operator set for jsonpath/header", () => {
    expect(getOperatorsForSource("jsonpath").length).toBeGreaterThan(2);
    expect(getOperatorsForSource("header").length).toBeGreaterThan(2);
  });
});

describe("evaluateSchemaAssertion", () => {
  const schema = JSON.stringify({
    type: "object",
    required: ["id"],
    properties: { id: { type: "number" } },
  });

  it("passes when the response matches the schema and operator is exists", async () => {
    const res = response({ body: '{"id":42,"name":"Ada"}' });
    const result = await evaluateSchemaAssertion(
      assert({ id: "1", operator: "exists", source: "schema", schema }),
      res,
    );
    expect(result).toEqual({ passed: true, actual: "valid" });
  });

  it("fails when the response doesn't match the schema and operator is exists", async () => {
    const res = response({ body: '{"name":"Ada"}' });
    const result = await evaluateSchemaAssertion(
      assert({ id: "1", operator: "exists", source: "schema", schema }),
      res,
    );
    expect(result.passed).toBe(false);
    expect(result.actual).not.toBe("valid");
  });

  it("inverts the outcome for not_exists", async () => {
    const res = response({ body: '{"name":"Ada"}' });
    const result = await evaluateSchemaAssertion(
      assert({ id: "1", operator: "not_exists", source: "schema", schema }),
      res,
    );
    expect(result.passed).toBe(true);
  });

  it("fails gracefully when the response body isn't JSON", async () => {
    const res = response({ body: "not json" });
    const result = await evaluateSchemaAssertion(
      assert({ id: "1", operator: "exists", source: "schema", schema }),
      res,
    );
    expect(result).toEqual({
      passed: false,
      actual: "response body is not valid JSON",
    });
  });
});

describe("assertionsSummary", () => {
  it("aggregates pass and fail counts", () => {
    expect(
      assertionsSummary([
        { assertionId: "a", passed: true, actual: "1" },
        { assertionId: "b", passed: false, actual: null },
        { assertionId: "c", passed: true, actual: "x" },
      ]),
    ).toEqual({ passed: 2, failed: 1, total: 3 });
  });
});
