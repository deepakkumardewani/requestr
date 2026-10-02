import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/types";
import { PICKER_RECENT_MAX, selectRecentRequestIds } from "./pickerRecents";

const entry = (
  id: string,
  timestamp: number,
  requestId: string | null,
): HistoryEntry =>
  ({ id, timestamp, request: { requestId } }) as unknown as HistoryEntry;
const reqs = (...ids: string[]) => ids.map((id) => ({ id }));

describe("selectRecentRequestIds", () => {
  it("returns newest first", () => {
    const history = [entry("h1", 1, "a"), entry("h2", 3, "b"), entry("h3", 2, "c")];
    expect(selectRecentRequestIds(history, reqs("a", "b", "c"))).toEqual(["b", "c", "a"]);
  });

  it("dedupes repeated runs of the same request", () => {
    const history = [entry("h1", 1, "a"), entry("h2", 2, "a"), entry("h3", 3, "b")];
    expect(selectRecentRequestIds(history, reqs("a", "b"))).toEqual(["b", "a"]);
  });

  it("caps at 5 by default and honours a custom max", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const history = ids.map((id, i) => entry(`h${i}`, i, id));
    expect(PICKER_RECENT_MAX).toBe(5);
    expect(selectRecentRequestIds(history, reqs(...ids))).toHaveLength(5);
    expect(selectRecentRequestIds(history, reqs(...ids), 2)).toEqual(["g", "f"]);
  });

  it("only returns ids that still exist and skips unlinked entries", () => {
    const history = [entry("h1", 3, "gone"), entry("h2", 2, null), entry("h3", 1, "a")];
    expect(selectRecentRequestIds(history, reqs("a"))).toEqual(["a"]);
  });

  it("is empty for no history, no requests, or max <= 0", () => {
    expect(selectRecentRequestIds([], reqs("a"))).toEqual([]);
    expect(selectRecentRequestIds([entry("h", 1, "a")], [])).toEqual([]);
    expect(selectRecentRequestIds([entry("h", 1, "a")], reqs("a"), 0)).toEqual([]);
  });

  it("does not mutate the history array", () => {
    const history = [entry("h1", 1, "a"), entry("h2", 2, "b")];
    selectRecentRequestIds(history, reqs("a", "b"));
    expect(history[0].id).toBe("h1");
  });
});
