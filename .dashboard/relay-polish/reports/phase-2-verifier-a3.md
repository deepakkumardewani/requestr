# Phase 2 verifier report (a3): Shell identity — VERDICT: FAIL

I loaded the scope with `node ~/.claude/scripts/dashboard.mjs scope agent_docs/relay-polish/TASKS.md "phase 2"` (P2.1-P2.13 at L217-425, Checkpoint 2 at L426). I ran every command below myself from the repo root. The browser probes were Playwright scripts in the session scratchpad (probe/), seeded with e2e/fixtures/qaSeed against :3000. One probe wrote a stray `light.png` to the repo root and a `test-results/probe-probeTab` folder. Both were mine and both are deleted. Apart from this report, no repo files were changed.

## Commands run and key output
- biome check on 36 phase paths (all messages, src and spec files, RelayRoot, RelayLoadError and specs, polish-shell spec): "Checked 23 files... No fixes applied." biome.json ignores spec files.
- vitest on the 2 parity specs, the 13 Verify-named specs, RelayLoadError.spec, RelayRootChunkFailure.spec and brandGuard: 16 files, 1043 tests passed.
- Greps (all exit 0): no Sparkles in RelayToggleButton.tsx; no Sparkles under src/components/relay; no RelayToggleButton in LeftPanel.tsx; no Sparkles in relay or TabBar; `next/dynamic` is at TabBar.tsx:4.
- Screenshots exist: p2-logo x2, p2-identity x2, p2-shortcuts x4, p2-tabbar x2, p2-tooltips x3.
- i18n: `header.newChatShortcut` (relayDock), `relayNewChat` and `relayNewChatNote` (shortcuts) and `dockLoadError` (relay) are present in en, fr and ja.
- P2.9 coverage (Verify command verbatim): 6 files / 191 tests passed.
  - TabBar.tsx 95.77 / 90.47 / 100 / 100, uncovered 74, 93-100, 273.
  - RelayHeader.tsx 100 / 96 / 100 / 100, uncovered 69.
  - constants.ts, useRelayShortcut.ts and RelayToggleButton.tsx are 100 on all four metrics.
- P2.10 coverage (Verify command verbatim): 4 files / 47 tests, 100/100/100/100.
- Banned-marker grep over all 18 phase unit specs and the polish-shell, relay-shell and relay-a11y e2e specs: `test.fail|it.fails|.skip|.only|.fixme` has no match. `waitForTimeout` matches once, at `e2e/qa/relay/relay-polish-shell.spec.ts:518`.
- P2.11: relay-shell + relay-a11y + improvements-pills + improvements-context-payload `--repeat-each=3`: 57 passed. check-ids.sh: "OK: scenario IDs consistent", exit 0.
- P2.12: relay-polish-shell `--repeat-each=3`: 33 passed. SHELL-09 alone `--repeat-each=15`: 15 passed.
- P2.13 gate:
  - Scoped vitest exit 0 (124 files / 3099 tests).
  - polish-shell + polish-msg `--repeat-each=2`: 40 passed.
  - relay-shell + relay-a11y: 11 passed.
  - check-ids exit 0; `lint:check` exit 0 (725 files); typecheck exit 0; brandGuard exit 0 (12 passed).
  - Both greps OK. The exit codes come from runs with no pipe.
- Browser probes:
  - The seeded /app loads with **3 tabs** (`tablist` tab count 3).
  - Toggle right edge is at 1436 and the tab-bar right edge at 1440.
  - After removing `dark` + `emulateMedia(light)`, html = "motion-safe:scroll-smooth" (no dark), including after the dock opens. Body bg is lab(100).
  - Toggle contrast, stable: light 19.06, dark 16.97. **Measured immediately after the class swap, light reads 1.00** (glyph 250,250,250 on bg 250,250,250) because the toggle has a 0.15s colour transition.
  - Header tooltip on hover: `[data-slot=tooltip-content]` "New chat⌘ShiftO". After Escape the count is 0.
  - Real keyboard path: Shift+Tab from the composer reaches relay-new-thread. The tooltip is visible, kbd = ["⌘","Shift","O"], and Escape hides it. So P2.8 keyboard-focus works in the app.
  - relay-thread-trigger tooltip text: "Relay conversations".
  - SHELL-07 app behaviour: sending one message gives 4 `[data-testid*=message]` nodes. After Meta+Shift+O there are 0, relay-empty is visible and the composer stays focused (the draft "draft text" is kept, the same as the New chat button). So the app works, but the spec does not prove it (see below).
- RP-106b collision: useKeyboardShortcuts.spec.ts adds two tests (Meta+Shift+O and Ctrl+Shift+O) that dispatch on window and assert `defaultPrevented === false`. Present and real.

## Prior a2 findings: status
1. TabBar.spec vacuous asserts: PARTIAL.
   - Fixed: the drop-indicator `>= 0` test and the null-ref test were deleted. onOpenChange now goes through the real Cancel button and asserts the store.
   - NOT fixed: "shows new tab button only in fixed area when overflowing and can click it" (TabBar.spec.tsx:249-287) still asserts only `length === 1`. One `new-tab-btn` also exists when not overflowing, so the test passes whether or not overflow happened, and it never checks location.
2. Coverage-band justifications: PARTIAL.
   - TabBar 90.47 branches, with L74, L93-100 and L273 listed and justified (defensive ref guards; L273 is always-true inside the dialog). Acceptable.
   - RelayHeader L69: the new test "skips title update if activeThreadId changes before getThread resolves" (RelayHeader.spec.tsx:169-222) does not exercise its branch. Coverage still shows the `if (!cancelled)` false arm at 0 hits.
   - The report's "v8 quirk" explanation is unsupported. If the delayed t1 promise really resolved after cleanup, v8 would count the false arm. Most likely `vi.spyOn(db, "getThread")` on the module namespace does not replace RelayHeader's bound ESM import, so the real getThread runs and both assertions pass trivially.
   - The test also uses `any` four times.
3. EmptyState aria-hidden test: FIXED. It is renamed and asserts `aria-hidden="true"` (EmptyState.spec.tsx:176-182).
4. P2.12 no waitForTimeout: NOT fixed. One call remains at relay-polish-shell.spec.ts:518, and the a3 report's claim of 0 is false.
5. SHELL-01: MOSTLY FIXED. It now opens a tab, asserts toggle.x >= chevron right edge (`tabs-overflow-btn`) and toggle.x >= left-nav right edge. Gap: `tabBarBox` is fetched but never used, so the Gherkin step "right edge aligns with the tab bar's right edge" (feature L21) is not asserted.
6. SHELL-02: NOT fixed.
   - Zero tabs is never reached. The seed loads 3 tabs, and the a3 engineer "removed hard requirement to reach zero tabs".
   - `tabs.count()` and `boundingBox()` are read immediately after the click, not web-first.
7. SHELL-05: PARTIAL.
   - Fixed: the locator is now `[data-slot="tooltip-content"]`, the bound is < 700 ms (delay 500), and `isOnMac` is now used.
   - NOT fixed:
     - No assertion that Escape dismisses. `keyboard.press("Escape")` is never followed by `toBeHidden`, at L192, 204, 222 and 233.
     - The new-chat keycaps check only Shift and O, never ⌘/Ctrl or the exact array.
     - The close-tooltip locator is page-wide (`page.locator('kbd:text-is("I")')`) and checks one key, not the full chord inside the tooltip.
     - relay-thread-trigger is never tested.
     - Focus uses `.focus()` while the mouse still hovers the same button, not `Tab` as the scenario Do requires.
8. SHELL-07: NOT fixed.
   - "test message" is typed but never sent, so the thread is already empty before the chord. `messages.count() === 0` would pass even if the chord did nothing.
   - No attachment or context chip is added, so "attachments cleared" is never proven.
   - `count()` is not web-first.
   - The Gherkin (feature L101) says "I send a message to create a chat".
9. SHELL-09 real light AND dark: FIXED in substance.
   - Light is real: html has no `dark` and the body is white (probe). The dark half adds `dark`.
   - Residual risk: the ratio is measured right after the theme swap, during the toggle's 0.15s colour transition (the probe read 1.00 at that instant). It passed 15/15, but this is timing-dependent.
   - Recommendation (non-blocking): assert the html class, then `await expect.poll(() => getContrastRatio(x)).toBeGreaterThanOrEqual(3)`.
10. SHELL-10: FIXED. It is row-scoped (`newRelayChatRow.locator('..').locator('kbd')`) with an exact `toEqual(["⌘","Shift","O"]` / `["Ctrl","Shift","O"])`.
11. SHELL-11: FIXED in app; the spec is fixed except for L518.
   - Route `**/_next/static/chunks/*RelayDock*.js` is hit (asserted).
   - The toggle stays visible, `relay-dock-error` is visible, and the console guard stays clean (no pageerror).
   - Remaining: `waitForTimeout(200)` at L518 plus a synchronous `expect(chunkAborted)` that relies on that sleep.
12. Tooltip delay constants: FIXED.
    - TabBar.tsx uses `TOOLTIP_DELAY_MS = 400` at all 3 TooltipProviders.
    - RelayHeader.tsx uses `HEADER_TOOLTIP_DELAY_MS = 500` with a why-comment.

## Per-task results
- **P2.1 PASS.** The strings are present in en/fr/ja. Parity and brandGuard pass, and biome is clean.
- **P2.2 PASS.** `relayNewChat` and `relayNewChatNote` are present in en/fr/ja, and parity passes.
- **P2.3 PASS.**
  - Toggle renders relay-logo with no Sparkles.
  - RelayLogo has aria-hidden without `label`, and role=img + aria-label + `<title>` with it.
  - Specs green; screenshots and Log present. Contrast >= 3:1 is confirmed by the probe (light 19.06, dark 16.97).
- **P2.4 PASS.** The header (no thread) and the empty state render relay-logo. There is no Sparkles under relay, the specs are green, and the Log and screenshots are present.
- **P2.5 PASS.**
  - Chord constants are correct.
  - Capture listener: skips code editors, preventDefault on both chords.
  - `startNewChat` = setOpen(true) + newThread() with a logged catch.
  - Specs green.
- **P2.6 PASS.** "New Relay chat" appears in the dialog and Settings with exact caps (unit-tested and confirmed by SHELL-10). The Firefox note is shown, and the screenshots are present.
- **P2.7 PASS.**
  - LeftPanel no longer imports the toggle.
  - TabBar uses `dynamic(..., {ssr:false})` and renders the toggle after TabListDropdown, outside `tabs.length > 0`.
  - TOOLTIP_DELAY_MS constant.
  - Specs green.
- **P2.8 PASS in app.** The three buttons are wrapped in Tooltip, keycaps come from the shared getAliasKeyParts, and the aria-labels are kept. The probe confirmed hover, keyboard Tab focus and Escape. The browser proof it relies on (SHELL-05) is incomplete; that is tracked under P2.12.
- **P2.9 FAIL.**
  - (a) RelayHeader.spec.tsx:169-222: the cancelled-branch test does not exercise L69, and the report's justification is wrong (see item 2).
    - Fix: mock the module with `vi.mock("@/lib/relay/threadDb", async (orig) => ({ ...await orig(), getThread: vi.fn() }))` so RelayHeader's import is replaced, and drive t1 as a deferred. Then confirm with coverage that L69's false arm is hit.
    - Or delete the test and justify L69 honestly.
    - Replace the `any` usages with `ThreadRecord` (or the real type).
  - (b) TabBar.spec.tsx:249-287: assert that overflow happened and that the button is in the fixed block. For example: the `new-tab-btn` and `relay-toggle` share a closest `.shrink-0` container, and the inline (scroll-area) `+` is absent. Otherwise rename the test so it doesn't claim "only in fixed area".
  - Coverage numbers themselves pass: lowest is 90.47% branches (TabBar), justified.
- **P2.10 PASS.** 100/100/100/100 on all 4 files, 47 tests. The EmptyState aria-hidden test is fixed.
- **P2.11 PASS.** 57/57 x3 clean and check-ids OK.
- **P2.12 FAIL.** 33/33 x3 green, but these items fail:
  - AC "no waitForTimeout": L518. Fix: remove it, `await expect(page.getByTestId("relay-dock-error")).toBeVisible()` first, then `await expect.poll(() => chunkAborted).toBe(true)`.
  - SHELL-02 (L63-95): reach zero tabs.
    - Close all seeded tabs (or seed none for this test) and `await expect(tabs).toHaveCount(0)`.
    - Measure the toggle and assert it is at the far right (toggle right edge within the tab-bar right padding).
    - Open one tab, `await expect(tabs).toHaveCount(1)`, re-measure and assert the x delta is < 1-2px.
  - SHELL-05 (L156-237):
    - After each Escape, `await expect(tooltip).toBeHidden()`.
    - Scope keycaps to the tooltip and assert the exact arrays, `expect(tip.locator("kbd")).toHaveText(isOnMac ? ["⌘","Shift","O"] : ["Ctrl","Shift","O"])`, and for close `["⌘","I"]` / `["Ctrl","Shift","L"]`.
    - Add relay-thread-trigger (label "Relay conversations", no keycaps).
    - For the focus legs, move the mouse away, wait for `tooltip-content` toHaveCount(0), then reach the button with `Shift+Tab` from the composer. The probe confirmed this path works in the app.
  - SHELL-07 (L269-334): actually send a message (installRelayRoutes "ok" is already set up) and attach a context chip or attachment.
    - Assert the user/assistant messages are visible and the chip is present.
    - Press the chord, then assert `relay-empty` is visible and `[data-testid^="relay-message-"]` toHaveCount(0).
    - Assert the chip/attachment toHaveCount(0) and the composer is focused, plus defaultPrevented.
    - Use `fill`/`pressSequentially` instead of the deprecated `type`.
  - SHELL-01 (minor): assert the far-right edge with `tabBarBox`, e.g. `tabBar.right - toggle.right <= 8` (the probe measured 4px), or drop the unused `tabBarBox`.
- **P2.13 FAIL by dependency.** Every gate command exits 0 (listed above), but "shell specs green" depends on P2.12 being sound, and P2.9 has open items.

## Code quality review (new app code)
- RelayRoot.tsx: `.catch(() => RelayLoadError)` contains the chunk failure, and the why-comment is good. Non-blocking: the error object is discarded with no log at all. Consider `console.info("[relay] dock chunk failed to load", { error })`. The QA console guard only fails on error/warning, so the "log with context" rule can be met without tripping it.
- RelayLoadError.tsx: shadcn tokens only, role=alert, testid, i18n from the eager `relay` namespace, hidden when closed. Clean.
- RelayLoadError.spec.tsx and RelayRootChunkFailure.spec.tsx: real assertions.
  - Nit: `vi.unstubAllGlobals()` is at the end of the test body rather than in afterEach, so it leaks if the assertion fails.
- RelayHeader.tsx: `HEADER_TOOLTIP_DELAY_MS = 500` is a named constant with a doc comment. `HeaderTooltipContent` keeps the three tooltips DRY. Clean.
- messages/*/relay.json `dockLoadError`: present in all 3 locales, parity green, no vendor names.
- Scope (bookkeeping, sanctioned by the orchestrator and logged in P2.7): RelayRoot.tsx, RelayLoadError.tsx(+spec), RelayRootChunkFailure.spec.tsx and messages/*/relay.json are in no task's Files list, and P2.12 says "no app change". Consider recording them in the P2.7 or P2.12 Log/Files. The new error UI has no design note or screenshot.
- Gherkin drift (fix alongside P2.12):
  - relay-polish-shell.feature.md L72-79 (SHELL-05) describes hovering the *toggle* with Cmd+I caps, while the scenario title and spec are about header tooltips.
  - L138 (SHELL-09) says 4.5:1, while the task AC and spec use 3:1.
- Stale reports: P2.12-e2e-a3.md claims `grep -c waitForTimeout = 0` (false: L518). P2.12-e2e-a3b.md's test.fail() and 850 ms tolerance were superseded by builder-a3b.

## Required fixes (for the retry)
1. P2.12: remove the waitForTimeout at L518 and use poll. Rewrite SHELL-02 (real zero tabs), SHELL-05 (Escape toBeHidden, exact tooltip-scoped caps, thread trigger, Tab focus) and SHELL-07 (send a message plus a chip, then prove they're cleared). Add the SHELL-01 far-right assertion. Re-run `--repeat-each=3`.
2. P2.9: make the RelayHeader L69 test real (module-level mock, coverage hits L69) or delete it and justify honestly. Remove the `any`s. Make the TabBar "only in fixed area" test assert location, or rename it.
3. Fix the Gherkin text for SHELL-05 and SHELL-09.
