/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import {
  isHumanPrompt,
  openInRelay,
  RELAY_ENTRY_PROMPTS,
  RELAY_PROMPT_MAX_CHARS,
} from "./openInRelay";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const chip = { kind: "request", id: "r1", label: "Get users" } as const;

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    attachedItems: [],
    composerPrefill: null,
    composerDraft: null,
    focusRequest: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("openInRelay", () => {
  it("opens the dock with the context as pills ahead of the prompt", () => {
    openInRelay({ entry: "explainError", context: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(true);
    expect(state.composerDraft).toEqual([
      { type: "attachment", chip },
      { type: "text", text: ` ${RELAY_ENTRY_PROMPTS.explainError}` },
    ]);
  });

  it("seeds only the prompt when no context is given", () => {
    openInRelay({ entry: "summarizeResponse" });
    expect(useRelayStore.getState().composerDraft).toEqual([
      { type: "text", text: RELAY_ENTRY_PROMPTS.summarizeResponse },
    ]);
  });

  it("does nothing when Relay is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    openInRelay({ entry: "summarizeResponse", context: [chip] });
    const state = useRelayStore.getState();
    expect(state.open).toBe(false);
    expect(state.composerDraft).toBeNull();
  });
});

describe("openInRelay with the user setting off", () => {
  it("does nothing when the user disabled Relay in settings", () => {
    useRelayStore.setState({ enabled: false });
    openInRelay({ entry: "summarizeResponse", context: [chip] });
    expect(useRelayStore.getState().open).toBe(false);
    useRelayStore.setState({ enabled: true });
  });
});

describe("entry prompt contract", () => {
  it("keeps all eight entry prompts short, human and free of internal markers", () => {
    const prompts = Object.values(RELAY_ENTRY_PROMPTS);
    expect(prompts).toHaveLength(8);
    for (const prompt of prompts) {
      expect(prompt.length).toBeLessThanOrEqual(RELAY_PROMPT_MAX_CHARS);
      expect(isHumanPrompt(prompt)).toBe(true);
    }
  });

  it("rejects over-long, empty and instruction-style text", () => {
    expect(isHumanPrompt("x".repeat(RELAY_PROMPT_MAX_CHARS + 1))).toBe(false);
    expect(isHumanPrompt("")).toBe(false);
    expect(isHumanPrompt("IMPORTANT: use the hint")).toBe(false);
    expect(isHumanPrompt("line one\nline two")).toBe(false);
  });
});
