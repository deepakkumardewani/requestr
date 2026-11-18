/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUIStore } from "@/stores/useUIStore";
import { PickerProvider, usePickerDraft, usePickerQuery } from "./PickerContext";
import { PickerNoResults, PickerSearchBar } from "./PickerSearchBar";

function Probe() {
  const query = usePickerQuery();
  const draft = usePickerDraft();
  return (
    <output data-testid="probe">
      {JSON.stringify({ query, mode: draft.mode, url: draft.url, curlText: draft.curlText })}
    </output>
  );
}

const probe = () => JSON.parse(screen.getByTestId("probe").textContent ?? "{}");

function renderBar(resultCount = 3) {
  return render(
    <PickerProvider>
      <PickerSearchBar resultCount={resultCount} />
      <PickerNoResults />
      <Probe />
    </PickerProvider>,
  );
}

const input = () => screen.getByTestId("picker-search") as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });

describe("PickerSearchBar", () => {
  beforeEach(() => useUIStore.setState({ pickerTab: "collections" }));
  afterEach(cleanup);

  it("autofocuses the input and writes typing to the query", () => {
    renderBar();
    expect(document.activeElement).toBe(input());
    type("users");
    expect(probe().query).toBe("users");
  });

  it("focuses the input on / when not typing, and ignores / inside a field", () => {
    renderBar();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    expect(fireEvent.keyDown(outside, { key: "/" })).toBe(false);
    expect(document.activeElement).toBe(input());

    const other = document.createElement("textarea");
    document.body.appendChild(other);
    other.focus();
    expect(fireEvent.keyDown(other, { key: "/" })).toBe(true);
    expect(document.activeElement).toBe(other);
    outside.remove();
    other.remove();
  });

  it("announces the result count only while searching", () => {
    renderBar(1);
    const live = screen.getByTestId("picker-result-announcement");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    type("a");
    expect(live.textContent).toBe("1 result");
  });

  it("suggests creating a request from a cURL command and prefills the New request tab", () => {
    renderBar();
    type("  curl https://api.test/x -X POST");
    fireEvent.click(screen.getByTestId("picker-suggestion"));

    expect(useUIStore.getState().pickerTab).toBe("new");
    expect(probe()).toMatchObject({
      query: "",
      mode: "curl",
      curlText: "  curl https://api.test/x -X POST",
    });
  });

  it("suggests a URL and prefills the URL field", () => {
    renderBar();
    type("https://api.test/orders");
    expect(screen.getByTestId("picker-suggestion").textContent).toContain("https://api.test/orders");
    fireEvent.click(screen.getByTestId("picker-suggestion"));

    expect(useUIStore.getState().pickerTab).toBe("new");
    expect(probe()).toMatchObject({ mode: "blank", url: "https://api.test/orders" });
  });

  it("shows no suggestion for plain text", () => {
    renderBar();
    type("users");
    expect(screen.queryByTestId("picker-suggestion")).toBeNull();
  });

  it("shows the no-results message with the query and clears via the button", () => {
    renderBar(0);
    type("zzz");
    expect(screen.getByTestId("picker-no-results").textContent).toContain('No requests match "zzz"');
    fireEvent.click(screen.getByTestId("picker-clear-search"));
    expect(probe().query).toBe("");
  });

  describe("Esc order inside a dialog", () => {
    function Harness({ onClose }: { onClose: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) onClose();
            setOpen(next);
          }}
        >
          <DialogContent>
            <DialogTitle>t</DialogTitle>
            <PickerProvider>
              <PickerSearchBar resultCount={0} />
              <Probe />
            </PickerProvider>
          </DialogContent>
        </Dialog>
      );
    }

    it("clears a non-empty search first and closes only on the next Esc", async () => {
      const onClose = vi.fn();
      render(<Harness onClose={onClose} />);
      type("abc");

      fireEvent.keyDown(input(), { key: "Escape" });
      expect(probe().query).toBe("");
      expect(onClose).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.keyDown(input(), { key: "Escape" });
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
