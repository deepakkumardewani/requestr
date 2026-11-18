"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAnonUserId } from "@/lib/anonUser";
import { buildAttachmentMetadata } from "@/lib/relay/attachments";
import { changeIdsOfMessage } from "@/lib/relay/changeGroups";
import { type ChangeOrigin, getRelayChangeLog } from "@/lib/relay/changeLog";
import { RELAY_CHAT_API, RELAY_USER_HEADER } from "@/lib/relay/constants";
import { buildChatPayload } from "@/lib/relay/contextBuilder";
import {
  type MappedRelayError,
  type RelayDisplayError,
  STEP_CAP_CONTINUE_PROMPT,
  STEP_CAP_ERROR_CODE,
} from "@/lib/relay/errors";
import { prepareOutgoingMessages } from "@/lib/relay/outgoingMessages";
import { buildRedactContext } from "@/lib/relay/redact";
import { segmentMetadata } from "@/lib/relay/segments";
import { slashCommandMetadata } from "@/lib/relay/slashCommands";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  clearToolRunning,
  flushThreadWrites,
  getThread,
  newThreadId,
  scheduleThreadSave,
  subscribeSaveState,
} from "@/lib/relay/threadDb";
import { finishTurn, syncSteps, withTurnTiming } from "@/lib/relay/timing";
import { disableRelaySpec } from "@/lib/relay/tools/settingsWrite";
import { type OutgoingDraft, useRelayStore } from "@/stores/useRelayStore";
import { useRelayTurnStore } from "@/stores/useRelayTurnStore";
import {
  beginLiveTurn,
  declinePendingTools,
  derivePhase,
  hasOpenToolCall,
  hasText,
  isUnchangedRestore,
  mapClientError,
  observeSteps,
  type RelayChatStatus,
  SETTLED_STATUSES,
  settleInterruptedCalls,
  settlePendingForMessage,
  shouldContinueToolLoop,
  type ToolResolution,
  trimToLastCompletedStep,
  withKeptChangeIds,
  withRunningTurn,
} from "./relayTurnHelpers";
import { useOnlineStatus } from "./useOnlineStatus";
import { type AddToolOutput, useToolQueue } from "./useToolQueue";

export {
  AUTO_DECLINED_OUTPUT,
  countStepsSinceLastUser,
  declinePendingTools,
  isToolAwaiting,
  observeSteps,
  pendingToolCalls,
  type RelayChatStatus,
  settlePendingForMessage,
  shouldContinueToolLoop,
  type ToolResolution,
} from "./relayTurnHelpers";

export type RelayChat = {
  messages: UIMessage[];
  status: RelayChatStatus;
  /** Mapped FR-70 error or the client-only step cap, or null. Never carries provider text. */
  error: RelayDisplayError | null;
  online: boolean;
  /** Id of an assistant message cut short by an error or lost connection (FR-71). */
  interruptedMessageId: string | null;
  send: (text: string) => void;
  /** Answers a Confirmation or question card; the tool runs only on approve or answer. */
  resolveTool: (toolCallId: string, resolution: ToolResolution) => void;
  /** Ends the turn; it stays ended until the next send, Retry or Regenerate (FR-20). */
  stop: () => void;
  /** Throws the last reply away and writes it again, after asking about its changes. */
  regenerate: () => void;
  /** Resends from the last completed tool step after an error, repeating no finished work. */
  retry: () => void;
  /** Lets the model carry on after the step cap ended the turn. */
  continueTurn: () => void;
  clearError: () => void;
  /** Drops `messageId` and everything after it, then sends `text` in its place (FR-191). */
  editAndResend: (messageId: string, text: string) => void;
};

/** Turns Relay off and records it, so the change can be undone from the summary. */
async function disableRelayAfterTurn(origin: ChangeOrigin): Promise<void> {
  const result = await getRelayChangeLog().apply(origin, disableRelaySpec());
  if (!result.ok) {
    console.warn("[relay] turning Relay off failed", { error: result.error });
  }
}

/** Applies an approved "turn Relay off after this reply" once, whichever tab or reload it survived. */
function applyPendingDisable(): void {
  const origin = useRelayStore.getState().pendingDisable;
  if (!origin) return;
  useRelayStore.getState().setPendingDisable(null);
  void disableRelayAfterTurn(origin);
}

/** The discarded messages' changes that are still applied; undone ones need no decision. */
async function appliedChangeIds(messages: UIMessage[]): Promise<string[]> {
  const log = getRelayChangeLog();
  const ids = [...new Set(messages.flatMap(changeIdsOfMessage))];
  const views = await Promise.all(ids.map((id) => log.load(id)));
  return ids.filter((_, index) => {
    const status = views[index]?.status;
    return status !== undefined && status !== "undone";
  });
}

/** Opens the Keep/Undo dialog and settles with the changes that stay applied, or null to back out. */
function askKeepUndo(
  turnId: string,
  changeIds: readonly string[],
): Promise<readonly string[] | null> {
  return new Promise((resolve) => {
    const turn = useRelayTurnStore.getState();
    turn.keepUndoRequest?.resolve(null);
    turn.requestKeepUndo({
      turnId,
      changeIds,
      resolve: (kept) => {
        useRelayTurnStore.getState().clearKeepUndo();
        resolve(kept);
      },
    });
  });
}

/** What the user keeps when a reply is thrown away: [] with nothing at stake, null when they back out. */
async function confirmDiscard(
  discarded: UIMessage[],
  turnId: string,
): Promise<readonly string[] | null> {
  const applied = await appliedChangeIds(discarded);
  return applied.length === 0 ? [] : askKeepUndo(turnId, applied);
}

const isStopped = () => useRelayTurnStore.getState().phase === "stopped";

export function useRelayChat(): RelayChat {
  const online = useOnlineStatus();
  const activeThreadId = useRelayStore((s) => s.activeThreadId);
  const hydrated = useRelayStore((s) => s.hydrated);
  const phase = useRelayTurnStore((s) => s.phase);
  // Chat id for a conversation with no stored thread yet; it becomes the
  // thread id on the first send so the chat is never rebuilt mid-turn.
  const [draftId, setDraftId] = useState(newThreadId);
  const chatId = activeThreadId ?? draftId;
  /** Tools run after the render that started them, so they read the current chat id here. */
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const addToolOutputRef = useRef<AddToolOutput | null>(null);
  const messagesRef = useRef<UIMessage[]>([]);
  /** Why the turn in flight ends early (Stop, going offline); absent means it runs to completion. */
  const finishReasonRef = useRef<"stopped" | "error" | null>(null);
  /** Changes the user kept when discarding a turn; they join the next reply's summary. */
  const keptRef = useRef<readonly string[]>([]);

  const queue = useToolQueue({ chatIdRef, messagesRef, addToolOutputRef });
  /** Calls still running for this thread; the chat reads "ready" meanwhile, but Stop must stay reachable. */
  const runningHere = queue.running.filter(
    (call) => call.threadId === chatId,
  ).length;
  const runningHereRef = useRef(runningHere);
  runningHereRef.current = runningHere;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: RELAY_CHAT_API,
        headers: () => ({ [RELAY_USER_HEADER]: getAnonUserId() }),
        prepareSendMessagesRequest: async ({ messages, body, ...rest }) => {
          const store = createZustandStoreAccess();
          const redact = buildRedactContext(
            store.environments(),
            useRelayStore.getState().shareValues,
          );
          const payload = buildChatPayload({
            messages: await prepareOutgoingMessages(messages, {
              store,
              redact,
            }),
            store,
            redact,
          });
          return {
            body: {
              ...body,
              id: rest.id,
              trigger: rest.trigger,
              messageId: rest.messageId,
              ...payload,
            },
          };
        },
      }),
    [],
  );
  const chat = useChat({
    id: chatId,
    transport,
    sendAutomaticallyWhen: shouldContinueToolLoop,
    onToolCall: ({ toolCall }) => queue.handleToolCall(toolCall),
  });
  addToolOutputRef.current = chat.addToolOutput;
  const { messages, status, stop, regenerate, sendMessage, setMessages } = chat;
  messagesRef.current = messages;
  const shownStatus: RelayChatStatus =
    status === "ready" && runningHere > 0 && phase !== "stopped"
      ? "streaming"
      : status;

  const [offlineError, setOfflineError] = useState<MappedRelayError | null>(
    null,
  );
  const [interruptedMessageId, setInterruptedMessageId] = useState<
    string | null
  >(null);

  /** Thread whose messages the chat already holds, so a restore never overwrites them. */
  const ownedThreadIdRef = useRef<string | null>(null);
  /** Settles when the thread being restored is in the chat; `send` waits on it. */
  const restoreRef = useRef<Promise<void>>(Promise.resolve());
  /** Messages just loaded from storage; re-saving them would only bump the thread's age. */
  const restoredMessagesRef = useRef<UIMessage[] | null>(null);
  const interruptedIdRef = useRef<string | null>(null);
  interruptedIdRef.current = interruptedMessageId;

  /**
   * What the chat held at the last commit. Render-time refs are already the
   * next thread's when an effect cleanup runs on a switch, so the thread being
   * left is saved from this snapshot instead (HH-H06, HH-M21).
   */
  const committedRef = useRef<{
    threadId: string | null;
    messages: UIMessage[];
  }>({ threadId: null, messages: [] });
  useEffect(() => {
    committedRef.current = {
      threadId: ownedThreadIdRef.current,
      messages,
    };
  });

  // Leaving a thread (or closing the app) saves what it holds and must not
  // leave its stream running unseen. Tool calls keep running under their binding.
  // A reply cut off mid-stream keeps its running stamp so it reopens as
  // Interrupted, the same as one cut off by a reload (HH-M21).
  useEffect(
    () => () => {
      const { threadId, messages: left } = committedRef.current;
      const current = withRunningTurn(left, useRelayStore.getState().liveTurn);
      useRelayStore.getState().setLiveTurn(null);
      useRelayTurnStore.getState().reset();
      void stop();
      if (!threadId || current.length === 0) return;
      if (isUnchangedRestore(current, restoredMessagesRef.current)) return;
      scheduleThreadSave(threadId, {
        messages: current,
        interruptedMessageId: interruptedIdRef.current,
      });
      void flushThreadWrites();
    },
    [chatId, stop],
  );

  // Declared before the restore effect: on a switch the restored state wins.
  useEffect(() => {
    setInterruptedMessageId(null);
    setOfflineError(null);
    useRelayStore.getState().setLiveTurn(null);
    useRelayStore.getState().setSaveFailed(false);
    keptRef.current = [];
  }, [chatId]);

  useEffect(
    () =>
      subscribeSaveState((threadId, notSaved) => {
        if (threadId === chatIdRef.current) {
          useRelayStore.getState().setSaveFailed(notSaved);
        }
      }),
    [],
  );

  const { runningRef } = queue;
  useEffect(() => {
    if (!hydrated) return;
    if (!activeThreadId) {
      // Forget the old thread so re-activating it (undo of a delete) reloads it.
      ownedThreadIdRef.current = null;
      return;
    }
    if (ownedThreadIdRef.current === activeThreadId) return;
    let cancelled = false;
    restoreRef.current = getThread(activeThreadId)
      .then((thread) => {
        if (cancelled) return;
        if (!thread) {
          useRelayStore.getState().setActiveThreadId(null);
          return;
        }
        ownedThreadIdRef.current = thread.id;
        const marked = thread.runningToolCalls ?? [];
        // A call left open before the reload can no longer be answered or awaited.
        const settled = settleInterruptedCalls(
          thread.messages,
          marked,
          runningRef.current,
        );
        // A settled call is new content: leaving the ref empty lets it be saved.
        restoredMessagesRef.current =
          settled === thread.messages ? thread.messages : null;
        setMessages(settled);
        setInterruptedMessageId(thread.interruptedMessageId);
        for (const id of marked) {
          if (!runningRef.current.has(id)) void clearToolRunning(thread.id, id);
        }
        if (runningRef.current.size === 0) applyPendingDisable();
      })
      .catch((error) => {
        console.warn("[relay] restoring the thread failed", {
          threadId: activeThreadId,
          error,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, activeThreadId, setMessages, runningRef]);

  const lastMessage = messages.at(-1);
  const sdkError = chat.error ?? null;
  const failed = sdkError !== null || offlineError !== null;

  // Losing the connection mid-stream keeps the partial text and marks it (FR-71).
  useEffect(() => {
    if (online || (status !== "streaming" && status !== "submitted")) return;
    finishReasonRef.current = "error";
    void stop();
    setOfflineError({ code: "offline" });
  }, [online, status, stop]);

  useEffect(() => {
    if (!sdkError && !offlineError) return;
    if (hasText(lastMessage)) setInterruptedMessageId(lastMessage.id);
    // A card left open by a failed turn has nothing behind it any more.
    const settled = declinePendingTools(
      messagesRef.current,
      runningRef.current,
    );
    if (settled !== messagesRef.current) setMessages(settled);
  }, [sdkError, offlineError, lastMessage, setMessages, runningRef]);

  // Follows the chat and the tool queue; only Stop enters `stopped`, only a new turn leaves it.
  useEffect(() => {
    if (isStopped()) return;
    useRelayTurnStore.getState().transition(
      derivePhase({
        status,
        runningTools: runningHere,
        failed,
        messages,
        running: runningRef.current,
      }),
      "chat state changed",
    );
  }, [status, runningHere, failed, messages, runningRef]);

  const clearError = useCallback(() => {
    setOfflineError(null);
    setInterruptedMessageId(null);
    chat.clearError();
  }, [chat]);

  /** Marks a new turn as under way; this is the only way out of `stopped`. */
  const beginTurn = useCallback(() => {
    finishReasonRef.current = null;
    useRelayTurnStore.getState().transition("streaming", "a turn began");
    beginLiveTurn();
  }, []);

  /** After Stop, late tool results are recorded first so the next request has none missing. */
  const awaitStoppedTools = useCallback(async () => {
    if (isStopped()) await queue.whenIdle();
  }, [queue]);

  const submit = useCallback(
    async (text: string, outgoing: OutgoingDraft | null) => {
      await restoreRef.current;
      if (runningHereRef.current > 0 && !isStopped()) {
        console.warn("[relay] message not sent: a tool is still running");
        return;
      }
      await awaitStoppedTools();
      const settled = settlePendingForMessage(
        messagesRef.current,
        runningRef.current,
        text,
      );
      if (settled !== messagesRef.current) setMessages(settled);
      if (!useRelayStore.getState().activeThreadId) {
        ownedThreadIdRef.current = draftId;
        try {
          await useRelayStore.getState().startThread({ id: draftId });
          setDraftId(newThreadId());
        } catch (error) {
          // The conversation still works in memory; it just will not persist.
          ownedThreadIdRef.current = null;
          console.warn("[relay] creating the thread failed", { error });
        }
      }
      // The attachments are exactly the pills in this message (COMP-06).
      const attachments = buildAttachmentMetadata(
        outgoing?.attachments ?? [],
        createZustandStoreAccess(),
      );
      const segments = segmentMetadata(outgoing?.segments ?? []);
      const metadata = {
        ...(attachments.length > 0 ? { attachments } : {}),
        ...segments,
        ...slashCommandMetadata(outgoing?.segments ?? []),
      };
      beginTurn();
      void sendMessage({
        text,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
    },
    [
      awaitStoppedTools,
      beginTurn,
      draftId,
      runningRef,
      sendMessage,
      setMessages,
    ],
  );

  const send = useCallback(
    (text: string) => {
      // Taken before any await: the composer empties its editor right after this call.
      const outgoing = useRelayStore.getState().takeOutgoing();
      const trimmed = text.trim();
      if (!trimmed) return;
      clearError();
      if (!online) {
        setOfflineError({ code: "offline" });
        return;
      }
      void submit(trimmed, outgoing);
    },
    [clearError, online, submit],
  );

  // A suggestion chosen outside the composer; wait for an idle chat so it never interrupts a turn.
  const pendingPrompt = useRelayStore((s) => s.pendingPrompt);
  useEffect(() => {
    if (!pendingPrompt || shownStatus !== "ready") return;
    useRelayStore.getState().clearPendingPrompt();
    send(pendingPrompt);
  }, [pendingPrompt, shownStatus, send]);

  const liveTurn = useRelayStore((s) => s.liveTurn);
  // Persist as the turn goes (throttled while a reply streams) and once it settles.
  useEffect(() => {
    if (!activeThreadId || ownedThreadIdRef.current !== activeThreadId) return;
    if (messages.length === 0) return;
    if (isUnchangedRestore(messages, restoredMessagesRef.current)) return;
    scheduleThreadSave(
      activeThreadId,
      {
        messages: withRunningTurn(messages, liveTurn),
        interruptedMessageId,
      },
      { throttle: status === "streaming" },
    );
  }, [activeThreadId, messages, status, interruptedMessageId, liveTurn]);

  // Times the turn in flight and, once it has settled, stamps it onto its message.
  useEffect(() => {
    const live = useRelayStore.getState().liveTurn;
    const last = messages.at(-1);
    if (!live) return;
    if (last?.role !== "assistant") {
      // An error before the first assistant message leaves no message to stamp; just stop the timer.
      if (status === "error") useRelayStore.getState().setLiveTurn(null);
      return;
    }
    if (live.messageId && live.messageId !== last.id) return;
    const now = Date.now();
    const turn = syncSteps(
      live.turn,
      observeSteps(last, runningRef.current),
      now,
    );
    const idle =
      SETTLED_STATUSES.has(status) &&
      runningHere === 0 &&
      !hasOpenToolCall(last) &&
      (finishReasonRef.current !== null ||
        status === "error" ||
        !shouldContinueToolLoop({ messages }));
    if (!idle) {
      if (turn !== live.turn || !live.messageId) {
        useRelayStore.getState().setLiveTurn({ messageId: last.id, turn });
      }
      return;
    }
    const outcome = status === "error" ? "error" : finishReasonRef.current;
    const finished = finishTurn(turn, outcome ?? "done", now);
    useRelayStore.getState().setLiveTurn(null);
    const kept = keptRef.current;
    keptRef.current = [];
    setMessages(
      messagesRef.current.map((message) =>
        message.id === last.id
          ? withKeptChangeIds(withTurnTiming(message, finished), kept)
          : message,
      ),
    );
    const turnId = messagesRef.current.findLast((m) => m.role === "user")?.id;
    if (kept.length > 0 && turnId) {
      void getRelayChangeLog().rekey(kept, turnId);
    }
    applyPendingDisable();
  }, [messages, status, runningHere, setMessages, runningRef]);

  const resolveTool = queue.resolve;

  const editAndResend = useCallback(
    (messageId: string, text: string) => {
      const trimmed = text.trim();
      const index = messagesRef.current.findIndex((m) => m.id === messageId);
      if (!trimmed || index < 0) return;
      void (async () => {
        const kept = await confirmDiscard(
          messagesRef.current.slice(index),
          messageId,
        );
        if (kept === null) return;
        keptRef.current = kept;
        const remaining = messagesRef.current.slice(0, index);
        // `submit` reads this ref before the next render, so it must see the trimmed thread.
        messagesRef.current = remaining;
        setMessages(remaining);
        send(trimmed);
      })();
    },
    [send, setMessages],
  );

  const stopTurn = useCallback(() => {
    finishReasonRef.current = "stopped";
    useRelayTurnStore.getState().transition("stopped", "the user pressed Stop");
    queue.abortAll();
    void stop();
    // A card still waiting for an answer would otherwise stay open with no turn behind it.
    const settled = declinePendingTools(
      messagesRef.current,
      runningRef.current,
    );
    if (settled !== messagesRef.current) setMessages(settled);
  }, [queue, runningRef, stop, setMessages]);

  const regenerateTurn = useCallback(() => {
    void (async () => {
      const all = messagesRef.current;
      const lastUser = all.findLastIndex((m) => m.role === "user");
      const kept = await confirmDiscard(
        all.slice(lastUser + 1),
        all[lastUser]?.id ?? chatIdRef.current,
      );
      if (kept === null) return;
      keptRef.current = kept;
      clearError();
      await awaitStoppedTools();
      beginTurn();
      void regenerate();
    })();
  }, [awaitStoppedTools, beginTurn, clearError, regenerate]);

  const retryTurn = useCallback(() => {
    void (async () => {
      clearError();
      await awaitStoppedTools();
      const resent = trimToLastCompletedStep(messagesRef.current);
      if (resent !== messagesRef.current) {
        messagesRef.current = resent;
        setMessages(resent);
      }
      beginTurn();
      void sendMessage();
    })();
  }, [awaitStoppedTools, beginTurn, clearError, sendMessage, setMessages]);

  const continueTurn = useCallback(
    () => send(STEP_CAP_CONTINUE_PROMPT),
    [send],
  );

  const error =
    offlineError ??
    (sdkError ? mapClientError(sdkError, online) : null) ??
    (phase === "capped" ? { code: STEP_CAP_ERROR_CODE } : null);

  return {
    messages,
    status: shownStatus,
    error,
    online,
    interruptedMessageId,
    send,
    resolveTool,
    stop: stopTurn,
    regenerate: regenerateTurn,
    retry: retryTurn,
    continueTurn,
    clearError,
    editAndResend,
  };
}
