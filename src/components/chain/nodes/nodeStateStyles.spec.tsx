/** @vitest-environment happy-dom */
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChainNodeState } from "@/types/chain";
import { STATE_BG, STATE_BORDER, StateIcon } from "./nodeStateStyles";

const STATES: ChainNodeState[] = [
  "idle",
  "running",
  "passed",
  "failed",
  "skipped",
];

describe("nodeStateStyles", () => {
  it("STATE_BORDER and STATE_BG define a class for every ChainNodeState", () => {
    for (const state of STATES) {
      expect(STATE_BORDER[state]).toBeTruthy();
      expect(STATE_BG[state]).toBeTruthy();
    }
  });

  it("StateIcon renders a distinct icon per state at the default size", () => {
    for (const state of STATES) {
      const { container } = render(<StateIcon state={state} />);
      expect(container.firstChild).toBeTruthy();
    }
  });

  it("StateIcon honors a custom size class", () => {
    const { container } = render(
      <StateIcon state="passed" size="h-3.5 w-3.5" />,
    );
    expect(container.querySelector(".h-3\\.5")).toBeTruthy();
  });

  it("StateIcon falls back to a dash for an unrecognized state", () => {
    const { container } = render(
      <StateIcon state={"bogus" as ChainNodeState} />,
    );
    expect(within(container).getByText("–")).toBeTruthy();
  });
});
