/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import { PickerProvider, usePickerActions } from "./PickerContext";
import { PickerFooter } from "./PickerFooter";

let actions: ReturnType<typeof usePickerActions>;
function Capture() {
  actions = usePickerActions();
  return null;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`);

function setup(alreadyAddedIds: ReadonlySet<string> = new Set()) {
  const onCancel = vi.fn();
  const onAdd = vi.fn();
  render(
    <PickerProvider>
      <Capture />
      <PickerFooter alreadyAddedIds={alreadyAddedIds} onCancel={onCancel} onAdd={onAdd} />
    </PickerProvider>,
  );
  return { onCancel, onAdd };
}
const select = (list: string[]) => act(() => void actions.selectMany(list));
const count = () => screen.getByTestId("picker-selected-count");
const add = () => screen.getByTestId("picker-add-selected") as HTMLButtonElement;

describe("PickerFooter", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it("disables Add at zero and shows a polite live count", () => {
    setup();
    expect(add().disabled).toBe(true);
    expect(count().getAttribute("aria-live")).toBe("polite");
    expect(count().textContent).toBe("0 selected");
    expect(screen.queryByTestId("picker-clear-selection")).toBeNull();
  });

  it("shows the count and pluralised Add label, and adds the selected ids", () => {
    const { onAdd } = setup();
    select(["a"]);
    expect(add().textContent).toBe("Add 1 request");
    select(["b", "c"]);
    expect(count().textContent).toBe("3 selected");
    expect(add().textContent).toBe("Add 3 requests");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("excludes in-chain rows from the count and from the added ids", () => {
    const { onAdd } = setup(new Set(["b"]));
    select(["a", "b"]);
    expect(count().textContent).toBe("1 selected");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith(["a"]);
  });

  it("keeps Add disabled when only in-chain ids are selected", () => {
    setup(new Set(["b"]));
    select(["b"]);
    expect(add().disabled).toBe(true);
  });

  it("Clear empties the selection and Cancel calls back", () => {
    const { onCancel } = setup();
    select(["a", "b"]);
    fireEvent.click(screen.getByTestId("picker-clear-selection"));
    expect(count().textContent).toBe("0 selected");
    fireEvent.click(screen.getByTestId("picker-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe("selection cap boundary", () => {
    it("99 selected: no cap note", () => {
      setup();
      select(ids(PICKER_SELECTION_CAP - 1));
      expect(count().textContent).toBe("99 selected");
      expect(screen.queryByTestId("picker-cap-note")).toBeNull();
    });

    it("100 selected: cap note appears", () => {
      setup();
      select(ids(PICKER_SELECTION_CAP));
      expect(count().textContent).toBe("100 selected");
      expect(screen.getByTestId("picker-cap-note").textContent).toBe("You can add up to 100 requests at a time");
    });

    it("101 requested: the extra is rejected, count stays 100", () => {
      setup();
      select(ids(PICKER_SELECTION_CAP + 1));
      expect(count().textContent).toBe("100 selected");
      expect(screen.getByTestId("picker-cap-note")).toBeTruthy();
    });
  });

  describe("first-use hint", () => {
    it("shows while nothing is selected and hides once something is selected", () => {
      setup();
      expect(screen.getByTestId("picker-hint").textContent).toContain("Press Space to select, Enter to add");
      select(["a"]);
      expect(screen.queryByTestId("picker-hint")).toBeNull();
    });

    it("dismissal is remembered for the session only", () => {
      setup();
      fireEvent.click(screen.getByTestId("picker-hint-dismiss"));
      expect(screen.queryByTestId("picker-hint")).toBeNull();
      expect(sessionStorage.getItem("rq_chain_picker_hint_dismissed")).toBe("1");
      cleanup();

      setup();
      expect(screen.queryByTestId("picker-hint")).toBeNull();
    });
  });

  it("stacks on mobile and rows on wider screens", () => {
    setup();
    const cls = screen.getByTestId("picker-footer").className;
    expect(cls).toContain("flex-col");
    expect(cls).toContain("sm:flex-row");
    expect(cls).toContain("sticky");
  });
});
