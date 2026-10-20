# Phase 2 builder a5 (fixes for verifier a4)
- Gherkin e2e/scenarios/relay/relay-polish-shell.feature.md: Background -> /app; SHELL-02 "Given I close every open tab"; SHELL-03 rewritten (20 tabs, overflow, toggle outside scroll strip, in viewport, right edge); SHELL-05 three header buttons, hover + Shift+Tab, per-button keycaps; SHELL-07 message + Request B chip + "draft" then chord -> default-prevented, empty thread, chip gone, composer focused; SHELL-09 3:1.
- relay-polish-shell.spec.ts SHELL-03: OVERFLOW_TAB_COUNT const; polls scrollWidth > clientWidth; asserts toggle.closest(".overflow-x-auto") is null (fails if toggle sits in the scroll strip); toBeInViewport; right-edge gap 0..RIGHT_EDGE_TOLERANCE_PX.
- OpenInRelayButton.spec.tsx: label order asserted via compareDocumentPosition (label is a bare text node).
- EmptyState.spec.tsx: misleading comment corrected (no false "only SVG" claim).
- Evidence: check-ids.sh "OK: scenario IDs consistent"; vitest 2 specs 25 passed; relay-polish-shell --repeat-each=3: 33 passed (30.1s).
- Not done (optional): RelayHeader `?? null` coverage. No mutation run of SHELL-03 against TabBar (not editing source); the closest() assertion is a direct structural check.
