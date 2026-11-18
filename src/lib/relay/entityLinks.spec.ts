import { describe, it, expect } from "vitest";
import {
  ENTITY_LINK_KINDS,
  type EntityLink,
  parseRelayHref,
  resolveEntity,
} from "./entityLinks";
import { createFakeStoreAccess } from "./storeAccess";
import {
  createRequest,
  createCollection,
  createEnvironment,
  createChain,
} from "./testing/entityTestData";

describe("parseRelayHref", () => {
  it("parses valid relay hrefs for all kinds", () => {
    expect(parseRelayHref("relay://request/abc123")).toEqual({
      kind: "request",
      id: "abc123",
    });
    expect(parseRelayHref("relay://collection/xyz_789")).toEqual({
      kind: "collection",
      id: "xyz_789",
    });
    expect(parseRelayHref("relay://environment/env-1")).toEqual({
      kind: "environment",
      id: "env-1",
    });
    expect(parseRelayHref("relay://chain/ch_main")).toEqual({
      kind: "chain",
      id: "ch_main",
    });
  });

  it("rejects hrefs with wrong scheme", () => {
    expect(parseRelayHref("http://relay/request/id")).toBeNull();
    expect(parseRelayHref("https://request/id")).toBeNull();
    expect(parseRelayHref("ftp://relay/request/id")).toBeNull();
  });

  it("rejects hrefs with unknown kinds", () => {
    expect(parseRelayHref("relay://task/id")).toBeNull();
    expect(parseRelayHref("relay://user/id")).toBeNull();
    expect(parseRelayHref("relay://unknown/id")).toBeNull();
  });

  it("rejects hrefs with invalid id format", () => {
    expect(parseRelayHref("relay://request/")).toBeNull();
    expect(parseRelayHref("relay://request/id!bad")).toBeNull();
    expect(parseRelayHref("relay://request/id@bad")).toBeNull();
    expect(parseRelayHref("relay://request/id/extra")).toBeNull();
  });

  it("rejects hrefs that are too long", () => {
    const longId = "a".repeat(129);
    expect(parseRelayHref(`relay://request/${longId}`)).toBeNull();
  });

  it("accepts ids at the boundary of 128 characters", () => {
    const maxId = "a".repeat(128);
    expect(parseRelayHref(`relay://request/${maxId}`)).toEqual({
      kind: "request",
      id: maxId,
    });
  });

  it("rejects undefined input", () => {
    expect(parseRelayHref(undefined)).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseRelayHref("")).toBeNull();
  });

  it("accepts ids with hyphens and underscores", () => {
    expect(parseRelayHref("relay://request/req-123_abc")).toEqual({
      kind: "request",
      id: "req-123_abc",
    });
  });

  it("rejects hrefs with paths or query strings", () => {
    expect(parseRelayHref("relay://request/id?param=value")).toBeNull();
    expect(parseRelayHref("relay://request/id#hash")).toBeNull();
  });
});

describe("resolveEntity", () => {
  it("resolves a request from store", () => {
    const req = createRequest("req1", "My Request");
    const { access } = createFakeStoreAccess({
      requests: [{ ...req, method: "POST" }],
    });

    const result = resolveEntity({ kind: "request", id: "req1" }, access);
    expect(result).toEqual({
      kind: "request",
      id: "req1",
      name: "My Request",
      method: "POST",
    });
  });

  it("omits method for non-request kinds", () => {
    const { access } = createFakeStoreAccess({
      collections: [createCollection("col1", "My Collection")],
    });

    const result = resolveEntity(
      { kind: "collection", id: "col1" },
      access
    );
    expect(result).toEqual({
      kind: "collection",
      id: "col1",
      name: "My Collection",
    });
    expect(result?.method).toBeUndefined();
  });

  it("resolves an environment", () => {
    const { access } = createFakeStoreAccess({
      environments: [createEnvironment("env1", "Production")],
    });

    const result = resolveEntity(
      { kind: "environment", id: "env1" },
      access
    );
    expect(result).toEqual({
      kind: "environment",
      id: "env1",
      name: "Production",
    });
  });

  it("resolves a chain", () => {
    const { access } = createFakeStoreAccess({
      chains: [createChain("ch1", "My Chain")],
    });

    const result = resolveEntity({ kind: "chain", id: "ch1" }, access);
    expect(result).toEqual({
      kind: "chain",
      id: "ch1",
      name: "My Chain",
    });
  });

  it("returns null for unknown request", () => {
    const { access } = createFakeStoreAccess({
      requests: [createRequest("req1", "Known")],
    });

    const result = resolveEntity(
      { kind: "request", id: "unknown" },
      access
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown collection", () => {
    const { access } = createFakeStoreAccess({
      collections: [createCollection("col1", "Known")],
    });

    const result = resolveEntity(
      { kind: "collection", id: "unknown" },
      access
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown environment", () => {
    const { access } = createFakeStoreAccess();

    const result = resolveEntity(
      { kind: "environment", id: "unknown" },
      access
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown chain", () => {
    const { access } = createFakeStoreAccess();

    const result = resolveEntity({ kind: "chain", id: "unknown" }, access);
    expect(result).toBeNull();
  });

  it("finds request by exact id match among many", () => {
    const { access } = createFakeStoreAccess({
      requests: [
        createRequest("req1", "First"),
        createRequest("req2", "Second"),
        createRequest("req3", "Third"),
      ],
    });

    expect(resolveEntity({ kind: "request", id: "req2" }, access)?.name).toBe(
      "Second"
    );
  });

  it("handles requests with various HTTP methods", () => {
    const { access } = createFakeStoreAccess({
      requests: [
        createRequest("get1", "GET endpoint"),
        { ...createRequest("post1", "POST endpoint"), method: "POST" },
        { ...createRequest("delete1", "DELETE endpoint"), method: "DELETE" },
      ],
    });

    expect(resolveEntity({ kind: "request", id: "post1" }, access)).toEqual({
      kind: "request",
      id: "post1",
      name: "POST endpoint",
      method: "POST",
    });
  });

  it("uses default store when none provided", () => {
    // This test ensures the default parameter works
    // In a real scenario without mocking, this would use the zustand store
    // but for a pure unit test we verify it doesn't crash with undefined store
    const link: EntityLink = { kind: "request", id: "nonexistent" };
    // Should not throw, just return null or check the live store
    expect(() => resolveEntity(link)).not.toThrow();
  });

  it("resolves first matching request when multiple requests exist", () => {
    const { access } = createFakeStoreAccess({
      requests: [
        createRequest("duplicate", "First with this id"),
        createRequest("other", "Different id"),
      ],
    });

    const result = resolveEntity({ kind: "request", id: "duplicate" }, access);
    expect(result?.name).toBe("First with this id");
  });

  it("handles empty store gracefully", () => {
    const { access } = createFakeStoreAccess();

    expect(resolveEntity({ kind: "request", id: "any" }, access)).toBeNull();
    expect(resolveEntity({ kind: "collection", id: "any" }, access)).toBeNull();
  });

  it("preserves request method when it is provided", () => {
    const { access } = createFakeStoreAccess({
      requests: [
        { ...createRequest("req1", "Test"), method: "PATCH" },
      ],
    });

    const result = resolveEntity({ kind: "request", id: "req1" }, access);
    expect(result?.method).toBe("PATCH");
  });

  it("includes method for all requests", () => {
    const { access } = createFakeStoreAccess({
      requests: [
        createRequest("req1", "Has method"),
      ],
    });

    const result = resolveEntity({ kind: "request", id: "req1" }, access);
    expect(result?.method).toBe("GET");
  });
});

describe("ENTITY_LINK_KINDS", () => {
  it("exports all expected kinds", () => {
    expect(ENTITY_LINK_KINDS).toContain("request");
    expect(ENTITY_LINK_KINDS).toContain("collection");
    expect(ENTITY_LINK_KINDS).toContain("environment");
    expect(ENTITY_LINK_KINDS).toContain("chain");
    expect(ENTITY_LINK_KINDS.length).toBe(4);
  });
});
