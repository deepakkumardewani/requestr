# Implementation Plan: relay-conversation-polish

Source: `agent_docs/relay-conversation-polish/SPEC.md` (reviewed). Planning only; no feature code. Package manager is bun. Run targeted specs only, never the full e2e suite. One `bun run tsc --noEmit` and `bun run lint` at the very end (phase 6 gate), not per phase. The dev server is always running. Do not commit unless told.

## Overview

Seven rough edges in Relay are fixed in five vertical phases plus a final gate. Each phase leaves the app working and ships its own unit, component and targeted e2e checks. The phases are ordered by dependency: tool and prompt text first, then the Open model (which grouping reuses), then card density and grouping, then the ask card, and last the dictation rework, which is independent and touches the most files (locales, store, a tool schema).

## Verified file map (checked against the repo)

Corrections found against the repo (now folded back into SPEC.md):
- `useOpenTarget` is **not** a hook file. It is exported from `src/components/relay/ChangeCard.tsx:108` and consumed by `ToolRow.tsx:110`, `ChangeCard.tsx:135` and `TurnChangeBar.tsx:37`. There is no `src/hooks/useOpenTarget.ts`.
- `askUserState.ts` and its spec live in `src/lib/relay/` (not `src/components/relay/`).
- There is no `src/components/sidebar/` directory. The sidebar is `src/components/layout/SidebarMainTab.tsx` (plus `SidebarSearch.tsx`). Expansion state is `src/stores/useFolderExpandStore.ts`. No reveal/scroll mechanism was found (confirms Q1).
- `OpenState`/`OpenDisabledReason`/`resolveOpen` are in `src/lib/relay/changesSummary.ts` (lines 15-20, 135). Consumers: `ChangeCard.tsx`, `TurnChangeBar.tsx`, `ToolRow.tsx`.
- Extra consumers the spec did not list: `src/components/relay/SpeechPrivacyNote.tsx` (+ spec) and `LevelMeter.tsx`, `MicButton.grok.spec.tsx` reference Grok text or the engine and must be checked in phase 5.
- Locale parity tests exist: `src/i18n/messages.parity.spec.ts` and `src/i18n/relayMessages.parity.spec.ts`. Brand guard: `src/lib/relay/brandGuard.spec.ts` (a good home for the AC7.3 locale scan, or a sibling spec).
- Existing specs to update: `src/lib/relay/tools/{schemas,chainWrite,settingsWrite,registryGuarantees}.spec.ts`, `src/lib/relay/{changeLog,changeLog.zustand,askUserState,speechEngine}.spec.ts`, `src/lib/relay/server/systemPrompt.spec.ts`, `src/stores/useRelayStore.spec.ts`, `src/components/relay/{ChangeCard,ChangesSummary,TurnChangeBar,AskUserCard,MicButton,MicButton.grok,SpeechPrivacyNote}.spec.tsx`, `src/components/settings/RelaySection.spec.tsx`, `src/hooks/{useGrokDictation,useSpeechDictation}.spec.ts`, `src/lib/relay/stt/audioCapture.spec.ts`.
- E2E specs exist under `e2e/qa/relay/`: `relay-v2-{tools-entities,tools-nav,chain-live,changes,stt}`, `relay-improvements-{voice,a11y-mic,a11y-axe}`, `relay-a11y`, `relay-confirm`. New specs: one per area, `relay-conversation-polish-{chain,open,cards,ask,voice}.spec.ts`, written by each phase's E2E task, plus the combined walkthrough `relay-conversation-polish.spec.ts` in phase 6 (many `relay-polish-*.spec.ts` exist; these names do not collide). Helpers: `e2e/fixtures/{relayV2Helpers,relayE2eHelpers,relayRoutes,speechStub}.ts`.

## Architecture decisions

- Standalone-only `create_chain` (D1); collection chains stay (D2). Keep `ensureCollectionChain` and the `/chain/[collectionId]` route.
- Grouping is a pure view-model in `changesSummary.ts` (D3). No change-log mutation. A group carries its member changeIds.
- `OpenState = { target } | null` (drops the disabled branch). Phase 2 lands this before grouping, so grouping builds on the final shape.
- Reveal helper: extract and export `expandFolderPath` from `openEntity.ts`. Selection plus scroll via a minimal transient `useSidebarRevealStore` (Q1 default), after one wider search of `SidebarMainTab.tsx` and relay pill code for an existing selection mechanism.
- Dictation engine is derived (`resolveDictationEngine`), never chosen (D4). `speechEngine` removed from store, tool and change log (D5). Stale localStorage key deleted once (D6).
- Shared `createAnalyserFromStream` helper used by `audioCapture.ts` and the new `useMicLevel`.

## Dependency graph

```
P1 (create_chain, open_item text, SCOPE_RULES)      independent roots
P2 (OpenState, reveal helper, sidebar reveal)  ---> P3 (grouping, compact cards, summary gate)
P4 (ask card)                                       independent
P5 (dictation)                                      independent (touches schemas.ts, so after P1 to avoid merge churn)
P1..P5 ---> P6 (combined walkthrough spec, screenshots, typecheck, lint, manual live-model checks)
```

Task granularity: TASKS.md is the executable breakdown and follows `~/.claude/docs/task-conventions.md`. It splits some plan tasks further (at most 5 files each) and, per phase, adds dedicated `Unit:` and `E2E:` tasks written by independent test authors. Implementation tasks only keep existing specs green; new coverage named in the Verification lines below is authored in those test tasks.

P1, P4 and P5 have no data dependency on each other; the order below is to keep `schemas.ts` edits sequential. P3 depends on P2.

---

## Phase 1: Chain tool, open_item text and scope prompt (R1, R2, R6)

### Task 1.1: Standalone-only `create_chain`
**Description:** Change the schema to `{ name }`, make `createChain` always standalone with a generated id, and drop the collection and "already has a chain" branches.
**Acceptance criteria:**
- [ ] `create_chain {name:"X"}` makes one chain, generated id, scope `standalone`, zero new collections (AC1.1).
- [ ] `create_chain {name, collectionId}` fails schema validation (AC1.2).
- [ ] Description mentions standalone and `add_chain_node`, never collections (AC1.3).
- [ ] Existing collection chains: read, `add_chain_node`, open, undo still work; `useChainStore.spec.ts` unchanged and green (AC1.4).
**Verification:** `bun run vitest run src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/registryGuarantees.spec.ts src/stores/useChainStore.spec.ts`
**Dependencies:** None
**Files:** `src/lib/relay/tools/schemas.ts` (~445), `src/lib/relay/tools/chainWrite.ts` (~511), `src/lib/relay/tools/chainWrite.spec.ts`, `src/lib/relay/tools/schemas.spec.ts`
**Scope:** Small. Check `registryGuarantees.spec.ts` and any other caller of `create_chain` with `collectionId` (grep before editing; fix fixtures/e2e that pass it).

### Task 1.2: `open_item` description names every kind
**Description:** Build the description from `OPEN_ITEM_KINDS` so it lists request, chain, environment, collection, folder.
**Acceptance criteria:**
- [ ] Description contains all five kinds (AC2.1) and is derived from or checked against `OPEN_ITEM_KINDS` (AC2.2).
**Verification:** `bun run vitest run src/lib/relay/tools/schemas.spec.ts`
**Dependencies:** None (same file as 1.1, do after it)
**Files:** `src/lib/relay/tools/schemas.ts` (~639), `src/lib/relay/tools/schemas.spec.ts`
**Scope:** XS

### Task 1.3: Standalone-chain rule and `SCOPE_RULES` in the system prompt
**Description:** Add the rule "Chains are standalone; never create a collection just to hold a chain." and a `SCOPE_RULES` block next to `CAPABILITIES`, included in the assembled array. (Removing engine mentions from tool text is deferred to P5.)
**Acceptance criteria:**
- [ ] Built prompt contains the scope block with the in-scope list and the decline behaviour, and the chain rule (AC6.1).
- [ ] Grep of `systemPrompt.ts` and `schemas.ts` finds no text steering chains into collections (AC1.3).
**Verification:** `bun run vitest run src/lib/relay/server/systemPrompt.spec.ts`; manual live-model checks AC1.6 and AC6.2 (not CI gates).
**Dependencies:** None
**Files:** `src/lib/relay/server/systemPrompt.ts`, `src/lib/relay/server/systemPrompt.spec.ts`
**Scope:** Small

### Task 1.4: Chain e2e (new spec plus existing chain specs)
**Description:** New `relay-conversation-polish-chain.spec.ts` covers the standalone chain flow and "create a chain and open it"; fix any existing e2e/fixtures that expected `create_chain` to create a collection or pass `collectionId`.
**Acceptance criteria:**
- [ ] Stub-scripted chain build leaves the collections list unchanged and the new chain has no `collectionId` (AC1.5).
- [ ] "create a chain and open it" ends at `/chain/<id>` (AC2.3).
- [ ] `relay-v2-chain-live` and `relay-v2-tools-entities` stay green.
**Verification:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-chain.spec.ts e2e/qa/relay/relay-v2-chain-live.spec.ts e2e/qa/relay/relay-v2-tools-entities.spec.ts --repeat-each=3`
**Dependencies:** 1.1
**Files:** those two specs, possibly `e2e/fixtures/relayV2Helpers.ts`
**Scope:** Small

### Checkpoint: Phase 1
- [ ] Listed vitest specs and the two e2e specs green
- [ ] Review with human before phase 2

---

## Phase 2: Open matrix and sidebar reveal (R3)

### Task 2.1: Drop the disabled `OpenState` and complete the matrix
**Description:** `OpenState = { target } | null`; `resolveOpen` returns `null` for deleted, undone, missing targets, navigation ("Opened X") and read-only steps; collection/folder created or updated yield a reveal target; chain created and chain node changes yield the `/chain/<id>` target. Remove `OpenDisabledReason` and the disabled-tooltip i18n keys (all three locales, `relayDock.json`).
**Acceptance criteria:**
- [ ] Each matrix row yields the stated `open` value; no `{enabled:false}` anywhere in the type (AC3.1).
- [ ] `ChangeCard`, `ChangesSummary`, `ToolRow` render no Open control for deleted/undone/tab rows (AC3.2).
**Verification:** `bun run vitest run src/lib/relay/changesSummary.spec.ts src/components/relay/ChangeCard.spec.tsx src/components/relay/ChangesSummary.spec.tsx src/components/relay/ToolRow.spec.tsx src/components/relay/TurnChangeBar.spec.tsx src/i18n/relayMessages.parity.spec.ts`
**Dependencies:** None
**Files:** `src/lib/relay/changesSummary.ts`, `src/components/relay/{ChangeCard,TurnChangeBar,ToolRow}.tsx`, `messages/{en,fr,ja}/relayDock.json`, the specs above
**Scope:** Medium (consider splitting locale cleanup as its own commit, same task)

### Task 2.2: Reveal helper and sidebar reveal store
**Description:** Export the folder-expansion helper from `openEntity.ts` (collection via `openCollection`; folder expands itself and every parent). First do one wider search for an existing selection/scroll mechanism in `SidebarMainTab.tsx`, relay pills and `useUIStore`; if none, add a transient `src/stores/useSidebarRevealStore.ts` that the tree row subscribes to (select + `scrollIntoView`). Wire `useOpenTarget` (in `ChangeCard.tsx`) for collection/folder targets: navigate to `WORKSPACE_HOME_ROUTE`, expand, select, scroll.
**Acceptance criteria:**
- [ ] Nested folder: all ancestors expanded and collection opened in `useFolderExpandStore` (AC3.3).
- [ ] The reveal works while already on `/app` (no navigation no-op bug).
**Verification:** `bun run vitest run src/lib/relay/openEntity.spec.ts` (create if absent) plus a new store spec; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-v2-tools-nav.spec.ts`
**Dependencies:** 2.1 (reveal targets)
**Files:** `src/lib/relay/openEntity.ts`, `src/stores/useSidebarRevealStore.ts` (new), `src/components/layout/SidebarMainTab.tsx` (and the tree-row component it renders), `src/components/relay/ChangeCard.tsx`
**Scope:** Medium. Confirm the tree row component path during the search; SidebarMainTab may delegate to a child.

### Task 2.3: E2E for reveal and deleted-row
**Description:** New `relay-conversation-polish-open.spec.ts`: folder in a collapsed nested collection is visible, selected and in viewport after Open (AC3.4); deleted collection row shows no Open (AC3.5). Update `relay-v2-tools-nav` / `relay-v2-changes` where they assert the old disabled Open.
**Verification:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-open.spec.ts e2e/qa/relay/relay-v2-tools-nav.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts --repeat-each=3`
**Dependencies:** 2.2
**Files:** those specs
**Scope:** Small

### Checkpoint: Phase 2
- [ ] Vitest + e2e above green (AC2.3 is already asserted in phase 1's chain spec)
- [ ] Review with human

---

## Phase 3: Compact cards, grouping, summary threshold (R4)

### Task 3.1: Grouping view-model
**Description:** Extend `changesSummary.ts` with a pure grouping step: consecutive same-turn changes to the same chain (`create_chain`, `rename_chain`, `add_chain_node`, `update_chain_node`, `connect_chain_nodes`, `delete_chain_node`) collapse into one group holding member changeIds, id order retained, label data (`created` vs `updated`, node count = distinct nodes present after the group's own adds/deletes). `delete_chain` never grouped; group of one is a plain card; chain deleted later in the turn means no Open. Shared by inline cards and summary rows.
**Acceptance criteria:**
- [ ] create_chain + 4 add_chain_node (+ connects) gives one group, count 4; a different chain or an intervening non-chain change breaks it (AC4.3).
- [ ] Edge cases from R4 each have a test.
**Verification:** `bun run vitest run src/lib/relay/changesSummary.spec.ts`
**Dependencies:** 2.1
**Files:** `src/lib/relay/changesSummary.ts`, `src/lib/relay/changesSummary.spec.ts`
**Scope:** Medium. If `changesSummary.ts` grows past ~300 lines, split grouping into `src/lib/relay/changeGroups.ts`.

### Task 3.2: Compact `ChangeCard`, icon buttons, grouped card, group Undo
**Description:** One row at `h-7`, no `my-1.5`, tool group gap `gap-1` (`MessageParts.tsx` ~272 and ~313). Undo and Open become icon-only `Button size="icon"` with `ComposerTip` and existing i18n labels as `aria-label`; keep `RELAY_COARSE_TOUCH_CLASS`. Grouped card label via new i18n key with ICU plural (`Built chain "X" · N nodes`, `Updated chain "X" · N changes`) in en/fr/ja. Group Undo calls undo for every member, newest first; partial block uses the existing partial-undo messaging (Q3 default); group Open goes to `/chain/<id>`.
**Acceptance criteria:**
- [ ] No `my-*`/`p-2` classes; height <= 32px (AC4.1).
- [ ] Undo/Open have an accessible name, no visible text, tooltip on hover/focus (AC4.2).
- [ ] Group Undo undoes all members, then shows undone state without Open (AC4.4).
**Verification:** `bun run vitest run src/components/relay/ChangeCard.spec.tsx src/components/relay/MessageParts.spec.tsx src/i18n/relayMessages.parity.spec.ts`; Agent Browser screenshot of compact and grouped card (repo-unique session, then close).
**Dependencies:** 3.1
**Files:** `src/components/relay/ChangeCard.tsx`, `src/components/relay/MessageParts.tsx`, `messages/{en,fr,ja}/relayDock.json`, `ChangeCard.spec.tsx`; may need a small `ChangeGroupCard` extracted if inline JSX exceeds ~20 lines
**Scope:** Medium

### Task 3.3: Summary threshold and grouped summary rows
**Description:** `TurnChangeBar`/`ChangesSummary` render only for 2+ distinct changes (after filtering navigation changes, counting group members as individual changes); rows use the same Open matrix and grouping.
**Acceptance criteria:**
- [ ] Nothing for 0 or 1 changes; "Undo all" bar for 2+; "chain + 4 nodes" shows one grouped row (AC4.5).
**Verification:** `bun run vitest run src/components/relay/TurnChangeBar.spec.tsx src/components/relay/ChangesSummary.spec.tsx`
**Dependencies:** 3.1, 3.2
**Files:** `src/components/relay/{TurnChangeBar,ChangesSummary,MessageParts}.tsx` (+ specs)
**Scope:** Small-Medium (MessageParts ~372)

### Task 3.4: Update changes e2e
**Description:** New `relay-conversation-polish-cards.spec.ts` asserts one grouped card for the sample chain flow (AC4.6), card height (AC4.1) and the summary threshold; adjust `relay-v2-changes`, `relay-confirm` for compact cards, icon buttons and the threshold.
**Verification:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-cards.spec.ts e2e/qa/relay/relay-v2-changes.spec.ts e2e/qa/relay/relay-confirm.spec.ts --repeat-each=3`
**Dependencies:** 3.2, 3.3
**Scope:** Small

### Checkpoint: Phase 3
- [ ] Specs green; screenshots reviewed; review with human

---

## Phase 4: Ask-user card (R5)

### Task 4.1: Simplify `askUserState`
**Description:** Remove the unused `selected` phase for options; keep `typed`, `sent`, `skipped`, `answeredViaComposer` and settled rendering.
**Acceptance criteria:**
- [ ] Reducer spec updated and green; double-click yields a single send (AC5.1 part).
**Verification:** `bun run vitest run src/lib/relay/askUserState.spec.ts`
**Dependencies:** None
**Files:** `src/lib/relay/askUserState.ts`, `src/lib/relay/askUserState.spec.ts`
**Scope:** Small

### Task 4.2: Vertical option rows, click-to-send, icon Send
**Description:** Options as `flex flex-col` full-width left-aligned buttons (`w-full justify-start hover:bg-accent`, long text wraps). Click calls `onChoose(option)` once. Send becomes an icon-only white paper-plane icon (`text-white` on primary), `aria-label` from the existing `send` string, disabled when blank; Enter submits with the `isComposing` guard.
**Acceptance criteria:**
- [ ] AC5.1 and AC5.3 pass in component tests.
- [ ] Options share left edge and width, tops strictly increasing; focus order options, input, Send (AC5.2, AC5.4).
**Verification:** `bun run vitest run src/components/relay/AskUserCard.spec.tsx`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-ask.spec.ts e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-confirm.spec.ts --repeat-each=3`; ask-card screenshot.
**Dependencies:** 4.1
**Files:** `src/components/relay/AskUserCard.tsx`, `AskUserCard.spec.tsx`, e2e specs asserting old "Send" text
**Scope:** Small-Medium

### Checkpoint: Phase 4
- [ ] Ask card behaves per AC5.x; review with human

---

## Phase 5: Dictation (R7)

### Task 5.1: Engine resolver and shared analyser helper
**Description:** Add `resolveDictationEngine({ sttConfigured, captureSupported, browserSupported }) -> "ai" | "browser" | null` in `speechEngine.ts`. Extract `createAnalyserFromStream` into `src/lib/relay/stt/createAnalyserFromStream.ts` (used by `audioCapture.ts`). Do NOT delete `SPEECH_ENGINE_OPTIONS`, `isSpeechEngine`, `getEffectiveSpeechEngine` yet: their consumers (`MicButton`, `RelaySection`) still use them, so the deletion happens in Task 5.3 after they migrate.
**Acceptance criteria:**
- [ ] All five resolver cases in AC7.1 pass; `audioCapture.spec.ts` still green using the shared helper; old helpers still exported.
**Verification:** `bun run vitest run src/lib/relay/speechEngine.spec.ts src/lib/relay/stt/audioCapture.spec.ts`
**Dependencies:** None
**Files:** `src/lib/relay/speechEngine.ts`, `src/lib/relay/stt/audioCapture.ts`, new helper file under `src/lib/relay/stt/`, specs
**Scope:** Small-Medium

### Task 5.2: Remove `speechEngine` from store, tool and change log, plus migration
**Description:** Remove it from `useRelayStore.ts` (state, `setSpeechEngine`, `SPEECH_ENGINE_KEY` read/write), `set_relay_preferences` schema, `settingsWrite.ts` (`GROK_NOT_CONFIGURED` branch ~180), `appSettings.ts` (~41), `changeLog.ts` (~428-434 snapshot/undo), and any engine mention in the tool description. On store init, remove `rq_relay_speech_engine` once via `removePreference` in try/catch with contextual logging; never re-write it.
**Acceptance criteria:**
- [ ] `set_relay_preferences` rejects `speechEngine` (AC7.8); settingsWrite, registryGuarantees and changeLog specs updated and green.
- [ ] Seeded `"grok"` key: store loads, key gone afterwards (AC7.5).
**Verification:** `bun run vitest run src/stores/useRelayStore.spec.ts src/lib/relay/tools/settingsWrite.spec.ts src/lib/relay/tools/registryGuarantees.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/changeLog.spec.ts src/lib/relay/changeLog.zustand.spec.ts`
**Dependencies:** 5.1, P1 (schemas.ts edits sequenced)
**Files:** `src/stores/useRelayStore.ts`, `src/lib/relay/tools/{schemas,settingsWrite,appSettings}.ts`, `src/lib/relay/changeLog.ts`, plus specs
**Scope:** Large (8+ files); implement in two sub-steps (store + migration, then tool/change-log) within one session, running the specs between.

### Task 5.3: `MicButton` auto engine, `useMicLevel` waveform, picker removal
**Description:** `MicButton` always calls `useSttConfigured(true)`, resolves the engine with the resolver (browser while status loading; switch only when not listening), hides the mic when null, shows generic AI error text without a vendor name. New `src/hooks/useMicLevel.ts` opens `getUserMedia` + analyser while listening in browser mode only, releases on stop/unmount/error/denial, and degrades silently on denial. `LevelMeter` renders in both modes. Remove the engine `Select` from `RelaySection.tsx`. Once both consumers are migrated, delete `SPEECH_ENGINE_OPTIONS`, `isSpeechEngine`, `getEffectiveSpeechEngine` from `speechEngine.ts` and their spec cases.
**Acceptance criteria:**
- [ ] Browser mode shows `relay-mic-meter` while listening; second `getUserMedia` made; tracks stopped and context closed on stop, unmount and rejection; AI mode uses one stream (AC7.6).
- [ ] No `relay-mic` when neither engine is available (AC7.7); no engine combobox in settings (AC7.2).
- [ ] Loading status uses browser, no mid-listen switch, generic AI error text (AC7.9).
- [ ] Old speech-engine helpers no longer exported and nothing imports them.
**Verification:** `bun run vitest run src/components/relay/MicButton.spec.tsx src/components/relay/MicButton.grok.spec.tsx src/components/settings/RelaySection.spec.tsx src/hooks/useGrokDictation.spec.ts src/hooks/useSpeechDictation.spec.ts` plus a new `useMicLevel.spec.ts`
**Dependencies:** 5.1, 5.2
**Files:** `src/components/relay/{MicButton,LevelMeter}.tsx`, `src/components/settings/RelaySection.tsx`, `src/lib/relay/speechEngine.ts`, `src/hooks/useMicLevel.ts` (new), `src/hooks/useSttConfigured.ts` (if signature changes), specs
**Scope:** Medium-Large

### Task 5.4: Locale rewrites and brand scan
**Description:** In en/fr/ja delete `settings.json` `speechEngine.*`; in `relayDock.json` `voice.engine.grok` -> `voice.engine.ai`, `grokPrivacyNote` -> `aiPrivacyNote`, `grokErrors` -> `aiErrors` (`upstreamAuth` text without Settings pointer). Update `t(...)` callers (`MicButton`, `SpeechPrivacyNote.tsx`, `RelaySection.tsx`). Add a unit test scanning `messages/**` for `grok|xai`.
**Acceptance criteria:**
- [ ] `grep -rniE "grok|xai" messages/` empty; scan test green (AC7.3); parity specs green (AC7.4).
**Verification:** `bun run vitest run src/i18n src/lib/relay/brandGuard.spec.ts src/components/relay/SpeechPrivacyNote.spec.tsx`
**Dependencies:** 5.3
**Files:** `messages/{en,fr,ja}/{settings,relayDock}.json`, `src/components/relay/SpeechPrivacyNote.tsx`, a new/extended spec
**Scope:** Medium

### Task 5.5: Update voice e2e
**Description:** New `relay-conversation-polish-voice.spec.ts` (browser-mode waveform, no picker, no vendor text, mic hidden, stale key cleared); adjust `relay-v2-stt`, `relay-improvements-voice`, `relay-improvements-a11y-mic` and `e2e/fixtures/speechStub.ts` for no picker, no vendor strings and the browser-mode waveform. Screenshot the waveform.
**Verification:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish-voice.spec.ts e2e/qa/relay/relay-v2-stt.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts --repeat-each=3`
**Dependencies:** 5.3, 5.4
**Scope:** Small-Medium

### Checkpoint: Phase 5
- [ ] All dictation specs green; grep shows no user-visible Grok/xAI; review with human

---

## Phase 6: Flow spec and final gate

Order in TASKS.md: gate (typecheck, lint, suites), then the walkthrough, then the DoD (manual live-model checks and summary).

### Task 6.1: Combined walkthrough `relay-conversation-polish.spec.ts`
**Description:** One `test()` per automatable Objective flow: sample chain makes no collection and one grouped card (AC1.5, AC4.6); "create a chain and open it" ends at `/chain/<id>` (AC2.3); no dead Open; ask card stacked (AC5.2); no Grok/xAI text; browser-mode waveform. The off-topic decline is the manual AC6.2 check, not part of this spec.
**Verification:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/relay-conversation-polish.spec.ts --repeat-each=2`
**Dependencies:** Phases 1-5
**Files:** `e2e/qa/relay/relay-conversation-polish.spec.ts` (new), helpers in `e2e/fixtures/relayV2Helpers.ts`
**Scope:** Medium

### Task 6.2: Final gate
- [ ] One `bun run tsc --noEmit` clean
- [ ] `bun run lint` clean
- [ ] Targeted vitest run over every touched spec green
- [ ] Targeted e2e list from the spec green (no full suite)
- [ ] Manual live-model checks AC1.6 and AC6.2 noted (not CI gates)
- [ ] Screenshots captured: compact card, grouped card, ask card, browser-mode waveform (Agent Browser, repo-unique session, closed after)
- [ ] Verification summary produced in the format required by CLAUDE.md

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No sidebar reveal mechanism exists (tree row component not located) | High | Task 2.2 starts with a wider search; fall back to the transient store; keep it minimal |
| Removing `speechEngine` ripples through change-log undo and persisted history | Med | Task 5.2 runs the changeLog specs between sub-steps; old change-log entries with `speechEngine` should be ignored, not crash (verify) |
| Grouping and partial undo semantics | Med | Pure view-model plus existing undo path; Q3 default documented; cover blocked-member test |
| `useSttConfigured(true)` fires a request per mic mount | Low | Accepted (Q2); confirm it is cached per session |
| Prompt behaviour (AC1.6, AC6.2) is non-deterministic | Med | Treated as manual checks, not gates |
| `create_chain` callers or fixtures still pass `collectionId` | Med | Grep in Task 1.1 before editing; fix e2e in 1.4 |
| Many e2e specs assert old text (Send, Grok, disabled Open) | Med | Each phase updates its own specs, not deferred to the end |

## Open questions (defaults from the spec stand)
- Q1: reveal store vs existing mechanism, decided in Task 2.2 after one search.
- Q2: accept one cached STT status request per session.
- Q3: group Undo undoes unblocked members and shows the existing "N could not be undone" notice.
