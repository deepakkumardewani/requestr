/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { openInRelay } from "./openInRelay";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const chip = { kind: "request", id: "r1", label: "Get users" } as const;

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    draftChips: [],
    removedChipKeys: [],
    composerPrefill: null,
    focusRequest: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("openInRelay", () => {
  it("opens the dock with the prompt and chips", () => {
    openInRelay({ prompt: "Explain this response", context: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.composerPrefill).toBe("Explain this response");
    expect(state.draftChips).toEqual([chip]);
  });

  it("seeds no chips when no context is given", () => {
    openInRelay({ prompt: "Hello" });
    expect(useRelayStore.getState().draftChips).toEqual([]);
  });

  it("does nothing when Relay is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    openInRelay({ prompt: "Hello", context: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(false);
    expect(state.composerPrefill).toBeNull();
    expect(state.draftChips).toEqual([]);
  });
});

describe("openInRelay with the user setting off", () => {
  it("does nothing when the user disabled Relay in settings", () => {
    useRelayStore.setState({ enabled: false });
    openInRelay({ prompt: "Hello", context: [chip] });
    expect(useRelayStore.getState().open).toBe(false);
    useRelayStore.setState({ enabled: true });
  });
});
