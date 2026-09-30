/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasEmptyState } from "./CanvasEmptyState";

describe("CanvasEmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  it("explains the canvas model including Success/Fail handle semantics", () => {
    render(
      <CanvasEmptyState onAddFromCollection={vi.fn()} onAddBlock={vi.fn()} />,
    );

    expect(
      screen.getByText(/success handles connect to what runs next/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/fail handles connect to/i)).toBeInTheDocument();
  });

  it("invokes onAddFromCollection when the Add from collection button is clicked", async () => {
    const user = userEvent.setup();
    const onAddFromCollection = vi.fn();

    render(
      <CanvasEmptyState
        onAddFromCollection={onAddFromCollection}
        onAddBlock={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /add from collection/i }),
    );

    expect(onAddFromCollection).toHaveBeenCalledTimes(1);
  });

  it("invokes onAddBlock when the Add block button is clicked", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();

    render(
      <CanvasEmptyState onAddFromCollection={vi.fn()} onAddBlock={onAddBlock} />,
    );

    await user.click(screen.getByRole("button", { name: /add block/i }));

    expect(onAddBlock).toHaveBeenCalledTimes(1);
  });
});
