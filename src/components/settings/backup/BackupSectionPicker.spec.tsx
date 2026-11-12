/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackupSection } from "@/lib/backup/constants";
import type { SectionCounts } from "@/lib/backup/sizeEstimate";
import { BackupSectionPicker } from "./BackupSectionPicker";
import type { BackupItems, SelectedIds } from "./useBackupExport";

const ITEMS: BackupItems = {
  collections: [
    { id: "c1", name: "Payments" },
    { id: "c2", name: "Search" },
  ],
  environments: [],
  chains: [{ id: "ch1", name: "Checkout" }],
};

function renderPicker(
  overrides: Partial<{
    sections: ReadonlySet<BackupSection>;
    counts: SectionCounts;
    items: BackupItems;
    selected: SelectedIds;
  }> = {},
) {
  const onToggleSection = vi.fn();
  const onToggleItem = vi.fn();
  render(
    <BackupSectionPicker
      sections={new Set<BackupSection>(["collections", "relayThreads"])}
      counts={{ collections: 2, relayThreads: 4 }}
      items={ITEMS}
      selected={{
        collections: new Set(["c1"]),
        environments: new Set(),
        chains: new Set(),
      }}
      onToggleSection={onToggleSection}
      onToggleItem={onToggleItem}
      {...overrides}
    />,
  );
  return { onToggleSection, onToggleItem };
}

afterEach(cleanup);

describe("BackupSectionPicker", () => {
  it("shows counts only for ticked sections that have a count", () => {
    renderPicker();

    expect(screen.getByTestId("backup-count-collections")).toHaveTextContent(
      "2 items",
    );
    expect(screen.getByTestId("backup-count-relayThreads")).toHaveTextContent(
      "4 items",
    );
    expect(screen.queryByTestId("backup-count-environments")).toBeNull();
  });

  it("reflects which sections are ticked", () => {
    renderPicker();

    expect(screen.getByTestId("backup-section-collections")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("backup-section-environments")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports section toggles", () => {
    const { onToggleSection } = renderPicker();

    fireEvent.click(screen.getByTestId("backup-section-environments"));

    expect(onToggleSection).toHaveBeenCalledWith("environments");
  });

  it("shows the Relay conversations note under the Relay threads section", () => {
    renderPicker();
    expect(
      screen.getByText("Conversations may contain values you shared with Relay."),
    ).toBeInTheDocument();
  });

  it("lists items only for ticked item sections that have items", () => {
    renderPicker();

    expect(screen.getByTestId("backup-items-collections")).toBeInTheDocument();
    expect(screen.getByTestId("backup-item-collections-c1")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("backup-item-collections-c2")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByTestId("backup-items-chains")).toBeNull();
  });

  it("renders no list for a ticked section without items", () => {
    renderPicker({
      sections: new Set<BackupSection>(["environments"]),
      counts: { environments: 0 },
    });
    expect(screen.queryByTestId("backup-items-environments")).toBeNull();
    expect(screen.queryByText("Nothing matches your search.")).toBeNull();
  });

  it("reports item toggles with the kind and id", () => {
    const { onToggleItem } = renderPicker();

    fireEvent.click(screen.getByTestId("backup-item-collections-c2"));

    expect(onToggleItem).toHaveBeenCalledWith("collections", "c2");
  });

  it("filters items by a case-insensitive search", () => {
    renderPicker();

    fireEvent.change(screen.getByTestId("backup-item-search"), {
      target: { value: " PAY " },
    });

    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.queryByText("Search")).toBeNull();
  });

  it("says nothing matches when the search finds no items", () => {
    renderPicker();

    fireEvent.change(screen.getByTestId("backup-item-search"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("Nothing matches your search.")).toBeInTheDocument();
    expect(screen.queryByTestId("backup-items-collections")).toBeNull();
  });

  it("labels the search box", () => {
    renderPicker();
    expect(
      screen.getByRole("textbox", { name: "Search by name" }),
    ).toBeInTheDocument();
  });
});
