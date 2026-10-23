/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestLocale } from "@/vitest-setup";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import type { CapabilityExample } from "@/lib/relay/capabilities";
import { CapabilitiesPanel } from "./CapabilitiesPanel";

afterEach(cleanup);

beforeEach(() => {
  setTestLocale("en");
  useRelayPermissionStore.setState({ mode: "skip" });
});

describe("CapabilitiesPanel", () => {
  describe("popover variant", () => {
    it("renders the popover layout with tabs and footer", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      expect(screen.getByTestId("relay-capabilities-panel")).toHaveAttribute(
        "data-variant",
        "popover",
      );
      expect(
        screen.getByTestId("relay-capability-tab-can"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-tab-see"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-change-mode"),
      ).toBeInTheDocument();
    });

    it("shows the capabilities tab by default", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      // The can tab should be rendered and the panel should be visible
      const canTab = screen.getByTestId("relay-capability-tab-can");
      expect(canTab).toBeInTheDocument();
      // Verify capabilities content is shown (not see list)
      const starters = screen.getAllByTestId("relay-capability-starter");
      expect(starters.length).toBeGreaterThan(0);
    });

    it("displays all capability categories", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      expect(
        screen.getByTestId("relay-capability-category-read"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-write"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-run"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-organize"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-transfer"),
      ).toBeInTheDocument();
    });

    it("renders starter examples for each category", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const starters = screen.getAllByTestId("relay-capability-starter");
      expect(starters.length).toBeGreaterThan(0);
    });

    it("calls onStarter with the example when a starter is clicked", async () => {
      const user = userEvent.setup();
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const firstStarter = screen.getAllByTestId(
        "relay-capability-starter",
      )[0];
      await user.click(firstStarter);

      expect(onStarter).toHaveBeenCalledTimes(1);
      expect(onStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          promptKey: expect.any(String),
        }),
      );
    });

    it("calls onChangeMode when the footer button is clicked", async () => {
      const user = userEvent.setup();
      const onChangeMode = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={vi.fn()}
          onChangeMode={onChangeMode}
        />,
      );

      const changeModeButton = screen.getByTestId(
        "relay-capability-change-mode",
      );
      await user.click(changeModeButton);

      expect(onChangeMode).toHaveBeenCalledTimes(1);
    });

    it("renders action lines with permission badges", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const actions = screen.getAllByTestId("relay-capability-action");
      expect(actions.length).toBeGreaterThan(0);

      const badges = screen.getAllByTestId("relay-capability-badge");
      expect(badges.length).toBeGreaterThan(0);
      for (const badge of badges) {
        expect(badge).toHaveAttribute("data-badge");
      }
    });

    it("shows 'runs' badge for skip mode", () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const badges = screen.getAllByTestId("relay-capability-badge");
      expect(badges.some((b) => b.getAttribute("data-badge") === "runs")).toBe(
        true,
      );
    });

    it("shows 'asks' badge for always-ask mode", () => {
      useRelayPermissionStore.setState({ mode: "always-ask" });
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const badges = screen.getAllByTestId("relay-capability-badge");
      expect(badges.some((b) => b.getAttribute("data-badge") === "asks")).toBe(
        true,
      );
    });

    it("badges update live while mounted when the permission mode changes in the store", () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      // All 13 badges should show 'runs' in skip mode
      let badges = screen.getAllByTestId("relay-capability-badge");
      expect(badges.length).toBe(13);
      badges.forEach((badge) => {
        expect(badge.getAttribute("data-badge")).toBe("runs");
      });

      // Change the store state without rerender - proves live subscription
      act(() => {
        useRelayPermissionStore.setState({ mode: "always-ask" });
      });

      // Exactly 10 badges should show 'asks' in always-ask mode
      // (read-1, read-2, and organize-3 stay 'runs')
      badges = screen.getAllByTestId("relay-capability-badge");
      expect(badges.length).toBe(13);
      const asksBadges = badges.filter(
        (b) => b.getAttribute("data-badge") === "asks",
      );
      expect(asksBadges.length).toBe(10);
      const runsBadges = badges.filter(
        (b) => b.getAttribute("data-badge") === "runs",
      );
      expect(runsBadges.length).toBe(3);
    });

    it("renders the see tab with content when clicked", async () => {
      const user = userEvent.setup();
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const seeTab = screen.getByTestId("relay-capability-tab-see");
      await user.click(seeTab);

      // After clicking the see tab, the see list should be visible
      expect(
        screen.getByTestId("relay-capability-see-list"),
      ).toBeInTheDocument();
    });

    it("has accessible category labels", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const sections = screen.getAllByRole("region");
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section).toHaveAttribute("aria-label");
      }
    });
  });

  describe("empty variant", () => {
    it("renders the empty layout without tabs and footer", () => {
      const onStarter = vi.fn();
      render(<CapabilitiesPanel variant="empty" onStarter={onStarter} />);

      expect(screen.getByTestId("relay-capabilities-panel")).toHaveAttribute(
        "data-variant",
        "empty",
      );
      expect(
        screen.queryByTestId("relay-capability-tab-can"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("relay-capability-change-mode"),
      ).not.toBeInTheDocument();
    });

    it("displays only starter examples, no actions", () => {
      const onStarter = vi.fn();
      render(<CapabilitiesPanel variant="empty" onStarter={onStarter} />);

      const starters = screen.getAllByTestId("relay-capability-starter");
      expect(starters.length).toBeGreaterThan(0);

      // No action lines in empty variant
      expect(
        screen.queryByTestId("relay-capability-action"),
      ).not.toBeInTheDocument();
    });

    it("calls onStarter when an example is clicked", async () => {
      const user = userEvent.setup();
      const onStarter = vi.fn();
      render(<CapabilitiesPanel variant="empty" onStarter={onStarter} />);

      const firstStarter = screen.getAllByTestId(
        "relay-capability-starter",
      )[0];
      await user.click(firstStarter);

      expect(onStarter).toHaveBeenCalledTimes(1);
      expect(onStarter).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          promptKey: expect.any(String),
        }),
      );
    });

    it("displays all categories", () => {
      const onStarter = vi.fn();
      render(<CapabilitiesPanel variant="empty" onStarter={onStarter} />);

      expect(
        screen.getByTestId("relay-capability-category-read"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-write"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-run"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-organize"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("relay-capability-category-transfer"),
      ).toBeInTheDocument();
    });

    it("renders category icons and titles", () => {
      const onStarter = vi.fn();
      render(<CapabilitiesPanel variant="empty" onStarter={onStarter} />);

      // Check that each category has an SVG icon
      const categories = screen.getAllByRole("region");
      for (const category of categories) {
        const icon = category.querySelector("svg");
        expect(icon).toBeInTheDocument();
      }
    });

    it("does not pass onChangeMode to empty variant", () => {
      const onStarter = vi.fn();
      const onChangeMode = vi.fn();

      // Empty variant should not receive onChangeMode
      render(
        <CapabilitiesPanel
          variant="empty"
          onStarter={onStarter}
          onChangeMode={onChangeMode}
        />,
      );

      expect(
        screen.queryByTestId("relay-capability-change-mode"),
      ).not.toBeInTheDocument();
    });
  });

  describe("category icons", () => {
    it("displays correct icon for read category", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const readCategory = screen.getByTestId(
        "relay-capability-category-read",
      );
      expect(readCategory.querySelector("svg")).toBeInTheDocument();
    });

    it("displays correct icon for write category", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const writeCategory = screen.getByTestId(
        "relay-capability-category-write",
      );
      expect(writeCategory.querySelector("svg")).toBeInTheDocument();
    });

    it("displays correct icon for run category", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const runCategory = screen.getByTestId(
        "relay-capability-category-run",
      );
      expect(runCategory.querySelector("svg")).toBeInTheDocument();
    });

    it("renders hidden icons from accessibility tree", () => {
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const svgs = screen.getByTestId(
        "relay-capability-category-read",
      ).querySelectorAll("svg[aria-hidden]");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("badge styling", () => {
    it("applies warning styling to asks badge", () => {
      useRelayPermissionStore.setState({ mode: "always-ask" });
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel
          variant="popover"
          onStarter={onStarter}
          onChangeMode={vi.fn()}
        />,
      );

      const asksBadges = screen.getAllByTestId("relay-capability-badge");
      const hasWarningClass = asksBadges.some((badge) => {
        const className = badge.className;
        return className.includes("warning");
      });
      expect(hasWarningClass).toBe(true);
    });
  });

  describe("multiple starter clicks", () => {
    it("handles multiple consecutive starter clicks", async () => {
      const user = userEvent.setup();
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const starters = screen.getAllByTestId("relay-capability-starter");
      await user.click(starters[0]);
      await user.click(starters[1]);

      expect(onStarter).toHaveBeenCalledTimes(2);
    });

    it("passes different examples for each starter", async () => {
      const user = userEvent.setup();
      const onStarter = vi.fn();
      render(
        <CapabilitiesPanel variant="empty" onStarter={onStarter} />,
      );

      const starters = screen.getAllByTestId("relay-capability-starter");
      await user.click(starters[0]);
      await user.click(starters[1]);

      const firstCall = onStarter.mock.calls[0][0];
      const secondCall = onStarter.mock.calls[1][0];
      expect(firstCall).not.toEqual(secondCall);
    });
  });
});
