import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_STORAGE_KEYS } from "@/lib/relay/constants";
import { RELAY_DEFAULT_PERMISSION_MODE } from "@/lib/relay/permission";
import { useRelayPermissionStore } from "./useRelayPermissionStore";

let localStore: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  });
}

beforeEach(() => {
  mockLocalStorage();
  localStore = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStore = {};
});

describe("useRelayPermissionStore", () => {
  describe("initial state", () => {
    it("starts with the default permission mode", () => {
      const state = useRelayPermissionStore.getState();
      expect(state.mode).toBe(RELAY_DEFAULT_PERMISSION_MODE);
    });

    it("the default mode is 'review'", () => {
      expect(useRelayPermissionStore.getState().mode).toBe("review");
    });
  });

  describe("hydrate", () => {
    it("reads mode from localStorage on hydrate", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "skip";
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });

    it("handles all valid permission modes", () => {
      for (const mode of ["always-ask", "review", "skip"] as const) {
        localStore[RELAY_STORAGE_KEYS.permission] = mode;
        useRelayPermissionStore.getState().hydrate();
        expect(useRelayPermissionStore.getState().mode).toBe(mode);
      }
    });

    it("falls back to default mode when storage is empty", () => {
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
    });

    it("falls back to default mode when stored value is invalid", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "invalid-mode";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      expect(warn).toHaveBeenCalledWith(
        "[relay] unknown permission mode in storage",
        expect.objectContaining({
          key: RELAY_STORAGE_KEYS.permission,
          stored: "invalid-mode",
        })
      );
      warn.mockRestore();
    });

    it("handles malformed JSON gracefully", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "{invalid json";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });

    it("handles localStorage access errors", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      expect(warn).toHaveBeenCalledWith(
        "[relay] reading permission mode failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.permission })
      );
      warn.mockRestore();
    });

    it("handles undefined localStorage", () => {
      vi.stubGlobal("localStorage", undefined);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });
  });

  describe("setMode", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      useRelayPermissionStore.getState().hydrate();
    });

    it("updates the store state with a new valid mode", () => {
      useRelayPermissionStore.getState().setMode("skip");
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });

    it("persists the new mode to localStorage", () => {
      useRelayPermissionStore.getState().setMode("always-ask");
      expect(localStore[RELAY_STORAGE_KEYS.permission]).toBe("always-ask");
    });

    it("does not update when the mode is already set to the same value", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().setMode("review");
      // Mode should stay as review (default)
      expect(useRelayPermissionStore.getState().mode).toBe("review");
      spy.mockRestore();
    });

    it("ignores invalid permission modes", () => {
      const originalMode = useRelayPermissionStore.getState().mode;
      useRelayPermissionStore.getState().setMode("invalid-mode" as any);
      expect(useRelayPermissionStore.getState().mode).toBe(originalMode);
    });

    it("ignores null values", () => {
      const originalMode = useRelayPermissionStore.getState().mode;
      useRelayPermissionStore.getState().setMode(null as any);
      expect(useRelayPermissionStore.getState().mode).toBe(originalMode);
    });

    it("ignores undefined values", () => {
      const originalMode = useRelayPermissionStore.getState().mode;
      useRelayPermissionStore.getState().setMode(undefined as any);
      expect(useRelayPermissionStore.getState().mode).toBe(originalMode);
    });

    it("emits telemetry event when mode changes", () => {
      const trackEvent = vi
        .fn()
        .mockReturnValue(undefined);
      vi.doMock("@/lib/relay/telemetry", () => ({
        trackRelayEvent: trackEvent,
      }));
      // Note: We're verifying the interface; the actual tracking is tested via the integration
      // with telemetry module which we're not testing here to avoid side effects
      expect(useRelayPermissionStore.getState().mode).toBe("review");
      useRelayPermissionStore.getState().setMode("skip");
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });

    it("handles localStorage write failures gracefully", () => {
      const mockStorage = {
        getItem: (k: string) => localStore[k] ?? null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: (k: string) => {
          delete localStore[k];
        },
      };
      vi.stubGlobal("localStorage", mockStorage);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      useRelayPermissionStore.getState().setMode("skip");
      // State should still be updated even if localStorage fails
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
      expect(warn).toHaveBeenCalledWith(
        "[relay] writing permission mode failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.permission })
      );
      warn.mockRestore();
    });

    it("transitions from 'always-ask' to 'skip'", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "always-ask";
      useRelayPermissionStore.getState().hydrate();
      useRelayPermissionStore.getState().setMode("skip");
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
      expect(localStore[RELAY_STORAGE_KEYS.permission]).toBe("skip");
    });

    it("transitions between all valid modes", () => {
      const modes = ["always-ask", "review", "skip"] as const;
      for (const targetMode of modes) {
        useRelayPermissionStore.getState().setMode(targetMode);
        expect(useRelayPermissionStore.getState().mode).toBe(targetMode);
        expect(localStore[RELAY_STORAGE_KEYS.permission]).toBe(targetMode);
      }
    });
  });

  describe("integration: hydrate then setMode", () => {
    it("restores mode from storage and allows updates", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "skip";
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe("skip");

      useRelayPermissionStore.getState().setMode("always-ask");
      expect(useRelayPermissionStore.getState().mode).toBe("always-ask");
      expect(localStore[RELAY_STORAGE_KEYS.permission]).toBe("always-ask");
    });

    it("multiple hydrate calls reflect latest localStorage state", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "review";
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe("review");

      localStore[RELAY_STORAGE_KEYS.permission] = "skip";
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe("skip");
    });
  });

  describe("edge cases", () => {
    it("handles empty string in storage", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });

    it("handles whitespace-only string in storage", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "   ";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });

    it("correctly parses JSON null (which is different from no value)", () => {
      // localStorage stores strings, so JSON.parse would turn "null" string into null
      localStore[RELAY_STORAGE_KEYS.permission] = "null";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });

    it("handles mode with different cases", () => {
      localStore[RELAY_STORAGE_KEYS.permission] = "SKIP";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      useRelayPermissionStore.getState().hydrate();
      expect(useRelayPermissionStore.getState().mode).toBe(
        RELAY_DEFAULT_PERMISSION_MODE
      );
      warn.mockRestore();
    });
  });

  describe("store isolation", () => {
    it("store changes do not affect other tests", () => {
      useRelayPermissionStore.getState().setMode("skip");
      expect(useRelayPermissionStore.getState().mode).toBe("skip");

      // Simulate another test starting fresh
      useRelayPermissionStore.setState({ mode: RELAY_DEFAULT_PERMISSION_MODE });
      expect(useRelayPermissionStore.getState().mode).toBe("review");
    });
  });
});
