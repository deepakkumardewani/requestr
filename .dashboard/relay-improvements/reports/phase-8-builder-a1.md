# Phase 8 builder a1 (P8.1-P8.7)
- P8.1 relay.json en/fr/ja: actions.* and followUps.* keys; biome, relayMessages.parity.spec (792 pass), brand grep OK.
- P8.2 Stop already replaced send in RelayComposer; stopTurn in useRelayChat now also declines pending cards via declinePendingTools.
- P8.3 telemetry: relay_feedback {rating: "up"|"down"} + RelayFeedbackRating type.
- P8.4 MessageActions.tsx (copy markdown, regenerate on last only, thumbs w/ aria-pressed, emit rating only). Hidden while that message streams. testid relay-answer-actions (relay-message-* prefix collides with a spec regex).
- P8.5 UserMessageActions.tsx; useRelayChat.editAndResend(messageId,text) trims via setMessages + send. Edit offered on last user message when idle.
- P8.6 followUps.ts deriveFollowUps (send_request >=400 -> fixRequest/explainHeaders/explainResponse; run_chain failures), FollowUpChips.
- P8.7 store composerHasText (transient, not persisted) set by RelayComposer effect on hasText; chips hide when true.
- Also touched RelayDock.tsx (wiring onEditResend/onSendPrompt) and RelayConversation.spec.tsx (new required props).
- Checks: bun run typecheck clean; biome clean; vitest src/components/relay src/hooks/useRelayChat.spec.ts src/stores src/lib/relay src/i18n: 78 files / 2365 tests pass.
