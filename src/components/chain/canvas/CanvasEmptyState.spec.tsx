/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasEmptyState } from "./CanvasEmptyState";

// The shared next-intl mock flattens rich text; this one honours <kbd> chunks so
// the key-cap rendering is observable.
vi.mock("next-intl", async () => {
  const messages = (await import("../../../../messages/en/chain.json")).default as Record<string, string>;
  return {
    useTranslations: () => {
      const t = (key: string) => messages[key] ?? key;
      t.rich = (
        key: string,
        tags: { kbd: (chunks: ReactNode) => ReactNode },
      ) => {
        const [before, key_, after] = (messages[key] ?? key).split(/<\/?kbd>/);
        return (
          <>
            {before}
            {tags.kbd(key_)}
            {after}
          </>
        );
      };
      return t;
    },
  };
});

function renderEmptyState(overrides: { onAddApi?: () => void; onAddBlock?: () => void } = {}) {
  return render(
    <CanvasEmptyState
      onAddApi={overrides.onAddApi ?? vi.fn()}
      onAddBlock={overrides.onAddBlock ?? vi.fn()}
    />,
  );
}

describe("CanvasEmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title, description and hint with a kbd for the slash key", () => {
    renderEmptyState();
    expect(screen.getByText("Start building your chain")).toBeInTheDocument();
    expect(
      screen.getByText(/connect them to set the run order/i),
    ).toBeInTheDocument();
    const hint = screen.getByText(/right-click/i);
    expect(hint).toHaveTextContent("or press / · right-click · + Block");
    expect(within(hint).getByText("/").tagName).toBe("KBD");
  });

  it("no longer renders the quick-add grid", () => {
    renderEmptyState();
    expect(screen.queryByTestId("empty-quick-add-delay")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Start with" })).not.toBeInTheDocument();
  });

  it("opens the request picker from the Add API button", async () => {
    const user = userEvent.setup();
    const onAddApi = vi.fn();
    renderEmptyState({ onAddApi });
    const button = screen.getByTestId("empty-add-api-btn");
    expect(button).toHaveTextContent("Add API");
    await user.click(button);
    expect(onAddApi).toHaveBeenCalledTimes(1);
  });

  it("calls onAddBlock with start and no position from the Add Start block button", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    renderEmptyState({ onAddBlock });
    await user.click(screen.getByTestId("empty-add-start-btn"));
    expect(onAddBlock).toHaveBeenCalledTimes(1);
    expect(onAddBlock).toHaveBeenCalledWith("start");
  });

  it("lets pointer events pass through the root but captures them on the content", () => {
    renderEmptyState();
    const root = screen.getByTestId("chain-empty-state");
    expect(root).toHaveClass("pointer-events-none");
    expect(root.firstElementChild).toHaveClass("pointer-events-auto");
  });

  it("only applies the entrance animation when motion is allowed", () => {
    renderEmptyState();
    const content = screen.getByTestId("chain-empty-state")
      .firstElementChild as HTMLElement;
    const animationClasses = content.className
      .split(/\s+/)
      .filter((c) => c.includes("animate-in"));
    expect(animationClasses.length).toBeGreaterThan(0);
    for (const cls of animationClasses) {
      expect(cls.startsWith("motion-safe:")).toBe(true);
    }
  });

  it("puts Add API first in tab order, followed by Add Start block", () => {
    renderEmptyState();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("data-testid", "empty-add-api-btn");
    expect(buttons[1]).toHaveAttribute("data-testid", "empty-add-start-btn");
  });
});
