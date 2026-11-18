/**
 * JSON-Schema validator using AJV (Another JSON Schema Validator).
 *
 * Supports draft-07 JSON Schema with common keywords: type, required, properties, items,
 * enum, minLength, maxLength, pattern, format, oneOf, and $ref via definitions.
 * Unknown keywords are permitted (`strict: false`) for compatibility with user-pasted
 * OpenAPI-ish schemas.
 *
 * Lazy-loads AJV on first use (not in the main bundle). Caches compiled validators
 * in a Map (max 50 schemas) to avoid redundant compilations.
 */

import type Ajv from "ajv";
import type { ValidateFunction } from "ajv";

export type SchemaValidationError = {
  path: string; // e.g. "$.data.id" (JSON Pointer syntax)
  message: string;
};

/**
 * Set when the schema itself is unusable (as opposed to the data not matching),
 * so callers can raise a typed, translatable error instead of showing `errors[0].message`.
 */
export type SchemaProblem = {
  kind: "invalidSchemaJson" | "invalidSchema";
  detail: string;
};

/**
 * `errors[].message` stays English (AJV's own messages are English too); it is a
 * fallback for consumers without an i18n path, such as assertion "actual" text.
 */
export type SchemaValidationResult = {
  valid: boolean;
  errors: SchemaValidationError[];
  schemaProblem?: SchemaProblem;
};

// Loose type for user-provided schemas; ajv will validate structure
export type JsonSchema = Record<string, unknown>;

// Max number of cached compiled validators
const VALIDATOR_CACHE_SIZE = 50;

// Lazy-loaded ajv singleton (promise)
let ajvPromise: Promise<Ajv> | null = null;

// Compiled validators keyed by schema string
// Map preserves insertion order, so the first key is always the oldest entry.
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Initialize and return AJV instance. Lazy-loads on first call.
 * Uses draft-07 (default), allErrors: true (collect all errors), strict: false
 * (allow unknown keywords for user-pasted schemas).
 */
async function getAjv(): Promise<Ajv> {
  if (ajvPromise) return ajvPromise;

  ajvPromise = (async () => {
    const { default: Ajv } = await import("ajv");
    const { default: addFormats } = await import("ajv-formats");

    const ajv = new Ajv({
      allErrors: true,
      strict: false, // Allow unknown keywords (e.g., OpenAPI fields)
    });

    addFormats(ajv);
    return ajv;
  })();

  return ajvPromise;
}

/**
 * Convert JSON Pointer (RFC 6901) to dot notation.
 * E.g. "/data/0/id" -> "$.data[0].id"
 * Unescapes ~1 (/) and ~0 (~).
 */
function pointerToDotNotation(pointer: string): string {
  if (!pointer) return "$";

  const segments = pointer.split("/").slice(1); // Remove leading empty string

  return (
    "$" +
    segments
      .map((seg) => {
        // Unescape JSON Pointer escapes: ~1 = /, ~0 = ~
        const unescaped = seg.replace(/~1/g, "/").replace(/~0/g, "~");

        // If segment is numeric, use array notation; otherwise use dot notation
        if (/^\d+$/.test(unescaped)) {
          return `[${unescaped}]`;
        }
        return `.${unescaped}`;
      })
      .join("")
  );
}

/**
 * Map AJV errors to our SchemaValidationError format.
 * Handles special cases:
 * - required: include missing property in path
 * - additionalProperties: include extra property name in path
 */
function mapAjvErrors(
  ajvErrors: Array<{
    instancePath: string;
    message: string;
    keyword?: string;
    params?: Record<string, unknown>;
  }>,
): SchemaValidationError[] {
  return ajvErrors.map((err) => {
    let path = pointerToDotNotation(err.instancePath);

    // For 'required' keyword, include the missing property name in the path
    if (err.keyword === "required" && err.params?.missingProperty) {
      const prop = err.params.missingProperty as string;
      path = path === "$" ? `$.${prop}` : `${path}.${prop}`;
    }

    // For 'additionalProperties' keyword, include the extra property name in the path
    if (
      err.keyword === "additionalProperties" &&
      err.params?.additionalProperty
    ) {
      const prop = err.params.additionalProperty as string;
      path = path === "$" ? `$.${prop}` : `${path}.${prop}`;
    }

    return {
      path,
      message: err.message ?? "validation failed",
    };
  });
}

/**
 * Compile and cache a validator for the already-parsed `schema`, keyed by `schemaStr`.
 * If cache is full (>= VALIDATOR_CACHE_SIZE), evict the oldest entry.
 */
function getCachedValidator(
  schemaStr: string,
  schema: unknown,
  ajv: Ajv,
): ValidateFunction {
  const cached = validatorCache.get(schemaStr);
  if (cached) return cached;

  // The shared Ajv registers every `$id` it compiles and throws on a repeat (edited
  // schema, re-compile after eviction, or a second block reusing the id). Compiled
  // validators stay valid after removal, so drop the stale registration first.
  const schemaId = (schema as { $id?: unknown } | null)?.$id;
  if (typeof schemaId === "string") ajv.removeSchema(schemaId);

  let validator: ValidateFunction;
  try {
    validator = ajv.compile(schema as Record<string, unknown>);
  } catch (err) {
    throw new Error(errorDetail(err));
  }

  if (validatorCache.size >= VALIDATOR_CACHE_SIZE) {
    const oldestKey = validatorCache.keys().next().value;
    if (oldestKey !== undefined) validatorCache.delete(oldestKey);
  }
  validatorCache.set(schemaStr, validator);

  return validator;
}

function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function invalidSchemaResult(problem: SchemaProblem): SchemaValidationResult {
  const label =
    problem.kind === "invalidSchemaJson"
      ? "invalid schema JSON"
      : "invalid schema";
  return {
    valid: false,
    errors: [{ path: "$", message: `${label}: ${problem.detail}` }],
    schemaProblem: problem,
  };
}

type ParsedSchema =
  | { ok: true; schemaStr: string; parsed: unknown }
  | { ok: false; problem: SchemaProblem };

function parseSchemaInput(schema: JsonSchema | string): ParsedSchema {
  if (typeof schema !== "string") {
    return { ok: true, schemaStr: JSON.stringify(schema), parsed: schema };
  }
  try {
    return { ok: true, schemaStr: schema, parsed: JSON.parse(schema) };
  } catch (err) {
    return {
      ok: false,
      problem: { kind: "invalidSchemaJson", detail: errorDetail(err) },
    };
  }
}

function collectErrors(validator: ValidateFunction): SchemaValidationError[] {
  const ajvErrors =
    (validator.errors as Array<{
      instancePath: string;
      message: string;
      keyword?: string;
      params?: Record<string, unknown>;
    }>) ?? [];
  const errors = mapAjvErrors(ajvErrors);
  // AJV always attaches errors to a failed validation; this only guards against
  // an empty list so a failure is never reported as zero errors.
  return errors.length > 0
    ? errors
    : [{ path: "$", message: "validation failed" }];
}

/**
 * Validates `data` against `schema`. Accepts a raw object or a JSON-encoded schema string
 * (chain blocks store the schema as a string). Malformed schema JSON or compile errors
 * are reported as a single validation error.
 *
 * Returns a Promise since AJV is lazy-loaded on first call.
 */
export async function validateSchema(
  data: unknown,
  schema: JsonSchema | string,
): Promise<SchemaValidationResult> {
  const ajv = await getAjv();

  const input = parseSchemaInput(schema);
  if (!input.ok) return invalidSchemaResult(input.problem);

  let validator: ValidateFunction;
  try {
    validator = getCachedValidator(input.schemaStr, input.parsed, ajv);
  } catch (err) {
    return invalidSchemaResult({
      kind: "invalidSchema",
      detail: errorDetail(err),
    });
  }

  if (validator(data)) return { valid: true, errors: [] };
  return { valid: false, errors: collectErrors(validator) };
}
