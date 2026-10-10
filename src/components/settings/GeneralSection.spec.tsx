/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/useUIStore";
import { GeneralSection } from "./GeneralSection";

afterEach(cleanup);

const INPUT_TEST_ID = "chain-concurrency-input";

function renderSection(overrides: Partial<Parameters<typeof GeneralSection>[0]> = {}) {
  const props = {
    showHealthMonitor: true,
    showCodeGen: true,
    setSetting: vi.fn(),
    onClearHistoryClick: vi.fn(),
    chainConcurrency: 4,
    onChainConcurrencyChange: vi.fn(),
    ...overrides,
  };
  render(<GeneralSection {...props} />);
  return props;
}

/** Wires the section to the real UI store, as SettingsPageClient does. */
function StoreBackedSection() {
  const chainConcurrency = useUIStore((s) => s.chainConcurrency);
  const setChainConcurrency = useUIStore((s) => s.setChainConcurrency);
  return (
    <GeneralSection
      showHealthMonitor
      showCodeGen
      setSetting={vi.fn()}
      onClearHistoryClick={vi.fn()}
      chainConcurrency={chainConcurrency}
      onChainConcurrencyChange={setChainConcurrency}
    />
  );
}

const input = () => screen.getByTestId(INPUT_TEST_ID) as HTMLInputElement;
const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });

describe("GeneralSection feature toggles and data management", () => {
  it("calls setSetting for showHealthMonitor when the health switch is toggled", () => {
    const { setSetting } = renderSection({ showHealthMonitor: true });

    fireEvent.click(screen.getAllByRole("switch")[0]);

    expect(setSetting).toHaveBeenCalledWith("showHealthMonitor", false);
  });

  it("calls setSetting for showCodeGen when the code generation switch is toggled", () => {
    const { setSetting } = renderSection({ showCodeGen: false });

    fireEvent.click(screen.getAllByRole("switch")[1]);

    expect(setSetting).toHaveBeenCalledWith("showCodeGen", true);
  });

  it("invokes the callback when Clear History is clicked", () => {
    const { onClearHistoryClick } = renderSection();

    fireEvent.click(screen.getByTestId("clear-history-btn"));

    expect(onClearHistoryClick).toHaveBeenCalledTimes(1);
  });
});

describe("GeneralSection concurrency input", () => {
  beforeEach(() => {
    useUIStore.setState({ chainConcurrency: 4 });
  });

  it("exposes min 1 and max 8 on the number input", () => {
    renderSection();

    expect(input()).toHaveAttribute("min", "1");
    expect(input()).toHaveAttribute("max", "8");
    expect(input()).toHaveAttribute("type", "number");
  });

  it("allows the field to be empty while typing without reporting a change", () => {
    const { onChainConcurrencyChange } = renderSection();

    type("");

    expect(input().value).toBe("");
    expect(onChainConcurrencyChange).not.toHaveBeenCalled();
  });

  it("reverts an empty field to the last valid value on blur", () => {
    const { onChainConcurrencyChange } = renderSection({ chainConcurrency: 5 });

    type("");
    fireEvent.blur(input());

    expect(input()).toHaveValue(5);
    expect(onChainConcurrencyChange).not.toHaveBeenCalled();
  });

  it("reverts to the last valid value on blur when the draft is non-numeric", () => {
    renderSection({ chainConcurrency: 5 });

    type("abc");
    fireEvent.blur(input());

    expect(input()).toHaveValue(5);
  });

  it("reports a valid typed value", () => {
    const { onChainConcurrencyChange } = renderSection();

    type("6");

    expect(onChainConcurrencyChange).toHaveBeenCalledWith(6);
  });

  it.each([
    ["0", 1],
    ["99", 8],
    ["-3", 1],
    ["3.7", 4],
  ])("clamps typed %s to %i in the store", (typed, expected) => {
    render(<StoreBackedSection />);

    type(typed);
    fireEvent.blur(input());

    expect(useUIStore.getState().chainConcurrency).toBe(expected);
    expect(input()).toHaveValue(expected);
  });

  it("keeps the stored value when blurred after an empty draft", () => {
    useUIStore.setState({ chainConcurrency: 3 });
    render(<StoreBackedSection />);

    type("");
    fireEvent.blur(input());

    expect(useUIStore.getState().chainConcurrency).toBe(3);
    expect(input()).toHaveValue(3);
  });
});

describe("GeneralSection chain execution", () => {
  it("renders the localized concurrency copy", () => {
    render(
      <GeneralSection
        showHealthMonitor
        showCodeGen
        setSetting={vi.fn()}
        onClearHistoryClick={vi.fn()}
        chainConcurrency={4}
        onChainConcurrencyChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Chain execution")).toBeInTheDocument();
    expect(screen.getByLabelText("Concurrency")).toHaveValue(4);
  });

  it("does not render a Restart Tour button (tour is disabled)", () => {
    render(
      <GeneralSection
        showHealthMonitor
        showCodeGen
        setSetting={vi.fn()}
        onClearHistoryClick={vi.fn()}
        chainConcurrency={4}
        onChainConcurrencyChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("restart-tour-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Restart Tour")).not.toBeInTheDocument();
    expect(screen.getByTestId("clear-history-btn")).toBeInTheDocument();
  });
});
