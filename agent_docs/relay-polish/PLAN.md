# Relay Polish: Implementation Plan

Inputs: `SPEC.md` (Draft v1, all section 12 questions RESOLVED). Planning only, no feature code. Conventions inherited from `agent_docs/relay-agent/PLAN.md`: bun/bunx only, never npm; the dev server is already running (never start it); no commits unless the build-phases flow commits after the verifier PASS; vitest `*.spec.ts(x)` beside source (>= 80% per touched/new file); Playwright Gherkin-first (`e2e/scenarios/relay/relay-polish-<area>.feature.md`, ids `REL-POL-<AREA>-nn`, `@qa`, `seededPage`, `relayRoutes.ts` scripted streams, `getByTestId` first, no `waitForTimeout`); typecheck (`bunx tsc --noEmit`) once at the end of each full phase, not per edit; no tests under `src/components/reactbits/`; browser checks via the agent-browser skill only.

## 1. Grounding (repo facts verified while planning)

- `RelayRoot` (`src/components/relay/RelayRoot.tsx`) is a sibling of `{children}` inside `AppProviders` (`src/providers/AppProviders.tsx`, inside `TooltipProvider` > `LocaleWrapper` > `ChainDevProvider`). It owns the pathname gate (`/` excluded), the mobile query (`<768px` => `Sheet`), `useRelayShortcut`, a `useReserveDockSpace` body-padding hack and the lazy `RelayDockWithMessages`. `RelayDock` "aside" is `fixed inset-y-0 right-0 z-40` (so `position: "left"` is a no-op today; a known limitation, out of scope). `ResizeHandle.tsx` is the custom px handle (pointer drag and ArrowLeft/ArrowRight, 16px steps) and `useRelayStore` holds the px `width` (`clampRelayWidth` to `320px..60vw`, default 400px, persisted under `rq_relay_width`). These all stay; P3 only changes the limits.
- `MainLayout` (`src/components/layout/MainLayout.tsx`) is `flex h-screen w-full overflow-hidden`, with a mount-gated (`mounted`) desktop resizable group (20% / 80%) and a mobile layout. It only exists on `/app` and `/chain/[collectionId]`.
- `RelayToggleButton` is lazily imported in `LeftPanel.tsx` (line ~157, inside the icon-row `TooltipProvider`). `TabBar.tsx` renders `{tabs.length > 0 && <TabListDropdown />}` in the right-end `flex shrink-0 items-center gap-0.5 px-1` block (line ~237).
- Rendering bug root cause (confirmed): `RelayConversation.tsx` `messageText` (line ~89) joins text parts with `""`; `MessageItem` (line ~249-267) renders `toolParts(...)` first and one joined `RelayMarkdown` after. `RelayDock.tsx` `lastUserMessageText` (line ~41) has the same join.
- Context: `contextBuilder.ts` exports `computeContextChips`, `selectActiveChips`, `buildRelayContext`, `buildChatPayload`, `chainIdFromPathname`; `chips.ts` exports `ContextChipKind`, `chipKey`, `isAutoChip`; `slashCommands.ts` has `SlashCommandId = explain | assert | curl | docs | clear`, `findSlashQuery`, `filterSlashCommands`, `needsClearConfirm`; `mentions.ts` has `findActiveMention`, `replaceMention`; `RelayPicker` consumes `useRelayPickerItems` (hook in `src/hooks/`) and `RelayPickerRow`.
- Tool gating: `schemas.ts` (746 lines) holds `RELAY_TOOL_SCHEMAS[name].kind` (`read | ui | auto | confirm`), `requiresBulkApproval`, `awaitsUser`; `registry.ts` (256 lines) holds `ToolContext`, `registerConfirmGate`, `previewConfirmation`, `executeTool`/`runValidated`. The server imports `schemas.ts`, so it must stay free of store/DOM imports.
- Existing e2e for relay: 31 spec files under `e2e/qa/relay/` (`relay-*.spec.ts`, `relay-improvements-*.spec.ts`) with matching `.feature.md` and `e2e/scenarios/relay/check-ids.sh`. Seven of those pairs exercise surfaces this feature rewrites (section 6).
- `useKeyboardShortcuts.ts` has no `o` case (conflict check done in SPEC); IndexedDB thread schema is unchanged by this feature (message parts are already stored in stream order).

## 2. Architecture decisions

1. **Keep the fixed dock; change only its width limits** (RP-110, user decision: the ResizablePanel migration is not being done). `RelayDock` aside, `ResizeHandle` and `useReserveDockSpace` stay. Width stays px in `useRelayStore`; the bounds become `max(30vw, 320px)`..`max(40vw, 320px)` with a `30vw` default, via named constants and pure helpers (`getRelayMinWidth`, `getRelayMaxWidth`, `getRelayDefaultWidth`, `clampRelayWidth`) that the store setter, `readWidth`, `ResizeHandle` and a window-resize re-clamp all share, and that the aside's inline style and the reserve-space `clamp()` mirror in CSS. Mobile (`<768px`) and `/` are unchanged.
2. **Context model: attachments are the only source of truth** (RP-201..205). `attachedItems` (new `tab` kind) feeds `buildChatPayload`; the always-sent `workspace` index stays and is disclosed (Q1). `get_active_context` keeps its name (persisted threads contain parts with that name) but returns attached items only via `ToolContext.attached`.
3. **One mention-menu component, parameterised** (RP-211, RP-204, RP-215). `MentionMenu` takes `{ kind?: "request" | "collection" | "environment" | "chain" | null, hint?: string, pinCurrentTab?: boolean, anchor: "composer" }` so the `@` flow, the slash target-required flow (RP-204) and the launcher Attach rows reuse one component instead of forking. It reuses `useRelayPickerItems`, `RelayPickerRow`, `ROW_HEIGHT_PX`, `PICKER_RESULT_LIMIT`, `pickerNav.ts` and the same `@tanstack` virtualizer setup.
4. **`approvalNeeded` is the single approval truth** (RP-221). Pure function in `schemas.ts`; the runtime (`executeTool`, `useRelayChat`) and the capabilities badges (RP-206) both call it. The decision is recorded per `toolCallId` at `onToolCall` time so flipping the mode mid-card cannot orphan or auto-approve a card. The mode never enters the server payload or tool input.
5. **Stores follow CLAUDE.md**: `useRelayPermissionStore` (persisted `rq_relay_permission_mode`), `useRelayRecentStore` (persisted, names/ids, cap 5), `useRelayStore` slimmed (auto-chip state removed; `width` stays, now clamped to the 30vw..40vw range).
6. **Stay shippable by keeping the old surface until its replacement lands** (see 3.1): `RelayPicker` and its `+` popover survive until the launcher; ContextChips survives until ComposerPills; interim static starters survive until capabilities.
7. **No new routes, tools or dependencies.** The only server-side change is the system prompt rule in `systemPrompt.ts` (RP-203).

## 3. Phase order, and why it differs slightly from SPEC section 11

### 3.1 Cross-phase hand-offs (each is wired in exactly one phase; no phase ships half a link)

| Hand-off | Resolution |
|---|---|
| RP-215 Settings rows (permission shield, capabilities) point at features from later phases | Launcher (P8) ships with only the Recent, Attach, Actions sections. The "Permission mode" row is added in P9 (when the shield exists) and the "What Relay can do" row in P10. Section order (Recent, Attach, Actions, Settings) is preserved; Settings section simply appears in P9. |
| RP-208 lists a shield in the toolbar but permissions land in P9 | P6 composer box ships `+`, pills, mic, send/stop. P6 acceptance criteria do NOT require a shield. P9 inserts the shield immediately after `+` (tab order becomes textarea, `+`, shield, pills, mic, send). |
| RP-205 removes tab-derived suggestions before RP-206/207 exist | P5 replaces them with a small interim static, tab-independent starter set (i18n keys `emptyState.starters.*`, three prompts). P10 deletes the interim set and renders the capability categories instead. |
| RP-204 (B1) needs the mention menu (P6) but lives with slash actions | P6 designs the `MentionMenu` API (`kind` prefilter, `hint`, pinned Current tab). P7 (slash) wires RP-204 to it; P8 (launcher) reuses it for Attach rows. |
| RP-216 (remove `RelayPicker`) | `RelayPicker`, its popover and its kind tabs stay fully working through P5-P7 (the `+` button keeps opening it, re-anchored inside the P6 composer box). P8 swaps `+` to the launcher and deletes the picker UI in the same phase. |
| RP-202 spans three phases | P5: `tab` chip kind, `describeActiveContext` redacted shape, payload, and a temporary "Current tab" row at the top of the legacy `RelayPicker` so the tab can still be attached. P6: pinned "Current tab" section in the `@` menu. P8: Current tab in the launcher Attach section (and the temporary picker row is deleted with the picker). |
| RP-103 spans phases | P2: header controls (conversation trigger, New chat + chord, Close + toggle chord). P6: composer controls (`+`, mic, send/stop). P9: shield. P10: capabilities header button. |
| RP-213 / i18n | Each phase adds its own keys to en, fr, ja in the same phase (parity spec stays green every phase); P11 does the final removed-key sweep. |
| `check-ids.sh` parity | Each phase adds its scenario file and spec together. |

### 3.2 Order and rationale

Order: P1 bugs, P2 shell identity, P3 dock width limits (small; kept ahead of threads so later UI is verified at the real width range), P4 conversation menu, P5 context removal, P6 composer + mention, P7 slash, P8 launcher, P9 permissions, P10 capabilities, P11 cleanup and sweep.

- **Deviation from the requested order (slash before launcher):** the launcher's Actions section lists `SLASH_COMMANDS`, and its "Paste cURL" row prefills `/import `, which does not exist until the slash phase. Doing slash first means the launcher ships complete with no dead rows. The mention-menu API is designed in P6 so nothing is blocked.
- **Dock width before conversation menu:** RP-110 is now a small change (constants, clamp helpers, resize re-clamp). Doing it early still means every later UI phase is designed and verified at the real 320px minimum width (Q2).
- **No trailing "test migration" phase:** each phase updates the specs it breaks (section 6) so the tree is green after every phase. P11 only sweeps leftovers.
- **Independence:** P1 (rendering fixes, thumbs) has no dependency and could run in parallel with P2, but both touch only disjoint files, so they stay separate phases that may be built concurrently by different agents. P4 depends only on P1/P2 (shared header, `RelayHeader`) and can swap order with P3 freely.

### 3.3 Dependency graph

```
P1 (RP-108,109,226) ──┐
P2 (101,102,103a,106,106b) ─┬─> P3 (110) ──> P4 (104,105,107)
                            │
                            └──────────────────────────────┐
P3 ──> P5 (201,202a,203,205) ──> P6 (208-213,202b) ──> P7 (217-219,204) ──> P8 (214-216,202c)
                                                                              │
P5 (tool/ToolContext changes) ──> P9 (220-225; shield into P6 composer; row into P8 launcher)
P9 ──> P10 (206,207; badges need approvalNeeded) ; P8 ──> P10 (launcher row)
P1..P10 ──> P11
```

Hard orderings: P5 before P6 (attachments are the only context before the pill UI is built); P6 before P7 (RP-204 needs the menu API) and before P8; P7 before P8; P9 before P10 (badges use `approvalNeeded`); P6 and P8 before P9 (shield slot and launcher Settings row). Single-owner files: `useRelayStore.ts` is edited in P3 (width clamp), P5 (chips), both sequential; `schemas.ts`/`registry.ts` in P5 (`get_active_context`, `ToolContext.attached`) then P9 (`approvalNeeded`, `describeGeneric`); `messages/*/relayDock.json` is additive in every phase.

## 4. Design process gate (applies to every UI RP; carried into TASKS)

Per SPEC section 3, every task that creates or changes UI carries these steps explicitly in TASKS.md, in this order, and a UI task is not Done without a one-line note naming what each skill changed:

1. DESIGN: `ui-ux-pro-max` (layout, hierarchy, all states, light + dark, density at 320 / 400 / 480px panel width).
2. REFINE: `impeccable` and `layout` over the design (spacing rhythm, alignment, tokens, motion).
3. IMPLEMENT: shadcn primitives and design tokens only, named constants for sizes and timings.
4. VERIFY: agent-browser screenshots at 1440px and at the 320px panel width, light + dark, saved under `agent_docs/qa/relay-polish/p<phase>-<name>-<width>-<theme>.png` (the TASKS.md convention) and referenced from the task.

Exempt (pure logic, no UI gate, per SPEC section 3 exactly): RP-106b, RP-108, RP-201, RP-203, RP-219, RP-221, RP-224, RP-225. All other RP ids are gated. For RP-220 (store only) the gate step is recorded as "no visual surface; design handled under RP-222" so the verifier does not reject it.

## 5. Phases

Every phase ends with a checkpoint: targeted unit specs green, listed e2e specs green, `bunx biome check <touched files>`, `bunx tsc --noEmit` once at the end of the phase, `bash e2e/scenarios/relay/check-ids.sh`, and (UI phases) screenshots recorded. Task sizes are S/M (1-5 files); anything larger is split in TASKS.

### P1. Rendering bug fixes and feedback removal

Slice: A7 and A8 no longer reproduce; thumbs gone. Smallest, independent, immediately visible win.
- **RP ids:** RP-108, RP-109, RP-226 (design gate: RP-109 and RP-226; RP-108 exempt).
- **Tasks:** (a) `joinTextParts`/`messageText` pure helper with `"\n\n"` join, used by Copy, Regenerate prompt, `lastUserMessageText` (thread titles already join with a space in `deriveThreadTitle`; unchanged) (RP-108); (b) `MessageItem` iterates `message.parts` in order, `step-start` renders nothing, consecutive tool rows grouped, `TurnChangeBar` once after the last part, per-part `RelayMarkdown` memoized and keyed by part index, virtualization/estimated heights retained (RP-109); (c) remove thumbs, `rating`/`handleRate`, `relay_feedback`, `RelayFeedbackRating`, i18n keys, `rg` check, annotate relay-improvements docs as superseded (RP-226).
- **Files:** `src/components/relay/RelayConversation.tsx`, `RelayDock.tsx`, `MessageActions.tsx`, `src/lib/relay/telemetry.ts`, `messages/{en,fr,ja}/relayDock.json`, new `src/lib/relay/messageText.ts` (+ spec), `agent_docs/relay-improvements/{SPEC,PLAN,TASKS}.md` (annotation only).
- **Specs migrated here:** `RelayConversation.spec.tsx`, `MessageActions.spec.tsx`, `telemetry.spec.ts`, `relay-chat` (rendering order assertions if any), `relay-improvements-qol-actions` (+ `.feature.md` thumbs scenarios, and the reference in `relay-improvements-qol-rewrite.feature.md`).
- **Tests:** unit for `joinTextParts` and part ordering (`compareDocumentPosition` with text -> ask_user and tool -> text fixtures); e2e `relay-polish-msg` (`REL-POL-MSG-nn`): scripted text/tool/text and text/ask_user streams, Copy returns two paragraphs, `rg "relay_feedback|thumbsUp|thumbsDown|relay-thumbs"` empty.
- **Done when:** the screenshot repros no longer reproduce; only Copy and Regenerate remain on assistant messages; an old persisted thread (text/tool/text parts) renders correctly with no migration.

### P2. Shell identity: logo, toggle in tab bar, header tooltips, chords

Slice: Relay looks and is reachable like a finished feature.
- **RP ids:** RP-101, RP-102, RP-103 (header part), RP-106, RP-106b (exempt). Design gate on all except RP-106b.
- **Tasks:** (a) `RelayLogo` inline SVG (`currentColor`, `className` size, `data-testid="relay-logo"`, aria-hidden when adjacent to text) used in toggle, header and empty state; remove `Sparkles` from relay/TabBar (RP-101); (b) remove toggle + dynamic import from `LeftPanel.tsx`, render lazily in `TabBar.tsx` right of `TabListDropdown`, rendered also with zero tabs, `isRelayEnabled()` gate and testids unchanged (RP-102); (c) tooltips (`Tooltip` + `Kbd`) on conversation trigger, New chat, Close; same `aria-label` source (RP-103); (d) `RELAY_NEW_CHAT_SHORTCUTS` in `constants.ts`, capture-phase handler in `useRelayShortcut.ts` (skips `.cm-editor, .monaco-editor`; opens Relay + new chat when closed; no-op on `/` or disabled), `KeyboardShortcutsModal` entry "New Relay chat", unit tests incl. the no-`preventDefault`-collision assertion against `useKeyboardShortcuts` (RP-106, RP-106b).
- **Files:** new `src/components/relay/RelayLogo.tsx`; `RelayToggleButton.tsx`, `RelayHeader.tsx`, `EmptyState.tsx`; `src/components/layout/{LeftPanel,TabBar,KeyboardShortcutsModal}.tsx`; `src/hooks/useRelayShortcut.ts`; `src/lib/relay/constants.ts`; shortcut docs (`src/app/settings/constants.ts`, `ShortcutsSection.tsx`, `messages/*/shortcuts.json`) including a one-line Firefox note; i18n.
- **Specs migrated here:** `RelayToggleButton.spec`, `LeftPanel.spec`, `TabBar.spec`, `KeyboardShortcutsModal.spec`, `useRelayShortcut.spec`, `RelayHeader.spec`, `EmptyState.spec` (logo), `relay-shell` (toggle location only; dock geometry assertions move in P3).
- **Tests:** unit as above; e2e `relay-polish-shell` (`REL-POL-SHELL-nn`): toggle far right with and without tabs and with tab overflow, tooltips on hover/focus within 700 ms with keycaps, chord in composer starts a new chat, `aria-expanded` flips.
- **Done when:** no `Sparkles` import under `src/components/relay/` or `TabBar`; toggle no longer in the sidebar; bundle split preserved (dynamic import retained).

### P3. Dock width limits

Slice: the existing dock is limited to `max(30vw, 320px)`..`40vw` with a 30vw default. No layout migration (user decision): `RelayDock` aside, `ResizeHandle` and `useReserveDockSpace` stay. Not doing: `ResizablePanel`/`react-resizable-panels`, a panel host in `AppProviders`, or making `position` live (known existing limitation, out of scope).
- **RP ids:** RP-110 (pure logic plus a constant change; no new UI, so no design gate beyond verifying the existing UI at the new widths).
- **Tasks:** (a) constants `RELAY_MIN_WIDTH_VW = 30`, `RELAY_MAX_WIDTH_VW = 40`, `RELAY_DEFAULT_WIDTH_VW = 30` (replacing `RELAY_DEFAULT_WIDTH_PX`), `RELAY_MIN_WIDTH_PX = 320` kept as the floor; (b) `useRelayStore` helpers `getRelayMinWidth` / `getRelayMaxWidth` / `getRelayDefaultWidth` / `clampRelayWidth` (floor wins when 320px > 40vw), `readWidth` re-clamps on load and defaults to 30vw, `setWidth` clamps, a `resize` listener re-clamps the stored width; (c) `ResizeHandle` pointer/keyboard clamp and `aria-valuemin`/`aria-valuemax` reflect the effective range; `RelayDock` aside inline `minWidth`/`maxWidth` and `useReserveDockSpace` `clamp()` use the same bounds in CSS; (d) update unit specs and the e2e layout specs that assert dock size, plus the new `relay-polish-panel` spec.
- **Files:** `src/lib/relay/constants.ts`, `src/stores/useRelayStore.ts`, `src/components/relay/{ResizeHandle,RelayDock,RelayRoot}.tsx`.
- **Specs migrated here:** `RelayDock*.spec`, `RelayRoot.spec`, `ResizeHandle.spec`, `constants.spec`, `useRelayStore.spec`, `relay-improvements-layout`, `-a11y-layout`, `-a11y-keyboard` (resize keys and bounds), `relay-shell` (only if it asserts dock geometry).
- **Tests:** unit for the clamp math (1440 -> 432..576, 1100 -> 330..440, 900 -> 320..360, 780 -> 320 floor wins over 312), store default/clamp/persist/re-clamp, handle keyboard and aria range. E2E `relay-polish-panel` (`REL-POL-PANEL-nn`): default 432px at 1440, drag clamped to 30-40vw, never < 320px after drag-to-min and after window shrink, reload keeps the clamped width, keyboard resize respects bounds, page content not covered, mobile sheet unchanged at 767px. `rg` check for `RELAY_DEFAULT_WIDTH_PX`.
- **Done when:** AC for RP-110 pass; UI screenshots at 1440 / 1100 / 780 / 320.

### P4. Conversation overlay and rows

Slice: threads feel like Notion/Cursor, no layout push.
- **RP ids:** RP-104, RP-105, RP-107 (design gate on all).
- **Tasks:** (a) `relativeTime.ts` pure `formatRelativeTime(timestamp, now)` with named threshold constants, i18n `threads.time.*` ICU keys, full-date `title` via `Intl.DateTimeFormat` (RP-104); (b) row `...` menu (Rename / Delete) replacing pencil/trash, time swaps for the trigger on hover/focus-within without layout shift, immediate delete + `RELAY_UNDO_TOAST_MS` Undo via `restoreThread`, removal of `AlertDialog` and its testids (RP-105); (c) conversation list as a portaled floating `Popover`/`DropdownMenu` overlay (`bg-popover`, border, `shadow-lg`, `sideOffset` constant, `z-50`, `max-h` scroll, focus return to trigger), search + Today/Yesterday/Earlier groups kept (RP-107).
- **Files:** `src/components/relay/ThreadList.tsx`, `RelayHeader.tsx`, new `src/lib/relay/relativeTime.ts` (+ spec), `messages/*/relayDock.json`; appendix-A testids (`relay-thread-overlay`, `relay-thread-time`, `relay-thread-menu-*`).
- **Specs migrated here:** `ThreadList.spec`, `RelayHeader.spec`, `relay-threads` (delete confirm dialog scenarios become delete + Undo).
- **Tests:** boundary unit tests (59/60 s, 59/60 m, 23/24 h, 6/7 d, 29/30 d, 364/365 d, negative skew); e2e `relay-polish-threads` (`REL-POL-THREADS-nn`): no pencil/trash at rest, `...` on hover and keyboard, rename Enter/Esc/blur, delete + Undo restores same position, overlay does not move composer (pixel compare), click-outside / Esc / select close, 320px no horizontal scroll.

### P5. Context model: remove implicit context

Slice: nothing reaches the model unless attached; attaching still works through the legacy picker.
- **RP ids:** RP-201 (exempt), RP-202 (part a), RP-203 (exempt), RP-205 (gate applies to the empty-state/follow-up UI). RP-204 deferred to P7.
- **Tasks:** (a) remove `computeContextChips`, `selectActiveChips`, `isAutoChip`, `useAvailableChips`, `AutoChipLabel`, `dismissAutoChip`, `dismissedAutoChipTabId`, `removedChipKeys`, `removeChip`, `resetRemovedChips`, `draftChips`, route chain chip; `buildChatPayload` input becomes `{messages, store, redact, attachedItems}`; `ContextChipKind` adds `tab`; `describeAttached` handles `tab` via the redacted `describeActiveContext` shape; `redactDeep` stays last (RP-201, RP-202a); (b) `ToolContext.attached` populated by `useRelayChat` from the store at call time; `get_active_context` keeps its name and returns attached items only; `update_tab_request` description now requires an attached tab; audit that no tool defaults to the active tab; `systemPrompt.ts` rule "nothing is known unless attached; ask the user to attach Current tab" (RP-203); (c) `suggestions.ts`/`deriveSuggestions`/`useSuggestionContext` replaced by an interim static starter set; `followUps.ts` audited to depend on the last assistant turn only (RP-205); (d) temporary "Current tab" row at the top of the legacy `RelayPicker` (disabled with "No tab open"); `ContextChips` shows attached items only.
- **Files:** `src/lib/relay/{contextBuilder,chips,suggestions,followUps}.ts`, `src/stores/useRelayStore.ts`, `src/hooks/useRelayChat.ts`, `src/lib/relay/tools/{schemas,registry,workspaceRead}.ts`, `src/lib/relay/server/systemPrompt.ts`, `src/components/relay/{ContextChips,EmptyState,RelayPicker}.tsx`, `src/hooks/useRelayPickerItems.ts`, i18n.
- **Specs migrated here:** `ContextChips.spec`, `EmptyState.spec`, `contextBuilder.spec`, `chips.spec`, `useRelayStore.spec`, `suggestions.spec`, `followUps.spec`, `useRelayChat.spec`, `workspaceRead`/`get_active_context` specs, `RelayPicker*.spec` (Current tab row), `relay-improvements-context-chip`, `-context-payload`, `-context-suggestions`, `-pills`, `-picker`, `relay-privacy`, `relay-chat`.
- **Tests:** unit for `get_active_context` with 0, 1, many attached items; payload builder with each kind and redaction ordering (secret env `[redacted]`, `shareValues` gating); a replayed persisted thread containing an old `get_active_context` part renders, continues and is redacted; e2e `relay-polish-ctx` (`REL-POL-CTX-nn`): request interception shows no `activeTab` / `collection` / `environment` keys with a request open and nothing attached; attaching a request or Current tab sends exactly that; new chat clears attachments; scripted "explain this response" asks for attachment; no "Using: ... current tab" text in DOM.
- **Done when:** empty state shows the same interim starters regardless of the open tab.

### P6. Unified composer, pills, `@` mention menu

Slice: the Cursor/Notion-style box and the wide, local `@` menu.

**Not in P6 (expected until P8):** Clicking `+` still opens the legacy `RelayPicker` popover (fixed ~320px width, kind tabs All/Request/Collection/Environment, old search placeholder that can clip). That matches reference screenshot 8.42 on the `+` path only. RP-214–216 replace it in P8; P6 only re-anchors the popover inside `relay-composer-box`.
- **RP ids:** RP-202 (part b), RP-208, RP-209, RP-210, RP-211, RP-212, RP-213, RP-103 (composer controls). Design gate on all.
- **Tasks:** (a) `relay-composer-box` (one rounded border, auto-grow, toolbar `+`, pills region, mic, send/stop; tooltips on `+`, mic, send/stop); `+` still opens the legacy `RelayPicker` popover, re-anchored inside the box; **no shield in this phase**; caption stays below (RP-208, RP-103); (b) `ComposerPills` replaces `ContextChips` (X removes the item and strips its `@token`; stale pills struck/muted and dropped at send) (RP-209); (c) placeholder `Ask anything, @ to mention, / for actions` in en/fr/ja (RP-210); (d) `MentionMenu` (inline above the box, box-wide, "Current tab" pinned first, Results rows with kind icon and secondary line, virtualized, "Keep typing to narrow results" footer, `role="listbox"`, `aria-activedescendant`, focus stays in the textarea, mutual exclusion with the slash menu, zero network) with the parameterised API from section 2 decision 3 (RP-211, RP-202b); (e) selection inserts `@Name ` via `replaceMention` and calls `addAttachedItem`, deduped; token deletion does not detach (RP-212); (f) `mention.*` i18n keys (RP-213).
- **Files:** `src/components/relay/{RelayComposer,MicButton,SlashMenu}.tsx`, new `ComposerPills.tsx`, new `MentionMenu.tsx`, `ContextChips.tsx` (deleted), `RelayPickerRow.tsx` (reused), `src/lib/relay/mentions.ts`, `src/stores/useRelayStore.ts`, `src/stores/useRelayRecentStore.ts` (created here, written on attach; read in P8), i18n.
- **Specs migrated here:** `RelayComposer.spec`, `ContextChips.spec` (deleted -> `ComposerPills.spec`), `SlashMenu.spec` (exclusivity), `mentions.spec`, `relay-improvements-a11y-mic` (mic position), `-qol-stop`, `-voice`, `-pills`, `-picker` (the `@` entry points).
- **Tests:** unit for mention detection (start / after whitespace / not mid-word `a@b`), insertion, dedupe, pill remove strips token, mutual exclusivity; e2e `relay-polish-composer` and `relay-polish-mention` (`REL-POL-COMPOSER-nn`, `REL-POL-MENTION-nn`): one border, no overlap at 320/400/480, tab order (no shield yet), `@` start vs mid-word, Current tab first and disabled with no tab, filter + arrows + Enter, Esc leaves text, request interception proves zero `/api/relay/*` or other-host requests until Send, outgoing payload includes the attached request.

### P7. Slash actions expansion and target handling

Slice: 15 grouped commands; actions that need a target never send blind.
- **RP ids:** RP-217, RP-218, RP-219 (exempt), RP-204 (design gate on RP-217 and RP-204).
- **Tasks:** (a) extend `SlashCommand` (`icon`, `group`, `requiresTarget`, `descriptionKey`, `promptKey`), add `/new /run /fix /tests /diff /import /export /env /chain /summarize` with prompts per SPEC section 6 (prompt-only, no new tool or schema), grouped `SlashMenu` (Understand, Build, Test, Run, Share, Chat) with icon + name + description, filter over name + description, `/clear` confirm kept (RP-217, RP-218); (b) target-requiring command with no matching attachment opens `MentionMenu` pre-filtered by `kind` with a hint and Current tab pinned, leaving the slash text ready; `/clear` and `/import` never require a target (RP-204); (c) `slashCommands.spec.ts`: unique ids, i18n description + prompt in all locales, `findSlashQuery` semantics unchanged, filtering, target metadata (RP-219). Any command not achievable with existing tools is documented as a limitation, not built (RP-218).
- **Files:** `src/lib/relay/slashCommands.ts`, `src/components/relay/{SlashMenu,RelayComposer,MentionMenu}.tsx`, i18n (`slash.*`, prompts), `e2e` stream helpers.
- **Specs migrated here:** `SlashMenu.spec`, `slashCommands.spec`, `RelayComposer.spec`, `relay-improvements-qol-rewrite` (slash entries), `relay-improvements-smart-*` if they assert slash text.
- **Tests:** unit as RP-219; e2e `relay-polish-slash` (`REL-POL-SLASH-nn`): `/` lists 15 commands in six groups, `/ru` shows `/run`, `/run` with nothing attached opens the mention menu with a hint and attaching leaves `/run` ready, `/clear` confirm, prompts fill from `promptKey`.

### P8. `+` launcher; picker UI removed

Slice: the Cursor-style launcher replaces the narrow tabbed picker.
- **RP ids:** RP-214, RP-215 (Recent, Attach, Actions), RP-216, RP-202 (part c). Design gate on all.
- **Tasks:** (a) `relay-launcher` built on `Command` (cmdk): box-wide floating panel above the composer, search input `relay-launcher-search`, type-to-filter across sections, Up/Down/Enter/Esc with focus return to `+` (RP-214); (b) sections in order Recent (from `useRelayRecentStore`, cap 5), Attach (Current tab, Request, Collection, Environment, Chain via `MentionMenu` with `kind` prefilter in place; "Paste cURL" prefills `/import ` and focuses the composer), Actions (top `SLASH_COMMANDS` rows with shared metadata) (RP-215, RP-202c); Settings section deliberately absent here (see 3.1); (c) `+` now opens the launcher; delete `RelayPicker`'s kind tabs and popover, keep `useRelayPickerItems` + `RelayPickerRow`, drop the temporary Current tab row (RP-216); (d) zero network and a 320px non-clipping check.
- **Files:** new `src/components/relay/RelayLauncher.tsx`; `RelayComposer.tsx`, `RelayPicker.tsx` (deleted or reduced to shared pieces), `RelayPickerRow.tsx`, `src/hooks/useRelayPickerItems.ts`, `src/stores/useRelayRecentStore.ts`, `src/lib/relay/constants.ts` (launcher constants), i18n.
- **Specs migrated here:** `RelayPicker*.spec` (replaced by `RelayLauncher.spec`), `relay-improvements-picker`, `useRelayPickerItems.spec`, `RelayComposer.spec`.
- **Tests:** unit for recents (cap, order, persistence of names/ids only), launcher filtering across sections; e2e `relay-polish-launcher` (`REL-POL-LAUNCHER-nn`): sections in order, `run` filters across sections, Request row lists requests, Current tab attaches a pill and closes, Esc returns focus to `+`, "No results", 320px, interception proves zero requests.

### P9. Permission modes

Slice: the user chooses how much approval Relay needs; the registry obeys exactly.
- **RP ids:** RP-220, RP-221 (exempt), RP-222, RP-223, RP-224 (exempt), RP-225 (exempt), RP-103 (shield tooltip). RP-220 design step: see section 4.
- **Tasks:** (a) `permission.ts` constants/types + `useRelayPermissionStore` (persisted `rq_relay_permission_mode`, default `review`) (RP-220); (b) `NAVIGATION_TOOLS`, pure `approvalNeeded` and mode-aware `awaitsUser` (default param keeps every caller), `ToolContext.permissionMode`, `executeTool`/`runValidated` rules (token required unless `skip`; dirty-tab confirm gate independent of mode; a classification test that every `auto` tool is navigation or gated by Always ask), `describeGeneric` + `ConfirmAction` `"change"` + `confirm.change.*` keys, per-`toolCallId` awaiting record in `useRelayChat` so a mid-card mode flip is safe (RP-221); (c) shield trigger inserted right after `+` (`relay-permission-trigger`, tooltip "Approval mode: <name>", `data-mode`, warning token verified or added), popover with `radiogroup` and the three option rows, "Approvals are off" notice in skip mode, launcher Settings section with the "Permission mode" row (RP-222); (d) Settings > Relay `relay-permission-select` bound to the same store (RP-223); (e) behavior matrix e2e (RP-224); (f) `relay_permission_mode_changed {from,to}` telemetry (RP-225).
- **Files:** `src/lib/relay/permission.ts`, `src/stores/useRelayPermissionStore.ts`, `src/lib/relay/tools/{schemas,registry,describeGeneric}.ts`, `src/hooks/useRelayChat.ts`, `src/components/relay/{RelayComposer,ConfirmCard,RelayLauncher,RelayConversation}.tsx` (`promptCard` reads the per-call awaiting record), new `PermissionShield.tsx`, `src/components/settings/RelaySection.tsx`, `src/lib/relay/telemetry.ts`, theme token file if a warning token is missing, i18n.
- **Specs migrated here:** `registry.spec`, `schemas.spec` (`awaitsUser`), `gating.spec`, `hardening.spec`, `useRelayChat.spec` approval cases, `ConfirmCard.spec`, `RelayComposer.spec` (tab order now includes the shield), `relay-confirm`, `relay-write`, `relay-improvements-a11y-keyboard` (tab order).
- **Tests:** unit table `approvalNeeded` over {read, ui, auto small, auto bulk 11, confirm, navigation} x {3 modes}; `executeTool` skip/review/token-forgery cases; mode cannot be set via tool input; e2e `relay-polish-perm` (`REL-POL-PERM-nn`): RP-224 matrix with scripted `create_collection`, `delete_request`, `get_request`, `ask_user` in all three modes (Skip still shows `ask_user` and the Undo/Change Card for the create), mid-card flip; e2e `relay-polish-shield` (`REL-POL-SHIELD-nn`): shield popover keyboard + persistence, skip notice, Settings <-> shield agreement, launcher Permission mode row.

### P10. Capabilities popover and empty state

Slice: Relay explains what it can do and see; badges reflect the live mode.
- **RP ids:** RP-206, RP-207, RP-103 (capabilities header button). Design gate on both.
- **Tasks:** (a) `capabilities.ts`: `CAPABILITY_CATEGORY_BY_TOOL satisfies Record<RelayToolName, CapabilityCategory>`, five categories, starters as i18n keys `capabilities.<category>.examples.<n>`, "What Relay can see" list (attached items, workspace index per Q1, on-demand lookups, env values only with Share variable values, secrets hidden) (RP-206); (b) header button `relay-header-capabilities` opening the popover (focus in, Esc returns focus), starters submit via `submitPrompt` or open `MentionMenu` first for target-requiring prompts, approval badges from `approvalNeeded` ("Asks first" / "Runs directly" / "Asks first when more than 10 items"), "Change approval mode" link opening the shield popover (RP-206); (c) empty state: large `RelayLogo`, title/description and the capability starters grid; delete the interim starter set and the old `SUGGESTION_KEYS` / "see what Relay can see" toggle (RP-207); (d) launcher Settings gains the "What Relay can do" row.
- **Files:** new `src/lib/relay/capabilities.ts` (+ spec), new `CapabilitiesPanel.tsx` / `CapabilitiesPopover.tsx`, `EmptyState.tsx`, `RelayHeader.tsx`, `RelayLauncher.tsx`, `PermissionShield.tsx` (open-from-link), i18n.
- **Specs migrated here:** `EmptyState.spec`, `RelayHeader.spec`, `relay-improvements-a11y-axe` (popover open), `relay-improvements-context-suggestions` (already retired in P5; confirm removed).
- **Tests:** unit: every tool in `RELAY_TOOL_SCHEMAS` appears in exactly one category, i18n keys exist in en/fr/ja; e2e `relay-polish-caps` (`REL-POL-CAPS-nn`): five categories, starter send vs target prompt, live badge change when mode changes, focus handling, empty state identical regardless of open tab.

### P11. Cleanup and final sweep (no feature work)

- **RP ids / NFR:** supporting only; traces to RP-110 (dead code), RP-216, RP-226, RP-213, and the Performance/i18n/Accessibility NFRs.
- **Tasks:** `rg` for removed symbols (`computeContextChips`, `dismissAutoChip`, `RELAY_DEFAULT_WIDTH_PX`, `relay_feedback`, `Sparkles` in relay, `relay-see-what`, delete-dialog ids); removed-key sweep across en/fr/ja; `brandGuard.spec.ts` green; i18n parity; `check-ids.sh`; `next build` size check in a scratch copy (`/app` first-load gzip <= `BUNDLE.md` baseline + 5 kB, record in `BUNDLE.md`); axe scan with every new menu open (e2e `relay-polish-a11y`, `REL-POL-A11Y-nn`); targeted run of every spec listed in section 6 (not the full suite); Firefox caveat verified in the shortcuts docs; remaining test-id appendix check; screenshot index in `agent_docs/qa/relay-polish/`; `bun run typecheck` (`tsc --noEmit`) once and `bun run lint:check` (`biome check`).
- **Done when:** SPEC section 10 criteria 1-6 pass.

## 6. Existing specs that break, by owning phase (updated in the same phase)

| Phase | Unit specs | E2E specs |
|---|---|---|
| P1 | `RelayConversation`, `MessageActions`, `telemetry` | `relay-chat` (ordering), `relay-improvements-qol-actions` (+ `.feature.md`), `qol-rewrite.feature.md` ref |
| P2 | `RelayToggleButton`, `LeftPanel`, `TabBar`, `KeyboardShortcutsModal`, `useRelayShortcut`, `RelayHeader`, `EmptyState` | `relay-shell` (toggle location) |
| P3 | `RelayDock*`, `RelayRoot`, `ResizeHandle`, `constants`, `useRelayStore` | `relay-improvements-layout`, `-a11y-layout`, `-a11y-keyboard` (resize keys), `relay-shell` (geometry only if it asserts dock size) |
| P4 | `ThreadList`, `RelayHeader` | `relay-threads` |
| P5 | `ContextChips`, `EmptyState`, `contextBuilder`, `chips`, `useRelayStore`, `suggestions`, `followUps`, `useRelayChat`, `workspaceRead` / `get_active_context`, `RelayPicker*` | `-context-chip`, `-context-payload`, `-context-suggestions`, `-pills`, `-picker`, `relay-privacy`, `relay-chat` |
| P6 | `RelayComposer`, `ComposerPills`, `SlashMenu`, `mentions` | `-a11y-mic`, `-qol-stop`, `-voice`, `-pills`, `-picker` |
| P7 | `SlashMenu`, `slashCommands`, `RelayComposer` | `-qol-rewrite`, `-smart-*` if slash text asserted |
| P8 | `RelayPicker*` (replaced by `RelayLauncher`), `useRelayPickerItems` | `-picker`, `relay-polish-ctx` (CTX-03/04 move to the launcher) |
| P9 | `registry`, `schemas`, `gating`, `hardening`, `useRelayChat`, `ConfirmCard`, `RelayComposer` | `relay-confirm`, `relay-write`, `-a11y-keyboard` (tab order), `relay-polish-composer` (COMPOSER-06 tab order); re-run `relay-polish-launcher` (Settings row) |
| P10 | `EmptyState`, `RelayHeader` | `-a11y-axe`, `relay-chat`, `relay-polish-ctx` (CTX-07 starters); re-run `relay-polish-launcher` |

Run rule: each phase runs only the specs listed for it (including this feature's own earlier `relay-polish-*` specs that the phase touches) plus its own new `relay-polish-*` spec (`bunx playwright test e2e/qa/relay/<spec>.spec.ts`), never the full suite; P11 runs the union of listed specs by name.

## 7. Testing strategy summary

- **Unit (vitest, beside source, >= 80% per file):** pure logic first and TDD: `joinTextParts`, `formatRelativeTime`, dock width clamp math, mention detection, slash metadata, `approvalNeeded` table, `capabilities` coverage, payload builder, recents store, permission store.
- **E2E (Playwright `@qa`, targeted):** one `relay-polish-<area>.spec.ts` per phase (areas: MSG, SHELL, PANEL, THREADS, CTX, COMPOSER + MENTION, SLASH, LAUNCHER, PERM, CAPS), scripted streams via `relayRoutes.ts` (text/tool/text, text/ask_user, `create_collection`, `delete_request`, `get_request`, `ask_user`), request interception for payload and zero-network assertions, scenario/ID parity via `check-ids.sh`.
- **Browser design verification:** agent-browser, 1440px and 320px panel width, light + dark, saved under `agent_docs/qa/relay-polish/`; extra widths 1100/900/780 in P3.
- **Typecheck/lint:** `tsc` once at phase end; `biome check` on touched files.

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 320px floor vs 40vw max on viewports < 800px; persisted px width outside the new range after a viewport change; stale `rq_relay_width` of 400px+ from the old limits | Low-Med | Floor wins over max (min = max = 320px); one set of pure helpers shared by store, handle and CSS; re-clamp on load and on window resize; unit tests for 1440 / 1100 / 900 / 780 and persisted out-of-range values |
| Persisted IndexedDB threads contain `get_active_context` parts, `step-start` parts and old pending cards | High | Keep tool name; no IDB schema change; fixture replaying an old thread in P1 and P5 (renders, continues, redacted); `describeGeneric`/`"change"` only affects new cards |
| Many e2e specs break at once | Med | Section 6 matrix: migrate in the owning phase; Gherkin ids and `check-ids.sh` updated with each change; never a trailing migration phase |
| `Ctrl/Cmd+Shift+O` collides with the bookmarks manager (Chrome/Edge) and Firefox Library | Med | Capture-phase `preventDefault`; verified in Chrome in the P2 e2e; Firefox may not be overridable (Q5): documented in shortcuts docs and the tooltip remains correct; the toolbar `New chat` button is the guaranteed path |
| Removing implicit context makes "explain this" feel broken | Med | System prompt rule + `ask_user` suggesting Current tab; interim starters in P5; Current tab pinned in `@`; scripted e2e |
| Half-wired UI between phases (shield slot, launcher Settings, picker removal, starters) | Med | Section 3.1 hand-off table: each link wired in exactly one phase; phase ACs avoid forward references |
| Permission bypass: model text or tool input sets the mode; forged tokens; Skip mode regression | High | Mode read from the store at `onToolCall`, never in schema or server payload; `isGranted` rejects hand-built tokens; `skip` only skips the token requirement; dirty-tab gate independent; classification test forces every new `auto` tool to be navigation or gated |
| Mode flip while a card is pending | Med | Per-`toolCallId` awaiting record; unit + e2e |
| Focus handling: mention/slash keep focus in the textarea, launcher/cmdk takes focus in its input | Med | Separate a11y patterns documented per component; mutual exclusivity tests; Esc returns focus to `+`; axe with menus open in P10/P11 |
| Anchored menus at 320px: virtualization, clipping, horizontal scroll | Med | Box-width anchoring; reuse `ROW_HEIGHT_PX` virtualizer; screenshots at 320; overflow assertions |
| Bundle growth (logo; no new dependency now that the panel migration is dropped) | Low | `RelayLogo` inline SVG; +5 kB check in P11 |
| fr/ja strings machine-quality or breaking ICU placeholders | Low | Parity spec each phase; placeholders `{count}` `{name}` preserved; `@` and `/` kept in the placeholder |
| System prompt change affects server behavior and `brandGuard` | Low | Wording reviewed against `brandGuard.spec.ts`; change limited to one rule |
| Design gate skipped under time pressure | Med | TASKS carries DESIGN / REFINE / IMPLEMENT / VERIFY on every gated task; verifier rejects without the one-line note |

## 9. Open questions

None blocking. SPEC section 12 is fully resolved; the one deviation from the requested ordering (slash before launcher, section 3.2) is a dependency-driven choice and is reversible if the user prefers launcher first with the "Paste cURL" row hidden until P7.

## 10. Traceability (RP id -> phase)

Every RP id in SPEC appears below. Supporting tasks are traced in the last block.

| RP id | Requirement | Phase(s) |
|---|---|---|
| RP-101 | Logo instead of Sparkles | P2 (empty-state large logo reused in P10) |
| RP-102 | Toggle moves to tab bar | P2 |
| RP-103 | Tooltips on every header/composer button | P2 (header), P6 (composer `+`, mic, send/stop), P9 (shield), P10 (capabilities button) |
| RP-104 | Relative time on rows | P4 |
| RP-105 | Row overflow menu, immediate delete + Undo | P4 |
| RP-106 | New chat / close chords | P2 |
| RP-106b | Chord unit tests | P2 |
| RP-107 | Conversation menu floating overlay | P4 |
| RP-108 | No text concatenation across steps | P1 |
| RP-109 | Parts rendered in stream order | P1 |
| RP-110 | Dock width limits (`max(30vw, 320px)`..40vw, default 30vw) | P3 |
| RP-201 | Stop sending implicit context | P5 |
| RP-202 | Current tab as explicit attachable | P5 (chip kind, payload, interim picker row), P6 (pinned in `@`), P8 (launcher Attach) |
| RP-203 | Tools respect explicit context | P5 |
| RP-204 | Slash target handling via mention menu | P7 (API designed in P6) |
| RP-205 | Suggestions/follow-ups independent of active tab | P5 (interim starters), P10 (replaced by capabilities) |
| RP-206 | "What Relay can do" capabilities | P10 |
| RP-207 | Empty state | P10 (interim in P5) |
| RP-208 | Unified composer box | P6 (shield added P9) |
| RP-209 | Pill behavior | P6 |
| RP-210 | Placeholder | P6 |
| RP-211 | `@` mention menu (local) | P6 |
| RP-212 | Insert `@Name` token + attach | P6 |
| RP-213 | Mention i18n (and per-phase i18n discipline) | P6 (all phases add keys) |
| RP-214 | `+` launcher (local) | P8 |
| RP-215 | Launcher sections | P8 (Recent, Attach, Actions); P9 (Permission row); P10 (What Relay can do row) |
| RP-216 | Remove picker tabs/popover | P8 (final removal check P11) |
| RP-217 | Extended slash metadata and commands | P7 |
| RP-218 | Slash prompts steer existing tools | P7 |
| RP-219 | `slashCommands.spec` coverage | P7 |
| RP-220 | Permission mode store | P9 |
| RP-221 | `approvalNeeded` / registry rules | P9 |
| RP-222 | Shield button + popover | P9 |
| RP-223 | Settings approval control | P9 |
| RP-224 | Behavior e2e matrix | P9 |
| RP-225 | Telemetry for mode change | P9 |
| RP-226 | Remove like/dislike | P1 (final `rg` check P11) |

Supporting work:

| Task | Traces to | Phase |
|---|---|---|
| Width constants + clamp helpers + `ResizeHandle` aria range + window-resize re-clamp | RP-110 | P3 |
| Remove `RELAY_DEFAULT_WIDTH_PX` and stale references | RP-110 | P3, verified P11 |
| Interim starter set | RP-205 | P5 |
| Legacy picker "Current tab" row (temporary) | RP-202 | P5 -> removed P8 |
| `useRelayRecentStore` creation | RP-215 | P6 (written), P8 (read) |
| Bundle check (+5 kB over the `BUNDLE.md` baseline) | Performance NFR | P11 |
| Axe scan with all menus open | Accessibility NFR | P10, P11 |
| i18n parity and removed-key sweep | i18n NFR (RP-213) | every phase, P11 |
| `brandGuard.spec` green | i18n NFR (no vendor strings) | P5 (system prompt), P11 |
| Firefox `Ctrl/Cmd+Shift+O` caveat note | RP-106 / Q5 | P2 |
| Annotate relay-improvements docs as superseded | RP-226 | P1 |
| `check-ids.sh` parity and `agent_docs/qa/relay-polish/` screenshots | SPEC section 8 / section 3 | every phase, P11 |
