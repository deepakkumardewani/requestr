import { describe, expect, it } from "vitest";
import { getChainDisplayName } from "./chainDisplayName";

const collections = [{ id: "col-1", name: "Renamed" }];

describe("getChainDisplayName", () => {
  it("derives a collection chain's name from the collection", () => {
    const chain = { id: "col-1", scope: "collection", name: "Stale" } as const;
    expect(getChainDisplayName(chain, collections)).toBe("Renamed");
  });

  it("falls back to the stored name when the collection is missing", () => {
    const chain = { id: "gone", scope: "collection", name: "Stored" } as const;
    expect(getChainDisplayName(chain, collections)).toBe("Stored");
  });

  it("uses the stored name for standalone chains", () => {
    const chain = { id: "col-1", scope: "standalone", name: "Mine" } as const;
    expect(getChainDisplayName(chain, collections)).toBe("Mine");
  });
});
