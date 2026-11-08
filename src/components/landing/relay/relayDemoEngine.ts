import type { ChangeCard, RelayScenario } from "./scenarios";

export const PROMPT_CHAR_MS = 35;
export const THINK_MS = 450;
export const REPLY_CHAR_MS = 16;
export const CARD_STAGGER_MS = 500;
export const HOLD_MS = 3200;

export interface RelayFrame {
  promptText: string;
  replyText: string;
  /** Number of change cards revealed so far. */
  visibleCards: number;
}

/** Elapsed time at which each phase of a scenario ends. */
function getTimeline(scenario: RelayScenario) {
  const promptEnd = scenario.prompt.length * PROMPT_CHAR_MS;
  const replyStart = promptEnd + THINK_MS;
  const replyEnd = replyStart + scenario.reply.length * REPLY_CHAR_MS;
  const cardsEnd = replyEnd + scenario.cards.length * CARD_STAGGER_MS;
  return { promptEnd, replyStart, replyEnd, cardsEnd };
}

/** Total ms a scenario plays, including the final hold before the next one. */
export function getScenarioDuration(scenario: RelayScenario): number {
  return getTimeline(scenario).cardsEnd + HOLD_MS;
}

/** Pure: the full visible state of the demo at `elapsedMs` into a scenario. */
export function getFrame(
  scenario: RelayScenario,
  elapsedMs: number,
): RelayFrame {
  const { promptEnd, replyStart, replyEnd } = getTimeline(scenario);
  const promptChars = Math.min(
    scenario.prompt.length,
    Math.floor(Math.max(0, elapsedMs) / PROMPT_CHAR_MS),
  );
  const replyChars =
    elapsedMs < replyStart
      ? 0
      : Math.min(
          scenario.reply.length,
          Math.floor((elapsedMs - replyStart) / REPLY_CHAR_MS),
        );
  const visibleCards =
    elapsedMs < replyEnd
      ? 0
      : Math.min(
          scenario.cards.length,
          Math.floor((elapsedMs - replyEnd) / CARD_STAGGER_MS) + 1,
        );
  return {
    promptText:
      elapsedMs >= promptEnd
        ? scenario.prompt
        : scenario.prompt.slice(0, promptChars),
    replyText: scenario.reply.slice(0, replyChars),
    visibleCards,
  };
}

/** The completed frame, used for reduced motion and static rendering. */
export function getFinalFrame(scenario: RelayScenario): RelayFrame {
  return {
    promptText: scenario.prompt,
    replyText: scenario.reply,
    visibleCards: scenario.cards.length,
  };
}

/** Badges per request id from the cards that are shown and not undone. */
export function getAppliedBadges(
  cards: ChangeCard[],
  visibleCards: number,
  undoneIds: ReadonlySet<string>,
): Map<string, string> {
  const badges = new Map<string, string>();
  for (const card of cards.slice(0, visibleCards)) {
    if (undoneIds.has(card.id)) continue;
    for (const requestId of card.requestIds) badges.set(requestId, card.badge);
  }
  return badges;
}

export interface PlaybackState {
  scenarioIndex: number;
  elapsedMs: number;
}

/** Pure: advance playback by `deltaMs`, rolling over to the next scenario (looping). */
export function advancePlayback(
  state: PlaybackState,
  deltaMs: number,
  scenarios: RelayScenario[],
): PlaybackState {
  const elapsedMs = state.elapsedMs + deltaMs;
  const current = scenarios[state.scenarioIndex];
  if (current && elapsedMs < getScenarioDuration(current)) {
    return { ...state, elapsedMs };
  }
  return {
    scenarioIndex: (state.scenarioIndex + 1) % scenarios.length,
    elapsedMs: 0,
  };
}
