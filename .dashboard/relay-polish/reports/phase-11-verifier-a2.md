# Phase 11 verifier report (attempt 2): FAIL

Host: PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost (stands in for 127.0.0.1:3000 in every Verify command)

## P11.1 Removed-symbol sweep: PASS
- grep 1 (computeContextChips|...|relay-picker-kind-) over src e2e messages: exit 0
- grep Sparkles in src/components/relay: exit 0
- grep RelayPicker\b in src e2e: exit 0

## P11.2 Removed-key sweep and i18n parity: PASS
- vitest parity + brandGuard: 3 files, 1096 passed
- biome check messages/en messages/fr messages/ja: 39 files, clean
- Diff: deletes slash.composerHint and mention.hintRequest/hintCollection/hintChain from en/fr/ja relayDock.json. A grep of src finds no references.
- My own orphan scan of relay.json (40 keys) and relayDock.json (486 keys) leaves only context.moreItems and changes.allUndone. `git log -S` shows both came from 6d4c051 (relay-agent phase 12), so they predate this feature and are correctly kept.
- fr and ja composerPlaceholder still contain @ and /.

## P11.3 Final bundle check: PASS (verdict line), numbers not re-measured
- `grep -nE '^P11\.3 verdict: PASS$' BUNDLE.md` matches at line 34. /app is 759.0 kB (+1.8 against 757.2, under the 762.2 ceiling). The lazy-chunk section names chunk 900d357c… containing caps popover, launcher list and mention menu ids.
- Specs panel/launcher/caps/mention at --repeat-each=2: 90 passed.
- I did not repeat the scratch build, so the 759.0 kB figure is the builder's measurement and is internally consistent. The Verify step only asks for the grep and the spec run.

## P11.4 Docs: FAIL (Do item 1)
- `test -s INDEX.md` exits 0. There are 148 pngs and 148 index lines, and the sets match exactly when diffed by filename.
- Appendix check: every id in the SPEC Appendix A "new/changed" list is present in src as an exact data-testid (checked 28 ids, plus relay-permission-option-${mode} and relay-capability-category-${id} as templates). The four renames are recorded.
- e2e/fixtures/README.md lists no relay specs, so no addition was needed. Its diff only switches the host URL, which is environment setup.
- **Do (1) fails.** I checked in the browser (agent-browser, seeded):
  - Settings > Shortcuts shows `shortcut-note`: "Firefox may reserve this shortcut for its Library window. Use the New chat button in the Relay header instead." This is OK.
  - The keyboard shortcuts dialog (Cmd+/) lists "New Relay chat ⌘ Shift O" with **no Firefox caveat** (dialog textContent has no /Firefox/).
  - The header New chat tooltip has no caveat either (builder admits this in INDEX.md lines 186-187).
  - The task says to verify the caveat "is shown … in the shortcut dialog tooltip text". It is not shown, and no fix was made or routed. The builder only noted it in INDEX.md and wrote no Log line for P11.4.
  - Fix needed: render `noteKey` (shortcuts.relayNewChatNote) for the "New Relay chat" row in src/components/layout/KeyboardShortcutsModal.tsx, reusing the ShortcutsSection pattern. Optionally add it to the RelayHeader New chat tooltip as well. Update KeyboardShortcutsModal.spec, and record a P11.4 Log line. If the fix needs a src file, route it to the owning phase (P2.6), or get the user to amend the Do. Note that P2.6 only required the note in Settings, so this is a gap between the P11.4 wording and P2.6.

## P11.5 E2E accessibility: FAIL (coverage gaps)
- Run: relay-polish-a11y.spec.ts --repeat-each=3 gives 24 passed (8 tests × 3). check-ids.sh OK (relay-polish-a11y 8/8). Grep for skip/only/fixme/test.fail: none.
- One test() per id, tags @qa plus priority, seededPage, no waitForTimeout: OK.
- **A11Y-02 does not scan the open row menu.** The menu content (`relay-thread-menu-rename`, from DropdownMenuContent) renders inside `<MenuPrimitive.Portal>` (src/components/ui/dropdown-menu.tsx:33, no container), so it lives under document.body. The included selectors are relay-dock, relay-thread-overlay and relay-thread-item, none of which contain the portaled menu. The comment "Scan the dock, overlay, and menu together" (spec line 82) is untrue.
  - Fix: include the menu popup, e.g. `'[data-slot="dropdown-menu-content"]'` or `'[role="menu"]'`, in place of or alongside relay-thread-item.
- **A11Y-07 empty-state branch is dead code.** The spec checks `relay-capabilities-empty`, which does not exist anywhere in src. The `if (await emptyState.isVisible())` at lines 206-216 therefore never runs, and "with the empty state" is never explicitly asserted. The new-chat empty state's testid is `relay-empty` (src/components/relay/EmptyState.tsx:16). It may be implicitly inside the dock scan, but it is not asserted.
  - Fix: `await expect(page.getByTestId("relay-empty")).toBeVisible()`, then scan `[data-testid="relay-empty"]` with the popover closed, unconditionally. Delete the conditional.
- A11Y-06: removing the composer-focus assertion is acceptable, because focus is not part of an axe-scan scenario, and the toggle-only-if-closed logic is sound. The localStorage key `rq_relay_permission_mode` is correct (src/lib/relay/constants.ts:43), and the store reads the raw value.
  - Weakness: the test never asserts that the mode actually applied. Add `expect(page.getByTestId(\`relay-permission-option-${mode}\`)).toHaveAttribute("aria-checked","true")` (or equivalent) so each loop iteration provably scans a different mode, including the skip warning tone.
- A11Y-08: the 900px viewport is legitimate. RP-110 sets min = max(30vw, 320px), and dragDockToWidth calls expectDockWidth(320), so the 320px panel is really reached. Dark mode is set via the html class and asserted. OK.
- App edits:
  - MentionMenu adds option tabIndex={-1}, matching the SlashMenu pattern.
  - SlashMenu removes an aria-label that mismatched its visible content, so the name now comes from content; its spec expectation is updated to match.
  - Neither weakens a11y. Both fix real axe findings (scrollable-region-focusable, label-content-name-mismatch).

## P11.6 Targeted run: PASS
- Group 1 (13 polish specs) ×2: 274 passed
- Group 2 (7 migrated) ×2: 112 passed
- Group 3 (13 relay-improvements) ×2: 90 passed
- Group 4 (5) ×2: 24 passed
- check-ids OK. SHELL-08 and REL-A11Y-04 did not flake in my runs.
- Spec edits reviewed:
  - shell MAX_TAB_STOPS 20→40 is only the upper bound of the Shift+Tab search loop. The target must still be reached by real keyboard presses, so the check is not weakened.
  - mic: 3 Tabs (launcher, shield, mic) asserts the real DOM order and still asserts mic focus. Not weakened.
  - launcher/mention other-host check now compares url.origin to the page origin, which is stricter than the hostname allow-list.
  - relayRoutes.ts: the https gate (self-signed via openssl) is needed because route.continue cannot change protocol. It falls back to http on 127.0.0.1.

## P11.7 Whole-project checks: PASS
- lint:check exit 0 (742 files). typecheck exit 0.
- vitest relay scope: 154 files, 4469 passed.
- parity + brand: 3 files, 1096 passed.

## P11.8 Walkthrough: PASS (spec evidence)
- msg/ctx/perm/panel ×2: 80 passed. check-ids OK.
- Browser sanity (agent-browser, seeded): /app loads, the shortcuts dialog opens, and the Settings shortcuts note renders.

## P11.9 DoD: blocked by P11.4 and P11.5
- skip/only/fixme/it.fails/test.fail grep: exit 0. check-ids OK.
- Cannot pass while P11.4 and P11.5 fail.

## Notes for orchestrator (not phase-11 failures)
- src/app/globals.css adds the --warning/--warning-foreground tokens and the @theme mapping. This change is uncommitted, has an mtime of Oct 20 (P9 time), and is used by the committed PermissionShield.tsx, CapabilitiesPanel.tsx and RelayComposer.tsx. It must go into a commit, or the committed code references undefined tokens.
- Environment diffs outside feature scope: package.json/bun.lock (portless), next.config.ts (turbopack root), playwright.config.ts (ignoreHTTPSErrors), qa-seed.init.js and README (host URL), chain check-parity.sh (default URL). These are dev-server setup, not feature work.
- Stray untracked PNG files `700` and `900` at the repo root (Oct 20) should be removed by the owner.
