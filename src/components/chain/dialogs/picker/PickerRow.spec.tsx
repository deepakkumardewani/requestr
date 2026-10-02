/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import type { PickerHeaderRow, PickerItemRow } from "@/lib/pickerTree";
import type { RequestModel } from "@/types";
import { PickerProvider, usePickerActions, usePickerExpanded, usePickerSelectedIds } from "./PickerContext";
import { getPickerRowDomId, PickerRow } from "./PickerRow";

const badgeRenders = vi.fn();
vi.mock("@/components/common/MethodBadge", () => ({
  MethodBadge: ({ method }: { method: string }) => {
    badgeRenders(method);
    return <span data-testid="badge">{method}</span>;
  },
}));

const request = (id: string, over: Partial<RequestModel> = {}): RequestModel => ({
  id,
  collectionId: "c1",
  name: `Request ${id}`,
  method: "GET",
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const itemRow = (id: string, over: Partial<RequestModel> = {}, match: PickerItemRow["match"] = { score: 1, nameRanges: [], urlRanges: [] }): PickerItemRow => ({
  kind: "item",
  id,
  depth: 1,
  item: request(id, over),
  match,
});

const headerRow = (over: Partial<PickerHeaderRow> = {}): PickerHeaderRow => ({
  kind: "header",
  id: "collection:c1",
  headerType: "collection",
  label: "Main",
  depth: 0,
  expandable: true,
  expanded: false,
  count: { visible: 2, total: 5 },
  ...over,
});

function Selected() {
  return <output data-testid="selected">{[...usePickerSelectedIds()].join(",")}</output>;
}
function Select({ ids }: { ids: string[] }) {
  const { selectMany } = usePickerActions();
  return <button data-testid="seed" onClick={() => selectMany(ids)} />;
}
const selected = () => screen.getByTestId("selected").textContent;

function setup(ui: React.ReactNode, extra: React.ReactNode = null) {
  return render(
    <PickerProvider>
      {ui}
      <Selected />
      {extra}
    </PickerProvider>,
  );
}

describe("PickerRow", () => {
  beforeEach(() => badgeRenders.mockClear());
  afterEach(cleanup);

  it("clicking the row toggles selection (and the checkbox state)", () => {
    setup(<PickerRow row={itemRow("a")} />);
    const row = screen.getByTestId("picker-row-a");
    fireEvent.click(row);
    expect(selected()).toBe("a");
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(row.className).toContain("bg-primary/10");
    fireEvent.click(row);
    expect(selected()).toBe("");
  });

  it("renders a visual-only checkbox that mirrors the selection", () => {
    setup(<PickerRow row={itemRow("a")} />);
    const box = () => document.querySelector('[data-slot="checkbox"]') as HTMLElement;
    expect(box().getAttribute("aria-hidden")).toBe("true");
    expect(box().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByTestId("picker-row-a"));
    expect(box().getAttribute("aria-checked")).toBe("true");
  });

  it("exposes a stable DOM id for aria-activedescendant", () => {
    setup(<PickerRow row={itemRow("a")} />);
    expect(screen.getByTestId("picker-row-a").id).toBe(getPickerRowDomId("a"));
  });

  it("truncates a 400-char URL and exposes the full URL as a tooltip", () => {
    const url = `https://api.test/${"x".repeat(400)}`;
    setup(<PickerRow row={itemRow("a", { url })} />);
    const urlEl = screen.getByTitle(url);
    expect(urlEl.className).toContain("truncate");
    expect(urlEl.className).toContain("min-w-0");
    expect(screen.getByTestId("picker-row-a").className).toContain("min-w-0");
    expect(screen.getByTestId("picker-row-a").style.height).toBe("36px");
  });

  it("highlights matched ranges in name and URL", () => {
    setup(<PickerRow row={itemRow("a", {}, { score: 1, nameRanges: [[0, 3]], urlRanges: [[8, 11]] })} />);
    const marks = screen.getAllByText((_, el) => el?.tagName === "MARK");
    expect(marks.map((m) => m.textContent)).toEqual(["Req", "api"]);
  });

  it("marks the active row with a focus ring and aria-activedescendant-friendly id", () => {
    function Activate() {
      const { setActiveRowId } = usePickerActions();
      return <button data-testid="act" onClick={() => setActiveRowId("a")} />;
    }
    setup(<PickerRow row={itemRow("a")} />, <Activate />);
    expect(screen.getByTestId("picker-row-a").className).not.toContain("ring-2");
    fireEvent.click(screen.getByTestId("act"));
    expect(screen.getByTestId("picker-row-a").className).toContain("ring-2");
  });

  describe("in-chain rows", () => {
    it("are not selectable and announce on click", () => {
      setup(<PickerRow row={itemRow("a")} inChain />);
      const row = screen.getByTestId("picker-row-a");
      fireEvent.click(row);
      expect(selected()).toBe("");
      expect(row.getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByText("Already in this chain")).toBeTruthy();
      expect(screen.getByText("In chain")).toBeTruthy();
      expect((document.querySelector('[data-slot="checkbox"]') as HTMLElement).getAttribute("aria-disabled")).toBe("true");
    });

    it("Show on canvas calls back with the request id without selecting", () => {
      const onShowOnCanvas = vi.fn();
      setup(<PickerRow row={itemRow("a")} inChain onShowOnCanvas={onShowOnCanvas} />);
      fireEvent.click(screen.getByTestId("picker-show-on-canvas-a"));
      expect(onShowOnCanvas).toHaveBeenCalledWith("a");
      expect(selected()).toBe("");
      expect(screen.queryByText("Already in this chain")).toBeNull();
    });

    it("hides the in-chain affordances for ordinary rows", () => {
      setup(<PickerRow row={itemRow("a")} />);
      expect(screen.queryByText("In chain")).toBeNull();
    });
  });

  describe("selection cap", () => {
    const ids = Array.from({ length: PICKER_SELECTION_CAP }, (_, i) => `s${i}`);

    it("disables unselected rows with an explanatory tooltip once the cap is reached", () => {
      setup(<PickerRow row={itemRow("extra")} />, <Select ids={ids} />);
      fireEvent.click(screen.getByTestId("seed"));
      const row = screen.getByTestId("picker-row-extra");
      expect(row.getAttribute("aria-disabled")).toBe("true");
      expect(row.title).toContain(String(PICKER_SELECTION_CAP));
      fireEvent.click(row);
      expect(selected()).not.toContain("extra");
    });

    it("keeps already-selected rows deselectable at the cap", () => {
      setup(<PickerRow row={itemRow("s0")} />, <Select ids={ids} />);
      fireEvent.click(screen.getByTestId("seed"));
      const row = screen.getByTestId("picker-row-s0");
      expect(row.getAttribute("aria-disabled")).toBeNull();
      fireEvent.click(row);
      expect(selected().split(",")).not.toContain("s0");
    });
  });

  describe("header rows", () => {
    it("shows name, chevron, and {visible}/{total} badge", () => {
      setup(<PickerRow row={headerRow()} />);
      const header = screen.getByTestId("picker-header-collection:c1");
      expect(header.textContent).toContain("Main");
      expect(header.textContent).toContain("2/5");
      expect(header.getAttribute("aria-expanded")).toBe("false");
    });

    it("toggles expansion by bare entity id when clicked", () => {
      function Expanded() {
        return <output data-testid="expanded">{[...usePickerExpanded()].join(",")}</output>;
      }
      setup(<PickerRow row={headerRow()} />, <Expanded />);
      fireEvent.click(screen.getByTestId("picker-header-collection:c1"));
      expect(screen.getByTestId("expanded").textContent).toBe("c1");
      fireEvent.click(screen.getByTestId("picker-header-collection:c1"));
      expect(screen.getByTestId("expanded").textContent).toBe("");
    });

    it("non-expandable headers expose no aria-expanded and ignore clicks", () => {
      setup(<PickerRow row={headerRow({ expandable: false })} />);
      const header = screen.getByTestId("picker-header-collection:c1");
      expect(header.getAttribute("aria-expanded")).toBeNull();
      fireEvent.click(header);
    });

    it("non-expandable headers do not change expansion", () => {
      function Expanded() {
        return <output data-testid="expanded">{[...usePickerExpanded()].join(",")}</output>;
      }
      setup(<PickerRow row={headerRow({ expandable: false })} />, <Expanded />);
      fireEvent.click(screen.getByTestId("picker-header-collection:c1"));
      expect(screen.getByTestId("expanded").textContent).toBe("");
    });
  });

  it("does not re-render an untouched row when another row is selected", () => {
    function Other() {
      const { toggleSelected } = usePickerActions();
      return <button data-testid="other" onClick={() => toggleSelected("b")} />;
    }
    const a = itemRow("a");
    const b = itemRow("b");
    setup(
      <>
        <PickerRow row={a} />
        <PickerRow row={b} />
      </>,
      <Other />,
    );
    badgeRenders.mockClear();
    act(() => {
      fireEvent.click(screen.getByTestId("other"));
    });
    // Only row "b" re-rendered (its selected slice flipped); row "a" stayed memoized.
    expect(badgeRenders).toHaveBeenCalledTimes(1);
  });
});
