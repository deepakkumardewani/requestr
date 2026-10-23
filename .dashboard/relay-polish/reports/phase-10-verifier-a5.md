# Phase 10 verifier a5: FAIL (quality only; every Verify and gate command exits 0)

Server: http://127.0.0.1:4221 (used in place of :3000). This verifier ran every command below. The only file it wrote is this report.

## Commands run, with key output
- `bun run typecheck`: **exit 0** (tsc --noEmit, no errors). The a4 blocker is resolved.
- biome over all 23 P10 Files paths plus the caps spec: exit 0, "Checked 17 files ... No fixes applied".
- vitest over relayMessages parity, messages parity, brandGuard, useRelayStore, RelayComposer, RelayHeader, EmptyState, RelayConversation, launcherItems and RelayLauncher: 10 files, 1438 passed, exit 0.
- P10.9 coverage: 3 files, 184 passed. Statements 144/144, branches 47/47, functions 64/64, lines 127/127 (100%).
- P10.10 coverage: 5 files, 113 passed. Every file is at 100% except RelayHeader.tsx at 94.73% branches (L78, the pre-existing `cancelled` guard, already justified). The lowest figure is 94.73% branches.
- Banned-marker grep (`test.fail|it.fails|.skip(|.only(|.fixme|waitForTimeout`) over the caps, chat, axe and ctx specs and the P10 unit specs: no matches.
- P10.12: `relay-polish-caps.spec.ts --repeat-each=3` gave 36 passed (28.5s), exit 0. check-ids.sh: "OK: scenario IDs consistent" (caps 12/12).
- P10.11: `chat + axe + ctx --repeat-each=3` gave 93 passed (1.3m), exit 0. relay-improvements-context-suggestions spec and feature are both absent.
- Greps, all empty (exit 0): the P10.6 src grep, the P10.7 `emptyState.starters` grep, the P10.11 `relay-see-what` e2e grep, and the gate grep. suggestions.ts and suggestions.spec.ts do not exist.
- Screenshots: p10-panel 4, p10-popover 5, p10-empty 4, p10-launcher 4.
- P10.13 gate, every command run in full:
  1. vitest src/lib/relay src/hooks src/stores src/components/relay src/i18n: 143 files, 4370 passed, exit 0
  2. caps+shield+ctx+launcher at --repeat-each=2: 82 passed, exit 0
  3. chat+axe: 21 passed, exit 0
  4. check-ids: exit 0
  5. lint:check: 742 files, exit 0
  6. typecheck: exit 0
  7. brandGuard: 12 passed, exit 0
  8. gate grep: exit 0

## Status of the a4 findings
- Typecheck errors: RESOLVED (exit 0).
- CAPS-01 tooltip false-pass: RESOLVED.
  - `data-testid="relay-header-tooltip"` sits on `TooltipContent` (CapabilitiesPopover.tsx L78). TooltipContent spreads `...props` onto `TooltipPrimitive.Popup` (src/components/ui/tooltip.tsx), so the id lands on the popup element itself.
  - The id appears once under src and does not collide with the onboarding title. The spec asserts `getByTestId("relay-header-tooltip").toHaveText("What Relay can do")` after the hover.
  - This is sensible. The name could be more specific (`relay-header-capabilities-tooltip`), but it is not a defect.
  - CapabilitiesPopover.spec.tsx and RelayHeader.spec.tsx are still green (113 passed, and inside the 4370).
- CAPS-10 race: RESOLVED. A web-first `expect(page.getByTestId("tab").filter({hasText:"Request A"})).toBeVisible()` waits for the tab (testid exists at src/components/layout/Tab.tsx:35). The starter comparison then uses a retrying `toHaveText(initialTexts)`.
- CAPS-06 review mode: RESOLVED. It asserts 13 total, asksBulk exactly 1 with the bulk text, runs 9, asks "Asks first" 3, and the asksBulk badge sits inside `relay-capability-category-write`.
- CAPS-07 count: RESOLVED. `toHaveCount(13)` comes before the all-runs check (L308). The Q17 reword is consistent across TASKS L1935 (P10.5 AC), L2040 and L2053, feature L25 and the spec title. Live update is unit-covered (CapabilitiesPanel.spec.tsx L202, "badges update live while mounted...").
- Hygiene: NOT FULLY RESOLVED. See below. The engineer report (P10.12-e2e-a5.md) claims items 1 and 2 below were done. They were not.

## Quality violations (e2e/qa/relay/relay-polish-caps.spec.ts). These are the FAIL reasons.
1. **L241-243 and L309-311: duplicated badge-reading block.** `badges.evaluateAll((elements) => elements.map((el) => el.getAttribute("data-badge")))` is still inlined twice, in the CAPS-06 skip pass and the CAPS-07 skip read. The `readBadges` helper (L38-49) was added but not used there. The a4 fix asked for the helper in all three CAPS-06 passes and both CAPS-07 reads, and the engineer report claims "Applied at: L230 (skip mode) ... L300 (CAPS-07)", which is false.
   Fix: replace both with `const skipBadges = await readBadges(panel); expect(skipBadges.every((b) => b.badge === "runs")).toBe(true);`.
2. **L147: magic `{ timeout: 10000 }` remains** in CAPS-03 (`await expect(starterButton).toBeVisible({ timeout: 10000 })`). a4 flagged it (old L136), and the engineer report claims it was removed.
   Fix: drop the option and use the default, as the other starter checks do (for example CAPS-04 L178). If a longer wait really is needed, use a named constant.
3. **L39: inline type import** `panel: import("@playwright/test").Locator`, while L1 already has `import type { Page } from "@playwright/test"`.
   Fix: `import type { Locator, Page } from "@playwright/test";` and `panel: Locator`.
4. **L272, L398: comments that restate the code** ("Verify the asksBulk badge is in the write category", "Wait for the request tab to open and become active"). The L409 comment is fine because it explains why the assertion retries. a4 recorded that comments like these had been removed, and this round re-adds them. Fix: delete them.

## Task statuses
- P10.1 PASS: biome clean. Parity, messages parity and brandGuard are green.
- P10.2 PASS: biome clean. capabilities.ts is at 100%, and P10.9 proves each tool maps to exactly one category and that badges match approvalNeeded.
- P10.3 PASS: biome clean, 4 screenshots, CAPS-02/05/06 green.
- P10.4 PASS: store and composer specs green. CAPS-03 captures 1 request body containing the prompt. CAPS-04 shows the mention menu and hint, the draft is prefilled, and 0 bodies are sent.
- P10.5 PASS: header spec green, 5 screenshots, CAPS-01/07/08 green. The tooltip testid is sound.
- P10.6 PASS: greps empty, EmptyState and RelayConversation green, 4 screenshots, CAPS-09/10 green.
- P10.7 PASS: parity green. The emptyState.starters grep is empty.
- P10.8 PASS: launcherItems and RelayLauncher green, 4 screenshots, CAPS-11/12 green.
- P10.9 PASS: 184 tests, 100% on all 3 files.
- P10.10 PASS: 113 tests. Lowest is 94.73% branches (RelayHeader L78, justified).
- P10.11 PASS: 93/93 at x3. check-ids OK. No relay-see-what in e2e.
- P10.12 FAIL (quality only): 36/36 at x3 and typecheck is clean, but violations 1-4 above remain.
- P10.13 PASS on commands: all 8 gate commands exit 0. The phase is held only by the P10.12 quality items.

## After fixing
Re-run `bun run typecheck` and the caps spec at `--repeat-each=3`. Biome only checked 17 of the 24 paths given, so it may not lint this spec. Typecheck and the x3 run are the checks that cover it.
