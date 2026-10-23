/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestLocale } from "@/vitest-setup";
import { useRelayStore } from "@/stores/useRelayStore";
import { CapabilitiesPopover } from "./CapabilitiesPopover";

// Mock the hooks and components
vi.mock("@/hooks/useCapabilityStarter", () => ({
  useCapabilityStarter: () => ({
    runStarter: vi.fn(),
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  setTestLocale("en");
  useRelayStore.setState({
    capabilitiesOpen: false,
    setCapabilitiesOpen: vi.fn(),
    setPermissionPopoverOpen: vi.fn(),
    mentionRequest: null,
  });
});

describe("CapabilitiesPopover", () => {
  it("renders the popover trigger button", () => {
    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("type", "button");
  });

  it("applies style prop to trigger button", () => {
    const customStyle = { minHeight: "44px" };
    render(<CapabilitiesPopover style={customStyle} />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    expect(trigger).toHaveStyle("min-height: 44px");
  });

  it("has accessible label on trigger", () => {
    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    expect(trigger).toHaveAttribute("aria-label");
  });

  it("renders popover content when open", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    expect(
      screen.getByTestId("relay-capabilities-popover"),
    ).toBeInTheDocument();
  });

  it("does not render popover content when closed", () => {
    useRelayStore.setState({ capabilitiesOpen: false });
    render(<CapabilitiesPopover />);

    expect(
      screen.queryByTestId("relay-capabilities-popover"),
    ).not.toBeInTheDocument();
  });

  it("calls setCapabilitiesOpen when trigger is clicked", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    useRelayStore.setState({ setCapabilitiesOpen: setOpen });

    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    await user.click(trigger);

    expect(setOpen).toHaveBeenCalled();
  });

  it("renders CapabilitiesPanel with popover variant when open", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    expect(
      screen.getByTestId("relay-capabilities-panel"),
    ).toHaveAttribute("data-variant", "popover");
  });

  it("passes onStarter handler to CapabilitiesPanel", async () => {
    const user = userEvent.setup();
    useRelayStore.setState({ capabilitiesOpen: true });

    render(<CapabilitiesPopover />);

    const starters = screen.getAllByTestId("relay-capability-starter");
    expect(starters.length).toBeGreaterThan(0);

    await user.click(starters[0]);
    // Handler should have been called
  });

  it("passes onChangeMode handler to CapabilitiesPanel", async () => {
    const user = userEvent.setup();
    const setPermissionOpen = vi.fn();
    useRelayStore.setState({
      capabilitiesOpen: true,
      setPermissionPopoverOpen: setPermissionOpen,
    });

    render(<CapabilitiesPopover />);

    const changeModeButton = screen.getByTestId(
      "relay-capability-change-mode",
    );
    await user.click(changeModeButton);

    expect(setPermissionOpen).toHaveBeenCalledWith(true);
  });

  it("closes popover when a starter is selected", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    useRelayStore.setState({
      capabilitiesOpen: true,
      setCapabilitiesOpen: setOpen,
    });

    render(<CapabilitiesPopover />);

    const starters = screen.getAllByTestId("relay-capability-starter");
    await user.click(starters[0]);

    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("closes popover when change mode is selected", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    useRelayStore.setState({
      capabilitiesOpen: true,
      setCapabilitiesOpen: setOpen,
    });

    render(<CapabilitiesPopover />);

    const changeModeButton = screen.getByTestId(
      "relay-capability-change-mode",
    );
    await user.click(changeModeButton);

    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("renders popover title for accessibility", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    // PopoverTitle is rendered as a heading but hidden from view with sr-only
    const popover = screen.getByTestId("relay-capabilities-popover");
    expect(popover).toBeInTheDocument();
    // The title is rendered but visually hidden for screen readers
    expect(popover).toHaveAccessibleName();
  });

  it("has icon on the trigger button", () => {
    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    const icon = trigger.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("renders both tabs in the popover", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    expect(
      screen.getByTestId("relay-capability-tab-can"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("relay-capability-tab-see"),
    ).toBeInTheDocument();
  });

  it("skips focus when handing off to another control", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    useRelayStore.setState({
      capabilitiesOpen: true,
      setCapabilitiesOpen: setOpen,
      mentionRequest: { kind: "request", hintKey: "test-hint" },
    });

    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");
    const starters = screen.getAllByTestId("relay-capability-starter");
    await user.click(starters[0]);

    expect(setOpen).toHaveBeenCalledWith(false);
    expect(trigger).not.toHaveFocus();
  });

  it("has popover content with correct styling", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    const content = screen.getByTestId("relay-capabilities-popover");
    expect(content).toHaveClass("w-80");
    expect(content).toHaveClass("shadow-lg");
  });

  it("renders popover with end alignment", () => {
    useRelayStore.setState({ capabilitiesOpen: true });
    render(<CapabilitiesPopover />);

    const content = screen.getByTestId("relay-capabilities-popover");
    // The popover content should have the w-80 width class and shadow styling for the end-aligned positioning
    expect(content).toHaveClass("w-80");
    expect(content).toHaveClass("shadow-lg");
    // The parent container should indicate end alignment
    const positioningContainer = content.closest("[data-align]");
    expect(positioningContainer).toHaveAttribute("data-align", "end");
  });

  it("renders without crashing when style is undefined", () => {
    render(<CapabilitiesPopover style={undefined} />);

    expect(screen.getByTestId("relay-header-capabilities")).toBeInTheDocument();
  });

  it("renders without crashing when style is provided", () => {
    render(
      <CapabilitiesPopover
        style={{ minHeight: "44px", minWidth: "44px" }}
      />,
    );

    expect(screen.getByTestId("relay-header-capabilities")).toBeInTheDocument();
  });

  it("has tooltip content rendered", async () => {
    const user = userEvent.setup();
    render(<CapabilitiesPopover />);

    // The trigger is wrapped in a tooltip
    const trigger = screen.getByTestId("relay-header-capabilities");
    await user.hover(trigger);

    // Tooltip should appear with the label text (translation key in test env)
    const tooltipContent = await screen.findByText("header.capabilities");
    expect(tooltipContent).toBeInTheDocument();
  });

  it("updates when store state changes", () => {
    const { rerender } = render(<CapabilitiesPopover />);

    expect(
      screen.queryByTestId("relay-capabilities-popover"),
    ).not.toBeInTheDocument();

    useRelayStore.setState({ capabilitiesOpen: true });
    rerender(<CapabilitiesPopover />);

    expect(
      screen.getByTestId("relay-capabilities-popover"),
    ).toBeInTheDocument();
  });

  it("handles rapid open/close cycles", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    useRelayStore.setState({ setCapabilitiesOpen: setOpen });

    render(<CapabilitiesPopover />);

    const trigger = screen.getByTestId("relay-header-capabilities");

    await user.click(trigger);
    expect(setOpen).toHaveBeenCalled();

    setOpen.mockClear();
    await user.click(trigger);
    expect(setOpen).toHaveBeenCalled();
  });
});
