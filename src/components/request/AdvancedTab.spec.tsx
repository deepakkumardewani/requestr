/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";
import { AdvancedTab } from "./AdvancedTab";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

const DEFAULT_SECONDS = String(DEFAULT_REQUEST_TIMEOUT_MS / 1000);

function reset() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useSettingsStore.setState({ sslVerify: true, followRedirects: true });
}

function seedTab(initial: Partial<HttpTab> = {}) {
  useTabsStore.getState().openTab({ type: "http", ...initial });
  return (useTabsStore.getState().tabs[0] as HttpTab).tabId;
}

function currentTab() {
  return useTabsStore.getState().tabs[0] as HttpTab;
}

function commitTimeout(input: HTMLElement, raw: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.blur(input);
}

describe("AdvancedTab", () => {
  beforeEach(reset);
  afterEach(() => {
    cleanup();
    reset();
  });

  it("renders nothing for a non-http tab", () => {
    useTabsStore.getState().openTab({ type: "graphql" });
    const tabId = useTabsStore.getState().tabs[0].tabId;
    const { container } = render(<AdvancedTab tabId={tabId} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("timeout", () => {
    it("shows the default timeout in seconds when the tab has no override", () => {
      render(<AdvancedTab tabId={seedTab()} />);
      expect(screen.getByTestId("request-timeout-seconds")).toHaveValue(DEFAULT_SECONDS);
    });

    it("shows the tab's own timeout in seconds", () => {
      render(<AdvancedTab tabId={seedTab({ timeoutMs: 12_000 })} />);
      expect(screen.getByTestId("request-timeout-seconds")).toHaveValue("12");
    });

    it("commits seconds as milliseconds on blur", () => {
      render(<AdvancedTab tabId={seedTab()} />);
      commitTimeout(screen.getByTestId("request-timeout-seconds"), "45");
      expect(currentTab().timeoutMs).toBe(45_000);
    });

    it("rounds fractional seconds to whole milliseconds", () => {
      render(<AdvancedTab tabId={seedTab()} />);
      commitTimeout(screen.getByTestId("request-timeout-seconds"), "1.5");
      expect(currentTab().timeoutMs).toBe(1_500);
    });

    it("clamps values above 600 seconds to 600 seconds", () => {
      render(<AdvancedTab tabId={seedTab()} />);
      const input = screen.getByTestId("request-timeout-seconds");
      commitTimeout(input, "9999");
      expect(currentTab().timeoutMs).toBe(600_000);
      expect(input).toHaveValue("600");
    });

    it("strips non-numeric characters typed into the field", () => {
      render(<AdvancedTab tabId={seedTab()} />);
      const input = screen.getByTestId("request-timeout-seconds");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "2a0s" } });
      expect(input).toHaveValue("20");
    });

    it("clears the override and restores the default when the field is blank", () => {
      render(<AdvancedTab tabId={seedTab({ timeoutMs: 5_000 })} />);
      const input = screen.getByTestId("request-timeout-seconds");
      commitTimeout(input, "");
      expect(currentTab().timeoutMs).toBeUndefined();
      expect(input).toHaveValue(DEFAULT_SECONDS);
    });

    it("clears the override when the value is below 1 second", () => {
      render(<AdvancedTab tabId={seedTab({ timeoutMs: 5_000 })} />);
      const input = screen.getByTestId("request-timeout-seconds");
      commitTimeout(input, "0.5");
      expect(currentTab().timeoutMs).toBeUndefined();
      expect(input).toHaveValue(DEFAULT_SECONDS);
    });

    it("commits when Enter is pressed in the field", async () => {
      const user = userEvent.setup();
      render(<AdvancedTab tabId={seedTab()} />);
      const input = screen.getByTestId("request-timeout-seconds");
      await user.clear(input);
      await user.type(input, "20{Enter}");
      expect(currentTab().timeoutMs).toBe(20_000);
    });
  });

  describe("SSL verification", () => {
    it("inherits the global setting and hides the reset link when there is no override", () => {
      useSettingsStore.setState({ sslVerify: false });
      render(<AdvancedTab tabId={seedTab()} />);

      expect(screen.getAllByRole("switch")[0]).not.toBeChecked();
      expect(screen.getAllByText(/inherited from global/i)).toHaveLength(2);
      expect(screen.queryByRole("button", { name: /reset to global/i })).not.toBeInTheDocument();
    });

    it("stores a per-request override when the SSL switch is toggled", async () => {
      const user = userEvent.setup();
      render(<AdvancedTab tabId={seedTab()} />);

      await user.click(screen.getAllByRole("switch")[0]);

      expect(currentTab().sslVerify).toBe(false);
    });

    it("clears the SSL override when 'Reset to global' is clicked", async () => {
      const user = userEvent.setup();
      render(<AdvancedTab tabId={seedTab({ sslVerify: false })} />);

      await user.click(screen.getByRole("button", { name: /reset to global/i }));

      expect(currentTab().sslVerify).toBeUndefined();
      expect(screen.getAllByRole("switch")[0]).toBeChecked();
    });
  });

  describe("follow redirects", () => {
    it("stores a per-request override when the redirects switch is toggled", async () => {
      const user = userEvent.setup();
      render(<AdvancedTab tabId={seedTab()} />);

      await user.click(screen.getAllByRole("switch")[1]);

      expect(currentTab().followRedirects).toBe(false);
      expect(currentTab().sslVerify).toBeUndefined();
    });

    it("clears the redirects override when 'Reset to global' is clicked", async () => {
      const user = userEvent.setup();
      render(<AdvancedTab tabId={seedTab({ followRedirects: false })} />);

      await user.click(screen.getByRole("button", { name: /reset to global/i }));

      expect(currentTab().followRedirects).toBeUndefined();
    });
  });
});
