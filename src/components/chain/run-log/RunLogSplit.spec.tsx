/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/chain.json";
import { useUIStore } from "@/stores/useUIStore";
import { RunLogSplit } from "./RunLogSplit";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (en as Record<string, string>)[key] ?? key,
}));

const localStore: Record<string, string> = {};
const setItem = vi.fn((k: string, v: string) => {
  localStore[k] = v;
});

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
  setItem.mockClear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem,
    removeItem: (k: string) => delete localStore[k],
  });
  useUIStore.setState({
    chainRunLogListWidth: 288,
    chainRunLogDetailRatio: 0.5,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSplit() {
  const view = render(
    <RunLogSplit
      list={<div>list</div>}
      steps={<div>steps</div>}
      detail={<div>detail</div>}
    />,
  );
  return {
    ...view,
    list: screen.getByRole("separator", { name: "Resize runs list" }),
    detail: screen.getByRole("separator", { name: "Resize step detail" }),
  };
}

describe("RunLogSplit", () => {
  it("renders the three panes and both separators with ARIA values", () => {
    const { list, detail } = renderSplit();
    expect(screen.getByText("list")).toBeInTheDocument();
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText("detail")).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(list).toHaveAttribute("aria-valuenow", "288");
    expect(list).toHaveAttribute("aria-valuemin", "200");
    expect(list).toHaveAttribute("aria-valuemax", "420");
    expect(detail).toHaveAttribute("aria-orientation", "horizontal");
    expect(detail).toHaveAttribute("aria-valuenow", "50");
    expect(detail).toHaveAttribute("aria-valuemin", "25");
    expect(detail).toHaveAttribute("aria-valuemax", "75");
  });

  it("resizes the list from the keyboard with Home/End clamping", () => {
    const { list } = renderSplit();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(useUIStore.getState().chainRunLogListWidth).toBe(304);
    fireEvent.keyDown(list, { key: "Home" });
    expect(useUIStore.getState().chainRunLogListWidth).toBe(200);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(useUIStore.getState().chainRunLogListWidth).toBe(200);
    fireEvent.keyDown(list, { key: "End" });
    expect(useUIStore.getState().chainRunLogListWidth).toBe(420);
  });

  it("resizes the detail ratio from the keyboard within 25-75%", () => {
    const { detail } = renderSplit();
    // happy-dom reports no layout, so the 400px fallback applies: 16px = 4%.
    fireEvent.keyDown(detail, { key: "ArrowUp" });
    expect(useUIStore.getState().chainRunLogDetailRatio).toBeCloseTo(0.54);
    fireEvent.keyDown(detail, { key: "End" });
    expect(useUIStore.getState().chainRunLogDetailRatio).toBe(0.75);
    fireEvent.keyDown(detail, { key: "ArrowUp" });
    expect(useUIStore.getState().chainRunLogDetailRatio).toBe(0.75);
    fireEvent.keyDown(detail, { key: "Home" });
    expect(useUIStore.getState().chainRunLogDetailRatio).toBe(0.25);
  });

  it("resets both separators to their defaults on double-click", () => {
    const { list, detail } = renderSplit();
    fireEvent.keyDown(list, { key: "End" });
    fireEvent.keyDown(detail, { key: "End" });
    fireEvent.doubleClick(list);
    fireEvent.doubleClick(detail);
    expect(useUIStore.getState().chainRunLogListWidth).toBe(288);
    expect(useUIStore.getState().chainRunLogDetailRatio).toBe(0.5);
  });

  it("keeps drag values local and writes the store once on pointer-up", () => {
    const { list } = renderSplit();
    fireEvent.pointerDown(list, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(list, { clientX: 120, pointerId: 1 });
    fireEvent.pointerMove(list, { clientX: 140, pointerId: 1 });
    expect(list).toHaveAttribute("aria-valuenow", "328");
    expect(setItem).not.toHaveBeenCalled();
    expect(useUIStore.getState().chainRunLogListWidth).toBe(288);

    fireEvent.pointerUp(list, { pointerId: 1 });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().chainRunLogListWidth).toBe(328);
  });

  it("persists across remount", () => {
    const first = renderSplit();
    fireEvent.keyDown(first.list, { key: "ArrowRight" });
    first.unmount();
    const second = renderSplit();
    expect(second.list).toHaveAttribute("aria-valuenow", "304");
  });

  it("falls back to defaults when stored prefs are corrupt", () => {
    useUIStore.setState({
      chainRunLogListWidth: Number.NaN,
      chainRunLogDetailRatio: Number.NaN,
    });
    const { list, detail } = renderSplit();
    expect(list).toHaveAttribute("aria-valuenow", "288");
    expect(detail).toHaveAttribute("aria-valuenow", "50");
  });

  describe("narrow dock", () => {
    function renderAtWidth(width: number) {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width,
        height: 400,
      } as DOMRect);
      return render(
        <RunLogSplit
          list={<div>list</div>}
          runSelect={<div>run-select</div>}
          steps={<div>steps</div>}
          detail={<div>detail</div>}
        />,
      );
    }

    afterEach(() => vi.restoreAllMocks());

    it("shows the run select and hides list and vertical separator at 559px", () => {
      renderAtWidth(559);
      expect(screen.getByText("run-select")).toBeInTheDocument();
      expect(screen.queryByText("list")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("separator", { name: "Resize runs list" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("separator", { name: "Resize step detail" }),
      ).toBeInTheDocument();
    });

    it("shows the list and separator at 560px", () => {
      renderAtWidth(560);
      expect(screen.getByText("list")).toBeInTheDocument();
      expect(screen.queryByText("run-select")).not.toBeInTheDocument();
      expect(
        screen.getByRole("separator", { name: "Resize runs list" }),
      ).toBeInTheDocument();
    });
  });
});
