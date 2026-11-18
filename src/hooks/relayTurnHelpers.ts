import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { KEPT_CHANGE_IDS_KEY } from "@/lib/relay/changeGroups";
import { RELAY_MAX_STEPS } from "@/lib/relay/constants";
import {
  type MappedRelayError,
  parseRelayErrorMessage,
  TOOL_INTERRUPTED_ERROR,
  TOOL_MAYBE_APPLIED_ERROR,
} from "@/lib/relay/errors";
import type { RelayPermissionMode } from "@/lib/relay/permission";
import {
  type ObservedStep,
  startTurn,
  type TurnTiming,
  withTurnTiming,
} from "@/lib/relay/timing";
import { awaitsUser, USER_DECLINED_ERROR } from "@/lib/relay/tools/schemas";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { type TurnPhase, useRelayTurnStore } from "@/stores/useRelayTurnStore";

export type RelayChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ToolCallInfo = {
  toolName: string;
  toolCallId: string;
  input: unknown;
};

/** What the user chose on a card. */
export type ToolResolution =
  | { kind: "approve" }
  | { kind: "decline" }
  /** `approve` also grants Approve, for a confirm tool whose card asks a question (FR-133). */
  | { kind: "answer"; choice: string; approve?: boolean };

export function hasText(message: UIMessage | undefined): message is UIMessage {
  return (
    message?.role === "assistant" &&
    message.parts.some((part) => part.type === "text" && part.text.length > 0)
  );
}

/** The chat copies the array it is given, so compare message objects, not the array. */
export function isUnchangedRestore(
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

/** True once the step cap, not the model, ended the turn (CONV-06). */
export function hitStepCap(messages: UIMessage[]): boolean {
  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
    countStepsSinceLastUser(messages) >= RELAY_MAX_STEPS
  );
}

/**
 * Continues the tool loop only while the turn is under its step cap and the
 * user has not pressed Stop. Read at call time: a Stop pressed while a tool ran
 * must not be undone by that tool's late result.
 */
export function shouldContinueToolLoop({
  messages,
}: {
  messages: UIMessage[];
}): boolean {
  if (useRelayTurnStore.getState().phase === "stopped") return false;
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

export type ToolPart = {
  type: string;
  state: string;
  toolCallId: string;
  input?: unknown;
  output?: unknown;
};

export function isToolPart(
  part: UIMessage["parts"][number],
): part is ToolPart & UIMessage["parts"][number] {
  return part.type.startsWith(TOOL_PART_PREFIX);
}

export function toolNameOf(part: { type: string }): string {
  return part.type.slice(TOOL_PART_PREFIX.length);
}

/**
 * Whether each tool call awaited the user when it arrived, by call id. The
 * decision is recorded once so a mode change while a card is pending neither
 * orphans the card nor auto-approves it, and a running call is never re-prompted.
 */
type AwaitingDecision = { awaiting: boolean; mode: RelayPermissionMode };
const awaitingDecisions = new Map<string, AwaitingDecision>();

/** Records the decision for a new call under the current mode and returns it. */
export function recordAwaiting(toolCall: ToolCallInfo): boolean {
  const mode = useRelayPermissionStore.getState().mode;
  const awaiting = awaitsUser(toolCall.toolName, toolCall.input, mode);
  awaitingDecisions.set(toolCall.toolCallId, { awaiting, mode });
  return awaiting;
}

export function forgetAwaiting(toolCallId: string): void {
  awaitingDecisions.delete(toolCallId);
}

/** The mode a call was decided under, if it was recorded. */
export function decidedMode(
  toolCallId: string,
): RelayPermissionMode | undefined {
  return awaitingDecisions.get(toolCallId)?.mode;
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
    const toolName = toolNameOf(part);
    const waiting =
      part.state === "input-available" &&
      !running.has(part.toolCallId) &&
      isToolAwaiting(part.toolCallId, toolName, part.input);
    return waiting
      ? [{ toolName, toolCallId: part.toolCallId, input: part.input }]
      : [];
  });
}

/** Rewrites the newest message, replacing the tool parts `replace` returns an output for. */
function withToolOutputs(
  messages: UIMessage[],
  replace: (part: ToolPart) => unknown | undefined,
): UIMessage[] {
  const last = messages.at(-1);
  if (!last) return messages;
  let changed = false;
  const parts = last.parts.map((part) => {
    if (!isToolPart(part)) return part;
    const output = replace(part);
    if (output === undefined) return part;
    changed = true;
    return { ...part, state: "output-available", output };
  });
  // Callers compare identity to learn whether anything was settled.
  return changed
    ? [...messages.slice(0, -1), { ...last, parts } as UIMessage]
    : messages;
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
  return withToolOutputs(messages, (part) =>
    pending.has(part.toolCallId) ? AUTO_DECLINED_OUTPUT : undefined,
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
  return withToolOutputs(declinePendingTools(messages, running), (part) =>
    part.toolCallId === answered.toolCallId ? answer : undefined,
  );
}

export const SETTLED_STATUSES: ReadonlySet<string> = new Set([
  "ready",
  "error",
]);
const TOOL_RESULT_STATES: ReadonlySet<string> = new Set([
  "output-available",
  "output-error",
]);

/** The timed steps of an assistant message, in part order. Step ids are stable across re-observation. */
export function observeSteps(
  message: UIMessage,
  running: ReadonlySet<string> = new Set(),
): ObservedStep[] {
  return message.parts.flatMap((part, index): ObservedStep[] => {
    if (part.type === "reasoning" || part.type === "text") {
      const kind = part.type === "text" ? "text" : "thinking";
      return [{ id: `p${index}`, kind, done: part.state === "done" }];
    }
    if (!isToolPart(part)) return [];
    const toolName = toolNameOf(part);
    const waiting =
      part.state === "input-available" &&
      !running.has(part.toolCallId) &&
      isToolAwaiting(part.toolCallId, toolName, part.input);
    if (waiting) {
      return [
        { id: `w:${part.toolCallId}`, kind: "waiting", toolName, done: false },
      ];
    }
    if (part.state === "input-streaming") return [];
    return [
      { id: `w:${part.toolCallId}`, kind: "waiting", toolName, done: true },
      {
        id: `t:${part.toolCallId}`,
        kind: "tool",
        toolName,
        done: TOOL_RESULT_STATES.has(part.state),
      },
    ];
  });
}

/** True while some call has no result yet: it is waiting on a card or still running. */
export function hasOpenToolCall(message: UIMessage | undefined): boolean {
  return (
    message?.role === "assistant" &&
    message.parts.some(
      (part) => isToolPart(part) && part.state === "input-available",
    )
  );
}

/** Starts timing a turn; its assistant message is adopted once the stream creates it. */
export function beginLiveTurn(): void {
  useRelayStore
    .getState()
    .setLiveTurn({ messageId: "", turn: startTurn(Date.now()) });
}

/**
 * The messages as they are saved mid-turn: the running turn rides along on its
 * message, so a tab closed before the turn settles reloads as Interrupted
 * (CONV-11). The in-memory messages stay untouched; the live turn is transient.
 */
export function withRunningTurn(
  messages: UIMessage[],
  live: { messageId: string; turn: TurnTiming } | null,
): UIMessage[] {
  if (!live?.messageId) return messages;
  return messages.map((message) =>
    message.id === live.messageId
      ? withTurnTiming(message, live.turn)
      : message,
  );
}

/** Falls back by transport state when the message carries no Relay code. */
export function mapClientError(
  error: Error,
  online: boolean,
): MappedRelayError {
  const parsed = parseRelayErrorMessage(error.message);
  if (parsed) return parsed;
  return { code: online ? "relay_unavailable" : "offline" };
}

const TOOL_SETTLED_STATES: ReadonlySet<string> = new Set([
  "output-available",
  "output-error",
]);

const isSettledToolPart = (part: UIMessage["parts"][number]): boolean =>
  !isToolPart(part) || TOOL_SETTLED_STATES.has(part.state);

/** Parts of one model step: a step starts at each `step-start` part. */
function splitSteps(
  parts: UIMessage["parts"],
): { start: number; end: number }[] {
  const starts = parts.flatMap((part, index) =>
    part.type === STEP_START_PART ? [index] : [],
  );
  if (starts.length === 0) return [{ start: 0, end: parts.length }];
  return starts.map((start, i) => ({
    start,
    end: starts[i + 1] ?? parts.length,
  }));
}

/**
 * The messages as a Retry resends them: everything up to the last model step
 * whose tool calls all have results. Completed steps are kept so a retry never
 * repeats a write, and the half-finished step after them is dropped. With no
 * such step the whole reply is dropped and the request ends on the user's
 * message, as a fresh ask would (HH-H05).
 */
export function trimToLastCompletedStep(messages: UIMessage[]): UIMessage[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return messages;
  const steps = splitSteps(last.parts);
  for (let i = steps.length - 1; i >= 0; i--) {
    const stepParts = last.parts.slice(steps[i].start, steps[i].end);
    const calls = stepParts.filter(isToolPart);
    if (calls.length === 0 || !stepParts.every(isSettledToolPart)) continue;
    if (steps[i].end === last.parts.length) return messages;
    return [
      ...messages.slice(0, -1),
      { ...last, parts: last.parts.slice(0, steps[i].end) },
    ];
  }
  return messages.slice(0, -1);
}

type PhaseInput = {
  status: RelayChatStatus;
  /** Tool calls running for this thread. */
  runningTools: number;
  failed: boolean;
  messages: UIMessage[];
  running: ReadonlySet<string>;
};

/** Where the turn is, from what the chat and the tool queue report. Never yields `stopped`: only Stop enters it. */
export function derivePhase({
  status,
  runningTools,
  failed,
  messages,
  running,
}: PhaseInput): Exclude<TurnPhase, "stopped"> {
  if (status === "submitted" || status === "streaming") return "streaming";
  if (runningTools > 0) return "running-tools";
  if (failed || status === "error") return "errored";
  if (pendingToolCalls(messages, running).length > 0) return "awaiting-user";
  return hitStepCap(messages) ? "capped" : "idle";
}

/**
 * Settles every call left without a result when a thread is restored, so no
 * row spins forever and the model is told the truth on the next request:
 * a call marked running may have applied, a card nobody answered is closed,
 * and an automatic call that never returned has an unknown outcome. Calls
 * still running in this page are left alone (HH-M22, HH-L03).
 */
export function settleInterruptedCalls(
  messages: UIMessage[],
  markedRunning: readonly string[],
  stillRunning: ReadonlySet<string>,
): UIMessage[] {
  return withToolOutputs(messages, (part) => {
    if (part.state !== "input-available" || stillRunning.has(part.toolCallId)) {
      return undefined;
    }
    if (markedRunning.includes(part.toolCallId)) {
      return { ok: false, error: TOOL_MAYBE_APPLIED_ERROR };
    }
    return isToolAwaiting(part.toolCallId, toolNameOf(part), part.input)
      ? AUTO_DECLINED_OUTPUT
      : { ok: false, error: TOOL_INTERRUPTED_ERROR };
  });
}

/** The message with `changeIds` recorded as kept from a discarded turn. */
export function withKeptChangeIds(
  message: UIMessage,
  changeIds: readonly string[],
): UIMessage {
  if (changeIds.length === 0) return message;
  const metadata =
    typeof message.metadata === "object" && message.metadata !== null
      ? message.metadata
      : {};
  return {
    ...message,
    metadata: { ...metadata, [KEPT_CHANGE_IDS_KEY]: [...changeIds] },
  };
}
