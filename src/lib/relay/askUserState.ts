/**
 * Question card state, written once so the card, the composer path and a
 * restored thread agree on what a card is showing (CONV-09).
 */
export type AskState =
  | { phase: "idle" }
  | { phase: "typed"; text: string }
  | { phase: "sent"; answer: string }
  | { phase: "answeredViaComposer"; answer: string }
  | { phase: "skipped" };

export type AskEvent =
  | { type: "choose"; option: string }
  | { type: "type"; text: string }
  | { type: "send" }
  | { type: "composerAnswer"; text: string }
  | { type: "skip" };

export const ASK_IDLE: AskState = { phase: "idle" };

export const isOpen = (state: AskState): boolean =>
  state.phase === "idle" || state.phase === "typed";

/** The answer a Send would deliver, or null when nothing sendable is typed. */
export function pendingAnswer(state: AskState): string | null {
  if (state.phase === "typed") return state.text.trim() || null;
  return null;
}

export const canSend = (state: AskState): boolean =>
  pendingAnswer(state) !== null;

/** Choosing an option answers at once; typed text waits for `send`. */
export function reduceAsk(state: AskState, event: AskEvent): AskState {
  if (!isOpen(state)) return state;
  switch (event.type) {
    case "choose":
      return { phase: "sent", answer: event.option };
    case "type":
      return event.text === ""
        ? ASK_IDLE
        : { phase: "typed", text: event.text };
    case "send": {
      const answer = pendingAnswer(state);
      return answer === null ? state : { phase: "sent", answer };
    }
    case "composerAnswer":
      return { phase: "answeredViaComposer", answer: event.text };
    case "skip":
      return { phase: "skipped" };
  }
}

type SettledOutput = {
  ok?: unknown;
  autoDeclined?: unknown;
  data?: { choice?: unknown; viaComposer?: unknown };
};

/** The state a stored tool part shows: still waiting, answered, or closed unanswered. */
export function askStateFromPart(pending: boolean, output: unknown): AskState {
  if (pending) return ASK_IDLE;
  const settled = (output ?? {}) as SettledOutput;
  const choice = settled.data?.choice;
  if (typeof choice === "string") {
    return settled.data?.viaComposer === true
      ? { phase: "answeredViaComposer", answer: choice }
      : { phase: "sent", answer: choice };
  }
  return { phase: "skipped" };
}
