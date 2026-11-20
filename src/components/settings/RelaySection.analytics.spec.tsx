/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics/adapter";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelaySection } from "./RelaySection";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics/adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/adapter")>()),
  track: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({ enabled: true });
});

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe("RelaySection setting_changed events", () => {
  it("emits relay_enabled once per switch change", () => {
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(useRelayStore.getState().enabled).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting_id: "relay_enabled",
      value_kind: "bool",
    });
  });
});
