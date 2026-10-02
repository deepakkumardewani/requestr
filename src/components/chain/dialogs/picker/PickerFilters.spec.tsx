/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PickerProvider, usePickerMethodFilters } from "./PickerContext";
import { countMethodChips, PickerFilters, toMethodChip, type MethodChipCounts } from "./PickerFilters";

const COUNTS: MethodChipCounts = { GET: 5, POST: 2, PUT: 0, PATCH: 1, DELETE: 0, OTHER: 3 };

function Active() {
  return <output data-testid="active">{[...usePickerMethodFilters()].sort().join(",")}</output>;
}

function renderFilters(overrides: Partial<React.ComponentProps<typeof PickerFilters>> = {}) {
  const onToggleExpandAll = vi.fn();
  const view = render(
    <PickerProvider>
      <PickerFilters counts={COUNTS} canExpand allExpanded={false} onToggleExpandAll={onToggleExpandAll} {...overrides} />
      <Active />
    </PickerProvider>,
  );
  return { ...view, onToggleExpandAll };
}

const chip = (m: string) => screen.getByTestId(`picker-method-${m}`) as HTMLButtonElement;
const active = () => screen.getByTestId("active").textContent;

describe("countMethodChips / toMethodChip", () => {
  it("buckets HEAD and OPTIONS into OTHER and counts per method", () => {
    expect(toMethodChip("HEAD")).toBe("OTHER");
    expect(toMethodChip("OPTIONS")).toBe("OTHER");
    expect(toMethodChip("PATCH")).toBe("PATCH");
    expect(countMethodChips(["GET", "GET", "HEAD", "OPTIONS", "DELETE"])).toEqual({
      GET: 2, POST: 0, PUT: 0, PATCH: 0, DELETE: 1, OTHER: 2,
    });
    expect(countMethodChips([])).toEqual({ GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0, OTHER: 0 });
  });
});

describe("PickerFilters", () => {
  afterEach(cleanup);

  it("renders every chip with its count, even at zero", () => {
    renderFilters();
    expect(chip("GET").textContent).toBe("GET5");
    expect(chip("PUT").textContent).toBe("PUT0");
    expect(chip("OTHER").textContent).toBe("OTHER3");
  });

  it("disables zero-match chips and enables others", () => {
    renderFilters();
    expect(chip("PUT").disabled).toBe(true);
    expect(chip("DELETE").disabled).toBe(true);
    expect(chip("GET").disabled).toBe(false);
  });

  it("multi-toggles chips and reflects aria-pressed", () => {
    renderFilters();
    expect(chip("GET").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("GET"));
    fireEvent.click(chip("POST"));
    expect(active()).toBe("GET,POST");
    expect(chip("GET").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip("GET"));
    expect(active()).toBe("POST");
  });

  it("keeps an active chip toggleable when its count drops to zero", () => {
    const { rerender, onToggleExpandAll } = renderFilters();
    fireEvent.click(chip("POST"));
    rerender(
      <PickerProvider>
        <PickerFilters counts={{ ...COUNTS, POST: 0 }} canExpand allExpanded={false} onToggleExpandAll={onToggleExpandAll} />
        <Active />
      </PickerProvider>,
    );
    // Provider identity is preserved by rerender, so the filter is still active.
    expect(chip("POST").disabled).toBe(false);
  });

  it("shows Clear filters only while a filter is active and clears them", () => {
    renderFilters();
    expect(screen.queryByTestId("picker-filter-clear")).toBeNull();
    fireEvent.click(chip("GET"));
    fireEvent.click(screen.getByTestId("picker-filter-clear"));
    expect(active()).toBe("");
    expect(screen.queryByTestId("picker-filter-clear")).toBeNull();
  });

  it("flips the expand toggle label with icon + text and calls back", () => {
    const { rerender, onToggleExpandAll } = renderFilters();
    const toggle = () => screen.getByTestId("picker-expand-toggle");
    expect(toggle().textContent).toBe("Expand all");
    expect(toggle().querySelector("svg")).not.toBeNull();
    fireEvent.click(toggle());
    expect(onToggleExpandAll).toHaveBeenCalledTimes(1);

    rerender(
      <PickerProvider>
        <PickerFilters counts={COUNTS} canExpand allExpanded onToggleExpandAll={onToggleExpandAll} />
      </PickerProvider>,
    );
    expect(toggle().textContent).toBe("Collapse all");
  });

  it("disables the expand toggle when nothing can expand", () => {
    renderFilters({ canExpand: false });
    expect((screen.getByTestId("picker-expand-toggle") as HTMLButtonElement).disabled).toBe(true);
  });
});
