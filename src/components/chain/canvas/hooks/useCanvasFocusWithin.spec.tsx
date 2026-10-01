/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCanvasFocusWithin } from "./useCanvasFocusWithin";

function Harness() {
  const { wrapperRef, focused, focusProps } = useCanvasFocusWithin();
  return (
    <>
      <button type="button" data-testid="outside">
        outside
      </button>
      <div ref={wrapperRef} tabIndex={0} data-testid="wrapper" {...focusProps}>
        <button type="button" data-testid="inside">
          inside
        </button>
      </div>
      <output data-testid="state">{String(focused)}</output>
    </>
  );
}

describe("useCanvasFocusWithin", () => {
  afterEach(cleanup);

  it("is focused when a descendant gains focus and stays focused while focus moves within", () => {
    render(<Harness />);
    const inside = screen.getByTestId("inside");
    act(() => inside.focus());
    expect(screen.getByTestId("state").textContent).toBe("true");
    act(() => screen.getByTestId("wrapper").focus());
    expect(screen.getByTestId("state").textContent).toBe("true");
  });

  it("clears when focus moves outside the wrapper", () => {
    render(<Harness />);
    act(() => screen.getByTestId("inside").focus());
    act(() => screen.getByTestId("outside").focus());
    expect(screen.getByTestId("state").textContent).toBe("false");
  });

  it("clears when focus leaves the document (null relatedTarget)", () => {
    render(<Harness />);
    act(() => screen.getByTestId("inside").focus());
    fireEvent.blur(screen.getByTestId("inside"), { relatedTarget: null });
    expect(screen.getByTestId("state").textContent).toBe("false");
  });
});
