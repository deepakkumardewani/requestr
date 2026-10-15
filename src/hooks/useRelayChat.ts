"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAnonUserId } from "@/lib/anonUser";
import {
  createZustandWorkspaceWriter,
  getRelayChangeLog,
} from "@/lib/relay/changeLog";
import {
  RELAY_CHAT_API,
  RELAY_MAX_STEPS,
  RELAY_USER_HEADER,
} from "@/lib/relay/constants";
import {
  buildChatPayload,
  chainIdFromPathname,
} from "@/lib/relay/contextBuilder";
import {
  type MappedRelayError,
  parseRelayErrorMessage,
} from "@/lib/relay/errors";
import { buildRedactContext } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
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
      awaitsUser(toolName, part.input);
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

/** What the user chose on a card. */
export type ToolResolution =
  | { kind: "approve" }
  | { kind: "decline" }
  | { kind: "answer"; choice: string };

/** Falls back by transport state when the message carries no Relay code. */
function mapClientError(error: Error, online: boolean): MappedRelayError {
  const parsed = parseRelayErrorMessage(error.message);
  if (parsed) return parsed;
  return { code: online ? "relay_unavailable" : "offline" };
}

type AddToolOutput = ReturnType<typeof useChat>["addToolOutput"];

type ToolCallInfo = { toolName: string; toolCallId: string; input: unknown };

/** Who a tool call's changes are recorded against; ties them to one reply for "Undo all". */
type ToolRunOrigin = { threadId: string; turnId: string };

/** What the user's answer unlocks for one call. */
type ToolGrant = Pick<ToolContext, "approval" | "signal" | "selection">;

/** Runs a tool against the live stores and hands the redacted result back to the model. */
async function runTool(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutput,
  { threadId, turnId }: ToolRunOrigin,
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
  const pathname = usePathname();
  // The transport is built once, so it reads the live route and chip choices through refs.
  const chainIdRef = useRef<string | null>(null);
  chainIdRef.current = chainIdFromPathname(pathname);
  /** Chips removed for the message being answered; kept for every request of that turn. */
  const turnRemovedChipsRef = useRef<readonly string[]>([]);
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
        stopControllersRef.current.delete(toolCall.toolCallId);
        if (grant) setApprovedRunning((count) => count - 1);
      });
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: RELAY_CHAT_API,
        headers: () => ({ [RELAY_USER_HEADER]: getAnonUserId() }),
        prepareSendMessagesRequest: ({ messages, body, ...rest }) => {
          const store = createZustandStoreAccess();
          const payload = buildChatPayload({
            messages,
            store,
            redact: buildRedactContext(
              store.environments(),
              useRelayStore.getState().shareValues,
            ),
            removedChipKeys: turnRemovedChipsRef.current,
            attachedItems: useRelayStore.getState().attachedItems,
            activeChainId: chainIdRef.current,
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
      if (awaitsUser(toolCall.toolName, toolCall.input)) return;
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
  }, [sdkError, offlineError, lastMessage]);

  const clearError = useCallback(() => {
    setOfflineError(null);
    setInterruptedMessageId(null);
    chat.clearError();
  }, [chat]);

  const submit = useCallback(
    async (text: string) => {
      await restoreRef.current;
      const settled = declinePendingTools(
        messagesRef.current,
        runningToolsRef.current,
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
      const relay = useRelayStore.getState();
      turnRemovedChipsRef.current = relay.removedChipKeys;
      relay.resetRemovedChips();
      void sendMessage({ text });
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
        ...(resolution.kind === "approve"
          ? { approval: grantApproval() }
          : { selection: resolution.choice }),
      });
    },
    // `enqueueTool` only reads refs, so it is safe to leave out.
    [],
  );

  const stopTurn = useCallback(() => {
    for (const controller of stopControllersRef.current.values()) {
      controller.abort();
    }
    void stop();
  }, [stop]);

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
  };
}
