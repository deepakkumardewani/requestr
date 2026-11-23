/** @vitest-environment happy-dom */

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics/adapter";
import { startTour } from "@/lib/tour/startTour";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { GeneralSection } from "./GeneralSection";

vi.mock("@/lib/analytics/adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/adapter")>()),
  track: vi.fn(),
}));

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/tour/startTour", () => ({ startTour: vi.fn() }));

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.mocked(startTour).mockClear();
  window.history.replaceState({}, "", "/");
  vi.mocked(track).mockClear();
});

describe("GeneralSection chain execution", () => {
  it("renders the localized concurrency copy", () => {
    render(
      <GeneralSection
        showHealthMonitor
        showCodeGen
        setSetting={vi.fn()}
        chainConcurrency={4}
        onChainConcurrencyChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Chain execution")).toBeInTheDocument();
    expect(screen.getByLabelText("Concurrency")).toHaveValue(4);
  });
});

function renderSection(overrides: Partial<React.ComponentProps<typeof GeneralSection>> = {}) {
  const props = {
    showHealthMonitor: true,
    showCodeGen: false,
    setSetting: vi.fn(),
    chainConcurrency: 4,
    onChainConcurrencyChange: vi.fn(),
    ...overrides,
  };
  render(<GeneralSection {...props} />);
  return props;
}

describe("GeneralSection controls", () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: "en", confirmCloseUnsavedTabs: true });
  });

  it("shows the current language in the language row", () => {
    useSettingsStore.setState({ locale: "fr" });
    renderSection();

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByTestId("language-select")).toHaveTextContent("Français");
  });

  it("saves the language chosen from the list", async () => {
    const { setSetting } = renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("language-select"));
    await user.click(await screen.findByRole("option", { name: "日本語" }));

    expect(setSetting).toHaveBeenCalledWith("locale", "ja");
  });

  it("emits setting_changed once for a changed locale", async () => {
    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("language-select"));
    await user.click(await screen.findByRole("option", { name: "日本語" }));

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting_id: "locale",
      value_kind: "enum",
    });
  });

  it("emits nothing when the current locale is picked again", async () => {
    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("language-select"));
    await user.click(await screen.findByRole("option", { name: "English" }));

    expect(track).not.toHaveBeenCalled();
  });

  it("toggles the feature switches through setSetting", () => {
    const { setSetting } = renderSection();
    const [health, codeGen] = screen.getAllByRole("switch");

    fireEvent.click(health);
    fireEvent.click(codeGen);

    expect(setSetting).toHaveBeenCalledWith("showHealthMonitor", false);
    expect(setSetting).toHaveBeenCalledWith("showCodeGen", true);
  });

  it("toggles the ask-before-closing-unsaved-tabs setting", () => {
    const { setSetting } = renderSection();
    const row = screen.getByText("Ask before closing unsaved tabs");
    const toggle = row.closest("div.flex")?.querySelector('[role="switch"]');

    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle as Element);

    expect(setSetting).toHaveBeenCalledWith("confirmCloseUnsavedTabs", false);
  });

  it("reports a changed concurrency as a number", () => {
    const { onChainConcurrencyChange } = renderSection();

    fireEvent.change(screen.getByTestId("chain-concurrency-input"), {
      target: { value: "6" },
    });

    expect(onChainConcurrencyChange).toHaveBeenCalledWith(6);
  });

  it("ignores a value that does not parse as a number", () => {
    const { onChainConcurrencyChange } = renderSection();
    const input = screen.getByTestId("chain-concurrency-input");
    // Number inputs sanitise letters away in the DOM; a text-typed input
    // delivers the raw string the guard defends against.
    input.setAttribute("type", "text");

    fireEvent.change(input, { target: { value: "abc" } });

    expect(onChainConcurrencyChange).not.toHaveBeenCalled();
  });

  it("replays the tour on the workspace route from the help button", () => {
    renderSection();

    fireEvent.click(screen.getByTestId("restart-tour-btn"));

    expect(push).toHaveBeenCalledWith("/app");
    expect(startTour).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "replay" }),
    );
  });

  it("does not navigate when already on the workspace route", () => {
    window.history.replaceState({}, "", "/app");
    renderSection();

    fireEvent.click(screen.getByTestId("restart-tour-btn"));

    expect(push).not.toHaveBeenCalled();
    expect(startTour).toHaveBeenCalledTimes(1);
  });
});

describe("GeneralSection analytics toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    useAnalyticsStore.setState({ enabled: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it("turns analytics off and persists the opt-out", async () => {
    renderSection();
    const toggle = screen.getByRole("switch", {
      name: "Share anonymous usage data",
    });
    await userEvent.setup().click(toggle);

    expect(track).not.toHaveBeenCalled();
    expect(useAnalyticsStore.getState().enabled).toBe(false);
    expect(localStorage.getItem("rq_analytics_enabled")).toBe("false");
    expect(localStorage.getItem("rq_analytics_id")).toBeNull();
  });

  it("forces the toggle off with a reason under Do Not Track", async () => {
    vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue("1");
    renderSection();

    expect(await screen.findByTestId("analytics-consent-note")).toHaveTextContent(
      "Do Not Track",
    );
    const toggle = screen.getByRole("switch", {
      name: "Share anonymous usage data",
    });
    expect(toggle).toHaveAttribute("data-disabled");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
