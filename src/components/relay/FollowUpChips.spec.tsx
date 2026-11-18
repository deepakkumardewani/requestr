/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { FollowUpChips } from "./FollowUpChips";

beforeEach(() => useRelayStore.getState().setComposerHasText(false));
afterEach(() => {
  cleanup();
  useRelayStore.getState().setComposerHasText(false);
});

describe("FollowUpChips", () => {
  it("renders nothing without keys", () => {
    const { container } = render(<FollowUpChips keys={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per key in a labelled group", () => {
    render(<FollowUpChips keys={["fixRequest", "addAssertions"]} onSelect={vi.fn()} />);
    expect(screen.getByRole("group", { name: "label" })).toBeTruthy();
    const chips = screen.getAllByTestId("relay-follow-up");
    expect(chips.map((c) => c.textContent)).toEqual(["fixRequest", "addAssertions"]);
  });

  it("sends the chip's label as the prompt", () => {
    const onSelect = vi.fn();
    render(<FollowUpChips keys={["fixRequest", "explainHeaders"]} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByTestId("relay-follow-up")[1]);
    expect(onSelect).toHaveBeenCalledWith("explainHeaders");
  });

  it("hides while the composer has text and returns when it clears", () => {
    render(<FollowUpChips keys={["fixRequest"]} onSelect={vi.fn()} />);
    act(() => useRelayStore.getState().setComposerHasText(true));
    expect(screen.queryByTestId("relay-follow-ups")).toBeNull();
    act(() => useRelayStore.getState().setComposerHasText(false));
    expect(screen.getByTestId("relay-follow-ups")).toBeTruthy();
  });
});
