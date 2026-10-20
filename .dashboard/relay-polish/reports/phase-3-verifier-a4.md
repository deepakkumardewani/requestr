# Phase 3 "Dock width limits": verifier report (attempt a4)

VERDICT: PASS. Every Verify and gate command exits 0, and every a3 non-screenshot item is fixed.
Scope note (user instruction): screenshot theme and mid-transition quality are IGNORED. The five p3-dock-*.png files existing is enough.

## a3 items re-checked
1. RelayRoot.spec.tsx L243-252 "does not write when the width is still inside the range": now `resizeTo(1100)` (L249). 432 stays in [330,440], and `setWidth` is not called. FIXED.
2. RelayRoot.spec.tsx L268: renamed to "does not listen to resize on landing page" (pathnameMock "/"). A new test at L281, "does not listen to resize when the feature is disabled", uses `vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED","false")` and asserts setWidth is not called. afterEach L74-77 runs unstubAllGlobals/unstubAllEnvs. FIXED.
3. Gherkin PANEL-02, feature.md L27/L29: now "right edge". Spec L138: "Drag handle to the right edge". This matches `dragHandleTo(page, viewport900.width)`. FIXED.
4. PANEL-03 spec comments L164/L169/L174/L179: these now read "left edge (clientX = 0) -> max", "further left -> stays at max", "right edge -> min", "further right -> stays at min", which matches the code (0, -100, width, width+100). FIXED.
5. PANEL-04 wording: feature.md L50 reads "resizing the window to 900x900 clamps the dock to the new max 360px (40vw of 900)", and spec L213 reads "The app should clamp to the new bounds". No "ratio" remains (grep). FIXED.

## P3.1: PASS
- biome check (5 files): "Checked 2 files ... No fixes applied", exit 0
- vitest constants/useRelayStore/useRelayFocus specs: 3 files, 88 passed
- grep RELAY_DEFAULT_WIDTH_PX in src/lib and src/stores: exit 0 (none)

## P3.2: PASS
- biome check (5 files): exit 0
- vitest ResizeHandle/RelayDock/RelayRoot specs: 3 files, 47 passed (was 46, plus the new disabled-flag test)
- grep RELAY_DEFAULT_WIDTH_PX in src: exit 0

## P3.3 (unit): PASS
- The scoped coverage command from Verify exits 0: 4 files, 101 passed
- json-summary per file (lines/branches/funcs/stmts):
  - constants.ts 100/100/100/100
  - useRelayStore.ts 100/100/100/100
  - ResizeHandle.tsx 100/100/100/100
  - RelayRoot.tsx 95.34/100/89.47/96.15. Uncovered L31 (dynamic import .catch) and L44 (getServerSnapshot, SSR) are pre-existing and justified.
- Lowest figure: 89.47% funcs, RelayRoot.tsx. This is >=80, and the uncovered lines are listed and justified.
- The forbidden-pattern grep (test.fail|it.fails|.skip|.only|.fixme|waitForTimeout) over all 10 phase specs finds nothing (exit 1).
- happy-dom header is present on RelayRoot.spec.tsx and ResizeHandle.spec.tsx.

## P3.4 (e2e migrate): PASS
- playwright layout + a11y-layout + shell, --repeat-each=3: 36 passed (34.6s), exit 0
- check-ids.sh: "OK: scenario IDs consistent"
- grep for DEFAULT_WIDTH_PX = 400 or MAX_WIDTH_VW = 0.6 in e2e/qa/relay: exit 0 (none)

## P3.5 (e2e new): PASS
- playwright relay-polish-panel.spec.ts --repeat-each=3: 27 passed (27.3s), exit 0, no flaky or failed tests
- check-ids: "relay-polish-panel: feature ids: 9  test ids: 9", OK
- 9 test() calls, with one test per id REL-POL-PANEL-01..09
- The p3-dock-{320,780,900,1100,1440}-light.png files exist. Their theme quality was ignored per the user instruction.

## P3.6 (gate): PASS
- vitest src/components/relay src/stores src/hooks src/lib/relay src/i18n: 129 files, 3431 passed, exit 0
- playwright polish-panel + polish-shell --repeat-each=2: 40 passed (33.6s), exit 0
- playwright layout + a11y-layout + a11y-keyboard + shell + chat: 31 passed (27.3s), exit 0
- check-ids.sh: exit 0
- bun run lint:check: "Checked 725 files ... No fixes applied", exit 0
- bun run typecheck (tsc --noEmit): exit 0
- brandGuard.spec.ts: 12 passed
- grep RELAY_DEFAULT_WIDTH_PX in src and e2e: exit 0 (none)
- grep RELAY_MAX_WIDTH_VW = 40: "5:export const RELAY_MAX_WIDTH_VW = 40;"
- ls p3-*1440*.png p3-*320*.png: exit 0

## Quality
No new concrete violations in the a4 edits. Note: running relay-polish-panel.spec.ts still rewrites the tracked p3-dock-*.png files on every run. This is not a failure (screenshots are out of scope per the user).
