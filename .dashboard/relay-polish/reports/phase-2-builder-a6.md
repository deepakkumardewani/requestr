# Phase 2 builder a6 (P2.12 Gherkin fidelity)
Edited only e2e/scenarios/relay/relay-polish-shell.feature.md; spec unchanged.
- SHELL-01: open a new tab so chevron shows; sidebar line reworded to what the spec asserts (right of left nav).
- SHELL-04: initial closed state, reopen step before reload, aria-expanded "true" after reload.
- SHELL-06: dropped "not 'button'" clause; now non-empty aria-label/title/text.
- SHELL-09: removed chat-route Given; theme switch via stored theme + reload; all three logos contrast.
- SHELL-10: Ctrl/Cmd+/ opens the dialog.
- SHELL-11: load /app, toggle visible, click, relay-dock-error, toggle still visible, aborted chunk requested.
- "chat route" removed everywhere (grep: none); SHELL-08 notes it overrides the Background.
- Full read of feature vs spec scenario by scenario: SHELL-02/03/05/07 already matched.
- check-ids.sh: polish-shell 11/11, "OK: scenario IDs consistent".
