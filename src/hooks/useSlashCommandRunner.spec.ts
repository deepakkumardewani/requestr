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
  const onDraftChange = vi.fn<(text: string) => void>();
  const onCaret = vi.fn<(position: number) => void>();
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
        onDraftChange,
        onCaret,
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
    onDraftChange,
    onCaret,
    onStartNewConversation,
    translate,
  };
}

describe("useSlashCommandRunner", () => {
  it("fills the prompt when the slash target is already satisfied", () => {
    const { result, onDraftChange, onCaret } = mountHook({
      attachedItems: [requestChip],
    });

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("run"));
    });

    const filled = "t:slash.run.prompt\n\nAttached: Get users";
    expect(runResult!).toEqual({ type: "filled-prompt" });
    expect(onDraftChange).toHaveBeenCalledWith(filled);
    expect(onCaret).toHaveBeenCalledWith(filled.length);
    expect(result.current.mentionRequest).toBeNull();
  });

  it("appends attached labels to the filled prompt", () => {
    const { result, onDraftChange } = mountHook({
      attachedItems: [requestChip],
    });

    act(() => {
      result.current.runSlashCommand(command("run"));
    });

    expect(onDraftChange).toHaveBeenCalledWith(
      "t:slash.run.prompt\n\nAttached: Get users",
    );
  });

  it("opens the mention menu with kind, hint, and command name when the target is missing", () => {
    const { result, onDraftChange, onCaret, translate } = mountHook();

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("run"));
    });

    expect(runResult!).toEqual({ type: "await-target" });
    expect(onDraftChange).toHaveBeenCalledWith("/run");
    expect(onCaret).toHaveBeenCalledWith("/run".length);
    expect(result.current.mentionRequest).toEqual({
      kind: "request",
      hint: "t:slash.hint.request",
      pinCurrentTab: true,
    });
    expect(result.current.pendingSlashCommand?.id).toBe("run");
    expect(translate).toHaveBeenCalledWith("slash.hint.request");
  });

  it("fills /import without opening the mention menu", () => {
    const { result, onDraftChange } = mountHook();

    let runResult: ReturnType<typeof result.current.runSlashCommand>;
    act(() => {
      runResult = result.current.runSlashCommand(command("import"));
    });

    expect(runResult!).toEqual({ type: "filled-prompt" });
    expect(onDraftChange).toHaveBeenCalledWith("t:slash.import.prompt");
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

  it("completes a target pick by closing the menu without rewriting the draft", () => {
    const { result, onDraftChange, onCaret } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("run"));
    });
    onDraftChange.mockClear();
    onCaret.mockClear();

    act(() => {
      result.current.completeTargetPick();
    });

    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onCaret).not.toHaveBeenCalled();
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

  it("fills a prompt without an Attached line when nothing is pinned", () => {
    const { result, onDraftChange } = mountHook();

    act(() => {
      result.current.runSlashCommand(command("new"));
    });

    expect(onDraftChange).toHaveBeenCalledWith("t:slash.new.prompt");
  });

  it("fills an empty draft when the command has no promptKey", () => {
    const { result, onDraftChange, onCaret } = mountHook();
    const actionOnly = { ...command("new"), promptKey: undefined };

    act(() => {
      result.current.runSlashCommand(actionOnly);
    });

    expect(onDraftChange).toHaveBeenCalledWith("");
    expect(onCaret).toHaveBeenCalledWith(0);
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

  it("does nothing when completeTargetPick is called without a pending command", () => {
    const { result, onDraftChange } = mountHook();

    act(() => {
      result.current.completeTargetPick();
    });

    expect(onDraftChange).not.toHaveBeenCalled();
  });
});
