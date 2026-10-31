/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useSettingsSectionStore } from "@/stores/useSettingsSectionStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import SettingsPage from "./page";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme, resolvedTheme: "dark" }),
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

function resetSettingsStore() {
  useSettingsStore.setState({
    theme: "dark",
    proxyUrl: "",
    sslVerify: true,
    followRedirects: true,
    showHealthMonitor: true,
    showCodeGen: true,
    codeGenLang: "cURL",
    autoExpandExplainer: true,
    hydrated: true,
  });
}

function resetHistoryStore() {
  useHistoryStore.setState({ entries: [] });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettingsStore();
    resetHistoryStore();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("opens the section named by the URL hash", () => {
    window.location.hash = "#global";
    render(<SettingsPage />);
    expect(screen.getByTestId("nav-global")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /appearance & theme/i })).toBeNull();
  });

  it("follows later hash changes and ignores unknown ones", async () => {
    render(<SettingsPage />);
    window.location.hash = "#proxy";
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /network & security/i })).toBeTruthy(),
    );
    window.location.hash = "#nonsense";
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("heading", { name: /network & security/i })).toBeTruthy();
  });

  it("switches to a section requested while Settings is already open, with no hashchange", async () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: /appearance & theme/i })).toBeTruthy();
    act(() => useSettingsSectionStore.getState().request("proxy"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /network & security/i })).toBeTruthy(),
    );
    expect(useSettingsSectionStore.getState().requested).toBeNull();
    act(() => useSettingsSectionStore.getState().request("global"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: /network & security/i })).toBeNull());
  });

  it("switches section when nav buttons are clicked", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: /appearance & theme/i }),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("nav-general"));
    expect(screen.getByRole("heading", { name: /^general$/i })).toBeTruthy();

    fireEvent.click(screen.getByTestId("nav-proxy"));
    expect(
      screen.getByRole("heading", { name: /network & security/i }),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("nav-global"));
    expect(screen.getByRole("heading", { name: /^global$/i })).toBeTruthy();

    fireEvent.click(screen.getByTestId("nav-shortcuts"));
    expect(
      screen.getByRole("heading", { name: /keyboard shortcuts/i }),
    ).toBeTruthy();
  });

  it("clears history after confirming the dialog", async () => {
    const { toast } = await import("sonner");
    const request = {
      tabId: "tab-h1",
      requestId: null as string | null,
      name: "Example",
      isDirty: false,
      type: "http" as const,
      method: "GET" as const,
      url: "https://example.com",
      headers: [],
      params: [],
      auth: { type: "none" as const },
      body: { type: "none" as const, content: "" },
      preScript: "",
      postScript: "",
    };
    useHistoryStore.setState({
      entries: [
        {
          id: "h1",
          method: "GET",
          url: "https://example.com",
          status: 200,
          duration: 12,
          size: 34,
          timestamp: Date.now(),
          request,
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            body: "",
            duration: 12,
            size: 34,
            url: "https://example.com",
            method: "GET",
            timestamp: Date.now(),
          },
        },
      ],
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId("nav-general"));
    fireEvent.click(screen.getByTestId("clear-history-btn"));

    fireEvent.click(await screen.findByTestId("confirm-clear-history-btn"));

    await waitFor(() => {
      expect(useHistoryStore.getState().entries).toEqual([]);
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("History cleared");
  });

  it("invokes theme change when an appearance option is selected", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId("theme-light"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("updates proxy-related settings from the proxy section", async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId("nav-proxy"));

    fireEvent.click(screen.getByTestId("ssl-verification-switch"));
    expect(useSettingsStore.getState().sslVerify).toBe(false);

    fireEvent.change(screen.getByTestId("proxy-url-input"), {
      target: { value: "http://127.0.0.1:9999" },
    });
    await waitFor(() => {
      expect(useSettingsStore.getState().proxyUrl).toBe(
        "http://127.0.0.1:9999",
      );
    });
  });

  it("renders keyboard shortcut groups", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByTestId("nav-shortcuts"));

    const groups = screen.getAllByTestId("shortcut-group");
    expect(groups.length).toBeGreaterThan(0);
    const labels = screen.getAllByTestId("shortcut-group-label");
    expect(labels.some((el) => el.textContent?.length)).toBe(true);
  });
});
