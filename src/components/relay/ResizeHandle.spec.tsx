/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_KEY_RESIZE_STEP_PX,
  RELAY_MIN_WIDTH_PX,
  RELAY_RESIZE_HANDLE_HIT_PX,
} from "@/lib/relay/constants";
import { ResizeHandle } from "./ResizeHandle";

const VIEWPORT_PX = 1000;
const WIDTH_PX = 400;
const POINTER_ID = 1;

function setup() {
  const onWidthChange = vi.fn();
  render(<ResizeHandle width={WIDTH_PX} onWidthChange={onWidthChange} />);
  const handle = screen.getByTestId("relay-resize-handle");
  return { handle, onWidthChange };
}

/** happy-dom does not implement pointer capture, so model it on the element. */
function stubPointerCapture(handle: HTMLElement) {
  let captured = false;
  handle.setPointerCapture = vi.fn(() => {
    captured = true;
  });
  handle.releasePointerCapture = vi.fn(() => {
    captured = false;
  });
  handle.hasPointerCapture = vi.fn(() => captured);
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", VIEWPORT_PX);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResizeHandle", () => {
  it("is a focusable vertical separator exposing its range", () => {
    const { handle } = setup();

    expect(handle).toHaveAttribute("role", "separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle).toHaveAttribute("aria-valuenow", String(WIDTH_PX));
    expect(handle).toHaveAttribute("aria-valuemin", String(RELAY_MIN_WIDTH_PX));
    expect(handle).toHaveAttribute("aria-valuemax", "600");
    expect(handle).toHaveStyle({ width: `${RELAY_RESIZE_HANDLE_HIT_PX}px` });
  });

  it("widens by one step on ArrowLeft", () => {
    const { handle, onWidthChange } = setup();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onWidthChange).toHaveBeenCalledWith(
      WIDTH_PX + RELAY_KEY_RESIZE_STEP_PX,
    );
  });

  it("narrows by one step on ArrowRight", () => {
    const { handle, onWidthChange } = setup();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onWidthChange).toHaveBeenCalledWith(
      WIDTH_PX - RELAY_KEY_RESIZE_STEP_PX,
    );
  });

  it("ignores other keys", () => {
    const { handle, onWidthChange } = setup();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it("sizes the dock from the distance to the right edge while dragging", () => {
    const { handle, onWidthChange } = setup();
    stubPointerCapture(handle);

    fireEvent.pointerDown(handle, { pointerId: POINTER_ID, clientX: 600 });
    fireEvent.pointerMove(handle, { pointerId: POINTER_ID, clientX: 700 });

    expect(onWidthChange).toHaveBeenLastCalledWith(VIEWPORT_PX - 700);
  });

  it("does not resize on hover without a pressed pointer", () => {
    const { handle, onWidthChange } = setup();
    stubPointerCapture(handle);

    fireEvent.pointerMove(handle, { pointerId: POINTER_ID, clientX: 700 });

    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it("stops resizing after the pointer is released", () => {
    const { handle, onWidthChange } = setup();
    stubPointerCapture(handle);

    fireEvent.pointerDown(handle, { pointerId: POINTER_ID });
    fireEvent.pointerUp(handle, { pointerId: POINTER_ID });
    fireEvent.pointerMove(handle, { pointerId: POINTER_ID, clientX: 500 });

    expect(handle.releasePointerCapture).toHaveBeenCalledWith(POINTER_ID);
    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it("releases capture when the gesture is cancelled", () => {
    const { handle } = setup();
    stubPointerCapture(handle);

    fireEvent.pointerDown(handle, { pointerId: POINTER_ID });
    fireEvent.pointerCancel(handle, { pointerId: POINTER_ID });

    expect(handle.releasePointerCapture).toHaveBeenCalledWith(POINTER_ID);
  });

  it("does not release capture it never held", () => {
    const { handle } = setup();
    stubPointerCapture(handle);

    fireEvent.pointerUp(handle, { pointerId: POINTER_ID });

    expect(handle.releasePointerCapture).not.toHaveBeenCalled();
  });
});
