// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCapabilityStarter } from "./useCapabilityStarter";
import type { StarterSuggestion, TargetSuggestion } from "@/lib/relay/suggestions";
import { useRelayStore } from "@/stores/useRelayStore";

// Mock IndexedDB for the store
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

function resetStore() {
  useRelayStore.setState({
    open: false,
    width: 432,
    activeThreadId: null,
    hydrated: false,
    prunedNotice: false,
    shareValues: false,
    attachedItems: [],
    pendingPrompt: null,
    composerPrefill: null,
    composerDraft: null,
    focusRequest: 0,
    composerHasText: false,
    permissionPopoverOpen: false,
    capabilitiesOpen: false,
    mentionRequest: null,
    enabled: true,
  });
  localStorage.clear();
  vi.stubGlobal("innerWidth", 1440);
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useCapabilityStarter", () => {
  it("sends target-free example without prefill or mention request", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-free",
      type: "starter",
      labelKey: "suggestions.generic.exploreWorkspace",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBe("suggestions.generic.exploreWorkspace");
    expect(state.composerDraft).toBeNull();
    expect(state.mentionRequest).toBeNull();
  });

  it("sends request-target example when a request chip is attached", () => {
    useRelayStore.getState().syncAttachedItems([{
      kind: "request",
      id: "r-123",
      label: "Get Users",
    }]);

    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-req",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBe("suggestions.generic.explainRequest");
    expect(state.composerDraft).toBeNull();
    expect(state.mentionRequest).toBeNull();
  });

  it("sends request-target example when a tab chip is attached", () => {
    useRelayStore.getState().syncAttachedItems([{
      kind: "tab",
      id: "t-123",
      label: "Current Request",
    }]);

    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-tab",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBe("suggestions.generic.explainRequest");
    expect(state.composerDraft).toBeNull();
    expect(state.mentionRequest).toBeNull();
  });

  it("prefills and requests mention when request target is missing", () => {
    useRelayStore.getState().syncAttachedItems([{
      kind: "collection",
      id: "c-123",
      label: "My Collection",
    }]);

    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-missing",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBeNull();
    expect(state.composerDraft).toEqual([
      { type: "text", text: "suggestions.generic.explainRequest" },
    ]);
    expect(state.mentionRequest).toEqual({
      kind: "request",
      hintKey: "slash.hint.test-missing",
    });
    expect(state.open).toBe(true);
  });

  it("prefills and requests mention when nothing is attached", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-empty",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBeNull();
    expect(state.composerDraft).toEqual([
      { type: "text", text: "suggestions.generic.explainRequest" },
    ]);
    expect(state.mentionRequest).toEqual({
      kind: "request",
      hintKey: "slash.hint.test-empty",
    });
    expect(state.open).toBe(true);
  });

  it("uses null kind for tab-target examples in the picker", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-tab-target",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "tab",
    };

    result.current.runStarter(example);

    const state = useRelayStore.getState();
    expect(state.mentionRequest?.kind).toBeNull();
    expect(state.mentionRequest?.hintKey).toBe("slash.hint.test-tab-target");
  });

  it("sends immediately when chip is attached after hook init", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-deferred",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    // Start with nothing attached
    expect(useRelayStore.getState().pendingPrompt).toBeNull();

    // Attach a request
    useRelayStore.getState().syncAttachedItems([{
      kind: "request",
      id: "r-456",
      label: "My Request",
    }]);

    // Now run the starter with the newly attached chip
    result.current.runStarter(example);

    // Should send, not prefill
    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBe("suggestions.generic.explainRequest");
    expect(state.mentionRequest).toBeNull();
  });
});

describe("useCapabilityStarter: mentionRequest lifecycle", () => {
  it("clears mentionRequest once it is consumed", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-consume",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    expect(useRelayStore.getState().mentionRequest).not.toBeNull();

    useRelayStore.getState().clearMentionRequest();

    expect(useRelayStore.getState().mentionRequest).toBeNull();
  });

  it("never persists mentionRequest to storage after clearing it", () => {
    const { result } = renderHook(() => useCapabilityStarter());
    const example: StarterSuggestion = {
      id: "test-transient",
      type: "starter",
      labelKey: "suggestions.generic.explainRequest",
      requiresTarget: "request",
    };

    result.current.runStarter(example);

    // mentionRequest is set
    expect(useRelayStore.getState().mentionRequest).not.toBeNull();

    // Clear it
    useRelayStore.getState().clearMentionRequest();

    // Verify it's cleared and no storage key exists for it
    expect(useRelayStore.getState().mentionRequest).toBeNull();
    expect(localStorage.getItem("rq_relay_mention_request")).toBeNull();
  });
});

describe("useCapabilityStarter: known-target suggestions", () => {
  const suggestion: TargetSuggestion = {
    type: "target",
    id: "request-explain",
    labelKey: "suggestions.request.explain",
    command: "explain",
    target: { kind: "request", id: "r-1", label: "Get Users" },
  };

  it("stages the command plus pill and sends the command's prompt with the target", () => {
    const { result } = renderHook(() => useCapabilityStarter());

    result.current.runTargetSuggestion(suggestion);

    const state = useRelayStore.getState();
    expect(state.outgoing).toEqual({
      attachments: [suggestion.target],
      segments: [
        { type: "command", id: "explain", label: "/explain" },
        { type: "text", text: " " },
        { type: "attachment", chip: suggestion.target },
      ],
    });
    expect(state.pendingPrompt).toBe("slash.explain.prompt @Get Users");
    expect(state.mentionRequest).toBeNull();
  });
});

