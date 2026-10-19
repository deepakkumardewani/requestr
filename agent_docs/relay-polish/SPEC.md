# Relay Polish: Explicit Context, Permissions and a Finished Feel (SPEC)

Status: Draft v1 (spec only, no feature code). Branch: feature/ai-agent. Extends `agent_docs/relay-agent/SPEC.md` (FR-1..FR-84) and `agent_docs/relay-improvements/SPEC.md` (FR-101..FR-19x). New requirements use the `RP-` prefix (`RP-1xx` = Part A polish, `RP-2xx` = Part B features) so they never collide. Where this spec contradicts an earlier FR, the "Supersedes" line names it; this spec wins.

Reference screenshots (user-supplied, `~/Desktop/Screenshot 2026-10-17 at *.png`): Cursor composer + launcher (8.17), Notion header/conversation menu/tooltips (8.25, 8.29), Notion `@` menu (8.49), Cursor-style composer (8.18), and the bugs/dislikes in Relay today: narrow `@` picker with type tabs (8.42), concatenated text and cards-before-text (8.31, 8.33), always-visible pencil/trash and inline-pushed conversation list (8.31), thumbs buttons (8.50).

## 0. Assumptions (correct me before PLAN)

1. Frontend only. The only server-side touch allowed is the system prompt text (`src/lib/relay/server/systemPrompt.ts`) to teach the model "nothing is attached unless the user attached it". No new routes, no new tools (see section 6 mapping: every new `/` action is prompt-only).
2. Relay stays global (mounted from `AppProviders`) as the existing fixed-position `RelayDock` aside, on every route except `/` (landing) and mobile (`<768px` keeps the `Sheet`). The aside, its custom `ResizeHandle` and the `useReserveDockSpace` body-padding logic in `RelayRoot` are kept; only the width limits change (RP-110).
3. No new dependency is needed. The dock keeps its own `ResizeHandle` and px width in `useRelayStore`; `react-resizable-panels` and `src/components/ui/resizable.tsx` are not used by Relay (Q3: the ResizablePanel migration was considered and dropped).
4. `messages/` has three locales (`en`, `fr`, `ja`), each with `relayDock.json`. "All locales" means those three; non-English values may be machine-quality but must exist and keep ICU placeholders intact.
5. The `workspace` summary (names and counts only, already redacted, no active-tab or env-active data) keeps being sent every turn as a light index. It is not "active tab context". Decided (Q1 RESOLVED): keep, and disclose it under "What Relay can see".
6. "Current tab" is a new attachable chip kind `tab` (id = `tabId`, label = tab name) because unsaved tabs have no `requestId`. It follows the tab id, not whichever tab is active later.
7. The dock keeps `position: right | left`; `position` is currently a no-op in `RelayDock` (hard-coded `right-0`). This is a known existing limitation and stays out of scope (see Out of scope).
8. Design work for every UI requirement follows the process in section 3; it is a hard gate, not a suggestion.

## 1. Objective

Make Relay feel as polished as Cursor and Notion's AI panels, and make the user the explicit owner of what Relay sees and does.

Phases 1-12 shipped the capability. What remains: a sparkle icon instead of the product logo, a toggle buried in the left sidebar, unlabeled icon buttons, a conversation menu that pushes content like a panel section, two rendering bugs that garble replies, an `@`/`+` picker that is narrow and tab-filtered, automatic context nobody asked for, no way to tell what Relay can do, no way to say how much approval you want, and thumbs buttons that go nowhere.

Users: developers who keep the Relay side panel open all day while working in Requestr (HTTP/GraphQL/WebSocket/Socket.IO requests, collections, environments, chains).

Success:
- Every item in section 4 is verifiable in the browser (agent-browser / targeted Playwright), with the two rendering bugs no longer reproducing.
- Nothing about the user's workspace beyond names/counts reaches the model unless the user attached it (pill visible in the composer) or Relay looked it up on demand via a read tool the user can see in the transcript.
- A user can choose Always ask / Review for me / Skip all approvals and the registry obeys exactly.
- Every Relay header/composer control has a name, a tooltip, a keyboard path, and (where one exists) its chord shown as keycaps.

### Scope

In scope: Part A (A1-A9, small/cosmetic) and Part B (B1-B8, significant) from the brief, restated as RP requirements in section 4.

### Out of scope

- Rating persistence/analytics (thumbs are removed, not rewired); model selection UI; Notion's Pin / Copy link / Mark unread.
- Any backend permission logic. Permission mode is client-side only and never sent to the server.
- New smart tools or tool schemas beyond what `/` actions minimally need (section 6 concludes: none needed).
- OpenAPI/Postman import, non-cURL code export, collection-wide test generation.
- True inline mention chips inside a `contenteditable` (rejected: cost/IME/undo risk; see RP-212).
- Making the Settings > Relay `position` (right/left) setting functional: it is a no-op today (`RelayDock` is hard-coded to `right-0`) and stays a no-op; a known existing limitation, not fixed here.
- Migrating the dock to `ResizablePanel`/`react-resizable-panels` (a root panel host in `AppProviders`): considered and dropped; the fixed aside, `ResizeHandle` and body-padding reserve stay.
- True streaming-position reordering of already persisted threads beyond what `UIMessage.parts` already stores (parts are stored in order, so old threads render correctly after RP-108/109 with no migration).

## 2. Tech stack, commands, structure

Next.js 16.1.6 App Router, React, Zustand 5 (`src/stores`), shadcn/ui (`src/components/ui`), AI SDK `useChat` (`@ai-sdk/react` 3.0.x, `UIMessage.parts`), zod, next-intl, Vitest ^4.1.5, Playwright. Package manager is `bun`; never `npm`. Never run the dev server (always running).

- Unit: `bunx vitest run <paths>` (specs sit next to source; per-file coverage >= 80% for touched/new files)
- E2E (targeted only, never the full suite): `bunx playwright test e2e/qa/relay/<spec>.spec.ts`
- Scenario/ID parity: `bash e2e/scenarios/relay/check-ids.sh`
- Types: `bunx tsc --noEmit` (once, at the end of the full task, not per edit); Lint: `bunx biome check <files>`
- Browser verification: agent-browser skill (never chrome-devtools MCP)

Structure touched:
- `src/components/relay/*` (dock, header, composer, thread list, menus, messages), `src/components/layout/{TabBar,LeftPanel,MainLayout}.tsx`, `src/components/settings/RelaySection.tsx`
- `src/stores/useRelayStore.ts` (slimmed), new `src/stores/useRelayPermissionStore.ts`, new `src/stores/useRelayRecentStore.ts` (recents, Q7)
- `src/lib/relay/{constants,chips,contextBuilder,slashCommands,mentions,telemetry,suggestions,followUps}.ts`, new `capabilities.ts`, `relativeTime.ts`, `permission.ts`
- `src/lib/relay/tools/{schemas,registry,workspaceRead}.ts`, `src/hooks/{useRelayChat,useRelayShortcut}.ts`
- `messages/{en,fr,ja}/relayDock.json` (+ the settings namespace `RelaySection` uses)
- `e2e/scenarios/relay/*.feature.md` and `e2e/qa/relay/*.spec.ts`

## 3. Design process constraint (applies to every UI requirement)

Every task that creates or changes UI (all of RP-101..RP-226 except the pure-logic items RP-106b, RP-108, RP-110 (width limits only, no visual change; screenshots at 1440/1100/780/320 are recorded by its e2e task), RP-201, RP-203, RP-219, RP-221, RP-224, RP-225) MUST be executed in this order and TASKS.md must carry it as an explicit step on each such task:

1. DESIGN: invoke `ui-ux-pro-max` to decide layout, hierarchy, states (rest/hover/focus/active/disabled/empty/loading/error), light and dark, density at 320px/400px/480px panel width.
2. REFINE: run `impeccable` and `layout` over the design (spacing rhythm, alignment, tokens, motion) before implementation.
3. IMPLEMENT: build with existing shadcn primitives and design tokens (no hard-coded colors; named constants for sizes/timings).
4. VERIFY: agent-browser screenshots at 1440px and the 320px panel width, light + dark, saved under `agent_docs/qa/relay-polish/` and referenced from the task.

A task is not Done without the design step recorded (one line naming what `ui-ux-pro-max`/`impeccable`/`layout` changed). The verifier rejects UI tasks lacking it.

## 4. Functional requirements

Format: `RP-nnn` requirement, then `AC` bullets that are browser-verifiable. `Supersedes` notes earlier FRs. Test ids for e2e use `data-testid` (appendix A).

### Part A. Polish

#### A1. Logo instead of Sparkles

- RP-101 Replace lucide `Sparkles` in `RelayToggleButton` with the product logo (`public/logo.png`: purple neon paper plane) recreated as an inline SVG React component `RelayLogo` (`src/components/relay/RelayLogo.tsx`) using `stroke="currentColor"` / `fill="none"` so it inherits color in light/dark and when the toggle is active/hover. Used wherever Relay identity appears: toggle button, dock header (next to the title when no thread title, or leading), and the new-chat empty state (large). No raster image in the Relay bundle.
  - AC: Toggle, header and empty state each render `[data-testid="relay-logo"]`; no `lucide-react` `Sparkles` import remains under `src/components/relay/` or `TabBar`. In dark and light themes the glyph contrasts with its background (>= 3:1 for non-text). It is `aria-hidden` when adjacent to a text label and has an accessible name when it is the only content of a control. Size follows `icon-sm` (toggle) and scales via a `className` size prop.

#### A2. Toggle moves to the tab bar

- RP-102 Remove `<RelayToggleButton />` and its `next/dynamic` import from `LeftPanel.tsx`. Render it in `TabBar.tsx` at the right end of the tab bar, immediately right of `TabListDropdown` (the open-tabs chevron), in the existing `flex shrink-0 items-center gap-0.5 px-1` block, and render it even when `tabs.length === 0` (the tab list dropdown only shows with tabs; the toggle must not jump). Keep it lazy via `next/dynamic` (`ssr:false`) so the dock chunk split from the bundle baseline (`BUNDLE.md`) is preserved. `isRelayEnabled()` still gates it; `aria-expanded`, `data-testid="relay-toggle"` unchanged.
  - AC: On `/app` the toggle sits at the far right of the tab bar, to the right of the tab-list chevron when tabs exist; with zero tabs it is still at the far right. It no longer appears in the left sidebar. Clicking toggles the dock; `aria-expanded` flips. With many tabs (overflow) it stays visible and is not scrolled away. `Supersedes` FR-3 location.
  - Note: the toggle currently appears only on `/app` (because `LeftPanel` is only in `MainLayout`); `TabBar` is likewise `/app`-only (`RightPanel`). Behavior on other routes (shortcut only) is unchanged; Q9 asks whether other routes need a visible toggle.

#### A3. Tooltips on every header button

- RP-103 Every Relay header control gets a shadcn `Tooltip` (text = the i18n label already used as `aria-label`, plus chord keycaps where one exists, rendered with `Kbd`): conversation trigger ("Conversations"), New chat (+ chord), "What Relay can do" (RP-206), Close (+ toggle chord). Tooltips open on hover and keyboard focus, are dismissible with Esc, and do not trap focus. Same for the composer controls added in Part B (`+`, permission shield, mic, send/stop).
  - AC: Hovering or tabbing to each header button shows a tooltip within 700 ms; chords render as separate keycaps (`⌘` `⇧` `O`, or `Ctrl` `Shift` `O`) matching the platform; no button lacks both `aria-label` and tooltip. `Supersedes` NFR-8 only where it required aria-label without tooltip.

#### A4. Conversation rows: relative time + overflow menu

- RP-104 Relative time. Each row in the conversation list shows the thread's `updatedAt` at the far right as: `now` (< 1 minute), `Nm` (< 60 min), `Nh` (< 24 h), `Nd` (< 7 days), `Nw` (7-29 days, `floor(days/7)`), `Nmo` (30-364 days, `floor(days/30)`), `Ny` (>= 365 days). Never seconds. A pure util `formatRelativeTime(timestamp, now) -> {unit, value}` in `src/lib/relay/relativeTime.ts` with thresholds as named constants; the component maps it to i18n keys `threads.time.{now,minutes,hours,days,weeks,months,years}` (ICU `{count}`, per-locale suffix). A `title`/tooltip shows the full local date-time (`Intl.DateTimeFormat(locale, {dateStyle:"medium", timeStyle:"short"})`). Future timestamps clamp to `now`.
  - AC: Rows with updatedAt 30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d ago show `now`, `5m`, `3h`, `2d`, `1w`, `3mo`, `1y` (en). Hovering the time shows the full date. Unit tests cover boundaries (59 s/60 s, 59 m/60 m, 23 h/24 h, 6 d/7 d, 29 d/30 d, 364 d/365 d, negative skew).
- RP-105 Row menu. Remove the always-visible Pencil and Trash buttons. On row hover or keyboard focus-within, a `⋯` (MoreHorizontal) icon button joins the row at the right (replacing the time while visible; the time returns on leave; layout must not shift). It opens a `DropdownMenu` with **Rename** (pencil icon) and **Delete** (trash icon, destructive color). Rename switches the row to the existing inline `Input` (Enter saves, Esc cancels, blur saves, empty rejected). Delete is immediate: no `AlertDialog`; it deletes via `deleteThread` and shows an Undo toast (`RELAY_UNDO_TOAST_MS` = 5000) that restores the thread in place via `restoreThread`. Fully keyboard accessible: Tab to the row, Tab/Arrow to `⋯`, Enter opens, arrows select, Enter activates; focus returns to the trigger (or next row after delete) on close.
  - AC: No pencil/trash icon is visible at rest. Hover shows `⋯`; menu has exactly Rename and Delete. Delete removes the row at once and the toast Undo restores it (same position and title); after 5 s the toast goes away and the delete is final. Deleting the active thread starts a fresh empty thread as today. `data-testid`s in appendix A. `Supersedes` FR-11 confirm-on-delete (`relay-thread-delete-dialog`/`-confirm` are removed).

#### A5. Keyboard shortcuts

- RP-106 Chords. Close Relay uses the existing toggle chord (`RELAY_SHORTCUTS`: `⌘I` on mac, `Ctrl+Shift+L` elsewhere); the Close button tooltip shows it. New chat is `⌘⇧O` (mac) / `Ctrl+Shift+O` (other), defined in `src/lib/relay/constants.ts` as `RELAY_NEW_CHAT_SHORTCUTS` next to `RELAY_SHORTCUTS` and handled in `useRelayShortcut.ts` with the same capture-phase `keydown` pattern (works while the composer textarea has focus; skips CodeMirror/Monaco editors like the toggle). When Relay is closed the chord opens it and starts a new chat. The chord also appears in `KeyboardShortcutsModal` as "New Relay chat".
  - Conflict check (done): `useKeyboardShortcuts.ts` has no `o` case in either the global switch or the chain-canvas mod keys, so no in-app conflict. Browser risk: Chrome/Edge/Firefox bind `Ctrl/⌘+Shift+O` to the bookmarks manager/Library; a page-level capture handler with `preventDefault` normally wins in Chrome but may not in Firefox (Q5).
  - AC: Pressing the chord with focus in the composer starts a new chat (empty thread, composer focused, attachments cleared) and the browser bookmarks UI does not open (Chrome). `⌘I` closes an open dock. Tooltips and the shortcuts modal show matching keycaps. Chords do nothing on `/` or when Relay is disabled.
- RP-106b Unit tests: chord matcher for both platforms; handler ignores events inside `.cm-editor, .monaco-editor`; no `o` collision test (assert `useKeyboardShortcuts` never calls `preventDefault` for Shift+Mod+O).

#### A6. Conversation menu is a floating overlay

- RP-107 The conversation list is a floating overlay anchored to the header, not an inline section: portaled popover (`Popover` or `DropdownMenu` content) with `border`, `shadow-lg`, a distinct raised surface token (`bg-popover`, not `bg-background`), a small offset (`sideOffset` constant) below the header, a defined `z-index` above the dock (`z-50`), rounded corners, and `max-h` with internal scroll. It does not change the layout of anything behind it (no push, no height change of the message list); click-outside, Esc, and selecting a thread close it, returning focus to the trigger. Search input and groups (Today/Yesterday/Earlier) stay; Notion's "Past 30 days"-style group labels are optional (Q10).
  - AC: Opening the menu leaves message-list scroll position and composer position unchanged (pixel-compare the composer box before/after). The menu visibly floats (shadow + border + different surface) in light and dark. Clicking the messages area closes it. Works at the narrowest panel width (320px) without horizontal scroll.

#### A7 and A8. Message rendering bugs (root cause and fix)

Root cause (confirmed in `src/components/relay/RelayConversation.tsx`):
- `messageText(message)` (lines ~89-93) does `message.parts.map(p => p.type === "text" ? p.text : "").join("")`. A model turn is `text -> tool call -> tool result -> text` (separate `step-start` parts); joining with `""` glues the end of the first text to the start of the second: "...you're looking at.Here's the result...".
- `MessageItem` (lines ~258-267) renders `toolParts(message, ...)` first (every tool part, including `AskUserCard`, `ConfirmCard`, `CloseTabsConfirmCard`, `ChangeCard`, `ToolRow`, `TurnChangeBar`), then renders ONE `<RelayMarkdown text={joinedText} />`. Every card therefore precedes all text, so the AskUser card appears above the sentence that introduces it.
- `RelayDock.tsx` has the same `""` join in `lastUserMessageText`.

- RP-108 (A7) Text from different steps is never concatenated without a separator. Each text part renders as its own `RelayMarkdown` block (block-level spacing gives the separation). Wherever a single string is still needed (Copy, Regenerate prompt, `lastUserMessageText`), join text parts with `"\n\n"`. Thread titles already join with a space and collapse whitespace (`threadDb.ts` `deriveThreadTitle`), so they are not glued and need no change.
  - AC: A mocked stream `text("I'll read the last response of the request you're looking at.") -> tool(get_last_response) -> text("Here's the result...")` renders two separate paragraphs, with the tool row between; the DOM text never contains `at.Here's`. Copy returns the two texts separated by a blank line. Unit test on a pure `messageText` / `joinTextParts` helper.
- RP-109 (A8) `MessageItem` iterates `message.parts` in stream order: text parts and tool parts render at their own positions (consecutive tool rows may stay grouped). `step-start` renders nothing. `TurnChangeBar` (aggregate Undo) renders once after the last part. Prompt cards (AskUser/Confirm/CloseTabs) render exactly where their tool part sits, i.e. after the text that introduced them.
  - AC: With stream `text("Which collection?") -> tool(ask_user)`, the question text is above the AskUser card (`compareDocumentPosition`). With `tool -> text`, the tool row is above the text. Streaming a long reply does not re-mount earlier blocks (keys by part index; `RelayMarkdown` memoized per part). Existing virtualization (`RELAY_VIRTUALIZE_THRESHOLD`) and estimated heights still work.

#### A9. Dock width limits

- RP-110 Keep the fixed-position `RelayDock` aside, its custom `ResizeHandle` and the `useReserveDockSpace` body-padding reserve in `RelayRoot.tsx` (page content is pushed, not covered). Only the width limits change, from `320px..60vw` (default 400px) to:
  - minimum = `max(30vw, 320px)`; maximum = `40vw`; default = `30vw` (never below 320px). If 320px is greater than 40vw (viewport narrower than 800px) the 320px floor wins over the maximum, so min = max = 320px.
  - Constants in `src/lib/relay/constants.ts`: `RELAY_MIN_WIDTH_VW = 30`, `RELAY_MIN_WIDTH_PX = 320` (floor, kept), `RELAY_MAX_WIDTH_VW = 40` (value changed from 60), `RELAY_DEFAULT_WIDTH_VW = 30`; `RELAY_DEFAULT_WIDTH_PX` (400) is removed. `RELAY_KEY_RESIZE_STEP_PX`, `RELAY_RESIZE_HANDLE_HIT_PX` and `RELAY_STORAGE_KEYS.width` are kept.
  - Pure helpers in `useRelayStore.ts` (names may be adjusted): `getRelayMinWidth(viewportWidth)` = `max(RELAY_MIN_WIDTH_PX, floor(vw * 30 / 100))`, `getRelayMaxWidth(viewportWidth)` = `max(getRelayMinWidth(vw), floor(vw * 40 / 100))`, `getRelayDefaultWidth(viewportWidth)` = `getRelayMinWidth(vw)` (30vw clamped to the floor). `clampRelayWidth` clamps to `[min, max]` for the current viewport; a non-finite width falls back to the default. The store's `setWidth` and the `ResizeHandle` pointer/keyboard handlers clamp through these, and `ResizeHandle` `aria-valuemin`/`aria-valuemax` report the effective range for the current viewport (`aria-valuenow` the clamped width).
  - Persistence stays px under `rq_relay_width` via `readPreference/writePreference`. A missing or invalid stored value yields the viewport-based default (30vw, e.g. 432px at 1440px). `readWidth` re-clamps a persisted width on load. A `resize` listener (mounted with the open dock, e.g. in `RelayRoot`) re-clamps the stored width to the new viewport. The aside's inline `minWidth`/`maxWidth` and `useReserveDockSpace`'s `clamp()` use the same bounds (CSS `max(30vw, 320px)` / `max(40vw, 320px)`) so the dock and the reserved gap track the viewport even before the store re-clamps.
  - Mobile `Sheet` variant (`<768px`), landing path (`/`), open/close slide animation (`RELAY_OPEN_DURATION_MS`/`RELAY_CLOSE_DURATION_MS`), `Esc`/focus behavior and the lazy `next/dynamic` split are unchanged.
  - Design width: the minimum rendered width is 320px, so all Relay UI is designed and verified at 320px (not 230px). Between 768px and ~1067px the floor makes Relay wider than 30vw (up to ~42% at 768px); verify at 768px that page content stays usable.
  - AC: At 1440px with no saved width the open dock is about 30vw = 432px (`getBoundingClientRect().width`); dragging the handle clamps between 30vw (432px) and 40vw (576px) and cannot go outside; the dock is never narrower than 320px, including after dragging to the minimum and after shrinking the window (e.g. 1100px gives 330px, 900px gives 320px, and at 780px the 320px floor wins over 40vw = 312px); reload keeps the (clamped) width; a saved width outside the range (e.g. 700px) is clamped on reload and after a window resize; keyboard: focus the handle, ArrowLeft/ArrowRight resize by 16px steps and stop at the bounds, and `aria-valuemin`/`aria-valuemax` match the effective range; page content is not covered (the body padding reserve still tracks the dock width, no horizontal page scroll); below 768px the sheet variant is unchanged; no remaining references to `RELAY_DEFAULT_WIDTH_PX` (`rg` check in the verifier).

### Part B. Features

#### B1. Remove automatic context

Today `computeContextChips` auto-adds the chain from the route, the active tab's request, the active collection and the active environment; `buildRelayContext` sends them; `get_active_context` exposes the active tab; empty-state suggestions are derived from the active tab; `AutoChipLabel` shows "Using: <name> · current tab". All of this is implicit and goes.

- RP-201 Stop sending implicit context. `computeContextChips`, `useAvailableChips`, `selectActiveChips`, `isAutoChip`, `AutoChipLabel`, `dismissAutoChip`, `dismissedAutoChipTabId`, `removedChipKeys`, `removeChip`, `resetRemovedChips`, `draftChips` and the route-derived chain chip are removed. The payload `activeTab`/`collection`/`environment` fields are built only from `attachedItems` (new chip kind `tab`, id = `tabId`). `useRelayChat`'s `buildChatPayload` call drops `removedChipKeys` and `activeChainId`. Secret redaction (`redactDeep` last, `[redacted]` for secret env vars, `shareValues` gating for env values) is unchanged and tested.
  - AC: On a fresh conversation with a request open, the composer has no pills and the outgoing `/api/relay/chat` body (asserted in e2e via request interception) contains no `activeTab`, `collection`, or `environment` key. Attaching a request via `@` adds exactly that request's description. Starting a new chat clears attached items.
- RP-202 "Current tab" is an explicit attachable item. Pinned first in the `@` menu (RP-211) and in the `+` launcher Attach section (RP-215), labelled "Current tab" with the tab's name as the secondary line; when no tab is open it is disabled with "No tab open". Selecting it attaches a `tab` chip (pill in the composer) describing that tab (reusing `describeActiveContext`'s redacted shape).
  - AC: With a tab open, `@` shows Current tab first; selecting it adds a pill with the tab name; the next request body has `activeTab` for that tab and nothing else implicit. With no tab open the row is disabled.
- RP-203 Tools respect explicit context. `get_active_context` KEEPS its name (persisted IndexedDB threads contain tool parts with that name; renaming would break replay and rendering) but its behavior and description change: it returns only attached items (needs `ToolContext.attached`, populated by `useRelayChat` from the store at call time). `update_tab_request`'s description ("tabId from get_active_context") now says the tab must be attached. Audit (verifier task): no tool may default to the active tab when the model omits an id (the `activeTabId` read in `tabRequests.ts` `openTab` only fetches the id of a tab the tool just opened and is fine). `systemPrompt.ts` gains a short rule: nothing about the user's open tab/collection/environment is known unless attached; when the user says "this request/tab/response" with nothing attached, ask them to attach Current tab (or use `ask_user` with that suggestion) instead of guessing. `search_workspace`, `get_request`, `get_collection`, `get_last_response`, etc. remain callable by id/name on demand (the transcript shows each lookup). Q1 covers the always-sent `workspace` summary.
  - AC: With nothing attached and prompt "explain this response", Relay does not call `get_active_context` data about a tab; the (mocked) model is asked to request attachment (e2e uses a scripted stream; unit tests cover `get_active_context` with 0, 1, many items; a persisted thread containing an old `get_active_context` part still renders and can be continued and redaction).
- RP-204 Slash actions that need a target use attached items. When a target-requiring `/` action is chosen with no matching attached item, the composer does not send a blind prompt: it opens the `@` mention menu (pre-filtered to the needed kind, Current tab pinned) with a hint ("Pick a request to run"). See section 6.
  - AC: `/run` with nothing attached opens the mention menu with a hint; picking Current tab attaches it and leaves `/run` text ready to send. `/clear` and `/import` never require a target.
- RP-205 Empty-state suggestions and follow-ups no longer depend on the active tab. `suggestions.ts`/`deriveSuggestions`/`useSuggestionContext` (tab- and response-tied) are replaced by the capability starters (RP-206). `followUps.ts` is audited: it may use the last assistant turn but not the active tab. Supersedes FR-120..FR-123, FR-13.
  - AC: Empty state shows the same starters regardless of which tab is open; no "Using: ... current tab" text exists in the DOM.

#### B2. "What Relay can do" capabilities

- RP-206 Capabilities view. A header icon button (`relay-header-capabilities`, tooltip "What Relay can do") opens a popover with the content below; the same content (without the popover chrome) fills the new-chat empty state. Content has two tabs/sections: **What Relay can do** (grouped categories each with 2-3 runnable starter examples; clicking an example submits it via `submitPrompt`, or if it needs a target opens the mention menu first) and **What Relay can see** (explicit list, see below). Categories: Read & explain, Create & edit, Run & test, Organize, Import/Export. Each action line shows a small approval badge reflecting the current permission mode ("Asks first" / "Runs directly") and a footer link "Change approval mode" (opens the shield popover).
  - Single source of truth (`src/lib/relay/capabilities.ts`): a `CAPABILITY_CATEGORY_BY_TOOL: Record<RelayToolName, CapabilityCategory>` (exhaustive via `satisfies`, so adding a tool without a category fails typecheck/test), `RELAY_TOOL_SCHEMAS[name].kind`, and `SLASH_COMMANDS`. Example prompts are i18n keys `capabilities.<category>.examples.<n>`. The approval badge uses the same pure `approvalNeeded` as the runtime (RP-221), so UI and behavior cannot drift; bulk tools show "Asks first when more than 10 items".
  - "What Relay can see" lists: items you attach (pills), the workspace index (names and counts, Q1), things it looks up on demand when you ask (each shown as a step in the chat), environment variable values only when "Share variable values" is on (link to Settings > Relay), secrets always hidden.
  - AC: Header button opens the popover (focus moves in, Esc closes and returns focus). Five categories render with starters; clicking "Explain a request" style starters either sends or prompts for a target as above. Switching permission mode live updates the badges. Every tool in `RELAY_TOOL_SCHEMAS` appears in exactly one category (unit test). Empty state shows the same categories; i18n keys exist in en/fr/ja.
- RP-207 Empty state. New chat shows `RelayLogo` (large), title/description, then the capability categories collapsed to the starters grid (replaces `SUGGESTION_KEYS` and the "see what Relay can see" toggle).
  - AC: No tab-derived suggestions; "see what Relay can see" content is reachable from the capabilities popover instead.

#### B3. Unified composer

- RP-208 One rounded box (`relay-composer-box`, `rounded-2xl border`, focus-within ring) replaces the current `relay-composer-row`: textarea on top (auto-grow `min 2 rows`, `max` constant, then scroll), a bottom toolbar row inside the same box: `+` (left), permission shield (immediately after `+`), attached pills (inline, wrapping, between shield and the right group, truncating with tooltip), then mic and circular send/stop at the right. The pills replace the separate `ContextChips` list above the composer (`ContextChips.tsx` becomes `ComposerPills`). "Relay is AI and can make mistakes. Check important changes." stays as a small caption below the box (decision; keeps FR-112).
  - AC: Visual: one border around textarea + toolbar; at 320px/400px/480px nothing overlaps or overflows (pills wrap onto their own line above the toolbar rather than squeezing buttons); touch targets >= `RELAY_MIN_TOUCH_TARGET_PX` on mobile. Send is disabled when empty and while offline (existing behavior), becomes Stop while streaming. Tab order: textarea, `+`, shield, pills (remove buttons), mic, send. Caption is visible at all times.
- RP-209 Pill behavior. Pill = icon + name (+ remove `X`, `aria-label` "Remove <name>"). Removing a pill detaches the item and removes its `@token` from the draft. A pill for an item deleted from the workspace is shown struck/muted and dropped at send (existing stale-ref handling).
  - AC: Attach via `@`, see pill inside the box; remove via X; the draft no longer contains the token.

#### B4. `@` mentions

- RP-210 Placeholder is exactly `Ask anything, @ to mention, / for actions` (key `composerPlaceholder` in en/fr/ja; fr/ja translate the sentence but keep the `@` and `/` characters).
- RP-211 (100% local) Typing `@` (at start or after whitespace; `findActiveMention`) opens an inline mention menu anchored above the composer box and as wide as the box (replacing the narrow popover `RelayPicker` for this flow). The menu searches requests, collections, environments and chains using the existing in-app store search (`searchWorkspaceItems`), entirely locally: opening the menu, typing, filtering and selecting make NO AI or network request; nothing leaves the browser until the user presses Send. It uses the existing search (`useRelayPickerItems`/`searchWorkspaceItems`, `PICKER_RESULT_LIMIT` 50, `src/lib/pickerNav.ts` reducer for keyboard); no kind-tab strip. Layout (Notion reference): section "Current tab" pinned first (icon, name, secondary line = breadcrumb/collection path), then "Results" rows each with kind icon, name, secondary line (requests: `METHOD url` redacted/templated, truncated; others: breadcrumb or counts). Virtualized with the same `@tanstack` virtualizer setup and `ROW_HEIGHT_PX` as `RelayPicker` (reuse, do not fork); footer "Keep typing to narrow results" when truncated. Typing after `@` filters live. Keyboard: Up/Down move, Enter/Tab select, Esc closes and leaves the typed text; focus stays in the textarea (`aria-activedescendant`, `role="listbox"`). The mention menu and the slash menu are mutually exclusive: `/` is only recognized at text start, `@` only opens when no slash query is active; opening one closes the other.
  - AC: Typing `@` at the start of an empty composer and after a space opens the menu; mid-word `a@b` does not. Current tab is first. Typing `get` narrows to matching rows; arrows+Enter select. Esc closes without selecting. Opening the slash menu while the mention menu is open closes the latter. The menu is as wide as the composer box at 320px/400px/480px and never overflows the viewport.
- RP-212 Selecting an item inserts an inline `@Name ` token into the text (via `replaceMention`) and attaches the entity (`addAttachedItem`), producing a pill. The textarea stays plain text (decision: no contenteditable); the token is visually just text, the pill is the source of truth. Deleting the token text (backspace) does not auto-detach in this scope; removing the pill detaches (and strips the token). On send, text goes to the model as typed.
  - AC: Select a request -> text shows `@Name `, one pill appears; send -> outgoing payload includes that request's description; duplicate selection does not duplicate the pill.
- RP-213 i18n: all strings via next-intl in en, fr, ja (`mention.*`); no hard-coded copy. Supersedes the FR-124 "+ picker with kind filter tabs".

#### B5. `+` launcher

- RP-214 (100% local) The `+` button opens a Cursor-style launcher (`relay-launcher`), a floating panel anchored above the composer box and as wide as it (not the 320px `w-80` popover), with a search input at the top (placeholder "Search actions, context, chats...") and keyboard navigation (type to filter across all sections, Up/Down, Enter, Esc closes and returns focus to `+`). Built on `Command` (cmdk) like `RelayPicker`. Launcher search, recents and attach-pickers read in-app stores only: no AI or network request until Send. AC: with network interception on, opening `@`/`+`, typing and selecting produces zero requests to `/api/relay/*` or any other host (e2e `REL-POL-MENTION`/`LAUNCHER` assert this).
- RP-215 Sections, each row = icon, name, muted description (right chevron where a row opens a sub-list):
  - **Recent**: last N (constant, default 5) attached items, most recent first (Q7: persisted in `useRelayRecentStore`, localStorage, names only).
  - **Attach**: Current tab, Request, Collection, Environment, Chain (each opens the mention-style search pre-filtered to that kind in place), Paste cURL or file (prefills `/import ` and focuses the composer; file attach is Q8).
  - **Actions**: the top slash actions (`/explain`, `/run`, `/fix`, `/new`, ...) from `SLASH_COMMANDS`, same metadata as the slash menu.
  - **Settings**: Permission mode (opens the shield popover), What Relay can do (opens the capabilities popover).
  - AC: Click `+` -> panel opens above the box at box width with the four sections in that order; typing `run` filters to matching rows across sections; Enter on "Request" shows a request search list; Enter on Current tab attaches a pill and closes; Esc closes and focus returns to `+`. Empty search shows "No results". Works at 320px without clipping.
- RP-216 `RelayPicker` kind-filter tabs and its separate popover are removed; its search hook (`useRelayPickerItems`) and row component (`RelayPickerRow`) are reused by RP-211/RP-215. Supersedes FR-124/FR-125 UI (search/virtualization/50-cap behavior is preserved).

#### B6. Slash actions

- RP-217 Extend `SlashCommand` metadata: `icon`, `group`, `requiresTarget: "request" | "collection" | "chain" | "tab" | null`, `descriptionKey`, `promptKey`. New commands beyond `/explain /assert /curl /docs /clear`: `/new`, `/run`, `/fix`, `/tests`, `/diff`, `/import`, `/export`, `/env`, `/chain`, `/summarize` (mapping in section 6). The slash menu (`SlashMenu`) renders grouped sections with icon, name and description per row; filtering by typed name/description; keyboard unchanged (focus stays in the textarea).
  - AC: Typing `/` lists 15 commands in groups; typing `/ru` shows `/run`; selecting fills the prompt from `t(promptKey)`; target-requiring commands follow RP-204; `/clear` keeps the existing confirm when the thread is not empty.
- RP-218 Each command's prompt is written so the model uses the mapped tools and asks via `ask_user` when a parameter is missing (e.g. `/new` asks which collection). No new tool or schema is added; if the verifier finds a command cannot be done with existing tools, it is documented as a limitation in the empty-state description, not built.
- RP-219 `slashCommands.spec.ts` covers: command list integrity (unique ids, every id has i18n description + prompt in all locales), `findSlashQuery` unchanged semantics, filtering over name + description, target metadata.

#### B7. Permission modes

- RP-220 Mode store. `useRelayPermissionStore` (`src/stores/useRelayPermissionStore.ts`, Zustand, persisted under `rq_relay_permission_mode`): `mode: "always-ask" | "review" | "skip"`, default `"review"` (= today's behavior), `setMode`. Global (not per thread). Constants/types in `src/lib/relay/permission.ts` (`RELAY_PERMISSION_MODES`, `RELAY_DEFAULT_PERMISSION_MODE`).
- RP-221 How the registry consults the mode (normative). One pure, server-safe function in `schemas.ts` (no store/DOM imports, because the server imports this module):

  `approvalNeeded(name, input, mode = "review") -> boolean`
  - kind `read` or `ui` (incl. `ask_user`): never (all modes).
  - kind `confirm`: `always-ask` true; `review` true; `skip` false.
  - kind `auto`: in `NAVIGATION_TOOLS` (`open_item`, `close_tab`, `close_all_tabs`): never (all modes). Otherwise `always-ask` true; `review` only when `requiresBulkApproval(name, input)` (bulk > `BULK_CONFIRM_THRESHOLD` 10); `skip` false.
  - Registered confirm gate (`registerConfirmGate`, dirty-tab save/discard/cancel): independent of the mode in all modes (it is a question about unsaved edits that Undo cannot restore, not an approval).

  `awaitsUser(name, input, mode = "review")` = `ask_user` || `approvalNeeded(...)` || confirm gate. Default parameter keeps every existing caller and server use unchanged.
  - `executeTool` / `runValidated`: `needsApproval = approvalNeeded(name, parsed.data, context.permissionMode)`; if `needsApproval` and `permissionMode !== "skip"` then require `isGranted(context.approval)` else `APPROVAL_REQUIRED`. `ToolContext` gains `permissionMode?: RelayPermissionMode` (default review). In `skip` mode confirm tools run without a token because the user's explicit mode choice is the approval; `grantApproval()` is still only minted on the Approve path (no token minting for skip). The mode is never part of tool input or the server payload, so model text cannot set it.
  - `useRelayChat`: reads the mode from the store at `onToolCall` time and passes it to `awaitsUser` and into `ToolContext`. The decision is recorded per `toolCallId` (a set of awaiting ids) and `promptCard`/`pendingToolCalls` use that record, not a re-evaluation, so flipping the mode while a card is pending neither orphans the card nor auto-approves it.
  - Always ask for auto tools: auto tools have no `describe` today, so `previewConfirmation` would return null. Add a generic fallback `describeGeneric(tool, input, store)`: `action: "change"` (new `ConfirmAction`), `severity: "caution"`, `targets` = real names resolved from the tool's `refs(input)` against live store (falls back to the step label from `stepLabels.ts`), `count`. `ConfirmCard` renders it with new `confirm.change.*` keys. Built from live state, never model text (preserves AC-17).
  - Skip mode: no Confirmation Card; the `ChangeCard`/`TurnChangeBar` Undo and "Change Card" remain for every write; confirm tools that cannot be undone (deletes are already snapshot-undoable via the change log where implemented; `send_request`/`run_chain` are not undoable) run immediately; a persistent one-line notice "Approvals are off" appears under the composer toolbar's shield while in skip mode.
  - Supersedes FR-42 ("confirm tools refuse to run without a token") and the relay-improvements success criterion "every destructive or lossy action is confirmed in-chat", for Skip mode only; both still hold in Review and Always ask.
  - Always ask gates every tool that creates, edits, deletes or runs, and EXEMPTS navigation-style tools (Q13 RESOLVED). Enumerated from `RELAY_TOOL_SCHEMAS`: `open_item`, `close_tab`, `close_all_tabs` (the only open/focus/close-tab tools; there is no separate focus/switch tool). They are declared in a named `NAVIGATION_TOOLS` constant in `schemas.ts`, and `approvalNeeded` returns false for them in every mode. Not exempt (they change data): `set_active_environment` (changes the persisted active environment), `create_*`, `update_*`, `rename_*`, `move_item`, `duplicate_request`, `set_*`, `bulk_update_requests`, `import_curl`, `generate_tests`, `export_history`, all `confirm` tools. Closing a tab with unsaved edits still triggers the dirty-tab gate regardless of mode. A unit test asserts every `auto` tool is either in `NAVIGATION_TOOLS` or gated by Always ask, so a new tool must be classified.
  - AC (unit): table-driven test of `approvalNeeded` over {read, ui, auto small, auto bulk 11, confirm} x {3 modes}; `executeTool` with `mode: "skip"` runs `delete_request` without a token; with `review` returns `APPROVAL_REQUIRED`; `ask_user` still awaits in skip; a hand-built object is still rejected as an approval token; mode cannot be set via tool input (schema has no such field).
- RP-222 Shield button + popover (UI). A shield icon button immediately after `+` in the composer toolbar (`relay-permission-trigger`, tooltip "Approval mode: <name>") opens a popover "How should Relay ask for approval?" with three radio rows (role `radiogroup`, arrow-key nav, `relay-permission-option-<mode>`):
  - **Always ask**: "Every change waits for your Approve." (every write, including auto changes)
  - **Review for me** (default, "Recommended"): "Relay asks before deleting, sending or running things, and before large bulk edits." (= current behavior)
  - **Skip all approvals**: warning color, label "Use with caution", description "Relay changes things without asking. You can still Undo any change." (Undo/Change Card remain)
  - AC: Opening shows the three rows with the current one selected; choosing closes the popover (focus back on the shield) and updates the icon. The shield glyph/color differs per mode (`data-mode` attribute; skip uses the warning token; verify a warning token exists, else add one to the theme). Esc closes. Persisted across reload.
- RP-223 Settings surface. `RelaySection.tsx` (Settings > Relay) gets an "Approval mode" control (`relay-permission-select`, same three options and copy, shares the store), so the composer and Settings always agree.
  - AC: Change in Settings, open Relay: shield reflects it; change via shield, reload Settings: select reflects it.
- RP-224 Behavior e2e matrix: with a scripted stream calling `create_collection` (auto), `delete_request` (confirm), `get_request` (read), `ask_user`: Always ask => card for first two, none for read, ask_user card always; Review => card only for delete; Skip => no cards for the first three, ask_user still shows, Undo toast/Change Card present for the create.
- RP-225 Telemetry: `relay_permission_mode_changed {from,to}` added to `RelayEventMap` (no workspace data). (Optional; drop if telemetry sink review objects, Q6.)

#### B8. Remove like/dislike

- RP-226 Remove the thumbs-up/thumbs-down buttons from `MessageActions.tsx` (keep Copy and Regenerate), the `rating` state/`handleRate`, the `relay_feedback` event and `RelayFeedbackRating` from `telemetry.ts`, i18n keys `actions.thumbsUp`/`actions.thumbsDown` (en/fr/ja), and their tests: `MessageActions.spec.tsx` cases, `telemetry.spec.ts` feedback cases, `relay-improvements-qol-actions.spec.ts` + `.feature.md` thumbs scenarios (and the `relay-improvements-qol-rewrite.feature.md` reference), and doc mentions in `agent_docs/relay-improvements/{SPEC,PLAN,TASKS}.md` (annotate as superseded rather than rewriting history).
  - AC: Assistant messages show only Copy and Regenerate; `rg "relay_feedback|thumbsUp|thumbsDown|relay-thumbs"` under `src e2e messages` returns nothing.

## 5. Non-functional requirements

- Accessibility: all new menus/popovers (conversation overlay, row menu, mention menu, launcher, shield popover, capabilities popover) have role/aria (`menu`/`listbox`/`dialog`), keyboard operation, visible focus rings, Esc to close, and return focus to their trigger. Mention and slash menus keep focus in the textarea with `aria-activedescendant`. Tooltips appear on focus. Color is never the only signal (shield mode has icon + label; skip has text "Use with caution"). Contrast >= 4.5:1 text, 3:1 UI in light and dark. Touch targets >= `RELAY_MIN_TOUCH_TARGET_PX` on the mobile sheet. `prefers-reduced-motion`: no shimmer/slide/fade animations; popovers are instant (the dock slide transition already honors `motion-reduce`). Axe scan (existing `relay-improvements-a11y-axe` spec) passes with menus open.
- Privacy: redaction order unchanged (`redactDeep` last); nothing new is sent that was not attached; secret env values always `[redacted]`; the permission mode never reaches the server; relative-time/full-date use only thread metadata already local.
- Performance: Relay chunk stays lazy; `RelayLogo` is tiny; the mention/launcher lists reuse virtualization; `/app` first-load gzip must not grow more than 5 kB over the `BUNDLE.md` baseline (757.2 kB); unit/`next build` size check in the final phase.
- i18n: every new string in `messages/{en,fr,ja}/relayDock.json` (and the settings namespace used by `RelaySection`); placeholders `{count}`, `{name}` preserved; removed keys removed from all three; vendor/model names must not appear in shipped UI (`brandGuard.spec.ts` stays green).
- Code: follow project CLAUDE.md: Zustand for cross-cutting UI state (permission mode, recents, dock width), Context only for subtree-local state; named constants for all sizes, timings, percents, thresholds; functions < ~30 lines; no commented-out code; no silent catches.

## 6. Slash commands: mapping to existing tools

All new actions are prompt-only (no new tool, no schema change). "Needs target" drives RP-204.

| Command | Group | Needs target | Existing tools the prompt steers toward | Kind / notes |
|---|---|---|---|---|
| `/explain` (existing) | Understand | tab or request | `get_active_context`/`get_request`, `get_last_response` | prompt-only |
| `/summarize` | Understand | any attached | `get_collection`, `get_request`, `get_chain`, `get_last_response` | prompt-only |
| `/docs` (existing) | Understand | collection | `generate_docs` (phase 11) | existing tool |
| `/new` | Build | none | `create_request`/`create_graphql_request`/`create_websocket_request`/`create_socketio_request`, `create_collection`; `ask_user` for missing collection/method | prompt-only |
| `/import` | Build | none | `import_curl` (cURL only; OpenAPI/Postman out of scope) | prompt-only, existing tool |
| `/chain` | Build | none | `create_chain`, `add_chain_node`, `connect_chain_nodes`, `update_chain_node` | prompt-only |
| `/env` | Build | optional environment | `create_environment`, `set_env_variables`, `set_active_environment`, `list_environments` | prompt-only (values only if shareValues; secrets stay redacted) |
| `/assert` (existing) | Test | request (tab) | `generate_tests` (assertions from last response) | existing tool |
| `/tests` | Test | request | `set_request_scripts` (post-response test script) after `get_last_response`; distinct from `/assert` (assertions) | prompt-only, existing tool |
| `/run` | Run | request or chain | `send_request` (confirm), `run_chain` (confirm) | existing tools; approval per mode |
| `/fix` | Run | request | `get_last_response`, then `update_request`/`update_tab_request`/`set_request_*` | prompt-only |
| `/diff` | Run | request | `diff_responses` (needs >= 2 stored responses; else says so) | existing tool |
| `/curl` (existing) | Share | request | `export_curl` | existing tool |
| `/export` | Share | request or none | `export_curl`, `export_history` (cURL and history only; other code formats out of scope) | prompt-only, existing tools |
| `/clear` (existing) | Chat | none | local action, confirm if thread non-empty | no model call |

Slash menu groups (order): Understand, Build, Test, Run, Share, Chat.

## 7. Data and state changes

- `useRelayStore`: remove `draftChips`, `removedChipKeys`, `dismissedAutoChipTabId`, `removeChip`, `resetRemovedChips`, `dismissAutoChip`; keep `width`/`setWidth` (px, now clamped to `max(30vw, 320px)`..`max(40vw, 320px)`, RP-110) and add `getRelayMinWidth`/`getRelayDefaultWidth` next to `getRelayMaxWidth`/`clampRelayWidth`; `attachedItems` now holds `tab | request | collection | environment | chain` chips; `newThread` still clears attachments and drafts. Keep `open`, `position`, `shareValues`, `enabled`, `activeThreadId`, `pendingPrompt`, `composerPrefill`, `focusRequest`, `composerHasText`.
- New `useRelayPermissionStore` (mode) and `useRelayRecentStore` (recent attachments, capped, names/ids only).
- `src/lib/relay/chips.ts`: `ContextChipKind` adds `tab`; `isAutoChip` removed.
- `contextBuilder.ts`: `computeContextChips`/`selectActiveChips` removed; `buildChatPayload` input becomes `{messages, store, redact, attachedItems}`; `describeAttached` handles `tab`.
- `constants.ts`: add `RELAY_MIN_WIDTH_VW`/`RELAY_DEFAULT_WIDTH_VW`, change `RELAY_MAX_WIDTH_VW` to 40, remove `RELAY_DEFAULT_WIDTH_PX` (RP-110), `RELAY_NEW_CHAT_SHORTCUTS`, `RELAY_STORAGE_KEYS.{permission, recent}`, relative-time thresholds, recents cap, launcher/mention constants.
- `schemas.ts`: `NAVIGATION_TOOLS`, `approvalNeeded`, mode-aware `awaitsUser`, `get_active_context` (behavior change only, name kept); `registry.ts`: `ToolContext.{permissionMode, attached}`, `ConfirmAction` + `"change"`, `describeGeneric`.
- `telemetry.ts`: remove `relay_feedback`/`RelayFeedbackRating`; optionally add `relay_permission_mode_changed`.
- No IndexedDB thread schema change (message parts already stored in order).

## 8. Testing strategy

Gherkin-first like relay-improvements: scenarios in `e2e/scenarios/relay/relay-polish-<area>.feature.md` with ids `REL-POL-<AREA>-nn` (areas: SHELL, THREADS, MSG, COMPOSER, MENTION, LAUNCHER, SLASH, PERM, SHIELD, CAPS, CTX, PANEL (dock width), A11Y), each backed by `e2e/qa/relay/relay-polish-<area>.spec.ts` (`@qa`, `seededPage`, `relayRoutes.ts` mocks incl. scripted text/tool/text streams, `getByTestId` first, no `waitForTimeout`), `check-ids.sh` parity green. Unit specs next to each new/changed module (>= 80% per file). Browser design verification via agent-browser (section 3). Targeted runs only.

Existing specs that will break or need rewriting (update in the same task that changes the behavior):
- Context removal (RP-201..205): `relay-improvements-context-chip`, `-context-payload`, `-context-suggestions`, `-pills` (if they assert auto chips), `-picker`; unit `ContextChips.spec`, `EmptyState.spec`, `contextBuilder.spec`, `chips.spec`, `useRelayStore.spec`, `suggestions.spec`, `followUps.spec` if tab-tied, `useRelayChat` specs, `workspaceRead`/`get_active_context` specs.
- Layout/dock width (RP-110, 102): `relay-improvements-layout`, `-a11y-layout`, `-a11y-keyboard` (resize keys and bounds), `relay-shell` (toggle location, dock geometry), `relay-chat`, `relay-privacy` (selectors for chips/context); unit `RelayDock*.spec`, `RelayRoot.spec`, `ResizeHandle.spec`, `constants.spec`, `useRelayStore.spec`, `LeftPanel.spec`, `TabBar.spec`, `MainLayout.spec`, `RelayToggleButton.spec`, `KeyboardShortcutsModal.spec`.
- Threads (RP-104/105/107): `relay-threads` (confirm dialog, pencil/trash), `ThreadList.spec`, `RelayHeader.spec`.
- Composer/menus (B3-B6): `RelayComposer.spec`, `SlashMenu.spec`, `slashCommands.spec`, `RelayPicker*.spec`, `relay-improvements-picker`, `-a11y-mic` (mic position), `-qol-stop`, `-voice`.
- Feedback (RP-226): `MessageActions.spec`, `telemetry.spec`, `relay-improvements-qol-actions`.
- Confirm flows (RP-221): `relay-confirm`, `relay-write`, `registry` specs, `useRelayChat` approval specs, `schemas.spec` (`awaitsUser`).
- Rendering (RP-108/109): `RelayConversation.spec`, `relay-chat`.

## 9. Boundaries

- Always: write the Gherkin scenario and failing test first; keep `schemas.ts` free of store/DOM imports; derive "what Relay can do" and approval badges from the same functions the runtime uses; run only task-relevant tests; follow the design process (section 3); keep Undo/Change Card for every write; keep redaction last.
- Ask first: adding any dependency; changing the server route or the model-facing tool list beyond the rename and system-prompt rule; deleting more than the e2e/unit specs listed in section 8; raising/lowering the mobile breakpoint.
- Never: send attached or implicit context that bypasses `redactDeep`; let tool input or model text set the permission mode; mint an `ApprovalToken` outside the Approve path; remove Undo; write vendor/model names into UI strings; commit (the build-phases flow commits after the verifier PASS); run `npm`; run the full e2e suite; use the chrome-devtools MCP.

## 10. Success criteria

1. Section 4 acceptance criteria all pass in the browser; the A7/A8 repros from the screenshots no longer reproduce (scripted text/tool/text and text/ask_user streams).
2. With a request, collection and environment open and nothing attached, the chat request body contains no `activeTab`/`collection`/`environment` data; attaching shows a pill and sends exactly that item.
3. Shield modes behave per the RP-224 matrix; `approvalNeeded` table test green; no token minted outside Approve.
4. Dock width is limited to `max(30vw, 320px)`..`40vw` (default 30vw), persists clamped, page content stays uncovered (body reserve kept), mobile sheet unchanged.
5. `rg` finds no remaining references to removed symbols (`RELAY_DEFAULT_WIDTH_PX`, `relay_feedback`, `dismissAutoChip`, `computeContextChips`, Sparkles in Relay).
6. `bunx tsc --noEmit`, `bunx biome check`, targeted vitest and the listed Playwright specs, `check-ids.sh` all green; `/app` first-load gzip within +5 kB of baseline; `brandGuard` green; i18n parity for en/fr/ja.

## 11. Suggested slicing (for PLAN; non-binding)

P1 rendering fixes + logo + toggle move + tooltips + shortcuts (RP-101..103, 106..109, 226) -> P2 conversation menu (RP-104/105/107) -> P3 dock width limits (RP-110) -> P4 context removal + payload/tool changes (RP-201..205) -> P5 composer box + mention menu (RP-208..213) -> P6 launcher + slash expansion (RP-214..219) -> P7 permission modes (RP-220..225) -> P8 capabilities + empty state (RP-206/207) -> P9 cleanup, QA sweep, bundle check. P4 must precede P5; P7 must precede P8 (badges).

## 12. Open questions (all RESOLVED by the user; defaults for Q3-Q12 were approved as written)

- Q1. RESOLVED: keep the per-send workspace index (names and counts, redacted) and disclose it under "What Relay can see". Also explicit: the `@` mention menu and `+` launcher search are 100% local (in-app stores); no AI or network request happens until Send (RP-211, RP-214).
- Q2. RESOLVED: min width `max(30vw, 320px)`, max width `40vw`, default `30vw`; the dock is never narrower than 320px (the floor wins on small viewports); design for 320px minimum (see RP-110).
- Q3. RESOLVED (revised by the user): the `ResizablePanel` migration is dropped. The fixed-position `RelayDock`, `ResizeHandle` and body-padding reserve stay, so the open/close slide animation is kept; only the width limits change. The `position` setting remains a no-op (out of scope).
- Q4. RESOLVED (default kept): Dirty-tab save/discard/cancel prompt stays in all modes, including Skip. Default: yes (data-loss guard, not an approval).
- Q5. RESOLVED (default kept): `Ctrl/⌘+Shift+O` may not be overridable in Firefox (Library) and conflicts with Chrome's bookmarks manager unless `preventDefault` wins. Default: ship as specified; document the Firefox caveat.
- Q6. RESOLVED (default kept): Telemetry for permission-mode changes (RP-225). Default: include, no workspace data.
- Q7. RESOLVED (default kept): Recents in the launcher need persistence (`useRelayRecentStore`). Default: persist names/ids in localStorage, cap 5; alternative: session-only.
- Q8. RESOLVED (default kept): "Paste cURL/file": default is cURL-paste only (prefills `/import`); reading a user-chosen file into the draft is deferred.
- Q9. RESOLVED (default kept): The toggle exists only where `TabBar` exists (`/app`). Default: unchanged elsewhere (shortcut only); alternative: add a floating toggle on other routes.
- Q10. RESOLVED (default kept): Group labels in the conversation overlay: default keep Today/Yesterday/Earlier; Notion-style "Past 30 days" optional.
- Q11. RESOLVED (default kept): Switching to Skip all approvals shows no extra confirmation (warning color + "Use with caution" copy only). Alternative: one-time confirm.
- Q13. RESOLVED: Always ask exempts navigation-style tools (`open_item`, `close_tab`, `close_all_tabs`); it gates every tool that creates, edits, deletes or runs (RP-221).
- Q12. RESOLVED (default kept): Does deleting the `@Name` token text in the draft auto-detach the pill? Default: no (pill is the source of truth).

## Appendix A. New and changed test ids

`relay-logo`, `relay-toggle` (moved), `relay-new-thread` (existing id kept), `relay-header-capabilities`, `relay-close`, `relay-thread-trigger`, `relay-thread-overlay`, `relay-thread-time`, `relay-thread-menu-trigger`, `relay-thread-menu-rename`, `relay-thread-menu-delete`, `relay-dock` (existing, the aside), `relay-resize-handle` (existing), `relay-composer-box`, `relay-composer-pill`, `relay-composer-pill-remove`, `relay-permission-trigger`, `relay-permission-option-always-ask|review|skip`, `relay-permission-select` (Settings), `relay-mention-menu`, `relay-mention-option`, `relay-launcher`, `relay-launcher-search`, `relay-launcher-row`, `relay-slash-group`, `relay-capabilities`, `relay-capabilities-category`, `relay-capabilities-example`, `relay-approvals-off-notice`. Removed: `relay-context-chips`, `relay-context-chip*`, `relay-see-what`, `relay-thumbs-up`, `relay-thumbs-down`, `relay-thread-rename`, `relay-thread-delete`, `relay-thread-delete-dialog`, `relay-thread-delete-confirm`, none of the dock/handle ids are removed.
