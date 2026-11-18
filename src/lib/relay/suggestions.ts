/**
 * New-chat suggestions (EMPTY-01): a few starters chosen from what the user
 * has open. Pure; the empty state supplies the context and renders the result.
 */

import type { ContextChip } from "./chips";
import type { SlashCommandId, SlashTargetKind } from "./slashCommands";

export const MAX_SUGGESTIONS = 4;

/** What the user has open, most specific first; `none` when nothing is. */
export type SuggestionContext =
  | { kind: "none" }
  | { kind: "request" | "chain" | "environment"; target: ContextChip };

/** Runs a slash command on an item that is already known: sent with a pill. */
export type TargetSuggestion = {
  type: "target";
  id: string;
  /** Button text; takes the target's name as `{name}`. */
  labelKey: `suggestions.${string}`;
  command: SlashCommandId;
  target: ContextChip;
};

/** Needs nothing, or lets the user pick the item it is about. */
export type StarterSuggestion = {
  type: "starter";
  id: string;
  /** Button text and the message it sends. */
  labelKey: `suggestions.${string}`;
  requiresTarget?: SlashTargetKind;
};

export type Suggestion = TargetSuggestion | StarterSuggestion;

type TargetPlan = Pick<TargetSuggestion, "id" | "labelKey" | "command">;

const REQUEST_PLANS: readonly TargetPlan[] = [
  {
    id: "request-explain",
    labelKey: "suggestions.request.explain",
    command: "explain",
  },
  { id: "request-run", labelKey: "suggestions.request.run", command: "run" },
  {
    id: "request-assert",
    labelKey: "suggestions.request.assert",
    command: "assert",
  },
];

const CHAIN_PLANS: readonly TargetPlan[] = [
  {
    id: "chain-explain",
    labelKey: "suggestions.chain.explain",
    command: "explain",
  },
  { id: "chain-run", labelKey: "suggestions.chain.run", command: "run" },
  {
    id: "chain-extend",
    labelKey: "suggestions.chain.extend",
    command: "chain",
  },
];

const ENVIRONMENT_PLANS: readonly TargetPlan[] = [
  {
    id: "environment-explain",
    labelKey: "suggestions.environment.explain",
    command: "explain",
  },
  {
    id: "environment-summarize",
    labelKey: "suggestions.environment.summarize",
    command: "summarize",
  },
  {
    id: "environment-update",
    labelKey: "suggestions.environment.update",
    command: "env",
  },
];

const PLANS_BY_KIND = {
  request: REQUEST_PLANS,
  chain: CHAIN_PLANS,
  environment: ENVIRONMENT_PLANS,
} as const;

/** Nothing is open, so the last one lets the user pick what to explain. */
export const GENERIC_SUGGESTIONS: readonly StarterSuggestion[] = [
  {
    type: "starter",
    id: "createRequest",
    labelKey: "suggestions.generic.createRequest",
  },
  {
    type: "starter",
    id: "importCurl",
    labelKey: "suggestions.generic.importCurl",
  },
  {
    type: "starter",
    id: "exploreWorkspace",
    labelKey: "suggestions.generic.exploreWorkspace",
  },
  {
    type: "starter",
    id: "explainRequest",
    labelKey: "suggestions.generic.explainRequest",
    requiresTarget: "request",
  },
];

/** At most `MAX_SUGGESTIONS`, ordered, matched to what is open. */
export function pickSuggestions(context: SuggestionContext): Suggestion[] {
  if (context.kind === "none")
    return GENERIC_SUGGESTIONS.slice(0, MAX_SUGGESTIONS);
  return PLANS_BY_KIND[context.kind]
    .map((plan) => ({
      type: "target" as const,
      ...plan,
      target: context.target,
    }))
    .slice(0, MAX_SUGGESTIONS);
}
