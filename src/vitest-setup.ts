import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

/** ScrollArea uses `getAnimations` in jsdom/happy-dom, which is missing — stub as a simple container. */
// Minimal Worker global stubs for chainEvalWorker.spec.ts — chainEvalWorker.ts assigns
// `self.onmessage` and calls bare `postMessage` at module load, which don't exist in the
// node test environment. Statically importing it (needed for coverage instrumentation)
// requires these to be defined before the file loads.
if (typeof globalThis.self === "undefined") {
  Object.defineProperty(globalThis, "self", {
    value: globalThis,
    writable: true,
    configurable: true,
  });
}
if (typeof globalThis.postMessage === "undefined") {
  globalThis.postMessage = () => {};
}

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "mock-scroll-area", className },
      children,
    ),
}));

import enChain from "../messages/en/chain.json";
import enCommon from "../messages/en/common.json";
import enEnvironment from "../messages/en/environment.json";
import enErrors from "../messages/en/errors.json";
import enNavigation from "../messages/en/navigation.json";
import enRequest from "../messages/en/request.json";
import enResponse from "../messages/en/response.json";
import enSettings from "../messages/en/settings.json";
import enShortcuts from "../messages/en/shortcuts.json";
import enTooltips from "../messages/en/tooltips.json";

const messages: Record<string, Record<string, unknown>> = {
  settings: enSettings,
  chain: enChain,
  common: enCommon,
  environment: enEnvironment,
  errors: enErrors,
  navigation: enNavigation,
  request: enRequest,
  response: enResponse,
  shortcuts: enShortcuts,
  tooltips: enTooltips,
};

/** Matches a single ICU `{var, plural, branch {...} branch {...}}` block (no nested plural blocks). */
const ICU_PLURAL_RE =
  /\{(\w+),\s*plural,\s*((?:(?:=\d+|\w+)\s*\{[^{}]*\}\s*)+)\}/g;
const ICU_PLURAL_BRANCH_RE = /(=\d+|\w+)\s*\{([^{}]*)\}/g;

/** Resolves ICU `plural` blocks against `values`, choosing `=N` over `one`/`other`, substituting `#`. */
function resolveIcuPlurals(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(ICU_PLURAL_RE, (_, varName: string, body: string) => {
    const count = Number(values[varName] ?? 0);
    const branches = new Map<string, string>();
    for (const match of body.matchAll(ICU_PLURAL_BRANCH_RE)) {
      branches.set(match[1], match[2]);
    }
    const selector = branches.has(`=${count}`)
      ? `=${count}`
      : count === 1 && branches.has("one")
        ? "one"
        : "other";
    const branchText = branches.get(selector) ?? "";
    return branchText.replace(/#/g, String(count));
  });
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  const withPlurals = resolveIcuPlurals(template, values);
  return withPlurals.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`),
  );
}

function resolveMessage(
  namespace: string | undefined,
  key: string,
  values?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  const rootNs = parts[0];
  const useRootNs = !namespace && rootNs in messages;
  const ns = useRootNs ? rootNs : namespace;
  const pathParts = useRootNs ? parts.slice(1) : parts;

  let current: unknown = (ns && messages[ns]) || {};
  for (const part of pathParts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }

  const resolved =
    typeof current === "string" ? current : ((current as string) ?? key);
  return interpolate(resolved, values);
}

vi.mock("next-intl", () => {
  return {
    // Passthrough provider — the real one injects messages we resolve directly.
    NextIntlClientProvider: ({ children }: { children?: React.ReactNode }) =>
      children,
    useTranslations: (namespace?: string) => {
      const t = (key: string, values?: Record<string, string | number>) =>
        resolveMessage(namespace, key, values);
      // `t.rich` renders inline tags; for tests, return the resolved string.
      t.rich = (key: string, values?: Record<string, string | number>) =>
        resolveMessage(namespace, key, values);
      t.markup = (key: string, values?: Record<string, string | number>) =>
        resolveMessage(namespace, key, values);
      t.raw = (key: string, values?: Record<string, string | number>) =>
        resolveMessage(namespace, key, values);
      t.has = (key: string) => resolveMessage(namespace, key) !== key;
      return t;
    },
    useFormatter: () => ({
      relativeTime: (date: Date | number, now?: Date | number) => {
        const nowMs = now instanceof Date ? now.getTime() : (now ?? Date.now());
        const dateMs = date instanceof Date ? date.getTime() : date;
        const diffSeconds = Math.round((dateMs - nowMs) / 1000);
        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
        const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
          [60, "second"],
          [60, "minute"],
          [24, "hour"],
          [7, "day"],
        ];
        let duration = diffSeconds;
        for (const [amount, unit] of divisions) {
          if (Math.abs(duration) < amount) return rtf.format(duration, unit);
          duration = Math.round(duration / amount);
        }
        return rtf.format(duration, "week");
      },
    }),
  };
});
