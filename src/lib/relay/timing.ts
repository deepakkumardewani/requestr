import type { UIMessage } from "ai";

const MS_PER_SECOND = 1000;

export type TurnStatus = "running" | "done" | "stopped" | "error";
export type TurnStepKind = "thinking" | "tool" | "text" | "waiting";

/** One step of a turn, as epoch ms. `toolName` is internal and never rendered. */
export type TurnStep = {
  id: string;
  kind: TurnStepKind;
  toolName?: string;
  startedAt: number;
  endedAt?: number;
};

/** The value of an assistant message's `metadata.turn` (CONV-01). */
export type TurnTiming = {
  startedAt: number;
  endedAt?: number;
  status: TurnStatus;
  steps: TurnStep[];
};

/** What a streaming part looks like to the timer; `done` ends its step. */
export type ObservedStep = Omit<TurnStep, "startedAt" | "endedAt"> & {
  done: boolean;
};

export function startTurn(now: number): TurnTiming {
  return { startedAt: now, status: "running", steps: [] };
}

function endOpenSteps(
  steps: TurnStep[],
  now: number,
  keep?: (step: TurnStep) => boolean,
): TurnStep[] {
  return steps.map((step) =>
    step.endedAt === undefined && !keep?.(step)
      ? { ...step, endedAt: now }
      : step,
  );
}

/** Tool and waiting steps run until their own result; reasoning and text end when the next step starts. */
const isLongRunning = (step: TurnStep): boolean =>
  step.kind === "tool" || step.kind === "waiting";

export function startStep(
  turn: TurnTiming,
  step: Omit<TurnStep, "startedAt" | "endedAt">,
  now: number,
): TurnTiming {
  if (turn.steps.some((existing) => existing.id === step.id)) return turn;
  return {
    ...turn,
    steps: [
      ...endOpenSteps(turn.steps, now, isLongRunning),
      { ...step, startedAt: now },
    ],
  };
}

export function endStep(
  turn: TurnTiming,
  stepId: string,
  now: number,
): TurnTiming {
  const target = turn.steps.find((step) => step.id === stepId);
  if (!target || target.endedAt !== undefined) return turn;
  return {
    ...turn,
    steps: turn.steps.map((step) =>
      step.id === stepId ? { ...step, endedAt: now } : step,
    ),
  };
}

/** Starts steps never seen before and ends those the stream reports finished; idempotent. */
export function syncSteps(
  turn: TurnTiming,
  observed: readonly ObservedStep[],
  now: number,
): TurnTiming {
  return observed.reduce((acc, { done, ...step }) => {
    // A card that was never seen pending has nothing to time.
    if (done && step.kind === "waiting") return endStep(acc, step.id, now);
    const started = startStep(acc, step, now);
    return done ? endStep(started, step.id, now) : started;
  }, turn);
}

export function finishTurn(
  turn: TurnTiming,
  status: Exclude<TurnStatus, "running">,
  now: number,
): TurnTiming {
  if (turn.status !== "running") return turn;
  return {
    ...turn,
    status,
    endedAt: now,
    steps: endOpenSteps(turn.steps, now),
  };
}

/** Time spent on cards awaiting the user; the open one counts up to `now`. */
function waitingMs(turn: TurnTiming, now: number): number {
  return turn.steps
    .filter((step) => step.kind === "waiting")
    .reduce((sum, step) => sum + ((step.endedAt ?? now) - step.startedAt), 0);
}

/** True while a confirm or question card is pending. */
export function isWaiting(turn: TurnTiming): boolean {
  return turn.steps.some(
    (step) => step.kind === "waiting" && step.endedAt === undefined,
  );
}

/** Active time in ms: send to the end, minus time waiting for the user (Assumption 10). */
export function activeMs(turn: TurnTiming, now: number): number {
  const live = turn.status === "running";
  const end = turn.endedAt ?? (live ? now : turn.startedAt);
  return Math.max(0, end - turn.startedAt - waitingMs(turn, end));
}

export const activeSeconds = (turn: TurnTiming, now: number): number =>
  Math.floor(activeMs(turn, now) / MS_PER_SECOND);

export type TurnLabelKind =
  | "worked"
  | "stopped"
  | "failed"
  | "interrupted"
  | "legacy";

export type TurnLabel = { kind: TurnLabelKind; seconds?: number };

/** Where an interrupted turn stopped: the last step's end, else its start, else the turn's start. */
function interruptedMs(turn: TurnTiming): number {
  const last = turn.steps.at(-1);
  const end = last?.endedAt ?? last?.startedAt ?? turn.startedAt;
  return Math.max(0, end - turn.startedAt - waitingMs(turn, end));
}

/**
 * The CONV-11 label for a settled message. A `running` turn that is no longer
 * live was cut off by a reload, so it reads Interrupted; nothing is persisted.
 */
export function resolveTurnLabel(turn: TurnTiming | undefined): TurnLabel {
  if (!turn) return { kind: "legacy" };
  if (turn.status === "running") {
    return {
      kind: "interrupted",
      seconds: Math.floor(interruptedMs(turn) / MS_PER_SECOND),
    };
  }
  const kind: TurnLabelKind =
    turn.status === "done"
      ? "worked"
      : turn.status === "stopped"
        ? "stopped"
        : "failed";
  return { kind, seconds: activeSeconds(turn, turn.endedAt ?? turn.startedAt) };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads `metadata.turn` defensively: older and foreign messages carry none. */
export function readTurnTiming(metadata: unknown): TurnTiming | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.turn)) return undefined;
  const turn = metadata.turn;
  const valid =
    typeof turn.startedAt === "number" &&
    typeof turn.status === "string" &&
    Array.isArray(turn.steps);
  return valid ? (turn as unknown as TurnTiming) : undefined;
}

/** The message with `turn` merged into its metadata, other metadata kept. */
export function withTurnTiming(
  message: UIMessage,
  turn: TurnTiming,
): UIMessage {
  const metadata = isRecord(message.metadata) ? message.metadata : {};
  return { ...message, metadata: { ...metadata, turn } };
}

/** The message without `metadata.turn`; returns the same object when it carries none. */
export function withoutTurnTiming(message: UIMessage): UIMessage {
  if (!isRecord(message.metadata) || !("turn" in message.metadata)) {
    return message;
  }
  const { turn: _turn, ...rest } = message.metadata;
  const { metadata: _metadata, ...message_ } = message;
  return Object.keys(rest).length > 0
    ? { ...message_, metadata: rest }
    : message_;
}
