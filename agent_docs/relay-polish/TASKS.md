# Tasks: Relay Polish (Explicit Context, Permissions and a Finished Feel)

Inputs: `SPEC.md` (Draft v1, all section 12 questions RESOLVED) and `PLAN.md` (this folder), extending `agent_docs/relay-agent/*` and `agent_docs/relay-improvements/*`. Planning artifact only; no feature code is written by this document. Commands: `bun`/`bunx` only, never `npm`. Never start the dev server (running on :3000). Commits: only the `/build-phases` orchestrator, after verifier PASS, one commit per phase. Task-authoring rules come from `~/.claude/agents/planner.md` section 4 and override the generic skill where they differ.

## Conventions

- **Kinds.** `implementation` (feature code; updates the existing unit specs of the files it touches so they stay green, writes no new specs), `unit` (unit-test-engineer, new coverage), `e2e` (e2e-engineer, new or migrated Playwright specs), `gate` (checkpoint or sign-off), `walkthrough`, `dod`. The bundle-measurement task (P11.3) is a `gate` evidenced by an anchored `verdict: PASS` line in `BUNDLE.md` plus a targeted QA spec run; a FAIL stops the phase. Order inside a phase is implementation, then `Unit:`, then `E2E:`, then the checkpoint gate. Test authors are never the feature authors.
- **Files rule.** At most 5 real files per task. A `.feature.md` counts as a file whenever a task edits it; migrate tasks are therefore split to stay at or under 5. `(new)` marks a file the task creates; `(delete)` marks a file it removes. Every other cited path was checked with `ls`/`grep` when this file was written or is created by an earlier task.
- **Design process (UI tasks).** Every task that creates or changes UI carries a **Design** field with the exact sentence "Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills." Then implement with shadcn primitives and design tokens only (no hard-coded colors; named constants for sizes, timings, percents), record one line in the task Log naming what each skill changed, and save agent-browser screenshots (start with `--init-script e2e/fixtures/qa-seed.init.js`) at 1440px and at the 320px panel width, light and dark, to `agent_docs/qa/relay-polish/p<phase>-<name>-<width>-<theme>.png`. Screenshots are visual evidence only; behavioural proof always comes from the seeded Playwright specs. Logic-only tasks state "Design: n/a, logic only" and name the task that carries the gate. The verifier rejects a UI task without the Log line.
- **Browser proof.** Implementation tasks claim only what their own Verify proves (biome, targeted vitest, existing specs). Behaviour that needs a browser is cross-referenced to the exact scenario that proves it, for example "proven by E2E P4.8 `[REL-POL-THREADS-02]`". Spec files live in `e2e/qa/relay/relay-polish-<area>.spec.ts` with Gherkin in `e2e/scenarios/relay/relay-polish-<area>.feature.md`, ids `REL-POL-<AREA>-nn`, `@qa`, `seededPage`, hermetic `e2e/fixtures/relayRoutes.ts` mocks (scripted text/tool/text streams), `getByTestId` first, web-first assertions, no `waitForTimeout`.
- **E2E run command.** Always the already-running server, never the full suite: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test <specs>`. `E2E:` tasks verify with `--repeat-each=3`; gates and the walkthrough use `--repeat-each=2`.
- **Typecheck.** `bun run typecheck` runs once per phase, in the phase checkpoint, never per edit. Lint: `bunx biome check <files>`; checkpoints run `bun run lint:check`.
- **Unit task acceptance (applies to every `Unit:` task).** Every listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%); component and hook specs start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail` (real source bugs are reported, not hidden).
- **Scenario coverage rule.** Each `E2E:` task covers the happy path plus the empty, error, persistence and deep-link cases that apply to its area; where one does not apply the task says why.
- **i18n.** Locales are `en`, `fr`, `ja`. Two namespaces: `messages/*/relay.json` (shell, registered eagerly, also read by Settings > Relay) and `messages/*/relayDock.json` (lazy dock chunk). Copy shared with Settings (approval mode) lives in `relay.json`. Parity gate: `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`. Vendor/model names never appear in UI strings: `bunx vitest run src/lib/relay/brandGuard.spec.ts`.
- **Project rules.** No tests under `src/components/reactbits/`. Stores are `src/stores/use<Name>Store.ts`. Functions under ~30 lines, named constants, no commented-out code, no silent catches.
- **Bundle checks** never run `bun run build` in the repo (it clobbers the dev server's `.next`); they run in a scratch copy as in `agent_docs/relay-improvements/BUNDLE.md`.

**Decisions and SPEC/PLAN gaps found while authoring (all resolved here)**
- `e2e/scenarios/relay/check-ids.sh` uses `id_re='REL-[A-Z][A-Z0-9]*-[0-9]+[a-z]?'`, which cannot match `REL-POL-MSG-01`. P1.1 widens it before any polish scenario exists.
- `OpenInRelayButton.tsx` (under `src/components/relay/`) also imports `Sparkles`; RP-101 and the "no Sparkles under relay" AC require it to change (P2.4). PLAN did not list it.
- `e2e/qa/relay/relay-a11y.spec.ts` and `e2e/fixtures/relayE2eHelpers.ts` (dock width helper, `relay-toggle`/`relay-dock` ids) are affected by P2 and were missing from PLAN section 6; `relay-chat.spec.ts` also asserts `relay-see-what`, so it migrates again in P10.
- `src/app/globals.css` has no warning token (`--warning`); P9 adds one for the Skip shield.
- The settings shortcut list is `src/components/settings/ShortcutsSection.tsx` (+ `src/app/settings/constants.ts`).
- `BUNDLE.md` latest `/app` first-load is 754.4 kB while SPEC budgets against 757.2 kB: the +5 kB budget is measured against 757.2 kB (the larger), i.e. a ceiling of 762.2 kB, checked once in P11.3.
- Phase 3 is deliberately small (user decision: no `ResizablePanel` migration). `data-testid="relay-dock"` and `relay-resize-handle` are unchanged, so the 12 e2e specs that only use them as selectors keep working; only specs that assert the old `400px` default or the `320px` drag-to-minimum on a wide viewport migrate. At the new limits a viewport of 1024px or less is needed to reach a 320px dock (`30vw` is below the floor there).
- Thread titles already join text parts with a space (`threadDb.ts deriveThreadTitle`); only `RelayConversation.tsx messageText` and `RelayDock.tsx lastUserMessageText` use `""` and need the shared helper.
- Extra e2e area `SHIELD` (`relay-polish-shield`) is added next to `PERM` so the approval matrix and the shield/Settings UI have separate spec authors.

---

## Phase 1: Rendering bug fixes and feedback removal

**Adds:** Replies no longer glue sentences together ("...looking at.Here's...") and each tool card or question card now appears in order, after the text that introduces it. The thumbs-up and thumbs-down buttons are gone; only Copy and Regenerate remain on replies.

**Try in UI:** Send a prompt that makes Relay read the last response and check the intro sentence and the result are separate paragraphs with the tool row between ; Ask something that triggers a question card and confirm the question text sits above the card ; Hover an assistant reply and see only Copy and Regenerate ; Reload an old thread and confirm it still renders in order

Smallest independent slice: parts rendered in stream order, join helper, thumbs removal.

### ✅ P1.1 check-ids accepts REL-POL-<AREA>-nn
- **Kind**: implementation
- **Traces**: SPEC section 8 (supporting; unblocks every polish scenario id)
- **Files** (1): `e2e/scenarios/relay/check-ids.sh`
- **Depends on**: none
- **Do**: Before editing, record `bash e2e/scenarios/relay/check-ids.sh | grep "feature ids" | shasum` in the task Log. Widen `id_re` to `REL-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?` so multi-segment ids (`REL-POL-MSG-01`) and every existing id (`REL-SHELL-02`, `REL-IA11Y-05`) match. Nothing else in the script changes.
- **Design**: n/a, tooling only.
- **Acceptance**:
  - The widened pattern matches `REL-POL-MSG-01`, `REL-SHELL-02` and `REL-IA11Y-05`.
  - The per-feature id counts of all existing feature files are unchanged (hash equals the Log value).
- **Verify**:
  - `bash -c 'source <(grep "^id_re=" e2e/scenarios/relay/check-ids.sh); printf "[REL-POL-MSG-01]\n[REL-SHELL-02]\n[REL-IA11Y-05]\n" | grep -oE "$id_re" | wc -l'`  (expect 3)
  - `bash e2e/scenarios/relay/check-ids.sh | grep "feature ids" | shasum`  (expect equal to the Log hash)
  - `bash e2e/scenarios/relay/check-ids.sh`  (exit 0)

### ✅ P1.2 Message text join helper
- **Kind**: implementation
- **Traces**: RP-108
- **Files** (4): `src/lib/relay/messageText.ts` (new); `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayDock.tsx`; `src/components/relay/RelayConversation.spec.tsx`
- **Depends on**: P1.1
- **Do**: Add a pure `joinTextParts(parts)` that keeps only `text` parts and joins them with a named `TEXT_PART_SEPARATOR = "\n\n"`; export `messageText(message)` on top of it. Replace the `""` joins in `RelayConversation.tsx` (`messageText`, ~line 89) and `RelayDock.tsx` (`lastUserMessageText`, ~line 43) so Copy, Regenerate prompt and the edit/regenerate text use it. Update the existing `RelayConversation.spec.tsx` cases that assumed `""`.
- **Design**: n/a, logic only; the design gate for rendering is carried by P1.3.
- **Acceptance**:
  - Text from separate steps is never concatenated without a blank line: `joinTextParts` of ["a.", "b"] is "a.\n\nb" (RP-108).
  - `RelayConversation.tsx` and `RelayDock.tsx` contain no `.join("")` over text parts.
  - Copy, Regenerate prompt and `lastUserMessageText` use the helper; the new helper's own coverage is written by Unit P1.7.
- **Verify**:
  - `bunx biome check src/lib/relay/messageText.ts src/components/relay/RelayConversation.tsx src/components/relay/RelayDock.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayDock.spec.tsx`
  - `test -z "$(grep -n 'join("")' src/components/relay/RelayConversation.tsx src/components/relay/RelayDock.tsx)"`  (expect exit 0)

### ✅ P1.3 Render message parts in stream order
- **Kind**: implementation
- **Traces**: RP-109
- **Files** (4): `src/components/relay/MessageParts.tsx` (new); `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayConversation.spec.tsx`; `src/components/relay/RelayMarkdown.tsx`
- **Depends on**: P1.2
- **Do**: Extract the `MessageItem` body (`RelayConversation.tsx` ~lines 249-267) into `MessageParts`, which iterates `message.parts` in order: each `text` part renders its own memoized `RelayMarkdown` (key = part index), each run of consecutive tool parts renders as one grouped block (`AskUserCard`, `ConfirmCard`, `CloseTabsConfirmCard`, `ChangeCard`, `ToolRow` render exactly where their part sits), `step-start` renders nothing, and `TurnChangeBar` renders once after the last part. Keep the virtualization (`RELAY_VIRTUALIZE_THRESHOLD`) and estimated-height logic working. Make `RelayMarkdown` cheap to re-render per part (`memo`).
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (vertical rhythm between text blocks, tool rows and prompt cards; streaming state; light + dark; 320/400/480px). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p1-msg-parts-*.png`.
- **Acceptance**:
  - A text -> tool -> text message renders two separate paragraphs with the tool row between them and the DOM text never contains the glued form (RP-108, RP-109); proven in the browser by E2E P1.8 `[REL-POL-MSG-01]`.
  - Text -> `ask_user` renders the question above the card, tool -> text renders the tool row above the text (RP-109); proven by `[REL-POL-MSG-02]` and `[REL-POL-MSG-03]`, and by the ordering cases in `RelayConversation.spec.tsx` using `compareDocumentPosition`.
  - Streaming a long reply does not re-mount earlier blocks (stable keys, memoized markdown); existing virtualization specs still pass.
- **Verify**:
  - `bunx biome check src/components/relay/MessageParts.tsx src/components/relay/RelayConversation.tsx src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayMarkdown.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayMarkdown.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p1-msg-parts-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max chose a flex-col gap-2 rhythm so text blocks, tool groups and prompt cards sit evenly in stream order; impeccable made consecutive tool parts one grouped block and kept streaming text blocks visually stable (no re-mount shift); layout checked the stacking at 320/400/480px in light and dark.

### ✅ P1.4 Remove thumbs from message actions and telemetry
- **Kind**: implementation
- **Traces**: RP-226
- **Files** (4): `src/components/relay/MessageActions.tsx`; `src/components/relay/MessageActions.spec.tsx`; `src/lib/relay/telemetry.ts`; `src/lib/relay/telemetry.spec.ts`
- **Depends on**: P1.1
- **Do**: Delete the thumbs-up/thumbs-down buttons, the `rating` state and `handleRate`, the `relay_feedback` event and `RelayFeedbackRating` type, and their spec cases. Keep Copy and Regenerate and their order.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (the action row now has two buttons: spacing, hover reveal, focus order, 320px). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p1-actions-*.png`.
- **Acceptance**:
  - Assistant messages expose only Copy and Regenerate (RP-226); proven in the browser by E2E P1.8 `[REL-POL-MSG-05]`.
  - `relay_feedback`, `RelayFeedbackRating`, `handleRate`, `relay-thumbs` no longer appear under `src` (i18n keys are removed by P1.5).
- **Verify**:
  - `bunx biome check src/components/relay/MessageActions.tsx src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.ts src/lib/relay/telemetry.spec.ts`
  - `bunx vitest run src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.spec.ts`
  - `test -z "$(grep -rnE 'relay_feedback|RelayFeedbackRating|relay-thumbs|handleRate' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p1-actions-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max set the two-button action row (Copy, Regenerate) with the existing icon-button size and hover reveal; impeccable found no leftover gap, divider or className in MessageActions.tsx (it never had one; the diff only removes the thumbs buttons, rating state and telemetry), so no further change was needed; layout kept focus order Copy -> Regenerate and verified the row at 320px without wrapping.

### ✅ P1.5 Remove thumbs i18n keys
- **Kind**: implementation
- **Traces**: RP-226, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P1.4
- **Do**: Remove `actions.thumbsUp` and `actions.thumbsDown` from all three locales.
- **Design**: n/a, strings only.
- **Acceptance**:
  - Keys are gone from en, fr and ja with identical key sets (RP-226, i18n NFR).
  - `rg "thumbsUp|thumbsDown"` over `src`, `e2e` (outside the files migrated in P1.9) and `messages` has no hits in `src` or `messages`.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rnE 'thumbsUp|thumbsDown' src messages)"`  (expect exit 0)

### ✅ P1.6 Annotate relay-improvements docs as superseded
- **Kind**: implementation
- **Traces**: RP-226
- **Files** (3): `agent_docs/relay-improvements/SPEC.md`; `agent_docs/relay-improvements/PLAN.md`; `agent_docs/relay-improvements/TASKS.md`
- **Depends on**: P1.4
- **Do**: Where these documents mention the thumbs/feedback buttons or `relay_feedback`, append an inline note "Superseded by relay-polish RP-226 (removed)". Do not rewrite history or change other text.
- **Design**: n/a, docs only.
- **Acceptance**:
  - Every thumbs/`relay_feedback` mention in the three documents carries the superseded note (RP-226).
  - No other text in those documents changes.
- **Verify**:
  - `grep -c "Superseded by relay-polish RP-226" agent_docs/relay-improvements/SPEC.md agent_docs/relay-improvements/PLAN.md agent_docs/relay-improvements/TASKS.md`  (expect each >= 1 where the file mentions thumbs)
  - `git diff --stat -- src messages e2e`  (expect no new changes from this task)

### ✅ P1.7 Unit: message text and parts
- **Kind**: unit
- **Traces**: RP-108, RP-109, RP-226
- **Files** (5): `src/lib/relay/messageText.ts`; `src/components/relay/MessageParts.tsx`; `src/components/relay/MessageActions.tsx`; `src/lib/relay/telemetry.ts`; `src/components/relay/RelayMarkdown.tsx`
- **Depends on**: P1.3, P1.4
- **Do**: unit-test-engineer writes `messageText.spec.ts` (new) and extends `MessageParts.spec.tsx` (new), `MessageActions.spec.tsx`, `telemetry.spec.ts`, `RelayMarkdown.spec.tsx`. Cases: `joinTextParts` with 0, 1, many text parts and non-text parts; separator exactly a blank line; part ordering (text -> ask_user, tool -> text, text -> tool -> text, `step-start` renders nothing, aggregate bar once); stable keys across a streaming update; telemetry event map has no feedback event; MessageActions renders only Copy and Regenerate. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-108 (helper), RP-109 (ordering, keys), RP-226 (actions, telemetry).
  - Unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/lib/relay/messageText.spec.ts src/components/relay/MessageParts.spec.tsx src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.spec.ts src/components/relay/RelayMarkdown.spec.tsx --coverage --coverage.include=src/lib/relay/messageText.ts --coverage.include=src/components/relay/MessageParts.tsx --coverage.include=src/components/relay/MessageActions.tsx --coverage.include=src/lib/relay/telemetry.ts --coverage.include=src/components/relay/RelayMarkdown.tsx --coverage.reporter=text`

### ✅ P1.8 E2E: message order, Copy and actions
- **Kind**: e2e
- **Traces**: RP-108, RP-109, RP-226
- **Files** (1): `e2e/fixtures/relayRoutes.ts` (only if `RelayScript` cannot yet express text -> tool -> text and text -> `ask_user`; otherwise none)
- **Depends on**: P1.7
- **Gherkin**: `e2e/scenarios/relay/relay-polish-msg.feature.md`: REL-POL-MSG-01..07
- **Spec**: `e2e/qa/relay/relay-polish-msg.spec.ts`
- **Scenarios**:
  - `[REL-POL-MSG-01] text, tool, text renders two paragraphs with the tool row between and never glues "at.Here's"` @critical
  - `[REL-POL-MSG-02] text then ask_user shows the question above the AskUser card` @critical
  - `[REL-POL-MSG-03] tool then text shows the tool row above the text` @high
  - `[REL-POL-MSG-04] Copy returns the two texts separated by a blank line` @high
  - `[REL-POL-MSG-05] assistant message exposes only Copy and Regenerate (no thumbs)` @high
  - `[REL-POL-MSG-06] an old persisted thread (text, tool, text with step-start parts) renders in order after reload` @high (persistence, deep-link to the thread)
  - `[REL-POL-MSG-07] a long streamed reply keeps earlier blocks mounted` @medium
- **Do**: Scripted streams via `relayRoutes.ts`; 01-03 assert order with `compareDocumentPosition` and text content; 04 reads the clipboard through the page; 06 seeds a stored thread (via the existing thread seeding helper) then reloads; 07 tags an earlier block node and checks it is the same node after more chunks. Error case: a stream that errors after the first text keeps the earlier text and shows the error bubble below it (add as part of 01 or its own assertion). Empty case: a thread with no messages shows no actions.
- **Acceptance**:
  - Covers RP-108, RP-109, RP-226 browser behaviour from the SPEC ACs.
  - One `test()` per scenario id, `@qa` plus the priority tag, `seededPage`, no `waitForTimeout`; `check-ids.sh` parity green; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P1.9 E2E: migrate thumbs scenarios
- **Kind**: e2e
- **Traces**: RP-226, RP-108
- **Files** (4): `e2e/qa/relay/relay-improvements-qol-actions.spec.ts`; `e2e/scenarios/relay/relay-improvements-qol-actions.feature.md`; `e2e/scenarios/relay/relay-improvements-qol-rewrite.feature.md`; `e2e/qa/relay/relay-chat.spec.ts`
- **Depends on**: P1.7
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: `e2e/qa/relay/relay-improvements-qol-actions.spec.ts`, `e2e/qa/relay/relay-chat.spec.ts`
- **Scenarios**: existing ids stay; thumbs scenarios and the `relay-thumbs-up`/`relay-thumbs-down` steps are removed from `qol-actions`, the stale reference is removed from `qol-rewrite.feature.md`, and any `relay-chat` assertion that depended on text/tool order or joined text is updated to the new order.
- **Do**: Remove rather than rewrite deleted behaviour; keep every remaining scenario id unique and in parity with its spec.
- **Acceptance**:
  - No spec or feature file under `e2e` references `relay-thumbs`, `thumbsUp` or `relay_feedback`.
  - The remaining scenarios in the two migrated specs pass, flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3`
  - `test -z "$(grep -rnE 'relay-thumbs|thumbsUp|thumbsDown|relay_feedback' e2e)"`  (expect exit 0)
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P1.10 Checkpoint 1
- **Kind**: gate
- **Traces**: RP-108, RP-109, RP-226
- **Files** (0): none (verification only)
- **Depends on**: P1.1, P1.2, P1.3, P1.4, P1.5, P1.6, P1.7, P1.8, P1.9
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - The A7/A8 repros no longer reproduce; only Copy and Regenerate remain; an old persisted thread renders in order with no migration.
  - All commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rnE 'relay_feedback|thumbsUp|thumbsDown|relay-thumbs' src e2e messages)"`  (expect exit 0)

🔶 **Checkpoint 1**: reply text no longer concatenates across steps, cards render in stream order, thumbs are gone, targeted unit and e2e specs are green.

---

## Phase 2: Shell identity (logo, tab-bar toggle, tooltips, chords)

**Adds:** Relay shows the product logo instead of a sparkle, the Relay button moves to the right end of the tab bar (next to the open-tabs chevron), every header button has a tooltip with its keyboard shortcut, and Cmd/Ctrl+Shift+O starts a new chat.

**Try in UI:** Look at the far right of the tab bar for the Relay logo button (also with zero tabs) and confirm it is gone from the left sidebar ; Hover or Tab onto each Relay header button and read the tooltip with keycaps ; With the cursor in the Relay text box press Cmd+Shift+O (Ctrl+Shift+O on Windows) and see a fresh chat ; Open the keyboard shortcuts dialog and find "New Relay chat"

Shell identity: logo component, toggle relocation, header tooltips, new-chat chord.

### ✅ P2.1 Logo and tooltip strings
- **Kind**: implementation
- **Traces**: RP-101, RP-103, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: none
- **Do**: Add `logo.label` (accessible name when the logo is the only content of a control) and `header.newChatShortcut` (tooltip text prefix "New chat") in all three locales; existing header `aria-label` strings stay the tooltip text source.
- **Design**: n/a, strings only; design gate carried by P2.3 and P2.8.
- **Acceptance**:
  - New keys exist in en, fr, ja with identical key sets and no vendor/model name.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ✅ P2.2 New Relay chat shortcut strings
- **Kind**: implementation
- **Traces**: RP-106
- **Files** (3): `messages/en/shortcuts.json`; `messages/fr/shortcuts.json`; `messages/ja/shortcuts.json`
- **Depends on**: none
- **Do**: Add the "New Relay chat" label and a one-line note that Firefox may reserve Ctrl/Cmd+Shift+O for its Library window (the toolbar New chat button is the guaranteed path), in all three locales.
- **Design**: n/a, strings only.
- **Acceptance**:
  - Label and Firefox note exist in en, fr, ja with identical key sets.
- **Verify**:
  - `bunx biome check messages/en/shortcuts.json messages/fr/shortcuts.json messages/ja/shortcuts.json`
  - `bunx vitest run src/i18n/messages.parity.spec.ts`

### ✅ P2.3 RelayLogo and toggle button
- **Kind**: implementation
- **Traces**: RP-101
- **Files** (3): `src/components/relay/RelayLogo.tsx` (new); `src/components/relay/RelayToggleButton.tsx`; `src/components/relay/RelayToggleButton.spec.tsx`
- **Depends on**: P2.1
- **Do**: Recreate the purple neon paper plane from `public/logo.png` as an inline SVG component using `stroke="currentColor"` and `fill="none"`, `data-testid="relay-logo"`, a `className` size prop (default follows `icon-sm`), `aria-hidden` when next to text and `aria-label` from `logo.label` when it is the only content. Use it in `RelayToggleButton` in place of lucide `Sparkles`; keep `aria-expanded`, `data-testid="relay-toggle"` and the `isRelayEnabled()` gate. No raster image in the Relay bundle.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (glyph geometry at 16/20/48px, contrast >= 3:1 in light and dark, active/hover/focus states). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p2-logo-*.png`.
- **Acceptance**:
  - Toggle renders `[data-testid="relay-logo"]`; no `Sparkles` import in `RelayToggleButton.tsx` (RP-101); contrast and visual states proven by E2E P2.12 `[REL-POL-SHELL-09]`.
  - Logo has an accessible name only when it is the sole content of a control.
- **Verify**:
  - `bunx biome check src/components/relay/RelayLogo.tsx src/components/relay/RelayToggleButton.tsx src/components/relay/RelayToggleButton.spec.tsx`
  - `bunx vitest run src/components/relay/RelayToggleButton.spec.tsx`
  - `test -z "$(grep -n 'Sparkles' src/components/relay/RelayToggleButton.tsx)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p2-logo-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max picked a stroked paper-plane glyph on a 24px grid with round caps so it reads at 16/20/48px; impeccable tied the stroke to currentColor so contrast follows the theme (>= 3:1 light and dark) and the toggle's hover/active/focus states; layout kept the size as a className prop (default size-4). Decision: `logo.label` was dropped from en/fr/ja because every call site has visible text or a control with its own aria-label; the `label` prop stays on RelayLogo for a future sole-content use. Contrast fix (SHELL-09): the 1.67 reading was a spec bug (transparent svg background parsed as black, oklch colours mis-parsed), so the spec now resolves the first opaque ancestor background via canvas; that exposed a real 2.61:1 on the 48px empty-state mark (`text-primary`), changed to `text-foreground`; toggle and header already inherit foreground and pass in light and dark.

### ✅ P2.4 Logo in header, empty state and open-in-Relay button
- **Kind**: implementation
- **Traces**: RP-101
- **Files** (5): `src/components/relay/RelayHeader.tsx`; `src/components/relay/EmptyState.tsx`; `src/components/relay/OpenInRelayButton.tsx`; `src/components/relay/EmptyState.spec.tsx`; `src/components/relay/OpenInRelayButton.spec.tsx`
- **Depends on**: P2.3
- **Do**: Render `RelayLogo` leading the dock header (when no thread title), large in the empty state, and in `OpenInRelayButton` in place of `Sparkles`. Update the existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (header identity vs title, empty-state hero scale, light + dark, 320/400/480px). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p2-identity-*.png`.
- **Acceptance**:
  - Header and empty state each render `[data-testid="relay-logo"]`; no `Sparkles` import remains anywhere under `src/components/relay/` (RP-101); in-browser proof by E2E P2.12 `[REL-POL-SHELL-09]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/EmptyState.tsx src/components/relay/OpenInRelayButton.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx`
  - `bunx vitest run src/components/relay/EmptyState.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx src/components/relay/RelayHeader.spec.tsx`
  - `test -z "$(grep -rn 'Sparkles' src/components/relay)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p2-identity-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max placed the mark before the title in the header and above the empty-state heading as decorative (aria-hidden); impeccable replaced every Sparkles glyph so the brand mark is the single identity icon; layout scaled it per context (icon-sm in the header and button, larger in the empty state) and checked 320px wrapping.

### ✅ P2.5 New-chat chord and handler
- **Kind**: implementation
- **Traces**: RP-106
- **Files** (4): `src/lib/relay/constants.ts`; `src/lib/relay/constants.spec.ts`; `src/hooks/useRelayShortcut.ts`; `src/hooks/useRelayShortcut.spec.ts`
- **Depends on**: none
- **Do**: Add `RELAY_NEW_CHAT_SHORTCUTS` (mac `Cmd+Shift+O`, other `Ctrl+Shift+O`) next to `RELAY_SHORTCUTS`. In `useRelayShortcut.ts` add a capture-phase `keydown` branch with the same pattern as the toggle: works with focus in the composer textarea, skips `.cm-editor, .monaco-editor`, calls `preventDefault`, is a no-op on `/` or when Relay is disabled, starts a new chat (empty thread, composer focused, attachments cleared via the store's `newThread`), and when Relay is closed opens it first. Keep the toggle chord closing an open dock. Update the existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills for the keyboard path (where focus lands after the chord, what a fresh chat looks like, feedback when Relay was closed). Log the one-line design note.
- **Acceptance**:
  - Chord matcher is correct on both platforms; handler ignores events inside `.cm-editor, .monaco-editor`; no-op on `/` and when disabled (RP-106).
  - The keydown is `defaultPrevented` (proxy for the bookmarks UI not opening); browser proof by E2E P2.12 `[REL-POL-SHELL-07]`; the unit matrix is written by Unit P2.9.
- **Verify**:
  - `bunx biome check src/lib/relay/constants.ts src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.ts src/hooks/useRelayShortcut.spec.ts`
  - `bunx vitest run src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.spec.ts`
- **Log**: Design note: ui-ux-pro-max kept the chord invisible UI-wise (Shift+Mod+O mirrors the browser new-window idiom) and routed it through the existing capture-phase listener; impeccable made new-chat open the dock and focus the composer so the keypress always lands somewhere visible; layout: no visual change, focus is returned to the composer.

### ✅ P2.6 Shortcuts dialog and settings entries
- **Kind**: implementation
- **Traces**: RP-106
- **Files** (5): `src/components/layout/KeyboardShortcutsModal.tsx`; `src/components/layout/KeyboardShortcutsModal.spec.tsx`; `src/app/settings/constants.ts`; `src/components/settings/ShortcutsSection.tsx`; `src/components/settings/ShortcutsSection.spec.tsx`
- **Depends on**: P2.2, P2.5
- **Do**: List "New Relay chat" with `RELAY_NEW_CHAT_SHORTCUTS` keycaps in the dialog and the settings shortcut list, and show the Firefox note beside it in Settings.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (keycap row alignment, note placement). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p2-shortcuts-*.png`.
- **Acceptance**:
  - The dialog and Settings list show "New Relay chat" with platform-matched keycaps matching the tooltip (RP-106); browser proof by E2E P2.12 `[REL-POL-SHELL-10]`.
- **Verify**:
  - `bunx biome check src/components/layout/KeyboardShortcutsModal.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx src/app/settings/constants.ts src/components/settings/ShortcutsSection.tsx src/components/settings/ShortcutsSection.spec.tsx`
  - `bunx vitest run src/components/layout/KeyboardShortcutsModal.spec.tsx src/components/settings/ShortcutsSection.spec.tsx src/app/settings/constants.spec.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p2-shortcuts-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max added "New Relay chat" directly under the Relay toggle row so the two Relay chords sit together; impeccable reused the shared keycap renderer so the dialog, Settings and tooltips cannot drift; layout aligned the keycap column and placed the Firefox note under the row label at 320 and 1440px in light and dark.

### ✅ P2.7 Move the toggle into the tab bar
- **Kind**: implementation
- **Traces**: RP-102
- **Files** (4): `src/components/layout/LeftPanel.tsx`; `src/components/layout/LeftPanel.spec.tsx`; `src/components/layout/TabBar.tsx`; `src/components/layout/TabBar.spec.tsx`
- **Depends on**: P2.3
- **Do**: Remove `<RelayToggleButton />` and its `next/dynamic` import from `LeftPanel.tsx`. In `TabBar.tsx` render it lazily (`next/dynamic`, `ssr:false`) in the right-end `flex shrink-0 items-center gap-0.5 px-1` block immediately right of `TabListDropdown`, outside the `tabs.length > 0` condition so it renders with zero tabs and stays visible under tab overflow. `isRelayEnabled()` still gates it; `aria-expanded` and `data-testid="relay-toggle"` unchanged.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (alignment with the chevron, no jump when tabs go from 0 to 1, overflow behaviour, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p2-tabbar-*.png`.
- **Acceptance**:
  - `LeftPanel.tsx` no longer imports `RelayToggleButton`; `TabBar.tsx` imports it via `next/dynamic` (bundle split kept) (RP-102).
  - Position, zero-tab and overflow behaviour proven in the browser by E2E P2.12 `[REL-POL-SHELL-01]`, `[REL-POL-SHELL-02]`, `[REL-POL-SHELL-03]`.
- **Verify**:
  - `bunx biome check src/components/layout/LeftPanel.tsx src/components/layout/LeftPanel.spec.tsx src/components/layout/TabBar.tsx src/components/layout/TabBar.spec.tsx`
  - `bunx vitest run src/components/layout/LeftPanel.spec.tsx src/components/layout/TabBar.spec.tsx`
  - `test -z "$(grep -n 'RelayToggleButton' src/components/layout/LeftPanel.tsx)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p2-tabbar-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max moved the toggle to the tab bar's trailing edge so Relay sits with the workspace controls, not the sidebar; impeccable made it a ssr:false dynamic import so the shell stays light when Relay is off; layout renders it after the tab-list chevron and outside the has-tabs branch so it shows with zero tabs and when tabs overflow. Follow-up: a failed dock chunk is contained in RelayRoot (next/dynamic loader `.catch` resolves to RelayLoadError, an inline role=alert with `relay.dockLoadError` in the eager relay.json, en/fr/ja) so the app and the toggle stay mounted; a catch rather than an error boundary because React logs caught boundary errors to console.error, which the QA console guard forbids. Message lives in relay.json not relayDock.json since dock messages ship with the chunk that failed. Retry omitted (next/dynamic caches the rejected load); user reloads.

### ✅ P2.8 Header tooltips with keycaps
- **Kind**: implementation
- **Traces**: RP-103
- **Files** (2): `src/components/relay/RelayHeader.tsx`; `src/components/relay/RelayHeader.spec.tsx`
- **Depends on**: P2.1, P2.4, P2.5
- **Do**: Wrap the conversation trigger, New chat (with `RELAY_NEW_CHAT_SHORTCUTS` keycaps via `Kbd`) and Close (with the toggle chord keycaps) in shadcn `Tooltip`, text from the existing `aria-label` strings, opening on hover and keyboard focus, Esc dismisses, no focus trap. Every header button keeps `aria-label`. (The capabilities button is added with its tooltip in P10.)
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (tooltip delay, keycap rendering per platform, placement near the panel edge at 320px, reduced motion). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p2-tooltips-*.png`.
- **Acceptance**:
  - Each header button renders a tooltip trigger with its label, and chords render as separate keycaps matching the platform (RP-103); the 700 ms hover/focus timing and Esc dismissal are proven in the browser by E2E P2.12 `[REL-POL-SHELL-05]`.
  - No header button lacks both `aria-label` and a tooltip (proven by `[REL-POL-SHELL-06]`).
- **Verify**:
  - `bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx`
  - `bunx vitest run src/components/relay/RelayHeader.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p2-tooltips-*.png 2>/dev/null)"`
- **Log**: Design note: ui-ux-pro-max gave the history, new-chat and close buttons tooltips with keycaps; impeccable set a 700ms delay that also opens on keyboard focus and closes on Escape, and reused getAliasKeyParts so keycaps match the dialog; layout anchors the tooltip below the control, keeping it inside the dock at 320px. Follow-up: tooltip delay lowered 700ms to 500ms (HEADER_TOOLTIP_DELAY_MS) so the tooltip is visible within 700ms of hover/focus including Playwright overhead; SHELL-05 bounds restored to <700ms.

### ✅ P2.9 Unit: shortcut chord and shell wiring
- **Kind**: unit
- **Traces**: RP-106, RP-106b
- **Files** (5): `src/lib/relay/constants.ts`; `src/hooks/useRelayShortcut.ts`; `src/components/relay/RelayToggleButton.tsx`; `src/components/layout/TabBar.tsx`; `src/components/relay/RelayHeader.tsx`
- **Depends on**: P2.5, P2.7, P2.8
- **Do**: unit-test-engineer extends `constants.spec.ts`, `useRelayShortcut.spec.ts`, `RelayToggleButton.spec.tsx`, `TabBar.spec.tsx`, `RelayHeader.spec.tsx`. Cases: chord matcher for both platforms; handler ignores events inside `.cm-editor, .monaco-editor`; chord opens-and-starts-new-chat when closed; no-op on `/` and when disabled; a collision test asserting `useKeyboardShortcuts` never calls `preventDefault` for Shift+Mod+O (the spec imports `src/hooks/useKeyboardShortcuts.ts`); toggle rendered with 0 tabs and with tabs; header tooltips present on every button. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-106b and the unit side of RP-102/103.
  - Unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.spec.ts src/components/relay/RelayToggleButton.spec.tsx src/components/layout/TabBar.spec.tsx src/components/relay/RelayHeader.spec.tsx src/hooks/useKeyboardShortcuts.spec.ts --coverage --coverage.include=src/lib/relay/constants.ts --coverage.include=src/hooks/useRelayShortcut.ts --coverage.include=src/components/relay/RelayToggleButton.tsx --coverage.include=src/components/layout/TabBar.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text`

### ✅ P2.10 Unit: logo, empty state, shortcuts surfaces
- **Kind**: unit
- **Traces**: RP-101, RP-106
- **Files** (4): `src/components/relay/RelayLogo.tsx`; `src/components/relay/EmptyState.tsx`; `src/components/layout/KeyboardShortcutsModal.tsx`; `src/components/relay/OpenInRelayButton.tsx`
- **Depends on**: P2.4, P2.6
- **Do**: unit-test-engineer writes `RelayLogo.spec.tsx` (new) and extends `EmptyState.spec.tsx`, `KeyboardShortcutsModal.spec.tsx`, `OpenInRelayButton.spec.tsx`. Cases: logo `data-testid`, `aria-hidden` next to text vs accessible name when alone, `className` size prop, `currentColor` stroke; shortcuts dialog lists "New Relay chat" with platform keycaps; no `Sparkles` rendered. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-101 and the dialog side of RP-106.
  - Unit task acceptance from Conventions holds for all four files.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayLogo.spec.tsx src/components/relay/EmptyState.spec.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx --coverage --coverage.include=src/components/relay/RelayLogo.tsx --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/layout/KeyboardShortcutsModal.tsx --coverage.include=src/components/relay/OpenInRelayButton.tsx --coverage.reporter=text`

### ✅ P2.11 E2E: migrate shell, a11y and helper specs
- **Kind**: e2e
- **Traces**: RP-102, RP-101
- **Files** (4): `e2e/qa/relay/relay-shell.spec.ts`; `e2e/qa/relay/relay-a11y.spec.ts`; `e2e/fixtures/relayE2eHelpers.ts`; `e2e/scenarios/relay/relay-shell.feature.md`
- **Depends on**: P2.7, P2.9
- **Gherkin**: edits `e2e/scenarios/relay/relay-shell.feature.md` wording only where the toggle location is described; no new ids
- **Spec**: `e2e/qa/relay/relay-shell.spec.ts`, `e2e/qa/relay/relay-a11y.spec.ts`
- **Scenarios**: existing ids stay; only toggle-location assertions change (dock geometry assertions move in P3.4); helper `openRelay`/toggle lookups keep working with the toggle in the tab bar; `relay-a11y` toggle focus-order assertions are updated for the new position.
- **Do**: Update the specs and helper; run the sanity set of specs that use `relay-toggle` (`relay-improvements-pills`, `relay-improvements-context-payload`) without editing them unless they fail.
- **Acceptance**:
  - The migrated specs pass with the toggle in the tab bar and no reference to a sidebar toggle remains in e2e.
  - `relay-improvements-pills` and `relay-improvements-context-payload` still pass unmodified (or are listed in the Log with the fix).
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P2.12 E2E: shell identity, tooltips and chords
- **Kind**: e2e
- **Traces**: RP-101, RP-102, RP-103, RP-106
- **Files** (0): none (no app change)
- **Depends on**: P2.10, P2.11
- **Gherkin**: `e2e/scenarios/relay/relay-polish-shell.feature.md`: REL-POL-SHELL-01..11
- **Spec**: `e2e/qa/relay/relay-polish-shell.spec.ts`
- **Scenarios**:
  - `[REL-POL-SHELL-01] the toggle is at the far right of the tab bar, right of the tab-list chevron, and not in the left sidebar` @critical
  - `[REL-POL-SHELL-02] with zero tabs the toggle is still at the far right and does not jump when a tab opens` @high (empty)
  - `[REL-POL-SHELL-03] with many tabs (overflow) the toggle stays visible` @high
  - `[REL-POL-SHELL-04] clicking the toggle opens and closes the dock and aria-expanded flips; state survives a reload` @critical (persistence)
  - `[REL-POL-SHELL-05] header tooltips appear on hover and on keyboard focus within 700 ms, show keycaps, and Esc dismisses` @high
  - `[REL-POL-SHELL-06] no header button lacks an accessible name` @medium
  - `[REL-POL-SHELL-07] the new-chat chord pressed in the composer starts an empty focused chat with attachments cleared and is default-prevented; the toggle chord closes an open dock` @critical
  - `[REL-POL-SHELL-08] the chords do nothing on the landing route` @medium
  - `[REL-POL-SHELL-09] toggle, header and empty state each render the logo test id and the toggle glyph contrasts in light and dark` @high
  - `[REL-POL-SHELL-10] the shortcuts dialog lists "New Relay chat" with platform keycaps` @medium
  - `[REL-POL-SHELL-11] with Relay enabled but a failing dock chunk the toggle still renders and shows an error state instead of crashing` @medium (error)
- **Do**: 01 compares bounding boxes of toggle, chevron and sidebar; 05 measures time-to-visible and uses `Tab` to focus; 07 asserts `defaultPrevented` through a page-level listener; 09 reads computed colour contrast; 11 aborts the lazy chunk request. Deep-link: 08 loads `/` directly.
- **Acceptance**:
  - Covers RP-101, RP-102, RP-103 (header), RP-106 ACs.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P2.13 Checkpoint 2
- **Kind**: gate
- **Traces**: RP-101, RP-102, RP-103, RP-106, RP-106b
- **Files** (0): none (verification only)
- **Depends on**: P2.1, P2.2, P2.3, P2.4, P2.5, P2.6, P2.7, P2.8, P2.9, P2.10, P2.11, P2.12
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - No `Sparkles` under `src/components/relay/` or `TabBar`; the toggle is not in the left sidebar; the bundle split (dynamic import) is retained.
  - All commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/components/layout src/components/settings src/hooks src/lib/relay src/app/settings src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-a11y.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rn 'Sparkles' src/components/relay src/components/layout/TabBar.tsx)"`  (expect exit 0)
  - `grep -n "next/dynamic" src/components/layout/TabBar.tsx`  (expect a match)

🔶 **Checkpoint 2**: logo, tab-bar toggle, header tooltips and the new-chat chord shipped; shell specs green.

---

## Phase 3: Dock width limits

**Adds:** The Relay dock is now 30% of the window wide by default (never narrower than 320px) and can be dragged between 30% and 40%; it keeps pushing the page content instead of covering it, remembers its width, and re-fits when the window is resized.

**Try in UI:** Open Relay at 1440px and see it take about 432px with the page content beside it ; Drag the left edge of the dock and confirm it stops at 30% and 40% of the window and keeps the width after a reload ; Shrink the window to 900px and confirm the dock stays 320px wide ; Focus the resize handle and use ArrowLeft/ArrowRight to resize within the same limits ; Resize to 700px and confirm the mobile sheet still opens

No `ResizablePanel` migration, no panel host and no `position` change (the left/right setting stays a known no-op, out of scope). P3.1 removes `RELAY_DEFAULT_WIDTH_PX`; `RelayDock.spec.tsx` and `RelayRoot.spec.tsx` still import it until P3.2, so build P3.1 and P3.2 back to back (each task's Verify runs only the specs it owns).

### ✅ P3.1 Width limit constants and clamp helpers
- **Kind**: implementation
- **Traces**: RP-110
- **Files** (5): `src/lib/relay/constants.ts`; `src/lib/relay/constants.spec.ts`; `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`; `src/hooks/useRelayFocus.spec.ts`
- **Depends on**: none
- **Do**: In `constants.ts` add `RELAY_MIN_WIDTH_VW = 30` and `RELAY_DEFAULT_WIDTH_VW = 30`, change `RELAY_MAX_WIDTH_VW` from 60 to 40, keep `RELAY_MIN_WIDTH_PX = 320` as the floor, and remove `RELAY_DEFAULT_WIDTH_PX`. Add two CSS-expression constants built from them, `RELAY_MIN_WIDTH_CSS = "max(320px, 30vw)"` and `RELAY_MAX_WIDTH_CSS = "max(320px, 40vw)"` (template strings over the numeric constants), the single source for the dock style and the reserved gap. In `useRelayStore.ts` add pure `getRelayMinWidth(viewportWidth)` = `max(320, floor(vw * 30 / 100))` and `getRelayDefaultWidth(viewportWidth)` (30vw, never below the floor); change `getRelayMaxWidth(viewportWidth)` to `max(getRelayMinWidth(vw), floor(vw * 40 / 100))` so the floor wins when 320px > 40vw; `clampRelayWidth` clamps to `[min, max]` and falls back to `getRelayDefaultWidth` for a non-finite width; `readWidth` returns the viewport default when nothing valid is stored and otherwise re-clamps the stored value; `setWidth` clamps. The pre-hydration initial `width` must not read `window` (SSR): use `RELAY_MIN_WIDTH_PX`; `hydrate` overwrites it with `readWidth()`. Update `constants.spec.ts` (new values, floor, default >= floor), `useRelayStore.spec.ts` and `useRelayFocus.spec.ts` (drop the removed constant) so they stay green.
- **Design**: n/a, logic only; no visual change (limits only). Screenshots are taken at the new widths in E2E P3.5.
- **Acceptance**:
  - At a 1440px viewport: min 432, max 576, default 432; at 1100px: 330 / 440; at 900px: 320 / 360; at 780px: min = max = 320 (floor wins over 312); at 1024px: 320 / 409 (RP-110).
  - A stored `700` is clamped to the max on `hydrate`, a stored `100` to the min, a missing or non-numeric value yields the viewport default, and `setWidth` clamps in both directions.
  - `RELAY_DEFAULT_WIDTH_PX` no longer exists under `src/lib` or `src/stores`.
- **Verify**:
  - `bunx biome check src/lib/relay/constants.ts src/lib/relay/constants.spec.ts src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayFocus.spec.ts`
  - `bunx vitest run src/lib/relay/constants.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayFocus.spec.ts`
  - `test -z "$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src/lib src/stores)"`  (expect exit 0)

### ✅ P3.2 Apply the limits to the handle, dock and reserved space
- **Kind**: implementation
- **Traces**: RP-110
- **Files** (5): `src/components/relay/ResizeHandle.tsx`; `src/components/relay/RelayDock.tsx`; `src/components/relay/RelayDock.spec.tsx`; `src/components/relay/RelayRoot.tsx`; `src/components/relay/RelayRoot.spec.tsx`
- **Depends on**: P3.1
- **Do**: `ResizeHandle`: `aria-valuemin` = `getRelayMinWidth(window.innerWidth)` and `aria-valuemax` = `getRelayMaxWidth(window.innerWidth)` (the effective range); pointer and keyboard handlers keep calling `onWidthChange`, which the store clamps. `RelayDock`: the aside's inline `minWidth`/`maxWidth` become `RELAY_MIN_WIDTH_CSS`/`RELAY_MAX_WIDTH_CSS` (CSS lets `min-width` win over `max-width`, so the floor wins on small viewports); the fixed positioning, slide transition and `Esc`/focus behavior stay untouched. `RelayRoot`: `useReserveDockSpace` builds `clamp(${RELAY_MIN_WIDTH_CSS}, ${width}px, ${RELAY_MAX_WIDTH_CSS})` for `--relay-dock-offset` (the body padding logic itself stays), and a small `useClampDockWidthOnResize(active)` hook in the same file listens to `window` `resize` and, only when the stored width falls outside the new range, calls `setWidth` with the clamped value (no write when already inside the range). Update `RelayDock.spec.tsx` and `RelayRoot.spec.tsx` for the new constants and CSS expressions.
- **Design**: n/a, no visual change (limits only); design gate recorded as not applicable for RP-110 (SPEC section 3).
- **Acceptance**:
  - The aside's inline style uses the shared min/max CSS expressions; the handle's `aria-valuemin`/`aria-valuemax` equal the effective range for the current `innerWidth`; `--relay-dock-offset` uses the same bounds; a simulated `resize` that leaves the width out of range updates the store once and one that leaves it in range does not.
  - Proven in a browser by E2E P3.4 and P3.5 (`[REL-POL-PANEL-01..]`).
- **Verify**:
  - `bunx biome check src/components/relay/ResizeHandle.tsx src/components/relay/RelayDock.tsx src/components/relay/RelayDock.spec.tsx src/components/relay/RelayRoot.tsx src/components/relay/RelayRoot.spec.tsx`
  - `bunx vitest run src/components/relay/ResizeHandle.spec.tsx src/components/relay/RelayDock.spec.tsx src/components/relay/RelayRoot.spec.tsx`
  - `test -z "$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src)"`  (expect exit 0)

### ✅ P3.3 Unit: dock width limits
- **Kind**: unit
- **Traces**: RP-110
- **Files** (4): `src/lib/relay/constants.ts`; `src/stores/useRelayStore.ts`; `src/components/relay/ResizeHandle.tsx`; `src/components/relay/RelayRoot.tsx`
- **Depends on**: P3.2
- **Do**: unit-test-engineer extends `constants.spec.ts`, `useRelayStore.spec.ts`, `ResizeHandle.spec.tsx` and `RelayRoot.spec.tsx`. Cases: helper table for viewports 1440 / 1100 / 1024 / 900 / 800 (boundary) / 780 / 320 (min, max, default; floor wins when 320 > 40vw); `clampRelayWidth` below, inside, above, `NaN` and `Infinity`; `readWidth` with no key, empty string, non-numeric, in-range and out-of-range values and `localStorage` throwing; `setWidth` persists the clamped value; `ResizeHandle` ArrowLeft/ArrowRight step by `RELAY_KEY_RESIZE_STEP_PX`, stop at the bounds, ignore other keys, pointer move maps `innerWidth - clientX` through `onWidthChange`, `aria-valuemin/max/now` follow a changed `innerWidth`; `RelayRoot` resize listener re-clamps once when out of range, does nothing when in range or when the dock is inactive, and removes the listener on unmount; reserved gap `clamp()` string uses the shared CSS constants. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers the RP-110 clamp, persistence, handle and re-clamp ACs at unit level.
  - Unit task acceptance from Conventions holds for all four files.
- **Verify**:
  - `bunx vitest run src/lib/relay/constants.spec.ts src/stores/useRelayStore.spec.ts src/components/relay/ResizeHandle.spec.tsx src/components/relay/RelayRoot.spec.tsx --coverage --coverage.include=src/lib/relay/constants.ts --coverage.include=src/stores/useRelayStore.ts --coverage.include=src/components/relay/ResizeHandle.tsx --coverage.include=src/components/relay/RelayRoot.tsx --coverage.reporter=text`

### ✅ P3.4 E2E: migrate dock-size specs
- **Kind**: e2e
- **Traces**: RP-110
- **Files** (5): `e2e/qa/relay/relay-improvements-layout.spec.ts`; `e2e/scenarios/relay/relay-improvements-layout.feature.md`; `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`; `e2e/scenarios/relay/relay-improvements-a11y-layout.feature.md`; `e2e/qa/relay/relay-shell.spec.ts`
- **Depends on**: P3.3
- **Gherkin**: edits the two existing layout feature files (`REL-LAYOUT-02` and `REL-IA11Y-05` wording about "400px" and "the 320px minimum"); no new ids. `relay-shell.feature.md` needs no change unless `[REL-SHELL-03]` wording names px values.
- **Spec**: `e2e/qa/relay/relay-improvements-layout.spec.ts`, `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`, `e2e/qa/relay/relay-shell.spec.ts`
- **Scenarios**: existing ids stay. `REL-LAYOUT-02` and `REL-IA11Y-05` set the viewport to 1024x800 first, where the default dock is the 320px floor and dragging to the maximum gives about 409px, then assert the composer row at the 320px minimum, at the dragged maximum (replacing the old "400px" step; `DEFAULT_WIDTH_PX = 400` is removed) and at the mobile sheet width. `REL-SHELL-03` runs at 1440x900: default 432, drag far left lands on 40vw (576), drag far right lands on 30vw (432), one ArrowLeft from the minimum gives 448, and the width persists across reload. `relayE2eHelpers.ts` (`expectDockWidth`) is unchanged and needs no edit.
- **Do**: Edit only what breaks and list the changes in the Log; keep ids unique and in parity; no `waitForTimeout`.
- **Acceptance**:
  - The three specs pass against the new limits and no spec file under `e2e/qa/relay` references `DEFAULT_WIDTH_PX = 400` or the old `60vw` maximum.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-shell.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `test -z "$(grep -rnE 'DEFAULT_WIDTH_PX = 400|MAX_WIDTH_VW = 0\.6' e2e/qa/relay)"`  (expect exit 0)

### ✅ P3.5 E2E: dock width limits
- **Kind**: e2e
- **Traces**: RP-110
- **Files** (0): none (no app change)
- **Depends on**: P3.4
- **Gherkin**: `e2e/scenarios/relay/relay-polish-panel.feature.md`: REL-POL-PANEL-01..09
- **Spec**: `e2e/qa/relay/relay-polish-panel.spec.ts`
- **Scenarios**:
  - `[REL-POL-PANEL-01] at 1440px with no saved width the open dock is 30vw (432px)` @critical
  - `[REL-POL-PANEL-02] at 1100px the dock is 330px and at 900px it is 320px; at 780px the 320px floor wins over 40vw; never below 320px after drag-to-minimum or after shrinking the window with the dock open` @critical
  - `[REL-POL-PANEL-03] dragging the handle clamps between 30vw (432px) and 40vw (576px) at 1440px` @critical
  - `[REL-POL-PANEL-04] reload keeps the clamped width; a saved 700px (rq_relay_width) is clamped to 576px on reload and after a window resize` @high (persistence)
  - `[REL-POL-PANEL-05] keyboard: the focused handle resizes with ArrowLeft/ArrowRight in 16px steps, stops at the bounds, and aria-valuemin/aria-valuemax match the effective range` @high
  - `[REL-POL-PANEL-06] page content is not covered: the body reserve tracks the dock width, the content stays visible beside the dock and the page has no horizontal scroll` @high
  - `[REL-POL-PANEL-07] closing the dock releases the reserved space and reopening restores the saved width` @high (empty)
  - `[REL-POL-PANEL-08] below 768px the sheet variant opens at the full viewport width and is unchanged` @high
  - `[REL-POL-PANEL-09] a corrupt rq_relay_width value ("abc", empty) falls back to the 30vw default` @medium (error)
- **Do**: Measure the dock with `getBoundingClientRect` via `expectDockWidth` and `page.setViewportSize`; drag with the handle's bounding box (as `dragHandleTo` in the layout spec does); 06 compares the `document.body` computed `padding-right` with the dock width and `scrollWidth <= clientWidth`; 04 seeds `rq_relay_width` through the seed init script or `addInitScript`. Take agent-browser style `snap` screenshots (visual record only) at 1440, 1100, 780 and 320 under `agent_docs/qa/relay-polish/p3-dock-*.png`.
- **Acceptance**:
  - Covers every RP-110 AC bullet except the `rg` check (covered by the checkpoint).
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P3.6 Checkpoint 3
- **Kind**: gate
- **Traces**: RP-110
- **Files** (0): none (verification only)
- **Depends on**: P3.1, P3.2, P3.3, P3.4, P3.5
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - RP-110 ACs pass; `RELAY_DEFAULT_WIDTH_PX` is gone; screenshots at 1440, 1100, 780 and 320 exist.
  - All commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/stores src/hooks src/lib/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-shell.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src e2e)"`  (expect exit 0)
  - `grep -n 'RELAY_MAX_WIDTH_VW = 40' src/lib/relay/constants.ts`  (expect a match)
  - `test -n "$(ls agent_docs/qa/relay-polish/p3-*1440*.png agent_docs/qa/relay-polish/p3-*320*.png 2>/dev/null)"`

🔶 **Checkpoint 3**: the Relay dock is limited to `max(30vw, 320px)` to `40vw` (default 30vw), persisted width is re-clamped on load and on window resize, page content stays uncovered, the mobile sheet is unchanged.

---

## Phase 4: Conversation overlay and rows

**Adds:** The conversation list is a floating menu that no longer pushes the chat down. Rows show a short relative time (5m, 3h, 2d) and a "..." menu with Rename and Delete; deleting is instant with an Undo toast.

**Try in UI:** Open the conversation menu and see it float over the chat with a shadow, without moving the composer ; Hover a row and replace the time with "..." then choose Rename and press Enter ; Choose Delete and press Undo in the toast to get the same row back in the same place ; Hover a time to read the full date ; Open the menu at the narrowest width and confirm there is no horizontal scroll

### ✅ P4.1 Relative time util
- **Kind**: implementation
- **Traces**: RP-104
- **Files** (1): `src/lib/relay/relativeTime.ts` (new)
- **Depends on**: Checkpoint 3
- **Do**: Export pure `formatRelativeTime(timestamp, now) -> { unit, value }` with `unit` in `now | minutes | hours | days | weeks | months | years`. Thresholds are named constants: now < 60 s; minutes < 60; hours < 24; days < 7; weeks 7-29 days (`floor(days/7)`); months 30-364 days (`floor(days/30)`); years >= 365 (`floor(days/365)`). Never seconds. Future timestamps clamp to `now`.
- **Design**: n/a, logic only; design gate recorded on P4.3.
- **Acceptance**:
  - 30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d map to now, 5 minutes, 3 hours, 2 days, 1 week, 3 months, 1 year; boundaries 59/60 s, 59/60 m, 23/24 h, 6/7 d, 29/30 d, 364/365 d are exact; negative skew gives now (RP-104). Spec coverage by Unit P4.5.
- **Verify**:
  - `bunx biome check src/lib/relay/relativeTime.ts`

### ✅ P4.2 Thread time and menu strings
- **Kind**: implementation
- **Traces**: RP-104, RP-105, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P4.1
- **Do**: Add `threads.time.{now,minutes,hours,days,weeks,months,years}` (ICU `{count}` with a per-locale suffix: en `5m`, `3h`, `2d`, `1w`, `3mo`, `1y`), `threads.menu.{more,rename,delete}`, `threads.undo.{deleted,undo}` in en, fr, ja with identical key sets. Keep the old delete-dialog keys for now (P4.3 removes them with the component).
- **Design**: n/a, strings only; design gate on P4.3.
- **Acceptance**:
  - New keys exist in en, fr, ja with `{count}` preserved and no vendor name.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ✅ P4.3 Row time, overflow menu, delete with Undo
- **Kind**: implementation
- **Traces**: RP-104, RP-105
- **Files** (5): `src/components/relay/ThreadList.tsx`; `src/components/relay/ThreadList.spec.tsx`; `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P4.2
- **Do**: Each row shows `formatRelativeTime(updatedAt)` at the far right through the i18n keys, with a `title` of the full local date-time (`Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })`), `data-testid="relay-thread-time"`. Remove the always-visible Pencil and Trash. On row hover or focus-within, a `MoreHorizontal` button (`relay-thread-menu-trigger`) replaces the time with no layout shift (reserve the width) and opens a `DropdownMenu` with Rename (`relay-thread-menu-rename`) and Delete (`relay-thread-menu-delete`, destructive color). Rename uses the existing inline `Input` (Enter saves, Esc cancels, blur saves, empty rejected). Delete calls `deleteThread` immediately and shows a sonner toast with Undo for `RELAY_UNDO_TOAST_MS`, restoring via `restoreThread` at the same position and title; deleting the active thread starts a fresh empty thread. Remove the `AlertDialog` and the `relay-thread-delete-dialog`, `relay-thread-delete-confirm`, `relay-thread-rename`, `relay-thread-delete` ids and their i18n keys in all three locales. Update `ThreadList.spec.tsx`.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (row density, time/trigger swap without shift, menu placement near the edge at 320px, destructive styling, toast copy, focus return after delete). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p4-rows-*.png`.
- **Log**: ui-ux-pro-max: `content-jumping`/`number-tabular` rules led to reserving the time/menu slot and tabular figures; impeccable: kept the row flat (no cards, no icon clutter at rest), time muted and hover-swapped with the `...` trigger; layout: slot is `min-w-10` with `whitespace-nowrap` and the trigger absolutely positioned, so fr "à l'instant" (57px) and ja "11か月" stay on one line without overlapping the title or shifting on hover (measured at the 320px dock, 900px viewport). Screenshot `p4-rows-i18n-900-dark.png`.
- **Acceptance**:
  - No pencil or trash icon in the row at rest; hover/focus shows `...` with exactly Rename and Delete; delete is immediate with Undo; no `AlertDialog` import remains (RP-104, RP-105). In-browser proof by E2E P4.8 `[REL-POL-THREADS-01..06]`.
  - Removed testids and keys do not appear under `src` or `messages`.
- **Verify**:
  - `bunx biome check src/components/relay/ThreadList.tsx src/components/relay/ThreadList.spec.tsx messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/components/relay/ThreadList.spec.tsx src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rnE 'relay-thread-delete-dialog|relay-thread-delete-confirm|relay-thread-rename"|relay-thread-delete"' src messages)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p4-rows-*.png 2>/dev/null)"`

### ✅ P4.4 Floating conversation overlay
- **Kind**: implementation
- **Traces**: RP-107
- **Files** (5): `src/components/relay/RelayHeader.tsx`; `src/components/relay/RelayHeader.spec.tsx`; `src/components/relay/ThreadList.tsx`; `src/components/relay/ThreadList.spec.tsx`; `src/lib/relay/constants.ts`
- **Depends on**: P4.3, P2.8
- **Do**: Render the conversation list inside a portaled `Popover` anchored to the header trigger instead of an inline section: `bg-popover` surface, border, `shadow-lg`, rounded, `sideOffset` from a named constant, `z-50`, `max-h` with internal scroll, width matching the panel at 320px with no horizontal scroll. Click-outside, Esc and selecting a thread close it and return focus to the trigger (`relay-thread-trigger`); testid `relay-thread-overlay` on the content. The message list and composer do not move. Search input and Today/Yesterday/Earlier groups stay. Keep the Phase 2 header tooltip on the trigger.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills so the overlay reads as raised (shadow, border, distinct surface) in light and dark, with correct stacking over the panel and the resize handle. Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p4-overlay-*.png`.
- **Log**: ui-ux-pro-max: `elevation-consistent`/`z-index-management` rules led to popover surface + border + shadow-lg at z-50; impeccable: overlay uses the popover token so it reads raised in light and dark; layout: width matches the 320px dock, list scrolls internally (max-h-80), composer bbox unchanged (verified by probe).
- **Acceptance**:
  - The overlay is portaled, has `shadow-lg` and `bg-popover`, and the composer box position is unchanged with it open (RP-107); pixel and focus behavior proven by E2E P4.8 `[REL-POL-THREADS-07]`, `[REL-POL-THREADS-08]`, `[REL-POL-THREADS-09]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx src/components/relay/ThreadList.tsx src/components/relay/ThreadList.spec.tsx src/lib/relay/constants.ts`
  - `bunx vitest run src/components/relay/RelayHeader.spec.tsx src/components/relay/ThreadList.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p4-overlay-*.png 2>/dev/null)"`

### ✅ P4.5 Unit: relative time
- **Kind**: unit
- **Traces**: RP-104
- **Files** (1): `src/lib/relay/relativeTime.ts`
- **Depends on**: P4.1
- **Do**: unit-test-engineer writes `relativeTime.spec.ts` (new): the seven example mappings, all six boundary pairs, negative skew, zero, very large values. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-104 boundaries; unit task acceptance from Conventions holds.
- **Verify**:
  - `bunx vitest run src/lib/relay/relativeTime.spec.ts --coverage --coverage.include=src/lib/relay/relativeTime.ts --coverage.reporter=text`

### ✅ P4.6 Unit: thread list and header
- **Kind**: unit
- **Traces**: RP-104, RP-105, RP-107
- **Files** (2): `src/components/relay/ThreadList.tsx`; `src/components/relay/RelayHeader.tsx`
- **Depends on**: P4.4
- **Do**: unit-test-engineer extends `ThreadList.spec.tsx` and `RelayHeader.spec.tsx`. Cases: time text per locale mapping and `title` full date; `...` appears on hover and focus-within and swaps with the time; menu has exactly Rename and Delete; rename Enter/Esc/blur/empty; delete calls `deleteThread` and the toast Undo calls `restoreThread`; no `AlertDialog`; deleting the active thread starts a new thread; overlay opens, closes on Esc/select/outside and returns focus. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-104, RP-105, RP-107 at unit level; unit task acceptance from Conventions holds.
- **Verify**:
  - `bunx vitest run src/components/relay/ThreadList.spec.tsx src/components/relay/RelayHeader.spec.tsx --coverage --coverage.include=src/components/relay/ThreadList.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text`

### ✅ P4.7 E2E: migrate thread specs
- **Kind**: e2e
- **Traces**: RP-105
- **Files** (2): `e2e/qa/relay/relay-threads.spec.ts`; `e2e/scenarios/relay/relay-threads.feature.md`
- **Depends on**: P4.6
- **Gherkin**: edits `e2e/scenarios/relay/relay-threads.feature.md`; no new ids
- **Spec**: `e2e/qa/relay/relay-threads.spec.ts`
- **Scenarios**: existing ids stay; delete-confirm-dialog scenarios become delete plus Undo; pencil/trash locators become the `...` menu locators; thread-list selectors target `relay-thread-overlay`.
- **Do**: Edit only what breaks; keep ids unique.
- **Acceptance**:
  - The spec passes against the overlay and row menu with no reference to the removed ids.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-threads.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P4.8 E2E: thread rows and overlay
- **Kind**: e2e
- **Traces**: RP-104, RP-105, RP-107
- **Files** (0): none (no app change)
- **Depends on**: P4.6, P4.7
- **Gherkin**: `e2e/scenarios/relay/relay-polish-threads.feature.md`: REL-POL-THREADS-01..11
- **Spec**: `e2e/qa/relay/relay-polish-threads.spec.ts`
- **Scenarios**:
  - `[REL-POL-THREADS-01] no pencil or trash at rest; hover and keyboard focus reveal "..." in place of the time with no layout shift` @critical
  - `[REL-POL-THREADS-02] rows seeded 30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d old show now, 5m, 3h, 2d, 1w, 3mo, 1y and hovering the time shows the full date` @critical
  - `[REL-POL-THREADS-03] the menu has exactly Rename and Delete; Rename saves on Enter, cancels on Esc, saves on blur and rejects empty` @high
  - `[REL-POL-THREADS-04] Delete removes the row at once; Undo restores it at the same position with the same title` @critical
  - `[REL-POL-THREADS-05] without Undo the delete is final after 5 s and survives a reload` @high (persistence)
  - `[REL-POL-THREADS-06] deleting the active thread starts a fresh empty thread` @high (empty)
  - `[REL-POL-THREADS-07] opening the overlay leaves the composer box and message scroll position unchanged and the overlay floats with shadow and a distinct surface in light and dark` @critical
  - `[REL-POL-THREADS-08] Esc, outside click and selecting a thread close the overlay and focus returns to the trigger` @high
  - `[REL-POL-THREADS-09] at the 320px panel width the overlay has no horizontal scroll` @high
  - `[REL-POL-THREADS-10] a thread list with no threads shows the empty state and search with no match shows no-results` @medium (empty)
  - `[REL-POL-THREADS-11] a deep link to a thread route restores that thread and the overlay lists it as current` @medium (deep-link)
- **Do**: Seed threads with explicit `updatedAt` values through the existing thread seeding helper; 07 compares composer `getBoundingClientRect` before and after; 05 waits on the toast disappearing with a web-first assertion, not a timeout.
- **Acceptance**:
  - Covers RP-104, RP-105, RP-107 ACs.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-threads.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P4.9 Checkpoint 4
- **Kind**: gate
- **Traces**: RP-104, RP-105, RP-107
- **Files** (0): none (verification only)
- **Depends on**: P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - Rows and overlay behave per the RP ACs; no confirm dialog remains; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-threads.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-threads.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`

🔶 **Checkpoint 4**: relative times, row menu with Undo and a floating conversation overlay shipped; thread specs green.

---

## Phase 5: Context model: remove implicit context

**Adds:** Relay no longer sends your open request, collection or environment unless you attach it. "Current tab" becomes something you can attach, the empty state shows the same three starter prompts on every tab, and "explain this response" with nothing attached asks you to attach the tab.

**Try in UI:** Open a request, start a new chat and see no "Using: ... current tab" text and no context pill ; Open the + picker, pick "Current tab" and see a pill for that tab ; Send "explain this response" with nothing attached and see Relay ask you to attach the tab ; Switch to a different tab and confirm the empty-state starters do not change

### ☐ P5.1 Context chips and payload builder
- **Kind**: implementation
- **Traces**: RP-201, RP-202
- **Files** (4): `src/lib/relay/chips.ts`; `src/lib/relay/chips.spec.ts`; `src/lib/relay/contextBuilder.ts`; `src/lib/relay/contextBuilder.spec.ts`
- **Depends on**: Checkpoint 4
- **Do**: `ContextChipKind` gains `tab` (id = `tabId`, label = tab name). Remove `computeContextChips`, `selectActiveChips`, `isAutoChip` and the route-derived chain chip. `buildChatPayload` input becomes `{ messages, store, redact, attachedItems }`; `describeAttached` handles `tab` using the redacted `describeActiveContext` shape; the payload `activeTab`, `collection` and `environment` fields come only from `attachedItems`; the `workspace` index stays. `redactDeep` stays last. Update both existing specs.
- **Design**: n/a, logic only; design gate recorded on P5.3.
- **Acceptance**:
  - With no attached items the built payload has no `activeTab`, `collection` or `environment` key; with one attached request it has exactly that request's description; secret env values are `[redacted]` and `shareValues` still gates env values (RP-201, RP-202).
  - `rg 'computeContextChips|selectActiveChips|isAutoChip'` is empty in these two modules.
- **Verify**:
  - `bunx biome check src/lib/relay/chips.ts src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.ts src/lib/relay/contextBuilder.spec.ts`
  - `bunx vitest run src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.spec.ts`
  - `test -z "$(grep -nE 'computeContextChips|selectActiveChips|isAutoChip' src/lib/relay/chips.ts src/lib/relay/contextBuilder.ts)"`  (expect exit 0)

### ☐ P5.2 Store and chat hook use attachments only
- **Kind**: implementation
- **Traces**: RP-201, RP-203
- **Files** (4): `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`; `src/hooks/useRelayChat.ts`; `src/hooks/useRelayChat.spec.ts`
- **Depends on**: P5.1
- **Do**: Remove `draftChips`, `removedChipKeys`, `dismissedAutoChipTabId`, `removeChip`, `resetRemovedChips`, `dismissAutoChip`; `newThread` still clears attachments and drafts. In `useRelayChat`, drop `removedChipKeys` and `activeChainId` from the `buildChatPayload` call and populate `ToolContext.attached` from the store at call time. Update both existing specs.
- **Design**: n/a, logic only; design gate recorded on P5.3.
- **Acceptance**:
  - None of the removed symbols exists in the store; `newThread` clears attached items; `ToolContext.attached` reflects the store at `onToolCall` time (RP-201, RP-203).
- **Verify**:
  - `bunx biome check src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts`
  - `bunx vitest run src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.spec.ts`
  - `test -z "$(grep -rnE 'dismissAutoChip|dismissedAutoChipTabId|removedChipKeys|resetRemovedChips|draftChips' src)"`  (expect exit 0)

### ☐ P5.3 Chip list shows attached items only
- **Kind**: implementation
- **Traces**: RP-201, RP-205
- **Files** (4): `src/components/relay/ContextChips.tsx`; `src/components/relay/ContextChips.spec.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`
- **Depends on**: P5.2
- **Do**: Remove `useAvailableChips` and `AutoChipLabel` from `ContextChips.tsx`; the list renders only `attachedItems` (including `tab`). Remove the "Using: ... current tab" label and every caller of the removed store actions in `RelayComposer.tsx`. Update both existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (the chip row is now empty by default: no reserved space, no layout jump when the first chip is attached, chip styling for the `tab` kind with a tab icon). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p5-chips-*.png`.
- **Acceptance**:
  - A fresh conversation shows no chips and no "Using:" text (RP-205); a `tab` attachment renders a labelled chip; proven in the browser by E2E P5.14 `[REL-POL-CTX-01]`, `[REL-POL-CTX-02]`.
  - `rg 'useAvailableChips|AutoChipLabel'` is empty under `src`.
- **Verify**:
  - `bunx biome check src/components/relay/ContextChips.tsx src/components/relay/ContextChips.spec.tsx src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx`
  - `bunx vitest run src/components/relay/ContextChips.spec.tsx src/components/relay/RelayComposer.spec.tsx`
  - `test -z "$(grep -rnE 'useAvailableChips|AutoChipLabel' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p5-chips-*.png 2>/dev/null)"`

### ☐ P5.4 get_active_context returns attached items only
- **Kind**: implementation
- **Traces**: RP-203
- **Files** (4): `src/lib/relay/tools/workspaceRead.ts`; `src/lib/relay/tools/workspaceRead.spec.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/registry.spec.ts`
- **Depends on**: P5.2
- **Do**: `ToolContext` gains `attached` (the attached chips at call time). `get_active_context` keeps its name (persisted threads contain parts with that name) but returns only attached items, built through the same redacted descriptions as the payload; zero attached returns an explicit empty result the model can read ("nothing attached"). Update both existing specs.
- **Design**: n/a, logic only; design gate recorded on P5.3.
- **Acceptance**:
  - `get_active_context` with 0, 1 and many attached items returns empty, one and many descriptions and never reads the active tab (RP-203).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/workspaceRead.ts src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/registry.spec.ts`
  - `bunx vitest run src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.spec.ts`

### ☐ P5.5 Tool descriptions and system prompt rule
- **Kind**: implementation
- **Traces**: RP-203
- **Files** (5): `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/schemas.spec.ts`; `src/lib/relay/tools/tabRequests.ts`; `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`
- **Depends on**: P5.4
- **Do**: Rewrite the `get_active_context` description and the `update_tab_request` description ("tab must be attached"). Audit every tool: none may default to the active tab when the model omits an id (the `activeTabId` read in `tabRequests.ts` `openTab` only fetches the id of a tab the tool just opened and is fine); list the audit result in the Log. Add one rule to `systemPrompt.ts`: nothing about the user's open tab, collection or environment is known unless attached; when the user says "this request/tab/response" with nothing attached, ask them to attach Current tab (or use `ask_user` with that suggestion) instead of guessing. `schemas.ts` stays free of store/DOM imports. Update the existing specs.
- **Design**: n/a, logic only.
- **Acceptance**:
  - The new rule is present in the prompt; tool descriptions say attached; the audit finds no active-tab default (RP-203).
  - `brandGuard.spec.ts` stays green with the new wording.
- **Verify**:
  - `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/tabRequests.ts src/lib/relay/server/systemPrompt.ts src/lib/relay/server/systemPrompt.spec.ts`
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -n 'import.*stores' src/lib/relay/tools/schemas.ts)"`  (expect exit 0)

### ☐ P5.6 Starter and picker strings
- **Kind**: implementation
- **Traces**: RP-202, RP-205, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P5.2
- **Do**: Add `emptyState.starters.{one,two,three}` (three tab-independent prompts) and `picker.currentTab.{label,none}` ("Current tab", "No tab open") in all locales. Remove the "Using: ..." label keys and the tab-derived suggestion keys (including any `see what Relay can see` strings only if unused after P5.7; otherwise leave for P10 and note it).
- **Design**: n/a, strings only; design gate on P5.7 and P5.9.
- **Acceptance**:
  - New keys exist in en, fr, ja with identical key sets; the removed keys are gone from all three.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ☐ P5.7 Interim starters and follow-up audit
- **Kind**: implementation
- **Traces**: RP-205
- **Files** (5): `src/lib/relay/suggestions.ts`; `src/lib/relay/suggestions.spec.ts`; `src/components/relay/EmptyState.tsx`; `src/components/relay/EmptyState.spec.tsx`; `src/lib/relay/followUps.ts`
- **Depends on**: P5.6
- **Do**: Replace `deriveSuggestions` and `useSuggestionContext` with a constant, tab-independent starter list (the three `emptyState.starters.*` keys); `EmptyState.tsx` renders them. Audit `followUps.ts`: it may depend on the last assistant turn but not the active tab; change it only if it reads tab state, and record the audit in the Log. Update the existing specs (add a `followUps.spec.ts` case in Unit P5.10 if the file changed).
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (starter chip layout under the logo, density at 320px, light + dark; this is interim and is replaced in P10). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p5-empty-*.png`.
- **Acceptance**:
  - The empty state shows the same three starters whichever tab is open and no tab-derived text (RP-205); proven by E2E P5.14 `[REL-POL-CTX-07]`.
  - `rg 'deriveSuggestions|useSuggestionContext'` is empty under `src`.
- **Verify**:
  - `bunx biome check src/lib/relay/suggestions.ts src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.tsx src/components/relay/EmptyState.spec.tsx src/lib/relay/followUps.ts`
  - `bunx vitest run src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.spec.tsx src/lib/relay/followUps.spec.ts`
  - `test -z "$(grep -rnE 'deriveSuggestions|useSuggestionContext' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p5-empty-*.png 2>/dev/null)"`

### ☐ P5.8 Temporary Current tab row in the legacy picker
- **Kind**: implementation
- **Traces**: RP-202
- **Files** (4): `src/components/relay/RelayPicker.tsx`; `src/components/relay/RelayPicker.spec.tsx`; `src/hooks/useRelayPickerItems.ts`; `src/hooks/useRelayPickerItems.spec.ts`
- **Depends on**: P5.6
- **Do**: Put a "Current tab" row at the top of the legacy `RelayPicker` (disabled with "No tab open" when there is none). Selecting it calls `addAttachedItem` with a `tab` chip (tabId, tab name). This row is deleted with the picker in P8.5 (its strings in P8.6). Update the existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (pinned row separation, disabled state, 320px). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p5-picker-*.png`.
- **Acceptance**:
  - With a tab open the row attaches a `tab` chip; with none it is disabled (RP-202); proven by E2E P5.14 `[REL-POL-CTX-03]`, `[REL-POL-CTX-04]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayPicker.tsx src/components/relay/RelayPicker.spec.tsx src/hooks/useRelayPickerItems.ts src/hooks/useRelayPickerItems.spec.ts`
  - `bunx vitest run src/components/relay/RelayPicker.spec.tsx src/hooks/useRelayPickerItems.spec.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p5-picker-*.png 2>/dev/null)"`

### ☐ P5.9 Unit: payload, chips and store
- **Kind**: unit
- **Traces**: RP-201, RP-202
- **Files** (5): `src/lib/relay/chips.ts`; `src/lib/relay/contextBuilder.ts`; `src/stores/useRelayStore.ts`; `src/hooks/useRelayChat.ts`; `src/lib/relay/followUps.ts`
- **Depends on**: P5.5, P5.7
- **Do**: unit-test-engineer extends `chips.spec.ts`, `contextBuilder.spec.ts`, `useRelayStore.spec.ts`, `useRelayChat.spec.ts`, `followUps.spec.ts`. Cases: payload per chip kind (`tab`, request, collection, environment, chain); no implicit keys with nothing attached; redaction ordering (secret env `[redacted]`, `shareValues` gating, `redactDeep` last); `newThread` clears attachments; `ToolContext.attached` snapshot at call time; follow-ups independent of the active tab; a replayed persisted thread containing an old `get_active_context` part renders, continues and is redacted. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-201, RP-202a and the replay case; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.spec.ts src/lib/relay/followUps.spec.ts --coverage --coverage.include=src/lib/relay/chips.ts --coverage.include=src/lib/relay/contextBuilder.ts --coverage.include=src/stores/useRelayStore.ts --coverage.include=src/hooks/useRelayChat.ts --coverage.include=src/lib/relay/followUps.ts --coverage.reporter=text`

### ☐ P5.10 Unit: tools, starters and picker row
- **Kind**: unit
- **Traces**: RP-203, RP-205, RP-202
- **Files** (5): `src/lib/relay/tools/workspaceRead.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/suggestions.ts`; `src/components/relay/EmptyState.tsx`; `src/components/relay/RelayPicker.tsx`
- **Depends on**: P5.8, P5.9
- **Do**: unit-test-engineer extends `workspaceRead.spec.ts`, `registry.spec.ts`, `suggestions.spec.ts`, `EmptyState.spec.tsx`, `RelayPicker.spec.tsx`. Cases: `get_active_context` with 0, 1, many attached; no tool reads the active tab by default; starters constant and tab-independent; empty state renders no "Using" text; picker Current tab row enabled, disabled and attach behavior. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-203, RP-205 and the interim RP-202 row; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.spec.tsx src/components/relay/RelayPicker.spec.tsx --coverage --coverage.include=src/lib/relay/tools/workspaceRead.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/suggestions.ts --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/relay/RelayPicker.tsx --coverage.reporter=text`

### ☐ P5.11 E2E: migrate context chip and payload specs
- **Kind**: e2e
- **Traces**: RP-201
- **Files** (4): `e2e/qa/relay/relay-improvements-context-chip.spec.ts`; `e2e/scenarios/relay/relay-improvements-context-chip.feature.md`; `e2e/qa/relay/relay-improvements-context-payload.spec.ts`; `e2e/scenarios/relay/relay-improvements-context-payload.feature.md`
- **Depends on**: P5.10
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: scenarios that asserted auto chips (route chain, active request/collection/environment) or auto payload keys are removed or rewritten to attach through the legacy picker first; secret-redaction and `shareValues` scenarios stay.
- **Do**: Keep surviving ids unique and in parity.
- **Acceptance**:
  - Both specs pass and no scenario asserts an implicit chip or implicit payload key.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P5.12 E2E: migrate suggestions and pills specs
- **Kind**: e2e
- **Traces**: RP-205, RP-201
- **Files** (4): `e2e/qa/relay/relay-improvements-context-suggestions.spec.ts`; `e2e/scenarios/relay/relay-improvements-context-suggestions.feature.md`; `e2e/qa/relay/relay-improvements-pills.spec.ts`; `e2e/scenarios/relay/relay-improvements-pills.feature.md`
- **Depends on**: P5.11
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: tab-derived suggestion scenarios are deleted (their replacement is `[REL-POL-CTX-07]`); if the whole suggestions spec is obsolete both files are deleted and `check-ids.sh` stays green; pills scenarios that depended on auto chips attach explicitly first.
- **Do**: Record deleted ids in the Log.
- **Acceptance**:
  - The remaining specs pass; no reference to `relay-see-what` or tab-derived suggestions in these files.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P5.13 E2E: migrate picker, privacy and chat specs
- **Kind**: e2e
- **Traces**: RP-202, RP-201
- **Files** (5): `e2e/qa/relay/relay-improvements-picker.spec.ts`; `e2e/scenarios/relay/relay-improvements-picker.feature.md`; `e2e/qa/relay/relay-privacy.spec.ts`; `e2e/scenarios/relay/relay-privacy.feature.md`; `e2e/qa/relay/relay-chat.spec.ts`
- **Depends on**: P5.12
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the three specs above
- **Scenarios**: picker scenarios expect the Current tab row at the top; `relay-privacy` selectors for chips and context become attach-first; `relay-chat` assertions on `relay-see-what`, `relay-suggestion` and `relay-context-chip` use the interim starters and explicit attachment.
- **Do**: Edit only what breaks; list the changes in the Log.
- **Acceptance**:
  - The three specs pass with no implicit-context assumptions.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P5.14 E2E: explicit context
- **Kind**: e2e
- **Traces**: RP-201, RP-202, RP-203, RP-205
- **Files** (0): none (no app change)
- **Depends on**: P5.10, P5.13
- **Gherkin**: `e2e/scenarios/relay/relay-polish-ctx.feature.md`: REL-POL-CTX-01..10
- **Spec**: `e2e/qa/relay/relay-polish-ctx.spec.ts`
- **Scenarios**:
  - `[REL-POL-CTX-01] with a request, collection and environment open and nothing attached, the composer has no pill and the /api/relay/chat body has no activeTab, collection or environment key` @critical
  - `[REL-POL-CTX-02] no "Using: ... current tab" text exists in the DOM` @high
  - `[REL-POL-CTX-03] the Current tab row in the picker attaches a tab pill and the next body has activeTab for that tab and nothing else implicit` @critical
  - `[REL-POL-CTX-04] with no tab open the Current tab row is disabled with "No tab open"` @high (empty)
  - `[REL-POL-CTX-05] attaching a request sends exactly that request's description; a duplicate attach does not duplicate it` @critical
  - `[REL-POL-CTX-06] starting a new chat clears attached items` @high
  - `[REL-POL-CTX-07] the empty-state starters are identical regardless of which tab is open` @high
  - `[REL-POL-CTX-08] a scripted "explain this response" with nothing attached gets a reply that asks the user to attach Current tab, with no get_active_context data` @critical
  - `[REL-POL-CTX-09] a seeded persisted thread containing an old get_active_context tool part renders, continues, and its payload is redacted` @high (persistence)
  - `[REL-POL-CTX-10] secret environment values stay [redacted] in the body when the environment is attached with Share variable values on and off` @high (error)
- **Do**: Capture the request body with `page.route("**/api/relay/chat")`; 08 uses a scripted stream via `relayRoutes.ts`; 09 seeds the thread through the existing helper.
- **Acceptance**:
  - Covers RP-201, RP-202 (part a), RP-203, RP-205 ACs.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P5.15 Checkpoint 5
- **Kind**: gate
- **Traces**: RP-201, RP-202, RP-203, RP-205
- **Files** (0): none (verification only)
- **Depends on**: P5.1, P5.2, P5.3, P5.4, P5.5, P5.6, P5.7, P5.8, P5.9, P5.10, P5.11, P5.12, P5.13, P5.14
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - Nothing reaches the model unless attached; the empty state is tab-independent; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rnE 'computeContextChips|selectActiveChips|isAutoChip|useAvailableChips|AutoChipLabel|dismissAutoChip|deriveSuggestions' src)"`  (expect exit 0)

🔶 **Checkpoint 5**: implicit context removed end to end, attachments are the only source of context, interim starters in place, context specs migrated and green.

---

## Phase 6: Unified composer, pills and the `@` mention menu

**Adds:** The chat box becomes one rounded Cursor/Notion-style box with `+`, attached pills, mic and send inside it. Typing `@` opens a wide, fully local menu to mention a request, collection, environment or chain (Current tab first), and each mention becomes a removable pill.

**Try in UI:** Open Relay and see one bordered box with the placeholder "Ask anything, @ to mention, / for actions" ; Type `@` and pick Current tab to see `@Name ` in the text and a pill inside the box ; Click the pill X and see both the pill and the `@Name` text disappear ; Type `a@b` and confirm no menu opens ; Narrow the panel to 320px and confirm nothing overlaps

The `+` button keeps opening the legacy picker (re-anchored inside the box) until P8. No shield in this phase. Keep `data-testid="relay-picker-trigger"` on `+` for the rest of the feature (the launcher in P8 reuses it) so unrelated specs do not churn.

### ☐ P6.1 Composer, mention and tooltip strings
- **Kind**: implementation
- **Traces**: RP-210, RP-213, RP-103
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: Checkpoint 5
- **Do**: Set `composerPlaceholder` to exactly `Ask anything, @ to mention, / for actions` (fr and ja translate the sentence and keep the `@` and `/` characters). Add `mention.{currentTab,noTab,results,keepTyping,empty,hintRequest,hintCollection,hintChain,listLabel}`, `composer.pill.{remove,stale}` (ICU `{name}`), and tooltip keys `composer.tooltip.{add,mic,send,stop}` in all three locales with identical key sets. Do not remove picker keys yet (P8.6).
- **Design**: n/a, strings only; design gate on P6.4 to P6.7.
- **Acceptance**:
  - New keys exist in en, fr, ja with `{name}` preserved; en placeholder equals the SPEC string character for character (RP-210).
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `grep -c "Ask anything, @ to mention, / for actions" messages/en/relayDock.json`  (expect 1)

### ☐ P6.2 Recents store and mention constants
- **Kind**: implementation
- **Traces**: RP-215, RP-211
- **Files** (2): `src/stores/useRelayRecentStore.ts` (new); `src/lib/relay/constants.ts`
- **Depends on**: P6.1
- **Do**: Add constants `RELAY_STORAGE_KEYS.recent = "rq_relay_recent"`, `RELAY_RECENTS_CAP = 5`, `RELAY_COMPOSER_MAX_HEIGHT_PX`, `RELAY_COMPOSER_MIN_ROWS = 2`, `RELAY_MENTION_MAX_HEIGHT_PX`. `useRelayRecentStore` (Zustand, `src/stores/use<Name>Store.ts` conventions) holds `items: { kind, id, name }[]` (names and ids only, never request bodies or values), `recordRecent(chip)` (move to front, dedupe by `chipKey`, cap), `clear()`, hydrates from `localStorage` with try/catch that logs with context and falls back to `[]` on corrupt JSON. It is written on attach (P6.7) and read in P8.
- **Design**: n/a, logic only; design gate on P6.6.
- **Acceptance**:
  - Recording a 6th distinct item drops the oldest; re-recording an existing item moves it to the front without duplicating; corrupt storage yields `[]` (RP-215). Coverage by Unit P6.8.
- **Verify**:
  - `bunx biome check src/stores/useRelayRecentStore.ts src/lib/relay/constants.ts`

### ☐ P6.3 Mention token logic
- **Kind**: implementation
- **Traces**: RP-211, RP-212, RP-209
- **Files** (2): `src/lib/relay/mentions.ts`; `src/lib/relay/mentions.spec.ts`
- **Depends on**: P6.1
- **Do**: Keep `findActiveMention` semantics (start of text or after whitespace; never mid-word such as `a@b`). Add pure `isMentionMenuAllowed(text, caret)` (false while `findSlashQuery` is active, true otherwise) and `stripMentionToken(text, name)` (removes exactly one `@Name ` token including its single trailing space, leaves surrounding text intact, no-op when absent). `replaceMention` unchanged. Update the existing spec for the new exports.
- **Design**: n/a, logic only.
- **Acceptance**:
  - `@` at index 0 and after a space is detected; `a@b` is not; with an active slash query `isMentionMenuAllowed` is false; `stripMentionToken("run @Get users now", "Get users")` returns `run now` (RP-211, RP-209).
- **Verify**:
  - `bunx biome check src/lib/relay/mentions.ts src/lib/relay/mentions.spec.ts`
  - `bunx vitest run src/lib/relay/mentions.spec.ts`

### ☐ P6.4 MentionMenu component
- **Kind**: implementation
- **Traces**: RP-211, RP-202, RP-213
- **Files** (5): `src/components/relay/MentionMenu.tsx` (new); `src/components/relay/RelayPickerRow.tsx`; `src/hooks/useRelayPickerItems.ts`; `src/hooks/useRelayPickerItems.spec.ts`; `src/lib/relay/constants.ts`
- **Depends on**: P6.2, P6.3
- **Do**: Create `MentionMenu` with the parameterised API `{ query, kind?: "request" | "collection" | "environment" | "chain" | null, hint?: string, pinCurrentTab?: boolean, anchor: "composer", onSelect(chip), onClose() }`. Inline above the composer box, as wide as the box (`w-full`, never wider than the viewport), `role="listbox"` (`data-testid="relay-mention-menu"`, rows `relay-mention-option`, `role="option"`), focus stays in the textarea (the menu is driven through `aria-activedescendant` and callbacks, never takes focus). Sections: "Current tab" pinned first (icon, tab name, breadcrumb secondary line; disabled with "No tab open" when none), then "Results" rows (kind icon, name, secondary line: requests `METHOD url` truncated and redacted/templated, others breadcrumb or counts). Rows come from `useRelayPickerItems` (extend the hook with an optional `kind` filter and no kind tabs) and `searchWorkspaceItems`; virtualize with the same `@tanstack/react-virtual` setup and `ROW_HEIGHT_PX` as the old picker (reuse, do not fork); cap `PICKER_RESULT_LIMIT` 50 with the footer "Keep typing to narrow results" when truncated; keyboard reducer from `src/lib/pickerNav.ts`. Zero network: no `fetch`, no AI call, only in-app stores. `RelayPickerRow` gains only the props needed (no kind-tab coupling).
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (Notion reference: Current tab section, Results rows, secondary lines, hover/active/disabled/empty/no-results states, elevation above the box, light + dark, widths 320/400/480 with no horizontal scroll). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p6-mention-*.png`.
- **Acceptance**:
  - The menu renders Current tab first and Results below, is `role="listbox"`, and makes no network call (RP-211); the Current tab row is disabled with "No tab open" when no tab exists (RP-202 part b).
  - Width, keyboard and zero-network behavior in a real browser are proven by E2E P6.15 `[REL-POL-MENTION-02]`, `[REL-POL-MENTION-03]`, `[REL-POL-MENTION-08]`, `[REL-POL-MENTION-09]`.
- **Verify**:
  - `bunx biome check src/components/relay/MentionMenu.tsx src/components/relay/RelayPickerRow.tsx src/hooks/useRelayPickerItems.ts src/hooks/useRelayPickerItems.spec.ts src/lib/relay/constants.ts`
  - `bunx vitest run src/hooks/useRelayPickerItems.spec.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p6-mention-*.png 2>/dev/null)"`

### ☐ P6.5 ComposerPills replace ContextChips
- **Kind**: implementation
- **Traces**: RP-209, RP-201
- **Files** (4): `src/components/relay/ComposerPills.tsx` (new); `src/components/relay/ContextChips.tsx` (delete); `src/components/relay/ContextChips.spec.tsx` (delete); `src/components/relay/EntityPill.tsx`
- **Depends on**: P6.3
- **Do**: `ComposerPills({ onRemove })` renders `attachedItems` as pills (`relay-composer-pill`, icon + name, truncating with a tooltip, remove button `relay-composer-pill-remove` with `aria-label` from `composer.pill.remove`). Removing a pill calls `removeAttachedItem` and `onRemove(chip)` so the composer strips its `@token` via `stripMentionToken`. A pill whose entity no longer exists in the workspace renders struck/muted (`composer.pill.stale`) and the existing stale-ref handling drops it at send. Delete `ContextChips.tsx` and its spec; reuse `EntityPill` styling without changing its other consumers.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (pill density, truncation, stale state, wrapping onto its own line above the toolbar at narrow widths, focus ring on the X, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p6-pills-*.png`.
- **Acceptance**:
  - `ContextChips.tsx`, its spec and every `relay-context-chip` reference are gone; a pill shows icon + name + labelled remove button (RP-209); removal behavior in a browser is proven by E2E P6.14 `[REL-POL-COMPOSER-10]`, `[REL-POL-COMPOSER-11]`.
- **Verify**:
  - `bunx biome check src/components/relay/ComposerPills.tsx src/components/relay/EntityPill.tsx`
  - `test ! -e src/components/relay/ContextChips.tsx -a ! -e src/components/relay/ContextChips.spec.tsx`
  - `test -z "$(grep -rn 'ContextChips\|relay-context-chip' src)"`  (expect exit 0 after P6.6 rewires the composer)
  - `test -n "$(ls agent_docs/qa/relay-polish/p6-pills-*.png 2>/dev/null)"`

### ☐ P6.6 One-box composer layout
- **Kind**: implementation
- **Traces**: RP-208, RP-103, RP-209
- **Files** (5): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/MicButton.tsx`; `src/components/relay/MicButton.spec.tsx`; `src/lib/relay/constants.ts`
- **Depends on**: P6.5
- **Do**: Replace `relay-composer-row`, `relay-composer-leading` and `relay-composer-trailing` with `relay-composer-box` (`rounded-2xl border`, focus-within ring from tokens): textarea on top (auto-grow from `RELAY_COMPOSER_MIN_ROWS` to `RELAY_COMPOSER_MAX_HEIGHT_PX`, then scroll), then a toolbar row inside the same box: `+` (left, `relay-picker-trigger`, still opens the legacy `RelayPicker` popover re-anchored inside the box), the `ComposerPills` region (wrapping onto its own line above the toolbar when narrow), then mic and a circular send/stop on the right. Tooltips on `+`, mic and send/stop from the `composer.tooltip.*` keys (visible on focus too). Caption "Relay is AI and can make mistakes. Check important changes." stays below the box (`relay-footer`). Send disabled when empty or offline, becomes Stop while streaming (unchanged behavior). Touch targets at least `RELAY_MIN_TOUCH_TARGET_PX` in the mobile sheet. No shield. Remove the temporary "Current tab" row only in P8.5, not here. Update the two existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (single border and focus ring, toolbar alignment, pills wrapping rules, button sizing, caption spacing, disabled/offline/streaming states, light + dark, panel widths 320/400/480). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p6-composer-*.png`.
- **Acceptance**:
  - One bordered box contains textarea and toolbar; `relay-composer-row` no longer exists under `src` (RP-208); tab order is textarea, `+`, pill remove buttons, mic, send (no shield).
  - Overlap, overflow and touch-target behavior are proven in a browser by E2E P6.14 `[REL-POL-COMPOSER-01]`, `[REL-POL-COMPOSER-02]`, `[REL-POL-COMPOSER-06]`, `[REL-POL-COMPOSER-09]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/MicButton.tsx src/components/relay/MicButton.spec.tsx src/lib/relay/constants.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/MicButton.spec.tsx`
  - `test -z "$(grep -rn 'relay-composer-row\|relay-composer-leading\|relay-composer-trailing' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p6-composer-*.png 2>/dev/null)"`

### ☐ P6.7 Wire mentions: open, select, attach, strip
- **Kind**: implementation
- **Traces**: RP-211, RP-212, RP-209, RP-202, RP-215
- **Files** (5): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/SlashMenu.tsx`; `src/components/relay/SlashMenu.spec.tsx`; `src/stores/useRelayStore.ts`
- **Depends on**: P6.4, P6.6
- **Do**: In the composer, open `MentionMenu` when `findActiveMention` matches and `isMentionMenuAllowed` is true; drive Up/Down/Enter/Tab/Esc from the textarea `onKeyDown` while focus stays in the textarea (`aria-activedescendant`); Esc closes and leaves the typed text. Selecting an item calls `replaceMention` to insert `@Name ` and `addAttachedItem` (deduped by `chipKey`, so the pill count never doubles) and `useRelayRecentStore.recordRecent`. Deleting token text does not detach (Q12); `ComposerPills` removal strips the token. Opening the slash menu closes the mention menu and the reverse. Selecting Current tab attaches a `tab` chip. Update the existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (open/close timing, active-row scroll-into-view, focus never leaving the textarea, caret placement after insertion, exclusivity with the slash menu). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p6-wire-*.png`.
- **Acceptance**:
  - `@` at the start of an empty composer and after a space opens the menu; `a@b` does not; selecting a request inserts `@Name ` and creates exactly one pill; selecting it again creates no second pill; the outgoing payload includes that request (RP-211, RP-212).
  - Behavior in a real browser is proven by E2E P6.15 `[REL-POL-MENTION-01]`, `[REL-POL-MENTION-05]`, `[REL-POL-MENTION-06]`, `[REL-POL-MENTION-10]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.tsx src/components/relay/SlashMenu.spec.tsx src/stores/useRelayStore.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx src/stores/useRelayStore.spec.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p6-wire-*.png 2>/dev/null)"`

### ☐ P6.8 Unit: mention logic and stores
- **Kind**: unit
- **Traces**: RP-211, RP-212, RP-215
- **Files** (4): `src/lib/relay/mentions.ts`; `src/stores/useRelayRecentStore.ts`; `src/hooks/useRelayPickerItems.ts`; `src/stores/useRelayStore.ts`
- **Depends on**: P6.7
- **Do**: unit-test-engineer extends `mentions.spec.ts`, `useRelayPickerItems.spec.ts`, `useRelayStore.spec.ts` and writes `useRelayRecentStore.spec.ts` (new). Cases: mention detection at start, after space, after newline, mid-word `a@b`, caret inside a token, with an active slash query; `replaceMention` insertion; `stripMentionToken` with duplicates, absent token, adjacent text; `kind` filter and 50-row cap in the picker-items hook; recents cap 5, move-to-front, dedupe by key, names/ids only persisted, corrupt JSON, `localStorage` throwing; `addAttachedItem` dedupe. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers the RP-211, RP-212 and recents ACs; unit task acceptance from Conventions holds for all four files.
- **Verify**:
  - `bunx vitest run src/lib/relay/mentions.spec.ts src/stores/useRelayRecentStore.spec.ts src/hooks/useRelayPickerItems.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/mentions.ts --coverage.include=src/stores/useRelayRecentStore.ts --coverage.include=src/hooks/useRelayPickerItems.ts --coverage.include=src/stores/useRelayStore.ts --coverage.reporter=text`

### ☐ P6.9 Unit: composer components
- **Kind**: unit
- **Traces**: RP-208, RP-209, RP-211, RP-103
- **Files** (5): `src/components/relay/MentionMenu.tsx`; `src/components/relay/ComposerPills.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/SlashMenu.tsx`; `src/components/relay/MicButton.tsx`
- **Depends on**: P6.8
- **Do**: unit-test-engineer writes `MentionMenu.spec.tsx` and `ComposerPills.spec.tsx` (new) and extends `RelayComposer.spec.tsx`, `SlashMenu.spec.tsx`, `MicButton.spec.tsx` (happy-dom header on each). Cases: listbox roles and `aria-activedescendant`; Current tab first and disabled with no tab; arrows/Enter/Tab/Esc; hint rendering; truncated footer; no network (spy on `fetch`); pill render, remove, token strip, stale state; one box and tab order; auto-grow cap; send disabled/offline/stop; tooltips on `+`, mic, send; slash and mention exclusivity both directions. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-208, RP-209, RP-211 at unit level; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/components/relay/MentionMenu.spec.tsx src/components/relay/ComposerPills.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx src/components/relay/MicButton.spec.tsx --coverage --coverage.include=src/components/relay/MentionMenu.tsx --coverage.include=src/components/relay/ComposerPills.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/SlashMenu.tsx --coverage.include=src/components/relay/MicButton.tsx --coverage.reporter=text`

### ☐ P6.10 E2E: migrate mic and stop specs
- **Kind**: e2e
- **Traces**: RP-208, RP-103
- **Files** (4): `e2e/qa/relay/relay-improvements-a11y-mic.spec.ts`; `e2e/scenarios/relay/relay-improvements-a11y-mic.feature.md`; `e2e/qa/relay/relay-improvements-qol-stop.spec.ts`; `e2e/scenarios/relay/relay-improvements-qol-stop.feature.md`
- **Depends on**: P6.9
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: mic and send/stop locators and position assertions follow the box layout (mic then send on the right inside `relay-composer-box`); stop-while-streaming assertions unchanged in behavior.
- **Do**: Edit only what breaks; keep ids unique.
- **Acceptance**:
  - Both specs pass against the one-box composer.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.11 E2E: migrate voice and pills specs
- **Kind**: e2e
- **Traces**: RP-208, RP-209
- **Files** (4): `e2e/qa/relay/relay-improvements-voice.spec.ts`; `e2e/scenarios/relay/relay-improvements-voice.feature.md`; `e2e/qa/relay/relay-improvements-pills.spec.ts`; `e2e/scenarios/relay/relay-improvements-pills.feature.md`
- **Depends on**: P6.10
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: voice transcript insertion targets the textarea inside `relay-composer-box`; pills scenarios move from `relay-context-chip` to `relay-composer-pill` and remove through `relay-composer-pill-remove`.
- **Do**: Edit only what breaks; keep ids unique.
- **Acceptance**:
  - Both specs pass with the new locators.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.12 E2E: migrate context specs to pills
- **Kind**: e2e
- **Traces**: RP-209, RP-201
- **Files** (4): `e2e/qa/relay/relay-improvements-context-chip.spec.ts`; `e2e/scenarios/relay/relay-improvements-context-chip.feature.md`; `e2e/qa/relay/relay-improvements-context-payload.spec.ts`; `e2e/scenarios/relay/relay-improvements-context-payload.feature.md`
- **Depends on**: P6.11
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: every `relay-context-chip*` locator becomes `relay-composer-pill*`; attach flows that used the picker popover keep working through the `+` popover or switch to `@` where simpler.
- **Do**: Edit only what breaks; list changes in the Log. (SPEC/PLAN gap: PLAN section 6 does not list these two for P6, but they reference `relay-context-chip`.)
- **Acceptance**:
  - Both specs pass and no `relay-context-chip` string remains in them.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.13 E2E: migrate picker, privacy and chat specs
- **Kind**: e2e
- **Traces**: RP-209, RP-211
- **Files** (4): `e2e/qa/relay/relay-improvements-picker.spec.ts`; `e2e/scenarios/relay/relay-improvements-picker.feature.md`; `e2e/qa/relay/relay-privacy.spec.ts`; `e2e/qa/relay/relay-chat.spec.ts`
- **Depends on**: P6.12
- **Gherkin**: edits `relay-improvements-picker.feature.md`; no new ids
- **Spec**: the three specs above
- **Scenarios**: picker scenarios that open the popover from `+` keep working; `@` entry-point scenarios are rewritten to the mention menu; `relay-privacy` and `relay-chat` pill locators become `relay-composer-pill`.
- **Do**: Edit only what breaks; list changes in the Log.
- **Acceptance**:
  - The three specs pass and none references `relay-context-chip`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.14 E2E: unified composer
- **Kind**: e2e
- **Traces**: RP-208, RP-209, RP-210, RP-103
- **Files** (0): none (no app change)
- **Depends on**: P6.9, P6.13
- **Gherkin**: `e2e/scenarios/relay/relay-polish-composer.feature.md`: REL-POL-COMPOSER-01..12
- **Spec**: `e2e/qa/relay/relay-polish-composer.spec.ts`
- **Scenarios**:
  - `[REL-POL-COMPOSER-01] one rounded border wraps the textarea and the toolbar inside relay-composer-box` @critical
  - `[REL-POL-COMPOSER-02] at panel widths 320, 400 and 480px nothing overlaps or overflows and pills wrap above the toolbar` @critical
  - `[REL-POL-COMPOSER-03] the textarea grows from 2 rows up to the maximum height then scrolls` @high
  - `[REL-POL-COMPOSER-04] the placeholder equals "Ask anything, @ to mention, / for actions" in en, and keeps @ and / in fr and ja` @high
  - `[REL-POL-COMPOSER-05] send is disabled when empty and while offline, and becomes stop while streaming` @high
  - `[REL-POL-COMPOSER-06] tab order is textarea, +, pill remove buttons, mic, send with no shield` @high
  - `[REL-POL-COMPOSER-07] the AI caption is visible at all times` @medium
  - `[REL-POL-COMPOSER-08] tooltips appear on focus for +, mic and send/stop` @high
  - `[REL-POL-COMPOSER-09] touch targets are at least the mobile minimum in the sheet at 390px` @medium
  - `[REL-POL-COMPOSER-10] an attached item shows a pill inside the box; the X removes the pill and its @token from the draft` @critical
  - `[REL-POL-COMPOSER-11] a pill for a deleted workspace item is struck and muted and is dropped from the sent payload` @high (error)
  - `[REL-POL-COMPOSER-12] a new chat clears the pills and the attached items` @medium (empty)
- **Do**: Drive panel widths with `page.setViewportSize` and the handle; overlap via `getBoundingClientRect` intersections; offline via `context.setOffline`.
- **Acceptance**:
  - Covers RP-208, RP-209, RP-210 and the RP-103 composer tooltips.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.15 E2E: mention menu
- **Kind**: e2e
- **Traces**: RP-211, RP-212, RP-202, RP-213
- **Files** (0): none (no app change)
- **Depends on**: P6.14
- **Gherkin**: `e2e/scenarios/relay/relay-polish-mention.feature.md`: REL-POL-MENTION-01..14
- **Spec**: `e2e/qa/relay/relay-polish-mention.spec.ts`
- **Scenarios**:
  - `[REL-POL-MENTION-01] @ at the start and after a space opens the menu; mid-word a@b does not` @critical
  - `[REL-POL-MENTION-02] Current tab is first with the tab name and breadcrumb; with no tab open it is disabled with "No tab open"` @critical
  - `[REL-POL-MENTION-03] typing "get" narrows rows; Arrow keys plus Enter or Tab select` @critical
  - `[REL-POL-MENTION-04] Esc closes the menu and leaves the typed text` @high
  - `[REL-POL-MENTION-05] selecting a request inserts "@Name " and one pill; selecting it again adds no second pill` @critical
  - `[REL-POL-MENTION-06] after Send the /api/relay/chat body contains that request's description` @critical
  - `[REL-POL-MENTION-07] deleting the token text does not detach the pill; the pill X strips the token` @high
  - `[REL-POL-MENTION-08] the menu is as wide as the composer box at 320, 400 and 480px and never overflows the viewport` @high
  - `[REL-POL-MENTION-09] opening, typing, filtering and selecting produce zero /api/relay/* or other-host requests until Send` @critical
  - `[REL-POL-MENTION-10] opening the slash menu closes the mention menu and the reverse` @high
  - `[REL-POL-MENTION-11] with 200 seeded requests only a window of rows is in the DOM and the footer says "Keep typing to narrow results"` @medium
  - `[REL-POL-MENTION-12] a query with no match shows the no-results row` @medium (empty)
  - `[REL-POL-MENTION-13] the menu is role=listbox, the textarea keeps focus and aria-activedescendant follows the active row` @high
  - `[REL-POL-MENTION-14] attaching writes names and ids only to rq_relay_recent and survives a reload` @medium (persistence)
- **Do**: Zero-network via `page.on("request")` collecting non-asset requests from before opening to before Send; seed 200 requests through the QA seed helper.
- **Acceptance**:
  - Covers RP-211, RP-212 and RP-202 part b.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P6.16 Checkpoint 6
- **Kind**: gate
- **Traces**: RP-202, RP-208, RP-209, RP-210, RP-211, RP-212, RP-213, RP-103
- **Files** (0): none (verification only)
- **Depends on**: P6.1, P6.2, P6.3, P6.4, P6.5, P6.6, P6.7, P6.8, P6.9, P6.10, P6.11, P6.12, P6.13, P6.14, P6.15
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - The one-box composer, pills and the local mention menu behave per the RP ACs; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rn 'ContextChips\|relay-context-chip\|relay-composer-row' src e2e)"`  (expect exit 0)

🔶 **Checkpoint 6**: unified composer, pills and the local `@` mention menu shipped; the legacy picker still works behind `+`; composer specs migrated and green.

---

## Phase 7: Slash actions and target handling

**Adds:** Typing `/` lists 15 grouped commands (Understand, Build, Test, Run, Share, Chat) with icons and descriptions. Commands that act on something (such as `/run` or `/fix`) never send blind: with nothing attached they open the `@` menu with a hint.

**Try in UI:** Type `/` and see 15 commands in six groups ; Type `/ru` and see only `/run` ; Choose `/run` with nothing attached and see the mention menu with "Pick a request to run" ; Pick Current tab and see `/run` ready to send ; Choose `/clear` on a non-empty chat and see the confirm

### ☐ P7.1 Slash strings
- **Kind**: implementation
- **Traces**: RP-217, RP-218, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: Checkpoint 6
- **Do**: Add `slash.group.{understand,build,test,run,share,chat}`, and for each of the 15 commands (`explain, summarize, docs, new, import, chain, env, assert, tests, run, fix, diff, curl, export, clear`) a `slash.<id>.description` and (except `clear`) a `slash.<id>.prompt`, plus `slash.hint.{request,collection,chain,tab}` ("Pick a request to run" style, one per target kind). Prompts follow SPEC section 6: they name the intent in plain words, steer to the mapped tools without vendor names, and tell the model to ask via `ask_user` when a parameter is missing (for example `/new` asks which collection). Keep the existing keys for the five existing commands consistent with the new naming. Identical key sets in en, fr, ja.
- **Design**: n/a, strings only; design gate on P7.4 and P7.5.
- **Acceptance**:
  - Every command id has a description in all three locales and a prompt (except `clear`); key sets identical (RP-217, RP-218, RP-213).
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`

### ☐ P7.2 Slash command metadata and 10 new commands
- **Kind**: implementation
- **Traces**: RP-217, RP-218, RP-219
- **Files** (2): `src/lib/relay/slashCommands.ts`; `src/lib/relay/slashCommands.spec.ts`
- **Depends on**: P7.1
- **Do**: Extend `SlashCommandId` and the `SlashCommand` type with `icon` (a lucide icon name from a typed map), `group` (`SlashGroup`), `requiresTarget: "request" | "collection" | "chain" | "tab" | null`, `descriptionKey`, `promptKey`. Add `/new /run /fix /tests /diff /import /export /env /chain /summarize` with the SPEC section 6 groups and targets (`/explain` tab or request; `/summarize` any attached; `/docs` collection; `/assert` request; `/tests` request; `/run` request or chain; `/fix` request; `/diff` request; `/curl` request; `/export` request or none; `/new /import /chain /env /clear` none). `SLASH_GROUP_ORDER = Understand, Build, Test, Run, Share, Chat`. `filterSlashCommands` filters over name and translated description; `findSlashQuery` semantics unchanged. Audit every prompt's mapped tool names against `RELAY_TOOL_SCHEMAS` keys (grep) and record the audit in the Log; any command not achievable with existing tools is documented as a limitation in the Log (surfaced in the P10 empty state), never built. Update the existing spec.
- **Design**: n/a, logic only; design gate on P7.4.
- **Acceptance**:
  - The list has exactly 15 commands with unique ids; ids, groups and targets match SPEC section 6; `/ru` filters to `/run`; `findSlashQuery` returns the same results as before for all inputs the old spec covered (RP-217, RP-218, RP-219).
- **Verify**:
  - `bunx biome check src/lib/relay/slashCommands.ts src/lib/relay/slashCommands.spec.ts`
  - `bunx vitest run src/lib/relay/slashCommands.spec.ts`

### ☐ P7.3 Slash target matching
- **Kind**: implementation
- **Traces**: RP-204
- **Files** (2): `src/lib/relay/slashTarget.ts` (new); `src/lib/relay/slashCommands.ts`
- **Depends on**: P7.2
- **Do**: Export pure `resolveSlashTarget(command, attachedItems) -> { satisfied: boolean, needKind: "request" | "collection" | "chain" | "tab" | null }`. `requiresTarget: null` is always satisfied; `tab` is satisfied by a `tab` chip; `request` by a `request` or `tab` chip; `collection`/`chain` by the matching kind; `/run` accepts request or chain (needKind is the first missing kind to prefilter, request). `/clear` and `/import` never require a target.
- **Design**: n/a, logic only; design gate on P7.5.
- **Acceptance**:
  - `/run` with no attached items is unsatisfied with `needKind: "request"`; with a request or chain attached it is satisfied; `/clear` and `/import` are satisfied with nothing attached (RP-204). Coverage by Unit P7.6.
- **Verify**:
  - `bunx biome check src/lib/relay/slashTarget.ts src/lib/relay/slashCommands.ts`

### ☐ P7.4 Grouped slash menu
- **Kind**: implementation
- **Traces**: RP-217
- **Files** (3): `src/components/relay/SlashMenu.tsx`; `src/components/relay/SlashMenu.spec.tsx`; `src/lib/relay/constants.ts`
- **Depends on**: P7.2
- **Do**: Render the menu as grouped sections in `SLASH_GROUP_ORDER` (`relay-slash-group` per heading), each row with icon, `/name` and the translated description; filtering by typed name or description; groups with no matches are hidden; keyboard unchanged (focus stays in the textarea, Up/Down/Enter/Tab/Esc, `aria-activedescendant`); max height from a named constant with internal scroll. Update the existing spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (group headings, icon column, description truncation, active/hover states, density for 15 rows at 320px, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p7-slash-*.png`.
- **Acceptance**:
  - `/` lists 15 commands in six groups in order; `/ru` shows only `/run`; no horizontal scroll at 320px (RP-217); in-browser proof by E2E P7.10 `[REL-POL-SLASH-01]`, `[REL-POL-SLASH-02]`, `[REL-POL-SLASH-08]`.
- **Verify**:
  - `bunx biome check src/components/relay/SlashMenu.tsx src/components/relay/SlashMenu.spec.tsx src/lib/relay/constants.ts`
  - `bunx vitest run src/components/relay/SlashMenu.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p7-slash-*.png 2>/dev/null)"`

### ☐ P7.5 Run slash commands; no blind target-less sends
- **Kind**: implementation
- **Traces**: RP-204, RP-217
- **Files** (5): `src/hooks/useSlashCommandRunner.ts` (new); `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/MentionMenu.tsx`; `src/components/relay/SlashMenu.tsx`
- **Depends on**: P7.3, P7.4
- **Do**: `useSlashCommandRunner` is the single place a command is executed (the launcher in P8 reuses it, so no duplication): `/clear` keeps today's confirm when the thread is non-empty; otherwise `resolveSlashTarget`; when satisfied it fills the composer with `t(promptKey)` (with attached names); when not, it keeps the slash text in the draft, opens `MentionMenu` with `kind = needKind`, `hint = t(slash.hint.<kind>)` and `pinCurrentTab`, and selecting an item attaches it and leaves the command text ready to send (nothing is sent automatically). `MentionMenu` renders the hint line. `/import` and `/clear` never open the menu. Update the existing spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (hint line styling and placement in the menu, what the draft looks like after attaching, focus return to the textarea, no layout jump). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p7-target-*.png`.
- **Acceptance**:
  - `/run` with nothing attached opens the mention menu with "Pick a request to run" and Current tab pinned; picking Current tab attaches a pill and leaves `/run` ready; nothing is sent; `/clear` still confirms on a non-empty thread (RP-204); proven in a browser by E2E P7.10 `[REL-POL-SLASH-03]`, `[REL-POL-SLASH-04]`, `[REL-POL-SLASH-05]`, `[REL-POL-SLASH-06]`.
- **Verify**:
  - `bunx biome check src/hooks/useSlashCommandRunner.ts src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/MentionMenu.tsx src/components/relay/SlashMenu.tsx`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p7-target-*.png 2>/dev/null)"`

### ☐ P7.6 Unit: slash logic
- **Kind**: unit
- **Traces**: RP-219, RP-204, RP-217
- **Files** (2): `src/lib/relay/slashCommands.ts`; `src/lib/relay/slashTarget.ts`
- **Depends on**: P7.5
- **Do**: unit-test-engineer extends `slashCommands.spec.ts` and writes `slashTarget.spec.ts` (new). Cases: command list integrity (15, unique ids, every id has a description and, except `clear`, a prompt in en, fr and ja by loading the message files), `findSlashQuery` semantics unchanged, filtering over name and description, group order, target metadata for each command, `resolveSlashTarget` for every (command, attached set) combination including empty, wrong kind, tab for request, request for chain. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Meets RP-219 exactly; unit task acceptance from Conventions holds for both files.
- **Verify**:
  - `bunx vitest run src/lib/relay/slashCommands.spec.ts src/lib/relay/slashTarget.spec.ts --coverage --coverage.include=src/lib/relay/slashCommands.ts --coverage.include=src/lib/relay/slashTarget.ts --coverage.reporter=text`

### ☐ P7.7 Unit: slash runner and menu
- **Kind**: unit
- **Traces**: RP-204, RP-217
- **Files** (3): `src/hooks/useSlashCommandRunner.ts`; `src/components/relay/SlashMenu.tsx`; `src/components/relay/MentionMenu.tsx`
- **Depends on**: P7.6
- **Do**: unit-test-engineer writes `useSlashCommandRunner.spec.ts` (new) and extends `SlashMenu.spec.tsx`, `MentionMenu.spec.tsx` (happy-dom header). Cases: satisfied command fills the prompt; unsatisfied opens the menu with the kind and hint and sends nothing; `/clear` confirm only when the thread is non-empty; `/import` and `/clear` never open the menu; grouped rendering order and hidden empty groups; hint line rendering. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-204 and RP-217 at unit level; unit task acceptance from Conventions holds for all three files.
- **Verify**:
  - `bunx vitest run src/hooks/useSlashCommandRunner.spec.ts src/components/relay/SlashMenu.spec.tsx src/components/relay/MentionMenu.spec.tsx --coverage --coverage.include=src/hooks/useSlashCommandRunner.ts --coverage.include=src/components/relay/SlashMenu.tsx --coverage.include=src/components/relay/MentionMenu.tsx --coverage.reporter=text`

### ☐ P7.8 E2E: migrate slash-dependent layout and tests specs
- **Kind**: e2e
- **Traces**: RP-217
- **Files** (4): `e2e/qa/relay/relay-improvements-layout.spec.ts`; `e2e/scenarios/relay/relay-improvements-layout.feature.md`; `e2e/qa/relay/relay-improvements-smart-tests.spec.ts`; `e2e/scenarios/relay/relay-improvements-smart-tests.feature.md`
- **Depends on**: P7.7
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: slash-menu assertions follow the grouped menu (five old commands now sit inside six groups); `/assert` flows unchanged in behavior; `/assert` now has `requiresTarget: request`, so scenarios that run it with nothing attached attach a request or Current tab first.
- **Do**: Edit only what breaks (grep both specs for slash text first); list changes in the Log.
- **Acceptance**:
  - Both specs pass against the grouped menu and target handling.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P7.9 E2E: migrate keyboard and picker specs for slash
- **Kind**: e2e
- **Traces**: RP-217, RP-204
- **Files** (4): `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`; `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md`; `e2e/qa/relay/relay-improvements-picker.spec.ts`; `e2e/scenarios/relay/relay-improvements-picker.feature.md`
- **Depends on**: P7.8
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: slash keyboard scenarios follow the grouped menu; `/clear` confirm scenarios in the picker spec keep working (the command is unchanged).
- **Do**: Edit only what breaks. Also grep `relay-improvements-qol-rewrite` and `relay-improvements-smart-{diff,export,import}` for slash text; if any asserts the old five-command menu, migrate it in this task and add its two files to the Log (otherwise record "no slash assertions").
- **Acceptance**:
  - Both specs pass; no spec in `e2e/qa/relay` asserts the old flat slash list.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P7.10 E2E: slash actions
- **Kind**: e2e
- **Traces**: RP-204, RP-217, RP-218
- **Files** (0): none (no app change)
- **Depends on**: P7.7, P7.9
- **Gherkin**: `e2e/scenarios/relay/relay-polish-slash.feature.md`: REL-POL-SLASH-01..10
- **Spec**: `e2e/qa/relay/relay-polish-slash.spec.ts`
- **Scenarios**:
  - `[REL-POL-SLASH-01] typing / lists 15 commands in the six groups Understand, Build, Test, Run, Share, Chat in order` @critical
  - `[REL-POL-SLASH-02] typing /ru shows only /run; typing a word from a description also filters` @high
  - `[REL-POL-SLASH-03] /run with nothing attached opens the mention menu with the hint "Pick a request to run" and Current tab pinned` @critical
  - `[REL-POL-SLASH-04] picking Current tab attaches a pill, leaves /run ready, and sends nothing` @critical
  - `[REL-POL-SLASH-05] /run with a request already attached fills the prompt without opening the menu` @high
  - `[REL-POL-SLASH-06] /clear and /import never open the mention menu` @high
  - `[REL-POL-SLASH-07] /clear on a non-empty chat shows the confirm and clearing resets the thread` @high
  - `[REL-POL-SLASH-08] the grouped menu has no horizontal scroll at 320px and keyboard navigation keeps focus in the textarea` @high
  - `[REL-POL-SLASH-09] selecting /new fills the prompt from promptKey and a scripted ask_user reply asks which collection` @medium
  - `[REL-POL-SLASH-10] slash descriptions and prompts render in fr and ja` @medium
- **Do**: Scripted `ask_user` stream from `relayRoutes.ts`; 04 asserts no `/api/relay/chat` request was made via `page.route` counter.
- **Acceptance**:
  - Covers RP-204, RP-217 and RP-218 ACs.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-slash.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P7.11 Checkpoint 7
- **Kind**: gate
- **Traces**: RP-204, RP-217, RP-218, RP-219
- **Files** (0): none (verification only)
- **Depends on**: P7.1, P7.2, P7.3, P7.4, P7.5, P7.6, P7.7, P7.8, P7.9, P7.10
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - 15 grouped commands, target handling and prompts behave per the RP ACs; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`

🔶 **Checkpoint 7**: 15 grouped slash commands with target-aware behavior shipped; slash-dependent specs migrated and green.

---

## Phase 8: The `+` launcher; picker UI removed

**Adds:** The `+` button opens a wide Cursor-style launcher with a search box and four kinds of rows: your recent attachments, things to attach (Current tab, Request, Collection, Environment, Chain, Paste cURL) and quick actions. The old narrow tabbed picker is gone.

**Try in UI:** Click `+` and see a box-wide panel with Recent, Attach and Actions ; Type `run` and see matching rows from every section ; Choose Request and see a request search list in place ; Choose Current tab and see a pill appear and the panel close ; Press Esc and see focus return to `+` ; Open it at 320px and confirm nothing is clipped

### ☐ P8.1 Launcher strings
- **Kind**: implementation
- **Traces**: RP-214, RP-215, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: Checkpoint 7
- **Do**: Add `launcher.{placeholder,empty,listLabel}` (placeholder exactly "Search actions, context, chats..."), `launcher.section.{recent,attach,actions}`, `launcher.attach.{currentTab,request,collection,environment,chain,pasteCurl}` each with a `.description`, in all three locales with identical key sets. Do not add the Settings section keys (P9 and P10 own them).
- **Design**: n/a, strings only; design gate on P8.3.
- **Acceptance**:
  - New keys exist in en, fr, ja; the en placeholder equals the SPEC string (RP-214, RP-215).
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ☐ P8.2 Launcher section model
- **Kind**: implementation
- **Traces**: RP-215, RP-202
- **Files** (2): `src/lib/relay/launcherItems.ts` (new); `src/lib/relay/constants.ts`
- **Depends on**: P8.1
- **Do**: Add `LAUNCHER_ACTION_IDS` (the top slash commands shown: `explain, run, fix, new, tests, import`) and launcher size constants. `buildLauncherSections({ recents, attachedKeys, hasTab, slashCommands })` is pure and returns, in this order, `recent` (from the recents store, cap `RELAY_RECENTS_CAP`, excluding already attached items), `attach` (Current tab disabled when `hasTab` is false, Request, Collection, Environment, Chain, Paste cURL), `actions` (the `LAUNCHER_ACTION_IDS` commands with the same metadata as the slash menu). Empty sections are omitted. Each row has a stable `value` string for cmdk filtering that includes name and description.
- **Design**: n/a, logic only; design gate on P8.3.
- **Acceptance**:
  - Section order is recent, attach, actions; Current tab is disabled with no tab; attached recents are excluded; empty recents omit the section (RP-215). Coverage by Unit P8.7.
- **Verify**:
  - `bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/constants.ts`

### ☐ P8.3 RelayLauncher panel
- **Kind**: implementation
- **Traces**: RP-214, RP-215
- **Files** (3): `src/components/relay/RelayLauncher.tsx` (new); `src/components/relay/RelayPickerRow.tsx`; `src/components/ui/command.tsx`
- **Depends on**: P8.2
- **Do**: Build `RelayLauncher` on `Command` (cmdk), `relay-launcher`: box-wide floating panel above the composer box (not the 320px popover), search input `relay-launcher-search` with the placeholder key, section headings, rows `relay-launcher-row` with icon, name, muted description and a right chevron on rows that open a sub-list, type-to-filter across all sections, Up/Down/Enter, Esc closes and returns focus to `+`, "No results" row. Reads in-app stores only (zero network). Change `ui/command.tsx` only if a needed prop is missing and without altering other consumers.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (Cursor reference: search at the top, sections, row anatomy, chevrons, hover/active/disabled/empty states, elevation, light + dark, widths 320/400/480 without clipping). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p8-launcher-*.png`.
- **Acceptance**:
  - The panel renders the three sections in order, filters across them, shows "No results" for no match and closes on Esc with focus on `+` (RP-214); in-browser proof by E2E P8.10 `[REL-POL-LAUNCHER-01]`, `[REL-POL-LAUNCHER-02]`, `[REL-POL-LAUNCHER-05]`, `[REL-POL-LAUNCHER-06]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayLauncher.tsx src/components/relay/RelayPickerRow.tsx src/components/ui/command.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p8-launcher-*.png 2>/dev/null)"`

### ☐ P8.4 Launcher actions: attach in place, cURL, slash
- **Kind**: implementation
- **Traces**: RP-215, RP-202, RP-204
- **Files** (4): `src/components/relay/RelayLauncher.tsx`; `src/components/relay/MentionMenu.tsx`; `src/hooks/useSlashCommandRunner.ts`; `src/stores/useRelayRecentStore.ts`
- **Depends on**: P8.3
- **Do**: Request, Collection, Environment and Chain rows open `MentionMenu` pre-filtered by `kind` in place inside the launcher (Enter shows the list; Esc steps back one level, then closes). Current tab attaches a `tab` chip and closes. Paste cURL prefills `/import ` in the draft, closes and focuses the composer (Q8: cURL only). Action rows run through the shared `useSlashCommandRunner` (target-requiring ones follow RP-204). Selecting any attach row calls `recordRecent`; selecting a Recent row re-attaches it.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (in-place sub-list transition, back affordance, focus handoff between search and sub-list, selection feedback). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p8-attach-*.png`.
- **Acceptance**:
  - Request opens a request list; Current tab attaches a pill and closes; Paste cURL puts `/import ` in the composer; an action row behaves like the slash command (RP-215, RP-202 part c); proven by E2E P8.10 `[REL-POL-LAUNCHER-03]`, `[REL-POL-LAUNCHER-04]`, `[REL-POL-LAUNCHER-07]`, `[REL-POL-LAUNCHER-08]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayLauncher.tsx src/components/relay/MentionMenu.tsx src/hooks/useSlashCommandRunner.ts src/stores/useRelayRecentStore.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p8-attach-*.png 2>/dev/null)"`

### ☐ P8.5 Swap `+` to the launcher; delete the picker UI
- **Kind**: implementation
- **Traces**: RP-216, RP-202
- **Files** (5): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/RelayPicker.tsx` (delete); `src/components/relay/RelayPicker.spec.tsx` (delete); `src/hooks/useRelayPickerItems.ts`
- **Depends on**: P8.4
- **Do**: `+` (`relay-picker-trigger`, id kept) now opens `RelayLauncher`. Delete `RelayPicker.tsx` and its spec (this removes the kind tabs, the popover and the temporary Current tab row from P5.8). Keep `useRelayPickerItems` and `RelayPickerRow`; drop any kind-tab-only exports from the hook. Update `RelayComposer.spec.tsx`.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (trigger active state while open, anchor alignment with the box, close-on-select behavior, no leftover popover chrome). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p8-swap-*.png`.
- **Acceptance**:
  - `RelayPicker.tsx` and its spec do not exist; no `relay-picker-kind-` or `relay-picker-list` reference remains under `src`; `+` opens the launcher (RP-216).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.spec.ts`
  - `test ! -e src/components/relay/RelayPicker.tsx -a ! -e src/components/relay/RelayPicker.spec.tsx`
  - `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-|relay-picker-list|relay-picker-search' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p8-swap-*.png 2>/dev/null)"`

### ☐ P8.6 Remove picker strings
- **Kind**: implementation
- **Traces**: RP-216, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P8.5
- **Do**: Remove the picker keys that nothing uses any more (kind-tab labels, popover title, the temporary Current tab row strings from P5.6 `picker.currentTab.*`), found by grepping each candidate key against `src` first; keep any key the mention menu or launcher still reads. Remove from all three locales.
- **Design**: n/a, strings only.
- **Acceptance**:
  - No removed key is referenced under `src`; parity specs stay green.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rn 'picker.currentTab' src messages)"`  (expect exit 0)

### ☐ P8.7 Unit: launcher logic
- **Kind**: unit
- **Traces**: RP-215
- **Files** (3): `src/lib/relay/launcherItems.ts`; `src/stores/useRelayRecentStore.ts`; `src/hooks/useRelayPickerItems.ts`
- **Depends on**: P8.5
- **Do**: unit-test-engineer writes `launcherItems.spec.ts` (new) and extends `useRelayRecentStore.spec.ts`, `useRelayPickerItems.spec.ts`. Cases: section order; omitted empty sections; attached items excluded from Recent; Current tab disabled; action rows carry slash metadata; stable cmdk `value`; recents re-attach and move-to-front on use; recents never persist values or bodies. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers the RP-215 ACs; unit task acceptance from Conventions holds for all three files.
- **Verify**:
  - `bunx vitest run src/lib/relay/launcherItems.spec.ts src/stores/useRelayRecentStore.spec.ts src/hooks/useRelayPickerItems.spec.ts --coverage --coverage.include=src/lib/relay/launcherItems.ts --coverage.include=src/stores/useRelayRecentStore.ts --coverage.include=src/hooks/useRelayPickerItems.ts --coverage.reporter=text`

### ☐ P8.8 Unit: launcher component
- **Kind**: unit
- **Traces**: RP-214, RP-215, RP-216
- **Files** (3): `src/components/relay/RelayLauncher.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayPickerRow.tsx`
- **Depends on**: P8.7
- **Do**: unit-test-engineer writes `RelayLauncher.spec.tsx` (new, happy-dom header) and extends `RelayComposer.spec.tsx`. Cases: sections in order; filtering across sections; no-results row; Enter on Request shows the request list; Current tab attaches and closes; Paste cURL prefills `/import ` and focuses the composer; Esc steps back then closes and returns focus to `+`; actions use the slash runner; zero `fetch` calls (spy); `+` opens the launcher not a popover. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-214, RP-215, RP-216 at unit level; unit task acceptance from Conventions holds for all three files.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx --coverage --coverage.include=src/components/relay/RelayLauncher.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/RelayPickerRow.tsx --coverage.reporter=text`

### ☐ P8.9 E2E: migrate picker and keyboard specs
- **Kind**: e2e
- **Traces**: RP-216, RP-214
- **Files** (4): `e2e/qa/relay/relay-improvements-picker.spec.ts`; `e2e/scenarios/relay/relay-improvements-picker.feature.md`; `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`; `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`
- **Depends on**: P8.8
- **Gherkin**: edits `relay-improvements-picker.feature.md`; no new ids
- **Spec**: the three specs above
- **Scenarios**: kind-tab, popover and `relay-picker-search`/`-list` scenarios are rewritten for the launcher or removed with their ids recorded in the Log; `relay-picker-trigger` assertions in keyboard and layout specs now open the launcher (focus order and 320px non-clipping preserved).
- **Do**: Edit only what breaks; keep ids unique.
- **Acceptance**:
  - The three specs pass and none references the removed picker test ids.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P8.10 E2E: launcher
- **Kind**: e2e
- **Traces**: RP-214, RP-215, RP-216, RP-202
- **Files** (2): `e2e/qa/relay/relay-polish-ctx.spec.ts`; `e2e/scenarios/relay/relay-polish-ctx.feature.md` (migrated: the picker row they used is deleted in P8.5); no app change
- **Depends on**: P8.8, P8.9
- **Gherkin**: `e2e/scenarios/relay/relay-polish-launcher.feature.md`: REL-POL-LAUNCHER-01..10
- **Spec**: `e2e/qa/relay/relay-polish-launcher.spec.ts`
- **Scenarios**:
  - `[REL-POL-LAUNCHER-01] clicking + opens a box-wide panel above the composer with Recent, Attach and Actions in that relative order (later phases append Settings after Actions, so the assertion is relative, not an exact section count)` @critical
  - `[REL-POL-LAUNCHER-02] typing "run" filters to matching rows across sections` @critical
  - `[REL-POL-LAUNCHER-03] Enter on Request shows a request search list; selecting one attaches a pill` @critical
  - `[REL-POL-LAUNCHER-04] Current tab attaches a pill and closes the panel` @critical
  - `[REL-POL-LAUNCHER-05] Esc closes the panel and focus returns to +` @high
  - `[REL-POL-LAUNCHER-06] a search with no match shows "No results"` @high (empty)
  - `[REL-POL-LAUNCHER-07] Paste cURL puts "/import " in the composer and focuses it` @high
  - `[REL-POL-LAUNCHER-08] an attached item appears under Recent after a reload and re-attaches on select` @high (persistence)
  - `[REL-POL-LAUNCHER-09] at the 320px panel width nothing is clipped and there is no horizontal scroll` @high
  - `[REL-POL-LAUNCHER-10] opening, typing and selecting produce zero /api/relay/* or other-host requests` @critical
- **Do**: Reuse the zero-network collector pattern from `relay-polish-mention.spec.ts` (copy the pattern, not the file). Migrate `relay-polish-ctx` (P5.14): `[REL-POL-CTX-03]` and `[REL-POL-CTX-04]` now reach Current tab through the launcher's Attach section instead of the deleted picker row; ids and intent stay, only the steps and locators change; list the changes in the Log.
- **Acceptance**:
  - Covers RP-214, RP-215 (Recent, Attach, Actions), RP-216 and RP-202 part c.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
  - `relay-polish-ctx` passes against the launcher with no picker locator left in it.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`
  - `test -z "$(grep -nE 'relay-picker' e2e/qa/relay/relay-polish-ctx.spec.ts)"`  (expect exit 0)
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P8.11 Checkpoint 8
- **Kind**: gate
- **Traces**: RP-202, RP-214, RP-215, RP-216
- **Files** (0): none (verification only)
- **Depends on**: P8.1, P8.2, P8.3, P8.4, P8.5, P8.6, P8.7, P8.8, P8.9, P8.10
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - The launcher replaces the picker UI; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=2`  (includes the earlier polish specs this phase's `+` swap touches)
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rnE 'RelayPicker\b|relay-picker-kind-' src e2e)"`  (expect exit 0)

🔶 **Checkpoint 8**: the `+` launcher (Recent, Attach, Actions) shipped, the tabbed picker UI deleted, picker specs migrated and green.

---

## Phase 9: Permission modes and the approval shield

**Adds:** A shield button right after `+` lets you choose how much approval Relay needs: Always ask, Review for me (default, today's behavior) or Skip all approvals (warning color, with an "Approvals are off" notice). Settings > Relay has the same control, and the launcher gets a Settings section with a "Permission mode" row.

**Try in UI:** Hover the shield and see "Approval mode: Review for me" ; Open it and see three radio rows with Review for me selected ; Pick Skip all approvals and see the shield turn warning-colored and "Approvals are off" appear ; Ask Relay to create a collection and see it run with an Undo and no confirm card ; Switch to Always ask and repeat to see an Approve card ; Open Settings > Relay and confirm the Approval mode select shows the same choice

### ☐ P9.1 Permission strings (shared with Settings)
- **Kind**: implementation
- **Traces**: RP-222, RP-223, RP-103, RP-213
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: Checkpoint 8
- **Do**: Add under `permission.*` in the eager `relay.json` (read by both the dock and Settings): `title` ("How should Relay ask for approval?"), `settingsLabel` ("Approval mode"), `triggerTooltip` ("Approval mode: {name}"), `groupLabel`, `option.{always-ask,review,skip}.{label,description}` with the exact SPEC copy ("Every change waits for your Approve." / "Relay asks before deleting, sending or running things, and before large bulk edits." / "Relay changes things without asking. You can still Undo any change."), `badge.recommended` ("Recommended"), `badge.caution` ("Use with caution"), `skipNotice` ("Approvals are off"). Identical key sets in en, fr, ja; `{name}` preserved. No vendor names.
- **Design**: n/a, strings only; design gates on P9.8, P9.9 and P9.10.
- **Acceptance**:
  - Keys exist in all three locales; en copy equals the SPEC strings character for character (RP-222).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`

### ☐ P9.2 Confirm-change and launcher Settings strings
- **Kind**: implementation
- **Traces**: RP-221, RP-215, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P9.1
- **Do**: Add `confirm.change.{title,description,approve,decline}` (generic "Relay wants to make a change" card for auto tools gated by Always ask; `{count}` and `{targets}` placeholders), `launcher.section.settings`, `launcher.settings.permission` (+ `.description`), and `composer.shield.{valueLabel}` if the launcher row shows the current mode. Identical key sets in all three locales.
- **Design**: n/a, strings only; design gate on P9.6 and P9.11.
- **Acceptance**:
  - Keys exist in all three locales with preserved placeholders; no key from P8.6 is reintroduced.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ☐ P9.3 Permission constants and store
- **Kind**: implementation
- **Traces**: RP-220
- **Files** (3): `src/lib/relay/permission.ts` (new); `src/stores/useRelayPermissionStore.ts` (new); `src/lib/relay/constants.ts`
- **Depends on**: P9.1
- **Do**: `permission.ts` is server-safe (no store, DOM or React imports): `RELAY_PERMISSION_MODES = ["always-ask","review","skip"] as const`, `type RelayPermissionMode`, `RELAY_DEFAULT_PERMISSION_MODE = "review"`, `isRelayPermissionMode(value)` type guard, and per-mode option metadata (`label`/`description` i18n keys, icon name, `tone: "default" | "recommended" | "caution"`) shared by the shield, Settings and the launcher. `constants.ts` adds `RELAY_STORAGE_KEYS.permission = "rq_relay_permission_mode"`. `useRelayPermissionStore` holds `mode`, `setMode(mode)` (no-op when unchanged or invalid), `hydrate()` reading `localStorage` through the guard (corrupt or unknown value falls back to `review`, with a contextual log, never a silent catch). Global, not per thread.
- **Design**: n/a, logic only; design gates on P9.8 to P9.10.
- **Acceptance**:
  - Default mode is `review`; an unknown stored value falls back to `review`; `setMode` persists the mode under `rq_relay_permission_mode` (RP-220). Coverage by Unit P9.13.
- **Verify**:
  - `bunx biome check src/lib/relay/permission.ts src/stores/useRelayPermissionStore.ts src/lib/relay/constants.ts`
  - `bunx vitest run src/lib/relay/constants.spec.ts`

### ☐ P9.4 `approvalNeeded` and mode-aware `awaitsUser`
- **Kind**: implementation
- **Traces**: RP-221
- **Files** (2): `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/schemas.spec.ts`
- **Depends on**: P9.3
- **Do**: In `schemas.ts` (still no store/DOM imports; the server imports it) add `NAVIGATION_TOOLS = ["open_item","close_tab","close_all_tabs"] as const satisfies readonly RelayToolName[]` and the pure `approvalNeeded(name, input, mode = RELAY_DEFAULT_PERMISSION_MODE)` per the RP-221 table (read/ui never; confirm true except `skip`; auto in `NAVIGATION_TOOLS` never; other auto: `always-ask` true, `review` only when `requiresBulkApproval`, `skip` false). Change `awaitsUser(name, input, mode = default)` to `ask_user || approvalNeeded(...) || confirm gate`; the default parameter keeps every existing caller and the server behaving as today. The registered dirty-tab confirm gate stays independent of the mode. Add a classification test: every `auto` tool is in `NAVIGATION_TOOLS` or returns true under `always-ask`. Update `schemas.spec.ts` for the new signature.
- **Design**: n/a, logic only.
- **Acceptance**:
  - `approvalNeeded` matches the RP-221 table for {read, ui, auto small, auto bulk 11, confirm, navigation} x {always-ask, review, skip}; `awaitsUser(name, input)` with no mode equals the pre-change results for every tool (RP-221). Coverage by Unit P9.13.
- **Verify**:
  - `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts`
  - `test -z "$(grep -nE 'from "(@/stores|react)' src/lib/relay/tools/schemas.ts)"`  (expect exit 0: schemas stays server-safe)

### ☐ P9.5 Registry honors the mode; generic change preview
- **Kind**: implementation
- **Traces**: RP-221
- **Files** (5): `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/describeGeneric.ts` (new); `src/lib/relay/tools/registry.spec.ts`; `src/lib/relay/tools/gating.spec.ts`; `src/lib/relay/tools/hardening.spec.ts`
- **Depends on**: P9.4
- **Do**: Extend `ConfirmAction` (registry.ts line 68) with `"change"`. `ToolContext` gains `permissionMode?: RelayPermissionMode` (default review). In `executeTool`/`runValidated`: `needsApproval = approvalNeeded(name, parsed.data, context.permissionMode)`; when `needsApproval` and the mode is not `skip`, require `isGranted(context.approval)` else `APPROVAL_REQUIRED`; in `skip` the explicit mode choice replaces the token, `grantApproval()` is still only minted on the Approve path and a hand-built object is still rejected. The mode is never part of tool input. `describeGeneric(tool, input, store)` returns `{ action: "change", severity: "caution", targets, count }` with target names resolved from the tool's `refs(input)` against live store state (fallback: the step label from `stepLabels.ts`), never from model text; `previewConfirmation` uses it for gated auto tools without a `describe`. Update the three existing specs.
- **Design**: n/a, logic only; the card is designed in P9.6.
- **Acceptance**:
  - With `skip`, `delete_request` runs without a token; with `review` it returns `APPROVAL_REQUIRED`; an auto tool under `always-ask` without a token returns `APPROVAL_REQUIRED` and with a granted token runs; forged tokens are rejected in every mode; `describeGeneric` names come from live store data (RP-221). Coverage by Unit P9.13.
- **Verify**:
  - `bunx biome check src/lib/relay/tools/registry.ts src/lib/relay/tools/describeGeneric.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/hardening.spec.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/hardening.spec.ts src/lib/relay/tools/schemas.spec.ts`

### ☐ P9.6 Chat hook and ConfirmCard use the mode
- **Kind**: implementation
- **Traces**: RP-221
- **Files** (5): `src/hooks/useRelayChat.ts`; `src/hooks/useRelayChat.spec.ts`; `src/components/relay/ConfirmCard.tsx`; `src/components/relay/ConfirmCard.spec.tsx`; `src/components/relay/RelayConversation.tsx`
- **Depends on**: P9.5, P9.2
- **Do**: In `useRelayChat`, read the mode from `useRelayPermissionStore.getState()` inside `onToolCall` (line ~340) and pass it to `awaitsUser` and into `ToolContext`. Record the decision per `toolCallId` in an awaiting-ids set; `pendingToolCalls` (in `useRelayChat.ts`) and `promptCard` (in `RelayConversation.tsx`, which calls `awaitsUser` at line ~139 today) use that record instead of re-evaluating, so flipping the mode while a card is pending neither orphans the card nor auto-approves it; old persisted threads with pending cards still render (no IDB change). `ConfirmCard` renders the `"change"` action with the `confirm.change.*` keys (title, targets list, count, Approve/Decline). Update both existing specs. The task is at the 5-file cap: if the `promptCard` change forces an edit to `RelayConversation.spec.tsx`, do not add it here; stop and report so the orchestrator splits that spec edit into P9.14 (Unit: chat hook, cards and shield), which owns new coverage for these files.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (the generic "Relay wants to make a change" variant must read like the existing delete/send/run cards: severity, target list truncation, count, button hierarchy, 320px wrapping, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p9-confirm-*.png`.
- **Acceptance**:
  - A call recorded as awaiting stays awaiting after the mode changes, and a call recorded as running is not re-prompted; the change card shows resolved names and a count (RP-221); proven in a browser by E2E P9.17 `[REL-POL-PERM-01]`, `[REL-POL-PERM-09]`.
- **Verify**:
  - `bunx biome check src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.tsx src/components/relay/ConfirmCard.spec.tsx src/components/relay/RelayConversation.tsx`
  - `bunx vitest run src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.spec.tsx src/components/relay/RelayConversation.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p9-confirm-*.png 2>/dev/null)"`

### ☐ P9.7 Warning color token
- **Kind**: implementation
- **Traces**: RP-222
- **Files** (1): `src/app/globals.css`
- **Depends on**: P9.1
- **Do**: There is no `--warning` token. Add `--warning` and `--warning-foreground` to `:root` and `.dark` following the existing token pattern (OKLCH or the file's format), expose them in the Tailwind theme mapping so `text-warning`, `bg-warning/10` and `border-warning` work, and pick values with at least 4.5:1 text contrast on the card and popover backgrounds in light and dark.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (hue distinct from `destructive`, contrast in light and dark, usage on the shield glyph, the notice and the Skip option row). Log the one-line design note; the token is verified visually in P9.8 screenshots.
- **Acceptance**:
  - `--warning` and `--warning-foreground` exist for light and dark and are reachable as Tailwind colors; no hard-coded color is introduced elsewhere.
- **Verify**:
  - `grep -c "\-\-warning" src/app/globals.css`  (expect >= 4)
  - `bun run lint:check`

### ☐ P9.8 PermissionShield trigger and popover
- **Kind**: implementation
- **Traces**: RP-222, RP-103
- **Files** (4): `src/components/relay/PermissionShield.tsx` (new); `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`; `src/lib/relay/permission.ts`
- **Depends on**: P9.3, P9.7
- **Do**: `PermissionShield` renders a shield icon button (`relay-permission-trigger`, tooltip "Approval mode: <name>" on hover and focus, `aria-label` the same, `data-mode`, glyph and color per mode, `text-warning` for skip) and a `Popover` titled with `permission.title` containing a hand-built `role="radiogroup"` (no new dependency, no radix radio): three rows `relay-permission-option-<mode>` with `role="radio"`, `aria-checked`, roving tabindex, Arrow keys move and select focus, Space/Enter choose, Home/End. Choosing closes the popover and returns focus to the trigger; Esc closes with the same focus return. Skip row uses the warning tone and the "Use with caution" label; Review shows "Recommended". Open state is a transient `permissionPopoverOpen` flag in `useRelayStore` (never persisted; the launcher and the capabilities link open it from elsewhere). Update the store spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (radio row anatomy, selected state, warning tone, popover width and anchoring above the composer, keyboard focus ring, per-mode glyph, light + dark, 320/400/480). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p9-shield-*.png`.
- **Acceptance**:
  - Opening shows three rows with the current one selected; choosing updates the glyph and `data-mode`, closes the popover and focuses the trigger; Esc closes; `rq_relay_permission_mode` survives reload (RP-222); in-browser proof by E2E P9.18 `[REL-POL-SHIELD-01]`, `[REL-POL-SHIELD-02]`, `[REL-POL-SHIELD-03]`, `[REL-POL-SHIELD-04]`, `[REL-POL-SHIELD-06]`.
- **Verify**:
  - `bunx biome check src/components/relay/PermissionShield.tsx src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/lib/relay/permission.ts`
  - `bunx vitest run src/stores/useRelayStore.spec.ts`
  - `test -n "$(ls agent_docs/qa/relay-polish/p9-shield-*.png 2>/dev/null)"`

### ☐ P9.9 Mount the shield after `+`; skip notice
- **Kind**: implementation
- **Traces**: RP-222, RP-208
- **Files** (3): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/PermissionShield.tsx`
- **Depends on**: P9.8, P9.6
- **Do**: Insert `PermissionShield` immediately after `+` in the toolbar. Tab order becomes textarea, `+`, shield, pill remove buttons, mic, send. In `skip` mode render a persistent one-line notice `relay-permission-notice` ("Approvals are off", `role="status"`, warning tone) directly under the toolbar inside the box; it is absent in the other modes and never overlaps the pills. Update the composer spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (shield spacing next to `+`, notice placement and height without layout jump, narrow-width wrapping, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p9-composer-*.png`.
- **Acceptance**:
  - The shield is the next control after `+`; the notice appears only in skip mode (RP-222); layout and tab-order proof in a browser by E2E P9.18 `[REL-POL-SHIELD-01]`, `[REL-POL-SHIELD-05]`, `[REL-POL-SHIELD-09]`.
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/PermissionShield.tsx`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p9-composer-*.png 2>/dev/null)"`

### ☐ P9.10 Settings approval control
- **Kind**: implementation
- **Traces**: RP-223
- **Files** (2): `src/components/settings/RelaySection.tsx`; `src/components/settings/RelaySection.spec.tsx`
- **Depends on**: P9.3, P9.1
- **Do**: Add an "Approval mode" row (`relay-permission-select`, shadcn `Select`) beside the existing position control, bound to `useRelayPermissionStore`, listing the same three options with the same label and description copy (helper text under the select shows the selected mode's description; Skip shows the caution label). No second source of state. Update the spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (row consistency with the position select, option description in the dropdown, skip warning tone, light + dark, narrow settings width). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p9-settings-*.png`.
- **Acceptance**:
  - The select reflects and changes the store value (RP-223); cross-surface agreement is proven by E2E P9.18 `[REL-POL-SHIELD-07]`.
- **Verify**:
  - `bunx biome check src/components/settings/RelaySection.tsx src/components/settings/RelaySection.spec.tsx`
  - `bunx vitest run src/components/settings/RelaySection.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p9-settings-*.png 2>/dev/null)"`

### ☐ P9.11 Launcher Settings section: Permission mode row
- **Kind**: implementation
- **Traces**: RP-215, RP-222
- **Files** (5): `src/lib/relay/launcherItems.ts`; `src/lib/relay/launcherItems.spec.ts`; `src/components/relay/RelayLauncher.tsx`; `src/components/relay/RelayLauncher.spec.tsx`; `src/components/relay/RelayComposer.tsx`
- **Depends on**: P9.9
- **Do**: `buildLauncherSections` gains a fourth `settings` section after `actions` with a "Permission mode" row showing the current mode label as muted value text. Selecting it closes the launcher and sets `permissionPopoverOpen` so the shield popover opens with focus inside (the composer passes the open handler; no duplicate popover is built). The "What Relay can do" row is added in P10.8, not here. Update both existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (row value alignment, section heading, hand-off from launcher to popover without focus loss, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p9-launcher-*.png`.
- **Acceptance**:
  - The launcher lists Settings last with a Permission mode row showing the current mode; selecting it opens the shield popover (RP-215, RP-222); in-browser proof by E2E P9.18 `[REL-POL-SHIELD-08]`.
- **Verify**:
  - `bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.tsx src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.tsx`
  - `bunx vitest run src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p9-launcher-*.png 2>/dev/null)"`

### ☐ P9.12 Mode-change telemetry
- **Kind**: implementation
- **Traces**: RP-225
- **Files** (3): `src/lib/relay/telemetry.ts`; `src/lib/relay/telemetry.spec.ts`; `src/stores/useRelayPermissionStore.ts`
- **Depends on**: P9.3
- **Do**: Add `relay_permission_mode_changed: { from: RelayPermissionMode; to: RelayPermissionMode }` to `RelayEventMap` (no workspace data; Q6 resolved to include). `setMode` emits it once per real change through the existing `trackRelayEvent` helper and never when the value is unchanged or invalid. Update the telemetry spec.
- **Design**: n/a, logic only.
- **Acceptance**:
  - One event with exactly `{from,to}` per change; none on no-op; payload has no other keys (RP-225). Coverage by Unit P9.13 and P9.14.
- **Verify**:
  - `bunx biome check src/lib/relay/telemetry.ts src/lib/relay/telemetry.spec.ts src/stores/useRelayPermissionStore.ts`
  - `bunx vitest run src/lib/relay/telemetry.spec.ts`

### ☐ P9.13 Unit: permission logic
- **Kind**: unit
- **Traces**: RP-220, RP-221, RP-225
- **Files** (5): `src/lib/relay/permission.ts`; `src/stores/useRelayPermissionStore.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/describeGeneric.ts`
- **Depends on**: P9.12, P9.6
- **Do**: unit-test-engineer writes `permission.spec.ts`, `useRelayPermissionStore.spec.ts`, `describeGeneric.spec.ts` (new) and extends `schemas.spec.ts`, `registry.spec.ts`. Cases: the table-driven `approvalNeeded` grid over {read, ui incl. `ask_user`, auto small, auto bulk 11, confirm, navigation} x {3 modes}; every `auto` tool is navigation or gated by Always ask; `awaitsUser` default parameter parity with the old behavior; `executeTool` skip runs `delete_request` without a token, review returns `APPROVAL_REQUIRED`, `ask_user` still awaits in skip, a hand-built object is rejected in all modes, the schema of every tool has no mode field; dirty-tab gate fires in every mode; `describeGeneric` names from live store and the step-label fallback; store default, persistence, corrupt and unknown stored values, `localStorage` throwing, telemetry once per change and not on no-op. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Meets the RP-221 AC (unit) exactly; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/lib/relay/permission.spec.ts src/stores/useRelayPermissionStore.spec.ts src/lib/relay/tools/describeGeneric.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/registry.spec.ts --coverage --coverage.include=src/lib/relay/permission.ts --coverage.include=src/stores/useRelayPermissionStore.ts --coverage.include=src/lib/relay/tools/schemas.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/tools/describeGeneric.ts --coverage.reporter=text`

### ☐ P9.14 Unit: chat hook, cards and shield
- **Kind**: unit
- **Traces**: RP-221, RP-222, RP-223, RP-225
- **Files** (5): `src/hooks/useRelayChat.ts`; `src/components/relay/ConfirmCard.tsx`; `src/components/relay/PermissionShield.tsx`; `src/components/settings/RelaySection.tsx`; `src/lib/relay/telemetry.ts`
- **Depends on**: P9.13
- **Do**: unit-test-engineer writes `PermissionShield.spec.tsx` (new, happy-dom header) and extends `useRelayChat.spec.ts`, `ConfirmCard.spec.tsx`, `RelaySection.spec.tsx`, `telemetry.spec.ts`. Cases: awaiting-id record survives a mode flip both ways; skip runs confirm tools without a card but still awaits `ask_user`; the change card renders names and count; radiogroup roles, arrow/Home/End/Space/Enter, roving tabindex, close-and-refocus on choose and on Esc, `data-mode` per mode, tooltip text, popover flag in the store; Settings select value and change; telemetry payload shape. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-221 to RP-223 and RP-225 at unit level; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.spec.tsx src/components/relay/PermissionShield.spec.tsx src/components/settings/RelaySection.spec.tsx src/lib/relay/telemetry.spec.ts --coverage --coverage.include=src/hooks/useRelayChat.ts --coverage.include=src/components/relay/ConfirmCard.tsx --coverage.include=src/components/relay/PermissionShield.tsx --coverage.include=src/components/settings/RelaySection.tsx --coverage.include=src/lib/relay/telemetry.ts --coverage.reporter=text`

### ☐ P9.15 E2E: migrate confirm and write specs
- **Kind**: e2e
- **Traces**: RP-221
- **Files** (4): `e2e/qa/relay/relay-confirm.spec.ts`; `e2e/scenarios/relay/relay-confirm.feature.md`; `e2e/qa/relay/relay-write.spec.ts`; `e2e/scenarios/relay/relay-write.feature.md`
- **Depends on**: P9.14
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: both specs run in the default Review mode, so behavior must be unchanged; migrate only locators or fixtures that moved (the shield now sits in the toolbar, the confirm card has a new variant for gated auto tools) and add an explicit `rq_relay_permission_mode = review` seed where a spec depends on the default.
- **Do**: Edit only what breaks; list changes in the Log.
- **Acceptance**:
  - Both specs pass unchanged in behavior under Review.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P9.16 E2E: migrate keyboard tab order
- **Kind**: e2e
- **Traces**: RP-222
- **Files** (4): `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`; `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md`; `e2e/qa/relay/relay-polish-composer.spec.ts`; `e2e/scenarios/relay/relay-polish-composer.feature.md`
- **Depends on**: P9.15
- **Gherkin**: edits `relay-improvements-a11y-keyboard.feature.md` and `relay-polish-composer.feature.md`; no new ids
- **Spec**: `relay-improvements-a11y-keyboard.spec.ts`, `relay-polish-composer.spec.ts`
- **Scenarios**: composer tab-order scenario now expects textarea, `+`, shield, pill remove buttons, mic, send; `[REL-POL-COMPOSER-06]` (P6.14, "with no shield") is reworded to the same order with the shield after `+`.
- **Do**: Edit only what breaks.
- **Acceptance**:
  - Both specs pass with the shield in the tab order.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P9.17 E2E: permission behavior matrix
- **Kind**: e2e
- **Traces**: RP-221, RP-224
- **Files** (0): none (no app change)
- **Depends on**: P9.14, P9.16
- **Gherkin**: `e2e/scenarios/relay/relay-polish-perm.feature.md`: REL-POL-PERM-01..12
- **Spec**: `e2e/qa/relay/relay-polish-perm.spec.ts`
- **Scenarios**:
  - `[REL-POL-PERM-01] Always ask: a scripted create_collection shows an Approve card and does not run until Approve` @critical
  - `[REL-POL-PERM-02] Always ask: delete_request shows a confirm card` @critical
  - `[REL-POL-PERM-03] Always ask: get_request (read) runs with no card` @critical
  - `[REL-POL-PERM-04] Always ask: ask_user shows its question card` @high
  - `[REL-POL-PERM-05] Review: create_collection runs with no confirm card and shows the Change Card with Undo; delete_request shows a card` @critical
  - `[REL-POL-PERM-06] Review: get_request and ask_user behave as before` @high
  - `[REL-POL-PERM-07] Skip: create_collection, delete_request and get_request produce no confirm card and the items change; ask_user still shows` @critical
  - `[REL-POL-PERM-08] Skip: the create is undoable from the Change Card or Undo toast` @critical
  - `[REL-POL-PERM-09] a card pending in Review stays pending after switching to Skip and only runs on Approve` @critical (error)
  - `[REL-POL-PERM-10] model text and a tool input carrying a permission field cannot change the mode; the stored mode is unchanged` @critical (error)
  - `[REL-POL-PERM-11] Always ask does not gate open_item (navigation)` @high
  - `[REL-POL-PERM-12] closing a tab with unsaved edits still shows the save/discard gate in Skip` @high
- **Do**: Scripted streams from `e2e/fixtures/relayRoutes.ts` (`create_collection`, `delete_request`, `get_request`, `ask_user`, `open_item`); seed the mode through `localStorage` before load; assert store effects through the UI (sidebar names), not internals.
- **Acceptance**:
  - Covers RP-224 exactly and the RP-221 ACs.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-perm.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P9.18 E2E: shield and Settings
- **Kind**: e2e
- **Traces**: RP-222, RP-223, RP-215, RP-103
- **Files** (0): none (no app change)
- **Depends on**: P9.16
- **Gherkin**: `e2e/scenarios/relay/relay-polish-shield.feature.md`: REL-POL-SHIELD-01..09
- **Spec**: `e2e/qa/relay/relay-polish-shield.spec.ts`
- **Scenarios**:
  - `[REL-POL-SHIELD-01] the shield is the control right after + and its tooltip reads "Approval mode: Review for me" on hover and keyboard focus` @critical
  - `[REL-POL-SHIELD-02] opening shows a radiogroup with three rows, Review for me selected and marked Recommended` @critical
  - `[REL-POL-SHIELD-03] Arrow keys move between rows; Enter selects, closes the popover, focus returns to the shield and data-mode updates` @critical
  - `[REL-POL-SHIELD-04] Esc closes the popover and focus returns to the shield` @high
  - `[REL-POL-SHIELD-05] Skip shows "Use with caution" on its row, a warning-toned shield and the "Approvals are off" notice; the notice disappears on switching back` @high
  - `[REL-POL-SHIELD-06] the chosen mode survives a reload` @high (persistence)
  - `[REL-POL-SHIELD-07] changing the mode in Settings > Relay updates the shield, and changing via the shield updates the Settings select after reload` @critical
  - `[REL-POL-SHIELD-08] the launcher Settings section lists Permission mode with the current mode and opens the shield popover` @high
  - `[REL-POL-SHIELD-09] at 320px the popover is not clipped, has no horizontal scroll and the notice does not overlap pills` @high
- **Do**: Telemetry is covered at unit level (P9.12 and P9.14); do not assert it here.
- **Acceptance**:
  - Covers RP-222, RP-223 and RP-215 (Settings row) and the RP-103 shield tooltip.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shield.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P9.19 Checkpoint 9
- **Kind**: gate
- **Traces**: RP-103, RP-215, RP-220, RP-221, RP-222, RP-223, RP-224, RP-225
- **Files** (0): none (verification only)
- **Depends on**: P9.1, P9.2, P9.3, P9.4, P9.5, P9.6, P9.7, P9.8, P9.9, P9.10, P9.11, P9.12, P9.13, P9.14, P9.15, P9.16, P9.17, P9.18
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - Shield modes behave per the RP-224 matrix; no token is minted outside Approve; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/components/settings src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts --repeat-each=2`  (composer gains the shield, launcher gains the Settings row)
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rnE 'permissionMode.*(input|schema)' src/lib/relay/tools/schemas.ts)"`  (expect exit 0: the mode is never a tool input field)

🔶 **Checkpoint 9**: permission modes shipped end to end (store, registry, shield, Settings, launcher row, telemetry) with the behavior matrix green and the old approval specs migrated.

---

## Phase 10: Capabilities popover and the new-chat empty state

**Adds:** A "What Relay can do" button in the header opens a popover with five categories of runnable starter examples (each with a live approval badge) and a "What Relay can see" list. The same content fills the new-chat empty state, replacing the interim starters.

**Try in UI:** Click the "What Relay can do" button in the header and see five categories ; Switch the approval mode to Always ask and see the badges change to "Asks first" ; Click a starter that needs a target and see the `@` menu open with a hint ; Click "Change approval mode" and see the shield popover ; Start a new chat and see the large Relay logo with the same starters, identical on every tab ; Press Esc in the popover and see focus return to the header button

### ☐ P10.1 Capabilities strings
- **Kind**: implementation
- **Traces**: RP-206, RP-207, RP-103, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: Checkpoint 9
- **Do**: Add `header.capabilities` (tooltip and aria-label "What Relay can do"), `capabilities.{title,tab.can,tab.see,changeMode}`, `capabilities.category.{read,write,run,organize,transfer}.{title,description}` for Read & explain, Create & edit, Run & test, Organize, Import/Export, 2 to 3 starters each at `capabilities.<category>.examples.<n>` and action lines at `capabilities.<category>.actions.<n>`, `capabilities.badge.{asks,runs,asksBulk}` ("Asks first", "Runs directly", "Asks first when more than 10 items"), `capabilities.see.{attached,index,lookups,envValues,secrets}` plus `capabilities.see.settingsLink`, `capabilities.empty.{title,description}`, and `launcher.settings.capabilities` (+ `.description`). Starters name intent in plain words and never vendor names. Identical key sets in en, fr, ja.
- **Design**: n/a, strings only; design gates on P10.3, P10.5 and P10.6.
- **Acceptance**:
  - Keys exist in all three locales; every example key referenced by P10.2 resolves in all three.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`

### ☐ P10.2 Capabilities model and approval badges
- **Kind**: implementation
- **Traces**: RP-206
- **Files** (1): `src/lib/relay/capabilities.ts` (new)
- **Depends on**: P10.1
- **Do**: Single source of truth, pure and typed: `CapabilityCategory = "read" | "write" | "run" | "organize" | "transfer"`; `CAPABILITY_CATEGORY_BY_TOOL = {...} satisfies Record<RelayToolName, CapabilityCategory>` (a missing tool fails typecheck); `CAPABILITY_CATEGORIES` with display order, icon name and example i18n keys (`capabilities.<category>.examples.<n>`); `CAPABILITY_ACTIONS` as `{ id, category, labelKey, tools: RelayToolName[] }` where every tool belongs to the action's category; each example may carry `requiresTarget` (same kind union as slash). `capabilityBadge(tools, mode)` returns `"asks" | "runs" | "asksBulk"` by calling `approvalNeeded` (never re-implementing the rules): `asksBulk` when the tool asks only above the bulk threshold, derived by probing `approvalNeeded` with a small and a threshold-plus-one count input.
- **Design**: n/a, logic only; design gate on P10.3.
- **Acceptance**:
  - Every `RELAY_TOOL_SCHEMAS` key maps to exactly one category; badge results follow the live `approvalNeeded` for all three modes (RP-206). Coverage by Unit P10.9.
- **Verify**:
  - `bunx biome check src/lib/relay/capabilities.ts`

### ☐ P10.3 CapabilitiesPanel content
- **Kind**: implementation
- **Traces**: RP-206, RP-207, RP-205
- **Files** (3): `src/components/relay/CapabilitiesPanel.tsx` (new); `src/components/relay/CapabilitySeeList.tsx` (new); `src/components/relay/EntityPill.tsx`
- **Depends on**: P10.2
- **Do**: `CapabilitiesPanel({ variant: "popover" | "empty", onStarter, onChangeMode })`: popover variant has two tabs, "What Relay can do" (the five categories with starters as buttons `relay-capability-starter`, action lines each with a badge `relay-capability-badge` driven by `capabilityBadge` and the live `useRelayPermissionStore` mode) and "What Relay can see" (`CapabilitySeeList`: attached items shown as example pills, workspace index names and counts, on-demand lookups, env values only with "Share variable values" and a link to Settings > Relay, secrets always hidden); footer link `relay-capability-change-mode` ("Change approval mode"). The empty variant renders the starters grid only (collapsed categories, no tabs, no see list). Content comes from `capabilities.ts`; no strings hard-coded.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (category headings and icons, starter button density, badge tones (neutral for Runs directly, caution for Asks first), tab styling, empty-variant grid at 320px, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p10-panel-*.png`.
- **Acceptance**:
  - Five categories render with starters and badges that change with the mode; the see list shows the five items; the empty variant has no tabs (RP-206, RP-207); in-browser proof by E2E P10.12 `[REL-POL-CAPS-01]`, `[REL-POL-CAPS-02]`, `[REL-POL-CAPS-05]`, `[REL-POL-CAPS-06]`.
- **Verify**:
  - `bunx biome check src/components/relay/CapabilitiesPanel.tsx src/components/relay/CapabilitySeeList.tsx src/components/relay/EntityPill.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p10-panel-*.png 2>/dev/null)"`

### ☐ P10.4 Starter handler and mention request
- **Kind**: implementation
- **Traces**: RP-206, RP-204
- **Files** (5): `src/hooks/useCapabilityStarter.ts` (new); `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`
- **Depends on**: P10.2, P9.9
- **Do**: `useCapabilityStarter()` returns `runStarter(example)`: with no `requiresTarget`, or when `resolveSlashTarget`-style matching against the attached items is satisfied, call `submitPrompt(t(example.promptKey))`; otherwise `openWithDraft({ prompt, chips: [] })` and set a transient `mentionRequest: { kind, hintKey } | null` in `useRelayStore` (never persisted). The composer consumes `mentionRequest` once: focuses the textarea and opens `MentionMenu` with that kind and hint, then clears it. Add `capabilitiesOpen` + setter to the same store (transient) for the header and launcher. Update the store and composer specs.
- **Design**: n/a, logic only; the menu look is owned by P6.4 and the popover by P10.5.
- **Acceptance**:
  - A target-free starter sends; a target-requiring starter with nothing attached prefills the draft, opens the mention menu with the hint and sends nothing (RP-206, RP-204). Coverage by Unit P10.9; browser proof by E2E P10.12 `[REL-POL-CAPS-03]`, `[REL-POL-CAPS-04]`.
- **Verify**:
  - `bunx biome check src/hooks/useCapabilityStarter.ts src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx`
  - `bunx vitest run src/stores/useRelayStore.spec.ts src/components/relay/RelayComposer.spec.tsx`

### ☐ P10.5 Header button and CapabilitiesPopover
- **Kind**: implementation
- **Traces**: RP-206, RP-103
- **Files** (4): `src/components/relay/CapabilitiesPopover.tsx` (new); `src/components/relay/RelayHeader.tsx`; `src/components/relay/RelayHeader.spec.tsx`; `src/components/relay/PermissionShield.tsx`
- **Depends on**: P10.3, P10.4
- **Do**: Add an icon button `relay-header-capabilities` (tooltip "What Relay can do" on hover and focus, `aria-label` equal) to the header; it opens `CapabilitiesPopover` (controlled by `capabilitiesOpen`) containing the popover variant of `CapabilitiesPanel`. On open focus moves into the popover; Esc closes and returns focus to the header button; choosing a starter closes the popover and calls `runStarter`. "Change approval mode" closes it and sets `permissionPopoverOpen` so the shield popover opens (`PermissionShield` is touched only to make sure an externally opened popover takes focus and returns it correctly). Update the header spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (header button placement and icon among the other header controls, popover width and max height with internal scroll, focus handling, no overflow at 320px, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p10-popover-*.png`.
- **Acceptance**:
  - The header button opens the popover with focus inside; Esc closes and refocuses the button; "Change approval mode" opens the shield popover; live mode changes update badges (RP-206, RP-103); proven in a browser by E2E P10.12 `[REL-POL-CAPS-01]`, `[REL-POL-CAPS-07]`, `[REL-POL-CAPS-08]`.
- **Verify**:
  - `bunx biome check src/components/relay/CapabilitiesPopover.tsx src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx src/components/relay/PermissionShield.tsx`
  - `bunx vitest run src/components/relay/RelayHeader.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p10-popover-*.png 2>/dev/null)"`

### ☐ P10.6 Empty state uses capability starters
- **Kind**: implementation
- **Traces**: RP-207, RP-205
- **Files** (5): `src/components/relay/EmptyState.tsx`; `src/components/relay/EmptyState.spec.tsx`; `src/lib/relay/suggestions.ts` (delete); `src/lib/relay/suggestions.spec.ts` (delete); `src/components/relay/RelayConversation.tsx`
- **Depends on**: P10.5
- **Do**: `EmptyState` shows the large `RelayLogo`, `capabilities.empty.title` and description, then `CapabilitiesPanel variant="empty"` wired to `runStarter`. Delete the interim starter list (`suggestions.ts` and its spec) and the old `SUGGESTION_KEYS` and "see what Relay can see" toggle (`relay-see-what`); the see-list is reachable from the header popover instead. Fix any import in `RelayConversation.tsx`. The empty state does not read the active tab. Update the empty-state spec.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (large logo scale, title/description rhythm, starter grid columns at 320/400/480, vertical centering with the composer below, light + dark). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p10-empty-*.png`.
- **Acceptance**:
  - New chat shows the large logo and the capability starters, identical on every tab; `suggestions.ts`, `SUGGESTION_KEYS` and `relay-see-what` no longer exist under `src` (RP-207); proven in a browser by E2E P10.12 `[REL-POL-CAPS-09]`, `[REL-POL-CAPS-10]`.
- **Verify**:
  - `bunx biome check src/components/relay/EmptyState.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/RelayConversation.tsx`
  - `bunx vitest run src/components/relay/EmptyState.spec.tsx src/components/relay/RelayConversation.spec.tsx`
  - `test -z "$(grep -rnE 'SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions' src)"`  (expect exit 0)
  - `test -n "$(ls agent_docs/qa/relay-polish/p10-empty-*.png 2>/dev/null)"`

### ☐ P10.7 Remove interim starter strings
- **Kind**: implementation
- **Traces**: RP-207, RP-213
- **Files** (3): `messages/en/relayDock.json`; `messages/fr/relayDock.json`; `messages/ja/relayDock.json`
- **Depends on**: P10.6
- **Do**: Remove `emptyState.starters.*` (P5.6), the old suggestion and "see what Relay can see" keys, found by grepping each candidate against `src` first; keep any key still read. Remove from all three locales.
- **Design**: n/a, strings only.
- **Acceptance**:
  - No removed key is referenced under `src`; parity specs stay green.
- **Verify**:
  - `bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rn 'emptyState.starters' src messages)"`  (expect exit 0)

### ☐ P10.8 Launcher row: What Relay can do
- **Kind**: implementation
- **Traces**: RP-215, RP-206
- **Files** (4): `src/lib/relay/launcherItems.ts`; `src/lib/relay/launcherItems.spec.ts`; `src/components/relay/RelayLauncher.tsx`; `src/components/relay/RelayLauncher.spec.tsx`
- **Depends on**: P10.5, P9.11
- **Do**: Add "What Relay can do" to the launcher's Settings section after "Permission mode"; selecting it closes the launcher and sets `capabilitiesOpen` so the header popover opens. Update both existing specs.
- **Design**: Design with the `ui-ux-pro-max` skill first, then refine with the `impeccable` and `layout` skills (row icon and chevron consistency with the Permission mode row, focus hand-off to the popover). Log the one-line design note. Screenshots: `agent_docs/qa/relay-polish/p10-launcher-*.png`.
- **Acceptance**:
  - The launcher Settings section lists both rows and the second opens the capabilities popover (RP-215, RP-206); proven in a browser by E2E P10.12 `[REL-POL-CAPS-11]`.
- **Verify**:
  - `bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.tsx src/components/relay/RelayLauncher.spec.tsx`
  - `bunx vitest run src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.spec.tsx`
  - `test -n "$(ls agent_docs/qa/relay-polish/p10-launcher-*.png 2>/dev/null)"`

### ☐ P10.9 Unit: capabilities logic
- **Kind**: unit
- **Traces**: RP-206, RP-204
- **Files** (3): `src/lib/relay/capabilities.ts`; `src/hooks/useCapabilityStarter.ts`; `src/stores/useRelayStore.ts`
- **Depends on**: P10.8
- **Do**: unit-test-engineer writes `capabilities.spec.ts`, `useCapabilityStarter.spec.ts` (new) and extends `useRelayStore.spec.ts`. Cases: every key of `RELAY_TOOL_SCHEMAS` appears in exactly one category and none is unknown; every action's tools sit in the action's category; every example, action, category and see-list i18n key exists in en, fr and ja (load the message files); `capabilityBadge` equals the live `approvalNeeded` result for all three modes including bulk tools and navigation tools; starter sends when target-free or satisfied, otherwise prefills and sets `mentionRequest`; `mentionRequest` is consumed once and never persisted. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Meets the RP-206 unit ACs (exactly-one-category, i18n existence, badge parity); unit task acceptance from Conventions holds for all three files.
- **Verify**:
  - `bunx vitest run src/lib/relay/capabilities.spec.ts src/hooks/useCapabilityStarter.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/capabilities.ts --coverage.include=src/hooks/useCapabilityStarter.ts --coverage.include=src/stores/useRelayStore.ts --coverage.reporter=text`

### ☐ P10.10 Unit: capabilities components
- **Kind**: unit
- **Traces**: RP-206, RP-207, RP-103
- **Files** (5): `src/components/relay/CapabilitiesPanel.tsx`; `src/components/relay/CapabilitySeeList.tsx`; `src/components/relay/CapabilitiesPopover.tsx`; `src/components/relay/EmptyState.tsx`; `src/components/relay/RelayHeader.tsx`
- **Depends on**: P10.9
- **Do**: unit-test-engineer writes `CapabilitiesPanel.spec.tsx`, `CapabilitySeeList.spec.tsx`, `CapabilitiesPopover.spec.tsx` (new, happy-dom header) and extends `EmptyState.spec.tsx`, `RelayHeader.spec.tsx`. Cases: five categories, starters and badges per mode (update live when the store changes); tabs; see-list items and the env-values link; empty variant has no tabs or see list; starter click calls the handler and closes the popover; focus in on open and Esc returns to the header button; "Change approval mode" sets `permissionPopoverOpen`; header tooltip and aria-label; empty state renders logo, title, starters and no tab-derived text. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Covers RP-206, RP-207 and the header RP-103 tooltip at unit level; unit task acceptance from Conventions holds for all five files.
- **Verify**:
  - `bunx vitest run src/components/relay/CapabilitiesPanel.spec.tsx src/components/relay/CapabilitySeeList.spec.tsx src/components/relay/CapabilitiesPopover.spec.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/RelayHeader.spec.tsx --coverage --coverage.include=src/components/relay/CapabilitiesPanel.tsx --coverage.include=src/components/relay/CapabilitySeeList.tsx --coverage.include=src/components/relay/CapabilitiesPopover.tsx --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text`

### ☐ P10.11 E2E: migrate chat, axe and suggestions specs
- **Kind**: e2e
- **Traces**: RP-207, RP-205
- **Files** (5): `e2e/qa/relay/relay-chat.spec.ts`; `e2e/scenarios/relay/relay-chat.feature.md`; `e2e/qa/relay/relay-improvements-a11y-axe.spec.ts`; `e2e/scenarios/relay/relay-improvements-a11y-axe.feature.md`; `e2e/qa/relay/relay-polish-ctx.spec.ts` (only its `[REL-POL-CTX-07]` starter locators; the scenario text stays valid, so its feature file is untouched)
- **Depends on**: P10.10
- **Gherkin**: edits the two existing feature files; no new ids
- **Spec**: the two specs above
- **Scenarios**: `relay-chat` assertions on the interim starters and any remaining `relay-suggestion`/`relay-see-what` locators move to `relay-capability-starter`; the axe scan additionally opens the capabilities popover and scans it; `relay-polish-ctx` `[REL-POL-CTX-07]` compares the capability starters instead of the interim three. Also confirm `e2e/qa/relay/relay-improvements-context-suggestions.spec.ts` and its feature file are gone (retired in P5); if either still exists, delete both here and record it in the Log.
- **Do**: Edit only what breaks; list changes in the Log.
- **Acceptance**:
  - Both specs pass; `grep -rn "relay-see-what" e2e` is empty.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `test -z "$(grep -rn 'relay-see-what' e2e)"`  (expect exit 0)

### ☐ P10.12 E2E: capabilities and empty state
- **Kind**: e2e
- **Traces**: RP-206, RP-207, RP-205, RP-215, RP-103
- **Files** (0): none (no app change)
- **Depends on**: P10.10, P10.11
- **Gherkin**: `e2e/scenarios/relay/relay-polish-caps.feature.md`: REL-POL-CAPS-01..12
- **Spec**: `e2e/qa/relay/relay-polish-caps.spec.ts`
- **Scenarios**:
  - `[REL-POL-CAPS-01] the header button (tooltip "What Relay can do") opens a popover, focus moves inside, Esc closes it and focus returns to the button` @critical
  - `[REL-POL-CAPS-02] five categories render, each with 2 to 3 starters` @critical
  - `[REL-POL-CAPS-03] a target-free starter sends its prompt to /api/relay/chat` @critical
  - `[REL-POL-CAPS-04] a starter that needs a target with nothing attached opens the mention menu with a hint and sends nothing` @critical
  - `[REL-POL-CAPS-05] the See tab lists attached items, the workspace index, on-demand lookups, env values only with Share variable values, and secrets hidden` @high
  - `[REL-POL-CAPS-06] approval badges read "Runs directly" or "Asks first" per the current mode, and bulk tools read "Asks first when more than 10 items"` @critical
  - `[REL-POL-CAPS-07] switching the mode from the shield updates the badges without closing and reopening` @high
  - `[REL-POL-CAPS-08] "Change approval mode" opens the shield popover` @high
  - `[REL-POL-CAPS-09] the new-chat empty state shows the large logo, title, description and the same starters` @critical
  - `[REL-POL-CAPS-10] the empty state is identical whichever tab is open and shows no tab-derived text` @high
  - `[REL-POL-CAPS-11] the launcher Settings section opens the capabilities popover` @medium
  - `[REL-POL-CAPS-12] the final + launcher shows exactly four sections in the order Recent, Attach, Actions, Settings, and Settings holds Permission mode and What Relay can do` @high (RP-215 final state)
- **Do**: Starter send asserted through a `page.route` capture of the chat body; the empty/persistence/error cases do not apply beyond what is listed, because the content is static and local.
- **Acceptance**:
  - Covers RP-206, RP-207, the RP-215 launcher row and the RP-215 four-section order.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-caps.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P10.13 Checkpoint 10
- **Kind**: gate
- **Traces**: RP-103, RP-205, RP-206, RP-207, RP-215
- **Files** (0): none (verification only)
- **Depends on**: P10.1, P10.2, P10.3, P10.4, P10.5, P10.6, P10.7, P10.8, P10.9, P10.10, P10.11, P10.12
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - Capabilities popover and empty state behave per the RP ACs; all commands below exit 0.
- **Verify**:
  - `bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts --repeat-each=2`  (ctx asserts the empty-state starters P10.6 replaces; launcher gains a row)
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts`
  - `test -z "$(grep -rnE 'SUGGESTION_KEYS|relay-see-what|deriveSuggestions|useSuggestionContext' src e2e)"`  (expect exit 0)

🔶 **Checkpoint 10**: capabilities popover, approval badges and the new empty state shipped; the interim starters and the see-what toggle are gone; chat and axe specs migrated and green.

---

## Phase 11: Cleanup and final sweep (no feature work)

**Adds:** Nothing new for users. This phase proves the feature is clean: removed symbols and strings are gone, accessibility holds with every new menu open, the bundle is within budget, and every targeted spec passes together.

**Try in UI:** Open each of Relay's menus (conversations, row menu, mention, slash, launcher, shield, capabilities) and confirm nothing overlaps at 1440px and 320px in light and dark ; Resize the panel and reload to confirm size and position persist ; Walk the Part A and Part B acceptance criteria once end to end

### ☐ P11.1 Removed-symbol sweep
- **Kind**: implementation
- **Traces**: RP-110, RP-216, RP-226, RP-101, RP-201
- **Files** (0): none expected (any hit is fixed in at most 5 files, otherwise reported back to its owning phase)
- **Depends on**: Checkpoint 10
- **Do**: Run each search and fix leftovers: `computeContextChips`, `dismissAutoChip`, `RELAY_DEFAULT_WIDTH_PX`, `relay_feedback`, `RelayFeedbackRating`, `thumbsUp`/`thumbsDown`, `Sparkles` under `src/components/relay`, `relay-see-what`, `SUGGESTION_KEYS`, `deriveSuggestions`, `useSuggestionContext`, `RelayPicker` and `relay-picker-kind-`, `ContextChips`, `relay-context-chip`, `relay-composer-row`, and the delete-dialog ids removed in P4. Mentions inside `agent_docs/relay-improvements/*` are annotated as superseded (P1.6), not rewritten, and are excluded from the search.
- **Design**: n/a, sweep only.
- **Acceptance**:
  - Every command below exits 0 (SPEC section 10 criterion 5).
- **Verify**:
  - `test -z "$(grep -rnE 'computeContextChips|dismissAutoChip|RELAY_DEFAULT_WIDTH_PX|relay_feedback|RelayFeedbackRating|thumbsUp|thumbsDown|deriveSuggestions|useSuggestionContext|SUGGESTION_KEYS|relay-see-what|ContextChips|relay-context-chip|relay-composer-row|relay-picker-kind-' src e2e messages)"`
  - `test -z "$(grep -rn 'Sparkles' src/components/relay)"`
  - `test -z "$(grep -rnE 'RelayPicker\b' src e2e)"`

### ☐ P11.2 Removed-key sweep and i18n parity
- **Kind**: implementation
- **Traces**: RP-213
- **Files** (0): none expected (fix-forward in `messages/{en,fr,ja}/*.json` only)
- **Depends on**: P11.1
- **Do**: For every key added or removed across the feature, confirm en, fr and ja agree: run the parity specs, then list keys in `relay.json`/`relayDock.json` that no file under `src` references (a throwaway scripted check, not committed) and delete only those that a phase introduced and no longer uses. Confirm `@` and `/` survive in the composer placeholder in fr and ja and that `{count}`/`{name}`/`{targets}` placeholders are preserved.
- **Design**: n/a, strings only.
- **Acceptance**:
  - Parity specs and the brand guard are green; no feature-introduced key is orphaned.
- **Verify**:
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts`
  - `bunx biome check messages/en messages/fr messages/ja`

### ☐ P11.3 Final bundle check
- **Kind**: gate
- **Traces**: RP-110
- **Files** (1): `agent_docs/relay-polish/BUNDLE.md`
- **Depends on**: P11.2
- **Do**: Measurement gate. In a scratch copy (never in the repo, never `bun run build` in the repo), build and record `/app` and `/` first-load gzip using the method in `agent_docs/relay-improvements/BUNDLE.md`; append a "P11.3" section with the numbers, the delta against the 757.2 kB SPEC budget baseline and the 762.2 kB ceiling (757.2 + 5 kB) budget, and one line `P11.3 verdict: PASS` or `P11.3 verdict: FAIL`. Confirm the Relay dock stays a separate lazy chunk and that `CapabilitiesPanel`, `RelayLauncher` and `MentionMenu` live inside it.
- **Design**: n/a, measurement only.
- **Acceptance**:
  - `/app` first-load gzip is within +5 kB of 757.2 kB (ceiling 762.2 kB) (Performance NFR, SPEC section 10 criterion 6). A FAIL stops the phase and is reported to the user.
- **Verify**:
  - `grep -nE '^P11\.3 verdict: PASS$' agent_docs/relay-polish/BUNDLE.md`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2`  (the lazy chunk's surfaces still load)

### ☐ P11.4 Docs: shortcuts, test-id appendix, screenshot index
- **Kind**: implementation
- **Traces**: RP-106, RP-110
- **Files** (3): `agent_docs/qa/relay-polish/INDEX.md` (new); `agent_docs/relay-polish/SPEC.md`; `e2e/fixtures/README.md`
- **Depends on**: P11.2
- **Do**: (1) Verify the Firefox `Ctrl/Cmd+Shift+O` caveat is shown in Settings > Shortcuts (P2.6) and in the shortcut dialog tooltip text, recording the check in the Log; (2) check the SPEC test-id appendix against the code: every id in it exists in `src` or is listed as removed, fixing the appendix in SPEC.md where the implementation chose a different final id (record each change); (3) write a screenshot index listing every `agent_docs/qa/relay-polish/p*-*.png` by phase with a one-line caption; (4) add the new `relay-polish-*` specs and run recipe to `e2e/fixtures/README.md` if that file lists relay specs.
- **Design**: n/a, documentation only.
- **Acceptance**:
  - The index lists every screenshot file present; the appendix has no id missing from `src` that is not marked removed.
- **Verify**:
  - `test -s agent_docs/qa/relay-polish/INDEX.md`
  - `test "$(ls agent_docs/qa/relay-polish/p*-*.png | wc -l)" -eq "$(grep -c 'p[0-9]*-.*\.png' agent_docs/qa/relay-polish/INDEX.md)"`  (every screenshot indexed)

### ☐ P11.5 E2E: accessibility with every menu open
- **Kind**: e2e
- **Traces**: RP-103, RP-107, RP-211, RP-214, RP-217, RP-222, RP-206
- **Files** (0): none (no app change)
- **Depends on**: P11.2
- **Gherkin**: `e2e/scenarios/relay/relay-polish-a11y.feature.md`: REL-POL-A11Y-01..08
- **Spec**: `e2e/qa/relay/relay-polish-a11y.spec.ts`
- **Scenarios**:
  - `[REL-POL-A11Y-01] axe finds no serious or critical violations with the conversations overlay open` @high
  - `[REL-POL-A11Y-02] axe is clean with a thread row menu open` @high
  - `[REL-POL-A11Y-03] axe is clean with the @ mention menu open` @critical
  - `[REL-POL-A11Y-04] axe is clean with the / slash menu open` @critical
  - `[REL-POL-A11Y-05] axe is clean with the + launcher open` @critical
  - `[REL-POL-A11Y-06] axe is clean with the shield popover open in each of the three modes (including the warning tone contrast)` @critical
  - `[REL-POL-A11Y-07] axe is clean with the capabilities popover open and with the empty state` @critical
  - `[REL-POL-A11Y-08] axe is clean in dark mode at the 320px panel width with the launcher open` @high
- **Do**: Reuse the axe helper pattern from `relay-improvements-a11y-axe.spec.ts` (copy the pattern, not the file).
- **Acceptance**:
  - Covers the Accessibility NFR for every new surface.
  - One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-a11y.spec.ts --repeat-each=3`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P11.6 Targeted run of every polish and migrated spec
- **Kind**: gate
- **Traces**: RP-101, RP-102, RP-104, RP-105, RP-106, RP-107, RP-108, RP-109, RP-110, RP-201, RP-202, RP-203, RP-204, RP-205, RP-206, RP-207, RP-208, RP-209, RP-210, RP-211, RP-212, RP-214, RP-215, RP-217, RP-220, RP-221, RP-222, RP-223, RP-224, RP-226
- **Files** (0): none (verification only)
- **Depends on**: P11.1, P11.3, P11.4, P11.5
- **Do**: Run the union of the `relay-polish-*` specs and the migrated specs named in PLAN section 6 plus the additions found while authoring (relay-a11y, relay-chat, relay-shell, relay-privacy, relay-confirm, relay-write, the `relay-improvements-*` specs listed in this file), by name, once. This is not the full suite and the full suite is never run.
- **Acceptance**:
  - Every listed spec passes at `--repeat-each=2`.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-threads.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-a11y.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-threads.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts e2e/qa/relay/relay-improvements-qol-followups.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-smart-export.spec.ts e2e/qa/relay/relay-improvements-smart-import.spec.ts --repeat-each=2`  (feature files edited by P1 (RP-226) and possibly migrated in P5.7/P7.9)
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P11.7 Whole-project checks
- **Kind**: gate
- **Traces**: RP-110, RP-213
- **Files** (0): none (verification only)
- **Depends on**: P11.6
- **Do**: Run lint, typecheck, the Relay-scoped unit suites with coverage on the files this feature added, the i18n parity specs and the brand guard. `bun run typecheck` runs here once for the phase.
- **Acceptance**:
  - All commands below exit 0 (SPEC section 10 criterion 6).
- **Verify**:
  - `bun run lint:check`
  - `bun run typecheck`
  - `bunx vitest run src/components/relay src/components/layout src/components/settings src/stores src/hooks src/lib/relay src/i18n src/app/settings`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`

### ☐ P11.8 Walkthrough: SPEC acceptance criteria
- **Kind**: walkthrough
- **Traces**: RP-108, RP-109, RP-201, RP-208, RP-211, RP-214, RP-221, RP-222, RP-110
- **Files** (0): none (verification only)
- **Depends on**: P11.7
- **Do**: Using the agent-browser CLI (started with `--init-script e2e/fixtures/qa-seed.init.js`), walk the "Try in UI" line of every phase once at 1440px and 320px panel width in light and dark, then re-run the spec evidence below. The browser walk is a sanity pass only; the spec runs are the evidence.
- **Acceptance**:
  - SPEC section 10 criteria 1 to 4 hold: Section 4 acceptance criteria and the A7/A8 repros no longer reproduce (scripted text/tool/text and text/ask_user streams); nothing attached means no `activeTab`/`collection`/`environment` in the chat body; shield modes follow the RP-224 matrix; the panel resizes 30-40%, persists, respects left/right and has no body-padding hack.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P11.9 Definition of done
- **Kind**: dod
- **Traces**: all RP ids (see the traceability table at the end of this file)
- **Files** (0): none (verification only)
- **Depends on**: P11.8
- **Do**: Confirm every checkpoint 1 to 10 gate is recorded PASS in the Logs, every task above is checked, no `.skip`/`.only`/`.fixme` was introduced by this feature, no file outside the feature scope changed beyond the migrated specs, and every RP id in the table at the end of this file has at least one PASS task. Do not commit; the `/build-phases` orchestrator commits one phase at a time after the independent verifier PASS.
- **Acceptance**:
  - All of SPEC section 10 criteria 1 to 6 are met and recorded; the feature summary can be written.
- **Verify**:
  - `test -z "$(grep -rnE '\.(skip|only|fixme)\(|it\.fails|test\.fail' e2e/qa/relay/relay-polish-*.spec.ts src/lib/relay src/components/relay src/stores src/hooks)"`  (expect exit 0)
  - `bash e2e/scenarios/relay/check-ids.sh`

🔶 **Checkpoint 11**: the relay-polish feature is clean, accessible, within the bundle budget and verified end to end; all SPEC section 10 criteria are met.

---

## Traceability: RP id to tasks

Implementation, unit and e2e tasks only (gates and the walkthrough re-verify but are not listed). Every RP id in SPEC appears at least once.

| RP id | Tasks |
|---|---|
| RP-101 | P2.1, P2.3, P2.4, P2.10, P2.11, P2.12, P11.1 |
| RP-102 | P2.7, P2.11, P2.12 |
| RP-103 | P2.1, P2.8, P2.12, P6.1, P6.6, P6.9, P6.10, P6.14, P9.1, P9.8, P9.18, P10.1, P10.5, P10.10, P10.12, P11.5 |
| RP-104 | P4.1, P4.2, P4.3, P4.5, P4.6, P4.8 |
| RP-105 | P4.2, P4.3, P4.6, P4.7, P4.8 |
| RP-106 | P2.2, P2.5, P2.6, P2.9, P2.10, P2.12, P11.4 |
| RP-106b | P2.9 |
| RP-107 | P4.4, P4.6, P4.8, P11.5 |
| RP-108 | P1.2, P1.7, P1.8, P1.9 |
| RP-109 | P1.3, P1.7, P1.8 |
| RP-110 | P3.1, P3.2, P3.3, P3.4, P3.5, P11.1, P11.4 |
| RP-201 | P5.1, P5.2, P5.3, P5.9, P5.11, P5.12, P5.13, P5.14, P6.5, P6.12, P11.1 |
| RP-202 | P5.1, P5.6, P5.8, P5.9, P5.10, P5.13, P5.14, P6.4, P6.7, P6.15, P8.2, P8.4, P8.5, P8.10 |
| RP-203 | P5.2, P5.4, P5.5, P5.10, P5.14 |
| RP-204 | P7.3, P7.5, P7.6, P7.7, P7.9, P7.10, P8.4, P10.4, P10.9 |
| RP-205 | P5.3, P5.6, P5.7, P5.10, P5.12, P5.14, P10.3, P10.6, P10.11, P10.12 |
| RP-206 | P10.1, P10.2, P10.3, P10.4, P10.5, P10.8, P10.9, P10.10, P10.12, P11.5 |
| RP-207 | P10.1, P10.3, P10.6, P10.7, P10.10, P10.11, P10.12 |
| RP-208 | P6.6, P6.9, P6.10, P6.11, P6.14, P9.9 |
| RP-209 | P6.3, P6.5, P6.6, P6.7, P6.9, P6.11, P6.12, P6.13, P6.14 |
| RP-210 | P6.1, P6.14 |
| RP-211 | P6.2, P6.3, P6.4, P6.7, P6.8, P6.9, P6.13, P6.15, P11.5 |
| RP-212 | P6.3, P6.7, P6.8, P6.15 |
| RP-213 | P1.5, P2.1, P4.2, P5.6, P6.1, P6.4, P6.15, P7.1, P8.1, P8.6, P9.1, P9.2, P10.1, P10.7, P11.2 |
| RP-214 | P8.1, P8.3, P8.8, P8.9, P8.10, P11.5 |
| RP-215 | P6.2, P6.7, P6.8, P8.1, P8.2, P8.3, P8.4, P8.7, P8.8, P8.10, P9.2, P9.11, P9.18, P10.8, P10.12 |
| RP-216 | P8.5, P8.6, P8.8, P8.9, P8.10, P11.1 |
| RP-217 | P7.1, P7.2, P7.4, P7.5, P7.6, P7.7, P7.8, P7.9, P7.10, P11.5 |
| RP-218 | P7.1, P7.2, P7.10 |
| RP-219 | P7.2, P7.6 |
| RP-220 | P9.3, P9.13 |
| RP-221 | P9.2, P9.4, P9.5, P9.6, P9.13, P9.14, P9.15, P9.17 |
| RP-222 | P9.1, P9.7, P9.8, P9.9, P9.11, P9.14, P9.16, P9.18, P11.5 |
| RP-223 | P9.1, P9.10, P9.14, P9.18 |
| RP-224 | P9.17 |
| RP-225 | P9.12, P9.13, P9.14 |
| RP-226 | P1.4, P1.5, P1.6, P1.7, P1.8, P1.9, P11.1 |

