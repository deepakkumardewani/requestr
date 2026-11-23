/** @vitest-environment happy-dom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDedupeState } from "@/lib/analytics/dedupe";
import { HIGHLIGHTS } from "@/lib/whatsNew/highlights";
import { usePromptStore } from "@/stores/usePromptStore";
import enCommon from "../../../messages/en/common.json";
import { WhatsNewModal } from "./WhatsNewModal";

const mocks = vi.hoisted(() => ({
  version: "1.1.0",
  locale: "en",
  gateOpen: true,
  tracking: true,
  track: vi.fn(),
  data: {} as Record<string, unknown[]>,
}));

vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const messages = enCommon.whatsNew as Record<string, string>;
    return (messages[key] ?? key).replace(
      /\{(\w+)\}/g,
      (_, name: string) => values?.[name] ?? ""
    );
  },
}));
vi.mock("@/lib/prompts/useAutoPromptGate", () => ({
  useAutoPromptGate: () => mocks.gateOpen,
}));
vi.mock("@/lib/analytics/adapter", () => ({
  isTrackingActive: () => mocks.tracking,
  track: mocks.track,
}));
vi.mock("@/lib/backup/exporter", () => ({
  collectBackupData: () => Promise.resolve(mocks.data),
}));
vi.mock("@/lib/whatsNew/whatsNewState", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/whatsNew/whatsNewState")
  >("@/lib/whatsNew/whatsNewState");
  return {
    ...actual,
    get NEXT_PUBLIC_APP_VERSION() {
      return mocks.version;
    },
  };
});

const LAST_SEEN_KEY = "rq_whats_new_last_seen";
const ONBOARDING_KEY = "rq_onboarding_complete";
const savedHighlights = { ...HIGHLIGHTS };

const active = () => usePromptStore.getState().active;

async function mount() {
  const view = render(<WhatsNewModal />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
  for (const key of Object.keys(HIGHLIGHTS)) delete HIGHLIGHTS[key];
  HIGHLIGHTS["1.1.0"] = {
    en: ["Alpha improvement", "Beta improvement"],
    fr: ["Amélioration alpha"],
    ja: [],
  };
  mocks.version = "1.1.0";
  mocks.locale = "en";
  mocks.gateOpen = true;
  mocks.tracking = true;
  mocks.data = {};
  mocks.track.mockClear();
  localStorage.setItem(LAST_SEEN_KEY, "1.0.0");
});

afterEach(() => {
  cleanup();
  usePromptStore.setState({ active: null, current: null, queue: [] });
  for (const key of Object.keys(HIGHLIGHTS)) delete HIGHLIGHTS[key];
  Object.assign(HIGHLIGHTS, savedHighlights);
});

describe("WhatsNewModal show-once", () => {
  it("shows the highlights to a returning user on a new version", async () => {
    await mount();
    expect(active()).toBe("whats-new");
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
    expect(screen.getByText("What's new")).toBeTruthy();
    expect(
      screen.getByText("Here's what changed in version 1.1.0.")
    ).toBeTruthy();
    expect(screen.getByText("Alpha improvement")).toBeTruthy();
    expect(screen.getByText("Beta improvement")).toBeTruthy();
  });

  it("renders the bullets in the active locale", async () => {
    mocks.locale = "fr";
    await mount();
    expect(screen.getByText("Amélioration alpha")).toBeTruthy();
    expect(screen.queryByText("Alpha improvement")).toBeNull();
  });

  it("falls back to English bullets for a locale without any", async () => {
    mocks.locale = "ja";
    await mount();
    expect(screen.getByText("Alpha improvement")).toBeTruthy();
  });

  it("emits whats_new_shown once with the version", async () => {
    await mount();
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith("whats_new_shown", {
      version: "1.1.0",
    });
  });

  it("does not emit analytics when tracking is inactive", async () => {
    mocks.tracking = false;
    await mount();
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("stays hidden when the version was already seen", async () => {
    localStorage.setItem(LAST_SEEN_KEY, "1.1.0");
    await mount();
    expect(active()).toBeNull();
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
  });

  it("stays hidden when the release has no highlights entry", async () => {
    mocks.version = "1.2.0";
    delete HIGHLIGHTS["1.1.0"];
    await mount();
    expect(active()).toBeNull();
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
  });

  it("stays hidden when no app version is configured", async () => {
    mocks.version = "";
    await mount();
    expect(active()).toBeNull();
  });

  it("shows the newest highlighted release a skipping user missed", async () => {
    HIGHLIGHTS["1.2.0"] = { en: ["Gamma improvement"], fr: [], ja: [] };
    mocks.version = "1.3.0";
    await mount();
    expect(screen.getByText("Gamma improvement")).toBeTruthy();
    expect(
      screen.getByText("Here's what changed in version 1.2.0.")
    ).toBeTruthy();
  });

  it("waits for the prompt gate before requesting the slot", async () => {
    mocks.gateOpen = false;
    const { rerender } = await mount();
    expect(active()).toBeNull();
    mocks.gateOpen = true;
    rerender(<WhatsNewModal />);
    await act(async () => {});
    expect(active()).toBe("whats-new");
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
  });

  it("stays queued behind a higher-priority prompt", async () => {
    usePromptStore.getState().request("tour", { auto: true });
    await mount();
    expect(active()).toBe("tour");
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
    act(() => usePromptStore.getState().release("tour"));
    expect(active()).toBe("whats-new");
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
  });

  it("withdraws an unanswered request when the gate closes", async () => {
    usePromptStore.getState().request("tour", { auto: true });
    const { rerender } = await mount();
    mocks.gateOpen = false;
    rerender(<WhatsNewModal />);
    act(() => usePromptStore.getState().release("tour"));
    expect(active()).toBeNull();
  });

  it("releases the slot when unmounted while open", async () => {
    const { unmount } = await mount();
    expect(active()).toBe("whats-new");
    unmount();
    expect(active()).toBeNull();
  });

  it("ignores a late data check after unmount", async () => {
    localStorage.clear();
    mocks.data = { requests: [{ id: "r1" }] };
    const { unmount } = render(<WhatsNewModal />);
    unmount();
    await act(async () => {});
    expect(active()).toBeNull();
  });
});

describe("WhatsNewModal first-run users", () => {
  beforeEach(() => localStorage.clear());

  it("never shows to a brand-new user and records the current version", async () => {
    await mount();
    expect(active()).toBeNull();
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("1.1.0");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("shows to a user who finished onboarding but has no stored version", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    await mount();
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
  });

  it("shows to a user with saved requests but no stored version", async () => {
    mocks.data = { requests: [{ id: "r1" }] };
    await mount();
    expect(screen.getByTestId("whats-new-modal")).toBeTruthy();
  });
});

describe("WhatsNewModal dismissal", () => {
  it("closes, records the version, releases the slot and emits the event", async () => {
    await mount();
    fireEvent.click(screen.getByTestId("whats-new-dismiss"));
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
    expect(active()).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("1.1.0");
    expect(mocks.track).toHaveBeenLastCalledWith("whats_new_dismissed", {
      version: "1.1.0",
    });
  });

  it("does not reappear on the next mount after dismissal", async () => {
    const first = await mount();
    fireEvent.click(screen.getByTestId("whats-new-dismiss"));
    first.unmount();
    await mount();
    expect(active()).toBeNull();
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
  });

  it("dismisses on Escape", async () => {
    await mount();
    fireEvent.keyDown(screen.getByTestId("whats-new-modal"), {
      key: "Escape",
      code: "Escape",
    });
    expect(screen.queryByTestId("whats-new-modal")).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe("1.1.0");
  });
});
