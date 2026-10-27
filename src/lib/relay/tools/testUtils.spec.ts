import { describe, expect, it } from "vitest";
import { relayToolRegistry } from "./registry";
import { RELAY_TOOL_SCHEMAS } from "./schemas";
import { getRegisteredToolNames } from "./testUtils";

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const UNKNOWN_TOOL = "definitely_not_a_relay_tool";

describe("getRegisteredToolNames", () => {
  it("returns a non-empty list of names", () => {
    expect(getRegisteredToolNames().length).toBeGreaterThan(0);
  });

  it("does not include an unknown tool", () => {
    expect(getRegisteredToolNames()).not.toContain(UNKNOWN_TOOL);
  });

  it("returns unique names", () => {
    const names = getRegisteredToolNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it("returns only snake_case names", () => {
    const offenders = getRegisteredToolNames().filter((name) => !SNAKE_CASE.test(name));
    expect(offenders).toEqual([]);
  });

  it("matches the names declared in the tool schemas", () => {
    expect([...getRegisteredToolNames()].sort()).toEqual(Object.keys(RELAY_TOOL_SCHEMAS).sort());
  });

  it("reflects the registry and returns a fresh array each call", () => {
    const first = getRegisteredToolNames();
    first.push(UNKNOWN_TOOL);
    expect(getRegisteredToolNames()).not.toContain(UNKNOWN_TOOL);
    expect(getRegisteredToolNames()).toHaveLength(relayToolRegistry.size);
  });
});
