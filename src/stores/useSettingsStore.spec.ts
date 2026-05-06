import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import type { AppSettings } from "@/types";
import { useSettingsStore } from "./useSettingsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const DEFAULTS: AppSettings = {
  theme: "dark",
  locale: "en",
  proxyUrl: "",
  sslVerify: true,
  followRedirects: true,
  showHealthMonitor: true,
  showCodeGen: true,
  codeGenLang: "cURL",
  autoExpandExplainer: true,
  globalBaseUrl: "",
  globalHeaders: [],
  pinnedRequestIds: [],
  accentColor: { r: 52, g: 211, b: 153 },
};

describe("useSettingsStore", () => {
  const get = vi.fn();
  const put = vi.fn();

  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve({
        get,
        put,
      } as never),
    );
    useSettingsStore.setState({ ...DEFAULTS, hydrated: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.mocked(getDB).mockReturnValue(null);
  });

  it("starts with defaults and hydrated false", () => {
    const s = useSettingsStore.getState();
    expect(s.theme).toBe("dark");
    expect(s.proxyUrl).toBe("");
    expect(s.sslVerify).toBe(true);
    expect(s.followRedirects).toBe(true);
    expect(s.showHealthMonitor).toBe(true);
    expect(s.showCodeGen).toBe(true);
    expect(s.codeGenLang).toBe("cURL");
    expect(s.autoExpandExplainer).toBe(true);
    expect(s.hydrated).toBe(false);
  });

  it("setSetting updates state and persists full settings payload", async () => {
    useSettingsStore.getState().setSetting("theme", "light");
    expect(useSettingsStore.getState().theme).toBe("light");
    await Promise.resolve();
    expect(put).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({ theme: "light" }),
      "app",
    );
  });

  it("hydrate merges saved settings when present", async () => {
    get.mockResolvedValue({
      theme: "system",
      proxyUrl: "http://proxy",
      sslVerify: false,
      followRedirects: false,
      showHealthMonitor: false,
      showCodeGen: false,
      codeGenLang: "JavaScript fetch",
      autoExpandExplainer: false,
    });
    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.theme).toBe("system");
    expect(s.proxyUrl).toBe("http://proxy");
    expect(s.codeGenLang).toBe("JavaScript fetch");
  });

  it("hydrate sets hydrated when no row exists", async () => {
    get.mockResolvedValue(undefined);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(useSettingsStore.getState().theme).toBe("dark");
  });

  it("hydrate early-returns when getDB is null", async () => {
    vi.mocked(getDB).mockReturnValue(null);
    await useSettingsStore.getState().hydrate();
    expect(get).not.toHaveBeenCalled();
  });

  it("hydrate sets hydrated and toasts on error", async () => {
    get.mockRejectedValue(new Error("read fail"));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });
});
