/** @vitest-environment happy-dom */
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RUNS_PER_CHAIN, type RunStep } from "@/lib/chainRunHistory";
import { getDB } from "@/lib/idb";
import { useChainRunStore } from "./useChainRunStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const CHAIN_ID = "chain-1";

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: `step-${Math.random()}`,
    nodeId: "node-1",
    nodeType: "api",
    label: "GET /users",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 10,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const store = {
    index: vi.fn(() => ({ getAll: vi.fn(async () => []) })),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const tx = { store, done: Promise.resolve() };
  return {
    transaction: vi.fn(() => tx),
    getAllFromIndex: vi.fn(async () => []),
    delete: vi.fn(async () => undefined),
    ...overrides,
  };
}

const INITIAL_STATE = {
  runs: {},
  activeRun: null,
  selectedRunId: null,
  selectedStepId: null,
  runsLoading: false,
  runsError: null,
  syncSource: null,
} as const;

describe("useChainRunStore", () => {
  beforeEach(() => {
    useChainRunStore.setState(INITIAL_STATE);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(makeDb() as never));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("startRun creates an activeRun and selects it", () => {
    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    const { activeRun, selectedRunId } = useChainRunStore.getState();
    expect(activeRun).not.toBeNull();
    expect(activeRun?.chainId).toBe(CHAIN_ID);
    expect(activeRun?.status).toBe("running");
    expect(selectedRunId).toBe(activeRun?.id);
  });

  it("recordStep appends to the in-memory activeRun only, without touching IDB", () => {
    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    useChainRunStore.getState().recordStep(makeStep({ id: "s1" }));
    useChainRunStore.getState().recordStep(makeStep({ id: "s2" }));

    expect(useChainRunStore.getState().activeRun?.steps).toHaveLength(2);
    expect(getDB).not.toHaveBeenCalled();
  });

  it("recordStep upserts by id, replacing a running row with its terminal state in place", () => {
    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    useChainRunStore
      .getState()
      .recordStep(makeStep({ id: "node-1", state: "running", durationMs: 0 }));
    useChainRunStore
      .getState()
      .recordStep(makeStep({ id: "other", state: "running", durationMs: 0 }));
    useChainRunStore
      .getState()
      .recordStep(makeStep({ id: "node-1", state: "passed", durationMs: 42 }));

    const { steps } = useChainRunStore.getState().activeRun!;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: "node-1", state: "passed", durationMs: 42 });
    expect(steps[1]).toMatchObject({ id: "other", state: "running" });
  });

  it("recordStep is a no-op when there is no activeRun", () => {
    useChainRunStore.getState().recordStep(makeStep());
    expect(useChainRunStore.getState().activeRun).toBeNull();
  });

  it("finishRun writes exactly one IDB record for the whole run, not per step", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    useChainRunStore.getState().recordStep(makeStep({ id: "s1", state: "passed" }));
    useChainRunStore.getState().recordStep(makeStep({ id: "s2", state: "failed" }));

    await useChainRunStore.getState().finishRun("failed");

    const tx = db.transaction.mock.results[0].value;
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.store.put).toHaveBeenCalledTimes(1);

    const { activeRun, runs } = useChainRunStore.getState();
    expect(activeRun).toBeNull();
    expect(runs[CHAIN_ID]).toHaveLength(1);
    expect(runs[CHAIN_ID][0].counts).toEqual({
      passed: 1,
      failed: 1,
      skipped: 0,
      aborted: 0,
    });
    expect(runs[CHAIN_ID][0].status).toBe("failed");
  });

  it("finishRun is a no-op when there is no activeRun", async () => {
    await useChainRunStore.getState().finishRun("passed");
    expect(getDB).not.toHaveBeenCalled();
  });

  it("finishRun toasts and does not throw when persistence fails", async () => {
    const db = makeDb();
    db.transaction = vi.fn(() => {
      throw new Error("boom");
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    await expect(
      useChainRunStore.getState().finishRun("passed"),
    ).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
  });

  it("loadRuns sets runsLoading then populates runs on success", async () => {
    const persisted = [
      {
        id: "run-1",
        chainId: CHAIN_ID,
        startedAt: 1,
        status: "passed" as const,
        trigger: "full" as const,
        counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
        bytes: 10,
        schemaVersion: 1 as const,
        steps: [],
      },
    ];
    const db = makeDb({ getAllFromIndex: vi.fn(async () => persisted) });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    const promise = useChainRunStore.getState().loadRuns(CHAIN_ID);
    expect(useChainRunStore.getState().runsLoading).toBe(true);
    await promise;

    expect(useChainRunStore.getState().runsLoading).toBe(false);
    expect(useChainRunStore.getState().runsError).toBeNull();
    expect(useChainRunStore.getState().runs[CHAIN_ID]).toEqual(persisted);
  });

  it("loadRuns sets runsError on failure", async () => {
    const db = makeDb({
      getAllFromIndex: vi.fn(async () => {
        throw new Error("load failed");
      }),
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useChainRunStore.getState().loadRuns(CHAIN_ID);

    expect(useChainRunStore.getState().runsLoading).toBe(false);
    expect(useChainRunStore.getState().runsError).toBe("load failed");
  });

  it("deleteRun removes a run from IDB and state", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-1",
            chainId: CHAIN_ID,
            startedAt: 1,
            status: "passed",
            trigger: "full",
            counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
            bytes: 1,
            schemaVersion: 1,
            steps: [],
          },
        ],
      },
      selectedRunId: "run-1",
    });

    await useChainRunStore.getState().deleteRun(CHAIN_ID, "run-1");

    expect(db.delete).toHaveBeenCalledWith("chainRuns", "run-1");
    expect(useChainRunStore.getState().runs[CHAIN_ID]).toHaveLength(0);
    expect(useChainRunStore.getState().selectedRunId).toBeNull();
  });

  it("deleteRun toasts and does not throw when IDB deletion fails", async () => {
    const db = makeDb({
      delete: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useChainRunStore.getState().deleteRun(CHAIN_ID, "run-1");

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to delete run",
      expect.objectContaining({ description: "boom" }),
    );
  });

  it("clearRuns removes every run for the chain", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-1",
            chainId: CHAIN_ID,
            startedAt: 1,
            status: "passed",
            trigger: "full",
            counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
            bytes: 1,
            schemaVersion: 1,
            steps: [],
          },
          {
            id: "run-2",
            chainId: CHAIN_ID,
            startedAt: 2,
            status: "passed",
            trigger: "full",
            counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
            bytes: 1,
            schemaVersion: 1,
            steps: [],
          },
        ],
      },
    });

    await useChainRunStore.getState().clearRuns(CHAIN_ID);

    expect(db.delete).toHaveBeenCalledTimes(2);
    expect(useChainRunStore.getState().runs[CHAIN_ID]).toEqual([]);
  });

  it("selectRun sets selectedRunId and clears selectedStepId", () => {
    useChainRunStore.setState({ selectedStepId: "step-1" });
    useChainRunStore.getState().selectRun("run-2");
    expect(useChainRunStore.getState().selectedRunId).toBe("run-2");
    expect(useChainRunStore.getState().selectedStepId).toBeNull();
  });

  it("selectStep sets selectedStepId and syncSource", () => {
    useChainRunStore.getState().selectStep("step-1", "timeline");
    expect(useChainRunStore.getState().selectedStepId).toBe("step-1");
    expect(useChainRunStore.getState().syncSource).toBe("timeline");
  });

  it("finishRun prunes by MAX_RUNS_PER_CHAIN in the in-memory runs map", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    const existing = Array.from({ length: MAX_RUNS_PER_CHAIN }, (_, i) => ({
      id: `run-${i}`,
      chainId: CHAIN_ID,
      startedAt: i,
      status: "passed" as const,
      trigger: "full" as const,
      counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
      bytes: 10,
      schemaVersion: 1 as const,
      steps: [],
    }));
    useChainRunStore.setState({ runs: { [CHAIN_ID]: existing } });

    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    await useChainRunStore.getState().finishRun("passed");

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs).toHaveLength(MAX_RUNS_PER_CHAIN);
    expect(runs.map((r) => r.id)).not.toContain("run-0");
  });

  it("handleChainDeleted aborts an in-flight run for that chain and purges its history", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-old",
            chainId: CHAIN_ID,
            startedAt: 1,
            status: "passed",
            trigger: "full",
            counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
            bytes: 1,
            schemaVersion: 1,
            steps: [],
          },
        ],
      },
    });
    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    useChainRunStore.getState().recordStep(makeStep());

    await useChainRunStore.getState().handleChainDeleted(CHAIN_ID);

    expect(useChainRunStore.getState().activeRun).toBeNull();
    expect(useChainRunStore.getState().runs[CHAIN_ID]).toBeUndefined();
    expect(db.delete).toHaveBeenCalledWith("chainRuns", "run-old");
  });

  it("handleChainDeleted is a no-op for a chain with no runs", async () => {
    await expect(
      useChainRunStore.getState().handleChainDeleted("unknown-chain"),
    ).resolves.toBeUndefined();
    expect(useChainRunStore.getState().runs["unknown-chain"]).toBeUndefined();
  });

  it("beforeunload flushes an in-flight run as stopped, best-effort", async () => {
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    useChainRunStore.getState().startRun(CHAIN_ID, "full");
    useChainRunStore.getState().recordStep(makeStep());

    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();
    await Promise.resolve();

    expect(db.transaction).toHaveBeenCalledWith("chainRuns", "readwrite");
  });

  it("beforeunload is a no-op when there is no active run", () => {
    useChainRunStore.setState({ activeRun: null });
    expect(() => window.dispatchEvent(new Event("beforeunload"))).not.toThrow();
  });
});
