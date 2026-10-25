# Phase 11 gates (P11.3, P11.6-P11.9), https://requestly.localhost

P11.3: scratch build (rsync + cp -c node_modules, bundle-stats.mjs from relay-improvements/BUNDLE.md). /app 759.0 kB gzip (baseline 757.2, ceiling 762.2, +1.8). Dock chunk 900d357c... holds caps popover, launcher, mention menu ids; only dynamically referenced. BUNDLE.md written with `P11.3 verdict: PASS`. Scratch dir deleted. Verify specs (panel, launcher, caps, mention x2): 90 passed.

Env fixes:
- e2e/fixtures/relayRoutes.ts: gate server now https (openssl self-signed) when project baseURL is https, since route.continue cannot change protocol (fixed COMPOSER-05/07/08).
- relay-polish-launcher/mention specs: other-host check compares url.origin to the page origin.
- relay-polish-shell.spec.ts: MAX_TAB_STOPS 20 -> 40 (P10 empty state adds starters/onboarding stops before header).
- relay-improvements-a11y-mic.spec.ts: 3 Tabs (launcher, shield, mic) after composer (P9 shield).

P11.6: all 5 command groups green at repeat-each=2 (271, 111, 88, 24 passed after fixes; shell 33/33 x3, mic 3/3), check-ids OK. One-off flakes under parallel load: SHELL-08 (dev-only metadataBase warning on first landing compile), REL-A11Y-04 (1.5s open budget); both pass on rerun (A11Y-04 6/6 serial; SHELL-08 3/3).
P11.7: lint:check, typecheck exit 0; vitest scope 154 files/4469 tests pass; parity+brand 3 files/1096 pass.
P11.8: msg/ctx/perm/panel 80 passed; check-ids OK; agent-browser sanity: dock opens, capabilities button present.
P11.9: skip/only/fixme grep empty; check-ids OK.
Notes: stray untracked PNGs `700` and `900` at repo root (not mine, dated earlier) should be deleted by the owner.
