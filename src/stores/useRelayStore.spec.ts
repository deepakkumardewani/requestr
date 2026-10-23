/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_MAX_THREADS,
  RELAY_MIN_WIDTH_PX,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
} from "@/lib/relay/constants";
import * as threadDb from "@/lib/relay/threadDb";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  getThread,
  listThreads,
  scheduleThreadSave,
} from "@/lib/relay/threadDb";
import {
  clampRelayWidth,
  getRelayDefaultWidth,
  getRelayMaxWidth,
  getRelayMinWidth,
  useRelayStore,
} from "./useRelayStore";

// No browser storage in these tests: threads live in the in-memory fallback.
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const VIEWPORT_PX = 1440;
const MIN_AT_VIEWPORT_PX = 432;
const DEFAULT_AT_VIEWPORT_PX = 432;
const MAX_AT_VIEWPORT_PX = 576;

function resetStore() {
  useRelayStore.setState({
    open: false,
    width: DEFAULT_AT_VIEWPORT_PX,
    activeThreadId: null,
    hydrated: false,
    prunedNotice: false,
    shareValues: false,
    attachedItems: [],
    pendingPrompt: null,
    composerPrefill: null,
    focusRequest: 0,
    composerHasText: false,
    permissionPopoverOpen: false,
    capabilitiesOpen: false,
    mentionRequest: null,
    enabled: true,
    position: "right",
  });
}

function serializeStorageKeys(): string {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return JSON.stringify(
    keys
      .sort()
      .map((key) => [key, localStorage.getItem(key)])
      .flat(),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("innerWidth", VIEWPORT_PX);
  resetStore();
});

afterEach(async () => {
  await flushThreadWrites();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("clampRelayWidth", () => {
  // Helper table for all tested viewports (1440 / 1100 / 1024 / 900 / 800 / 780 / 320).
  // Derived: floor(vp × pct / 100), then max(320px, result) for min; max(320px, result) for max.
  // 1440: min=max(320, floor(1440×30/100))=432, default=432, max=max(320, floor(1440×40/100))=576
  // 1100: min=max(320, floor(1100×30/100))=330, default=330, max=max(320, floor(1100×40/100))=440
  // 1024: min=max(320, floor(1024×30/100))=307→320, default=320, max=max(320, floor(1024×40/100))=409
  // 900:  min=max(320, floor(900×30/100))=270→320, default=320, max=max(320, floor(900×40/100))=360
  // 800:  min=max(320, floor(800×30/100))=240→320, default=320, max=max(320, floor(800×40/100))=320
  // 780:  min=max(320, floor(780×30/100))=234→320, default=320, max=max(320, floor(780×40/100))=312→320
  // 320:  min=max(320, floor(320×30/100))=96→320, default=320, max=max(320, floor(320×40/100))=128→320
  it.each([
    [1440, 432, 576, 432],
    [1100, 330, 440, 330],
    [1024, 320, 409, 320],
    [900, 320, 360, 320],
    [800, 320, 320, 320], // 40vw (320) equals the floor
    [780, 320, 320, 320], // floor beats 40vw (312)
    [320, 320, 320, 320], // minimum viewport
  ])("limits at %ipx are min %i, max %i, default %i", (vp, min, max, def) => {
    expect(getRelayMinWidth(vp)).toBe(min);
    expect(getRelayMaxWidth(vp)).toBe(max);
    expect(getRelayDefaultWidth(vp)).toBe(def);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampRelayWidth(10)).toBe(MIN_AT_VIEWPORT_PX);
    expect(clampRelayWidth(5000)).toBe(MAX_AT_VIEWPORT_PX);
  });

  it("rounds to the nearest px (450.4 -> 450)", () => {
    // 450.4 at 1440: rounds to 450 (within 432..576)
    expect(clampRelayWidth(450.4)).toBe(450);
  });

  it("rounds half up (450.5 -> 451)", () => {
    // 450.5 at 1440: rounds to 451 (within 432..576)
    expect(clampRelayWidth(450.5)).toBe(451);
  });

  it("falls back to the default for NaN", () => {
    // Non-finite width (NaN) returns the default, not the max.
    expect(clampRelayWidth(Number.NaN)).toBe(DEFAULT_AT_VIEWPORT_PX);
  });

  it("falls back to the default for Infinity", () => {
    // Non-finite width (Infinity) returns the default, not the max.
    expect(clampRelayWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_AT_VIEWPORT_PX);
  });

  it("never returns less than the minimum on a tiny viewport", () => {
    // 400px viewport: min=max(320, 120)=320, even with a wider default request.
    expect(clampRelayWidth(400, 400)).toBe(RELAY_MIN_WIDTH_PX);
  });

  it("uses the provided viewport parameter when given", () => {
    // Explicit viewport 900px overrides window.innerWidth.
    const clamped = clampRelayWidth(500, 900);
    expect(clamped).toBe(360); // clamped to max at 900px
  });
});

describe("useRelayStore", () => {
  it("starts closed at the default width with no thread or attachments", () => {
    const state = useRelayStore.getState();
    expect(state.open).toBe(false);
    expect(state.width).toBe(DEFAULT_AT_VIEWPORT_PX);
    expect(state.activeThreadId).toBeNull();
    expect(state.attachedItems).toEqual([]);
  });

  it("toggles open and persists each change", () => {
    useRelayStore.getState().toggle();
    expect(useRelayStore.getState().open).toBe(true);
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.open)).toBe("true");

    useRelayStore.getState().toggle();
    expect(useRelayStore.getState().open).toBe(false);
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.open)).toBe("false");
  });

  it("setOpen sets the state explicitly", () => {
    useRelayStore.getState().setOpen(true);
    expect(useRelayStore.getState().open).toBe(true);
    useRelayStore.getState().setOpen(false);
    expect(useRelayStore.getState().open).toBe(false);
  });

  it("bumps focusRequest on every open, including re-opening an open dock", () => {
    useRelayStore.getState().setOpen(true);
    useRelayStore.getState().setOpen(true);
    expect(useRelayStore.getState().focusRequest).toBe(2);
  });

  it("does not bump focusRequest when closing", () => {
    useRelayStore.getState().setOpen(true);
    useRelayStore.getState().setOpen(false);
    expect(useRelayStore.getState().focusRequest).toBe(1);
  });

  it("clamps and persists the width", () => {
    useRelayStore.getState().setWidth(5000);
    expect(useRelayStore.getState().width).toBe(MAX_AT_VIEWPORT_PX);
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.width)).toBe(
      String(MAX_AT_VIEWPORT_PX),
    );

    useRelayStore.getState().setWidth(1);
    expect(useRelayStore.getState().width).toBe(MIN_AT_VIEWPORT_PX);
  });

  describe("hydrate", () => {
    it("restores open and width after the store is re-created", async () => {
      useRelayStore.getState().setOpen(true);
      useRelayStore.getState().setWidth(500);

      // Not vi.resetModules(): a re-imported store would lazy-load a second thread DB.
      useRelayStore.setState({ open: false, width: DEFAULT_AT_VIEWPORT_PX });
      expect(useRelayStore.getState().open).toBe(false);

      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().open).toBe(true);
      expect(useRelayStore.getState().width).toBe(500);
    });

    it("does not request composer focus for a restored open state", () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.open, "true");
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().focusRequest).toBe(0);
    });

    it("uses defaults when nothing is stored", () => {
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().open).toBe(false);
      expect(useRelayStore.getState().width).toBe(DEFAULT_AT_VIEWPORT_PX);
    });

    it("clamps a stored width that is out of range (above max)", () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.width, "9999");
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().width).toBe(MAX_AT_VIEWPORT_PX);
    });

    it("clamps a stored width that is out of range (below min)", () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.width, "100");
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().width).toBe(MIN_AT_VIEWPORT_PX);
    });

    it.each(["", "   ", "abc"])(
      "falls back to the default for corrupt width %j",
      (value) => {
        localStorage.setItem(RELAY_STORAGE_KEYS.width, value);
        useRelayStore.getState().hydrate();
        expect(useRelayStore.getState().width).toBe(DEFAULT_AT_VIEWPORT_PX);
      },
    );

    it("restores the persisted active thread pointer and flags hydration", async () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.activeThread, "t-saved");
      await useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().activeThreadId).toBe("t-saved");
      expect(useRelayStore.getState().hydrated).toBe(true);
    });

    it("adopts the most recently active thread when there is no pointer", async () => {
      let clock = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => (clock += 1_000));
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t-older" });
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t-newer" });
      scheduleThreadSave("t-newer", {
        messages: [{ id: "u", role: "user", parts: [{ type: "text", text: "x" }] }],
        interruptedMessageId: null,
      });
      await flushThreadWrites();

      await useRelayStore.getState().hydrate();

      expect(useRelayStore.getState().activeThreadId).toBe("t-newer");
      expect(localStorage.getItem(RELAY_STORAGE_KEYS.activeThread)).toBe("t-newer");
    });

    it("hydrates with no active thread when none exist", async () => {
      await useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().activeThreadId).toBeNull();
      expect(useRelayStore.getState().hydrated).toBe(true);
    });

    it("treats any stored open value other than 'true' as closed", () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.open, "yes");
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().open).toBe(false);
    });
  });

  describe("when storage throws", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("quota");
        },
      });
    });

    it("keeps working and logs the failing key on write", () => {
      useRelayStore.getState().setOpen(true);
      expect(useRelayStore.getState().open).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        "[relay] preference write failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.open }),
      );
    });

    it("hydrates to defaults and logs the failing key on read", () => {
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().open).toBe(false);
      expect(useRelayStore.getState().width).toBe(DEFAULT_AT_VIEWPORT_PX);
      expect(console.warn).toHaveBeenCalledWith(
        "[relay] preference read failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.width }),
      );
    });
  });

  describe("threads", () => {
    it("setActiveThreadId persists the pointer and removes it for null", () => {
      useRelayStore.getState().setActiveThreadId("t-1");
      expect(localStorage.getItem(RELAY_STORAGE_KEYS.activeThread)).toBe("t-1");

      useRelayStore.getState().setActiveThreadId(null);
      expect(useRelayStore.getState().activeThreadId).toBeNull();
      expect(localStorage.getItem(RELAY_STORAGE_KEYS.activeThread)).toBeNull();
    });

    it("startThread creates the thread, activates it and returns its id", async () => {
      const id = await useRelayStore.getState().startThread();

      expect(useRelayStore.getState().activeThreadId).toBe(id);
      expect(localStorage.getItem(RELAY_STORAGE_KEYS.activeThread)).toBe(id);
      expect(await getThread(id)).toMatchObject({ id, workspaceId: RELAY_WORKSPACE_ID });
    });

    it("startThread honours a supplied id", async () => {
      expect(await useRelayStore.getState().startThread({ id: "t-given" })).toBe("t-given");
    });

    it("startThread raises the pruned notice when the oldest thread is dropped", async () => {
      for (let i = 0; i < RELAY_MAX_THREADS; i += 1) {
        await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: `t-${i}` });
      }
      expect(useRelayStore.getState().prunedNotice).toBe(false);

      await useRelayStore.getState().startThread();

      expect(useRelayStore.getState().prunedNotice).toBe(true);
      expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(RELAY_MAX_THREADS);
    });

    it("dismissPrunedNotice clears the notice", () => {
      useRelayStore.setState({ prunedNotice: true });
      useRelayStore.getState().dismissPrunedNotice();
      expect(useRelayStore.getState().prunedNotice).toBe(false);
    });

    it("newThread creates a thread when none is active", async () => {
      await useRelayStore.getState().newThread();
      expect(useRelayStore.getState().activeThreadId).not.toBeNull();
    });

    it("newThread clears manual attachments", async () => {
      useRelayStore.setState({
        attachedItems: [
          { kind: "request", id: "r1", label: "R" },
          { kind: "tab", id: "t1", label: "Tab" },
        ],
      });

      await useRelayStore.getState().newThread();

      expect(useRelayStore.getState().attachedItems).toEqual([]);
    });

    it("newThread reuses an active thread that is still empty", async () => {
      const first = await useRelayStore.getState().startThread();

      await useRelayStore.getState().newThread();

      expect(useRelayStore.getState().activeThreadId).toBe(first);
      expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
    });

    it("newThread starts a fresh thread once the active one has messages", async () => {
      const first = await useRelayStore.getState().startThread();
      scheduleThreadSave(first, {
        messages: [{ id: "u", role: "user", parts: [{ type: "text", text: "hi" }] }],
        interruptedMessageId: null,
      });

      await useRelayStore.getState().newThread();

      expect(useRelayStore.getState().activeThreadId).not.toBe(first);
      expect((await getThread(first))?.messages).toHaveLength(1);
    });

    it("newThread replaces a pointer to a thread that no longer exists", async () => {
      useRelayStore.getState().setActiveThreadId("ghost");

      await useRelayStore.getState().newThread();

      expect(useRelayStore.getState().activeThreadId).not.toBe("ghost");
    });
  });
});

describe("shareValues", () => {
  it("defaults to false, persists, and is restored by hydrate", async () => {
    expect(useRelayStore.getState().shareValues).toBe(false);
    useRelayStore.getState().setShareValues(true);
    expect(useRelayStore.getState().shareValues).toBe(true);
    expect(localStorage.getItem("rq_relay_share_values")).toBe("true");
    resetStore();
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().shareValues).toBe(true);
  });

  it("stays false when nothing is stored", async () => {
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().shareValues).toBe(false);
  });
});

describe("context chips and prompts", () => {
  it("tracks manual attachments without duplicates and keeps them out of storage", () => {
    const item = { kind: "request", id: "r1", label: "Get orders" } as const;
    const { addAttachedItem, removeAttachedItem } = useRelayStore.getState();
    const storedBefore = JSON.stringify({ ...localStorage });
    addAttachedItem(item);
    addAttachedItem(item);
    expect(useRelayStore.getState().attachedItems).toEqual([item]);
    expect(JSON.stringify({ ...localStorage })).toBe(storedBefore);
    removeAttachedItem("request:r1");
    expect(useRelayStore.getState().attachedItems).toEqual([]);
  });

  it("deduplicates an item with the same kind and id but different label", () => {
    const item1 = { kind: "request", id: "r1", label: "Original label" } as const;
    useRelayStore.setState({ attachedItems: [item1] });
    const before = useRelayStore.getState().attachedItems;

    const item2 = { kind: "request", id: "r1", label: "Different label" } as const;
    useRelayStore.getState().addAttachedItem(item2);

    // Should return the same reference because nothing changed (dedupe returned same array)
    expect(useRelayStore.getState().attachedItems).toBe(before);
    expect(useRelayStore.getState().attachedItems).toEqual([item1]);
  });

  it("holds a submitted prompt until it is cleared", () => {
    useRelayStore.getState().submitPrompt("Explain this response");
    expect(useRelayStore.getState().pendingPrompt).toBe("Explain this response");
    useRelayStore.getState().clearPendingPrompt();
    expect(useRelayStore.getState().pendingPrompt).toBeNull();
  });
});

describe("openWithDraft", () => {
  const chip = { kind: "request", id: "r1", label: "Get users" } as const;

  it("opens the dock, requests focus and holds the prefill and attaches the chips", () => {
    useRelayStore.getState().openWithDraft({ prompt: "Explain", chips: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.focusRequest).toBe(1);
    expect(state.composerPrefill).toBe("Explain");
    expect(state.attachedItems).toEqual([chip]);
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.open)).toBe("true");
  });

  it("does not attach a chip that is already attached", () => {
    useRelayStore.setState({ attachedItems: [chip] });
    useRelayStore.getState().openWithDraft({ prompt: "Explain", chips: [chip] });
    expect(useRelayStore.getState().attachedItems).toEqual([chip]);
  });

  it("clears the prefill once applied", () => {
    useRelayStore.getState().openWithDraft({ prompt: "Explain", chips: [] });
    useRelayStore.getState().clearComposerPrefill();
    expect(useRelayStore.getState().composerPrefill).toBeNull();
  });
});

describe("enabled and position preferences", () => {
  it("defaults to enabled on the right and hydrates from storage", async () => {
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().enabled).toBe(true);
    expect(useRelayStore.getState().position).toBe("right");

    localStorage.setItem(RELAY_STORAGE_KEYS.enabled, "false");
    localStorage.setItem(RELAY_STORAGE_KEYS.position, "left");
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().enabled).toBe(false);
    expect(useRelayStore.getState().position).toBe("left");
  });

  it("ignores an unknown stored position", async () => {
    localStorage.setItem(RELAY_STORAGE_KEYS.position, "top");
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().position).toBe("right");
  });

  it("persists changes", () => {
    useRelayStore.getState().setEnabled(false);
    useRelayStore.getState().setPosition("left");
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.enabled)).toBe("false");
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.position)).toBe("left");
    useRelayStore.setState({ enabled: true, position: "right" });
  });
});

describe("persisted payload shape", () => {
  it("is byte-for-byte unchanged when non-persisted fields change", () => {
    // Set persisted preferences to a known state.
    useRelayStore.getState().setOpen(true);
    useRelayStore.getState().setWidth(450);
    useRelayStore.getState().setEnabled(false);
    useRelayStore.getState().setPosition("left");
    const beforeSnapshot = serializeStorageKeys();

    // Attach and detach non-persisted items.
    useRelayStore.getState().addAttachedItem({ kind: "request", id: "r1", label: "Request 1" });
    useRelayStore.getState().removeAttachedItem("request:r1");

    // Verify persisted storage is unchanged.
    const afterSnapshot = serializeStorageKeys();
    expect(afterSnapshot).toBe(beforeSnapshot);
    expect(useRelayStore.getState().attachedItems).toEqual([]);
  });

  it("has the expected persisted key list", () => {
    useRelayStore.getState().setOpen(true);
    useRelayStore.getState().setWidth(450);
    useRelayStore.getState().setEnabled(false);
    useRelayStore.getState().setPosition("left");
    useRelayStore.getState().setShareValues(true);
    useRelayStore.getState().setActiveThreadId("t-1");

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    expect(keys.sort()).toEqual([
      "rq_relay_active_thread",
      "rq_relay_enabled",
      "rq_relay_open",
      "rq_relay_position",
      "rq_relay_share_values",
      "rq_relay_width",
    ]);
  });
});

describe("composerHasText", () => {
  it("defaults to false and follows setComposerHasText", () => {
    expect(useRelayStore.getState().composerHasText).toBe(false);
    useRelayStore.getState().setComposerHasText(true);
    expect(useRelayStore.getState().composerHasText).toBe(true);
    useRelayStore.getState().setComposerHasText(false);
    expect(useRelayStore.getState().composerHasText).toBe(false);
  });

  it("is transient: toggling it writes nothing to storage", () => {
    useRelayStore.getState().setOpen(true);
    useRelayStore.getState().setWidth(450);
    const before = serializeStorageKeys();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useRelayStore.getState().setComposerHasText(true);

    expect(setItem).not.toHaveBeenCalled();
    expect(serializeStorageKeys()).toBe(before);
  });
});

describe("permissionPopoverOpen", () => {
  it("defaults to closed and follows setPermissionPopoverOpen", () => {
    expect(useRelayStore.getState().permissionPopoverOpen).toBe(false);
    useRelayStore.getState().setPermissionPopoverOpen(true);
    expect(useRelayStore.getState().permissionPopoverOpen).toBe(true);
    useRelayStore.getState().setPermissionPopoverOpen(false);
    expect(useRelayStore.getState().permissionPopoverOpen).toBe(false);
  });

  it("is transient: toggling it writes nothing to storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useRelayStore.getState().setPermissionPopoverOpen(true);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("storage failures on removal and last-active lookup", () => {
  it("logs the key when removing the active thread pointer fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("denied");
      },
    });

    useRelayStore.getState().setActiveThreadId(null);

    expect(useRelayStore.getState().activeThreadId).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      "[relay] preference remove failed",
      expect.objectContaining({ key: RELAY_STORAGE_KEYS.activeThread }),
    );
  });

  it("hydrates with no active thread and logs when reading the last active thread fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(threadDb, "getLastActive").mockRejectedValueOnce(new Error("idb down"));

    await useRelayStore.getState().hydrate();

    expect(useRelayStore.getState().activeThreadId).toBeNull();
    expect(useRelayStore.getState().hydrated).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      "[relay] reading the last active thread failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});

describe("capabilitiesOpen and mentionRequest", () => {
  const request = { kind: "request" as const, hintKey: "slash.hint.request" };

  it("default to closed and empty, and follow their actions", () => {
    expect(useRelayStore.getState().capabilitiesOpen).toBe(false);
    expect(useRelayStore.getState().mentionRequest).toBeNull();
    useRelayStore.getState().setCapabilitiesOpen(true);
    useRelayStore.getState().requestMention(request);
    expect(useRelayStore.getState().capabilitiesOpen).toBe(true);
    expect(useRelayStore.getState().mentionRequest).toEqual(request);
    useRelayStore.getState().clearMentionRequest();
    expect(useRelayStore.getState().mentionRequest).toBeNull();
  });

  it("are transient: changing them writes nothing to storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useRelayStore.getState().setCapabilitiesOpen(true);
    useRelayStore.getState().requestMention(request);
    useRelayStore.getState().clearMentionRequest();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("mentionRequest is consumed once: clear leaves it null", () => {
    useRelayStore.getState().requestMention(request);
    expect(useRelayStore.getState().mentionRequest).toEqual(request);

    useRelayStore.getState().clearMentionRequest();
    expect(useRelayStore.getState().mentionRequest).toBeNull();

    // Clearing again has no effect
    useRelayStore.getState().clearMentionRequest();
    expect(useRelayStore.getState().mentionRequest).toBeNull();
  });

  it("mentionRequest is never persisted and hydrate leaves it null", async () => {
    useRelayStore.getState().requestMention(request);
    expect(useRelayStore.getState().mentionRequest).toEqual(request);

    // Reset to simulate a page reload
    resetStore();
    expect(useRelayStore.getState().mentionRequest).toBeNull();

    // Hydrate does not restore mentionRequest
    await useRelayStore.getState().hydrate();
    expect(useRelayStore.getState().mentionRequest).toBeNull();

    // No storage key was created for mentionRequest
    expect(localStorage.getItem("rq_relay_mention_request")).toBeNull();
  });

  it("mentionRequest with null kind for tab targets", () => {
    const tabRequest = { kind: null, hintKey: "slash.hint.tab" } as const;
    useRelayStore.getState().requestMention(tabRequest);
    expect(useRelayStore.getState().mentionRequest).toEqual(tabRequest);
  });
});
