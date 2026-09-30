import { describe, expect, it, beforeEach, vi } from "vitest";
import { validateSchema } from "@/lib/schemaValidator";

describe("validateSchema", () => {
  // Basic type validation
  it("passes when type matches", async () => {
    const result = await validateSchema("hello", { type: "string" });
    expect(result.valid).toBe(true);
  });

  it("fails when type does not match", async () => {
    const result = await validateSchema(42, { type: "string" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe("$");
  });

  it("accepts number for number type (including integers)", async () => {
    const result1 = await validateSchema(1.5, { type: "number" });
    const result2 = await validateSchema(1, { type: "number" });
    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
  });

  // Required properties
  it("reports missing required properties", async () => {
    const result = await validateSchema(
      { name: "x" },
      {
        type: "object",
        required: ["name", "age"],
        properties: { name: { type: "string" } },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("$.age");
    expect(result.errors[0].message).toContain("required");
  });

  it("passes when all required properties present", async () => {
    const result = await validateSchema(
      { name: "x", age: 1 },
      {
        type: "object",
        required: ["name", "age"],
        properties: { name: { type: "string" }, age: { type: "number" } },
      },
    );
    expect(result.valid).toBe(true);
  });

  // Nested properties
  it("recurses into nested properties", async () => {
    const result = await validateSchema(
      { user: { id: "not-a-number" } },
      {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: { id: { type: "number" } },
          },
        },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe("$.user.id");
  });

  // Array validation
  it("validates array items", async () => {
    const result = await validateSchema([1, "two", 3], {
      type: "array",
      items: { type: "number" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe("$[1]");
  });

  it("passes when array items all match", async () => {
    const result = await validateSchema([1, 2, 3], {
      type: "array",
      items: { type: "number" },
    });
    expect(result.valid).toBe(true);
  });

  // Enum validation
  it("enforces enum membership", async () => {
    const result = await validateSchema("c", { enum: ["a", "b"] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("allowed");
  });

  it("passes when value is in enum", async () => {
    const result = await validateSchema("a", { enum: ["a", "b"] });
    expect(result.valid).toBe(true);
  });

  it("handles enum with objects in different key order", async () => {
    const obj1 = { x: 1, y: 2 };
    const obj2 = { y: 2, x: 1 }; // Different order, but same content

    const result = await validateSchema(obj2, { enum: [obj1] });
    // Both should normalize to the same JSON string representation
    expect(result.valid).toBe(true);
  });

  // Schema as JSON string
  it("accepts a schema passed as a JSON string", async () => {
    const result = await validateSchema(5, JSON.stringify({ type: "number" }));
    expect(result.valid).toBe(true);
  });

  // Malformed schema JSON
  it("reports an error for malformed schema JSON instead of throwing", async () => {
    const result = await validateSchema(5, "{not valid json");
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("invalid schema JSON");
  });

  // Type mismatch stops downstream checks
  it("bails out of nested checks on type mismatch", async () => {
    const result = await validateSchema("not-an-object", {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("$");
  });

  // New tests for AJV features

  // minLength
  it("enforces minLength constraint", async () => {
    const result = await validateSchema("ab", {
      type: "string",
      minLength: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("fewer");
  });

  it("passes minLength when string is long enough", async () => {
    const result = await validateSchema("abc", {
      type: "string",
      minLength: 3,
    });
    expect(result.valid).toBe(true);
  });

  // maxLength
  it("enforces maxLength constraint", async () => {
    const result = await validateSchema("abcd", {
      type: "string",
      maxLength: 3,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("more");
  });

  it("passes maxLength when string is short enough", async () => {
    const result = await validateSchema("abc", {
      type: "string",
      maxLength: 3,
    });
    expect(result.valid).toBe(true);
  });

  // pattern (regex)
  it("enforces pattern constraint", async () => {
    const result = await validateSchema("abc123", {
      type: "string",
      pattern: "^[0-9]+$",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("match");
  });

  it("passes pattern when string matches", async () => {
    const result = await validateSchema("12345", {
      type: "string",
      pattern: "^[0-9]+$",
    });
    expect(result.valid).toBe(true);
  });

  // format (email)
  it("enforces format constraint (email)", async () => {
    const result = await validateSchema("not-an-email", {
      type: "string",
      format: "email",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("format");
  });

  it("passes format when email is valid", async () => {
    const result = await validateSchema("user@example.com", {
      type: "string",
      format: "email",
    });
    expect(result.valid).toBe(true);
  });

  // oneOf
  it("enforces oneOf constraint", async () => {
    const result = await validateSchema(3, {
      oneOf: [{ type: "string" }, { type: "number", enum: [1, 2] }],
    });
    expect(result.valid).toBe(false);
  });

  it("passes oneOf when exactly one schema matches", async () => {
    const result = await validateSchema("hello", {
      oneOf: [{ type: "string" }, { type: "number" }],
    });
    expect(result.valid).toBe(true);
  });

  // $ref with definitions
  it("resolves $ref from definitions", async () => {
    const schema = {
      type: "object",
      properties: {
        user: { $ref: "#/definitions/User" },
      },
      definitions: {
        User: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    };

    const result = await validateSchema({ user: { name: "Alice" } }, schema);
    expect(result.valid).toBe(true);
  });

  it("fails $ref when referenced schema validation fails", async () => {
    const schema = {
      type: "object",
      properties: {
        user: { $ref: "#/definitions/User" },
      },
      definitions: {
        User: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    };

    const result = await validateSchema(
      { user: { age: 30 } }, // missing required 'name'
      schema,
    );
    expect(result.valid).toBe(false);
  });

  // additionalProperties
  it("enforces additionalProperties: false", async () => {
    const result = await validateSchema(
      { name: "Alice", extra: "field" },
      {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: false,
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toContain("extra");
  });

  it("allows additionalProperties when true", async () => {
    const result = await validateSchema(
      { name: "Alice", extra: "field" },
      {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: true,
      },
    );
    expect(result.valid).toBe(true);
  });

  // Invalid schema (compile error)
  it("returns error for invalid schema (bad type value)", async () => {
    const result = await validateSchema(5, {
      type: "notatype", // Invalid type
    } as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("invalid schema");
  });

  // Cache reuse — same schema string should reuse compiled validator
  it("caches compiled validators and reuses them", async () => {
    const schema = JSON.stringify({ type: "string" });

    // First call compiles
    const result1 = await validateSchema("hello", schema);
    expect(result1.valid).toBe(true);

    // Second call with same schema string should use cache
    const result2 = await validateSchema("world", schema);
    expect(result2.valid).toBe(true);

    // Both should be valid
    expect(result1.valid).toBe(result2.valid);
  });

  // Ensure different schemas are compiled separately
  it("compiles different schemas separately", async () => {
    const schema1 = { type: "string" };
    const schema2 = { type: "number" };

    const result1 = await validateSchema("hello", schema1);
    const result2 = await validateSchema(42, schema2);

    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
  });

  // Test with unknown keywords (strict: false)
  it("tolerates unknown keywords (OpenAPI-ish schemas)", async () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "integer", description: "User ID" },
        name: { type: "string", example: "John Doe" },
      },
      required: ["id"],
      title: "User",
      unknownKeyword: "should be ignored",
    };

    const result = await validateSchema({ id: 1, name: "John" }, schema);
    expect(result.valid).toBe(true);
  });

  // JSON Pointer path escaping (~ and / in property names)
  it("handles JSON Pointer escaping in paths", async () => {
    const schema = {
      type: "object",
      properties: {
        "data/special": {
          type: "object",
          properties: {
            "key~value": { type: "string" },
          },
          required: ["key~value"],
        },
      },
    };

    const result = await validateSchema(
      { "data/special": { other: "field" } },
      schema,
    );
    expect(result.valid).toBe(false);
    // Path should properly escape the special characters
    expect(result.errors[0].path).toContain("data/special");
  });
});
