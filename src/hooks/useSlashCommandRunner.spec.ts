/** @vitest-environment happy-dom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextChip } from "@/lib/relay/chips";
import { SLASH_COMMANDS } from "@/lib/relay/slashCommands";
import * as slashTarget from "@/lib/relay/slashTarget";
import { useSlashCommandRunner } from "./useSlashCommandRunner";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const command = (id: (typeof SLASH_COMMANDS)[number]["id"]) =>
  SLASH_COMMANDS.find((c) => c.id === id)!;

const requestChip: ContextChip = {
  kind: "request",
  id: "r1",
  label: "Get users",
};

function mountHook(
  overrides: Partial<{
    attachedItems: readonly ContextChip[];
    threadHasMessages: boolean;
  }> = {},
) {
  const onStartNewConversation = vi.fn();
  const translate = vi.fn((key: string) => `t:${key}`);

  const { result, rerender } = renderHook(
    (props: {
      attachedItems: readonly ContextChip[];
      threadHasMessages: boolean;
    }) =>
      useSlashCommandRunner({
        attachedItems: props.attachedItems,
        threadHasMessages: props.threadHasMessages,
        translate,
        onStartNewConversation,
      }),
    {
      initialProps: {
        attachedItems: overrides.attachedItems ?? [],
        threadHasMessages: overrides.threadHasMessages ?? false,
      },
    },
  );

  return {
    result,
    rerender,
    onStartNewConversation,
    translate,
  };
}

describe("useSlashCommandRunner", () => {
  it("asks for a command pill when the slash target is already satisfied", () => {
    const { result } = mountHook({ attachedItems: [requestChip] });

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("run"));
    });

    expect(runResult!).toEqual({ type: "insert-command" });
    expect(result.current.mentionRequest).toBeNull();
  });

  it("opens the target picker with kind and hint when the target is missing", () => {
    const { result, translate } = mountHook();

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("run"));
    });

    expect(runResult!).toEqual({ type: "await-target" });
    expect(result.current.mentionRequest).toEqual({
      kind: "request",
      hint: "t:slash.hint.request",
      pinCurrentTab: true,
    });
    expect(result.current.pendingSlashCommand?.id).toBe("run");
    expect(translate).toHaveBeenCalledWith("slash.hint.request");
  });

  it("inserts /import as a pill without opening the picker", () => {
    const { result } = mountHook();

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("import"));
    });

    expect(runResult!).toEqual({ type: "insert-command" });
    expect(result.current.mentionRequest).toBeNull();
  });

  it("asks for clear confirmation on a non-empty thread without opening the menu", () => {
    const { result, onStartNewConversation } = mountHook({
      threadHasMessages: true,
    });

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("clear"));
    });

    expect(runResult!).toEqual({ type: "clear-confirm" });
    expect(onStartNewConversation).not.toHaveBeenCalled();
    expect(result.current.mentionRequest).toBeNull();
  });

  it("starts a new thread on /clear when the thread is empty", () => {
    const { result, onStartNewConversation } = mountHook({
      threadHasMessages: false,
    });

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("clear"));
    });

    expect(runResult!).toEqual({ type: "new-thread" });
    expect(onStartNewConversation).toHaveBeenCalledTimes(1);
    expect(result.current.mentionRequest).toBeNull();
  });

  it("clears a pending mention request", () => {
    const { result } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("run"));
    });
    expect(result.current.mentionRequest).not.toBeNull();

    act(() => {
      result.current.clearMentionRequest();
    });

    expect(result.current.mentionRequest).toBeNull();
    expect(result.current.pendingSlashCommand).toBeNull();
  });

  it("completes a target pick by closing the picker", () => {
    const { result } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("run"));
    });
    act(() => {
      result.current.completeTargetPick();
    });

    expect(result.current.mentionRequest).toBeNull();
    expect(result.current.pendingSlashCommand).toBeNull();
  });

  it("uses the collection hint when a collection-scoped command lacks a target", () => {
    const { result, translate } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("docs"));
    });

    expect(result.current.mentionRequest).toEqual({
      kind: "collection",
      hint: "t:slash.hint.collection",
      pinCurrentTab: true,
    });
    expect(translate).toHaveBeenCalledWith("slash.hint.collection");
  });

  it("opens the mention menu for /summarize when nothing is attached", () => {
    const { result, translate } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("summarize"));
    });

    expect(result.current.mentionRequest).toEqual({
      kind: "request",
      hint: "t:slash.hint.request",
      pinCurrentTab: true,
    });
    expect(translate).toHaveBeenCalledWith("slash.hint.request");
  });

  it("opens an unfiltered picker with the tab hint when a command targets the current tab", () => {
    const { result, translate } = mountHook();
    // No registered command targets "tab" today; the type allows it.
    const tabCommand = { ...command("docs"), requiresTarget: "tab" as const };

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(tabCommand);
    });

    expect(runResult!).toEqual({ type: "await-target" });
    expect(result.current.mentionRequest).toEqual({
      kind: null,
      hint: "t:slash.hint.tab",
      pinCurrentTab: true,
    });
    expect(translate).toHaveBeenCalledWith("slash.hint.tab");
  });

  it("does nothing when completeTargetPick is called without a pending command", () => {
    const { result } = mountHook();

    act(() => {
      result.current.completeTargetPick();
    });

    expect(result.current.mentionRequest).toBeNull();
  });
});
