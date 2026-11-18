import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurlToRequestError } from "@/lib/curlToRequest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { CollectionFolderModel, CollectionModel } from "@/types";
import type { Chain } from "@/types/chain";
import {
  createRequestInChain,
  resetRememberedTarget,
  resolveDefaultTarget,
} from "./useCreateRequest";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const CHAIN_ID = "chain-1";
const COL_A: CollectionModel = { id: "col-a", name: "A", createdAt: 1, updatedAt: 1 };
const COL_B: CollectionModel = { id: "col-b", name: "B", createdAt: 1, updatedAt: 1 };
const FOLDER: CollectionFolderModel = {
  id: "f1",
  collectionId: "col-a",
  name: "Users",
  parentFolderId: null,
  order: 0,
};
const ROOT: Chain["scope"] = "standalone";

function makeChain(overrides: Partial<Chain> = {}): Chain {
  return {
    id: CHAIN_ID,
    scope: ROOT,
    schemaVersion: 5,
    name: "c",
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
    ...overrides,
  } as Chain;
}

function seed(collections: CollectionModel[], folders: CollectionFolderModel[] = []) {
  useCollectionsStore.setState({ collections, folders, requests: [] });
  useChainStore.setState({ chains: { [CHAIN_ID]: makeChain() } });
}

const chain = () => useChainStore.getState().chains[CHAIN_ID];
const requests = () => useCollectionsStore.getState().requests;
const CURL = "curl -X POST https://api.test/orders -H 'X-A: 1'";

describe("createRequestInChain", () => {
  beforeEach(() => {
    resetRememberedTarget();
    seed([COL_A, COL_B], [FOLDER]);
  });

  it("creates a real request, node, and notifies the caller for a valid cURL", () => {
    const onNodeAdded = vi.fn();
    const id = createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: "col-a", folderId: "f1" } },
      { chainId: CHAIN_ID, onNodeAdded },
    );
    expect(requests()).toHaveLength(1);
    expect(requests()[0]).toMatchObject({
      id,
      collectionId: "col-a",
      folderId: "f1",
      method: "POST",
      url: "https://api.test/orders",
      name: "POST /orders",
    });
    expect(chain().nodeIds).toEqual([id]);
    expect(onNodeAdded).toHaveBeenCalledWith(id);
  });

  it("throws a typed error and creates nothing for invalid cURL", () => {
    const onNodeAdded = vi.fn();
    expect(() =>
      createRequestInChain(
        { source: "curl", text: "curl -X POST", target: { collectionId: "col-a", folderId: null } },
        { chainId: CHAIN_ID, onNodeAdded },
      ),
    ).toThrow(CurlToRequestError);
    expect(requests()).toHaveLength(0);
    expect(chain().nodeIds).toHaveLength(0);
    expect(chain().blocks).toHaveLength(0);
    expect(onNodeAdded).not.toHaveBeenCalled();
  });

  it("uses an explicit name over the derived one", () => {
    createRequestInChain(
      { source: "curl", text: CURL, name: "  Make order ", target: { collectionId: "col-a", folderId: null } },
      { chainId: CHAIN_ID },
    );
    expect(requests()[0].name).toBe("Make order");
  });

  it("creates blank requests from the entered fields", () => {
    createRequestInChain(
      {
        source: "blank",
        name: "",
        method: "PUT",
        url: " https://x.test/a ",
        target: { collectionId: "col-b", folderId: null },
      },
      { chainId: CHAIN_ID },
    );
    expect(requests()[0]).toMatchObject({ method: "PUT", url: "https://x.test/a", name: "https://x.test/a" });
  });

  it("adds an ad hoc history-type node when there are zero collections", () => {
    seed([]);
    const id = createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: null, folderId: null } },
      { chainId: CHAIN_ID },
    );
    expect(requests()).toHaveLength(0);
    expect(chain().blocks).toEqual([
      expect.objectContaining({ id, type: "history", method: "POST", url: "https://api.test/orders" }),
    ]);
  });

  it("falls back to the collection root when the folder was deleted", () => {
    createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: "col-a", folderId: "gone" } },
      { chainId: CHAIN_ID },
    );
    expect(requests()[0].folderId).toBeNull();
  });

  it("treats a folder from another collection as deleted", () => {
    createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: "col-b", folderId: "f1" } },
      { chainId: CHAIN_ID },
    );
    expect(requests()[0].folderId).toBeNull();
  });

  it("creates two distinct requests for the same URL", () => {
    const input = { source: "curl", text: CURL, target: { collectionId: "col-a", folderId: null } } as const;
    const a = createRequestInChain(input, { chainId: CHAIN_ID });
    const b = createRequestInChain(input, { chainId: CHAIN_ID });
    expect(a).not.toBe(b);
    expect(requests()).toHaveLength(2);
    expect(chain().nodeIds).toEqual([a, b]);
  });

  it("applies the placement option to the new node", () => {
    const id = createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: "col-a", folderId: null } },
      { chainId: CHAIN_ID, placement: { position: { x: 40, y: 60 } } },
    );
    expect(chain().nodePositions[id]).toEqual({ x: 40, y: 60 });
  });
});

describe("resolveDefaultTarget", () => {
  beforeEach(resetRememberedTarget);

  it("defaults a standalone chain to the first collection", () => {
    expect(resolveDefaultTarget({ scope: "standalone" }, [COL_A, COL_B])).toEqual({
      collectionId: "col-a",
      folderId: null,
    });
  });

  it("defaults a collection chain to its own collection", () => {
    expect(
      resolveDefaultTarget({ scope: "collection", collectionId: "col-b" }, [COL_A, COL_B]),
    ).toEqual({ collectionId: "col-b", folderId: null });
  });

  it("falls back to first collection when the chain's collection is gone", () => {
    expect(
      resolveDefaultTarget({ scope: "collection", collectionId: "missing" }, [COL_A]).collectionId,
    ).toBe("col-a");
  });

  it("is chain-only with zero collections", () => {
    expect(resolveDefaultTarget({ scope: "standalone" }, [])).toEqual({
      collectionId: null,
      folderId: null,
    });
  });

  it("remembers the last target for the session while it still exists", () => {
    seed([COL_A, COL_B], [FOLDER]);
    createRequestInChain(
      { source: "curl", text: CURL, target: { collectionId: "col-b", folderId: null } },
      { chainId: CHAIN_ID },
    );
    expect(resolveDefaultTarget({ scope: "standalone" }, [COL_A, COL_B]).collectionId).toBe("col-b");
    expect(resolveDefaultTarget({ scope: "standalone" }, [COL_A]).collectionId).toBe("col-a");
  });
});
