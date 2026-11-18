// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enDock from "../../../messages/en/relayDock.json";
import frDock from "../../../messages/fr/relayDock.json";
import enShell from "../../../messages/en/relay.json";
import { RelayDockWithMessages } from "./RelayDockWithMessages";

const intl = vi.hoisted(() => ({
  locale: "en",
  messages: {} as { relay?: object },
}));

// Stands in for next-intl: the provider records what the dock would receive.
vi.mock("next-intl", () => ({
  useLocale: () => intl.locale,
  useMessages: () => intl.messages,
  NextIntlClientProvider: ({
    messages,
    children,
  }: {
    messages: { relay: Record<string, unknown> };
    children: ReactNode;
  }) => <div data-testid="relay-messages">{JSON.stringify(messages.relay)}</div>,
}));

vi.mock("./RelayDock", () => ({ RelayDock: () => null }));

afterEach(cleanup);

function receivedMessages(locale: string): Record<string, unknown> {
  intl.locale = locale;
  intl.messages = { relay: enShell };
  render(<RelayDockWithMessages variant="aside" />);
  return JSON.parse(screen.getByTestId("relay-messages").textContent ?? "{}");
}

describe("RelayDockWithMessages", () => {
  it("layers the lazy dock strings over the shell keys", () => {
    const relay = receivedMessages("en");
    expect(relay.title).toBe(enShell.title);
    expect(relay.send).toBe(enDock.send);
  });

  it("uses the dock strings of the active locale", () => {
    expect(receivedMessages("fr").send).toBe(frDock.send);
  });

  it("falls back to English for an unknown locale", () => {
    expect(receivedMessages("de").send).toBe(enDock.send);
  });
});
