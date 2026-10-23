// @vitest-environment happy-dom

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { PermissionShield } from "./PermissionShield";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return typeof template === "string"
      ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""))
      : key;
  },
}));

// Match relay intl structure
const en = {
  permission: {
    triggerTooltip: "Mode: {name}",
    title: "Permission mode",
    groupLabel: "Select your approval mode",
    badge: {
      recommended: "Recommended",
      caution: "Use with caution",
    },
    settingsLabel: "Permission mode",
    option: {
      review: {
        labelKey: "permission.option.review",
        label: "Review each action",
        descriptionKey: "permission.option.review.description",
        description: "Relay asks before taking any action",
      },
      skip: {
        labelKey: "permission.option.skip",
        label: "Skip all approvals",
        descriptionKey: "permission.option.skip.description",
        description: "Use with caution",
      },
      "always-ask": {
        labelKey: "permission.option.always-ask",
        label: "Always ask",
        descriptionKey: "permission.option.always-ask.description",
        description: "Even auto-approve actions ask first",
      },
    },
  },
  "permission.option.review": "Review each action",
  "permission.option.review.description": "Relay asks before taking action",
  "permission.option.skip": "Skip all approvals",
  "permission.option.skip.description": "Relay runs all actions without asking",
  "permission.option.always-ask": "Always ask",
  "permission.option.always-ask.description": "Every action asks for approval",
};

afterEach(cleanup);

beforeEach(() => {
  useRelayPermissionStore.setState({ mode: "review" });
  useRelayStore.setState({ permissionPopoverOpen: false });
});

describe("PermissionShield", () => {
  it("renders with the review mode icon by default", () => {
    render(<PermissionShield />);
    const trigger = screen.getByTestId("relay-permission-trigger");
    expect(trigger).toHaveAttribute("data-mode", "review");
  });

  it("has aria-label with the mode name on the trigger", () => {
    render(<PermissionShield />);
    const trigger = screen.getByTestId("relay-permission-trigger");
    expect(trigger).toHaveAttribute("aria-label", expect.stringContaining("Mode:"));
  });

  it("opens the popover when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<PermissionShield />);

    const trigger = screen.getByTestId("relay-permission-trigger");
    await user.click(trigger);

    expect(screen.getByTestId("relay-permission-popover")).toBeInTheDocument();
    expect(screen.getByTestId("relay-permission-group")).toBeInTheDocument();
  });

  it("closes the popover when a mode is chosen", async () => {
    const user = userEvent.setup();
    useRelayStore.setState({ permissionPopoverOpen: true });
    render(<PermissionShield />);

    await user.click(screen.getByTestId("relay-permission-option-skip"));

    expect(useRelayStore.getState().permissionPopoverOpen).toBe(false);
  });

  it("updates the permission mode when an option is selected", async () => {
    const user = userEvent.setup();
    useRelayStore.setState({ permissionPopoverOpen: true });
    render(<PermissionShield />);

    await user.click(screen.getByTestId("relay-permission-option-always-ask"));

    expect(useRelayPermissionStore.getState().mode).toBe("always-ask");
  });

  describe("radiogroup keyboard navigation", () => {
    it("focuses the next option with the down arrow key", async () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const radioGroup = screen.getByTestId("relay-permission-group");
      fireEvent.keyDown(radioGroup, { key: "ArrowDown" });

      const skipOption = screen.getByTestId("relay-permission-option-skip") as HTMLButtonElement;
      expect(skipOption).toHaveFocus();
      expect(skipOption).toHaveAttribute("tabindex", "0");
    });

    it("focuses the previous option with the up arrow key", async () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const radioGroup = screen.getByTestId("relay-permission-group");
      fireEvent.keyDown(radioGroup, { key: "ArrowUp" });

      const reviewOption = screen.getByTestId("relay-permission-option-review") as HTMLButtonElement;
      expect(reviewOption).toHaveFocus();
    });

    it("jumps to the first option with the Home key", async () => {
      useRelayPermissionStore.setState({ mode: "always-ask" });
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const radioGroup = screen.getByTestId("relay-permission-group");
      fireEvent.keyDown(radioGroup, { key: "Home" });

      const alwaysAskOption = screen.getByTestId(
        "relay-permission-option-always-ask",
      ) as HTMLButtonElement;
      expect(alwaysAskOption).toHaveFocus();
    });

    it("jumps to the last option with the End key", async () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const radioGroup = screen.getByTestId("relay-permission-group");
      fireEvent.keyDown(radioGroup, { key: "End" });

      const skipOption = screen.getByTestId(
        "relay-permission-option-skip",
      ) as HTMLButtonElement;
      expect(skipOption).toHaveFocus();
    });

    it("selects the option with the Space key", async () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const skipOption = screen.getByTestId("relay-permission-option-skip");
      fireEvent.keyDown(skipOption, { key: " " });

      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });

    it("selects the option with the Enter key", async () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const skipOption = screen.getByTestId("relay-permission-option-skip");
      fireEvent.keyDown(skipOption, { key: "Enter" });

      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });

    it("maintains roving tabindex with only one tab stop at a time", async () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const reviewOption = screen.getByTestId("relay-permission-option-review") as HTMLButtonElement;
      expect(reviewOption).toHaveAttribute("tabindex", "0");

      const radioGroup = screen.getByTestId("relay-permission-group");
      fireEvent.keyDown(radioGroup, { key: "ArrowDown" });

      expect(reviewOption).toHaveAttribute("tabindex", "-1");
      const skipOption = screen.getByTestId("relay-permission-option-skip") as HTMLButtonElement;
      expect(skipOption).toHaveAttribute("tabindex", "0");
    });
  });

  describe("radio button states", () => {
    it("marks the current mode as checked", () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const reviewOption = screen.getByTestId("relay-permission-option-review");
      expect(reviewOption).toHaveAttribute("aria-checked", "true");

      const skipOption = screen.getByTestId("relay-permission-option-skip");
      expect(skipOption).toHaveAttribute("aria-checked", "false");
    });

    it("applies the checked styling to the selected mode", () => {
      useRelayPermissionStore.setState({ mode: "review" });
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const reviewOption = screen.getByTestId("relay-permission-option-review");
      expect(reviewOption.className).toContain("border-border");
      expect(reviewOption.className).toContain("bg-accent");
    });

    it("applies caution styling to the caution mode when checked", () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const skipOption = screen.getByTestId("relay-permission-option-skip");
      expect(skipOption.className).toContain("border-warning");
      expect(skipOption.className).toContain("bg-warning");
    });

    it("shows the check icon only for the selected mode", () => {
      useRelayStore.setState({ permissionPopoverOpen: true });
      render(<PermissionShield />);

      const reviewOption = screen.getByTestId("relay-permission-option-review");
      const skipOption = screen.getByTestId("relay-permission-option-skip");

      const reviewCheckIcons = reviewOption.querySelectorAll("svg");
      const skipCheckIcons = skipOption.querySelectorAll("svg");

      // Review should show check icon (not invisible)
      expect(reviewCheckIcons.length).toBeGreaterThan(0);
      // All SVGs in skip option should be visible (the last one is check icon with invisible class)
      const skipCheckIcon = Array.from(skipCheckIcons).pop();
      expect(String(skipCheckIcon?.className)).toContain("invisible");
    });
  });

  describe("permission mode data attributes", () => {
    it("sets data-mode to review on the trigger", () => {
      render(<PermissionShield />);
      expect(screen.getByTestId("relay-permission-trigger")).toHaveAttribute("data-mode", "review");
    });

    it("sets data-mode to skip on the trigger when skip is selected", () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      render(<PermissionShield />);
      expect(screen.getByTestId("relay-permission-trigger")).toHaveAttribute("data-mode", "skip");
    });

    it("sets data-mode to always-ask on the trigger when always-ask is selected", () => {
      useRelayPermissionStore.setState({ mode: "always-ask" });
      render(<PermissionShield />);
      expect(screen.getByTestId("relay-permission-trigger")).toHaveAttribute("data-mode", "always-ask");
    });
  });

  describe("touch target sizing", () => {
    it("applies touch target styles when touchTargets is true", () => {
      render(<PermissionShield touchTargets />);
      const trigger = screen.getByTestId("relay-permission-trigger");
      expect(trigger.style.minHeight).toBe("44px");
      expect(trigger.style.minWidth).toBe("44px");
    });

    it("does not apply touch target styles when touchTargets is false", () => {
      render(<PermissionShield touchTargets={false} />);
      const trigger = screen.getByTestId("relay-permission-trigger");
      expect(trigger.style.minHeight).not.toBe("44px");
    });
  });

  it("renders all three permission options in the popover", () => {
    useRelayStore.setState({ permissionPopoverOpen: true });
    render(<PermissionShield />);

    expect(screen.getByTestId("relay-permission-option-review")).toBeInTheDocument();
    expect(screen.getByTestId("relay-permission-option-skip")).toBeInTheDocument();
    expect(screen.getByTestId("relay-permission-option-always-ask")).toBeInTheDocument();
  });

  it("shows the recommended badge for the review mode", () => {
    useRelayStore.setState({ permissionPopoverOpen: true });
    render(<PermissionShield />);

    const reviewOption = screen.getByTestId("relay-permission-option-review");
    expect(reviewOption.textContent).toContain("Recommended");
  });

  it("shows the caution badge for the skip mode", () => {
    useRelayStore.setState({ permissionPopoverOpen: true });
    render(<PermissionShield />);

    const skipOption = screen.getByTestId("relay-permission-option-skip");
    expect(skipOption.textContent).toContain("Use with caution");
  });

  it("respects the open state from the relay store", () => {
    useRelayStore.setState({ permissionPopoverOpen: true });
    const { rerender } = render(<PermissionShield />);
    expect(screen.getByTestId("relay-permission-popover")).toBeInTheDocument();

    useRelayStore.setState({ permissionPopoverOpen: false });
    rerender(<PermissionShield />);
    expect(screen.queryByTestId("relay-permission-popover")).not.toBeInTheDocument();
  });
});
