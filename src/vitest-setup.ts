import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

/** ScrollArea uses `getAnimations` in jsdom/happy-dom, which is missing — stub as a simple container. */
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
  common: enCommon,
  environment: enEnvironment,
  errors: enErrors,
  navigation: enNavigation,
  request: enRequest,
  response: enResponse,
  shortcuts: enShortcuts,
  tooltips: enTooltips,
};

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
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
  };
});
