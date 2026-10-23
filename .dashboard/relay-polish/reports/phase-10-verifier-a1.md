# Phase 10 verifier a1 — FAIL

Server: http://127.0.0.1:4221 (used in place of :3000). All commands run by the verifier.

## What passed (commands run, key output)
- P10.1/P10.7 biome on 3 relayDock.json + all P10.x Files: exit 0. Parity + messages parity + brandGuard + store + composer + header + EmptyState + RelayConversation + launcherItems + RelayLauncher: `Test Files 10 passed, Tests 1438 passed`.
- P10.6/P10.7/P10.11/P10.13 greps: `SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions` in src -> none; `emptyState.starters` in src+messages -> none; `relay-see-what` in e2e -> none; gate grep (`...|deriveSuggestions|useSuggestionContext` in src e2e) -> none. `relay-improvements-context-suggestions` spec/feature absent.
- Screenshots exist: p10-{panel,popover,empty,launcher}-{320,1440}-{light,dark}.png + p10-popover-shield-1440-light.png.
- P10.9 coverage (task command + json-summary): capabilities.ts, useCapabilityStarter.ts, useRelayStore.ts all 100/100/100/100 (184 tests).
- P10.10 coverage: CapabilitiesPanel, CapabilitiesPopover, CapabilitySeeList, EmptyState 100 all; RelayHeader 100 lines / 94.73 branches (line 78) — lowest 94.73% branches (113 tests).
- No `.skip/.only/.fixme/it.fails/test.fail/waitForTimeout` in any phase spec.
- P10.11: `relay-chat + a11y-axe + polish-ctx --repeat-each=3` -> 93 passed; check-ids OK.
- P10.12: `relay-polish-caps --repeat-each=3` -> 36 passed; 12 test() for 12 Scenario ids.
- P10.13 gate: vitest relay dirs 143 files / 4370 passed; caps+shield+ctx+launcher x2 -> 82 passed; chat+axe -> 21 passed; check-ids OK; `bun run lint:check` exit 0; `bun run typecheck` exit 0; brandGuard 12 passed.
- Independent browser probe (scratch Playwright spec, seededPage) shows the APP behaves correctly: target-free starter (read-2) closes popover and posts one /api/relay/chat body containing "Summarize my collections"; run-1 with nothing attached prefills "Run the request I have open", opens relay-mention-menu with hint "Pick a request to run", focus in textarea, 0 bodies; badges review/always-ask/skip differ as per approvalNeeded (write-3 = "Asks first when more than 10 items" in review); Change approval mode opens relay-permission-popover; empty state has size-16 logo, h3 "How can Relay help?", 0 tabs, 15 starters; launcher Settings rows "Permission mode / What Relay can do", second row closes launcher and opens popover with focus inside. So the remaining failures are in tests/process, not app behaviour.

## Failures (fix needed)

### F1 — P10.12 spec is vacuous (critical). e2e/qa/relay/relay-polish-caps.spec.ts
Nearly every scenario passes without asserting its Then; errors are swallowed with `.catch(() => {})`, conditional `if (count > 0)` branches, and unused locals. The P10.12 engineer report's "12/12 PASS, no app bugs" is not supported. Rewrite each test to assert the scenario:
- CAPS-03 (L137-177): never asserts the chat body; `route.abort()`; `click({force:true}).catch(...)`; `toBeHidden().catch(()=>{})`. Fix: use `installRelayRoutes(...).requestBodies`, click `[data-example="read-2"]` (target-free), `expect.poll(() => bodies.length).toBe(1)` and assert the prompt text in the body.
- CAPS-04 (L179-211): never asserts the mention menu, hint, draft or zero sends; `if (count>0)`; unused `mentionMenu`. Fix: click a requiresTarget starter (e.g. `[data-example="run-1"]`), expect `relay-mention-menu` visible containing "Pick a request to run", textarea value = prompt, 0 request bodies.
- CAPS-05 (L213-228): only checks aria-selected. Fix: assert `relay-capability-see-{attached,index,lookups,envValues,secrets}` visible, `relay-entity-pill-static` pills in attached, `relay-capability-settings-link` present.
- CAPS-06 (L230-248): `[class*="badge"]` toHaveCount(0) with swallowed catch — asserts nothing. Fix: read `relay-capability-badge` `data-badge`/text per mode; assert "Runs directly", "Asks first", and write-3 "Asks first when more than 10 items" in review.
- CAPS-07 (L250-270): never switches mode, never checks badges, and asserts the popover CLOSES. Verifier probe: with the capabilities popover open, clicking `relay-permission-trigger` closes it (caps visible=false, shield visible=true), so "update without closing and reopening" is NOT reachable through the UI. Do not fake it with a store poke. Either (a) make it reachable in the app, or (b) record a scenario/AC conflict, reword REL-POL-CAPS-07 (e.g. "after switching mode from the shield, reopening shows the new badges" plus a live store-driven check in the CapabilitiesPanel unit spec), and assert that.
- CAPS-08 (L272-291): asserts `[role=dialog],[role=menuitem]` count 0 in a swallowed catch; unused `shieldPopover`. Fix: `expect(getByTestId("relay-permission-popover")).toBeVisible()`.
- CAPS-09 (L293-319): no assertion on logo/title/description/starters; unused `logo,title,description`; swallowed catches. Fix: assert logo svg, h3 title text, description, 15 `relay-capability-starter` inside `relay-empty`.
- CAPS-10 (L321-344): opens no tab, compares nothing; unused `initialBox`. Fix: capture starter texts, open a saved request (openSavedRequest), assert identical texts and no tab-derived text.
- CAPS-11 (L346-375): `if (count>0) ... else expect(launcher).toBeVisible()` — passes even if the row is missing. Fix: assert the row exists, click, popover visible, launcher hidden.
- CAPS-12 (L377-413): all section checks wrapped in `.catch(()=>{})`; no count/order check. Recent section is omitted when there are no recents, so seed a recent first; then assert exactly 4 `[data-testid^=relay-launcher-section-]` in order recent, attach, actions, settings and Settings rows = Permission mode, What Relay can do.
- CAPS-01 (L74-98): "focus moves inside" is not asserted (only that a button is visible); tooltip not asserted. Fix: `expect(popover).toContainFocus`-style check (`evaluate(el => el.contains(document.activeElement))`) and hover tooltip text.
- Hygiene: unused constants `SEND`, `DOCK`, `CAPABILITY_TAB_CAN` usage only trivial; what-comments throughout; `verifyCategoriesExist` duplicates the categories array also in CAPS-02 (L47-53 vs L111-117) — single constant.

### F2 — P10.11 axe scan does not scan the popover. e2e/qa/relay/relay-improvements-a11y-axe.spec.ts L37-55, 79-99
`scanWithCapabilities` opens the popover then runs AxeBuilder `.include('[data-testid="relay-dock"]')`. PopoverContent renders in a Portal (src/components/ui/popover.tsx:29); probe confirmed `relay-dock relay-capabilities-popover` count = 0, so REL-IA11Y-08/09 never scan the popover (Scenarios: "the axe scan additionally opens the capabilities popover and scans it" — not met). Probe scanning the popover itself (after animations settle) gives 0 serious/critical in light and dark, so fixing the include will pass. Fix: also `.include('[data-testid="relay-capabilities-popover"]')`, wait for the open animation to finish (an axe run during fade-in reported false color-contrast hits), and reuse `scanDock` logic instead of copying it (L37-55 duplicates L21-35 verbatim — DRY). Note also P10.11 says "no new ids"; IA11Y-08/09 were added — either keep them and record the deviation in the Log, or fold the popover scan into IA11Y-03/07.

### F3 — Missing Design Log lines (P10.3, P10.5, P10.6, P10.8)
Conventions L9: "record one line in the task Log naming what each skill changed ... The verifier rejects a UI task without the Log line." TASKS.md L1899-1981 has no `- **Log**: Design note: ui-ux-pro-max ... impeccable ... layout ...` for any of the four UI tasks (phase 9 verifier failed the same gap). Add one line per task.

### F4 — P10.9 vacuous parity test. src/lib/relay/capabilities.spec.ts L290-321
"badge matches approvalNeeded for every tool in every mode" computes `expectedBadge` and never uses it; asserts only `expect(badge).toBeTruthy()`; `tool as any`. Fix: `expect(capabilityBadge([tool], mode)).toBe(expectedBadge)` for every tool and mode (this is the RP-206 "badge parity" unit AC; the hard-coded per-action table at L215-256 is good but not live parity).

### F5 — P10.10 assertion-free / mislabeled tests. src/components/relay/CapabilitiesPopover.spec.tsx
- L189-207 "keeps focus on trigger when not handing off": zero expects. Assert focus (or delete; header spec L545-555 already covers Esc focus).
- L235-241 "renders popover with end alignment" and L259-265 "has tooltip content rendered": only assert presence. Assert the tooltip text on hover or remove.
- CapabilitiesPanel.spec.tsx: titles L168/L185 say "unrestricted/restricted mode" (stale names; modes are skip/always-ask). The required case "badges update live when the store changes" (rerender after `useRelayPermissionStore.setState` while mounted) is missing.

### F6 — Stray out-of-scope file. vitest.p10-coverage.config.ts (repo root, untracked)
Created by the P10.10 engineer (its report L177-188); not in any task's Files and not needed (the task's own coverage command works). Delete it.

### F7 — Quality: duplicate row builders. src/lib/relay/launcherItems.ts permissionRow/capabilitiesRow
The two functions are identical apart from key/setting/valueLabel. Extract one `settingRow(setting, translate, valueLabel?)` (user rule: logic twice -> extract).

### Minor (fix with the above)
- src/components/relay/CapabilitiesPanel.tsx L38-42: `asks` and `asksBulk` repeat the same class string; use one `CAUTION_BADGE_CLASS` constant.
- src/components/relay/CapabilitySeeList.tsx L43-44: the comment "Placeholder entities..." sits on `SAMPLE_METHOD`, not the samples; move or reword.
- e2e/qa/relay/relay-chat.spec.ts L361-363: `filter({ has: page.getByText(...) })` -> `filter({ hasText: ... })`; STARTER_COUNT comment "~15" should be exact.

### P10.13 gate
All gate commands exit 0, but its AC "behave per the RP ACs" relies on P10.12's vacuous spec; fails until F1 is fixed and the gate re-run.

### F8 — P10.11 Gherkin drift. e2e/scenarios/relay/relay-chat.feature.md L112-118
REL-CTX-04 still says "Then three starters are shown and a "What Relay can see" link" and "clicking a suggestion sends it". The spec now asserts 15 capability starters, no see-what link, and clicks a target-free starter. check-ids only compares ids, so it misses this. Update the scenario text (this file is in P10.11 Files).

### Scope notes
- Out-of-Files edits by the builder: `src/lib/relay/slashTarget.ts` (exported `hasTargetKind`, used by useCapabilityStarter, P10.4) and `src/components/relay/RelayPickerRow.tsx` (setting-row ListChecksIcon branch, P10.8). Add each to the owning task's Files/Log or justify it there.
- The gate edited `e2e/qa/relay/relay-polish-shield.spec.ts` (SHIELD-08 selector narrowed for the new Settings row). That's legitimate fix-forward, but it's outside P10 Files, so record it in the P10.13 Log.
- Phase 9 code is still uncommitted/untracked (HEAD 081d483 holds only 11 files): PermissionShield.tsx, permission.ts, useRelayPermissionStore.ts, the composer skip notice, the launcher permissionRow, etc. The quality findings here cover only Phase 10 hunks; do not "fix" P9 code under this phase. The orchestrator should know this phase's commit will also sweep up P9 files.
- Unit reports: P10.10 justifies RelayHeader.tsx:78 (the `cancelled` guard in the getThread race), which is acceptable at 94.73% branches. P10.9 reports no source bugs.
