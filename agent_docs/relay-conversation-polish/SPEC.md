# Spec: relay-conversation-polish

Polish pass on the Relay AI agent (Next.js app, branch `feature/ai-agent`). Planning document only; no feature code is written here. All decisions below were confirmed by the user.

## Objective

The developer building API chains through Relay hit seven rough edges while testing relay-v2. Fix them as one cohesive pass.

Success looks like these flows:
- "create a sample chain with 3-4 nodes" creates NO collection and shows ONE compact grouped card.
- "create a chain and open it" lands on `/chain/<id>`.
- No Open button anywhere that does nothing.
- The ask-user card lists options vertically.
- Off-topic chemistry/math asks are declined, with no tool calls.
- No "Grok" or "xAI" text anywhere in the UI.
- A waveform shows in browser dictation mode.

Constraint: existing collection-attached chains keep working (read, update, open, undo).
Out of scope: migrating existing chains, new agent tools, changing the STT provider. Also not changed: change-log/undo semantics (grouping is view-only), Open behaviour for environments and settings, the `/chain/[collectionId]` route, other tools that accept `collectionId` (e.g. `create_request`), and the STT server route.

## Assumptions (verified against code unless marked)

1. `create_chain` today: `z.strictObject({ name, collectionId: id.nullable() })` (`src/lib/relay/tools/schemas.ts:445`). The impl (`src/lib/relay/tools/chainWrite.ts:511`) uses `id = collectionId ?? generateId()`, scope `"collection" | "standalone"`, and rejects an unknown collection or a collection that already has a chain.
2. `open_item` description is "Open a request in a tab..." (`schemas.ts:639`) although `kind` is `z.enum(OPEN_ITEM_KINDS)`. `openEntity` (`src/lib/relay/openEntity.ts`) maps collection/folder to `/app`, environment to `/environments`, chain to `/chain/<id>`.
3. Open state is `OpenState = {enabled:true,target} | {enabled:false,reason:"deleted"|"undone"} | null` (`src/lib/relay/changesSummary.ts`). The disabled variants are what render the dead "Open".
4. `expandFolderPath` in `openEntity.ts` is private and expands a folder's parents via `useFolderExpandStore` (`setExpanded`, `openCollection`).
5. `MicButton.tsx` shows `LevelMeter` only when `isGrok && grok.analyser && listening` (line ~93). `startCapture` in `src/lib/relay/stt/audioCapture.ts` already builds an `AnalyserNode` from its own stream.
6. Persisted key: `SPEECH_ENGINE_KEY = "rq_relay_speech_engine"` (`src/stores/useRelayStore.ts:28`), values `"browser" | "grok"`.
7. NOT in the original brief, found in code: the engine is also a Relay tool surface. `set_relay_preferences` accepts `speechEngine` (`schemas.ts:773`), and `settingsWrite.ts:180` fails with `GROK_NOT_CONFIGURED` for `"grok"`. `appSettings.ts:41` reads it, and `changeLog.ts:428-434` snapshots and undoes it. This must be removed too (decision D5).
8. User-visible Grok/xAI strings exist in 3 locales: `messages/{en,fr,ja}/settings.json` (lines 137-141) and `messages/{en,fr,ja}/relayDock.json` (lines ~766-774). fr/ja say "Grok (xAI)", so "check every locale" is required.
9. Layout facts: the tool group container is `flex flex-col gap-2` (`MessageParts.tsx` ~272 and ~313). `ChangeCard` is rendered at `MessageParts.tsx:175`. `TurnChangeBar` is rendered at `MessageParts.tsx:372`. `AskUserCard.tsx` currently selects an option and then needs "Send"; options are `flex-wrap` `xs` outline buttons.

## Decisions

- D1: `create_chain` input becomes `{ name }` only. Chains created by Relay are always standalone (`scope: "standalone"`, `id = generateId()`). `strictObject` rejects a stray `collectionId` with a normal tool validation error.
- D2: Existing collection chains stay readable/updatable/openable/undoable. Keep `ensureCollectionChain`, `scope: "collection"`, the optional `Chain.collectionId`, and the `/chain/[collectionId]` route untouched.
- D3: Grouping is a pure view-model step (extend `changesSummary.ts`), shared by inline cards and summary rows. It is not a change-log mutation. A group holds the changeIds it covers; group Undo undoes all of them.
- D4: Dictation engine is derived, never chosen: `useAi = sttConfigured === true && isCaptureSupported()`; else browser Web Speech if supported; else the mic is hidden.
- D5: Remove `speechEngine` from the store, `set_relay_preferences` schema, `appSettings` read, and `changeLog` snapshot/undo. Update the tool description if it mentions engines. This only narrows an existing tool; no new tool is added.
- D6: Persisted-key migration is described under R7.

## Requirements and Acceptance Criteria

### R1. Standalone-only create_chain
- `create_chain` schema is `{ name }`. Description says it creates an empty standalone chain and to add nodes with `add_chain_node`; it never mentions collections.
- `chainWrite.ts createChain` drops the collection branches and the "already has a chain" check; `scope` is always `"standalone"`.
- System prompt and every tool description must never lead the model to create a collection to hold a chain. Add one rule in `systemPrompt.ts`: "Chains are standalone; never create a collection just to hold a chain."
- AC1.1: Unit test: `create_chain {name:"X"}` makes one chain with a generated id, scope `standalone`, and zero new collections.
- AC1.2: Unit test: `create_chain {name:"X", collectionId:"c1"}` fails schema validation.
- AC1.3: Grep of `systemPrompt.ts` and `schemas.ts` finds no text that suggests attaching a chain to a collection (except text describing existing chains in `get_chain`, if any).
- AC1.4: Existing `useChainStore.spec.ts` tests for `ensureCollectionChain` still pass unchanged. A seeded collection chain can still be read, updated (`add_chain_node`), opened, and undone via Relay tools.
- AC1.5: E2E (stub model scripting `create_chain {name}` + `add_chain_node` x4): the collections list (count and ids) is unchanged afterwards and the new chain has no `collectionId`. A stub model only replays scripted calls, so it cannot prove the real model avoids `create_collection`; that is covered by AC1.6.
- AC1.6: Manual/live-model check: "create a sample chain with 3-4 nodes" produces no `create_collection` call (inspect the tool-call log). Not a CI gate.

### R2. open_item names every kind
- New description, roughly: "Open an item so the user can see it. kind: request (opens a tab), chain (opens its page), environment, collection, folder (reveals it in the sidebar)." Source the kind list from `OPEN_ITEM_KINDS` so it cannot drift.
- AC2.1: Unit test: the `open_item` description contains each of `request`, `chain`, `environment`, `collection`, `folder`.
- AC2.2: Unit test: the description is built from or checked against `OPEN_ITEM_KINDS`.
- AC2.3: E2E: "create a chain and open it" ends at `/chain/<id>` of the created chain.

### R3. Open-button matrix (inline cards and summary rows)
| Change | Open |
|---|---|
| Request created/updated | opens its tab |
| Chain created; chain node added/updated | navigates `/chain/<id>` |
| Collection / folder (created or updated) | reveal in sidebar |
| Environment, settings | unchanged from today |
| Tab/navigation ("Opened X"), deleted, undone, read-only/explore steps | NO button (not rendered, not disabled) |

- Reveal: navigate to `WORKSPACE_HOME_ROUTE`, expand the ancestors, select the entity, scroll it into view. Extract and export the expansion helper from `openEntity.ts` (a collection opens via `openCollection`; a folder expands itself and every parent). Reuse it from `useOpenTarget` (exported from `src/components/relay/ChangeCard.tsx`; consumed by `ChangeCard`, `ToolRow` and `TurnChangeBar`) for collection/folder targets. Selection and scroll go through the existing sidebar selection/scroll mechanism; look in `src/stores` and the sidebar (`src/components/layout/SidebarMainTab.tsx` and the tree-row component it renders) (open question Q1 if none exists).
- Drop the disabled branch from `OpenState`: `OpenState = {target} | null`, and `resolveOpen` returns `null` for deleted/undone/missing targets. Update `OpenDisabledReason` consumers and the i18n keys for the disabled tooltip.
- AC3.1: `changesSummary.spec.ts`: each row in the table above yields the stated `open` value; deleted, undone and navigation rows yield `null`; there is no `{enabled:false}` anywhere in the type.
- AC3.2: Component tests: `ChangeCard`, `ChangesSummary` and `ToolRow` render no Open control (`queryByRole('button',{name:/open/i})` is null) for deleted/undone/tab rows.
- AC3.3: Unit test for the reveal helper: given a nested folder, all ancestors are expanded and the collection is opened in `useFolderExpandStore`.
- AC3.4: E2E: create a folder in a collapsed nested collection, click Open, and the folder row is visible, selected and in the viewport, even when the user is already on `/app`.
- AC3.5: E2E: delete a collection via Relay; its row shows no Open (the old disabled button is gone).

### R4. Card density and grouping
- Inline `ChangeCard`: one row, ~28px tall (`h-7`), with no `my-1.5` margin and no extra vertical padding. Tool-group gap tightened (`gap-1`) so consecutive cards sit ~4px apart instead of ~20px stacking.
- Undo and Open are icon-only `Button size="icon"` controls with `ComposerTip`/tooltip and `aria-label`s: reuse the existing i18n labels for Undo and Open (do not hardcode). Keep `RELAY_COARSE_TOUCH_CLASS` for touch targets.
- Grouping: consecutive changes in the same turn to the same chain (`create_chain`, `rename_chain`, `add_chain_node`, `update_chain_node`, `connect_chain_nodes`, `delete_chain_node`) collapse into one card with a label like `Built chain "X" · 4 nodes` (new i18n key with ICU plural). Group Undo calls undo for all member changes (newest first); group Open goes to `/chain/<id>`. A partially blocked undo reports the blocked count using the existing partial-undo messaging.
- Group edge cases: the node count is the number of distinct nodes still present after the group's own adds/deletes (connects and renames do not count). A group with no `create_chain` (edits to an existing chain) uses a label like `Updated chain "X" · N changes`. `delete_chain` is never grouped and has no Open. A group of one change renders as a normal single card. If the chain is deleted later in the same turn, the group has no Open.
- End-of-turn `TurnChangeBar`/`ChangesSummary` renders ONLY when the turn made 2+ changes. Gate on distinct changes after navigation changes are filtered out and groups counted as their member changes, so that "chain + 4 nodes" (5 changes) still shows a summary with one grouped row. A single change shows no summary. The summary rows use the same Open matrix and the same grouping.
- AC4.1: Component test: a `ChangeCard` has no `my-*`/`p-2` classes; a Playwright visual assertion on bounding box height <= 32px. Verify with a screenshot.
- AC4.2: Component test: the Undo and Open buttons have an accessible name, no visible text label, and a tooltip on hover/focus.
- AC4.3: Unit test: create_chain + 4 add_chain_node (+ connects) in one turn produce one group with label count 4; the order and ids are retained; a different chain breaks the group; a non-chain change between them breaks the group.
- AC4.4: Component test: group Undo invokes undo for every member change; afterwards the card shows the undone state with no Open.
- AC4.5: Component test: `TurnChangeBar` renders nothing for 0 or 1 changes and renders with "Undo all" for 2+.
- AC4.6: E2E: the "sample chain with 3-4 nodes" flow shows one grouped card.

### R5. Ask-user card
- Options render as full-width, left-aligned buttons, one per line (`flex flex-col`, `w-full justify-start`), with a hover state (`hover:bg-accent`). Clicking a row submits that answer immediately (calls `onChoose(option)`, dispatches the sent state).
- The free-text `Input` stays. The Send control becomes an icon-only button rendering a white paper-plane icon (lucide `Send`/`SendHorizontal`, whichever the composer already uses; `text-white` on the primary background), `aria-label` = existing `send` string ("Send answer"), `disabled` when the input is empty or whitespace (`canSend`).
- Keyboard: option rows are real `<button>`s (Tab-focusable, Enter/Space activate); Enter in the input submits, with the existing IME `isComposing` guard.
- The `selected` reducer phase becomes unused for options; simplify `src/lib/relay/askUserState.ts` (`reduceAsk`) and its spec accordingly, but keep the `typed`, `sent`, `skipped` and `answeredViaComposer` phases, and the settled-card rendering.
- Edge: after a click the card settles at once; a second click (double-click) or a click on another option does nothing. Long option text wraps inside the row (no truncation, no horizontal overflow).
- AC5.1: `AskUserCard.spec.tsx`: clicking an option calls `onChoose` once with that text and no Send click is needed; a double-click still calls it exactly once.
- AC5.2: Options are stacked: each option's bounding box has the same left edge and width as the others, and top edges strictly increase (Playwright).
- AC5.3: The Send button has `name "Send answer"`, contains the white paper-plane icon svg and no text; it is disabled when the input is empty and enabled after typing; Enter in the input submits; IME composition Enter does not.
- AC5.4: `relay-a11y` and `relay-improvements-a11y-axe` e2e specs still pass on the card; focus order is options, then input, then Send.

### R6. Scope guard in system prompt
- Add a `SCOPE_RULES` block to `src/lib/relay/server/systemPrompt.ts` (next to `CAPABILITIES`, included in the assembled array). It states:
  - In scope: the Requestr workspace and features (requests, collections, folders, environments, chains, history, settings) and general HTTP/API concepts (status codes, auth schemes like OAuth, headers, REST/GraphQL, scripts and tests for requests).
  - Off-topic (general-purpose coding unrelated to APIs/requests, math, chemistry, essays, trivia, etc.): reply with a brief, friendly decline naming what Relay can help with; give no partial answer and make no tool calls.
- AC6.1: Unit test (`systemPrompt.spec.ts`): the built prompt contains the scope block, naming both the in-scope list and the decline behaviour.
- AC6.2: Eval/manual check against the live model: "balance this chemical equation", "what is 17*23", "write an essay on Rome" are each declined with zero tool calls; "what does a 429 mean", "how do I set up OAuth 2 in a request" and "write a test script for this request" are answered.
- Note: prompt text is not deterministic, so AC6.2 is a manual or live-model check, not a CI gate.

### R7. Dictation: automatic engine, no picker, no vendor names
- Remove the engine `Select` from `src/components/settings/RelaySection.tsx` (and its `settings.speechEngine` translations except where reused), `setSpeechEngine`, `speechEngine` state, `SPEECH_ENGINE_OPTIONS`/`isSpeechEngine`/`getEffectiveSpeechEngine` (these live in `src/lib/relay/speechEngine.ts`; keep that file only as the home of the new resolver, and delete its spec cases for removed functions) (replace with one pure `resolveDictationEngine({ sttConfigured, captureSupported, browserSupported }) -> "ai" | "browser" | null`).
- `MicButton`: always calls `useSttConfigured(true)` (request on mount of the mic; reconsider the lazy fetch: see Q2). While the status is loading (`null`) use the browser engine so the mic never flashes away; when the status resolves and AI is usable, switch only if not currently listening.
- Silent fallback: if AI is not configured or capture is unsupported, use browser Web Speech with no notice. If AI fails at runtime (`upstreamAuth` and similar), show a generic error with no vendor name and no pointer to the removed picker; the user can retry and the next start uses the resolved engine. Mic hidden only when no engine works.
- Migration: on store init, remove `rq_relay_speech_engine` from localStorage via `removePreference`, once, in a try/catch (never swallow errors silently: log with context). The value is otherwise ignored, so no stored `"grok"` can force or block anything. Do not re-write the key. No version bump is needed because deleting is idempotent.
- Waveform in both modes: `LevelMeter` renders while listening in either engine. For browser mode add a hook (for example `useMicLevel(active)` in `src/hooks/`) that, while `listening`, opens `getUserMedia({audio:true})` plus an `AudioContext`/`AnalyserNode`, and releases it (stop tracks, `context.close()`) on stop, unmount, error and permission denial. It must not run in AI mode (AI already exposes its analyser from `audioCapture.ts`). A denied second stream degrades to no meter and must not break dictation. Extract a small shared `createAnalyserFromStream` helper that `audioCapture.ts` also uses, to avoid duplicating the graph setup (DRY).
- No vendor names in the UI. Rewrite the en/fr/ja strings, using the product word "AI" (translated naturally per locale):
  - `settings.json` `speechEngine.*`: delete the whole group (picker removed). If the Relay section keeps a privacy line, use: "Dictation can send audio to a server for AI transcription." (fr/ja equivalents).
  - `relayDock.json`: `voice.engine.grok` becomes `voice.engine.ai` ("AI"); `grokPrivacyNote` becomes "With AI dictation, audio is sent to a server for transcription." (rename the key to `aiPrivacyNote`); `grokErrors.upstreamAuth` becomes "AI transcription isn't available right now. Try again, or type your message." (no pointer to Settings).
  - Rename the `grokErrors` group to `aiErrors` and update the `t(...)` calls. Internal identifiers (`useGrokDictation`, etc.) may keep Grok names.
- AC7.1: Unit test for `resolveDictationEngine` covers: configured+capture gives ai; not configured gives browser; capture unsupported gives browser; browser unsupported and AI unusable gives null; loading status gives browser.
- AC7.2: `RelaySection.spec.tsx`: no combobox/Select for dictation engine renders.
- AC7.3: Grep gate: `grep -rniE "grok|xai" messages/` returns nothing, and `grep -rniE "grok|xai" src --include=*.tsx` shows only identifier names, never rendered strings. Add this as a unit test that scans the locale JSONs.
- AC7.4: Locale key parity: en/fr/ja have identical key sets in both files (existing parity test must pass).
- AC7.5: Migration test: with `rq_relay_speech_engine="grok"` in localStorage before init, the store loads without error, the key is gone afterwards, and the mic still resolves from server/browser capability.
- AC7.6: `MicButton.spec.tsx`: in browser mode (stubbed `speechStub.ts`, STT unconfigured) `relay-mic-meter` appears while listening; a second `getUserMedia` call is made; on stop, unmount and `getUserMedia` rejection, tracks are stopped and the context is closed (assert via mock). In AI mode only one stream exists (no duplicate).
- AC7.7: Mic hidden test: neither SpeechRecognition nor capture available gives no `relay-mic` element.
- AC7.8: `set_relay_preferences` no longer accepts `speechEngine` (schema test); `registryGuarantees.spec.ts`, `settingsWrite.spec.ts`, `changeLog` snapshot/undo specs updated and green; an old change-log entry carrying `speechEngine` is ignored on undo without throwing.
- AC7.9: `MicButton.spec.tsx`: while the STT status is loading the mic uses the browser engine; if the status resolves to AI-usable mid-listen, the engine does not switch until listening stops; an AI runtime error (`upstreamAuth`) renders the generic `aiErrors` text with no vendor name and no Settings pointer.

## Tech Stack
Next.js (App Router), React, TypeScript, next-intl (`messages/{en,fr,ja}`), Zustand (`src/stores`), Zod tool schemas, Vitest + Testing Library, Playwright. Package manager: **bun** only; never run `npm` at the root.

## Commands
```
Install:     bun install
Typecheck:   bun run tsc --noEmit        (run once, only after the full task is complete)
Lint:        bun run lint
Unit tests:  bun run vitest run <path>   (per touched spec, e.g. src/lib/relay/changesSummary.spec.ts)
E2E:         PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/relay/<spec>
E2E (prod):  E2E_SERVER=prod bunx playwright test e2e/qa/relay/<spec>
```
The dev server is always running: never start it. Run only the targeted specs, never the full e2e suite. Confirm the exact script names in `package.json` before use.

## Project Structure (touched areas)
```
src/lib/relay/tools/{schemas,chainWrite,ui,settingsWrite,appSettings}.ts
src/lib/relay/server/systemPrompt.ts
src/lib/relay/{changesSummary,openEntity,changeLog,speechEngine,askUserState}.ts   (+ changeGroups.ts only if changesSummary.ts passes ~300 lines)
src/lib/relay/stt/audioCapture.ts           + new createAnalyserFromStream.ts (shared analyser helper)
src/components/relay/{ChangeCard,ChangesSummary,TurnChangeBar,ToolRow,MessageParts,AskUserCard,MicButton,LevelMeter,SpeechPrivacyNote}.tsx   + new ChangeGroupCard.tsx
                                            (useOpenTarget is exported from ChangeCard.tsx; there is no hook file)
src/components/layout/SidebarMainTab.tsx    sidebar tree (no src/components/sidebar/ directory exists)
src/components/settings/RelaySection.tsx
src/hooks/{useSpeechDictation,useGrokDictation,useSttConfigured}.ts   + new useMicLevel.ts
src/stores/{useRelayStore,useFolderExpandStore}.ts   + new useSidebarRevealStore.ts (Q1 default)
messages/{en,fr,ja}/{settings,relayDock}.json
e2e/qa/relay/relay-v2-*.spec.ts, relay-improvements-{voice,a11y-mic,a11y-axe}, relay-a11y, relay-confirm; e2e/fixtures/speechStub.ts
e2e/qa/relay/relay-conversation-polish-{chain,open,cards,ask,voice}.spec.ts + relay-conversation-polish.spec.ts (new)
```

## Code Style
Follow `~/.claude/skills/code-style`, `typescript-best-practices`, `vercel-react-best-practices`. Named constants, no magic strings, early returns, functions under about 30 lines, options object past 3 params, comments explain why. All UI strings go through next-intl. Example of the target shape:
```ts
/** Which engine dictation uses; derived from capability, never chosen by the user. */
export function resolveDictationEngine(caps: DictationCaps): DictationEngine | null {
  if (caps.sttConfigured === true && caps.captureSupported) return "ai";
  return caps.browserSupported ? "browser" : null;
}
```

## Testing Strategy
- Unit (Vitest): `changesSummary.spec.ts` (matrix, grouping), new `resolveDictationEngine` spec, `systemPrompt.spec.ts`, `chainWrite`/schemas specs, `useChainStore.spec.ts` (unchanged, regression), `audioCapture.spec.ts` (shared helper), `askUserState` spec, locale-scan test.
- Component: `ChangeCard`, `ChangesSummary`, `TurnChangeBar`, `AskUserCard`, `MicButton` (+ `MicButton.grok.spec.tsx`), `RelaySection` specs.
- E2E (targeted only): `relay-v2-tools-entities`, `relay-v2-tools-nav`, `relay-v2-chain-live`, `relay-v2-changes`, `relay-v2-stt`, `relay-improvements-voice`, `relay-improvements-a11y-mic`, `relay-improvements-a11y-axe`, `relay-a11y`, `relay-confirm`, plus new per-area specs `relay-conversation-polish-{chain,open,cards,ask,voice}.spec.ts` and a combined `relay-conversation-polish.spec.ts` walkthrough for the automatable Objective flows. Update specs that assert the old picker, the old "Send" text, "Grok" labels, or the disabled Open.
- Visual: Agent Browser screenshots of the compact card, grouped card, ask card and the browser-mode waveform (use a repo-unique session and close it).
- No tests for `src/components/reactbits/`.

## Boundaries
- Always: bun; i18n strings in all three locales; targeted tests only; read-before-edit; keep existing collection chains working; remove dead code (no commented-out code).
- Ask first: adding dependencies; changing the persisted chain data shape; changing the STT provider or server route.
- Never: migrate existing chains; add new agent tools; run the dev server or the full e2e suite; run npm; commit without being told to; expose "Grok"/"xAI" in any UI string.

## Suggested Task Order (for the plan phase)
1. R1 + R2 (schema, impl, prompt, tool text) with unit tests.
2. R6 scope rules (small, isolated prompt change).
3. R3 model: drop disabled `OpenState`, reveal helper export, `useOpenTarget` collection/folder reveal.
4. R4 grouping view-model, then `ChangeCard` compaction, icon buttons, summary gating.
5. R5 ask card and reducer simplification.
6. R7 engine resolver, store/tool removal, migration, `useMicLevel`, locale rewrites.
7. Update e2e specs, add the new flow spec, run targeted suites, take screenshots, then one typecheck and lint at the end.

## Success Criteria
All AC items above pass; the seven Objective flows behave as described (six via the e2e walkthrough, the off-topic decline via the manual AC6.2 check); targeted unit, component and e2e suites are green; the final typecheck and lint are clean; grep shows no user-visible Grok/xAI.

## Open Questions (non-blocking; defaults chosen)
- Q1: A grep of `src/stores` and `src/components/layout/SidebarMainTab.tsx` for `reveal`/`scrollIntoView` found no existing mechanism. Default: add a minimal transient `useSidebarRevealStore` (Zustand) that the tree row subscribes to; the implementer should do one wider search first (e.g. the selection state used by relay pills) and reuse it if found.
- Mixed-turn note: changes to different entities in one turn stay separate cards; the grouping only merges same-chain runs.
- Q2: `useSttConfigured(true)` now fires a status request whenever the mic mounts (previously only when the stored engine was grok). Default: accept one cached request per session.
- Q3: Group Undo when only some members are undoable: default is to undo the unblocked ones and show the existing "N could not be undone" notice.
