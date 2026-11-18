import { describe, expect, it } from "vitest";
import { BLOCKED_GLOBALS, lockdownGlobals } from "@/lib/chainEvalLockdown";

function makeScope() {
  const proto: Record<string, unknown> = {
    indexedDB: {},
    importScripts: () => {},
  };
  const scope = Object.create(proto) as Record<string, unknown>;
  for (const name of BLOCKED_GLOBALS) {
    if (!(name in proto)) scope[name] = () => "reachable";
  }
  scope.navigator = { sendBeacon: () => true };
  scope.postMessage = () => "kept";
  scope.onmessage = null;
  return { scope, proto };
}

describe("lockdownGlobals", () => {
  it.each(BLOCKED_GLOBALS)("makes %s undefined on the global", (name) => {
    const { scope } = makeScope();
    lockdownGlobals(scope);
    expect(typeof scope[name]).toBe("undefined");
  });

  it("neutralises members defined on the prototype chain", () => {
    const { scope, proto } = makeScope();
    lockdownGlobals(scope);
    expect(proto.indexedDB).toBeUndefined();
    expect(Object.getPrototypeOf(scope).importScripts).toBeUndefined();
  });

  it("neutralises navigator.sendBeacon", () => {
    const { scope } = makeScope();
    lockdownGlobals(scope);
    expect((scope.navigator as { sendBeacon?: unknown }).sendBeacon).toBeUndefined();
  });

  it("cannot be undone by reassignment", () => {
    const { scope } = makeScope();
    lockdownGlobals(scope);
    expect(() => {
      "use strict";
      scope.fetch = () => "restored";
    }).toThrow();
    expect(scope.fetch).toBeUndefined();
  });

  it("keeps postMessage and onmessage for the worker harness", () => {
    const { scope } = makeScope();
    lockdownGlobals(scope);
    expect((scope.postMessage as () => string)()).toBe("kept");
    scope.onmessage = () => {};
    expect(scope.onmessage).toBeTypeOf("function");
  });

  it("neutralises navigator.serviceWorker", () => {
    const { scope } = makeScope();
    (scope.navigator as Record<string, unknown>).serviceWorker = {};
    lockdownGlobals(scope);
    expect((scope.navigator as { serviceWorker?: unknown }).serviceWorker).toBeUndefined();
  });

  it("works when the scope has no navigator", () => {
    expect(() => lockdownGlobals({})).not.toThrow();
  });
});
