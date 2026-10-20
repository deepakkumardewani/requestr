# Phase 3 "Dock width limits": verifier report (attempt a1)

VERDICT: FAIL. Every Verify command exits 0, but P3.3 and P3.5 break their own acceptance criteria and have concrete quality violations. P3.1, P3.2 and P3.4 pass. P3.6 commands all exit 0, but the gate cannot pass while P3.5/P3.3 fail.

## Commands run (all by the verifier, foreground)

### P3.1
- `bunx biome check <5 P3.1 files>`: exit 0 ("Checked 2 files"; biome.json ignores *.spec.ts, so the specs were NOT linted)
- `bunx vitest run src/lib/relay/constants.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayFocus.spec.ts`: 3 files, 88 passed
- `test -z "$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src/lib src/stores)"`: exit 0
- AC check against code (src/stores/useRelayStore.ts): getRelayMinWidth = max(320, floor(vw*30/100)), getRelayMaxWidth = max(min, floor(vw*40/100)), default = max(320, floor(vw*30/100)). it.each table asserts 1440 432/576/432, 1100 330/440, 1024 320/409, 900 320/360, 800 320/320, 780 320/320, 320 320/320. Stored "9999" clamps to max on hydrate; "", "   ", "abc" fall back to the default; setWidth clamps both ways. Pre-hydration width = RELAY_MIN_WIDTH_PX (no window). PASS.
- Gap: no unit test hydrates a below-range stored value (AC bullet "a stored 100 → min"). The code path (readWidth → clampRelayWidth) does it, and clampRelayWidth(10) is tested. Not blocking for P3.1, but listed under P3.3 below.

### P3.2
- `bunx biome check <5 P3.2 files>`: exit 0 ("Checked 3 files"; specs ignored)
- `bunx vitest run ResizeHandle.spec.tsx RelayDock.spec.tsx RelayRoot.spec.tsx`: 3 files, 47 passed
- `test -z "$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src)"`: exit 0
- Code: the aside's minWidth/maxWidth use RELAY_MIN_WIDTH_CSS/RELAY_MAX_WIDTH_CSS; the handle's aria-valuemin/max come from getRelayMinWidth/getRelayMaxWidth(window.innerWidth); --relay-dock-offset = clamp(MIN_CSS, Wpx, MAX_CSS); useClampDockWidthOnResize writes only when clamped !== width. PASS.
- The ResizeHandle.spec.tsx edit (outside P3.2 Files: hardcoded aria-valuemax "600") was needed for P3.2's own Verify. P3.3's Do names that spec, so the phase covers it. Accepted.

### P3.3 (unit)
- Scoped coverage command from the task: 4 files, 101 tests passed.
- Per file (json-summary; lines/branches/funcs/stmts):
  - constants.ts 100/100/100/100
  - useRelayStore.ts 100/100/100/100
  - ResizeHandle.tsx 100/100/100/100
  - RelayRoot.tsx 95.34/100/89.47/96.15 (uncovered lines 30-31 and 44)
- Lowest: RelayRoot.tsx functions 89.47%, inside the 80-94 band, so it must be justified.
  - Line 30 (`.catch(() => RelayLoadError)` in next/dynamic): justification OK, since the mocked dynamic never rejects.
  - Line 44: the engineer's justification is WRONG. It is not a "cleanup return"; it is the SSR `getServerSnapshot` `() => false` of useSyncExternalStore, never called in a client render.
  - Both lines predate this phase. Not counted as a failure; the report text should be corrected.
- `grep -nE "test\.fail|it\.fails|\.skip|\.only|\.fixme"` on all phase specs: no matches.
- Both component specs start with `/** @vitest-environment happy-dom */`.
- FAIL items:
  1. src/components/relay/ResizeHandle.spec.tsx:158-177, "updates aria-valuemin and aria-valuemax when innerWidth changes", is HOLLOW. It stubs innerWidth=900 but never rerenders, computes `const newMax = getRelayMaxWidth(900)` and never uses it, and asserts only `aria-valuenow`. The P3.3 Do case "aria-valuemin/max/now follow a changed innerWidth" is therefore not covered.
     FIX: `vi.stubGlobal("innerWidth", 1440)`, `rerender(<ResizeHandle width={...} onWidthChange={...} />)`, then assert aria-valuemin "432" and aria-valuemax "576". Remove the unused `newMax` and the explanatory comments.
  2. src/stores/useRelayStore.spec.ts: readWidth "out-of-range values" covers only above-range ("9999"). There is no below-range hydrate (P3.1 AC "a stored 100 is clamped to the min on hydrate").
     FIX: add `localStorage.setItem(width, "100"); hydrate(); expect(width).toBe(MIN_AT_VIEWPORT_PX)`.
- Quality (spec hygiene, retry feedback):
  - ResizeHandle.spec.tsx:~133-145: `toHaveBeenLastCalledWith(VIEWPORT_PX - 700)` then `toHaveBeenLastCalledWith(300)` is the same assertion twice. Keep one. There is also a stray blank line before the closing `});` of the describe.
  - RelayRoot.spec.tsx: "uses the literal CSS min/max bounds in the reserved gap" repeats the preceding test's exact `toBe(clamp(${RELAY_MIN_WIDTH_CSS}, ...))` check with hardcoded "max(320px, 30vw)" strings. Delete it; the previous test already proves it.
  - useRelayStore.spec.ts:
    - "keeps an in-range width and rounds fractions down": the source uses Math.round, not floor. Rename it.
    - "rounds fractions up and then clamps to max if needed": no clamp happens. Rename it.
    - "readWidth falls back to default when storage.getItem throws" duplicates the preceding "hydrates to defaults and logs the failing key on read" (same assertions). Merge or remove.

### P3.4 (e2e migrate)
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test relay-improvements-layout relay-improvements-a11y-layout relay-shell --repeat-each=3`: 36 passed (35.7s), 12 tests x3, clean.
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent"
- `test -z "$(grep -rnE 'DEFAULT_WIDTH_PX = 400|MAX_WIDTH_VW = 0\.6' e2e/qa/relay)"`: exit 0
- Scenarios match the task: LAYOUT-02 and IA11Y-05 at 1024x800 run 320, then the dragged max (~409), then mobile. SHELL-03 at 1440 runs default 432, max 576, min 432, ArrowLeft 448, then reload persists.
- The relay-shell.feature.md edit (outside Files) is authorized by the P3.4 Gherkin note, since REL-SHELL-03 named "60%" and "320px". Accepted.
- Note (non-blocking): the specs compute the max as Math.round(1024*0.4)=410 while the app floors to 409. This passes only because of the ±1px tolerance. Prefer Math.floor to mirror the app.
- PASS.

### P3.5 (e2e new)
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=3`: 27 passed (23.6s)
- check-ids: "relay-polish-panel: feature ids: 9 test ids: 9"
- Structure: 9 test(), each tagged @qa plus a priority, using seededPage.
- FAIL items:
  1. e2e/qa/relay/relay-polish-panel.spec.ts:111 has `await page.waitForTimeout(100);`. This violates the P3.5 Acceptance ("no waitForTimeout") and Conventions line 10. The P3.5 engineer report claims "No `waitForTimeout` (all waits use web-first assertions or expect.poll())", which is false, and also "Added 100ms delay after setViewportSize".
     FIX: delete lines 110-111. `expectDockWidth` already polls via expect.poll.
  2. PANEL-09 (lines 372-389) never tests the empty-string case. `page.addInitScript` re-runs on every navigation, including `page.reload()`, so the `""` written at line 385 is overwritten with "abc" before the app hydrates. The "empty" step re-tests "abc".
     FIX: seed through an init script that only writes when a one-shot flag is absent, or run the empty case in a fresh `page.goto` after the init script is no longer in effect. For example, use a second test-scoped context, or set "" via evaluate and then navigate with a guard such as `if (!sessionStorage.getItem('seeded')) {...}`.
  3. PANEL-02 (lines 82-114) does not match its scenario:
     - "At 900px it is 320px" is never asserted. The test resizes from 1100 and asserts that 330 stays.
     - "Never below 320px after drag-to-minimum" has no drag step.
     FIX: load fresh at 900 (no saved width) and assert 320. Add `dragHandleTo(page, viewport.width)` at 900 or 780 and assert 320. Keep the shrink-with-dock-open step.
  4. Dead code at e2e/qa/relay/relay-polish-panel.spec.ts:22-32: `viewportWidth()` and `viewportHeight()` are defined and never called (grep finds only their definitions).
     FIX: delete them.
- Gaps (retry feedback):
  - PANEL-06 never asserts "the content stays visible beside the dock" (only padding-right and scrollWidth). Add a boundingBox check that a workspace element's right edge is <= the dock's left edge.
  - PANEL-04 "reload keeps the clamped width": because addInitScript re-seeds 700 on each reload, this re-tests clamping, not persistence of the clamped value. Acceptable given SHELL-03 proves persistence, but the same one-shot seed fix applies.
- Screenshots: the snap fixture wrote to agent_docs/qa/relay-polish-panel/*.png, not agent_docs/qa/relay-polish/p3-dock-*.png as the Do asks. The gate generated p3-dock-{1440,1100,780,320}-light.png later. I viewed p3-dock-1440-light.png (dock ~432px) and p3-dock-320-light.png (dock ~320px at a 1000px viewport). Both render the DARK theme while named "-light". Rename them to -dark or regenerate in light.

### P3.6 (gate): every command run by the verifier
- `bunx vitest run src/components/relay src/stores src/hooks src/lib/relay src/i18n`: 129 files, 3431 passed
- `bunx playwright test relay-polish-panel relay-polish-shell --repeat-each=2`: 40 passed (31.9s), clean on this run
- `bunx playwright test layout a11y-layout a11y-keyboard shell chat`: 31 passed
- `check-ids.sh`: OK
- `bun run lint:check`: exit 0
- `bun run typecheck`: exit 0
- brandGuard: 12 passed
- grep RELAY_DEFAULT_WIDTH_PX in src and e2e: empty, exit 0
- `grep -n 'RELAY_MAX_WIDTH_VW = 40'`: constants.ts:5
- `ls p3-*1440*/p3-*320*`: exit 0
- REL-POL-SHELL-08 (the gate's flaky test) covers chords on the landing route. useClampDockWidthOnResize is inactive on "/", and nothing in Phase 3 touches the shortcut path. It passed 2/2 here. Judged unrelated to Phase 3.
- Gate status: commands green, but the phase cannot pass until the P3.3 and P3.5 items are fixed.

## Source code quality (src files changed by P3.1/P3.2)
- constants.ts, useRelayStore.ts, ResizeHandle.tsx, RelayDock.tsx, RelayRoot.tsx: no concrete violations.
  - getRelayMinWidth and getRelayDefaultWidth have identical bodies today, but they read semantically distinct constants. Acceptable.
  - The resize handler writes only when out of range, and the listener is removed on cleanup.

## Fix list for the retry
1. Delete e2e/qa/relay/relay-polish-panel.spec.ts:110-111 (waitForTimeout).
2. Delete the unused viewportWidth/viewportHeight helpers (spec lines 22-32).
3. PANEL-09: make the "" case real (one-shot seed or fresh context).
4. PANEL-02: assert a fresh 900px load = 320 and add drag-to-minimum = 320.
5. (recommended) PANEL-06: assert content is visible beside the dock.
6. ResizeHandle.spec.tsx: make the innerWidth test rerender and assert aria-valuemin/max; drop `newMax` and the duplicate assertion.
7. useRelayStore.spec.ts: add hydrate of a stored "100" → min; fix the misleading test names; remove the duplicate getItem-throws test.
8. RelayRoot.spec.tsx: remove the redundant literal-CSS test.
9. Rename the p3-dock-*-light.png screenshots (they are dark) or regenerate them in light.
10. Correct the P3.3 report's line-44 justification (getServerSnapshot, SSR-only).
