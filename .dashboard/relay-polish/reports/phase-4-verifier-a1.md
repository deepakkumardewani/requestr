# Phase 4 verifier report (attempt 1) — FAIL

Scope: P4.1-P4.9 loaded via `dashboard.mjs scope` (TASKS.md L547-692, header L1-31). Every Verify command was re-run by the verifier. All commands exit 0. The phase still FAILS because of acceptance and quality gaps listed below.

## Commands run (key output)
- `bunx biome check` on all 9 P4.1-P4.4 files: "Checked 7 files ... No fixes applied" (exit 0). JSON is excluded by the biome config.
- `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/components/relay/ThreadList.spec.tsx src/components/relay/RelayHeader.spec.tsx`: 4 files, 961 tests passed.
- Removed-ids grep (P4.3): exit 0. `ls agent_docs/qa/relay-polish/p4-{rows,overlay}-*.png`: 12 files present.
- P4.5 coverage: 26 tests passed. The text table hides 100% files (skipFull), so it was re-run with json-summary: relativeTime.ts lines 23/23, stmts 25/25, branches 13/13, funcs 1/1, all 100%.
- P4.6 coverage: 77 tests passed. RelayHeader.tsx 100/94.73/100/100 (uncovered L77). ThreadList.tsx 98.27/96.15/97.36/99.03 (uncovered L259). Lowest figure is 94.73% branches. Uncovered lines are justified in P4.6-unit-a1.md.
- P4.7: `playwright test e2e/qa/relay/relay-threads.spec.ts --repeat-each=3`: 15 passed. `check-ids.sh`: OK.
- P4.8: `playwright test e2e/qa/relay/relay-polish-threads.spec.ts --repeat-each=3`: 33 passed. check-ids: relay-polish-threads 11/11.
- P4.9 gate:
  - vitest src/components/relay src/lib/relay src/i18n: 95 files, 2720 passed
  - polish-threads + polish-panel x2: 40 passed
  - relay-threads: 5 passed
  - check-ids: OK
  - `bun run lint:check`: 726 files, clean
  - `bun run typecheck`: exit 0
  - brandGuard: 12 passed
- Skip/fail markers: `grep -rnE "test\.fail|it\.fails|\.skip|\.only|\.fixme"` over relativeTime.spec, ThreadList.spec, RelayHeader.spec, relay-polish-threads.spec and relay-threads.spec found no matches.
- agent-browser probes (seeded with `--init-script e2e/fixtures/qa-seed.init.js`, browser closed afterwards):
  - 320px viewport: `relay-toggle` has a 0x0 rect and is hidden by ancestor `DIV.hidden h-full w-full md:flex` (the mobile layout).
  - 900px viewport (dock = 320px): dock x 580..900, overlay x 589..893, overlay scrollWidth == clientWidth == 304, document scrollWidth 900. Composer rect [637,674,163,78] is identical before and after opening the overlay. Overlay bg lab(8.3...) differs from dock bg lab(2.5...).
  - Time slot: real fr/ja strings were injected into `relay-thread-time` via the DOM (same CSS; no locale switch). Height and width per string:
    - "1mo": 16px high, 28px wide
    - "à l’instant": 32px high, 48px wide, overflowing the 40px slot (timeLeft 833 < titleRight 837)
    - "11 mois", "11か月", "23時間", "12 min": each 32px high, so they wrap to 2 lines
    - Screenshot: scratchpad p4-fr-time.png

## Per task

### P4.1 relativeTime — PASS
- Thresholds are named constants and future timestamps clamp to now. Biome is clean. Boundaries are proven by the P4.5 spec at 100% coverage.

### P4.2 strings — FAIL (quality)
- The keys exist in en/fr/ja and the parity specs pass.
- messages/fr/relayDock.json `threads.time.years` is `"{count} an"`, so 2 years renders "2 an" (wrong French plural).
  - Fix: `"{count, plural, one {# an} other {# ans}}"`.
  - Check the other fr/ja units the same way (`mois` is invariable, which is fine).

### P4.3 row time, menu, delete+Undo — FAIL
- Behaviour that matches the spec:
  - No pencil or trash icon in rows.
  - Menu has exactly Rename and Delete.
  - Delete is immediate, with a sonner Undo toast for RELAY_UNDO_TOAST_MS.
  - No AlertDialog remains.
  - Removed ids and keys are gone.
- FAIL, design process. Conventions L9 says "The verifier rejects a UI task without the Log line". P4.3 has no Log field in TASKS.md. The builder report says "ui-ux-pro-max/impeccable/layout not invoked as skills; design decisions applied by hand". The required Design step was not performed.
- FAIL, correctness. `src/components/relay/ThreadList.tsx` L177-188: the time shares a fixed `w-10` slot (40px) and the `<time>` has no `whitespace-nowrap`.
  - In fr and ja, the time wraps to 2 lines (32px tall inside an `h-7` 28px slot).
  - "à l’instant" overflows 8px into the title button.
  - This breaks the "no layout shift" requirement for fr/ja and visibly overlaps the title.
  - Fix: add `whitespace-nowrap`, and size the reserved slot to the widest locale string (or use `min-w-10 w-auto`, so the trigger is absolutely positioned within it).
- Non-blocking (SPEC RP-105, not in the task AC): the menu items lack the pencil/trash icons, and focus is not moved to the next row after delete (the builder admits it).

### P4.4 floating overlay — FAIL (design process only)
- Verified behaviour:
  - Portaled via PopoverPrimitive.Portal.
  - bg-popover, z-50 and shadow-lg are set; the list uses max-h-80 with internal scroll.
  - Composer position is unchanged (probe).
  - No horizontal scroll at the real 320px dock (probe).
  - Esc, select and outside click close the overlay and return focus (unit and e2e 08).
- FAIL: same missing design Log line as P4.3. The builder admits the skills were not invoked.

### P4.5 unit relativeTime — PASS
- 26 tests; 100% on lines, branches, functions and statements.

### P4.6 unit thread list and header — FAIL
- Coverage is fine: lowest 94.73% branches, with the uncovered lines justified.
- Missing case required by the Do field: "time text per locale mapping". `grep -nE "\bfr\b|\bja\b|locale" src/components/relay/ThreadList.spec.tsx` returns nothing.
- `ThreadList.spec.tsx` ~L534, "hides the time when focus is within the row", asserts `expect(time).toBeVisible()`. The test name claims the opposite of what it asserts, so it proves nothing.
  - Fix: assert the reveal classes (`group-focus-within/thread:opacity-0` on time, `group-focus-within/thread:opacity-100` on the trigger), or rename the test honestly.
- ~L506, "hides the time and shows the '...' menu trigger on hover": performs no hover and only checks the at-rest classes. ~L520, "swaps visibility when menu is open": only counts menu items and never checks the swap.
  - Fix: rename these, or assert `data-popup-open` on the trigger plus the class swap.

### P4.7 migrate thread specs — FAIL (quality, minor)
- 15/15 passed at x3; check-ids OK; no removed ids remain.
- `e2e/qa/relay/relay-threads.spec.ts:141`: the title still says "[REL-THR-02] Search, rename and delete with confirmation and undo", while the feature file was renamed to "...delete with undo". check-ids passes only because it matches ids, not titles.
  - Fix: rename the test title to match the feature.

### P4.8 thread rows and overlay e2e — FAIL
33/33 at x3 is green, but the spec does not test what its scenario titles and its own Gherkin claim.

- REL-POL-THREADS-01 (L109): only checks opacity at rest and on hover.
  - Missing: keyboard focus reveal (Tab to the row), the no-layout-shift measurement (compare row/slot bbox before and after hover), and the "no pencil/trash" assertion.
- REL-POL-THREADS-03 (L162): tests only "Enter saves".
  - Missing: Esc cancels, blur saves, empty rejected. All four are in the title and the feature file.
- REL-POL-THREADS-04 (L189): asserts count and existence after Undo, not "the same position".
  - Fix: assert row order (e.g. `items.nth(1)` has "Beta"; capture all titles before and after).
- REL-POL-THREADS-05 (L219): there is no reload, so "survives a reload" is untested. The DB read is vacuous because delete is already immediate.
  - Fix: after the toast is gone, `page.reload()`, reopen the list and assert the row is absent.
- REL-POL-THREADS-07 (L269): does not compare the composer `getBoundingClientRect` before and after, although the task Do explicitly requires it. Also missing: the message scroll-position check and light theme vs dark theme.
  - `expect(shadow).not.toMatch(/none/)` is vacuous: Tailwind v4 always emits composite transparent shadow layers (probe: `rgba(0, 0, 0, 0) 0px 0px 0px 0px, ...`).
  - Fix: assert the composer bbox is equal before and after open, assert a non-transparent shadow layer, and run the surface check in both themes.
- REL-POL-THREADS-09 (L322), which the orchestrator asked about:
  - Not a hidden app bug. At a 320px viewport the whole desktop layout (tab bar with `relay-toggle`) is `hidden md:flex`; below 768px Relay is the full-width sheet, and REL-POL-PANEL-08 uses the same shortcut at 600px. Using the shortcut there does not mask a Phase 4 defect.
  - But the test measures the wrong thing. The scenario is the 320px **panel** width (docked dock at 320px, which per TASKS decisions needs a viewport of 1024px or less), not a 320px **viewport** (sheet).
  - It uses bare `page` instead of `seededPage`, which violates the P4.8 AC "seededPage" (the consoleGuard is auto, so it still applies).
  - The scroll check reads `el.parentElement` (the popper positioner), which is meaningless.
  - Fix: use `seededPage`, a ~900px viewport and `openRelay`; assert `expectDockWidth(page, 320)`; assert the overlay bbox lies within the dock bbox, and that overlay and `document.documentElement` have scrollWidth == clientWidth.
  - The verifier probe shows the app already passes this (overlay 589..893 inside dock 580..900), so this is a test-only fix.
- REL-POL-THREADS-10 (L350): empty and no-results render the same testid, so `toBeVisible()` after the search proves nothing about no-results.
  - Fix: assert the text changes to the no-results copy.
  - Also seed one thread and search a non-matching term, so no-results is tested with existing threads.
- REL-POL-THREADS-11 (L370), which the orchestrator asked about: this does not test deep-link restore.
  - No thread route exists: `grep -rl thread src/app` is empty, and SPEC.md/PLAN.md contain no "deep link".
  - The test writes `rq_relay_active_thread` and `rq_relay_open` into localStorage itself, bypassing the app's write path. It only proves the app reads a key the test planted.
  - It also duplicates REL-THR-01 (reload restores last thread) with a weaker setup.
  - Fix: drive it through the UI (open list, select "Target", reload, assert `relay-title` and `data-active="true"`). Re-title the scenario as persistence/restore and state "deep-link N/A: no thread route exists" per the Scenario coverage rule (Conventions L14). Alternatively, the orchestrator decides that a thread route is out of scope and edits the scenario.
- DRY: `runtimeThread`, `putThreads`, `readThreads`, `openWithRoutes` and `openList` are copy-pasted from `relay-threads.spec.ts` (L35-111) instead of reusing a shared helper. The task Do says "through the existing thread seeding helper".
  - Fix: extract these into `e2e/fixtures/relayE2eHelpers.ts` (or a relay thread seed fixture) and import them in both specs.
- The engineer reports claim "App bugs: None" and "Scenario issues: None". Both are inaccurate: the fr/ja wrap bug is above, and the 11-deep-link mismatch went unreported.

### P4.9 Checkpoint 4 — FAIL
- All 7 commands exit 0 (numbers above).
- The AC "Rows and overlay behave per the RP ACs" is not met: the fr/ja time slot wraps and overflows (P4.3), and RP-104/105/107 browser proof is incomplete (P4.8: composer pixel compare, Esc/blur/empty rename, Undo position, reload persistence, 320px panel).
- The gate cannot pass while P4.3, P4.6 and P4.8 fail.

## Fix list for the retry
1. ThreadList.tsx time slot: add nowrap and a slot width that fits the widest fr/ja string; re-check fr "à l’instant" and ja "11か月" at the 320px dock.
2. fr `threads.time.years`: ICU plural.
3. P4.3/P4.4: run the ui-ux-pro-max, impeccable and layout skills and add a `- **Log**:` line to each task naming what each skill changed.
4. P4.6: add locale mapping tests (fr/ja messages); fix or rename the misnamed hover, focus and menu-open tests.
5. P4.7: rename the REL-THR-02 test title.
6. P4.8: rewrite 01/03/04/05/07/09/10/11 as described; extract the shared thread seed helpers.
