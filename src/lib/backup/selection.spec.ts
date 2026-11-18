import { describe, expect, it } from "vitest";
import type { BackupData } from "./schema";
import { applySelection, countDanglingReferences } from "./selection";

const fullData = (): BackupData => ({
  collections: [{ id: "c1" }, { id: "c2" }],
  folders: [
    { id: "f1", collectionId: "c1" },
    { id: "f2", collectionId: "c2" },
  ],
  requests: [
    { id: "r1", collectionId: "c1", folderId: "f1" },
    { id: "r2", collectionId: "c2" },
  ],
  chainConfigs: [
    { id: "cc1", collectionId: "c1" },
    { id: "cc2", collectionId: "c2" },
  ],
  environments: [{ id: "e1" }, { id: "e2" }],
  chains: [{ id: "h1" }, { id: "h2" }],
  settings: { theme: "dark" },
});

describe("applySelection", () => {
  it("keeps everything when the selection has no lists", () => {
    const data = fullData();
    expect(applySelection(data, {})).toEqual(data);
  });

  it("brings the folders, requests and chainConfigs of a selected collection", () => {
    const result = applySelection(fullData(), { collectionIds: ["c1"] });
    expect(result.collections).toEqual([{ id: "c1" }]);
    expect(result.folders).toEqual([{ id: "f1", collectionId: "c1" }]);
    expect(result.requests).toEqual([
      { id: "r1", collectionId: "c1", folderId: "f1" },
    ]);
    expect(result.chainConfigs).toEqual([{ id: "cc1", collectionId: "c1" }]);
  });

  it("leaves other sections untouched when only collections are narrowed", () => {
    const result = applySelection(fullData(), { collectionIds: [] });
    expect(result.collections).toEqual([]);
    expect(result.environments).toHaveLength(2);
    expect(result.chains).toHaveLength(2);
    expect(result.settings).toEqual({ theme: "dark" });
  });

  it("narrows environments and chains by id", () => {
    const result = applySelection(fullData(), {
      environmentIds: ["e2"],
      chainIds: ["h1"],
    });
    expect(result.environments).toEqual([{ id: "e2" }]);
    expect(result.chains).toEqual([{ id: "h1" }]);
    expect(result.collections).toHaveLength(2);
  });

  it("keeps absent sections absent rather than writing undefined keys", () => {
    const result = applySelection(
      { environments: [{ id: "e1" }] },
      { collectionIds: ["c1"], chainIds: ["h1"] }
    );
    expect(Object.keys(result)).toEqual(["environments"]);
  });

  it("drops non-record entries from narrowed lists", () => {
    const result = applySelection(
      { environments: [{ id: "e1" }, "junk", null, [1]] },
      { environmentIds: ["e1"] }
    );
    expect(result.environments).toEqual([{ id: "e1" }]);
  });

  it("does not mutate the input", () => {
    const data = fullData();
    applySelection(data, { collectionIds: ["c1"] });
    expect(data).toEqual(fullData());
  });

  it("keeps references to unselected items instead of rewriting them", () => {
    const data: BackupData = {
      collections: [{ id: "c1" }],
      requests: [{ id: "r1", collectionId: "c1", folderId: "gone" }],
    };
    const result = applySelection(data, { collectionIds: ["c1"] });
    expect(result.requests).toEqual([
      { id: "r1", collectionId: "c1", folderId: "gone" },
    ]);
  });
});

describe("countDanglingReferences", () => {
  it("is zero for a self-consistent set", () => {
    expect(countDanglingReferences(fullData())).toBe(0);
  });

  it("is zero for empty data", () => {
    expect(countDanglingReferences({})).toBe(0);
  });

  it("counts request references to a missing collection and folder", () => {
    expect(
      countDanglingReferences({
        requests: [{ id: "r", collectionId: "x", folderId: "y" }],
      })
    ).toBe(2);
  });

  it("counts folder references to a missing collection and parent folder", () => {
    expect(
      countDanglingReferences({
        folders: [{ id: "f", collectionId: "x", parentFolderId: "p" }],
      })
    ).toBe(2);
  });

  it("ignores absent or non-string reference fields", () => {
    expect(
      countDanglingReferences({
        requests: [{ id: "r", collectionId: 5 }, { id: "q" }],
      })
    ).toBe(0);
  });

  it("counts chain collection, node and sub-chain references", () => {
    const data: BackupData = {
      requests: [{ id: "r1" }],
      chains: [
        {
          id: "h1",
          collectionId: "gone",
          nodeIds: ["r1", "r-gone", 7],
          blocks: [
            { type: "subchain", chainId: "h-gone" },
            { type: "subchain", chainId: "h1" },
            { type: "request", chainId: "ignored" },
          ],
        },
      ],
    };
    expect(countDanglingReferences(data)).toBe(3);
  });

  it("tolerates chains without nodeIds or blocks", () => {
    expect(countDanglingReferences({ chains: [{ id: "h1" }] })).toBe(0);
  });

  it("counts chainConfig collection and node references", () => {
    expect(
      countDanglingReferences({
        chainConfigs: [{ collectionId: "x", nodeIds: ["a", "b"] }],
      })
    ).toBe(3);
  });

  it("counts chain runs of a missing chain", () => {
    expect(
      countDanglingReferences({
        chains: [{ id: "h1" }],
        chainRuns: [{ chainId: "h1" }, { chainId: "h2" }],
      })
    ).toBe(1);
  });

  it("counts pinned request ids that are missing", () => {
    expect(
      countDanglingReferences({
        requests: [{ id: "r1" }],
        settings: { pinnedRequestIds: ["r1", "r2"] },
      })
    ).toBe(1);
  });

  it("ignores pinned ids when settings is not a record or the field is not a list", () => {
    expect(
      countDanglingReferences({
        settings: { pinnedRequestIds: "r1" },
      })
    ).toBe(0);
    expect(
      countDanglingReferences({
        settings: [] as unknown as Record<string, unknown>,
      })
    ).toBe(0);
  });

  it("reflects a selection that excludes referenced items", () => {
    const narrowed = applySelection(fullData(), { collectionIds: ["c1"] });
    // r1 -> f1 and c1 are kept; nothing selected is orphaned
    expect(countDanglingReferences(narrowed)).toBe(0);
    const withoutFolders: BackupData = { ...narrowed, folders: [] };
    expect(countDanglingReferences(withoutFolders)).toBe(1);
  });
});
