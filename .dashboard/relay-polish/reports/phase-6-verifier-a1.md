# Phase 6 verifier report (attempt a1) — VERDICT: FAIL

Scope: TASKS.md L938-1207 (P6.1-P6.16, Checkpoint 6), loaded via `dashboard.mjs scope`. All commands below were run by the verifier against the running server on :3000.

## Commands run and key output

| Command | Result |
|---|---|
| biome check (all P6.1-P6.7 files + ComposerTip.tsx) | "Checked 16 files ... No fixes applied" (clean) |
| `grep -c "Ask anything, @ to mention, / for actions" messages/en/relayDock.json` | 1 |
| ContextChips.tsx/.spec.tsx absent; `grep relay-context-chip/ContextChips src` empty; `relay-composer-row/leading/trailing` in src empty; final gate grep over src+e2e | all exit 0 |
| vitest parity + mentions + useRelayPickerItems + RelayComposer + MicButton + SlashMenu + useRelayStore | 8 files / 1067 tests passed |
| P6.8 scoped coverage | 120 tests pass; all files 100/98.66/100/100; lowest: useRelayPickerItems.ts branches 90.9% (line 76, justified in P6.8 report as unreachable defensive guard) |
| P6.9 scoped coverage | 124 tests pass; lowest MentionMenu.tsx funcs 90.47% / branch 93.65% / stmts 94.36%, uncovered 151, 291 (justification in P6.9 report is wrong for 151, see P6.9). ComposerPills/SlashMenu 100% (omitted from table) |
| P6.10 a11y-mic + qol-stop `--repeat-each=3` | 12 passed |
| P6.11 voice + pills `--repeat-each=3` | 30 passed |
| P6.12 context-chip + context-payload `--repeat-each=3` | 24 passed |
| P6.13 picker + privacy + chat `--repeat-each=3` | 81 passed |
| P6.14 relay-polish-composer `--repeat-each=3` | run 1: **2 failed / 34 passed** (COMPOSER-08); run 2: 36 passed; isolated `-g COMPOSER-08 --repeat-each=8`: **1 failed / 7 passed** |
| P6.15 relay-polish-mention `--repeat-each=3` | 42 passed (but see weak assertions below) |
| `bash e2e/scenarios/relay/check-ids.sh` | **exit 1**: `relay-polish-mention: feature ids: 1  test ids: 14 / In spec, not in feature: REL-POL-MENTION-01..14` |
| Gate: `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n` | 132 files / 3576 tests passed |
| Gate: composer + mention `--repeat-each=2` | **1 failed (COMPOSER-08)**, 51 passed |
| Gate: legacy 9-spec set | 49 passed |
| Extra: relay-polish-ctx + relay-polish-shell (touched) | 21 passed |
| `bun run lint:check` | Checked 730 files, clean |
| `bun run typecheck` | tsc --noEmit clean |
| brandGuard | 12 passed |
| `grep -rnE "test\.fail|it\.fails|\.skip|\.only|\.fixme|waitForTimeout"` on all phase specs | no hits |
| i18n key probe (node) | en/fr/ja: all 16 new keys present; `{name}` preserved; fr/ja placeholders keep `@` and `/` |

Gate agent claimed "check-ids exit 0" and composer spec green; both are false on re-run.

## Per task

### P6.1 — PASS
Keys present in all 3 locales (probe above), parity green, placeholder grep = 1.

### P6.2 — PASS
`useRelayRecentStore.ts`: cap/dedupe/move-to-front, corrupt JSON -> [] with contextual console.warn; constants present (`recent: "rq_relay_recent"`, `RELAY_RECENTS_CAP = 5`, `RELAY_COMPOSER_MAX_HEIGHT_PX = 160`, `RELAY_MENTION_MAX_HEIGHT_PX = 288`). Unit coverage 100%.

### P6.3 — PASS
`stripMentionToken("run @Get users now","Get users")` -> "run now" by inspection and unit spec; `isMentionMenuAllowed` false with slash query.

### P6.4 — FAIL
1. Design convention: no Log line in TASKS.md naming what `ui-ux-pro-max`/`impeccable`/`layout` changed; builder report admits the skills were NOT run. Conventions: "The verifier rejects a UI task without the Log line." Screenshots exist only as `p6-mention-{1440,320}-dark.png`; light variants missing (convention requires light and dark).
2. Do says "virtualize with the same @tanstack/react-virtual setup and ROW_HEIGHT_PX as the old picker (reuse, do not fork)". Forked instead: `src/lib/relay/constants.ts:133,135` adds `RELAY_PICKER_ROW_HEIGHT_PX = 44` / `RELAY_PICKER_OVERSCAN_ROWS = 4` while `src/components/relay/RelayPicker.tsx:29,31` still defines `ROW_HEIGHT_PX = 44` / `OVERSCAN_ROWS = 4` locally (duplicate magic numbers). Fix: RelayPicker imports the shared constants (and ideally a shared virtualizer options helper used by both).
3. Do says "keyboard reducer from src/lib/pickerNav.ts"; MentionMenu.tsx:58 implements its own `moveIndex` instead. Either use `pickerNavReducer` or record why not.
4. Browser proof cross-referenced to MENTION-02/03/08/09, which are hollow (see P6.15), so the width/keyboard/zero-network AC is not actually proven.

### P6.5 — FAIL (design gate only)
Behaviour OK (ContextChips gone, pill has icon + name + labelled X, stale struck). But no design Log line, skills not run, only dark screenshots (`p6-pills-*-dark.png`).

### P6.6 — FAIL (design gate + proof)
Structure correct (one `relay-composer-box` with textarea + toolbar, tab order textarea, +, pill X, mic, send). But no design Log line, only dark screenshots; and the cross-referenced proofs COMPOSER-01/02 are weak (see P6.14) so overlap/overflow at 320/400/480 is unproven.

### P6.7 — FAIL (design gate + proof)
Wiring correct by code reading and unit tests; COMPOSER-10 proves click-select inserts `@Request A ` and the X strips it. But no design Log line, dark-only screenshots, and the cross-referenced MENTION-05/06/10 do not assert their scenarios (see P6.15), so "one pill, re-select adds none, payload includes request, slash<->mention exclusivity" is not browser-proven.

### P6.8 — PASS
Coverage above; uncovered branch justified.

### P6.9 — FAIL
MentionMenu.tsx functions 90.47% (80-94 band) passes only with a valid justification, and the P6.9 report mislabels it: it says lines 151 and 291 are both `onMouseDown` preventDefault "tested via integration". In the actual file line 151 is `onHover={() => setActive({ query, key: chipKey(item) })}` (MentionOption hover handler) and only 291 is `onMouseDown={(event) => event.preventDefault()}`; e2e runs do not count toward unit coverage. Fix: add happy-dom tests in `MentionMenu.spec.tsx` that `fireEvent.mouseMove` a non-active option (asserts it becomes `aria-selected=true`) and `fireEvent.mouseDown` an option (asserts `defaultPrevented`), bringing functions to 100%.

### P6.10 — PASS
12/12 x3. Note: no position assertions exist for "mic then send on the right inside relay-composer-box"; only an extra Tab press and `relay-composer-trailing` -> `relay-composer-box`. Acceptance ("both specs pass") holds.

### P6.11 — PASS — 30/30 x3.
### P6.12 — PASS — 24/24 x3; no relay-context-chip left.

### P6.13 — FAIL
`e2e/qa/relay/relay-improvements-picker.spec.ts` REL-PICK-01 was weakened, not migrated:
- `@Relay` then `if (hasEnv > 0) {...} else { // Fallback: select first request ... }` — the environment-via-`@` path is optional.
- The payload assertion `expect(kinds).toContain("environment")` was deleted and replaced by `expect(body.context.chips.length).toBeGreaterThanOrEqual(1)`.
MentionMenu does list environments (`useRelayPickerItems` searches all kinds; rows carry `data-kind`), so there is no product reason for the fallback. Fix: type a query that uniquely matches the seeded env (e.g. the "QA Relay Improvements Env" name token, or scroll/filter so the env row is in the DOM), click `[data-testid=relay-mention-option][data-kind=environment]` unconditionally, assert one environment pill, and restore `expect(kinds).toContain("environment")`.

### P6.14 — FAIL
Flaky: COMPOSER-08 fails intermittently at spec.ts:368 `locator('[data-slot="tooltip-content"][data-open]').filter({ hasText: 'Stop generating' })` not visible (2/36 at x3, 1/8 isolated, 1/52 in gate x2). Root-cause the Stop tooltip (the send button is swapped for Stop under the pointer after click, then `.focus()`; the tooltip sometimes never opens) — fix the app or the test sequencing (e.g. move the mouse away / blur before focusing Stop, or tab to it), no retries/timeouts.
Scenarios that do not assert their text:
- COMPOSER-01 (line 105-113): focus-ring check is vacuous (`getPropertyValue("--ring")` is always a string, `toBeDefined()` always passes); does not assert the toolbar is inside the box. Assert `relay-composer-box` contains `relay-composer-toolbar` and `relay-composer`, and that the box's computed box-shadow/outline changes on focus-within.
- COMPOSER-02 (118-167): never attaches pills (`pillsVisible` branch never runs), so "pills wrap above the toolbar" is not tested; `expectNoOverlap` (line 50) is defined but never called, so "nothing overlaps" is not tested; it sets *viewport* widths 320/400/480 (mobile sheet) rather than *panel* widths via the resize handle as Do requires; `pickerTrigger` (146) unused. Attach 2+ pills, drive the dock width with the handle, and assert no intersection between +, pills, mic, send and that the box fits within the dock.
- COMPOSER-03 (169-208): does not assert the initial 2-row height, does not assert growth (no before/after compare), does not reach the cap (7 lines may not), and `scrollHeight >= clientHeight` is always true. Assert initial ≈ 2 rows, grows after 3-4 lines, equals RELAY_COMPOSER_MAX_HEIGHT_PX after ~20 lines with `scrollHeight > clientHeight`.
- COMPOSER-04 (210-226): only en is checked; scenario requires fr and ja keep `@` and `/`. Switch locale (cookie/setting) and assert both.
- COMPOSER-09 (373-412): `if (isVisible)` / `if (box)` make every check optional; does not assert the sheet layout is active; hard-coded 44 instead of the RELAY_MIN_TOUCH_TARGET_PX value. Assert each control visible then measure.
COMPOSER-05/06/07/08(except flake)/10/11/12 do assert their scenarios.

### P6.15 — FAIL
`bash e2e/scenarios/relay/check-ids.sh` exits 1: `e2e/scenarios/relay/relay-polish-mention.feature.md` uses `## [REL-POL-MENTION-nn] ...` headings, but the checker requires `## Scenario: [REL-POL-MENTION-nn] ...` (and the file is prose, not Gherkin Given/When/Then).
Scenarios that do not assert their text (file `e2e/qa/relay/relay-polish-mention.spec.ts`):
- 02 (53-75): never opens a tab, so "Current tab first with tab name and breadcrumb" is never checked; "No tab open" assertion is inside `if (isDisabled)`. Must test both: with a tab open (name + breadcrumb in row 1) and with none (disabled + "No tab open").
- 03 (77-110): types `@request` not `get`; no narrowing comparison; no ArrowDown/Up, Enter or Tab at all; selection is a click inside `if (selected)`.
- 05 (132-148): selects nothing. No `@Name ` insertion, no pill count, no re-select dedupe.
- 06 (150-171): sends plain "hello world" with no mention and never reads the /api/relay/chat body. Must mention a request, send, and assert the captured body contains it.
- 07 (173-228): whole body inside `if (selected)`; X click does not assert the token is stripped (token was already deleted). Must assert unconditional selection, pill survives token deletion, then with token present the X removes both.
- 08 (230-259): only the default viewport, not 320/400/480; compares to `relay-composer` (textarea), not `relay-composer-box`.
- 09 (261-299): only filters `/api/relay/chat`; scenario requires zero `/api/relay/*` and other-host requests; no select step before the check.
- 10 (301-320): never opens the slash menu; only checks that typing "hello" closes the mention menu. Must type `/` to open slash and assert mention closed, and the reverse.
- 11 (322-344): footer assertion is conditional (`if (count > 0)`); `< 50` is near-trivial given the 50 cap. Assert footer visible with "Keep typing to narrow results" and a row window well below 50.
- 13 (364-394): `aria-activedescendant` is set before ArrowDown (index 0 default), so "follows the active row" is not tested. Assert it equals the id of the `aria-selected=true` option and changes after ArrowDown.
- 14 (396-425): never attaches anything and never reads `localStorage.rq_relay_recent`. Must attach via `@`, assert stored items have only kind/id/name, reload, assert persisted.
Only 01, 04, 12 genuinely assert their scenario.

### P6.16 (Checkpoint 6) — FAIL
check-ids exit 1; composer+mention x2 had 1 failure (COMPOSER-08). Other gate commands pass (vitest 3576, legacy 49, lint, typecheck, brandGuard 12, final grep exit 0).

## Code quality (files changed this phase)
- `src/lib/relay/constants.ts:133,135` vs `src/components/relay/RelayPicker.tsx:29,31` — duplicated 44/4 row-height/overscan constants (DRY; task said reuse). Fix: one source of truth.
- `src/components/relay/MentionMenu.tsx:121` — `keyHandlerRef.current = ...` written during render (React rule: no ref writes in render). Assign in a `useLayoutEffect`/`useEffect` or use `useImperativeHandle`.
- `src/components/relay/MentionMenu.tsx:142,257` — `style?: object`; use `CSSProperties`.
- `src/components/relay/RelayPickerRow.tsx:17` — `CHIP_KIND_LABEL_KEYS` newly exported but only used in-file (unused export). Drop `export`.
- `e2e/qa/relay/relay-polish-composer.spec.ts:50` — `expectNoOverlap` dead helper; `:146` unused `pickerTrigger`.
- Scope notes (acceptable, explained): `ComposerTip.tsx` (new, shared tooltip wrapper for +, mic, send/stop; small and reused 3x), `RelayConversation.tsx(.spec)` (removing the deleted ContextChips import/usage), `relay-polish-ctx/shell.spec.ts` (relay-context-chip -> relay-composer-pill), `e2e/fixtures/qa-seed.init.js` (+4072 lines regenerated from new `seed/relay-polish-mention.json`).

## UI check (screenshots)
`p6-mention-320-dark.png`: menu as wide as the box, Current tab section with disabled "No tab open", Results with METHOD url secondary lines, "Keep typing to narrow results" footer — matches AC visually. `p6-pills-320-dark.png`: pill on its own line above the toolbar, + left, mic and round send right, caption below. Draft text in both shots reads "see @see @QA E2E - Lane 1" / "see @QA E2E - Lane 1see @QA E2E - Lane 1". Verifier reproduced the keyboard path with agent-browser (seeded): typed `see @Lane` key by key, ArrowDown, Enter -> value `see @QA E2E - Lane 2 `, 1 pill, menu closed, `rq_relay_recent` = `[{"kind":"request","id":"qa-e2e-cx-req-lane-2","name":"QA E2E - Lane 2"}]`; then typed `and @Lane`, ArrowDown, Tab -> value `see @QA E2E - Lane 2 and @QA E2E - Lane 2 `, still 1 pill (dedupe works). So the doubled text was not reproduced by the verifier; the screenshots should be recaptured cleanly. Light-theme shots missing.

## Addendum (after review)
- P6.13 fix target confirmed: environments ARE searchable — `src/lib/relay/tools/workspaceRead.ts:121-125` adds `{ kind: "environment", ... }` candidates; with `@Relay` the env rows are buried behind hundreds of matching requests (50-row cap / virtual window), so the fix is in the test (query that uniquely hits the env), not the app.
- Scope: `src/components/relay/ComposerTip.tsx` (new) is not in any task's Files list and would push P6.6 to 6 files (over the 5-file rule). Add it to an owning task's Files (e.g. P6.6 or split) and record it in the Log; it is otherwise a reasonable shared wrapper. The `RelayConversation.tsx(.spec)` edit is forced by deleting ContextChips (P6.5 acceptance).
- MENTION-03/05 rewrite must use real keystrokes (`pressSequentially`) plus ArrowDown + Enter and Tab, with exact `toHaveValue` checks, since that path is otherwise untested in e2e.
