"use client";

import type { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { type RefObject, useCallback, useRef, useState } from "react";
import {
  createZustandWorkspaceWriter,
  getRelayChangeLog,
} from "@/lib/relay/changeLog";
import type { ContextChip } from "@/lib/relay/chips";
import { pushRoute } from "@/lib/relay/openEntity";
import { latestUserAttachments } from "@/lib/relay/outgoingMessages";
import { buildRedactContext } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  clearToolRunning,
  markToolRunning,
  settleStoredToolOutput,
} from "@/lib/relay/threadDb";
import { createBrowserNetworkPort } from "@/lib/relay/tools/network";
import {
  executeTool,
  grantApproval,
  relayToolRegistry,
  type ToolContext,
  type ToolOutcome,
} from "@/lib/relay/tools/registry";
import { declinedError } from "@/lib/relay/tools/schemas";
import { DISABLE_AFTER_TURN } from "@/lib/relay/tools/settingsWrite";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import {
  decidedMode,
  forgetAwaiting,
  pendingToolCalls,
  recordAwaiting,
  type ToolCallInfo,
  type ToolResolution,
} from "./relayTurnHelpers";

export type AddToolOutput = ReturnType<typeof useChat>["addToolOutput"];

/** Output for a call the user stopped before it began; nothing was applied. */
export const ABORTED_BEFORE_START_ERROR = "stopped by the user before it ran";
/** Output for a call that arrives after Relay was turned off in another tab. */
export const RELAY_DISABLED_ERROR = "Relay was turned off";

/**
 * Everything one tool call needs, captured when the call arrives. A thread
 * switch, a later message or a mode flip can then never redirect its writes,
 * its change attribution or its output (HH-TURN).
 */
export type ToolBinding = {
  toolCallId: string;
  threadId: string;
  /** The user message that started the turn; the turn's changes undo together. */
  turnId: string;
  /** The turn's attachments; the composer's chips are already cleared by the time a tool runs. */
  attachments: readonly ContextChip[];
  addToolOutput: AddToolOutput;
  /** Aborted by Stop; the tool's signal. */
  controller: AbortController;
};

type ToolQueueDeps = {
  chatIdRef: RefObject<string>;
  messagesRef: RefObject<UIMessage[]>;
  addToolOutputRef: RefObject<AddToolOutput | null>;
};

/** What the user's answer unlocks for one call. */
type ToolGrant = Pick<ToolContext, "approval" | "selection">;

function createBinding(
  toolCallId: string,
  { chatIdRef, messagesRef, addToolOutputRef }: ToolQueueDeps,
): ToolBinding | null {
  const addToolOutput = addToolOutputRef.current;
  if (!addToolOutput) {
    console.error("[relay] chat is not ready for tool output", { toolCallId });
    return null;
  }
  const threadId = chatIdRef.current;
  const messages = messagesRef.current;
  return {
    toolCallId,
    threadId,
    turnId: messages.findLast((m) => m.role === "user")?.id ?? threadId,
    attachments: latestUserAttachments(messages),
    addToolOutput,
    controller: new AbortController(),
  };
}

/** True when an approved preference change asked to turn Relay off once the reply ends. */
function asksToDisableRelay(output: ToolOutcome): boolean {
  return (
    output.ok &&
    (output.data as Record<string, unknown> | null)?.[DISABLE_AFTER_TURN] ===
      true
  );
}

type RunArgs = {
  toolCall: ToolCallInfo;
  binding: ToolBinding;
  grant: ToolGrant | undefined;
  navigate: (href: string) => void;
};

/** Runs a tool against the live stores under its binding and returns the redacted result. */
async function runBoundTool({
  toolCall,
  binding,
  grant,
  navigate,
}: RunArgs): Promise<ToolOutcome> {
  if (binding.controller.signal.aborted) {
    return { ok: false, error: ABORTED_BEFORE_START_ERROR };
  }
  if (!useRelayStore.getState().enabled) {
    return { ok: false, error: RELAY_DISABLED_ERROR };
  }
  const store = createZustandStoreAccess();
  const redact = buildRedactContext(
    store.environments(),
    useRelayStore.getState().shareValues,
  );
  return executeTool(relayToolRegistry, toolCall.toolName, toolCall.input, {
    store,
    redact,
    write: {
      log: getRelayChangeLog(),
      writer: createZustandWorkspaceWriter(),
      origin: {
        threadId: binding.threadId,
        turnId: binding.turnId,
        toolCallId: toolCall.toolCallId,
      },
    },
    network: createBrowserNetworkPort(),
    navigate,
    attached: binding.attachments,
    // The mode the call was decided under, so a flip while it queues cannot re-gate it.
    permissionMode:
      decidedMode(toolCall.toolCallId) ??
      useRelayPermissionStore.getState().mode,
    signal: binding.controller.signal,
    ...grant,
  });
}

/** The user left the thread this call belongs to: its result is written into the stored thread. */
async function storeOutputForHiddenThread(
  binding: ToolBinding,
  toolCall: ToolCallInfo,
  output: ToolOutcome,
): Promise<void> {
  const stored = await settleStoredToolOutput(
    binding.threadId,
    toolCall.toolCallId,
    output,
  );
  if (stored) return;
  console.warn("[relay] dropped a tool output for a deleted thread", {
    threadId: binding.threadId,
    toolCallId: toolCall.toolCallId,
  });
}

export type ToolQueue = {
  /** Called as each tool call arrives from the stream. */
  handleToolCall: (toolCall: ToolCallInfo) => void;
  /** Answers a card; the tool runs only on approve or answer. */
  resolve: (toolCallId: string, resolution: ToolResolution) => void;
  /** Aborts every call bound so far (Stop). */
  abortAll: () => void;
  /** Settles when every call queued so far has finished. */
  whenIdle: () => Promise<void>;
  /** Calls queued or running, with the thread each belongs to; the chat reads "ready" meanwhile but is not idle. */
  running: readonly RunningCall[];
  /** Ids of calls queued or running; they must not be auto-declined. */
  runningRef: RefObject<Set<string>>;
};

export type RunningCall = { toolCallId: string; threadId: string };

/**
 * Tool calls run one at a time, in the order the model made them, each under
 * the binding captured at call time.
 */
export function useToolQueue(deps: ToolQueueDeps): ToolQueue {
  const router = useRouter();
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const bindingsRef = useRef<Map<string, ToolBinding>>(new Map());
  const runningRef = useRef<Set<string>>(new Set());
  /** Outputs handed to a chat but not yet recorded in it. */
  const deliveriesRef = useRef<Set<Promise<void>>>(new Set());
  const [running, setRunning] = useState<readonly RunningCall[]>([]);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  /** Delivers to the chat that is showing the thread, else patches the stored thread. */
  const deliver = useCallback(
    (binding: ToolBinding, toolCall: ToolCallInfo, output: ToolOutcome) => {
      const { chatIdRef, addToolOutputRef } = depsRef.current;
      const delivery =
        binding.threadId === chatIdRef.current
          ? (addToolOutputRef.current ?? binding.addToolOutput)({
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              output,
            } as Parameters<AddToolOutput>[0])
          : storeOutputForHiddenThread(binding, toolCall, output);
      const tracked: Promise<void> = Promise.resolve(delivery)
        .catch((error) => {
          console.error("[relay] recording a tool output failed", {
            tool: toolCall.toolName,
            error,
          });
        })
        .finally(() => deliveriesRef.current.delete(tracked));
      deliveriesRef.current.add(tracked);
    },
    [],
  );

  /** Never await addToolOutput inside onToolCall: it deadlocks the stream. */
  const enqueue = useCallback(
    (toolCall: ToolCallInfo, binding: ToolBinding, grant?: ToolGrant) => {
      const { toolCallId } = toolCall;
      runningRef.current.add(toolCallId);
      setRunning((calls) => [
        ...calls,
        { toolCallId, threadId: binding.threadId },
      ]);
      const marked = grant
        ? markToolRunning(binding.threadId, toolCallId)
        : Promise.resolve();
      queueRef.current = queueRef.current
        .then(() => marked)
        .then(async () => {
          const output = await runBoundTool({
            toolCall,
            binding,
            grant,
            navigate: (href) => pushRoute(href, router.push),
          });
          if (asksToDisableRelay(output)) {
            useRelayStore.getState().setPendingDisable({
              threadId: binding.threadId,
              turnId: binding.turnId,
              toolCallId,
            });
          }
          deliver(binding, toolCall, output);
        })
        .catch((error) => {
          console.error("[relay] running a tool failed", {
            tool: toolCall.toolName,
            error,
          });
        })
        .finally(() => {
          runningRef.current.delete(toolCallId);
          forgetAwaiting(toolCallId);
          bindingsRef.current.delete(toolCallId);
          void clearToolRunning(binding.threadId, toolCallId);
          setRunning((calls) =>
            calls.filter((call) => call.toolCallId !== toolCallId),
          );
        });
    },
    [deliver, router.push],
  );

  const handleToolCall = useCallback(
    (toolCall: ToolCallInfo) => {
      const binding = createBinding(toolCall.toolCallId, depsRef.current);
      if (!binding) return;
      bindingsRef.current.set(toolCall.toolCallId, binding);
      // A card waits for the user; its result comes from `resolve`.
      if (recordAwaiting(toolCall)) return;
      enqueue(toolCall, binding);
    },
    [enqueue],
  );

  const resolve = useCallback(
    (toolCallId: string, resolution: ToolResolution) => {
      const { messagesRef } = depsRef.current;
      const call = pendingToolCalls(
        messagesRef.current,
        runningRef.current,
      ).find((item) => item.toolCallId === toolCallId);
      if (!call) return;
      const binding =
        bindingsRef.current.get(toolCallId) ??
        createBinding(toolCallId, depsRef.current);
      if (!binding) return;
      if (resolution.kind === "decline") {
        forgetAwaiting(toolCallId);
        bindingsRef.current.delete(toolCallId);
        deliver(binding, call, {
          ok: false,
          error: declinedError(call.toolName),
        });
        return;
      }
      bindingsRef.current.set(toolCallId, binding);
      enqueue(call, binding, {
        ...(resolution.kind === "answer"
          ? { selection: resolution.choice }
          : {}),
        ...(resolution.kind === "approve" ||
        (resolution.kind === "answer" && resolution.approve)
          ? { approval: grantApproval() }
          : {}),
      });
    },
    [deliver, enqueue],
  );

  const abortAll = useCallback(() => {
    for (const binding of bindingsRef.current.values()) {
      binding.controller.abort();
    }
  }, []);

  const whenIdle = useCallback(async () => {
    await queueRef.current;
    await Promise.all([...deliveriesRef.current]);
  }, []);

  return {
    handleToolCall,
    resolve,
    abortAll,
    whenIdle,
    running,
    runningRef,
  };
}
