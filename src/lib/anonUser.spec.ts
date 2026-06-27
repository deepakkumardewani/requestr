import { afterEach, describe, expect, it, vi } from "vitest";
import { getAnonUserId } from "./anonUser";

function stubWindowWithLocalStorage(store: Record<string, string>): {
  setItem: ReturnType<typeof vi.fn>;
} {
  const setItem = vi.fn((k: string, v: string) => {
    store[k] = v;
  });
  const localStorage = {
    getItem: (k: string) => (k in store ? (store[k] as string) : null),
    setItem,
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
  vi.stubGlobal("window", { localStorage });
  return { setItem };
}

describe("getAnonUserId", () => {
  const originalWindow = globalThis.window;
  const originalRandomUUID = globalThis.crypto.randomUUID;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    globalThis.crypto.randomUUID = originalRandomUUID;
  });

  it("returns an empty string when window is undefined (SSR)", () => {
    Reflect.deleteProperty(globalThis, "window");
    expect(getAnonUserId()).toBe("");
  });

  it("persists a new UUID when storage is empty and returns the same value on the next call", () => {
    const store: Record<string, string> = {};
    const { setItem } = stubWindowWithLocalStorage(store);
    vi.stubGlobal("crypto", {
      ...globalThis.crypto,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });

    const a = getAnonUserId();
    const b = getAnonUserId();
    expect(a).toBe("11111111-1111-4111-8111-111111111111");
    expect(b).toBe(a);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(store.rq_anon_id).toBe(a);
  });

  it("returns the stored value when rq_anon_id is already set", () => {
    const store: Record<string, string> = {
      rq_anon_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    };
    stubWindowWithLocalStorage(store);
    const random = vi.fn(() => "should-not-be-used");
    vi.stubGlobal("crypto", {
      ...globalThis.crypto,
      randomUUID: random,
    });
    expect(getAnonUserId()).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(random).not.toHaveBeenCalled();
  });

  it("returns empty string when localStorage throws", () => {
    const warn = vi.fn();
    vi.stubGlobal("console", { ...console, warn });
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("quota exceeded");
      },
    });
    expect(getAnonUserId()).toBe("");
    expect(warn).toHaveBeenCalledWith(
      "[requestly] getAnonUserId: localStorage unavailable",
      expect.any(Error),
    );
  });
});
