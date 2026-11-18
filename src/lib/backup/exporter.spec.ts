/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { version as APP_VERSION } from "../../../package.json";
import { IDB_VERSION } from "../idbSchema";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION } from "./constants";
import {
  collectBackupData,
  normalizeSections,
  prepareBackup,
  SECTION_LISTS,
  toBackupBlob,
} from "./exporter";
import { BACKUP_PREFERENCE_KEYS } from "./preferences";

type Stores = Record<string, unknown[]>;

const mocks = vi.hoisted(() => ({
  stores: {} as Record<string, unknown[]>,
  settings: undefined as unknown,
}));

vi.mock("../idb", () => ({
  getLooseDB: async () => ({
    getAll: async (store: string) => mocks.stores[store] ?? [],
    get: async (store: string, key: string) =>
      store === "settings" && key === "app" ? mocks.settings : undefined,
  }),
}));

const seed = (stores: Stores, settings?: unknown) => {
  mocks.stores = stores;
  mocks.settings = settings;
};

const STORES: Stores = {
  collections: [{ id: "c1" }, { id: "c2" }],
  folders: [{ id: "f1", collectionId: "c1" }],
  requests: [{ id: "r1", collectionId: "c1", folderId: "f1" }],
  chainConfigs: [{ id: "cc1", collectionId: "c2" }],
  environments: [{ id: "e1", variables: [] }],
  chains: [{ id: "h1" }],
  history: [{ id: "x1" }],
  chainRuns: [{ id: "run1", chainId: "h1" }],
  relay_threads: [{ id: "t1" }],
  relay_changes: [{ id: "ch1" }, { id: "ch2" }],
};

beforeEach(() => {
  localStorage.clear();
  seed(STORES, { theme: "dark" });
});

describe("normalizeSections", () => {
  it("returns canonical order regardless of input order", () => {
    expect(normalizeSections(["history", "collections"])).toEqual([
      "collections",
      "history",
    ]);
  });

  it("adds preferences exactly when settings is present", () => {
    expect(normalizeSections(["settings"])).toEqual([
      "settings",
      "preferences",
    ]);
  });

  it("drops a lone preferences request", () => {
    expect(normalizeSections(["preferences"])).toEqual([]);
  });

  it("dedupes and handles empty input", () => {
    expect(normalizeSections(["chains", "chains"])).toEqual(["chains"]);
    expect(normalizeSections([])).toEqual([]);
  });
});

describe("SECTION_LISTS", () => {
  it("maps sections to the stores they mirror", () => {
    expect(SECTION_LISTS.collections?.map((l) => l.store)).toEqual([
      "collections",
      "folders",
      "requests",
      "chainConfigs",
    ]);
    expect(SECTION_LISTS.relayThreads).toEqual([
      { dataKey: "relayThreads", store: "relay_threads" },
      { dataKey: "relayChanges", store: "relay_changes" },
    ]);
  });
});

describe("collectBackupData", () => {
  it("reads every store of the collections section under its data key", async () => {
    const data = await collectBackupData(["collections"]);
    expect(data).toEqual({
      collections: STORES.collections,
      folders: STORES.folders,
      requests: STORES.requests,
      chainConfigs: STORES.chainConfigs,
    });
  });

  it("reads history together with chain runs", async () => {
    expect(await collectBackupData(["history"])).toEqual({
      history: STORES.history,
      chainRuns: STORES.chainRuns,
    });
  });

  it("maps relay stores to relayThreads and relayChanges", async () => {
    expect(await collectBackupData(["relayThreads"])).toEqual({
      relayThreads: STORES.relay_threads,
      relayChanges: STORES.relay_changes,
    });
  });

  it("reads settings and the allow-listed preferences", async () => {
    const key = BACKUP_PREFERENCE_KEYS[0];
    localStorage.setItem(key, "value");
    localStorage.setItem("unrelated", "nope");
    expect(await collectBackupData(["settings"])).toEqual({
      settings: { theme: "dark" },
      preferences: { [key]: "value" },
    });
  });

  it("falls back to an empty settings object when none is stored", async () => {
    seed(STORES, undefined);
    expect((await collectBackupData(["settings"])).settings).toEqual({});
  });

  it("returns an empty object for no sections and omits unrequested keys", async () => {
    expect(await collectBackupData([])).toEqual({});
    expect(await collectBackupData(["chains"])).toEqual({
      chains: STORES.chains,
    });
  });

  it("returns empty lists for empty stores", async () => {
    seed({});
    expect(await collectBackupData(["environments"])).toEqual({
      environments: [],
    });
  });
});

describe("prepareBackup", () => {
  const NOW = new Date("2026-03-04T05:06:07.000Z");

  it("builds the envelope with the requested, normalised sections", async () => {
    const { envelope } = await prepareBackup(
      { sections: ["settings", "collections"], includeSecrets: false },
      NOW
    );
    expect(envelope).toEqual({
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      idbVersion: IDB_VERSION,
      exportedAt: "2026-03-04T05:06:07.000Z",
      appVersion: APP_VERSION,
      includesSecrets: false,
      sections: ["collections", "settings", "preferences"],
    });
  });

  it("keeps envelope sections and data keys in parity", async () => {
    const { envelope, data } = await prepareBackup(
      {
        sections: ["collections", "history", "relayThreads", "settings"],
        includeSecrets: true,
      },
      NOW
    );
    expect(Object.keys(data).sort()).toEqual(
      [
        "chainConfigs",
        "chainRuns",
        "collections",
        "folders",
        "history",
        "preferences",
        "relayChanges",
        "relayThreads",
        "requests",
        "settings",
      ].sort()
    );
    expect(envelope.sections).toEqual([
      "collections",
      "history",
      "settings",
      "preferences",
      "relayThreads",
    ]);
  });

  it("applies the selection and reports dangling references", async () => {
    const prepared = await prepareBackup(
      {
        sections: ["collections"],
        selection: { collectionIds: ["c1"] },
        includeSecrets: true,
      },
      NOW
    );
    expect(prepared.data.collections).toEqual([{ id: "c1" }]);
    expect(prepared.data.chainConfigs).toEqual([]);
    expect(prepared.danglingCount).toBe(0);
    expect(prepared.estimate.counts.collections).toBe(1);
  });

  it("counts references to unselected items", async () => {
    seed({
      ...STORES,
      requests: [
        { id: "r1", collectionId: "c1" },
        { id: "r2", collectionId: "c2" },
      ],
    });
    const { danglingCount } = await prepareBackup(
      {
        sections: ["collections"],
        selection: { collectionIds: ["c1", "c2"] },
        includeSecrets: true,
      },
      NOW
    );
    expect(danglingCount).toBe(0);
    const orphaned = await prepareBackup(
      {
        sections: ["collections"],
        selection: { collectionIds: ["c1"] },
        includeSecrets: true,
      },
      NOW
    );
    expect(orphaned.danglingCount).toBe(0);
  });

  it("blanks secrets unless includeSecrets is set", async () => {
    seed(STORES, {
      globalHeaders: [{ key: "Authorization", value: "Bearer abc" }],
    });
    const blanked = await prepareBackup(
      { sections: ["settings"], includeSecrets: false },
      NOW
    );
    const kept = await prepareBackup(
      { sections: ["settings"], includeSecrets: true },
      NOW
    );
    expect(blanked.data.settings).toEqual({
      globalHeaders: [{ key: "Authorization", value: "" }],
    });
    expect(blanked.envelope.includesSecrets).toBe(false);
    expect(kept.data.settings).toEqual({
      globalHeaders: [{ key: "Authorization", value: "Bearer abc" }],
    });
    expect(kept.envelope.includesSecrets).toBe(true);
  });

  it("estimates size and counts from the final data", async () => {
    const { estimate, data } = await prepareBackup(
      { sections: ["chains", "environments"], includeSecrets: true },
      NOW
    );
    expect(estimate.counts).toEqual({ environments: 1, chains: 1 });
    expect(estimate.bytes).toBe(
      new Blob([JSON.stringify(data.environments)]).size +
        new Blob([JSON.stringify(data.chains)]).size
    );
  });

  it("defaults the timestamp to the current clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-02T03:04:05.000Z"));
    try {
      const { envelope } = await prepareBackup({
        sections: ["chains"],
        includeSecrets: true,
      });
      expect(envelope.exportedAt).toBe("2030-01-02T03:04:05.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("toBackupBlob", () => {
  it("serialises to JSON equal to envelope plus data", async () => {
    const prepared = await prepareBackup(
      { sections: ["collections", "chains"], includeSecrets: true },
      new Date("2026-01-01T00:00:00.000Z")
    );
    const blob = toBackupBlob(prepared);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual({
      ...prepared.envelope,
      data: prepared.data,
    });
  });

  it("produces a valid file for empty data", async () => {
    const prepared = await prepareBackup(
      { sections: [], includeSecrets: false },
      new Date("2026-01-01T00:00:00.000Z")
    );
    const parsed = JSON.parse(await toBackupBlob(prepared).text());
    expect(parsed.data).toEqual({});
    expect(parsed.sections).toEqual([]);
  });
});
