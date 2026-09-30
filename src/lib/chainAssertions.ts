import { JSONPath } from "jsonpath-plus";
import { validateSchema } from "@/lib/schemaValidator";
import type { ResponseData } from "@/types";
import type {
  AssertionOperator,
  AssertionResult,
  ChainAssertion,
} from "@/types/chain";

/**
 * Extract the actual value for an assertion based on its source type.
 */
function extractActualValue(
  assertion: ChainAssertion,
  response: ResponseData,
): string | null {
  if (assertion.source === "status") {
    return String(response.status);
  }

  if (assertion.source === "jsonpath") {
    if (!assertion.sourcePath) return null;
    try {
      const parsed = JSON.parse(response.body);
      const result = JSONPath({ path: assertion.sourcePath, json: parsed });
      return Array.isArray(result) && result.length > 0
        ? String(result[0])
        : null;
    } catch {
      return null;
    }
  }

  if (assertion.source === "header") {
    if (!assertion.sourcePath) return null;
    const lowerKey = assertion.sourcePath.toLowerCase();
    const entry = Object.entries(response.headers).find(
      ([k]) => k.toLowerCase() === lowerKey,
    );
    return entry ? entry[1] : null;
  }

  // "schema" is validated asynchronously (AJV) — see `evaluateSchemaAssertion`.
  // It has no meaningful synchronous "actual" value.
  return null;
}

/**
 * Evaluate a single assertion against a response.
 * Returns the pass/fail result and the actual value that was tested.
 */
export function evaluateAssertion(
  assertion: ChainAssertion,
  response: ResponseData,
): { passed: boolean; actual: string | null } {
  const actual = extractActualValue(assertion, response);
  const expected = assertion.expectedValue ?? "";

  let passed = false;

  switch (assertion.operator) {
    case "eq":
      passed = actual === expected;
      break;
    case "neq":
      passed = actual !== expected;
      break;
    case "contains":
      passed = actual?.includes(expected) ?? false;
      break;
    case "not_contains":
      passed = actual === null || !actual.includes(expected);
      break;
    case "gt": {
      const numActual = parseFloat(actual ?? "");
      const numExpected = parseFloat(expected);
      passed =
        !Number.isNaN(numActual) &&
        !Number.isNaN(numExpected) &&
        numActual > numExpected;
      break;
    }
    case "lt": {
      const numActual = parseFloat(actual ?? "");
      const numExpected = parseFloat(expected);
      passed =
        !Number.isNaN(numActual) &&
        !Number.isNaN(numExpected) &&
        numActual < numExpected;
      break;
    }
    case "exists":
      passed = actual !== null;
      break;
    case "not_exists":
      passed = actual === null;
      break;
    case "matches_regex": {
      try {
        passed = actual !== null && new RegExp(expected).test(actual);
      } catch {
        // Invalid regex — treat as failure
        passed = false;
      }
      break;
    }
  }

  return { passed, actual };
}

/**
 * Evaluate all enabled assertions against a response.
 */
export function evaluateAllAssertions(
  assertions: ChainAssertion[],
  response: ResponseData,
): AssertionResult[] {
  return assertions
    .filter((a) => a.enabled)
    .map((a) => {
      try {
        const { passed, actual } = evaluateAssertion(a, response);
        return { assertionId: a.id, passed, actual };
      } catch (err) {
        // Unexpected evaluation error — count as failure
        console.error("Assertion evaluation error", { assertionId: a.id, err });
        return { assertionId: a.id, passed: false, actual: null };
      }
    });
}

/**
 * Evaluate a "schema" assertion — validates the response body (parsed as JSON)
 * against `assertion.schema` using the same AJV-based validator the Validate
 * block uses (`src/lib/schemaValidator.ts`). This lets a node validate itself
 * without a separate Validate block.
 *
 * `exists` means "the response matches the schema"; `not_exists` inverts that.
 * The `actual` value is the first validation error message, or `"valid"` when
 * the response conforms.
 */
export async function evaluateSchemaAssertion(
  assertion: ChainAssertion,
  response: ResponseData,
): Promise<{ passed: boolean; actual: string | null }> {
  let data: unknown;
  try {
    data = JSON.parse(response.body);
  } catch {
    return { passed: false, actual: "response body is not valid JSON" };
  }

  const result = await validateSchema(data, assertion.schema ?? "{}");
  const actual = result.valid
    ? "valid"
    : (result.errors[0]?.message ?? "invalid");

  const matchesSchema = result.valid;
  const passed =
    assertion.operator === "not_exists" ? !matchesSchema : matchesSchema;

  return { passed, actual };
}

/**
 * Summarise assertion results into pass/fail/total counts.
 */
export function assertionsSummary(results: AssertionResult[]): {
  passed: number;
  failed: number;
  total: number;
} {
  const passed = results.filter((r) => r.passed).length;
  return { passed, failed: results.length - passed, total: results.length };
}

// ── Operator registry ─────────────────────────────────────────────────────────

/** All valid assertion operators in display order. */
const ALL_ASSERTION_OPERATORS: AssertionOperator[] = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "gt",
  "lt",
  "exists",
  "not_exists",
  "matches_regex",
];

/** Operators that don't require an expected value. */
export const NO_VALUE_OPERATORS = new Set<AssertionOperator>([
  "exists",
  "not_exists",
]);

/** Return the operators valid for a given assertion source. */
export function getOperatorsForSource(
  source: ChainAssertion["source"],
): AssertionOperator[] {
  if (source === "status") {
    // Status is always numeric — filter out string/regex operators
    return ALL_ASSERTION_OPERATORS.filter(
      (op) => !["contains", "not_contains", "matches_regex"].includes(op),
    );
  }
  if (source === "schema") {
    // Schema validation is a boolean outcome — "exists" reads as "matches
    // schema", "not_exists" as "doesn't match schema". No expected value.
    return ["exists", "not_exists"];
  }
  return ALL_ASSERTION_OPERATORS;
}
