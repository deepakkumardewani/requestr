# Phase 3 "Dock width limits": verifier report (attempt a2)

VERDICT: FAIL. Every Verify and gate command exits 0, and P3.1, P3.2 and P3.4 pass. P3.3 and P3.5 still carry unfixed a1 items and some new defects. P3.6 cannot pass until they are fixed.

NOTE: running the P3.5 spec rewrites agent_docs/qa/relay-polish/p3-dock-*-light.png on every run (`snapTaskRequired`), so this verifier's runs moved their mtime to 08:46. The content is the same and still dark.

## Commands run by the verifier (foreground)

### P3.1: PASS
- `bunx biome check <5 P3.1 files>`: exit 0 (biome ignores *.spec.ts, so the specs are not linted)
- `bunx vitest run constants.spec.ts useRelayStore.spec.ts useRelayFocus.spec.ts`: 3 files, 88 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src/lib src/stores)"`: exit 0
- Code matches the Do: vwToPx floor; min = max(320, 30vw); max = max(min, 40vw); default = max(320, 30vw); clamp falls back to default for non-finite; readWidth returns the default for null or blank and clamps otherwise; pre-hydration width = RELAY_MIN_WIDTH_PX.
- Spec table: 1440 432/576/432, 1100 330/440, 1024 320/409, 900 320/360, 800, 780 and 320 all 320/320. Hydrate "9999" gives max; "100" gives min (now present); "", "   ", "abc" give the default. setWidth clamps.

### P3.2: PASS
- `bunx biome check <5 P3.2 files>`: exit 0
- `bunx vitest run ResizeHandle.spec.tsx RelayDock.spec.tsx RelayRoot.spec.tsx`: 3 files, 46 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src)"`: exit 0
- Code: the aside's minWidth/maxWidth come from RELAY_MIN/MAX_WIDTH_CSS. The handle's aria-valuemin/max come from getRelayMin/MaxWidth(innerWidth). The offset is clamp(MIN_CSS, Wpx, MAX_CSS). useClampDockWidthOnResize writes only when clamped !== width and cleans up its listener. No source quality violations.

### P3.3 (unit): FAIL (spec quality)
- Scoped coverage command (as written in Verify): 4 files, 100 passed. The text table lists only RelayRoot because the others are full.
- json-summary per file (lines/branches/funcs/stmts):
  - constants.ts 100/100/100/100
  - useRelayStore.ts 100/100/100/100
  - ResizeHandle.tsx 100/100/100/100
  - RelayRoot.tsx 95.34/100/89.47/96.15. Uncovered lines 31 (dynamic import `.catch`) and 44 (useSyncExternalStore getServerSnapshot, SSR only). Both are pre-existing and the justifications are now correct.
- Lowest: 89.47% functions (RelayRoot.tsx), justified.
- Forbidden-pattern grep (test.fail|it.fails|.skip|.only|.fixme|waitForTimeout) on all phase specs: no matches (exit 1).
- Both component specs start with `/** @vitest-environment happy-dom */`.
- a1 items confirmed FIXED:
  - The aria rerender test now stubs 1440, rerenders and asserts 432/576; the unused newMax is gone.
  - The stored "100" hydrate test was added.
  - The duplicate getItem-throws test was removed.
  - The redundant literal-CSS RelayRoot test was removed.
  - The duplicate toHaveBeenLastCalledWith was removed.
- a1 items NOT fixed, or fixed incorrectly:
  1. src/stores/useRelayStore.spec.ts: the tests "rounds fractions down (banker's rounding)" and "rounds fractions up (banker's rounding)" have wrong names. The source uses Math.round (round half up). Banker's rounding would turn 450.5 into 450, but the test asserts 451. The names contradict their own assertions; a1 asked for accurate names.
     FIX: rename them to "rounds to the nearest px (450.4 -> 450)" and "rounds half up (450.5 -> 451)", or merge them into one test.
  2. src/components/relay/ResizeHandle.spec.tsx: the stray blank line before the final `});` is still there (a1 flagged it; biome skips specs). The "what" comments a1 asked to remove remain: `// Change innerWidth to 1440` and the two-line clientX comment in "calculates width as innerWidth minus clientX during drag".
     FIX: delete the blank line and those comments.
- New (minor, retry feedback):
  - src/components/relay/RelayRoot.spec.tsx: the test "does not listen to resize when the feature is disabled or on landing page" only exercises the landing path (pathname "/"). Rename it to "...on the landing page", or add the disabled-flag case.
  - RelayRoot.spec.tsx: "does not write when the width is still inside the range" resizes to the same 1440 viewport, so the range never changes. Prefer resizing to 1100, where 432 is still inside [330, 440].

### P3.4 (e2e migrate): PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test relay-improvements-layout relay-improvements-a11y-layout relay-shell --repeat-each=3`: 36 passed (35.4s), 12 tests x3, no failures or flakes
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent"
- `test -z "$(grep -rnE 'DEFAULT_WIDTH_PX = 400|MAX_WIDTH_VW = 0\.6' e2e/qa/relay)"`: exit 0

### P3.5 (e2e new): FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=3`: exit 0, 27 passed (24.5s)
- check-ids: "relay-polish-panel: feature ids: 9 test ids: 9", OK
- a1 items confirmed FIXED:
  - The waitForTimeout is removed (grep finds none).
  - The dead viewportWidth/viewportHeight helpers are removed.
  - The PANEL-02 drag-to-minimum at 900 now asserts 320.
  - PANEL-09 now really seeds "" (in a separate context; see item 5).
- FAIL items:
  1. SCREENSHOTS ARE DARK. I viewed all four agent_docs/qa/relay-polish/p3-dock-{1440,1100,780,320}-light.png: each renders the dark theme (near-black background, dark sidebar and dock). The cause is spec L22-30, where `snapTaskRequired` hardcodes the `-light` suffix and never sets the theme. The engineer report admits "theme assumed light".
     FIX: emulate light before the shot (`await page.emulateMedia({ colorScheme: "light" })`, or seed the app's theme preference to light) and verify the image. Alternatively, derive the suffix from the actual theme and also produce the light shots. Do not just rename them to -dark, since the Design convention asks for light and dark.
     Also: writing into agent_docs on every test run (including --repeat-each) is a side effect. Prefer generating these once via agent-browser, or gate the writes behind an env flag.
  2. PANEL-02: a1 item 3 is only half fixed, and the engineer's claim is false. The P3.5-e2e-a2 report says it "load[s] fresh at 900px and assert[s] 320px minimum". The spec never loads fresh at 900. At L100-103 it resizes from 1100 and asserts that 330 is kept. So "at 900px it is 320px" holds only after the drag-to-min at L107-108.
     FIX: add `await page.setViewportSize({width:900,height:900}); await page.goto(WORKSPACE_PATH); await openRelay(page); await expectDockWidth(page, 320);` with no saved width, or a separate fresh load at 900.
  3. PANEL-02 Gherkin contradicts the spec and the app. In e2e/scenarios/relay/relay-polish-panel.feature.md L25-26: "resizing to 900x900 makes the dock 270px (30vw of 900, but clamped to 320px floor) / And the dock is exactly 320px after the resize". The app correctly keeps 330 (in range at 900, per the P3.2 design), and the spec asserts 330.
     FIX: rewrite these steps as "a fresh load at 900x900 opens at 320px; resizing from 1100 to 900 keeps 330px (still in range); dragging to the minimum gives 320px".
  4. PANEL-06: the new bbox check is hollow. Spec L268-273 reads `if (dockBox && contentBox) { expect(...) }`, so the assertion silently never runs if either box is null. It also uses `page.locator("main")` rather than a test id (Conventions say getByTestId first).
     FIX: `expect(dockBox).not.toBeNull(); expect(contentBox).not.toBeNull();` then compare without the `if`, and use a test id on the workspace content if one exists.
  5. PANEL-09 bypasses the QA console guard and seed. Spec L406-425 runs the empty-string case on `page.context().browser()?.newContext()`. The auto `consoleGuard` fixture (e2e/fixtures/qa.ts L63-98) only listens on the fixture `page`, and `seededPage` seeding does not apply to the new context. Console errors or warnings in the "" case therefore go undetected. `snap("02-empty-value-falls-back")` (L422) also captures the original `page`, not `emptyPage`, so the visual record is mislabelled. The context is not closed if an assertion fails (no try/finally). The Gherkin (L104-106) says "set to an empty string / And I reload the page", which the spec does not do.
     FIX: the "abc" init script is already one-shot (sessionStorage guard), so stay on seededPage: `await page.evaluate((k) => localStorage.setItem(k, ""), STORAGE_KEY); await page.reload(); await openRelay(page)` if needed; `await expectDockWidth(page, expectedDefault)`. Then delete the extra context.
- Gherkin/spec drift (fix with item 3): the PANEL-03 feature L35 and L38 say "drag far to the right" gives the max 576 and "far to the left" gives the min 432. The directions are inverted: the spec drags to clientX 0 (left) for the max, which is correct.
- Not blocking: PANEL-04 still re-seeds 700 on each reload (addInitScript), so "reload keeps the clamped width" re-tests clamping. a1 accepted this.

### P3.6 (gate): every command exits 0, but the gate FAILS on P3.3 and P3.5
- `bunx vitest run src/components/relay src/stores src/hooks src/lib/relay src/i18n`: exit 0, 129 files, 3430 passed
- `bunx playwright test relay-polish-panel relay-polish-shell --repeat-each=2`: exit 0, 40 passed (31.5s), no flakes
- `bunx playwright test layout a11y-layout a11y-keyboard shell chat`: exit 0, 31 passed (27.2s)
- `bash e2e/scenarios/relay/check-ids.sh`: exit 0
- `bun run lint:check`: exit 0 ("Checked 725 files ... No fixes applied")
- `bun run typecheck`: exit 0
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src e2e)"`: exit 0
- `grep -n 'RELAY_MAX_WIDTH_VW = 40' src/lib/relay/constants.ts`: "5:export const RELAY_MAX_WIDTH_VW = 40;"
- `ls p3-*1440*.png p3-*320*.png`: exit 0. The files exist, but they are mislabelled dark shots (see P3.5 item 1), so the AC "screenshots at 1440, 1100, 780 and 320 exist" is met only in name.

## Fix list for the retry
1. Make the p3-dock screenshots really light (emulateMedia/theme seed) and check the images; stop hardcoding "-light".
2. PANEL-02: add a fresh no-saved-width load at 900 that asserts 320.
3. Fix the PANEL-02 Gherkin (L25-26) and the PANEL-03 drag directions (L35, L38); align the PANEL-09 Gherkin with the spec.
4. PANEL-06: assert the boxes are non-null, remove the `if`, and prefer a test id.
5. PANEL-09: run the "" case on seededPage via evaluate + reload; remove the extra context; fix the snap target.
6. useRelayStore.spec.ts: drop the "banker's rounding" names (Math.round is half-up).
7. ResizeHandle.spec.tsx: remove the stray blank line before the final `});` and the "what" comments.
8. (minor) RelayRoot.spec.tsx: rename the landing-only "disabled or landing" test; make the in-range resize test change the viewport.
