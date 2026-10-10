"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { buildActiveEnvVars } from "@/lib/activeEnvVars";
import { getDB } from "@/lib/idb";
import { generateId, interpolateVariables } from "@/lib/utils";
import type { EnvironmentModel } from "@/types";

const ACTIVE_ENV_STORAGE_KEY = "requestly_active_env_id";

type EnvironmentsState = {
  environments: EnvironmentModel[];
  activeEnvId: string | null;
  hydrated: boolean;
};

type EnvironmentsActions = {
  createEnv: (name: string) => EnvironmentModel;
  importEnv: (env: EnvironmentModel) => void;
  updateEnv: (id: string, patch: Partial<EnvironmentModel>) => void;
  deleteEnv: (id: string) => void;
  setActiveEnv: (id: string | null) => void;
  resolveVariables: (template: string) => string;
  /** Get the current value of a variable in the active environment. */
  getVariable: (key: string) => string | undefined;
  /** Upsert a variable in the active environment by key. No-op if no active env. */
  setVariable: (key: string, value: string) => void;
  /** Bulk-set variables from parsed .env lines (duplicate keys overwrite). */
  bulkImportEnvVars: (
    envId: string,
    pairs: Array<{ key: string; value: string }>,
  ) => number;
  hydrate: () => Promise<void>;
};

async function persistEnv(env: EnvironmentModel) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("environments", env);
  } catch (error) {
    toast.error("Failed to save environment", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteEnvFromDB(id: string) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("environments", id);
  } catch (error) {
    toast.error("Failed to delete environment", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const useEnvironmentsStore = create<
  EnvironmentsState & EnvironmentsActions
>((set, get) => ({
  environments: [],
  activeEnvId: null,
  hydrated: false,

  createEnv(name) {
    const env: EnvironmentModel = {
      id: generateId(),
      name,
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ environments: [...state.environments, env] }));
    persistEnv(env);
    return env;
  },

  importEnv(env) {
    set((state) => ({ environments: [...state.environments, env] }));
    persistEnv(env);
  },

  updateEnv(id, patch) {
    set((state) => ({
      environments: state.environments.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      ),
    }));
    const updated = get().environments.find((e) => e.id === id);
    if (updated) persistEnv(updated);
  },

  deleteEnv(id) {
    set((state) => ({
      environments: state.environments.filter((e) => e.id !== id),
      activeEnvId: state.activeEnvId === id ? null : state.activeEnvId,
    }));
    deleteEnvFromDB(id);
  },

  setActiveEnv(id) {
    set({ activeEnvId: id });
    if (id === null) {
      localStorage.removeItem(ACTIVE_ENV_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_ENV_STORAGE_KEY, id);
    }
  },

  resolveVariables(template) {
    const { environments, activeEnvId } = get();
    // No active env: leave the template untouched (an empty map would blank `{{vars}}`).
    if (!environments.some((e) => e.id === activeEnvId)) return template;

    const envMap = buildActiveEnvVars(environments, activeEnvId);
    return interpolateVariables(template, envMap);
  },

  getVariable(key) {
    const { environments, activeEnvId } = get();
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    if (!activeEnv) return undefined;
    const variable = activeEnv.variables.find((v) => v.key === key);
    if (!variable) return undefined;
    // Same rule as buildActiveEnvVars: empty currentValue falls back to
    // initialValue, and a defined variable with both empty is "" (not undefined).
    return variable.currentValue || variable.initialValue;
  },

  setVariable(key, value) {
    const { environments, activeEnvId, updateEnv } = get();
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    if (!activeEnv) return;

    const exists = activeEnv.variables.some((v) => v.key === key);
    const updatedVariables = exists
      ? activeEnv.variables.map((v) =>
          v.key === key ? { ...v, currentValue: value } : v,
        )
      : [
          ...activeEnv.variables,
          {
            id: generateId(),
            key,
            initialValue: "",
            currentValue: value,
            isSecret: false,
          },
        ];

    updateEnv(activeEnv.id, { variables: updatedVariables });
  },

  bulkImportEnvVars(envId, pairs) {
    const env = get().environments.find((e) => e.id === envId);
    if (!env) return 0;

    const vars = [...env.variables];
    let count = 0;
    for (const { key, value } of pairs) {
      const k = key.trim();
      if (!k) continue;
      count += 1;
      const idx = vars.findIndex((v) => v.key === k);
      if (idx >= 0) {
        vars[idx] = { ...vars[idx], currentValue: value };
      } else {
        vars.push({
          id: generateId(),
          key: k,
          initialValue: "",
          currentValue: value,
          isSecret: false,
        });
      }
    }
    if (count === 0) return 0;
    get().updateEnv(envId, { variables: vars });
    return count;
  },

  async hydrate() {
    set({ hydrated: false });
    const db = getDB();
    if (!db) {
      set({ hydrated: true });
      return;
    }
    try {
      const instance = await db;
      const environments = await instance.getAll("environments");
      const storedEnvId = localStorage.getItem(ACTIVE_ENV_STORAGE_KEY);
      // Only restore if the stored env still exists
      const activeEnvId =
        storedEnvId && environments.some((e) => e.id === storedEnvId)
          ? storedEnvId
          : null;
      set({ environments, activeEnvId, hydrated: true });
    } catch (error) {
      toast.error("Failed to load environments", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      set({ hydrated: true });
    }
  },
}));
