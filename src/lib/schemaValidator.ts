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

export type SchemaValidationResult = {
  valid: boolean;
  errors: SchemaValidationError[];
};

// Loose type for user-provided schemas; ajv will validate structure
export type JsonSchema = Record<string, unknown>;

// Max number of cached compiled validators
const VALIDATOR_CACHE_SIZE = 50;

// Lazy-loaded ajv singleton (promise)
let ajvPromise: Promise<Ajv> | null = null;

// Compiled validators keyed by schema string
const validatorCache = new Map<string, ValidateFunction>();
const cacheKeys: string[] = [];

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
  if (!pointer || pointer === "") return "$";

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
 * Compile and cache a validator for the given schema.
 * If cache is full (>= VALIDATOR_CACHE_SIZE), evict the oldest entry.
 */
async function getCachedValidator(
  schemaStr: string,
  ajv: Ajv,
): Promise<ValidateFunction> {
  const cached = validatorCache.get(schemaStr);
  if (cached) {
    return cached;
  }

  let schema: unknown;
  try {
    schema = JSON.parse(schemaStr);
  } catch (_err) {
    // This will be caught by caller as invalid schema JSON
    throw new Error("invalid schema JSON");
  }

  // Compile the schema
  let validator: ValidateFunction;
  try {
    validator = ajv.compile(schema as Record<string, unknown>);
  } catch (err) {
    throw new Error(
      `invalid schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Cache it
  if (validatorCache.size >= VALIDATOR_CACHE_SIZE) {
    const oldestKey = cacheKeys.shift();
    if (oldestKey) validatorCache.delete(oldestKey);
  }

  validatorCache.set(schemaStr, validator);
  cacheKeys.push(schemaStr);

  return validator;
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

  let schemaStr: string;
  if (typeof schema === "string") {
    // Validate that schema JSON is parseable
    try {
      JSON.parse(schema);
    } catch (err) {
      return {
        valid: false,
        errors: [
          {
            path: "$",
            message: `invalid schema JSON: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
    schemaStr = schema;
  } else {
    schemaStr = JSON.stringify(schema);
  }

  // Get or compile validator
  let validator: ValidateFunction;
  try {
    validator = await getCachedValidator(schemaStr, ajv);
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          path: "$",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  // Validate data
  const valid = validator(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  // AJV stores errors in the validator's errors array
  const ajvErrors =
    (validator.errors as Array<{
      instancePath: string;
      message: string;
      keyword?: string;
      params?: Record<string, unknown>;
    }>) ?? [];
  const errors = mapAjvErrors(ajvErrors);

  return {
    valid: false,
    errors:
      errors.length > 0
        ? errors
        : [{ path: "$", message: "validation failed" }],
  };
}
