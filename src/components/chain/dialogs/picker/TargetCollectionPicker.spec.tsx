/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectionFolderModel, CollectionModel } from "@/types";
import en from "../../../../../messages/en/chain.json";
import {
  buildFolderRows,
  buildTargetPath,
  TargetCollectionPicker,
  type TargetSelection,
} from "./TargetCollectionPicker";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (en as Record<string, string>)[key] ?? key,
}));

afterEach(cleanup);

const col = (id: string, name: string): CollectionModel => ({ id, name, createdAt: 1, updatedAt: 1 });
const folder = (
  id: string,
  name: string,
  parentFolderId: string | null = null,
  collectionId = "c1",
): CollectionFolderModel => ({ id, collectionId, name, parentFolderId, order: 0 });

const COLLECTIONS = [col("c1", "Main"), col("c2", "Other")];
const FOLDERS = [folder("f1", "Users"), folder("f2", "Admin", "f1"), folder("f3", "Misc", null, "c2")];

function Harness({
  collections = COLLECTIONS,
  folders = FOLDERS,
  initial = { collectionId: "c1", folderId: null },
  onChange,
}: {
  collections?: CollectionModel[];
  folders?: CollectionFolderModel[];
  initial?: TargetSelection;
  onChange?: (v: TargetSelection) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TargetCollectionPicker
      collections={collections}
      folders={folders}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("buildTargetPath / buildFolderRows", () => {
  it("joins collection and folder ancestry", () => {
    expect(buildTargetPath("Main", FOLDERS, "f2")).toBe("Main / Users / Admin");
    expect(buildTargetPath("Main", FOLDERS, null)).toBe("Main");
  });

  it("survives parent cycles", () => {
    const cyclic = [folder("a", "A", "b"), folder("b", "B", "a")];
    expect(buildTargetPath("M", cyclic, "a")).toBe("M / B / A");
    expect(buildFolderRows(cyclic, new Set(["a", "b"])).map((r) => r.folder.id).sort()).toEqual(["a", "b"]);
  });

  it("only descends into expanded folders and promotes missing parents", () => {
    const list = [folder("a", "A"), folder("b", "B", "a"), folder("c", "C", "ghost")];
    expect(buildFolderRows(list, new Set()).map((r) => r.folder.id)).toEqual(["a", "c"]);
    expect(buildFolderRows(list, new Set(["a"])).map((r) => [r.folder.id, r.depth])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });
});

describe("TargetCollectionPicker", () => {
  it("shows the no-collections state", () => {
    render(<Harness collections={[]} folders={[]} initial={{ collectionId: null, folderId: null }} />);
    expect(screen.getByTestId("picker-target-empty").textContent).toBe(en.apiPickerNoCollections);
    expect(screen.queryByTestId("picker-target-collection")).toBeNull();
  });

  it("shows the full path in the trigger with a title", () => {
    render(<Harness initial={{ collectionId: "c1", folderId: "f2" }} />);
    const trigger = screen.getByTestId("picker-target-path");
    expect(trigger.textContent).toBe("Main / Users / Admin");
    expect(trigger.getAttribute("title")).toBe("Main / Users / Admin");
    expect(trigger.className).toContain("truncate".slice(0, 0));
    expect(trigger.querySelector("span")?.className).toContain("truncate");
  });

  it("selects a folder from the keyboard-operable tree and closes it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByTestId("picker-target-path");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Users" }));
    fireEvent.click(screen.getByTestId("picker-target-folder-f2"));
    expect(onChange).toHaveBeenLastCalledWith({ collectionId: "c1", folderId: "f2" });
    expect(screen.getByTestId("picker-target-path").textContent).toBe("Main / Users / Admin");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects the collection root", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ collectionId: "c1", folderId: "f1" }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("picker-target-path"));
    fireEvent.click(screen.getByRole("option", { name: en.apiPickerCollectionRoot }));
    expect(onChange).toHaveBeenLastCalledWith({ collectionId: "c1", folderId: null });
  });

  it("resets the folder when the collection changes", async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ collectionId: "c1", folderId: "f1" }} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("picker-target-collection"));
    await user.click(await screen.findByRole("option", { name: "Other" }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ collectionId: "c2", folderId: null }),
    );
  });

  it("can pick 'this chain only'", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("picker-target-collection"));
    await user.click(await screen.findByRole("option", { name: en.apiPickerThisChain }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ collectionId: null, folderId: null }),
    );
  });

  it("falls back to the root when the selected folder was deleted", async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ collectionId: "c1", folderId: "deleted" }} onChange={onChange} />);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ collectionId: "c1", folderId: null }),
    );
    expect(screen.getByTestId("picker-target-path").textContent).toBe("Main");
  });

  it("hides the folder search up to 8 folders and shows it above", () => {
    const eight = Array.from({ length: 8 }, (_, i) => folder(`x${i}`, `Folder ${i}`));
    const { unmount } = render(<Harness folders={eight} />);
    fireEvent.click(screen.getByTestId("picker-target-path"));
    expect(screen.queryByTestId("picker-target-folder-search")).toBeNull();
    unmount();

    const nine = [...eight, folder("x8", "Needle")];
    render(<Harness folders={nine} />);
    fireEvent.click(screen.getByTestId("picker-target-path"));
    fireEvent.change(screen.getByTestId("picker-target-folder-search"), { target: { value: "needle" } });
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([en.apiPickerCollectionRoot, "Needle"]);
  });

  it("omits the folder control when the collection has no folders", () => {
    render(<Harness initial={{ collectionId: "c2", folderId: null }} folders={[]} />);
    expect(screen.queryByTestId("picker-target-path")).toBeNull();
  });
});
