/** @vitest-environment happy-dom */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

type BroadcastModule = typeof import("./broadcast");

const CHANNEL = "requestr-backup-restore";
/**
 * In-memory stand-in for BroadcastChannel: the real one delivers across
 * threads, so messages from a finished test can land in the next one.
 */
const registry = new Map<string, Set<FakeBroadcastChannel>>();

class FakeBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  private closed = false;

  constructor(private readonly name: string) {
    const peers = registry.get(name) ?? new Set();
    peers.add(this);
    registry.set(name, peers);
  }

  postMessage(data: unknown): void {
    for (const peer of registry.get(this.name) ?? []) {
      if (peer === this) continue;
      queueMicrotask(() => {
        if (!peer.closed) peer.onmessage?.({ data });
      });
    }
  }

  close(): void {
    this.closed = true;
    registry.get(this.name)?.delete(this);
  }
}

async function load(): Promise<BroadcastModule> {
  vi.resetModules();
  return import("./broadcast");
}

/** A second "tab": a raw channel on the same name. */
function otherTab(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL);
}

describe("backup broadcast", () => {
  let reload: MockInstance<() => void>;

  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
  });

  afterEach(() => {
    registry.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("broadcastRestore tells other tabs the workspace was restored", async () => {
    const { broadcastRestore } = await load();
    const received = new Promise<unknown>((resolve) => {
      otherTab().onmessage = (event) => resolve(event.data);
    });

    broadcastRestore();

    const message = (await received) as { type: string; senderId: string };
    expect(message.type).toBe("restored");
    expect(message.senderId).toEqual(expect.any(String));
  });

  it("reloadWorkspace reloads the current window", async () => {
    const { reloadWorkspace } = await load();

    reloadWorkspace();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads when another tab restores", async () => {
    const { listenForRestore } = await load();
    listenForRestore();

    otherTab().postMessage({ type: "restored", senderId: "another-tab" });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("does not reload for its own restore broadcast", async () => {
    const { listenForRestore, broadcastRestore } = await load();
    listenForRestore();

    broadcastRestore();
    // Channel messages arrive in order, so once the foreign one is handled the own one was too.
    otherTab().postMessage({ type: "restored", senderId: "another-tab" });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("ignores messages of another type", async () => {
    const { listenForRestore } = await load();
    listenForRestore();

    const sender = otherTab();
    sender.postMessage({ type: "something-else", senderId: "another-tab" });
    sender.postMessage(null);
    sender.postMessage({ type: "restored", senderId: "another-tab" });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("registers a single listener when called more than once", async () => {
    const { listenForRestore } = await load();
    listenForRestore();
    listenForRestore();

    const sender = otherTab();
    sender.postMessage({ type: "restored", senderId: "another-tab" });
    sender.postMessage({ type: "restored", senderId: "another-tab-2" });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it("does nothing where BroadcastChannel is unsupported, and can listen later", async () => {
    const { listenForRestore } = await load();
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(() => listenForRestore()).not.toThrow();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

    listenForRestore();
    otherTab().postMessage({ type: "restored", senderId: "another-tab" });

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});
