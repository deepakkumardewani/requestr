# Phase 2 verifier report (a6): Shell identity — VERDICT: PASS

I got the scope from `node ~/.claude/scripts/dashboard.mjs scope agent_docs/relay-polish/TASKS.md "phase 2"`: P2.1-P2.13 at L217-425, plus Checkpoint 2 at L426. I ran every command below myself from the repo root, against the dev server already running on :3000 (node pid 20168 listening). The only file I wrote is this report.

## What changed since a5
- `find src e2e messages agent_docs/qa/relay-polish -newer phase-2-verifier-a5.md -type f` returns only `e2e/scenarios/relay/relay-polish-shell.feature.md`. This matches builder a6's claim (Gherkin only, spec unchanged).
- TabBar.tsx: `git diff --stat` shows +18/-2, the same phase change a5 reviewed (dynamic ssr:false import at L38-43, toggle at L252 after `{tabs.length > 0 && <TabListDropdown />}` at L250, outside the has-tabs condition).

## Gherkin vs spec, scenario by scenario (relay-polish-shell.feature.md vs relay-polish-shell.spec.ts)
- Background `/app`: every test does goto(WORKSPACE_PATH="/app") except SHELL-08. SHELL-08's Gherkin now says it overrides the Background with `/`. MATCH.
- SHELL-01 (a5 item 4): Gherkin says "open a new tab via the create button (so the tab-list chevron shows)", and spec L73-74 clicks new-tab-btn. Its asserts cover: right of the chevron (L102), right of the left nav (L104), and right-edge gap 0..8 (L106-107). Each Gherkin line maps to one of these. MATCH, FIXED.
- SHELL-02: close every tab, toggle at far right (gap <= 8), open a tab, jump <= 1px. MATCH.
- SHELL-03: 20 tabs, scrollWidth > clientWidth polled, not inside `.overflow-x-auto`, visible + in viewport, right-edge gap 0..8. MATCH.
- SHELL-04 (a5 item 2): Gherkin flow is initially closed/"false", open/"true", close/"false", open again/"true", reload, still open/"true". Spec L190-216 follows the same sequence. MATCH, FIXED.
- SHELL-05: covers new chat, close and the conversations trigger. For each: hover, under 700 ms, label, platform keycaps (NEW_CHAT ⌘/Ctrl+Shift+O; CLOSE ⌘I / Ctrl+Shift+L; trigger none), Escape hides; then Shift+Tab from the composer with the same checks. The spec interleaves the hover and focus legs per button, which does not change what is asserted. MATCH.
- SHELL-06 (a5 item 1): Gherkin is "non-empty aria-label, title or text", and spec L278-290 asserts exactly that. The overclaimed "not 'button'" line is gone. MATCH, FIXED.
- SHELL-07: openRelay() (relayE2eHelpers.ts L33-40) clicks `relay-toggle`, so "open via the toggle" holds. The rest also matches: send message plus assistant reply, attach Request B chip, type "draft", chord, then defaultPrevented true, relay-empty visible, 0 messages, chip gone, composer focused, dock visible, and the toggle chord hides the dock. MATCH. (Observation, not a defect: "(the browser's default action does not fire)" restates the AC's own defaultPrevented proxy.)
- SHELL-08: on `/`, both chords leave the dock count at 0. MATCH.
- SHELL-09: logo test id in the toggle, header and empty state; theme set through localStorage "theme" + reload for light then dark; all three logos >= 3:1 against the nearest opaque background. The spec sets the theme before the first logo checks rather than after, which does not change what is asserted. MATCH.
- SHELL-10 (a5 item 6): Gherkin is Ctrl/Cmd+/, and spec L473 presses ControlOrMeta+Slash, then the "New Relay chat" row with platform keycaps. MATCH, FIXED.
- SHELL-11 (a5 item 3): route abort installed before load, load /app, toggle visible, click, relay-dock-error visible, toggle still visible, chunk request attempted and aborted. Spec L504-526 matches. MATCH, FIXED.
- "chat route" (a5 item 5): `grep -c "chat route"` on the feature returns 0. FIXED.

## Commands run (key output)
- biome check on all P2.1-P2.8 Files (28 paths): exit 0, "Checked 18 files ... No fixes applied." (18 = 28 paths minus the 10 specs; biome.json L19-20 excludes "!spec" and "!**/*.spec.*")
- vitest for the P2.1-P2.8 Verify specs + parity (13 files): exit 0, 13 files / 1028 passed.
- Greps (all exit 0): no Sparkles in RelayToggleButton.tsx (g1=0); none under src/components/relay (g2=0); none in relay + TabBar.tsx (g4=0); no RelayToggleButton in LeftPanel.tsx (g3=0); `next/dynamic` at TabBar.tsx:4.
- Screenshots: p2-logo 2, p2-identity 2, p2-shortcuts 4, p2-tabbar 2, p2-tooltips 3.
- i18n: relayDock `header.newChatShortcut` is en "New chat", fr "Nouvelle discussion", ja "新しいチャット". shortcuts `relayNewChat` and `relayNewChatNote` exist in en/fr/ja. `logo.label` was dropped by the logged decision in the P2.3 Log, which a3, a4 and a5 accepted.
- Banned markers (test.fail|it.fails|.skip|.only|.fixme|waitForTimeout) across relay-polish-shell, relay-shell, relay-a11y, relayE2eHelpers and all 11 phase unit specs: no matches (grep exit 1). The spec has 11 `test(` calls.
- P2.11 "unmodified" AC: `git diff --stat HEAD -- e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts` prints nothing, and git status for both is clean. Both are unmodified.
- happy-dom header (Unit AC): line 1 of useRelayShortcut, RelayToggleButton, TabBar, RelayHeader, RelayLogo, EmptyState, KeyboardShortcutsModal and OpenInRelayButton specs is `/** @vitest-environment happy-dom */`, equivalent to the `//` form. constants.spec.ts is a plain-module spec (it starts with a vitest import), so the component/hook rule does not apply to it.
- P2.9 coverage (Verify command verbatim): exit 0, 6 files / 191 passed. The text reporter lists only non-100% files, so I re-ran with json-summary:
  - TabBar.tsx: lines 100, branches 90.47 (38/42), functions 100, statements 95.77. Uncovered 74, 93-100, 273, justified in P2.9-unit-a3.md (defensive null-ref guards, always-true dialog guard). L100 is the `!pendingBulkClose` guard, justified in a4.
  - RelayHeader.tsx: 100/96/100/100 (L69 fallback).
  - RelayToggleButton.tsx, useRelayShortcut.ts, constants.ts: 100 on all four metrics.
  - Lowest: 90.47% branches, TabBar.tsx.
- P2.10 coverage (Verify command verbatim): exit 0, 4 files / 47 passed. json-summary: RelayLogo, EmptyState, KeyboardShortcutsModal and OpenInRelayButton are 100/100/100/100.
- P2.11: relay-shell + relay-a11y + improvements-pills + improvements-context-payload `--repeat-each=3`: exit 0, 57 passed (48.9s), no flaky or failed. check-ids: "OK: scenario IDs consistent". The only e2e "sidebar" references are the polish-shell "not in the left sidebar" assertions.
- P2.12: relay-polish-shell `--repeat-each=3`: exit 0, 33 passed (26.4s), no flaky or failed. check-ids: relay-polish-shell feature ids 11, test ids 11, OK.
- P2.13 gate (each command exit 0):
  - scoped vitest (relay, layout, settings, hooks, lib/relay, app/settings, i18n): 124 files / 3099 passed
  - polish-shell + polish-msg `--repeat-each=2`: 40 passed
  - relay-shell + relay-a11y: 11 passed
  - check-ids OK
  - `bun run lint:check`: 725 files, no fixes
  - `bun run typecheck` (tsc --noEmit): clean
  - brandGuard: 12 passed
  - Sparkles grep exit 0; next/dynamic match at TabBar.tsx:4

## Per-task results
- P2.1 PASS: newChatShortcut in en/fr/ja; parity and brandGuard green.
- P2.2 PASS: relayNewChat + relayNewChatNote in en/fr/ja; parity green.
- P2.3 PASS: RelayToggleButton spec green, no Sparkles, screenshots + Log present.
- P2.4 PASS: EmptyState, OpenInRelayButton and RelayHeader specs green; no Sparkles under relay; screenshots present.
- P2.5 PASS: constants + useRelayShortcut specs green, 100% coverage.
- P2.6 PASS: modal, ShortcutsSection and settings constants specs green; SHELL-10 green; screenshots present.
- P2.7 PASS: LeftPanel has no toggle; TabBar uses dynamic ssr:false, placed after TabListDropdown and outside tabs.length>0; specs green.
- P2.8 PASS: RelayHeader spec green; SHELL-05/06 green; screenshots present.
- P2.9 PASS: lowest 90.47% branches (TabBar.tsx); uncovered lines listed and justified.
- P2.10 PASS: 100% on all four files, 47 tests.
- P2.11 PASS: 57/57 x3, check-ids OK.
- P2.12 PASS: 33/33 x3. The Gherkin now matches the spec in all 11 scenarios, and all six a5 items are fixed.
- P2.13 PASS: all 9 gate commands exit 0. AC 1 holds: no Sparkles, toggle not in the sidebar, dynamic import kept.

## Code quality
- No code changed since a5 (only the .feature.md), so there are no new violations.
- RelayRoot `.catch(() => RelayLoadError)` is not a silent swallow. SHELL-11 passed 3/3 here, which shows the failed chunk load surfaces to the user as a visible role=alert `relay-dock-error`. The P2.7 Log records why it is a catch rather than an error boundary (the console guard). The RelayRoot/RelayLoadError/relay.json files sit outside the P2.7 Files list, but the P2.7 Log records them as the follow-up SHELL-11 required. Not a blocking violation.
- RelayHeader `thread?.title ?? null` (L69): the fallback branch is uncovered, and the file is at 96% branches, above the 95 band. Not a violation.
