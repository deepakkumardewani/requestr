# Phase 3 "Dock width limits": verifier report (attempt a3)

VERDICT: FAIL. Every Verify and gate command exits 0. P3.1, P3.2 and P3.4 pass. P3.5 still fails the a2 screenshot item: the 320px shot is dark, and the engineer's "verified visually" claim is false. P3.5 also has new Gherkin direction errors and inverted spec comments. P3.3 dropped a2 item 8 without saying so. P3.6 fails because it depends on these tasks.

NOTE: running relay-polish-panel.spec.ts rewrites agent_docs/qa/relay-polish/p3-dock-*-light.png on every run. I viewed the files both before and after my own runs (mtime 08:57, then regenerated), and the result was the same each time.

## Commands run by the verifier (foreground)

### P3.1: PASS
- `bunx biome check <5 P3.1 files>`: "Checked 2 files ... No fixes applied", exit 0 (biome ignores specs)
- `bunx vitest run constants.spec.ts useRelayStore.spec.ts useRelayFocus.spec.ts`: 3 files, 88 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src/lib src/stores)"`: exit 0
- The source diff matches the Do: vwToPx floor; min = max(320, 30vw); max = max(min, 40vw); default = max(320, 30vw); clamp falls back to the default for non-finite values; readWidth returns the default for null or blank and clamps otherwise; the SSR initial width is RELAY_MIN_WIDTH_PX; the CSS constants are template strings.

### P3.2: PASS
- `bunx biome check <5 P3.2 files>`: exit 0
- `bunx vitest run ResizeHandle.spec.tsx RelayDock.spec.tsx RelayRoot.spec.tsx`: 3 files, 46 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src)"`: exit 0
- Source: the aside min/max come from RELAY_MIN/MAX_WIDTH_CSS. aria-valuemin/max come from getRelayMin/MaxWidth(innerWidth). The offset is clamp(MIN_CSS, Wpx, MAX_CSS). useClampDockWidthOnResize writes only when clamped !== width and removes its listener. No source violations.

### P3.3 (unit): FAIL (spec quality; a2 item 8 dropped)
- The scoped coverage command from Verify gives 4 files, 100 passed, exit 0.
- json-summary per file (lines/branches/funcs/stmts):
  - constants.ts 100/100/100/100
  - useRelayStore.ts 100/100/100/100
  - ResizeHandle.tsx 100/100/100/100
  - RelayRoot.tsx 95.34/100/89.47/96.15
- Uncovered lines 31 (dynamic import .catch) and 44 (getServerSnapshot, SSR only) are pre-existing and justified. Lowest figure: 89.47% functions.
- Forbidden-pattern grep (test.fail|it.fails|.skip|.only|.fixme|waitForTimeout) over all 10 phase specs: no matches (exit 1).
- Both component specs start with `/** @vitest-environment happy-dom */`.
- a2 items confirmed FIXED:
  - useRelayStore.spec.ts L112/L117 are now "rounds to the nearest px (450.4 -> 450)" and "rounds half up (450.5 -> 451)".
  - ResizeHandle.spec.tsx: the "Change innerWidth" and "At innerWidth/At clientX" comments are gone (grep exit 1), and the file ends cleanly at L165 `});`.
- NOT FIXED: a2 item 8. The a3 unit report does not mention it.
  1. src/components/relay/RelayRoot.spec.tsx:268. The test "does not listen to resize when the feature is disabled or on landing page" only sets pathnameMock "/" (landing). It never exercises the disabled flag, so the name claims coverage the test does not have.
     FIX: rename it to "...on the landing page", or add a case with `vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED","false")` (as L215 does) that asserts setWidth is not called.
  2. src/components/relay/RelayRoot.spec.tsx:243-252. "does not write when the width is still inside the range" calls `resizeTo(VIEWPORT_PX)`, and VIEWPORT_PX = 1440 (L15) is the same viewport as setup. The range never changes, so this only weakly proves the P3.2 AC ("a resize that leaves it in range does not [write]").
     FIX: `resizeTo(1100)`, where 432 is still inside [330, 440].

### P3.4 (e2e migrate): PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test relay-improvements-layout relay-improvements-a11y-layout relay-shell --repeat-each=3`: 36 passed (34.4s), exit 0, no flakes
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent"
- `test -z "$(grep -rnE 'DEFAULT_WIDTH_PX = 400|MAX_WIDTH_VW = 0\.6' e2e/qa/relay)"`: exit 0

### P3.5 (e2e new): FAIL
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=3`: 27 passed (27.7s), exit 0
- check-ids: "relay-polish-panel: feature ids: 9 test ids: 9", OK
- a2 items confirmed FIXED:
  - PANEL-02 fresh load at 900 (spec L113-117) asserts 320. This also proves nothing persisted from the 1100 visit, because a stored 330 would still be in range at 900.
  - PANEL-02 Gherkin L25-26 (fresh 900 -> 320; 1100->900 resize keeps 330) now matches the app.
  - PANEL-03 Gherkin directions are fixed (L36-40).
  - PANEL-06 has `expect(dockBox/contentBox).not.toBeNull()` (L302-303). The remaining `if` at L304 now only narrows the type and is not hollow. It uses getByRole("main"), which is acceptable.
  - PANEL-09 now runs on seededPage: evaluate setItem "" (L442-447), reload, openRelay, expectDockWidth. The extra context is gone, the snap is on the correct page, and the Gherkin L105-107 matches.
- FAIL items:
  1. SCREENSHOTS ARE STILL NOT LIGHT (a2 item 1 only partly fixed).
     - I viewed all five p3-dock-*-light.png files.
     - 1440 and 780 are light.
     - p3-dock-320-light.png is DARK: dark sheet, dark tip card, dark composer, and a near-invisible "Relay" title. It was dark both before and after my run.
     - 1100 and 900 are captured mid-transition: the suggestion chips and the "Skip" button are almost invisible, while 1440 and 780 show them clearly.
     - Cause: snapTaskRequired (spec L23-41) swaps `html` classes at runtime and screenshots straight away, so CSS color transitions and the theme provider race the capture.
     - The `toHaveClass(/light/)` check at L36 only asserts the class that L30 just added, so it proves nothing.
     - The swap also changes theme state mid-test before more assertions run (PANEL-02 L108/L119).
     - The engineer report's "verified visually" claim is false for 320.
     FIX: seed the theme the way the repo already does, before navigation. For example, `await page.addInitScript(() => localStorage.setItem("theme", "light"))`, or setItem then reload (see e2e/qa/relay/relay-polish-shell.spec.ts:435 and THEME_STORAGE_KEY in relay-improvements-layout.spec.ts:13). Delete the classList swap and the self-fulfilling toHaveClass check. Capture with `page.screenshot({ path, animations: "disabled" })`. Then view all five PNGs and confirm they are light.
     Recommended: gate the agent_docs writes behind an env flag, or produce them once, so normal and --repeat-each runs stop rewriting tracked artifacts.
  2. PANEL-02 Gherkin direction errors (new; same kind as a2's PANEL-03 item).
     - e2e/scenarios/relay/relay-polish-panel.feature.md L27 says "dragging the handle to the left edge at 900px makes it 320px (minimum)", and L29 says "after dragging the handle to the left edge ...".
     - The spec drags to clientX = viewport900.width (L139), which is the RIGHT edge. Dragging to the left edge gives the maximum.
     - Spec comment L138 has the same error: "Drag handle to the left edge to test minimum".
     FIX: change all three to "right edge".
  3. Quality: e2e/qa/relay/relay-polish-panel.spec.ts L164, L169, L174 and L179 have inverted, self-contradictory comments. The code is correct and the comments contradict it.
     - L164: "Drag to right (far left clientX = 0) -> should clamp to max"
     - L169: "Try to drag further right (negative)"
     - L174: "Drag to left (far right clientX)"
     - L179: "Try to drag further left"
     FIX: correct them to "drag to the left edge (clientX 0) -> max", "further left -> stays at max", "drag to the right edge -> min", "further right -> stays at min", or delete them.
- Minor (fix while there):
  - feature.md L50 "keeps the dock at its previous ratio within the new bounds" and spec L213 "should maintain the ratio or clamp" are inaccurate. The app clamps (576 -> 360). Reword to "is clamped to the new max 360px".
  - snapTaskRequired's "what" comments (L27, L31, L35) go away with the fix in item 1.
  - Optional: in PANEL-09, assert `localStorage.getItem(STORAGE_KEY) === ""` after the reload, so the "" path cannot be faked by a stored 432.

### P3.6 (gate): every command exits 0, but the gate FAILS on P3.3 and P3.5
- `bunx vitest run src/components/relay src/stores src/hooks src/lib/relay src/i18n`: 129 files, 3430 passed, exit 0
- `bunx playwright test relay-polish-panel relay-polish-shell --repeat-each=2`: 40 passed (33.7s), exit 0
- `bunx playwright test layout a11y-layout a11y-keyboard shell chat`: 31 passed (28.2s), exit 0
- `bash e2e/scenarios/relay/check-ids.sh`: "OK: scenario IDs consistent"
- `bun run lint:check`: "Checked 725 files ... No fixes applied", exit 0
- `bun run typecheck`: tsc --noEmit, exit 0
- `bunx vitest run src/lib/relay/brandGuard.spec.ts`: 12 passed
- `test -z "$(grep -rn RELAY_DEFAULT_WIDTH_PX src e2e)"`: exit 0
- `grep -n 'RELAY_MAX_WIDTH_VW = 40' src/lib/relay/constants.ts`: "5:export const RELAY_MAX_WIDTH_VW = 40;"
- `ls p3-*1440*.png p3-*320*.png`: exit 0. However, p3-dock-320-light.png is a dark image (see P3.5 item 1), so the screenshot AC is met only in name.

## Fix list for the retry
1. P3.5: seed theme=light via localStorage before goto, remove the class swap and self-asserting check, screenshot with animations disabled, and view all five PNGs (320 especially).
2. P3.5: in the PANEL-02 Gherkin L27 and L29 and spec comment L138, change "left edge" to "right edge".
3. P3.5: fix or delete the inverted PANEL-03 comments at spec L164, L169, L174 and L179.
4. P3.3: in RelayRoot.spec.tsx L268, rename the test to "landing page" only, or add the disabled-flag case. At L249, resize to 1100 instead of 1440.
5. (minor) PANEL-04 "ratio" wording at feature L50 and spec L213.
