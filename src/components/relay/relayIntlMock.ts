import enShell from "../../../messages/en/relay.json";
import enDock from "../../../messages/en/relayDock.json";
import frShell from "../../../messages/fr/relay.json";
import frDock from "../../../messages/fr/relayDock.json";
import jaShell from "../../../messages/ja/relay.json";
import jaDock from "../../../messages/ja/relayDock.json";

const FULL_RELAY_MESSAGES = {
  en: { ...enShell, ...enDock },
  fr: { ...frShell, ...frDock },
  ja: { ...jaShell, ...jaDock },
} as const;

/** The whole relay namespace (shell + dock) for a locale, as the dock sees it at runtime. */
export function relayMessages<L extends keyof typeof FULL_RELAY_MESSAGES>(
  locale: L,
): (typeof FULL_RELAY_MESSAGES)[L] {
  return FULL_RELAY_MESSAGES[locale];
}

const relay = FULL_RELAY_MESSAGES.en;

type Values = Record<string, string | number>;

/** Resolves a dotted key against the real English relay messages, substituting `{var}` placeholders. */
function resolveRelayMessage(key: string, values?: Values): string {
  const found = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node != null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      relay,
    );
  if (typeof found !== "string") return key;
  return found.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values?.[name] ?? `{${name}}`),
  );
}

/**
 * next-intl mock for specs that assert user-visible relay copy. The global
 * vitest setup deliberately leaves `relay` unregistered so other relay specs
 * keep matching on raw message keys.
 */
export function relayIntlMock() {
  return {
    NextIntlClientProvider: ({ children }: { children?: unknown }) => children,
    useTranslations: () => resolveRelayMessage,
  };
}
