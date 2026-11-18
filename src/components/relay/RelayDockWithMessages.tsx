"use client";

import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import enDock from "../../../messages/en/relayDock.json";
import frDock from "../../../messages/fr/relayDock.json";
import jaDock from "../../../messages/ja/relayDock.json";
import { RelayDock } from "./RelayDock";

const DOCK_MESSAGES: Record<string, object> = {
  en: enDock,
  fr: frDock,
  ja: jaDock,
};

/**
 * The dock's strings ship with the lazy dock chunk instead of the root
 * messages, so non-Relay routes do not pay for them (NFR-5). They are layered
 * over the app messages, keeping the shell keys (`relay.title`, ...) visible.
 */
export function RelayDockWithMessages(props: Parameters<typeof RelayDock>[0]) {
  const locale = useLocale();
  const messages = useMessages();
  const merged = {
    ...messages,
    relay: {
      ...(messages.relay as object),
      ...(DOCK_MESSAGES[locale] ?? enDock),
    },
  };

  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      <RelayDock {...props} />
    </NextIntlClientProvider>
  );
}
