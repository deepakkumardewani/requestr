import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import type { EnvironmentModel } from "@/types";
import { useEnvironmentsStore } from "./useEnvironmentsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const STORAGE_KEY = "requestly_active_env_id";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    _map: m,
  };
}

describe("useEnvironmentsStore", () => {
  const ls = memoryStorage();

  beforeEach(() => {
    useEnvironmentsStore.setState({
      environments: [],
      activeEnvId: null,
      hydrated: false,
    });
    ls._map.clear();
    vi.stubGlobal("localStorage", ls);
    vi.mocked(getDB).mockReturnValue(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createEnv appends environment", () => {
    const e = useEnvironmentsStore.getState().createEnv("Dev");
    expect(e.name).toBe("Dev");
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1);
  });

  it("importEnv adds full env model", () => {
    const env: EnvironmentModel = {
      id: "imp",
      name: "Imp",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.getState().importEnv(env);
    expect(useEnvironmentsStore.getState().environments[0]).toEqual(env);
  });

  it("updateEnv merges patch", () => {
    const { id } = useEnvironmentsStore.getState().createEnv("A");
    useEnvironmentsStore.getState().updateEnv(id, { name: "B" });
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("B");
  });

  it("deleteEnv removes and clears active when it was active", () => {
    const { id } = useEnvironmentsStore.getState().createEnv("E");
    useEnvironmentsStore.getState().setActiveEnv(id);
    useEnvironmentsStore.getState().deleteEnv(id);
    expect(useEnvironmentsStore.getState().environments).toHaveLength(0);
    expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
  });

  it("setActiveEnv persists id to localStorage", () => {
    const { id } = useEnvironmentsStore.getState().createEnv("E");
    useEnvironmentsStore.getState().setActiveEnv(id);
    expect(ls.getItem(STORAGE_KEY)).toBe(id);
  });

  it("setActiveEnv null clears storage", () => {
    const { id } = useEnvironmentsStore.getState().createEnv("E");
    useEnvironmentsStore.getState().setActiveEnv(id);
    useEnvironmentsStore.getState().setActiveEnv(null);
    expect(ls.getItem(STORAGE_KEY)).toBeNull();
  });

  it("resolveVariables uses currentValue then initialValue", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [
        {
          id: "v1",
          key: "host",
          initialValue: "old.example",
          currentValue: "https://new.example",
          isSecret: false,
        },
        {
          id: "v2",
          key: "path",
          initialValue: "/api",
          currentValue: "",
          isSecret: false,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: env.id });
    const out = useEnvironmentsStore
      .getState()
      .resolveVariables("{{host}}{{path}}");
    expect(out).toBe("https://new.example/api");
  });

  it("resolveVariables returns template when no active env", () => {
    const t = "{{x}}";
    expect(useEnvironmentsStore.getState().resolveVariables(t)).toBe(t);
  });

  it("getVariable returns merged value", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [
        {
          id: "v1",
          key: "k",
          initialValue: "a",
          currentValue: "b",
          isSecret: false,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: env.id });
    expect(useEnvironmentsStore.getState().getVariable("k")).toBe("b");
  });

  it("getVariable returns undefined for missing key", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: env.id });
    expect(
      useEnvironmentsStore.getState().getVariable("missing"),
    ).toBeUndefined();
  });

  it("setVariable updates existing key", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [
        {
          id: "v1",
          key: "token",
          initialValue: "a",
          currentValue: "",
          isSecret: false,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: env.id });
    useEnvironmentsStore.getState().setVariable("token", "secret");
    const vars = useEnvironmentsStore.getState().environments[0].variables;
    expect(vars.find((v) => v.key === "token")?.currentValue).toBe("secret");
  });

  it("setVariable adds new key when absent", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: env.id });
    useEnvironmentsStore.getState().setVariable("newk", "v");
    const vars = useEnvironmentsStore.getState().environments[0].variables;
    expect(vars.some((v) => v.key === "newk" && v.currentValue === "v")).toBe(
      true,
    );
  });

  it("setVariable is no-op without active env", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env], activeEnvId: null });
    useEnvironmentsStore.getState().setVariable("x", "y");
    expect(useEnvironmentsStore.getState().environments[0].variables).toEqual(
      [],
    );
  });

  it("hydrate restores active env from storage when id exists", async () => {
    const env: EnvironmentModel = {
      id: "keep",
      name: "E",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    ls.setItem(STORAGE_KEY, "keep");
    const db = {
      getAll: vi.fn(async () => [env]),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useEnvironmentsStore.getState().hydrate();

    expect(useEnvironmentsStore.getState().activeEnvId).toBe("keep");
    expect(useEnvironmentsStore.getState().environments).toHaveLength(1);
  });

  it("hydrate ignores stored id when env missing", async () => {
    ls.setItem(STORAGE_KEY, "ghost");
    const db = {
      getAll: vi.fn(async () => []),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useEnvironmentsStore.getState().hydrate();

    expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
  });

  it("hydrate toast on db error", async () => {
    const db = {
      getAll: vi.fn().mockRejectedValue(new Error("e")),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useEnvironmentsStore.getState().hydrate();

    expect(toast.error).toHaveBeenCalledWith("Failed to load environments", {
      description: "e",
    });
  });

  it("persistEnv error toast", async () => {
    const db = {
      put: vi.fn().mockRejectedValue(new Error("save")),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useEnvironmentsStore.getState().createEnv("X");

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to save environment", {
        description: "save",
      }),
    );
  });

  describe("bulkImportEnvVars", () => {
    it("returns 0 when env not found", () => {
      expect(
        useEnvironmentsStore.getState().bulkImportEnvVars("nonexistent", [
          { key: "A", value: "1" },
        ]),
      ).toBe(0);
    });

    it("adds new variables to the environment", () => {
      const env = useEnvironmentsStore.getState().createEnv("Dev");
      const count = useEnvironmentsStore
        .getState()
        .bulkImportEnvVars(env.id, [
          { key: "API_URL", value: "https://api.example.com" },
          { key: "API_KEY", value: "secret" },
        ]);
      expect(count).toBe(2);
      const vars =
        useEnvironmentsStore.getState().environments[0].variables;
      expect(vars).toHaveLength(2);
      expect(vars[0].key).toBe("API_URL");
      expect(vars[0].currentValue).toBe("https://api.example.com");
      expect(vars[1].key).toBe("API_KEY");
    });

    it("updates existing variable when key matches", () => {
      const env = useEnvironmentsStore.getState().createEnv("Dev");
      useEnvironmentsStore
        .getState()
        .bulkImportEnvVars(env.id, [{ key: "X", value: "first" }]);
      const count = useEnvironmentsStore
        .getState()
        .bulkImportEnvVars(env.id, [{ key: "X", value: "second" }]);
      expect(count).toBe(1);
      const vars =
        useEnvironmentsStore.getState().environments[0].variables;
      expect(vars).toHaveLength(1);
      expect(vars[0].currentValue).toBe("second");
    });

    it("skips empty keys", () => {
      const env = useEnvironmentsStore.getState().createEnv("Dev");
      const count = useEnvironmentsStore
        .getState()
        .bulkImportEnvVars(env.id, [
          { key: "  ", value: "" },
          { key: "", value: "" },
        ]);
      expect(count).toBe(0);
      expect(
        useEnvironmentsStore.getState().environments[0].variables,
      ).toHaveLength(0);
    });

    it("trims keys", () => {
      const env = useEnvironmentsStore.getState().createEnv("Dev");
      useEnvironmentsStore
        .getState()
        .bulkImportEnvVars(env.id, [{ key: "  KEY  ", value: "val" }]);
      const vars =
        useEnvironmentsStore.getState().environments[0].variables;
      expect(vars[0].key).toBe("KEY");
    });
  });
});
