/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry } from "@/types";
import { SETTINGS_SECTIONS } from "./constants";
import SettingsPageClient from "./SettingsPageClient";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn(), resolvedTheme: "dark" }),
}));

vi.mock("next/link", () => ({
  default({ children, href }: { children: ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: () => null,
}));

const SEEDED_ENTRY = { id: "h1", method: "GET", url: "https://a.test" } as HistoryEntry;

beforeEach(() => {
  useHistoryStore.setState({ entries: [SEEDED_ENTRY] });
});

afterEach(() => {
  cleanup();
  useHistoryStore.setState({ entries: [] });
});

function openClearHistoryDialog() {
  render(<SettingsPageClient />);
  fireEvent.click(screen.getByTestId("clear-history-btn"));
}

describe("SettingsPageClient", () => {
  it("opens on the first entry of SETTINGS_SECTIONS (General)", () => {
    const [firstId] = SETTINGS_SECTIONS[0];
    expect(firstId).toBe("general");

    render(<SettingsPageClient />);

    expect(screen.getByRole("heading", { name: /^general$/i })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /appearance & theme/i }),
    ).toBeNull();
    expect(screen.getByTestId(`nav-${firstId}`).className).toContain(
      "border-l-theme-accent",
    );
  });

  it("keeps history when the Clear History dialog is cancelled", () => {
    openClearHistoryDialog();
    expect(screen.getByTestId("confirm-clear-history-btn")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(useHistoryStore.getState().entries).toEqual([SEEDED_ENTRY]);
    expect(screen.queryByTestId("confirm-clear-history-btn")).toBeNull();
  });

  it("clears history and closes the dialog when Clear History is confirmed", () => {
    openClearHistoryDialog();

    fireEvent.click(screen.getByTestId("confirm-clear-history-btn"));

    expect(useHistoryStore.getState().entries).toEqual([]);
    expect(screen.queryByTestId("confirm-clear-history-btn")).toBeNull();
  });
});
