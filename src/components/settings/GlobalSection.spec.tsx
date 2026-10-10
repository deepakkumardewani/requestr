/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { KVPair } from "@/types";
import { GlobalSection } from "./GlobalSection";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const BASE_URL_TEST_ID = "global-base-url-input";

function makeHeader(overrides: Partial<KVPair> = {}): KVPair {
  return {
    id: "h1",
    key: "X-Api-Key",
    value: "abc",
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getDB).mockReturnValue(null);
  useSettingsStore.setState({ globalBaseUrl: "", globalHeaders: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GlobalSection base URL", () => {
  it("shows the base URL currently held in the settings store", () => {
    useSettingsStore.setState({ globalBaseUrl: "https://api.example.com" });

    render(<GlobalSection />);

    expect(screen.getByTestId(BASE_URL_TEST_ID)).toHaveValue(
      "https://api.example.com",
    );
  });

  it("writes typed text to globalBaseUrl in the store", async () => {
    const user = userEvent.setup();
    render(<GlobalSection />);

    await user.type(screen.getByTestId(BASE_URL_TEST_ID), "https://api.dev");

    expect(useSettingsStore.getState().globalBaseUrl).toBe("https://api.dev");
  });

  it("clears globalBaseUrl in the store when the input is emptied", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ globalBaseUrl: "https://api.dev" });
    render(<GlobalSection />);

    await user.clear(screen.getByTestId(BASE_URL_TEST_ID));

    expect(useSettingsStore.getState().globalBaseUrl).toBe("");
  });

  it("does not touch globalHeaders when the base URL changes", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ globalHeaders: [makeHeader()] });
    render(<GlobalSection />);

    await user.type(screen.getByTestId(BASE_URL_TEST_ID), "x");

    expect(useSettingsStore.getState().globalHeaders).toEqual([makeHeader()]);
  });
});

describe("GlobalSection default headers table", () => {
  it("renders existing global headers from the store", () => {
    useSettingsStore.setState({ globalHeaders: [makeHeader()] });

    render(<GlobalSection />);

    expect(screen.getByTestId("row-key-h1")).toHaveValue("X-Api-Key");
    expect(screen.getByTestId("row-value-h1")).toHaveValue("abc");
  });

  it("adds an enabled header to the store when a draft row is filled and blurred", async () => {
    const user = userEvent.setup();
    render(<GlobalSection />);

    await user.type(screen.getByTestId("draft-row-key"), "Accept");
    await user.tab();
    await user.type(screen.getByTestId("draft-row-value"), "application/json");
    await user.tab();

    const headers = useSettingsStore.getState().globalHeaders;
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatchObject({
      key: "Accept",
      value: "application/json",
      enabled: true,
    });
  });

  it("does not add a header when the draft row is left empty", async () => {
    const user = userEvent.setup();
    render(<GlobalSection />);

    await user.click(screen.getByTestId("draft-row-key"));
    await user.tab();

    expect(useSettingsStore.getState().globalHeaders).toEqual([]);
  });

  it("edits a header key in the store", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ globalHeaders: [makeHeader()] });
    render(<GlobalSection />);

    await user.type(screen.getByTestId("row-key-h1"), "2");

    expect(useSettingsStore.getState().globalHeaders).toEqual([
      makeHeader({ key: "X-Api-Key2" }),
    ]);
  });

  it("edits a header value in the store", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ globalHeaders: [makeHeader()] });
    render(<GlobalSection />);

    await user.type(screen.getByTestId("row-value-h1"), "def");

    expect(useSettingsStore.getState().globalHeaders).toEqual([
      makeHeader({ value: "abcdef" }),
    ]);
  });

  it("disables a header in the store when its checkbox is toggled off", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ globalHeaders: [makeHeader()] });
    render(<GlobalSection />);

    await user.click(screen.getByTestId("row-enable-h1"));

    expect(useSettingsStore.getState().globalHeaders[0].enabled).toBe(false);
  });

  it("removes only the deleted header from the store", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      globalHeaders: [makeHeader(), makeHeader({ id: "h2", key: "Accept" })],
    });
    render(<GlobalSection />);

    await user.click(screen.getByTestId("row-delete-h1"));

    expect(
      useSettingsStore.getState().globalHeaders.map((h) => h.id),
    ).toEqual(["h2"]);
  });

  it("does not touch globalBaseUrl when headers change", async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({
      globalBaseUrl: "https://api.dev",
      globalHeaders: [makeHeader()],
    });
    render(<GlobalSection />);

    await user.click(screen.getByTestId("row-delete-h1"));

    expect(useSettingsStore.getState().globalBaseUrl).toBe("https://api.dev");
  });
});
