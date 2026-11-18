import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/types";
import {
  COMPACT_GROUP_LIMIT,
  groupHistoryByDay,
  limitGroups,
  matchesHistoryFilter,
  toVisibleRows,
  type HistoryRow,
} from "./groupHistory";

// Local-time constructors keep the suite independent of the machine's TZ.
const at = (month: number, day: number, hour = 12, minute = 0) =>
  new Date(2026, month, day, hour, minute).getTime();

const NOW = at(10, 11, 15); // 11 Nov 2026, 15:00 local

let seq = 0;
function entry(
  overrides: Partial<Pick<HistoryEntry, "id" | "method" | "url" | "timestamp">>
): HistoryEntry {
  seq += 1;
  return {
    id: overrides.id ?? `e${seq}`,
    method: overrides.method ?? "GET",
    url: overrides.url ?? "https://api.test/a",
    status: 200,
    duration: 10,
    size: 1,
    timestamp: overrides.timestamp ?? NOW,
    request: {} as HistoryEntry["request"],
    response: {} as HistoryEntry["response"],
  };
}

const kinds = (rows: HistoryRow[]) => rows.map((r) => r.kind);
const group = (rows: HistoryRow[]) =>
  rows.find((r) => r.kind === "group") as Extract<
    HistoryRow,
    { kind: "group" }
  >;

describe("matchesHistoryFilter", () => {
  const e = entry({ method: "POST", url: "https://Api.test/Users?x=1" });

  it("matches everything for an empty filter", () => {
    expect(matchesHistoryFilter(e, "")).toBe(true);
  });

  it("matches url case-insensitively", () => {
    expect(matchesHistoryFilter(e, "API.TEST/users")).toBe(true);
  });

  it("matches method case-insensitively", () => {
    expect(matchesHistoryFilter(e, "post")).toBe(true);
  });

  it("matches the normalised health key", () => {
    expect(matchesHistoryFilter(e, "POST:")).toBe(true);
  });

  it("rejects a term found nowhere", () => {
    expect(matchesHistoryFilter(e, "zzz")).toBe(false);
  });
});

describe("groupHistoryByDay", () => {
  it("returns no rows for empty input", () => {
    expect(groupHistoryByDay([], { now: NOW, filter: "" })).toEqual([]);
  });

  it("renders a single run as header plus lone run without a group", () => {
    const only = entry({ id: "only" });
    const rows = groupHistoryByDay([only], { now: NOW, filter: "" });
    expect(kinds(rows)).toEqual(["header", "run"]);
    expect(rows[0]).toMatchObject({ label: "Today" });
    expect(rows[1]).toMatchObject({ id: "run:only", groupId: null });
  });

  it("groups identical method + url with a count and latest run", () => {
    const old = entry({ id: "old", timestamp: at(10, 11, 9) });
    const mid = entry({ id: "mid", timestamp: at(10, 11, 10) });
    const latest = entry({ id: "new", timestamp: at(10, 11, 11) });
    const rows = groupHistoryByDay([old, latest, mid], {
      now: NOW,
      filter: "",
    });
    expect(kinds(rows)).toEqual(["header", "group", "run", "run", "run"]);
    const g = group(rows);
    expect(g.count).toBe(3);
    expect(g.latest.id).toBe("new");
    const runs = rows.filter((r) => r.kind === "run");
    expect(runs.map((r) => r.id)).toEqual(["run:new", "run:mid", "run:old"]);
    expect(runs.every((r) => r.kind === "run" && r.groupId === g.id)).toBe(
      true
    );
  });

  it("keeps the same url with a different method as separate rows", () => {
    const rows = groupHistoryByDay(
      [entry({ method: "GET" }), entry({ method: "POST" })],
      { now: NOW, filter: "" }
    );
    expect(kinds(rows)).toEqual(["header", "run", "run"]);
  });

  it("keeps query-only differences as separate rows", () => {
    const rows = groupHistoryByDay(
      [
        entry({ url: "https://api.test/a?x=1" }),
        entry({ url: "https://api.test/a?x=2" }),
      ],
      { now: NOW, filter: "" }
    );
    expect(kinds(rows)).toEqual(["header", "run", "run"]);
  });

  it("orders newest-first regardless of input order", () => {
    const a = entry({ id: "a", url: "https://x/a", timestamp: at(10, 11, 8) });
    const b = entry({ id: "b", url: "https://x/b", timestamp: at(10, 11, 13) });
    const rows = groupHistoryByDay([a, b], { now: NOW, filter: "" });
    expect(rows.filter((r) => r.kind === "run").map((r) => r.id)).toEqual([
      "run:b",
      "run:a",
    ]);
  });

  it("splits groups at the local midnight boundary", () => {
    const justAfter = entry({ id: "after", timestamp: at(10, 11, 0, 0) });
    const justBefore = entry({ id: "before", timestamp: at(10, 10, 23, 59) });
    const rows = groupHistoryByDay([justBefore, justAfter], {
      now: NOW,
      filter: "",
    });
    expect(kinds(rows)).toEqual(["header", "run", "header", "run"]);
    expect(rows.filter((r) => r.kind === "header").map((r) => r.label)).toEqual(
      ["Today", "Yesterday"]
    );
    expect(rows.some((r) => r.kind === "group")).toBe(false);
  });

  it("labels Yesterday across a DST change day", () => {
    // 8 Mar 2026 is a 23-hour day in US zones; 9 Mar must still see it as yesterday.
    const now = at(2, 9, 12);
    const rows = groupHistoryByDay([entry({ timestamp: at(2, 8, 23, 30) })], {
      now,
      filter: "",
    });
    expect(rows[0]).toMatchObject({ label: "Yesterday" });
  });

  it("labels Yesterday across a month boundary", () => {
    const rows = groupHistoryByDay([entry({ timestamp: at(9, 31, 10) })], {
      now: at(10, 1, 10),
      filter: "",
    });
    expect(rows[0]).toMatchObject({ label: "Yesterday" });
  });

  it("uses a locale date label for older days", () => {
    const ts = at(10, 3, 10);
    const rows = groupHistoryByDay([entry({ timestamp: ts })], {
      now: NOW,
      filter: "",
    });
    // 3 Nov 2026 is a Tuesday. Token checks keep the expectation independent
    // of the production format call while tolerating locale word order.
    expect(rows[0]).toMatchObject({ kind: "header" });
    const label = (rows[0] as { label: string }).label;
    expect(label).toMatch(/\bTue\b/);
    expect(label).toMatch(/\bNov\b/);
    expect(label).toMatch(/\b3\b/);
    expect(label).not.toMatch(/Today|Yesterday/);
  });

  it("gives each day a unique header id", () => {
    const rows = groupHistoryByDay(
      [entry({ timestamp: at(10, 11) }), entry({ timestamp: at(10, 5) })],
      { now: NOW, filter: "" }
    );
    const ids = rows.filter((r) => r.kind === "header").map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("does not group identical requests that fall on different days", () => {
    const rows = groupHistoryByDay(
      [entry({ timestamp: at(10, 11) }), entry({ timestamp: at(10, 10) })],
      { now: NOW, filter: "" }
    );
    expect(rows.some((r) => r.kind === "group")).toBe(false);
  });

  it("filters across runs and counts only matching runs", () => {
    const rows = groupHistoryByDay(
      [
        entry({ url: "https://api.test/users", timestamp: at(10, 11, 9) }),
        entry({ url: "https://api.test/users", timestamp: at(10, 11, 10) }),
        entry({ url: "https://api.test/orders", timestamp: at(10, 11, 11) }),
      ],
      { now: NOW, filter: "users" }
    );
    expect(group(rows).count).toBe(2);
    expect(rows.filter((r) => r.kind === "run")).toHaveLength(2);
  });

  it("demotes a group to a lone run when the filter leaves one run", () => {
    const rows = groupHistoryByDay(
      [
        entry({ id: "p", method: "GET", url: "https://x/same" }),
        entry({
          id: "q",
          method: "GET",
          url: "https://x/same",
          timestamp: NOW - 1000,
        }),
        entry({ id: "r", method: "POST", url: "https://x/other" }),
      ],
      { now: NOW, filter: "other" }
    );
    expect(kinds(rows)).toEqual(["header", "run"]);
  });

  it("returns no rows when the filter matches nothing", () => {
    expect(
      groupHistoryByDay([entry({})], { now: NOW, filter: "nomatch" })
    ).toEqual([]);
  });

  it("drops the group when its last run is deleted from the input", () => {
    const a = entry({ id: "a", timestamp: at(10, 11, 9) });
    const b = entry({ id: "b", timestamp: at(10, 11, 10) });
    expect(
      group(groupHistoryByDay([a, b], { now: NOW, filter: "" })).count
    ).toBe(2);

    const afterOne = groupHistoryByDay([a], { now: NOW, filter: "" });
    expect(kinds(afterOne)).toEqual(["header", "run"]);

    expect(groupHistoryByDay([], { now: NOW, filter: "" })).toEqual([]);
  });

  it("updates the group summary when the latest run is deleted", () => {
    const a = entry({ id: "a", timestamp: at(10, 11, 8) });
    const b = entry({ id: "b", timestamp: at(10, 11, 9) });
    const c = entry({ id: "c", timestamp: at(10, 11, 10) });
    const g = group(groupHistoryByDay([a, b], { now: NOW, filter: "" }));
    expect(g.latest.id).toBe("b");
    const full = group(groupHistoryByDay([a, b, c], { now: NOW, filter: "" }));
    expect(full.latest.id).toBe("c");
  });

  it("does not mutate the input array", () => {
    const input = [
      entry({ id: "x", timestamp: at(10, 11, 8) }),
      entry({ id: "y", timestamp: at(10, 11, 9) }),
    ];
    groupHistoryByDay(input, { now: NOW, filter: "" });
    expect(input.map((e) => e.id)).toEqual(["x", "y"]);
  });
});

describe("limitGroups", () => {
  const build = (count: number) =>
    groupHistoryByDay(
      Array.from({ length: count }, (_, i) =>
        entry({ url: `https://x/${i}`, timestamp: NOW - i * 1000 })
      ),
      { now: NOW, filter: "" }
    );

  it("exposes a limit of 20", () => {
    expect(COMPACT_GROUP_LIMIT).toBe(20);
  });

  it("keeps everything when under the limit", () => {
    const rows = build(3);
    expect(limitGroups(rows, COMPACT_GROUP_LIMIT)).toEqual(rows);
  });

  it("keeps the first 20 groups and their header only", () => {
    const limited = limitGroups(build(25), COMPACT_GROUP_LIMIT);
    expect(kinds(limited).filter((k) => k === "run")).toHaveLength(20);
    expect(kinds(limited).filter((k) => k === "header")).toHaveLength(1);
  });

  it("counts a group with its runs as one and never splits it", () => {
    const grouped = [
      entry({ id: "g1", url: "https://x/g", timestamp: NOW }),
      entry({ id: "g2", url: "https://x/g", timestamp: NOW - 1 }),
      entry({ id: "s1", url: "https://x/s1", timestamp: NOW - 2 }),
      entry({ id: "s2", url: "https://x/s2", timestamp: NOW - 3 }),
    ];
    const rows = groupHistoryByDay(grouped, { now: NOW, filter: "" });
    const limited = limitGroups(rows, 2);
    expect(limited.map((r) => r.id)).toEqual(
      rows
        .slice(0, 1)
        .concat(rows.slice(1, 5))
        .map((r) => r.id)
    );
    expect(limited.filter((r) => r.kind === "run").map((r) => r.id)).toEqual([
      "run:g1",
      "run:g2",
      "run:s1",
    ]);
  });

  it("drops the next day's header when the limit ends the previous day", () => {
    const rows = groupHistoryByDay(
      [
        entry({ url: "https://x/1", timestamp: at(10, 11) }),
        entry({ url: "https://x/2", timestamp: at(10, 10) }),
      ],
      { now: NOW, filter: "" }
    );
    const limited = limitGroups(rows, 1);
    expect(kinds(limited)).toEqual(["header", "run"]);
  });

  it("returns nothing for a limit of zero", () => {
    expect(limitGroups(build(2), 0)).toEqual([]);
  });

  it("returns nothing for empty rows", () => {
    expect(limitGroups([], 5)).toEqual([]);
  });
});

describe("toVisibleRows", () => {
  const rows = groupHistoryByDay(
    [
      entry({ id: "a1", url: "https://x/a", timestamp: NOW }),
      entry({ id: "a2", url: "https://x/a", timestamp: NOW - 1 }),
      entry({ id: "b1", url: "https://x/b", timestamp: NOW - 2 }),
    ],
    { now: NOW, filter: "" }
  );
  const groupId = group(rows).id;

  it("hides runs of collapsed groups but keeps lone runs", () => {
    const visible = toVisibleRows(rows, new Set());
    expect(visible.map((r) => r.id)).toEqual([rows[0].id, groupId, "run:b1"]);
  });

  it("shows runs for expanded group ids", () => {
    const visible = toVisibleRows(rows, new Set([groupId]));
    expect(visible.map((r) => r.id)).toEqual([
      rows[0].id,
      groupId,
      "run:a1",
      "run:a2",
      "run:b1",
    ]);
  });

  it("ignores expanded ids that match no group", () => {
    expect(toVisibleRows(rows, new Set(["group:nope"]))).toHaveLength(3);
  });

  it("returns an empty list for empty rows", () => {
    expect(toVisibleRows([], new Set())).toEqual([]);
  });
});
