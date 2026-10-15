import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { RequestModel, TabState } from "@/types";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import { createRegistry, executeTool } from "./registry";
import { awaitsUser } from "./schemas";
import {
  dirtyTabsAmongRequests,
  isCloseTabsTool,
  previewCloseTabs,
  tabTools,
} from "./tabs";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const registry = createRegistry(tabTools);
const context = {
  store: createFakeStoreAccess().access,
  redact: DEFAULT_REDACT_CONTEXT,
};

const savedRequest = (id: string, name: string): RequestModel => ({
  id,
  collectionId: "c1",
  folderId: null,
  name,
  method: "GET",
  url: "https://api.test/saved",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

/** Opens a tab and returns it; the tab store assigns the tabId. */
function openTab(overrides: Partial<TabState>): TabState {
  useTabsStore.getState().openTab(overrides);
  const { tabs } = useTabsStore.getState();
  return tabs[tabs.length - 1];
}

function dirty(tabId: string, patch: Partial<TabState> = {}) {
  useTabsStore.getState().updateTabState(tabId, { isDirty: true, ...patch });
}

const names = () => useTabsStore.getState().tabs.map((tab) => tab.name);

const closeTab = (tabId: string, selection?: string) =>
  executeTool(registry, "close_tab", { tabId }, { ...context, selection });

const closeAll = (includePinned: boolean | null, selection?: string) =>
  executeTool(
    registry,
    "close_all_tabs",
    { includePinned },
    { ...context, selection },
  );

beforeEach(() => {
  vi.mocked(getDB).mockReturnValue(null);
  useTabsStore.setState({ tabs: [], activeTabId: null, hydrated: true });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useSettingsStore.setState({ pinnedRequestIds: [] });
});

describe("close_tab", () => {
  it("[success] closes a clean tab without asking", async () => {
    const keep = openTab({ name: "Keep" });
    const gone = openTab({ name: "Gone" });
    expect(awaitsUser("close_tab", { tabId: gone.tabId })).toBe(false);
    expect(await closeTab(gone.tabId)).toEqual({
      ok: true,
      data: { closed: 1, saved: 0, pinnedKept: 0, needsDestination: [] },
    });
    expect(useTabsStore.getState().tabs.map((t) => t.tabId)).toEqual([
      keep.tabId,
    ]);
  });

  it("[success] a dirty tab waits for the user and Discard closes it unsaved", async () => {
    useCollectionsStore.setState({ requests: [savedRequest("r1", "Saved")] });
    const tab = openTab({ name: "Edited", requestId: "r1" });
    dirty(tab.tabId, { url: "https://api.test/edited" });
    expect(awaitsUser("close_tab", { tabId: tab.tabId })).toBe(true);
    expect(await closeTab(tab.tabId, "discard")).toEqual({
      ok: true,
      data: { closed: 1, saved: 0, pinnedKept: 0, needsDestination: [] },
    });
    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useCollectionsStore.getState().requests[0].url).toBe(
      "https://api.test/saved",
    );
  });

  it("[success] Save all writes the edits into the saved request, then closes", async () => {
    useCollectionsStore.setState({ requests: [savedRequest("r1", "Saved")] });
    const tab = openTab({ name: "Edited", requestId: "r1" });
    dirty(tab.tabId, { url: "https://api.test/edited", method: "POST" });
    expect(await closeTab(tab.tabId, "save-all")).toEqual({
      ok: true,
      data: { closed: 1, saved: 1, pinnedKept: 0, needsDestination: [] },
    });
    const [request] = useCollectionsStore.getState().requests;
    expect(request.url).toBe("https://api.test/edited");
    expect(request.method).toBe("POST");
    expect(request.name).toBe("Edited");
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("[invalid] refuses a dirty tab without a decision and leaves it open", async () => {
    const tab = openTab({ name: "Edited" });
    dirty(tab.tabId);
    const expected = {
      ok: false,
      error: "the user must choose what to do with unsaved changes first",
    };
    expect(await closeTab(tab.tabId)).toEqual(expected);
    expect(await closeTab(tab.tabId, "cancel")).toEqual(expected);
    expect(await closeTab(tab.tabId, "anything-else")).toEqual(expected);
    expect(names()).toEqual(["Edited"]);
  });

  it("[invalid] fails for an unknown tab and for malformed input", async () => {
    openTab({ name: "Only" });
    expect(await closeTab("ghost")).toEqual({
      ok: false,
      error: "tab not found: ghost",
    });
    const bad = await executeTool(registry, "close_tab", {}, context);
    expect(bad).toMatchObject({ ok: false });
    expect((bad as { error: string }).error).toContain("invalid input");
    expect(names()).toEqual(["Only"]);
  });

  it("[undo] leaves no change to undo; the saved request can reopen the tab", async () => {
    useCollectionsStore.setState({ requests: [savedRequest("r1", "Saved")] });
    const tab = openTab({ name: "Saved", requestId: "r1" });
    const out = await closeTab(tab.tabId);
    expect(out).toMatchObject({ ok: true });
    expect(
      (out as { data: Record<string, unknown> }).data.changeId,
    ).toBeUndefined();
    expect(useCollectionsStore.getState().requests.map((r) => r.id)).toEqual([
      "r1",
    ]);
  });
});

describe("close_all_tabs", () => {
  function pinnedSetup() {
    useCollectionsStore.setState({
      requests: [savedRequest("r1", "Pinned"), savedRequest("r2", "Plain")],
    });
    useSettingsStore.setState({ pinnedRequestIds: ["r1"] });
    const pinned = openTab({ name: "Pinned", requestId: "r1" });
    const plain = openTab({ name: "Plain", requestId: "r2" });
    const scratch = openTab({ name: "Scratch" });
    return { pinned, plain, scratch };
  }

  it("[success] keeps pinned tabs and reports how many were kept", async () => {
    pinnedSetup();
    expect(await closeAll(null)).toEqual({
      ok: true,
      data: { closed: 2, saved: 0, pinnedKept: 1, needsDestination: [] },
    });
    expect(names()).toEqual(["Pinned"]);
  });

  it("[success] closes pinned tabs too when includePinned is true", async () => {
    pinnedSetup();
    expect(await closeAll(true)).toEqual({
      ok: true,
      data: { closed: 3, saved: 0, pinnedKept: 0, needsDestination: [] },
    });
    expect(names()).toEqual([]);
    expect(useTabsStore.getState().activeTabId).toBeNull();
  });

  it("[success] reports that nothing closed when no tabs are open", async () => {
    expect(await closeAll(false)).toEqual({
      ok: true,
      data: { closed: 0, saved: 0, pinnedKept: 0, needsDestination: [] },
    });
  });

  it("[success] Save all saves dirty saved tabs and lists tabs with no destination", async () => {
    const { plain, scratch } = pinnedSetup();
    dirty(plain.tabId, { url: "https://api.test/changed" });
    dirty(scratch.tabId);
    expect(awaitsUser("close_all_tabs", { includePinned: null })).toBe(true);
    expect(await closeAll(null, "save-all")).toEqual({
      ok: true,
      data: {
        closed: 1,
        saved: 1,
        pinnedKept: 1,
        needsDestination: [scratch.tabId],
      },
    });
    expect(names()).toEqual(["Pinned", "Scratch"]);
    expect(
      useCollectionsStore.getState().requests.find((r) => r.id === "r2")?.url,
    ).toBe("https://api.test/changed");
  });

  it("[success] Discard closes dirty tabs without saving them", async () => {
    const { plain } = pinnedSetup();
    dirty(plain.tabId, { url: "https://api.test/changed" });
    const out = await closeAll(null, "discard");
    expect(out).toMatchObject({ ok: true, data: { closed: 2, saved: 0 } });
    expect(names()).toEqual(["Pinned"]);
    expect(
      useCollectionsStore.getState().requests.find((r) => r.id === "r2")?.url,
    ).toBe("https://api.test/saved");
  });

  it("[invalid] a dirty tab without a decision leaves every tab open", async () => {
    const { plain } = pinnedSetup();
    dirty(plain.tabId);
    expect(await closeAll(null)).toEqual({
      ok: false,
      error: "the user must choose what to do with unsaved changes first",
    });
    expect(names()).toEqual(["Pinned", "Plain", "Scratch"]);
  });

  it("[invalid] rejects input that leaves includePinned out", async () => {
    openTab({ name: "A" });
    const out = await executeTool(registry, "close_all_tabs", {}, context);
    expect(out).toMatchObject({ ok: false });
    expect(names()).toEqual(["A"]);
  });

  it("[undo] leaves no change to undo and keeps every saved request", async () => {
    pinnedSetup();
    const out = await closeAll(true);
    expect(
      (out as { data: Record<string, unknown> }).data.changeId,
    ).toBeUndefined();
    expect(useCollectionsStore.getState().requests).toHaveLength(2);
  });
});

describe("previewCloseTabs", () => {
  it("lists only dirty targets and whether each can be saved", () => {
    useCollectionsStore.setState({ requests: [savedRequest("r1", "Saved")] });
    const saved = openTab({ name: "Saved", requestId: "r1" });
    const orphan = openTab({ name: "Orphan", requestId: "deleted" });
    const draft = openTab({ name: "Draft" });
    openTab({ name: "Clean" });
    dirty(saved.tabId);
    dirty(orphan.tabId);
    dirty(draft.tabId);
    expect(previewCloseTabs("close_all_tabs", { includePinned: true })).toEqual({
      dirty: [
        { tabId: saved.tabId, name: "Saved", hasDestination: true },
        { tabId: orphan.tabId, name: "Orphan", hasDestination: false },
        { tabId: draft.tabId, name: "Draft", hasDestination: false },
      ],
      pinnedKept: 0,
    });
  });

  it("treats a non-HTTP tab as having no destination and skips pinned dirty tabs", () => {
    useCollectionsStore.setState({ requests: [savedRequest("r1", "Saved")] });
    useSettingsStore.setState({ pinnedRequestIds: ["r1"] });
    const socket = openTab({
      type: "websocket",
      name: "Socket",
      requestId: "r1",
    });
    dirty(socket.tabId);
    expect(previewCloseTabs("close_tab", { tabId: socket.tabId })).toEqual({
      dirty: [{ tabId: socket.tabId, name: "Socket", hasDestination: false }],
      pinnedKept: 0,
    });
    expect(previewCloseTabs("close_all_tabs", { includePinned: null })).toEqual({
      dirty: [],
      pinnedKept: 1,
    });
  });
});

describe("dirtyTabsAmongRequests", () => {
  it("names dirty open tabs of the given requests only", () => {
    const a = openTab({ name: "A", requestId: "r1" });
    openTab({ name: "B", requestId: "r2" });
    const c = openTab({ name: "C", requestId: "r3" });
    openTab({ name: "D" });
    dirty(a.tabId);
    dirty(c.tabId);
    expect(dirtyTabsAmongRequests(["r1", "r2"]).map((t) => t.name)).toEqual([
      "A",
    ]);
    expect(dirtyTabsAmongRequests([])).toEqual([]);
  });
});

describe("isCloseTabsTool", () => {
  it("recognises exactly the two close tools", () => {
    expect(isCloseTabsTool("close_tab")).toBe(true);
    expect(isCloseTabsTool("close_all_tabs")).toBe(true);
    expect(isCloseTabsTool("delete_request")).toBe(false);
  });
});
