# Phase 10 verifier a6: FAIL (quality items in relay-polish-caps.spec.ts only; every Verify and gate command exits 0)

Server: http://127.0.0.1:4221 (used in place of :3000). This verifier ran every command below. The only file it wrote is this report.

## The remaining FAIL reason (e2e/qa/relay/relay-polish-caps.spec.ts)
- **L393: a comment that restates the code is still there.** `// Wait for the request tab to open and become active` sits directly above `const requestTab = page.getByTestId("tab").filter(...)` / `await expect(requestTab).toBeVisible()`. a5 item 4 asked for it to be deleted (it was at L398 then).
  - The engineer report P10.12-e2e-a6.md section 6 says this comment was "Before/After" replaced with `// Use web-first assertion that retries to handle timing races`. **That is false.** The old comment is still at L393, and the "after" text is a separate comment at L404 (that one was already present and is fine, because it explains why).
  - **Fix:** delete line 393 only. Leave L404 alone.
- After all fixes, re-run `bun run typecheck` and the caps spec at `--repeat-each=3`.

## Other concrete violations in the same file (fix them in this round)
- **L231, L250, L279, L297: the magic string `"rq_relay_permission_mode"` and the same seeding block repeated 4 times.**
  - Each occurrence is `page.addInitScript(() => { localStorage.setItem("rq_relay_permission_mode", "<mode>"); })`.
  - The file already names its other storage key (`RECENT_STORAGE_KEY`, L32). The sibling specs relay-polish-shield.spec.ts L12 and relay-polish-perm.spec.ts L10 define `const PERM_KEY = "rq_relay_permission_mode"`.
  - **Fix:** add `const PERMISSION_MODE_STORAGE_KEY = "rq_relay_permission_mode";`. Then add a helper `async function seedPermissionMode(page: Page, mode: string) { await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [PERMISSION_MODE_STORAGE_KEY, mode] as const); }` and use it at all 4 sites.
- **L321: redundant assertion.** `await expect(popover).toBeVisible();` comes right after `openCapabilitiesPopover(page)`, which already asserts that the popover is visible (L54). **Fix:** delete L321.

## Scope check
- `find src e2e messages -type f -newer phase-10-verifier-a5.md` returns only `e2e/qa/relay/relay-polish-caps.spec.ts`.
- No other P10 file changed since a5, so a5's quality review of the other files still holds.

## Status of the a5 quality items (each checked by reading the file and grepping it)
1. Duplicated badge reads: RESOLVED. `evaluateAll` appears only inside `readBadges` (L43). `readBadges` is used at L241, 255, 273, 284, 306 and 323, which covers every CAPS-06 pass and both CAPS-07 reads.
2. `{ timeout: 10000 }`: RESOLVED. A grep for `timeout` finds nothing. L147 is now `await expect(starterButton).toBeVisible();`.
3. Inline `import("@playwright/test").Locator`: RESOLVED. L1 is `import type { Locator, Page } from "@playwright/test";` and L39 is `panel: Locator`.
4. Restating comments: PARTIAL. The L272 comment is gone. The L393 comment (formerly L398) remains, as described above.

## Commands run, with key output
- biome over all 23 P10 Files paths: exit 0 ("Checked 17 files ... No fixes applied").
- vitest over relayMessages parity, messages parity, brandGuard, useRelayStore, RelayComposer, RelayHeader, EmptyState, RelayConversation, launcherItems and RelayLauncher: 10 files, 1438 passed, exit 0.
- P10.9 coverage command: 3 files, 184 passed. Statements 144/144, branches 47/47, functions 64/64, lines 127/127 (100%).
- P10.10 coverage command: 5 files, 113 passed. All files are at 100% except RelayHeader.tsx at 94.73% branches (L78, the pre-existing `cancelled` guard, justified in earlier rounds). The lowest figure is 94.73% branches.
- Banned-marker grep (`test.fail|it.fails|.skip(|.only(|.fixme|waitForTimeout`) over the caps, chat, axe and ctx specs and the P10 unit specs: no matches (grep exit 1).
- P10.12: caps spec `--repeat-each=3` gave 36 passed (28.8s), exit 0. check-ids.sh: "OK: scenario IDs consistent".
- P10.11: chat + axe + ctx `--repeat-each=3` gave 93 passed (1.3m), exit 0. The context-suggestions spec and feature file are both absent.
- Greps, all exit 0 (empty): the P10.6 src grep, the P10.7 `emptyState.starters` grep, the P10.11 `relay-see-what` e2e grep, and the gate grep. `suggestions.ts` and `suggestions.spec.ts` do not exist.
- Screenshots: p10-panel 4, p10-popover 5, p10-empty 4, p10-launcher 4.
- CAPS-07 reword (Q17) is consistent:
  - The feature file L25 reads "after changing the mode via the shield, reopening the popover shows the updated badges", matching TASKS L2040, the P10.5 AC at L1935 and the spec title.
  - Live update is unit-covered at CapabilitiesPanel.spec.tsx L202.
- P10.13 gate, every command run in full:
  1. vitest src/lib/relay src/hooks src/stores src/components/relay src/i18n: 143 files, 4370 passed, exit 0
  2. caps+shield+ctx+launcher at --repeat-each=2: 82 passed (1.1m), exit 0
  3. chat+axe: 21 passed, exit 0
  4. check-ids: exit 0
  5. lint:check: 742 files, exit 0
  6. typecheck (tsc --noEmit): exit 0
  7. brandGuard: 12 passed, exit 0
  8. gate grep: exit 0

## Task statuses
- P10.1 PASS: biome clean. Parity, messages parity and brandGuard are green.
- P10.2 PASS: biome clean. capabilities.ts is at 100%, and the P10.9 specs prove each tool maps to exactly one category and that badges match approvalNeeded.
- P10.3 PASS: biome clean, 4 screenshots, CAPS-02/05/06 green.
- P10.4 PASS: store and composer specs green. CAPS-03 captures 1 body containing the prompt. CAPS-04 shows the mention menu and hint, the draft is prefilled, and 0 bodies are sent.
- P10.5 PASS: header spec green, 5 screenshots, CAPS-01/07/08 green.
- P10.6 PASS: greps empty, EmptyState and RelayConversation green, 4 screenshots, CAPS-09/10 green.
- P10.7 PASS: parity green. The emptyState.starters grep is empty.
- P10.8 PASS: launcherItems and RelayLauncher green, 4 screenshots, CAPS-11/12 green.
- P10.9 PASS: 184 tests, 100% on all 3 files.
- P10.10 PASS: 113 tests. Lowest is 94.73% branches (RelayHeader L78, justified).
- P10.11 PASS: 93/93 at x3. check-ids OK. No relay-see-what in e2e.
- P10.12 FAIL (quality only): 36/36 at x3 and typecheck is clean, but these remain: the L393 restating comment (which the engineer report wrongly says was fixed), the 4x permission-mode seeding with a magic key, and the redundant L321 assertion.
- P10.13 PASS on commands: all 8 gate commands exit 0. The phase is held only by the P10.12 quality items.
