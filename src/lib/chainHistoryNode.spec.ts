import { describe, expect, it } from "vitest";
import type { HistoryEntry, HttpTab } from "@/types";
import { draftToChainNode, historyEntryToChainNode } from "./chainHistoryNode";

const tab: HttpTab = {
  tabId: "t",
  requestId: null,
  name: "Draft",
  isDirty: false,
  type: "http",
  method: "POST",
  url: "https://api.test/v1/users",
  params: [],
  headers: [{ id: "h", key: "A", value: "b", enabled: true }],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
};

const entry = (url: string): HistoryEntry =>
  ({ id: "h1", method: "POST", url, request: { ...tab, url } }) as HistoryEntry;

describe("chainHistoryNode", () => {
  it("names a history node from the last URL path segment", () => {
    const node = historyEntryToChainNode(entry("https://api.test/v1/users"));
    expect(node).toMatchObject({
      historyEntryId: "h1",
      name: "users",
      method: "POST",
      url: "https://api.test/v1/users",
    });
    expect(node.id).toBeTruthy();
  });

  it("falls back to the raw url for a root path or an unparseable url", () => {
    expect(historyEntryToChainNode(entry("https://api.test/")).name).toBe("https://api.test/");
    expect(historyEntryToChainNode(entry("{{base}}/x")).name).toBe("{{base}}/x");
  });

  it("wraps a draft as an ad hoc node without a history entry id", () => {
    const node = draftToChainNode(tab);
    expect(node).toMatchObject({ historyEntryId: "", name: "Draft", headers: tab.headers });
    expect(draftToChainNode(tab).id).not.toBe(node.id);
  });
});
