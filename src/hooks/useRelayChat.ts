"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAnonUserId } from "@/lib/anonUser";
import { buildAttachmentMetadata } from "@/lib/relay/attachments";
import {
  createZustandWorkspaceWriter,
  getRelayChangeLog,
} from "@/lib/relay/changeLog";
import type { ContextChip } from "@/lib/relay/chips";
import {
  RELAY_CHAT_API,
  RELAY_MAX_STEPS,
  RELAY_USER_HEADER,
} from "@/lib/relay/constants";
import { buildChatPayload } from "@/lib/relay/contextBuilder";
import {
  type MappedRelayError,
  parseRelayErrorMessage,
} from "@/lib/relay/errors";
import {
  latestUserAttachments,
  prepareOutgoingMessages,
} from "@/lib/relay/outgoingMessages";
import type { RelayPermissionMode } from "@/lib/relay/permission";
import { buildRedactContext } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  flushThreadWrites,
  getThread,
  newThreadId,
  scheduleThreadSave,
} from "@/lib/relay/threadDb";
import { createBrowserNetworkPort } from "@/lib/relay/tools/network";
import {
  executeTool,
  grantApproval,
  relayToolRegistry,
  type ToolContext,
} from "@/lib/relay/tools/registry";
import { awaitsUser, USER_DECLINED_ERROR } from "@/lib/relay/tools/schemas";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useOnlineStatus } from "./useOnlineStatus";

export type RelayChatStatus = "ready" | "submitted" | "streaming" | "error";

export type RelayChat = {
  messages: UIMessage[];
  status: RelayChatStatus;
  /** Mapped FR-70 error, or null. Never carries provider text. */
  error: MappedRelayError | null;
  online: boolean;
  /** Id of an assistant message cut short by an error or lost connection (FR-71). */
  interruptedMessageId: string | null;
  send: (text: string) => void;
  /** Answers a Confirmation or question card; the tool runs only on approve or answer. */
  resolveTool: (toolCallId: string, resolution: ToolResolution) => void;
  /** Aborts the stream; the thread stays usable (FR-20). */
  stop: () => void;
  /** Replaces the last assistant turn; also retries after an error (FR-20). */
  regenerate: () => void;
  clearError: () => void;
  /** Drops `messageId` and everything after it, then sends `text` in its place (FR-191). */
  editAndResend: (messageId: string, text: string) => void;
};

function hasText(message: UIMessage | undefined): message is UIMessage {
  return (
    message?.role === "assistant" &&
    message.parts.some((part) => part.type === "text" && part.text.length > 0)
  );
}

/** The chat copies the array it is given, so compare message objects, not the array. */
function isUnchangedRestore(
  messages: UIMessage[],
  restored: UIMessage[] | null,
): boolean {
  return (
    restored !== null &&
    messages.length === restored.length &&
    messages.every((message, index) => message === restored[index])
  );
}

const STEP_START_PART = "step-start";

/** Model steps taken since the user last spoke; mirrors the server's cap (FR-21). */
export function countStepsSinceLastUser(messages: UIMessage[]): number {
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  return messages
    .slice(lastUser + 1)
    .flatMap((m) => m.parts)
    .filter((part) => part.type === STEP_START_PART).length;
}

/** Continues the tool loop only while the turn is under its step cap. */
export function shouldContinueToolLoop({
  messages,
}: {
  messages: UIMessage[];
}): boolean {
  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
    countStepsSinceLastUser(messages) < RELAY_MAX_STEPS
  );
}

const TOOL_PART_PREFIX = "tool-";

/** Output for a card the user never answered; the card says why it was closed. */
export const AUTO_DECLINED_OUTPUT = {
  ok: false,
  error: USER_DECLINED_ERROR,
  autoDeclined: true,
} as const;

type ToolPart = {
  type: string;
  state: string;
  toolCallId: string;
  input?: unknown;
};

function isToolPart(
  part: UIMessage["parts"][number],
): part is ToolPart & UIMessage["parts"][number] {
  return part.type.startsWith(TOOL_PART_PREFIX);
}

/**
 * Whether each tool call awaited the user when it arrived, by call id. The
 * decision is recorded once so a mode change while a card is pending neither
 * orphans the card nor auto-approves it, and a running call is never re-prompted.
 */
type AwaitingDecision = { awaiting: boolean; mode: RelayPermissionMode };
const awaitingDecisions = new Map<string, AwaitingDecision>();

/** Records the decision for a new call under the current mode and returns it. */
function recordAwaiting(toolCall: ToolCallInfo): boolean {
  const mode = useRelayPermissionStore.getState().mode;
  const awaiting = awaitsUser(toolCall.toolName, toolCall.input, mode);
  awaitingDecisions.set(toolCall.toolCallId, { awaiting, mode });
  return awaiting;
}

/**
 * The recorded decision for a call, else (a thread restored from storage)
 * evaluated now under the current mode.
 */
export function isToolAwaiting(
  toolCallId: string,
  toolName: string,
  input: unknown,
): boolean {
  return (
    awaitingDecisions.get(toolCallId)?.awaiting ??
    awaitsUser(toolName, input, useRelayPermissionStore.getState().mode)
  );
}

/** Cards still waiting for the user in the newest assistant message. */
export function pendingToolCalls(
  messages: UIMessage[],
  running: ReadonlySet<string> = new Set(),
): ToolCallInfo[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return [];
  return last.parts.filter(isToolPart).flatMap((part) => {
    const toolName = part.type.slice(TOOL_PART_PREFIX.length);
    const waiting =
      part.state === "input-available" &&
      !running.has(part.toolCallId) &&
      isToolAwaiting(part.toolCallId, toolName, part.input);
    return waiting
      ? [{ toolName, toolCallId: part.toolCallId, input: part.input }]
      : [];
  });
}

/**
 * Closes every unanswered card as declined. A pending tool call followed by
 * another user message would otherwise make the next request invalid (SPIKE A).
 * Returns the same array when nothing was pending.
 */
export function declinePendingTools(
  messages: UIMessage[],
  running: ReadonlySet<string> = new Set(),
): UIMessage[] {
  const pending = new Set(
    pendingToolCalls(messages, running).map((call) => call.toolCallId),
  );
  if (pending.size === 0) return messages;
  return messages.map((message, index) =>
    index !== messages.length - 1
      ? message
      : ({
          ...message,
          parts: message.parts.map((part) =>
            isToolPart(part) && pending.has(part.toolCallId)
              ? {
                  ...part,
                  state: "output-available",
                  output: AUTO_DECLINED_OUTPUT,
                }
              : part,
          ),
        } as UIMessage),
  );
}

const ASK_USER_TOOL = "ask_user";

/**
 * Settles every card left open when the user sends a message: the first
 * question card takes the message as its answer (the bubble still renders),
 * everything else is closed as skipped.
 */
export function settlePendingForMessage(
  messages: UIMessage[],
  running: ReadonlySet<string>,
  text: string,
): UIMessage[] {
  const pending = pendingToolCalls(messages, running);
  const answered = pending.find((call) => call.toolName === ASK_USER_TOOL);
  if (!answered) return declinePendingTools(messages, running);
  const answer = {
    ok: true,
    data: { choice: text, viaComposer: true },
  } as const;
  return declinePendingTools(messages, running).map((message, index, all) =>
    index !== all.length - 1
      ? message
      : ({
          ...message,
          parts: message.parts.map((part) =>
            isToolPart(part) && part.toolCallId === answered.toolCallId
              ? { ...part, state: "output-available", output: answer }
              : part,
          ),
        } as UIMessage),
  );
}

/** What the user chose on a card. */
export type ToolResolution =
  | { kind: "approve" }
  | { kind: "decline" }
  /** `approve` also grants Approve, for a confirm tool whose card asks a question (FR-133). */
  | { kind: "answer"; choice: string; approve?: boolean };

/** Falls back by transport state when the message carries no Relay code. */
function mapClientError(error: Error, online: boolean): MappedRelayError {
  const parsed = parseRelayErrorMessage(error.message);
  if (parsed) return parsed;
  return { code: online ? "relay_unavailable" : "offline" };
}

type AddToolOutput = ReturnType<typeof useChat>["addToolOutput"];

type ToolCallInfo = { toolName: string; toolCallId: string; input: unknown };

/** Who a tool call's changes are recorded against; ties them to one reply for "Undo all". */
type ToolRunOrigin = {
  threadId: string;
  turnId: string;
  /** The current turn's attachments; the composer's chips are already cleared by then. */
  attached: readonly ContextChip[];
};

/** What the user's answer unlocks for one call. */
type ToolGrant = Pick<ToolContext, "approval" | "signal" | "selection">;

/** Runs a tool against the live stores and hands the redacted result back to the model. */
async function runTool(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutput,
  { threadId, turnId, attached }: ToolRunOrigin,
  grant: ToolGrant = {},
): Promise<void> {
  const store = createZustandStoreAccess();
  const redact = buildRedactContext(
    store.environments(),
    useRelayStore.getState().shareValues,
  );
  const output = await executeTool(
    relayToolRegistry,
    toolCall.toolName,
    toolCall.input,
    {
      store,
      redact,
      write: {
        log: getRelayChangeLog(),
        writer: createZustandWorkspaceWriter(),
        origin: { threadId, turnId, toolCallId: toolCall.toolCallId },
      },
      network: createBrowserNetworkPort(),
      attached,
      // The mode the call was decided under, so a flip while it queues cannot re-gate it.
      permissionMode:
        awaitingDecisions.get(toolCall.toolCallId)?.mode ??
        useRelayPermissionStore.getState().mode,
      ...grant,
    },
  );
  void addToolOutput({
    tool: toolCall.toolName,
    toolCallId: toolCall.toolCallId,
    output,
  } as Parameters<typeof addToolOutput>[0]);
}

export function useRelayChat(): RelayChat {
  const online = useOnlineStatus();
  const activeThreadId = useRelayStore((s) => s.activeThreadId);
  const hydrated = useRelayStore((s) => s.hydrated);
  // Chat id for a conversation with no stored thread yet; it becomes the
  // thread id on the first send so the chat is never rebuilt mid-turn.
  const [draftId, setDraftId] = useState(newThreadId);
  const chatId = activeThreadId ?? draftId;
  /** Tools run after the render that started them, so they read the current chat id here. */
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  /** Tool calls run one at a time, in the order the model made them. */
  const toolQueueRef = useRef<Promise<void>>(Promise.resolve());
  const addToolOutputRef = useRef<AddToolOutput | null>(null);
  const messagesRef = useRef<UIMessage[]>([]);

  /** Calls the user approved that are still running; they must not be auto-declined. */
  const runningToolsRef = useRef<Set<string>>(new Set());
  const stopControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Approved calls still running; the chat reads "ready" meanwhile, but Stop must stay reachable. */
  const [approvedRunning, setApprovedRunning] = useState(0);

  /** Never await addToolOutput inside onToolCall: it deadlocks the stream. */
  function enqueueTool(toolCall: ToolCallInfo, grant?: ToolGrant) {
    toolQueueRef.current = toolQueueRef.current
      .then(() => {
        const addToolOutput = addToolOutputRef.current;
        if (!addToolOutput)
          throw new Error("chat is not ready for tool output");
        return runTool(
          toolCall,
          addToolOutput,
          {
            threadId: chatIdRef.current,
            // A turn is the user message that started it, so its changes undo together.
            turnId:
              messagesRef.current.findLast((m) => m.role === "user")?.id ??
              chatIdRef.current,
            attached: latestUserAttachments(messagesRef.current),
          },
          grant,
        );
      })
      .catch((error) => {
        console.error("[relay] running a tool failed", {
          tool: toolCall.toolName,
          error,
        });
      })
      .finally(() => {
        runningToolsRef.current.delete(toolCall.toolCallId);
        awaitingDecisions.delete(toolCall.toolCallId);
        stopControllersRef.current.delete(toolCall.toolCallId);
        if (grant) setApprovedRunning((count) => count - 1);
      });
  }

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
    onToolCall: ({ toolCall }) => {
      // A card waits for the user; its result comes from `resolveTool`.
      if (recordAwaiting(toolCall)) return;
      enqueueTool(toolCall);
    },
  });
  addToolOutputRef.current = chat.addToolOutput;
  const { messages, status, stop, regenerate, sendMessage, setMessages } = chat;
  messagesRef.current = messages;

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

  // Leaving a thread (or closing the app) must not leave its stream running unseen.
  useEffect(
    () => () => {
      void stop();
    },
    [chatId, stop],
  );

  const interruptedIdRef = useRef<string | null>(null);
  interruptedIdRef.current = interruptedMessageId;

  // Disabling Relay unmounts the dock mid-turn: the effect above aborts the
  // stream, and this saves what arrived so re-enabling restores the thread (BUG-05).
  useEffect(
    () => () => {
      const threadId = ownedThreadIdRef.current;
      const current = messagesRef.current;
      if (!threadId || current.length === 0) return;
      if (isUnchangedRestore(current, restoredMessagesRef.current)) return;
      scheduleThreadSave(threadId, {
        messages: current,
        interruptedMessageId: interruptedIdRef.current,
      });
      void flushThreadWrites();
    },
    [],
  );

  // Declared before the restore effect: on a switch the restored state wins.
  useEffect(() => {
    setInterruptedMessageId(null);
    setOfflineError(null);
  }, [chatId]);

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
        restoredMessagesRef.current = thread.messages;
        // A card left open before the reload can no longer be answered.
        setMessages(declinePendingTools(thread.messages));
        setInterruptedMessageId(thread.interruptedMessageId);
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
  }, [hydrated, activeThreadId, setMessages]);

  const lastMessage = messages.at(-1);
  const sdkError = chat.error ?? null;

  // Losing the connection mid-stream keeps the partial text and marks it (FR-71).
  useEffect(() => {
    if (online || (status !== "streaming" && status !== "submitted")) return;
    void stop();
    setOfflineError({ code: "offline" });
  }, [online, status, stop]);

  useEffect(() => {
    if (!sdkError && !offlineError) return;
    if (hasText(lastMessage)) setInterruptedMessageId(lastMessage.id);
    // A card left open by a failed turn has nothing behind it any more.
    const settled = declinePendingTools(
      messagesRef.current,
      runningToolsRef.current,
    );
    if (settled !== messagesRef.current) setMessages(settled);
  }, [sdkError, offlineError, lastMessage, setMessages]);

  const clearError = useCallback(() => {
    setOfflineError(null);
    setInterruptedMessageId(null);
    chat.clearError();
  }, [chat]);

  const submit = useCallback(
    async (text: string) => {
      await restoreRef.current;
      const settled = settlePendingForMessage(
        messagesRef.current,
        runningToolsRef.current,
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
      const { attachedItems, clearAttachedItems } = useRelayStore.getState();
      const attachments = buildAttachmentMetadata(
        attachedItems,
        createZustandStoreAccess(),
      );
      void sendMessage({
        text,
        ...(attachments.length > 0 ? { metadata: { attachments } } : {}),
      });
      // Attachments belong to this message only; the next turn starts empty (BUG-01).
      clearAttachedItems();
    },
    [draftId, sendMessage, setMessages],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      clearError();
      if (!online) {
        setOfflineError({ code: "offline" });
        return;
      }
      void submit(trimmed);
    },
    [clearError, online, submit],
  );

  // A suggestion chosen outside the composer; wait for an idle chat so it never interrupts a turn.
  const pendingPrompt = useRelayStore((s) => s.pendingPrompt);
  useEffect(() => {
    if (!pendingPrompt || status !== "ready") return;
    useRelayStore.getState().clearPendingPrompt();
    send(pendingPrompt);
  }, [pendingPrompt, status, send]);

  // Persist once a turn settles (and when the question is first sent); never mid-stream.
  useEffect(() => {
    if (!activeThreadId || ownedThreadIdRef.current !== activeThreadId) return;
    if (status === "streaming" || messages.length === 0) return;
    if (isUnchangedRestore(messages, restoredMessagesRef.current)) return;
    scheduleThreadSave(activeThreadId, { messages, interruptedMessageId });
  }, [activeThreadId, messages, status, interruptedMessageId]);

  const resolveTool = useCallback(
    (toolCallId: string, resolution: ToolResolution) => {
      const call = pendingToolCalls(
        messagesRef.current,
        runningToolsRef.current,
      ).find((item) => item.toolCallId === toolCallId);
      const addToolOutput = addToolOutputRef.current;
      if (!call || !addToolOutput) return;
      if (resolution.kind === "decline") {
        awaitingDecisions.delete(toolCallId);
        void addToolOutput({
          tool: call.toolName,
          toolCallId,
          output: { ok: false, error: USER_DECLINED_ERROR },
        } as Parameters<typeof addToolOutput>[0]);
        return;
      }
      const controller = new AbortController();
      stopControllersRef.current.set(toolCallId, controller);
      runningToolsRef.current.add(toolCallId);
      setApprovedRunning((count) => count + 1);
      enqueueTool(call, {
        signal: controller.signal,
        ...(resolution.kind === "answer"
          ? { selection: resolution.choice }
          : {}),
        ...(resolution.kind === "approve" ||
        (resolution.kind === "answer" && resolution.approve)
          ? { approval: grantApproval() }
          : {}),
      });
    },
    // `enqueueTool` only reads refs, so it is safe to leave out.
    [],
  );

  const editAndResend = useCallback(
    (messageId: string, text: string) => {
      const trimmed = text.trim();
      const index = messagesRef.current.findIndex((m) => m.id === messageId);
      if (!trimmed || index < 0) return;
      const kept = messagesRef.current.slice(0, index);
      // `submit` reads this ref before the next render, so it must see the trimmed thread.
      messagesRef.current = kept;
      setMessages(kept);
      send(trimmed);
    },
    [send, setMessages],
  );

  const stopTurn = useCallback(() => {
    for (const controller of stopControllersRef.current.values()) {
      controller.abort();
    }
    void stop();
    // A card still waiting for an answer would otherwise stay open with no turn behind it.
    const settled = declinePendingTools(
      messagesRef.current,
      runningToolsRef.current,
    );
    if (settled !== messagesRef.current) setMessages(settled);
  }, [stop, setMessages]);

  const regenerateTurn = useCallback(() => {
    clearError();
    void regenerate();
  }, [clearError, regenerate]);

  const error =
    offlineError ?? (sdkError ? mapClientError(sdkError, online) : null);

  return {
    messages,
    status: status === "ready" && approvedRunning > 0 ? "streaming" : status,
    error,
    online,
    interruptedMessageId,
    send,
    resolveTool,
    stop: stopTurn,
    regenerate: regenerateTurn,
    clearError,
    editAndResend,
  };
}
