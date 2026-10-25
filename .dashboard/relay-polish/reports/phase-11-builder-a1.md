# Phase 11 builder report (P11.1, P11.2, P11.4)

- P11.1: all three sweep greps returned empty (no hits), so no edits.
- P11.2: parity + brand guard 3 files / 1096 tests pass; biome clean. Orphan scan found keys introduced by polish phases and unused in src: slash.composerHint, mention.hintRequest/hintCollection/hintChain; deleted from en/fr/ja relayDock.json. context.moreItems and changes.allUndone predate polish (kept). fr/ja composerPlaceholder keep @ and /.
- P11.4: agent_docs/qa/relay-polish/INDEX.md (148 screenshots, count check matches). SPEC appendix A corrected: relay-capabilities -> relay-capabilities-popover/-panel, -category -> relay-capability-category-<id>, -example -> relay-capability-starter, relay-approvals-off-notice -> relay-permission-notice. e2e/fixtures/README.md lists no relay specs, unchanged. Firefox note shown in Settings > Shortcuts (ShortcutsSection.spec asserts); header New chat tooltip has no caveat (recorded in INDEX.md, no src change).
- Extra: e2e/scenarios/relay/relay-polish-a11y.feature.md (REL-POL-A11Y-01..08); check-ids.sh OK.
