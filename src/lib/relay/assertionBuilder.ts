import { generateId } from "@/lib/utils";
import type { ResponseData } from "@/types";
import type { ChainAssertion } from "@/types/chain";
import { isSensitiveName } from "./redact";

/**
 * Builds the no-code assertions a request stores in its `assertions` list
 * (the same `ChainAssertion` shape the Assertions tab edits) from a response.
 * Only structure is asserted, never values, so no secret can be copied into a
 * saved test (NFR-1); the list is capped.
 */

export const ASSERTION_FIELDS_MAX = 5;
const CONTENT_TYPE = "content-type";
const SIMPLE_KEY = /^[A-Za-z_][\w]*$/;

type Source = Pick<ResponseData, "status" | "headers" | "body">;

function mediaType(headers: Record<string, string>): string | null {
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === CONTENT_TYPE,
  );
  return entry?.[1].split(";")[0].trim() || null;
}

function topLevelKeys(body: string): string[] {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    return Object.keys(parsed).filter(
      (key) => SIMPLE_KEY.test(key) && !isSensitiveName(key),
    );
  } catch {
    return [];
  }
}

export function buildAssertions(
  response: Source,
  makeId: () => string = generateId,
): ChainAssertion[] {
  const assertions: ChainAssertion[] = [
    {
      id: makeId(),
      source: "status",
      operator: "eq",
      expectedValue: String(response.status),
      enabled: true,
    },
  ];
  const type = mediaType(response.headers);
  if (type) {
    assertions.push({
      id: makeId(),
      source: "header",
      sourcePath: CONTENT_TYPE,
      operator: "contains",
      expectedValue: type,
      enabled: true,
    });
  }
  for (const key of topLevelKeys(response.body).slice(
    0,
    ASSERTION_FIELDS_MAX,
  )) {
    assertions.push({
      id: makeId(),
      source: "jsonpath",
      sourcePath: `$.${key}`,
      operator: "exists",
      enabled: true,
    });
  }
  return assertions;
}
