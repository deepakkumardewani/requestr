import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { historyEntry } from "../relay/testing/historyFixtures";
import { clearHistory } from "./clearHistory";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  useHistoryStore.setState({ entries: [] });
});

describe("clearHistory", () => {
  it("empties the store and returns how many entries were removed", () => {
    useHistoryStore.setState({ entries: [historyEntry({ id: "a" }), historyEntry({ id: "b" })] });
    expect(clearHistory()).toEqual({ count: 2 });
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it("returns zero for an already empty history", () => {
    expect(clearHistory()).toEqual({ count: 0 });
  });
});
