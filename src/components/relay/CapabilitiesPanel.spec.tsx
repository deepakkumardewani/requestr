/** @vitest-environment happy-dom */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_CATEGORIES } from "@/lib/relay/capabilities";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { CapabilitiesPanel } from "./CapabilitiesPanel";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());

afterEach(cleanup);

beforeEach(() => {
  useRelayPermissionStore.setState({ mode: "skip" });
  useRelayStore.setState({ shareValues: false });
});

const renderPanel = (onChangeMode = vi.fn()) => {
  render(<CapabilitiesPanel onChangeMode={onChangeMode} />);
  return onChangeMode;
};

const markerOf = (id: string) =>
  within(screen.getByTestId(`relay-capability-category-${id}`)).queryByTestId(
    "relay-capability-marker",
  );

describe("CapabilitiesPanel", () => {
  it("renders one list without tabs, starters or action lines", () => {
    renderPanel();
    expect(screen.getByTestId("relay-capability-list")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByTestId("relay-capability-starter")).toBeNull();
    expect(screen.queryByTestId("relay-capability-action")).toBeNull();
  });

  it("shows an icon, a title and one sentence for each area, in order", () => {
    renderPanel();
    const rows = within(screen.getByTestId("relay-capability-list")).getAllByRole("listitem");
    expect(rows).toHaveLength(CAPABILITY_CATEGORIES.length);
    for (const row of rows) {
      expect(row.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByTestId("relay-capability-category-read")).toHaveTextContent("Read & explain");
    expect(screen.getByTestId("relay-capability-category-read")).toHaveTextContent(
      "Look through your workspace and explain what is there.",
    );
  });

  it("scrolls inside a max height and can be focused for the keyboard", () => {
    renderPanel();
    const list = screen.getByTestId("relay-capability-list");
    expect(list).toHaveClass("max-h-96", "overflow-y-auto");
    expect(list).toHaveAttribute("tabindex", "0");
  });

  it("shows no marker when approvals are skipped", () => {
    renderPanel();
    expect(screen.queryByTestId("relay-capability-marker")).toBeNull();
  });

  it("marks only the areas where approval applies", () => {
    useRelayPermissionStore.setState({ mode: "always-ask" });
    renderPanel();
    expect(markerOf("read")).toBeNull();
    for (const id of ["write", "run", "organize", "transfer"]) {
      const marker = markerOf(id);
      expect(marker).toHaveTextContent("Asks first");
      expect(marker).toHaveAttribute("data-badge", "asks");
      expect(marker).toHaveClass("text-warning");
    }
  });

  it("explains the bulk-only marker", () => {
    useRelayPermissionStore.setState({ mode: "review" });
    renderPanel();
    expect(markerOf("write")).toHaveAttribute("data-badge", "asksBulk");
    expect(markerOf("write")).toHaveTextContent("Asks first for more than 10 items");
    expect(markerOf("transfer")).toBeNull();
  });

  it("updates the markers live when the permission mode changes", () => {
    renderPanel();
    expect(markerOf("run")).toBeNull();
    act(() => useRelayPermissionStore.setState({ mode: "review" }));
    expect(markerOf("run")).toHaveAttribute("data-badge", "asks");
  });

  it("shows the What Relay can see footer and follows the share setting", () => {
    renderPanel();
    const footer = screen.getByTestId("relay-capability-see-list");
    expect(footer).toHaveTextContent("What Relay can see");
    expect(footer).toHaveTextContent("Secret values, never");
    expect(screen.getByTestId("relay-capability-see-values")).toHaveTextContent(
      "only when you turn on Share variable values",
    );
    act(() => useRelayStore.setState({ shareValues: true }));
    expect(screen.getByTestId("relay-capability-see-values")).toHaveTextContent(
      "because Share variable values is on",
    );
    expect(screen.getByTestId("relay-capability-settings-link")).toHaveAttribute("href", "/settings");
  });

  it("keeps Change approval mode and reaches it by keyboard", async () => {
    const user = userEvent.setup();
    const onChangeMode = renderPanel();
    await user.tab();
    expect(screen.getByTestId("relay-capability-list")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("relay-capability-settings-link")).toHaveFocus();
    await user.tab();
    const button = screen.getByTestId("relay-capability-change-mode");
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChangeMode).toHaveBeenCalledTimes(1);
  });
});
