/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/relay.json";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, string | number>) => {
      const path = [...namespace.split(".").slice(1), ...key.split(".")];
      const template = path.reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en,
      ) as string;
      return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        String(values?.[name] ?? ""),
      );
    },
}));

import type { CloseTabsPreview } from "@/lib/relay/tools/tabs";
import { CloseTabsConfirmCard } from "./CloseTabsConfirmCard";

afterEach(cleanup);

const preview: CloseTabsPreview = {
  dirty: [
    { tabId: "t1", name: "Get orders", hasDestination: true },
    { tabId: "t2", name: "Scratch", hasDestination: false },
  ],
  pinnedKept: 0,
};

function renderCard(value: CloseTabsPreview = preview) {
  const onChoose = vi.fn();
  const onCancel = vi.fn();
  render(
    <CloseTabsConfirmCard preview={value} onChoose={onChoose} onCancel={onCancel} />,
  );
  return { onChoose, onCancel };
}

describe("CloseTabsConfirmCard", () => {
  it("lists each dirty tab, the count in the title and the lost-work warning", () => {
    renderCard();
    const card = screen.getByRole("group", {
      name: "Confirmation: close tabs with unsaved changes",
    });
    expect(card).toBeTruthy();
    expect(screen.getByText("Close 2 tabs with unsaved changes?")).toBeTruthy();
    const items = within(screen.getByTestId("relay-close-tabs-list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("Get orders");
    expect(screen.getByRole("alert").textContent).toBe("Discarding loses your unsaved work.");
  });

  it("uses the delete title when the tabs close because their requests are deleted", () => {
    renderCard({ ...preview, deleting: true });
    expect(
      screen.getByText("Deleting will close 2 tabs with unsaved changes. What should happen to them?"),
    ).toBeTruthy();
    expect(screen.queryByText("Close 2 tabs with unsaved changes?")).toBeNull();
  });

  it("marks tabs without a destination and explains they stay open", () => {
    renderCard();
    const items = screen.getAllByRole("listitem");
    expect(items[1].textContent).toContain("Scratch");
    expect(items[1].textContent).toContain("needs a destination");
    expect(items[0].textContent).not.toContain("needs a destination");
    expect(
      screen.getByText("Tabs that need a destination stay open until you save them."),
    ).toBeTruthy();
  });

  it("omits the destination hint when every tab can be saved", () => {
    renderCard({ dirty: [preview.dirty[0]], pinnedKept: 0 });
    expect(screen.queryByText(/stay open until you save/)).toBeNull();
  });

  it("reports pinned tabs kept open only when there are some", () => {
    renderCard({ ...preview, pinnedKept: 3 });
    expect(screen.getByTestId("relay-close-tabs-pinned").textContent).toBe(
      "3 pinned tabs kept open",
    );
    cleanup();
    renderCard();
    expect(screen.queryByTestId("relay-close-tabs-pinned")).toBeNull();
  });

  it("offers Save all & close, Discard & close and Cancel", () => {
    renderCard();
    expect(screen.getByTestId("relay-close-tabs-save-all").textContent).toBe("Save all & close");
    expect(screen.getByTestId("relay-close-tabs-discard").textContent).toBe("Discard & close");
    expect(screen.getByTestId("relay-close-tabs-cancel").textContent).toBe("Cancel");
  });

  it("focuses Cancel by default so a stray Enter never discards work", () => {
    renderCard();
    expect(document.activeElement).toBe(screen.getByTestId("relay-close-tabs-cancel"));
  });

  it("Save all reports the decision once and locks every button", () => {
    const { onChoose, onCancel } = renderCard();
    fireEvent.click(screen.getByTestId("relay-close-tabs-save-all"));
    fireEvent.click(screen.getByTestId("relay-close-tabs-save-all"));
    fireEvent.click(screen.getByTestId("relay-close-tabs-discard"));
    fireEvent.click(screen.getByTestId("relay-close-tabs-cancel"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith("save-all");
    expect(onCancel).not.toHaveBeenCalled();
    for (const id of ["save-all", "discard", "cancel"]) {
      expect((screen.getByTestId(`relay-close-tabs-${id}`) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByTestId("relay-close-tabs-save-all").textContent).toBe("Working");
    expect(screen.getByTestId("relay-close-tabs-discard").textContent).toBe("Discard & close");
  });

  it("Discard reports the decision and shows Working on its own button", () => {
    const { onChoose } = renderCard();
    fireEvent.click(screen.getByTestId("relay-close-tabs-discard"));
    expect(onChoose).toHaveBeenCalledWith("discard");
    expect(screen.getByTestId("relay-close-tabs-discard").textContent).toBe("Working");
    expect(screen.getByTestId("relay-close-tabs-save-all").textContent).toBe("Save all & close");
  });

  it("Cancel declines without choosing", () => {
    const { onChoose, onCancel } = renderCard();
    fireEvent.click(screen.getByTestId("relay-close-tabs-cancel"));
    fireEvent.click(screen.getByTestId("relay-close-tabs-discard"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("announces the need for confirmation, then goes quiet once answered", () => {
    renderCard();
    const live = screen.getByRole("status");
    expect(live.textContent).toBe("Confirmation needed");
    expect(live.className).toContain("sr-only");
    fireEvent.click(screen.getByTestId("relay-close-tabs-cancel"));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps every action at the coarse-pointer touch minimum", () => {
    renderCard();
    for (const id of ["save-all", "discard", "cancel"]) {
      expect(screen.getByTestId(`relay-close-tabs-${id}`).className).toContain(
        "pointer-coarse:min-h-11",
      );
    }
  });
});
