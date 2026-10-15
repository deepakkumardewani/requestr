/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_DEFAULT_WIDTH_PX,
  RELAY_MAX_THREADS,
  RELAY_MIN_WIDTH_PX,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
} from "@/lib/relay/constants";
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
  getRelayMaxWidth,
  useRelayStore,
} from "./useRelayStore";

// No browser storage in these tests: threads live in the in-memory fallback.
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const VIEWPORT_PX = 1000;
const MAX_AT_VIEWPORT_PX = 600;

function resetStore() {
  useRelayStore.setState({
    open: false,
    width: RELAY_DEFAULT_WIDTH_PX,
    activeThreadId: null,
    hydrated: false,
    prunedNotice: false,
    draftChips: [],
    shareValues: false,
    removedChipKeys: [],
    attachedItems: [],
    dismissedAutoChipTabId: null,
    pendingPrompt: null,
    composerPrefill: null,
    focusRequest: 0,
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
  it("computes 60vw as the maximum", () => {
    expect(getRelayMaxWidth(VIEWPORT_PX)).toBe(MAX_AT_VIEWPORT_PX);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampRelayWidth(10)).toBe(RELAY_MIN_WIDTH_PX);
    expect(clampRelayWidth(5000)).toBe(MAX_AT_VIEWPORT_PX);
  });

  it("keeps an in-range width and rounds fractions", () => {
    expect(clampRelayWidth(450.4)).toBe(450);
  });

  it("falls back to the default for a non-finite width", () => {
    expect(clampRelayWidth(Number.NaN)).toBe(RELAY_DEFAULT_WIDTH_PX);
  });

  it("never returns less than the minimum on a tiny viewport", () => {
    expect(clampRelayWidth(400, 400)).toBe(RELAY_MIN_WIDTH_PX);
  });
});

describe("useRelayStore", () => {
  it("starts closed at the default width with no thread or chips", () => {
    const state = useRelayStore.getState();
    expect(state.open).toBe(false);
    expect(state.width).toBe(RELAY_DEFAULT_WIDTH_PX);
    expect(state.activeThreadId).toBeNull();
    expect(state.draftChips).toEqual([]);
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
    expect(useRelayStore.getState().width).toBe(RELAY_MIN_WIDTH_PX);
  });

  describe("hydrate", () => {
    it("restores open and width after the store is re-created", async () => {
      useRelayStore.getState().setOpen(true);
      useRelayStore.getState().setWidth(500);

      // Not vi.resetModules(): a re-imported store would lazy-load a second thread DB.
      useRelayStore.setState({ open: false, width: RELAY_DEFAULT_WIDTH_PX });
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
      expect(useRelayStore.getState().width).toBe(RELAY_DEFAULT_WIDTH_PX);
    });

    it("clamps a stored width that is out of range", () => {
      localStorage.setItem(RELAY_STORAGE_KEYS.width, "9999");
      useRelayStore.getState().hydrate();
      expect(useRelayStore.getState().width).toBe(MAX_AT_VIEWPORT_PX);
    });

    it.each(["", "   ", "abc"])(
      "falls back to the default for corrupt width %j",
      (value) => {
        localStorage.setItem(RELAY_STORAGE_KEYS.width, value);
        useRelayStore.getState().hydrate();
        expect(useRelayStore.getState().width).toBe(RELAY_DEFAULT_WIDTH_PX);
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
      expect(useRelayStore.getState().width).toBe(RELAY_DEFAULT_WIDTH_PX);
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

    it("newThread clears manual attachments and dismissals", async () => {
      useRelayStore.setState({
        attachedItems: [{ kind: "request", id: "r1", label: "R" }],
        removedChipKeys: ["request:r1"],
        dismissedAutoChipTabId: "t1",
      });

      await useRelayStore.getState().newThread();

      const state = useRelayStore.getState();
      expect(state.attachedItems).toEqual([]);
      expect(state.removedChipKeys).toEqual([]);
      expect(state.dismissedAutoChipTabId).toBeNull();
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
  it("records removed chips once and resets them", () => {
    const { removeChip, resetRemovedChips } = useRelayStore.getState();
    removeChip("request:r1");
    removeChip("request:r1");
    removeChip("environment:e1");
    expect(useRelayStore.getState().removedChipKeys).toEqual(["request:r1", "environment:e1"]);
    resetRemovedChips();
    expect(useRelayStore.getState().removedChipKeys).toEqual([]);
  });

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

  it("dismissing the auto chip removes it for this turn only", () => {
    useRelayStore.getState().dismissAutoChip("t1", "request:r1");
    useRelayStore.getState().dismissAutoChip("t1", "request:r1");
    expect(useRelayStore.getState().dismissedAutoChipTabId).toBe("t1");
    expect(useRelayStore.getState().removedChipKeys).toEqual(["request:r1"]);
    useRelayStore.getState().resetRemovedChips();
    expect(useRelayStore.getState().dismissedAutoChipTabId).toBeNull();
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

  it("opens the dock, requests focus and holds the prefill and chips", () => {
    useRelayStore.getState().openWithDraft({ prompt: "Explain", chips: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.focusRequest).toBe(1);
    expect(state.composerPrefill).toBe("Explain");
    expect(state.draftChips).toEqual([chip]);
    expect(localStorage.getItem(RELAY_STORAGE_KEYS.open)).toBe("true");
  });

  it("restores a previously removed chip but keeps other removals", () => {
    useRelayStore.setState({ removedChipKeys: ["request:r1", "environment:e1"] });
    useRelayStore.getState().openWithDraft({ prompt: "Explain", chips: [chip] });
    expect(useRelayStore.getState().removedChipKeys).toEqual(["environment:e1"]);
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

    // Add non-persisted fields and dismiss auto chip.
    useRelayStore.getState().addAttachedItem({ kind: "request", id: "r1", label: "Request 1" });
    useRelayStore.getState().dismissAutoChip("t1", "request:r2");
    useRelayStore.getState().removeAttachedItem("request:r1");

    // Verify persisted storage is unchanged.
    const afterSnapshot = serializeStorageKeys();
    expect(afterSnapshot).toBe(beforeSnapshot);
    expect(useRelayStore.getState().attachedItems).toEqual([]);
    expect(useRelayStore.getState().dismissedAutoChipTabId).toBe("t1");
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
