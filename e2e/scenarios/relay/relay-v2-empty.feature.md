# Feature: Relay v2 context-aware empty state (suggestions matched to what is open, and a quiet link to the full list)

Tests in `e2e/qa/relay/relay-v2-empty.spec.ts`. Covers EMPTY-01 (3 to 4 suggestions chosen from the open request, chain, environment or nothing) and EMPTY-02 (the quiet "See everything Relay can do" link that opens the capabilities popover; no large grid). The model is always mocked through `installRelayRoutes`. Context is set by opening a saved request tab, the chain page, or the active-environment storage key.

---

@critical
## Scenario: [REL-V2-EMPTY-01] with a request open the empty state shows 3 to 4 suggestions including "Explain <request name>"
# evidence: EmptyState.tsx useSuggestionContext, suggestions.ts REQUEST_PLANS

@high
## Scenario: [REL-V2-EMPTY-02] with a chain open the suggestions are chain-oriented
# evidence: suggestions.ts CHAIN_PLANS, EmptyState.tsx CHAIN_PATH_PREFIX

@high
## Scenario: [REL-V2-EMPTY-03] with an environment open the suggestions are env-oriented
# evidence: suggestions.ts ENVIRONMENT_PLANS, EmptyState.tsx activeEnv

@high
## Scenario: [REL-V2-EMPTY-04] with nothing open the generic starters are shown
# evidence: suggestions.ts GENERIC_SUGGESTIONS

@critical
## Scenario: [REL-V2-EMPTY-05] clicking a known-target suggestion inserts the command plus pill and sends
# evidence: useCapabilityStarter.ts runTargetSuggestion

@high
## Scenario: [REL-V2-EMPTY-06] clicking a generic starter opens the picker, and "See everything Relay can do" opens the popover
# evidence: useCapabilityStarter.ts runStarter requestMention, EmptyState.tsx relay-see-everything
