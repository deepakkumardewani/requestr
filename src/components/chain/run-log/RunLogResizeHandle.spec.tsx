/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/chain.json";
import { ResizeSeparator, RunLogResizeHandle } from "./RunLogResizeHandle";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (en as Record<string, string>)[key] ?? key,
}));

afterEach(cleanup);

function renderSeparator(
  props: Partial<React.ComponentProps<typeof ResizeSeparator>> = {},
) {
  const onPreview = vi.fn();
  const onCommit = vi.fn();
  render(
    <ResizeSeparator
      orientation="vertical"
      label="Resize"
      value={300}
      min={200}
      max={400}
      defaultValue={288}
      onPreview={onPreview}
      onCommit={onCommit}
      {...props}
    />,
  );
  return { handle: screen.getByRole("separator"), onPreview, onCommit };
}

describe("ResizeSeparator", () => {
  it("exposes separator semantics and is focusable", () => {
    const { handle } = renderSeparator();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(handle).toHaveAttribute("aria-valuemax", "400");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("steps 16px with the arrows of its axis and ignores the others", () => {
    const { handle, onCommit } = renderSeparator();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onCommit).toHaveBeenLastCalledWith(284);
    onCommit.mockClear();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: "a" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("uses Up/Down for a horizontal separator", () => {
    const { handle, onCommit } = renderSeparator({ orientation: "horizontal" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onCommit).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(onCommit).toHaveBeenLastCalledWith(284);
  });

  it("jumps to the bounds with Home and End and clamps arrows", () => {
    const { handle, onCommit } = renderSeparator({ value: 395 });
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onCommit).toHaveBeenLastCalledWith(200);
    fireEvent.keyDown(handle, { key: "End" });
    expect(onCommit).toHaveBeenLastCalledWith(400);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenLastCalledWith(400);
  });

  it("resets to the default on double-click", () => {
    const { handle, onCommit } = renderSeparator();
    fireEvent.doubleClick(handle);
    expect(onCommit).toHaveBeenCalledWith(288);
  });

  it("previews while dragging and commits once on pointer-up, clamped", () => {
    const { handle, onPreview, onCommit } = renderSeparator();
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 130, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenLastCalledWith(400);
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(400);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("does not commit when a drag changes nothing, or move without press", () => {
    const { handle, onPreview, onCommit } = renderSeparator();
    fireEvent.pointerMove(handle, { clientX: 50, pointerId: 1 });
    expect(onPreview).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("grows upward for a horizontal separator and scales by units per pixel", () => {
    const { handle, onCommit } = renderSeparator({
      orientation: "horizontal",
      value: 50,
      min: 25,
      max: 75,
      getUnitsPerPixel: () => 0.1,
    });
    fireEvent.pointerDown(handle, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onCommit).toHaveBeenCalledWith(60);
  });
});

describe("RunLogResizeHandle", () => {
  it("renders the localized dock-height separator with a default reset", () => {
    const onCommit = vi.fn();
    render(
      <RunLogResizeHandle
        height={300}
        maxHeight={500}
        onPreview={vi.fn()}
        onCommit={onCommit}
      />,
    );
    const handle = screen.getByRole("separator", { name: "Resize run log" });
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
    expect(handle).toHaveAttribute("aria-valuemin", "160");
    fireEvent.doubleClick(handle);
    expect(onCommit).toHaveBeenCalledWith(280);
  });
});
