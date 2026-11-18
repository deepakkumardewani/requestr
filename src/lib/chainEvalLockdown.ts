/**
 * Removes network, storage and script-loading APIs from the Evaluate worker's global
 * scope. The worker is same-origin, so without this user JS could read the app's
 * IndexedDB (env vars/secrets) and exfiltrate it. `postMessage`/`onmessage` are
 * deliberately left intact: the worker harness needs them.
 */

/** Global identifiers Evaluate code must not reach. Shared with the compile-time shadowing. */
export const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebTransport",
  "EventSource",
  "indexedDB",
  "caches",
  "importScripts",
  "BroadcastChannel",
  "localStorage",
  "sessionStorage",
  // Spawning a worker (e.g. from a Blob URL) would yield a fresh, unlocked global.
  "Worker",
  "SharedWorker",
] as const;

/** Members of `navigator` that can send data off-device or spawn a fresh global. */
const BLOCKED_NAVIGATOR_MEMBERS = ["sendBeacon", "serviceWorker"] as const;

function neutralise(target: object, name: string): void {
  // Walk the prototype chain: browsers may define these on WorkerGlobalScope.prototype
  // rather than on the global itself, so `self.fetch = undefined` alone is bypassable
  // via `Object.getPrototypeOf(self).fetch`.
  for (
    let obj: object | null = target;
    obj && obj !== Object.prototype;
    obj = Object.getPrototypeOf(obj)
  ) {
    if (!Object.hasOwn(obj, name)) continue;
    Object.defineProperty(obj, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  }
  // Also cover the case where nothing defines it, so it cannot be re-added later.
  if (!Object.hasOwn(target, name)) {
    Object.defineProperty(target, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  }
}

type LockdownScope = { navigator?: object };

/** Applies the lockdown to `scope` (the worker global; injectable for tests). */
export function lockdownGlobals(scope: object = globalThis): void {
  for (const name of BLOCKED_GLOBALS) neutralise(scope, name);
  const { navigator } = scope as LockdownScope;
  if (!navigator) return;
  for (const member of BLOCKED_NAVIGATOR_MEMBERS) neutralise(navigator, member);
}
