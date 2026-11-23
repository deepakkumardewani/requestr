/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { type PromptId, usePromptStore } from "./usePromptStore";

const flush = () => act(async () => {});
const store = () => usePromptStore.getState();

/** Fake prompt: requests the slot on mount and releases it on unmount, like a real prompt component. */
function useFakePrompt(id: PromptId) {
  useEffect(() => {
    usePromptStore.getState().request(id);
    return () => usePromptStore.getState().release(id);
  }, [id]);
  return usePromptStore((state) => state.active === id);
}

beforeEach(() => {
  usePromptStore.setState({
    active: null,
    current: null,
    queue: [],
    nextSeq: 0,
  });
});

describe("usePromptStore request", () => {
  it("starts with a free slot", () => {
    expect(store().active).toBeNull();
    expect(store().queue).toEqual([]);
  });

  it("grants a lone request after the tick", async () => {
    store().request("feedback");
    expect(store().active).toBeNull();
    await flush();
    expect(store().active).toBe("feedback");
  });

  it("grants the highest priority among same-tick requests regardless of order", async () => {
    store().request("feedback");
    store().request("whats-new");
    store().request("tour");
    await flush();
    expect(store().active).toBe("tour");
    expect(store().queue.map((entry) => entry.id)).toEqual([
      "whats-new",
      "feedback",
    ]);
  });

  it("gives the same winner for the reverse request order", async () => {
    store().request("tour");
    store().request("whats-new");
    store().request("feedback");
    await flush();
    expect(store().active).toBe("tour");
  });

  it("honours an explicit priority over the default rank", async () => {
    store().request("tour");
    store().request("feedback", { priority: 100 });
    await flush();
    expect(store().active).toBe("feedback");
  });

  it("breaks priority ties by request order", async () => {
    store().request("backup-nudge", { priority: 5 });
    store().request("whats-new", { priority: 5 });
    await flush();
    expect(store().active).toBe("backup-nudge");
  });

  it("ranks the unlisted relay-coach id lowest by default", async () => {
    store().request("relay-coach");
    store().request("feedback");
    await flush();
    expect(store().active).toBe("feedback");
  });

  it("ignores duplicate requests for the active prompt", async () => {
    store().request("tour");
    await flush();
    store().request("tour");
    expect(store().queue).toEqual([]);
  });

  it("ignores duplicate requests for a queued prompt", async () => {
    store().request("tour");
    store().request("feedback");
    store().request("feedback");
    await flush();
    expect(store().queue).toHaveLength(1);
  });

  it("queues a request behind the active prompt without taking the slot", async () => {
    store().request("feedback");
    await flush();
    store().request("tour");
    await flush();
    expect(store().active).toBe("feedback");
    expect(store().queue.map((entry) => entry.id)).toEqual(["tour"]);
  });
});

describe("usePromptStore release", () => {
  it("hands the slot to the next queued prompt by priority", async () => {
    store().request("tour");
    store().request("feedback");
    store().request("whats-new");
    await flush();
    store().release("tour");
    expect(store().active).toBe("whats-new");
    store().release("whats-new");
    expect(store().active).toBe("feedback");
    store().release("feedback");
    expect(store().active).toBeNull();
    expect(store().current).toBeNull();
  });

  it("removes a queued prompt without touching the active one", async () => {
    store().request("tour");
    store().request("feedback");
    await flush();
    store().release("feedback");
    expect(store().active).toBe("tour");
    expect(store().queue).toEqual([]);
  });

  it("is a no-op for an id that was never requested", async () => {
    store().request("tour");
    await flush();
    store().release("backup-nudge");
    expect(store().active).toBe("tour");
  });

  it("does not deadlock when releasing on an empty store", () => {
    store().release("tour");
    expect(store().active).toBeNull();
  });
});

describe("usePromptStore openUserInitiated", () => {
  it("takes the slot immediately when free", () => {
    store().openUserInitiated("relay-coach");
    expect(store().active).toBe("relay-coach");
  });

  it("preempts an auto prompt and re-queues it", async () => {
    store().request("tour");
    await flush();
    store().openUserInitiated("relay-coach");
    expect(store().active).toBe("relay-coach");
    expect(store().queue.map((entry) => entry.id)).toEqual(["tour"]);
  });

  it("restores the preempted prompt on release", async () => {
    store().request("tour");
    await flush();
    store().openUserInitiated("relay-coach");
    store().release("relay-coach");
    expect(store().active).toBe("tour");
  });

  it("does not re-queue a preempting prompt that is itself user-initiated", () => {
    store().openUserInitiated("relay-coach");
    store().openUserInitiated("feedback");
    expect(store().active).toBe("feedback");
    expect(store().queue).toEqual([]);
  });

  it("is a no-op when the id is already active", async () => {
    store().openUserInitiated("relay-coach");
    const before = store().current;
    store().openUserInitiated("relay-coach");
    expect(store().current).toBe(before);
  });

  it("keeps a user-initiated prompt when it opens before a pending grant runs", async () => {
    store().request("tour");
    store().openUserInitiated("relay-coach");
    await flush();
    expect(store().active).toBe("relay-coach");
    expect(store().queue.map((entry) => entry.id)).toEqual(["tour"]);
  });

  it("removes a queued duplicate of the same id when promoting it", async () => {
    store().request("tour");
    store().request("feedback");
    await flush();
    store().openUserInitiated("feedback");
    expect(store().active).toBe("feedback");
    expect(store().queue.map((entry) => entry.id)).toEqual(["tour"]);
  });

  it("keeps a preempted prompt ahead of lower-priority ones in the queue", async () => {
    store().request("tour");
    store().request("feedback");
    await flush();
    store().openUserInitiated("relay-coach");
    store().release("relay-coach");
    expect(store().active).toBe("tour");
  });

  it("does not re-queue an auto prompt that was marked non-auto", async () => {
    store().request("tour", { auto: false });
    await flush();
    store().openUserInitiated("relay-coach");
    expect(store().queue).toEqual([]);
  });
});

describe("usePromptStore with fake prompts", () => {
  it("lets only the higher priority prompt show when two mount together", async () => {
    const low = renderHook(() => useFakePrompt("feedback"));
    const high = renderHook(() => useFakePrompt("tour"));
    await flush();
    expect(high.result.current).toBe(true);
    expect(low.result.current).toBe(false);
  });

  it("releases the slot on unmount so the next prompt shows", async () => {
    const low = renderHook(() => useFakePrompt("feedback"));
    const high = renderHook(() => useFakePrompt("tour"));
    await flush();
    high.unmount();
    await flush();
    expect(low.result.current).toBe(true);
  });

  it("drops a queued prompt that unmounts before being granted", async () => {
    const high = renderHook(() => useFakePrompt("tour"));
    const low = renderHook(() => useFakePrompt("feedback"));
    await flush();
    low.unmount();
    high.unmount();
    await flush();
    expect(store().active).toBeNull();
    expect(store().queue).toEqual([]);
  });
});
