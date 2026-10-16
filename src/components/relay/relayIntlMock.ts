import relay from "../../../messages/en/relay.json";

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
