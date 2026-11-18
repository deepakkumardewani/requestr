# Spec: polish-and-landing

Status: draft for human review. Source of truth for intent: the confirmed interview decisions (all final). Planning only; no feature code in this document.

## 1. Overview

Requestr (Next.js app; landing at `src/app/page.tsx`, app at `/app`) shipped Relay (AI assistant). The app and landing page now lag behind. This feature is ONE phased plan, eight phases (P5b inserted after P5):

| Phase | Name | Output |
|---|---|---|
| P1 | Misc fixes | Shortcut labels, logo link, empty state, Open-in-Relay audit |
| P2 | Left sidebar | Fast collection expand/collapse, row polish, health cursor, grouped "+" menu |
| P3 | Settings | Audit/redesign of every tab, Language folded into General, 2-column Shortcuts |
| P4 | Technical docs | diagram-design skill installed; internal docs in `docs/` |
| P5 | Research | Verified comparison table, ranked gap report |
| P5b | Comparison upgrade | Grouped table with six new sourced rows, no visible code paths, friendlier footer, measured speed-proof strip |
| P6 | Hero concepts (GATE) | 2-3+ prototypes; user picks one |
| P7 | Landing build | Chosen hero, Relay section + real-app video, full landing pass, legal pages |

Users: developers evaluating Requestr (landing); the developer as daily user (app).

## 2. Goals

- Every listed item is verifiably fixed (see per-phase acceptance criteria).
- Every comparison-table claim has a cited, checked source URL.
- The hero is chosen by the user from working prototypes (P6 gate).
- Privacy Policy and Terms pages are live and linked in the footer.
- Tone: sophisticated, restrained, not flashy. `prefers-reduced-motion` always respected.

## 3. Non-goals / Out of scope

- Analytics (belongs to another project; dropped entirely).
- Implementing competitor-gap features (P5 is report only; each becomes its own future plan).
- Public docs site (P4 docs are internal only).
- Relay behavior changes (off-topic answer inconsistency, vendor names in Relay settings were screenshot context only).
- The `/motion-video` Remotion pipeline (the demo video is recorded from the real app).

## 4. Assumptions (user-confirmed unless marked)

1. Package manager is `bun` only; never `npm`.
2. Dev server is already running at `https://requestly.localhost` (app at `/app`, landing at `/`); it is never started by implementers. Browser verification uses `agent-browser` with a repo-unique session and closes it afterward.
3. Cross-cutting UI state goes in Zustand stores under `src/stores/use<Name>Store.ts`.
4. No tests for `src/components/reactbits/`.
5. Only phase-relevant e2e specs run; never the full suite.
6. (Resolved default) The hero prototypes in P6 live at `/hero-lab/*` routes, `noindex`, unlinked from public nav, so they do not ship before the pick.

## 5. Commands

```
Install:   bun install
Typecheck: bun run typecheck          # tsc --noEmit (run once at end of each phase, not mid-task)
Lint:      bun run lint:check         # biome check ; fix: bun run lint:write
Unit:      bun run test               # vitest run ; targeted: bun run test src/components/settings
Coverage:  bun run test:coverage
E2E:       PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/<phase-relevant>.spec.ts
           # the env var is MANDATORY: without it playwright.config.ts `webServer` starts a dev server (forbidden)
Build:     E2E_DIST_DIR=.next-e2e bun run build   # NEVER plain `bun run build`: it overwrites the dev server's .next
Preview:   E2E_DIST_DIR=.next-e2e bun run start -p 3100   # isolated prod preview for Lighthouse/perf; check 3100 is free first, kill the PID after
Lighthouse: bunx lighthouse http://localhost:3100/ --form-factor=mobile --only-categories=performance,accessibility --output=json   # never npm install -g
```

## 6. Project structure (real paths found during orientation)

```
src/app/page.tsx                      landing entry
src/components/landing/               Nav, Hero, ProductVisual, FeatureShowcase, HowItWorks, BeyondSend,
                                      ImportSection, ComparisonTable (visual pass only; builds on P5b final data, groups and stat strip and must not change sourced claims, URLs, tiers or codeRefs, and changes measured values only by re-running the measure script, see P5b and FR-44), FinalCta, Footer, AllFeaturesPage,
                                      LandingPage, constants.ts, data/ (comparison.ts; new P5b speedProof.ts), features/, beyond/, hooks/
src/app/features/                     AllFeaturesPage route
src/app/settings/                     page.tsx, SettingsPageClient.tsx, constants.ts (shortcut groups, theme options)
src/components/settings/              General/Global/Appearance/Proxy/Shortcuts/Language/Data/Relay sections,
                                      SettingsNav.tsx, ClearHistoryDialog.tsx, backup/
src/components/layout/                TabBar.tsx, LeftPanel.tsx, EmptyState.tsx, KeyboardShortcutsModal
src/components/collections/           CollectionTree, CollectionRequestTree, VirtualizedRequestList, RequestItem,
                                      HealthDot, HealthPopover, SaveRequestModal
src/components/relay/                 OpenInRelayButton.tsx (+ src/lib/relay/openInRelay.ts), RelayConversation, ThreadList
src/components/common/CommandPalette.tsx   uses useRelayStore toggle
src/lib/platform.ts                   isMac(), modKey()
src/stores/                           Zustand stores
public/logo.png                       app logo; public/intro/ (new, P7 video assets)
docs/                                 new, P4 internal docs
e2e/                                  Playwright specs (existing: home, collections, chain, ...)
agent_docs/polish-and-landing/        this spec, TASKS, QA artifacts; research/ (P5 notes, url-check; P5b speed-measure.mjs + raw output)
messages/*/shortcuts.json             shortcut label i18n (labelKey in src/app/settings/constants.ts)
```

## 7. Code style and testing

- Follow `~/.claude/skills/{code-style,typescript-best-practices,vercel-react-best-practices,next-best-practices}` and `.claude/skills/shadcn-component-rules`. Functions under ~30 lines, no magic numbers (named constants), early returns, extract large inline JSX into components.
- Shortcut convention: every label renders from the registry (`src/app/settings/constants.ts`) through one shared formatter. `ctrlOnly` entries render a literal "Ctrl" on ALL platforms (mac included, because `useKeyboardShortcuts.ts` matches `ctrlKey && !metaKey` to avoid browser Cmd shortcuts); mod entries render via `modKey()`/`isMac()` from `src/lib/platform.ts`. Never hardcode key arrays or key strings in a component.
- Testing: Vitest + Testing Library specs colocated (`*.spec.tsx`); Playwright for flows. Existing specs to update when behavior changes: `ShortcutsSection.spec.tsx`, `KeyboardShortcutsModal.spec.tsx`, `CommandPalette.spec.tsx`, `OpenInRelayButton.spec.tsx`, `CollectionTree.spec.tsx`, `GeneralSection.spec.tsx`, `DataSection.spec.tsx`, `RelaySection.spec.tsx`, `ComparisonTable.spec.tsx`, `Hero.spec.tsx`, `src/app/settings/page.spec.tsx`.

## 8. Boundaries

- Always: use `bun`; update specs with behavior changes; check light + dark theme and 375px width for every UI change; run typecheck/lint at phase end; cite sources for factual claims.
- Ask first: new runtime dependencies (e.g. animation or virtualization libs), changes to persisted store shapes (migration needed), new API routes, any new setting that changes request behavior.
- Never: run `npm`, start the dev server, commit unless instructed, write personal data into recorded video/screenshots, name AI vendors in UI copy, change Relay behavior, ship unsourced comparison claims.

---

## 9. Phase P1 - Misc fixes

Context: `TabBar.tsx` lines ~215 and ~245 render "New Request" with `<Kbd>{modKey()}+N</Kbd>` (wrong on mac: N is `ctrlOnly`, so it shows ⌘+N for a Ctrl+N binding); `useKeyboardShortcuts.ts` binds both Ctrl+T and Ctrl+N (ctrlOnly) to new request/open tab, but the registry has no Ctrl+T entry; Relay chords live in `src/lib/relay/constants.ts` (mac ⌘I, other Ctrl+Shift+L) surfaced via `getRelayShortcuts`/`toShortcutAlias` in `src/app/settings/constants.ts`; Relay toggle exists via `useRelayStore.toggle` and `useRelayShortcut.ts`; logo is `LeftPanel.tsx` (`/logo.png`, alt "Requestly Logo"); empty state is `src/components/layout/EmptyState.tsx` (hardcodes `["Ctrl","N"]` as newCollection, and "Press Ctrl+T"); shortcut registry is `src/app/settings/constants.ts`.

Requirements
- FR-01 The tab-bar "+" tooltip shows Ctrl+T on every platform (mac included; the binding is ctrlOnly). Add a Ctrl+T new-tab entry to the registry (alias of new request) and render the tooltip from it. It must not show N or ⌘. Fix both TabBar occurrences (~215, ~245).
- FR-02 The Relay top-right icon has a tooltip with label and its real shortcut (Toggle Relay: ⌘I on mac, Ctrl+Shift+L elsewhere), styled like the other toolbar tooltips. Source the chord from `src/lib/relay/constants.ts` via the registry helpers, not a string literal.
- FR-03 Clicking the top-left app logo in `LeftPanel.tsx` navigates to `/` (landing). It is a real link (`next/link`), keyboard focusable, with an accessible name. Unsaved-tab state is not lost (tabs persist per existing store behavior; verify).
- FR-04 Audit every shortcut label surfaced in: EmptyState, TabBar tooltips, CommandPalette, KeyboardShortcutsModal, Settings Shortcuts, and any other `Kbd` usage. Produce a single source of truth (the registry in `src/app/settings/constants.ts`) and make all surfaces read from it. Known conflict to resolve: EmptyState shows "New collection Ctrl N" while the real binding (and Settings) is New Request Ctrl+N / New Collection Ctrl+Shift+N; the binding wins, labels are corrected.
- FR-05 Redesign `EmptyState.tsx` using the ui-ux-pro-max skill: keeps a clear primary action (new request), a compact, accurate shortcuts list from the registry, works in light/dark, mobile widths, and reduced motion. Copy reviewed (current: "Send a request. Build a workflow.").
- FR-06 Remove "Open in Relay" from the URL bar (`UrlBar.tsx`) since it duplicates the wand AI-generate button and leaks an internal prompt.
- FR-07 Audit the 8 remaining entry points (HeadersEditor, BodyEditor, ScriptEditor, ResponsePanel, AssertionsTab, ErrorExplainer, TransformPlayground, TransformPage) that use `OpenInRelayButton.tsx` + `src/lib/relay/openInRelay.ts`: each pre-fills a short, human-readable prompt (e.g. "Why did this request fail?") and attaches context as a pill chip. No internal instruction text ever appears in the composer.
- FR-08 Each remaining entry point renders as an icon-only button with a tooltip (label), not a text button; has `aria-label`.
- FR-09 When Relay is disabled by setting, none of the Open-in-Relay buttons render and the Relay icon/shortcut behavior is consistent with the existing setting.

Acceptance criteria
- AC-01 Hovering "+" shows "Ctrl+T" on both mac and non-mac (unit test mocking `isMac()` true and false; one manual check).
- AC-02 Hovering the Relay icon shows "Toggle Relay" plus ⌘I (mac) / Ctrl+Shift+L (other), asserted with `isMac()` mocked both ways; pressing that shortcut toggles the panel.
- AC-03 Clicking the logo lands on `/` (Playwright: URL equals `/`); Tab+Enter on the logo does the same.
- AC-04 A test enumerates all shortcut label surfaces and asserts equality with registry entries; zero hardcoded key arrays or key strings remain in components (e.g. EmptyState's `["Ctrl","N"]` and "Press Ctrl+T" are gone; `grep -rnE 'keys: \["(Ctrl|⌘)' src/components` returns nothing).
- AC-05 Empty state screenshots in light/dark at 375px and 1440px are captured to `agent_docs/polish-and-landing/qa/` with no overflow and no horizontal scroll. At 375px the app shows the "Best on desktop" gate, so the empty state itself is verified at 1440px.
- AC-06 `grep -n OpenInRelayButton src/components/request/UrlBar.tsx` returns nothing; the set of non-spec files under `src` that import `OpenInRelayButton` (excluding `OpenInRelayButton.tsx` itself) is exactly the 8 named in FR-07.
- AC-07 For each of the 8 entry points, a spec asserts the composer text contains no occurrence of internal markers (e.g. "IMPORTANT:", "Build an HTTP request from this description") and is at most 80 characters; context appears as a chip (the Transform page has no chip: its input is page-local).
- AC-08 Each of the 8 buttons has role button, an accessible name, a tooltip on hover/focus, and no visible text label.

## 10. Phase P2 - Left sidebar

Context: `src/components/collections/` already contains `VirtualizedRequestList.tsx` (67 lines) and `CollectionRequestTree.tsx` (379 lines), so lag is NOT presumed to be missing virtualization. Root cause must be measured.

Requirements
- FR-10 Root-cause the expand/collapse lag on a collection with 148 requests (e.g. "OpenAI") with a profile (React Profiler and/or Chrome performance trace via agent-browser). Record findings (what re-renders, what layout/animation cost, whether virtualization is bypassed) in `agent_docs/polish-and-landing/p2-profile.md` before fixing.
- FR-11 Fix the root cause (virtualization or equivalent: memoized rows, store selector narrowing, avoiding height animation over N rows, etc.). Expand and collapse must feel instant.
- FR-12 Apply impeccable + layout skills to the collection parent row (spacing, alignment, hover/active states, count badge, chevron, truncation).
- FR-13 The per-request health pill (`HealthDot.tsx`, with `HealthPopover.tsx` showing p50/p95/last) uses `cursor: help` over the pill.
- FR-14 The sidebar "+" dropdown (HTTP, GraphQL, WebSocket, Socket.IO, Collection, Environment, Chain, Import) is grouped with labels. Grouping (resolved): Requests (HTTP, GraphQL, WebSocket, Socket.IO), Workspace (Collection, Environment, Chain), Import. Uses the shadcn group/label primitives per `shadcn-component-rules`.
- FR-15 Keyboard navigation, focus rings, and expand/collapse state persistence (`useFolderExpandStore`) remain intact.

Acceptance criteria (measurable)
- AC-09 Baseline and after numbers recorded in the profile doc for: click-to-next-paint on expand and on collapse of the 148-request collection, on the same machine, 4x CPU throttle also recorded.
- AC-10 After fix, expand and collapse of the 148-request collection: click-to-next-paint <= 100 ms unthrottled (target <= 200 ms at 4x CPU throttle); no single long task > 50 ms in the Performance trace during the interaction. The fix must meet these thresholds AND show >= 3x improvement on every metric that failed at baseline. Numbers of record are measured on the isolated prod preview (`http://localhost:3100/app`); dev-server numbers are informational.
- AC-11 DOM node count for the expanded 148-request collection is bounded by the viewport window (target: rendered request rows <= 40), verified in devtools/agent-browser eval.
- AC-12 Scrolling the expanded list sustains no long task > 50 ms and no blank-row flashes.
- AC-13 Computed style of the health pill is `cursor: help` (unit/e2e assertion); tooltip still opens.
- AC-14 The "+" menu renders three labeled groups, in order, each item still creating the right entity (existing collections e2e spec stays green).
- AC-15 Expand state survives reload (existing behavior) and arrow-key navigation works on the virtualized list.

## 11. Phase P3 - Settings

Context: tabs today are General, Global, Appearance, Proxy & SSL, Shortcuts, Language, Data, Relay (`src/components/settings/*Section.tsx`, `SettingsNav.tsx`, `src/app/settings/SettingsPageClient.tsx`).

Requirements
- FR-16 Audit every tab and the overall page with ui-ux-pro-max, impeccable and layout skills; record findings in `agent_docs/polish-and-landing/p3-audit.md` before implementation.
- FR-17 Fold Language into General as a row; remove the Language tab and `LanguageSection.tsx` (or reduce to a shared row component). Settings sections are hash-based (`useSettingsSectionStore`, hashchange); `/settings#language` (and any persisted request for the language section) lands on General without error. Remove `LanguageSection.tsx` (no spec exists for it).
- FR-18 Resolve the unclear "Global" tab: either rename with an explicit purpose description or merge its content into the correct tab; final decision documented in the audit.
- FR-19 Resolve the duplicated "Clear history": General "Data Management" (Clear History, Restart Tour) vs Relay "Clear all Relay history" vs the Data tab. Either merge into one Data location or label scope explicitly ("Request history" vs "Relay conversations") with confirm dialogs stating exactly what is deleted. Data tab and General Data Management card must not overlap.
- FR-20 Shortcuts tab: two-column layout so all shortcuts fit without vertical scrolling at 1440x900 and 1280x720 viewport; falls back to one column below a named breakpoint.
- FR-21 Add a small number of useful, low-risk new settings that do NOT change request execution (resolved default set: "Ask before closing unsaved tabs" (today `useCloseTabGuard` always prompts on dirty tabs, so this is an opt-out toggle, default ON), and a reduced-motion override: system/on/off). The P3 audit may add at most one more UI-only setting with written rationale. Excluded: timeout, follow-redirects, send-on-enter (execution semantics or conflicting with editor keys; would be Ask-first). Each must be wired end to end, persisted, default-preserving, and tested.
- FR-22 Improve copy of every section: concise labels, one-line descriptions, no vendor names, consistent casing.
- FR-23 Relay disabled by setting: Relay tab shows a clear disabled state or is hidden consistently; shortcut section hides the Relay toggle row accordingly.

Acceptance criteria
- AC-16 `SettingsNav` lists exactly the agreed tab set (Language absent); `src/app/settings/page.spec.tsx` and `constants.spec.ts` updated and green.
- AC-17 Language selection works from General and persists across reload (existing language spec/e2e adapted).
- AC-18 No two visible actions in Settings share the same label unless their scope text differs; a spec asserts the Clear-history labels/dialog copy name their distinct scope.
- AC-19 Shortcuts tab at 1280x720: `document.scrollingElement.scrollHeight <= clientHeight` for the content region (agent-browser check); screenshot saved.
- AC-20 Each added setting has: store field, persistence, default, UI control, and a spec; old persisted state without the new fields loads with defaults (no crash).
- AC-21 Every tab passes axe with zero serious/critical violations in light and dark, and has visible focus rings; 375px width shows no horizontal scroll.
- AC-22 Screenshots of all tabs before/after in both themes stored under `agent_docs/polish-and-landing/qa/p3/`.

## 12. Phase P4 - Technical docs

Requirements
- FR-24 Install https://github.com/cathrynlavery/diagram-design globally as a Claude skill (user-level skills dir, `~/.claude/skills/`); verify it loads. Report the exact install command and result. (Ask first if the install method needs anything beyond cloning into the skills dir.)
- FR-25 Audit existing docs (`README.md`, `CLAUDE.md`, `agent_docs/*`, `graphify-out/`) for accuracy and gaps; record a gap list in `docs/README.md` (index) or the audit note.
- FR-26 Write `docs/ARCHITECTURE.md` covering: Zustand stores (`src/stores`), Relay, chain runner, proxy and request pipeline, and API routes `/api/ai`, `/api/hub`, `/api/proxy`, `/api/relay`, `/api/schema`, `/api/share` (verify the list against `src/app/api` at write time), with diagram-design diagrams.
- FR-27 Write focused docs: data model, Relay architecture, and others the audit finds missing (candidates: request pipeline, chain runner, persistence and storage keys, shortcut registry, testing/QA).
- FR-28 Docs are internal (developer + future agents): link from README, no public site, no secrets, no invented behavior; every claim traceable to a file path reference.

Acceptance criteria
- AC-23 `~/.claude/skills/diagram-design` exists and is listed in available skills in a fresh session.
- AC-24 `docs/ARCHITECTURE.md` references each of the six API routes and each exists under `src/app/api` (script check: for each route named, the directory exists; each store file named exists).
- AC-25 Every diagram renders (SVG/Mermaid per skill output) and is legible in light and dark; each is referenced by at least one doc.
- AC-26 A link/path checker run (simple script or `grep`) finds zero broken relative links or nonexistent file paths in `docs/`.
- AC-27 README links to `docs/`.

## 13. Phase P5 - Research

Requirements
- FR-29 Use separate subagents: (a) Postman features, (b) Insomnia features, (c) Requestr features (from code, not marketing). Each subagent reports claims with source URLs (official docs, pricing, changelog) and access date.
- FR-30 Cross-verify: a fourth pass reconciles disagreements; any claim that cannot be sourced is removed or marked "unverified" and not shown as fact on the landing page.
- FR-31 Correct `src/components/landing/ComparisonTable.tsx` (and its data/spec): each row carries a source URL for the Postman and Insomnia cells (and a code reference for Requestr cells); stale claims fixed. Plan versions (free vs paid) are stated where the answer differs.
- FR-32 Write a ranked gap report `agent_docs/polish-and-landing/gap-report.md`: high-value features Postman/Insomnia have that Requestr lacks, ranked by value vs effort with a rubric stated; report only, no implementation.

Acceptance criteria
- AC-28 100% of ComparisonTable rows have a source URL for each competitor cell (data-level assertion in `ComparisonTable.spec.tsx`); every URL resolves (2xx/3xx) at check time or, if the vendor blocks scripted fetches, is manually verified; results and access dates logged.
- AC-29 Every Requestr cell links to a verifiable code path or a manual verification note; no cell claims a feature that a code search cannot find.
- AC-30 Gap report has >= 10 ranked items, each with source URL, rationale and a size estimate (S/M/L); the ranking rubric is at the top.
- AC-31 Table renders in light/dark and at 375px (scroll container contained, no page-level horizontal scroll); source links are keyboard reachable.

## 13b. Phase P5b - Comparison upgrade

Placed after P5 (done, verified, committed; its tasks T5.* are not reopened) and before P6 (order P5 -> P5b -> P6, see section 17). Reworks `ComparisonTable` data and rendering so P7's visual pass (T7.13) builds on final data and groups. FR/AC numbers continue the global sequence (highest before this section: FR-48, AC-46). Baseline for "unchanged" checks: commit `a41f9b1` (P5 research).

Decisions (this section)
- D-5b-1 DECIDED (user, 2026-11-07): "Real-time support" is merged into the existing "Supported protocols" row, renamed "Protocols & real-time" (11 rows). Both old rows cite the same Postman URL and the same Insomnia URL, and every real-time item (WebSocket, Socket.IO, SSE) already appears in the protocols cells, so no sourced claim is dropped; the Requestr cell carries `codeRef` `src/lib/requestRunner.ts` plus `codeRefs` `src/stores/useConnectionStore.ts`.
- D-5b-2 Requestr cell claims must not mention gRPC, MQTT, SOAP, SSE or OAuth (`research/requestr.md` notes); competitor strengths in those areas are shown honestly as competitor-only.
- D-5b-3 Competitor load times are never claimed; only Requestr's own measured numbers appear.
- D-5b-4 A row is dropped (and logged in the Decision Log with reason) rather than shipped with an unsourced cell: if any competitor cell cannot be backed by an official source, or the Requestr cell cannot be backed by code, the row is reworded to what can be proven or removed. AC-28 (100% competitor cells sourced) therefore stays true; expected row counts in AC-51 drop by one per logged removal. Handoff: the cross-verify pass records each removal or rewording in a "Removed / reworded rows" table in `research/p5b-honesty.md` (row, action, reason, date); the data task that applies it appends one line per removal (and per FR-51 group move) to section 21 in the form `LOGGED (P5b, YYYY-MM-DD): row "<feature>" <removed|moved to <group>> - <reason> (research/p5b-honesty.md)`; that is the only SPEC edit allowed during P5b implementation.
- D-5b-5 DECIDED (user, 2026-11-07): the LCP and JS-weight stats measure `/app` (the product; unaffected by P7 landing work and by the strip itself), stated in the caption.

Requirements: UI changes
- FR-49 Requestr `codeRef` stays in the data model and in unit tests, but is NOT rendered anywhere in the table DOM: no text, no attribute of any kind (`title`, `aria-label`, `data-*`, `href`), no tooltip, no link. The existing `<code data-testid="comparison-code-ref">` element is removed and `ComparisonTable.spec.tsx` (line ~106 currently reads that testid) moves its existence check to data level. AC-29's "links to a verifiable code path" is satisfied at data level from P5b on (codeRef present and exists on disk); no UI link is rendered.
- FR-50 Footer note under the table is reworded to friendly, month-level copy, e.g. "Based on each vendor's public docs and pricing, last checked Nov 2026. Plans change, so check their sites for the latest." No ISO date shown. `COMPARISON_CHECKED_ON` (ISO) stays the single source of truth; the display month comes from one pure formatter (`en-US`, short month, `timeZone: "UTC"`, so the month cannot shift with the viewer's timezone), reused by the stat strip caption (FR-56).
- FR-51 Table shape: rows grouped under three subtle section headers, one `<tbody>` per group whose first row is a full-width `<th scope="rowgroup" colSpan={4}>`: "Getting started", "Capabilities", "Cost & data". Cells are short (one line of text plus an optional plan-tier chip); fuller detail lives only behind the competitor Source link. Row assignment (order within group as listed):
  - Getting started: Install required, Account required, Time to first request
  - Capabilities: Protocols & real-time (merged, D-5b-1), Request chains / workflows, AI assistant, Import / export & code generation
  - Cost & data: Pricing model, Data location, Collaboration & teams, Offline use / open source
  Group names and order are fixed. A row may move group only with a reason logged in the Decision Log; AC-49 checks against this list plus logged moves.
- FR-52 Competitor per-cell "Source" links stay (visible citations, keyboard reachable, `target="_blank"`, `rel="noopener noreferrer"`, accessible name "Source for <vendor>: <feature>" as today) but are restyled more subtly (smaller, muted, underline on hover/focus). Text contrast stays >= 4.5:1 in both themes (WCAG 1.4.3, small text; what axe `color-contrast` enforces); the focus indicator stays visible with >= 3:1 against its background (WCAG 1.4.11). The tier chip replaces today's "Plan: <tier>" line.

Requirements: new rows (each freshly researched, official sources only)
- FR-53 Add six rows. Each has a `requestr` cell (text + one or more codeRefs that exist on disk) and `postman`/`insomnia` cells, each with one rendered https official `source` and a `tier` where free vs paid differ. When a cell's claim needs more than one proof, the extra proofs go in an optional array (`codeRefs` for Requestr, `extraSources` for competitors) that is checked by tests but never rendered; the rendered cell keeps exactly one Source link.
  (a) "Request chains / workflows": Requestr chain runner with assertions (`src/lib/chainRunner.ts`) vs Postman Flows / collection runner and Insomnia's equivalent (e.g. its collection runner) as found in official docs. Honest: Postman Flows is the more mature visual product; note its plan tier and limits.
  (b) "AI assistant": Requestr Relay (`src/app/api/relay/chat/route.ts`) vs Postman's and Insomnia's AI features, with plan tier and any usage limits/credits. No AI model vendor names (e.g. OpenAI, Anthropic, Claude, GPT, Gemini) in any cell, including competitor cells (section 8).
  (c) "Import / export & code generation": Requestr imports Postman/Insomnia/cURL/OpenAPI and exports Postman collection and HAR (each verified in code at implementation time, codeRefs for import, export and codegen), and generates code; `src/lib/codeGenerators.ts` currently exports cURL, fetch, axios, Python, Ruby, Java, C#, PHP, Go (9). The cell may summarize (e.g. "9 code languages") to stay one line; competitors stated from their docs.
  (d) "Collaboration & teams": Requestr is single-user/local (share links only, `/api/share`); the gap versus Postman workspaces and Insomnia team sync is shown plainly; `emphasis` is set to the competitor the research shows strongest (never `"requestr"`).
  (e) "Offline use / open source": Requestr stated only as far as code supports. Audit fact: no service worker or web manifest exists, so the app cannot load without network; saved data lives locally in IndexedDB, and Send (via `/api/proxy`) and Relay need network. Open-source status: MIT (`LICENSE`, `package.json`). Postman/Insomnia offline modes and licensing from official docs (Insomnia's official GitHub repo counts as an official source). Where a desktop competitor works offline and Requestr does not, the cell text says so.
  (f) "Time to first request": competitor cells are steps-based (e.g. "Download, install, sign in or skip, then send"), rendered with one official getting-started/download source; per-step sources go in `extraSources` and `research/*.md`. The Requestr cell shows the measured value imported from `speedProof.ts` (never retyped), codeRef = `src/components/landing/data/speedProof.ts`; never a competitor time.
- FR-54 Research artifacts updated: `research/postman.md`, `research/insomnia.md`, `research/requestr.md` gain rows for every new claim (claim, source URL, access date, tier, confidence), unverifiable claims handled per D-5b-4 (FR-30 applies); the cross-verify pass is repeated for the new rows by a pass separate from the writers; `research/url-check.md` is re-run for all new and changed URLs (2xx/3xx, or manual-verification note with date for vendor-blocked fetches).

Requirements: speed proof
- FR-55 A small stat strip renders ABOVE the table with four stats: LCP, first-load JS weight, time to first request (TTFR), and "0 downloads". The first three are MEASURED from a production build; "0 downloads" is measured too (download events counted during the TTFR run). Measurement rules:
  - Build and serve only via section 5: `E2E_DIST_DIR=.next-e2e bun run build` then `E2E_DIST_DIR=.next-e2e bun run start -p 3100` (never plain `bun run build`, never the dev server). Lighthouse via `bunx lighthouse` (no package.json change); Playwright from existing devDependencies.
  - Page measured: `/app` (D-5b-5), stated in the caption.
  - LCP: Lighthouse lab LCP, mobile form factor, default simulated throttling.
  - JS weight: sum of `transferSize` of `resourceType === "Script"` entries in Lighthouse `network-requests` for the initial load, reported in KB (compressed as served by `next start`).
  - TTFR: fresh Playwright context (empty storage/IndexedDB, no cache), start = navigation start to `/app`, script fills the URL and clicks Send with no artificial delay, end = response status visible in the response panel. Target is a stable, documented endpoint (a local/same-machine endpoint preferred to remove internet variance); the target is named in the raw output and caption footnote.
  - Downloads: Playwright `download` events during the TTFR run; the shown value must be 0, else the stat is removed.
  - The script and its raw output are committed under `agent_docs/polish-and-landing/research/` (`speed-measure.mjs`, `speed-measure.raw.json`). No number is hand-typed or estimated.
- FR-56 Strip values live in `src/components/landing/data/speedProof.ts`: per stat `{ label, value, unit, measuredOn (ISO), method, sourceScript, rawOutput, rawKey }` (rawKey = JSON path of the value in the raw file), plus top-level `measuredOn` and `environment` (build commit, page, device/throttling profile, TTFR target). Visible caption states month (FR-50 formatter) and conditions (e.g. "Measured Nov 2026, mobile profile, production build") without claiming competitors are slower. No live timer, race, count-up or load-time animation; values render statically in the first render.
- FR-57 Honesty guard: a unit test asserts every stat has non-empty `measuredOn`, `sourceScript` and `rawOutput`, that the two files exist on disk, and that each displayed value equals the value at `rawKey` in the committed raw output after the rounding rule stated in the test (LCP to 0.1 s, JS to whole KB, TTFR to 0.1 s; downloads exact).

Requirements: amended existing items
- FR-44 / T7.13 (amended in section 15): the P7 ComparisonTable visual pass builds on the P5b final data, groups and stat strip, and MUST NOT change any sourced claim text, source URL, tier, codeRef or measured value by hand. Measured values may change only by re-running `speed-measure.mjs` (mandatory if P7 changes `/app`). It may change only layout, spacing, typography, motion and chrome.
- AC-45 / AC-46 (amended in section 15): comparison and number claims trace to P5/P5b sources or the committed speed raw output; `ComparisonTable.spec.tsx` keeps the P5b assertions green after P7.

Acceptance criteria (each with a concrete check)
- AC-47 No paths rendered: a spec renders the full table + strip and asserts that no codeRef string (every entry of `codeRef`/`codeRefs` across all rows, including `LICENSE`) and nothing matching `/\bsrc\//` or `/\bcodeRef\b/` appears in (a) Requestr cells' text and all of their attributes, (b) the strip, group headers and footer text, and (c) every non-`href` attribute anywhere in the table (competitor `href`s are governed by AC-53's exact-equality check, since an official source such as a Kong GitHub URL may legitimately contain `src/` or `LICENSE`); `queryAllByTestId("comparison-code-ref")` is empty; Requestr cells contain no `<a>`. Separately a data-level spec asserts every codeRef exists on disk via `fs.existsSync` (AC-29).
- AC-48 Footer: spec asserts the footer text matches `/last checked [A-Z][a-z]{2} \d{4}/` and does not match `/\d{4}-\d{2}-\d{2}/`; a formatter unit test shows that changing the ISO input changes the output, and that `"2026-12-01"` formats as "Dec 2026" under a non-UTC `TZ` (e.g. `America/Los_Angeles`).
- AC-49 Grouping: spec asserts exactly three `<tbody>` groups with header `<th scope="rowgroup">` named "Getting started", "Capabilities", "Cost & data", in that order; every data row sits under one group and the row-to-group map equals FR-51 (plus logged moves). No "Real-time support" row exists; the row is named "Protocols & real-time" and its cells still contain WebSocket, Socket.IO (all three columns) and SSE (Insomnia).
- AC-50 Short cells: spec asserts each cell's main text is <= 90 characters, contains no `\n` and no `<br>`, and that tier, when present, renders as a separate chip element; no extra detail text is rendered in-cell.
- AC-51 Data completeness: data-level spec asserts row count = exactly 11 (5 existing after the D-5b-1 merge + 6 new); any D-5b-4 removal must be logged and the expected count updated in the same change; 100% of competitor cells have an `https://` `source` (and every `extraSources` entry) whose hostname is in a named allowlist constant (starting set: `postman.com`, `www.postman.com`, `learning.postman.com`, `blog.postman.com`, `insomnia.rest`, `docs.insomnia.rest`, `developer.konghq.com`, `konghq.com`, `github.com` limited to the `/Kong/` path; any addition needs a vendor-ownership note in `url-check.md`); 100% of Requestr codeRefs exist on disk; competitor cells in the chains, AI and collaboration rows (and any other row where research shows plans differ) have `tier`, while the Pricing row is exempt because its text enumerates plans; no Requestr text matches `/grpc|mqtt|soap|\bsse\b|server-sent|oauth/i`; no cell text matches `/openai|anthropic|claude|gpt|gemini|mistral|llama/i`; the TTFR Requestr text equals the value from `speedProof.ts`.
- AC-52 Sources resolve: `research/url-check.md` has a dated entry for every competitor URL in `comparison.ts` (rendered and `extraSources`) with status 2xx/3xx, or a "manual verification" note with date and what was checked; a script lists zero URLs in `comparison.ts` missing from `url-check.md`.
- AC-53 Source links: spec asserts every competitor cell contains exactly one `<a>` whose `href` equals its `source`, accessible name "Source for <vendor>: <feature>", `target="_blank"` and `rel="noopener noreferrer"`; Playwright tabs through the table and confirms each link receives focus with a non-none computed `outline` or `box-shadow`; link color token differs from body text token (muted) and axe `color-contrast` reports zero violations in light and dark; at 375px each link's tap area (bounding box incl. padding) is >= 44px tall.
- AC-54 Honesty of strengths: a reviewer checklist `research/p5b-honesty.md` lists the six new rows, records whether a competitor is ahead with the source, and is filled by the cross-verify pass. Chains (Postman Flows maturity/tier), AI (competitor credits/limits), collaboration (Requestr gap) and offline (desktop competitors usable offline, if docs confirm) must show the competitor advantage in cell text or chip; rows where a competitor is ahead never have `emphasis: "requestr"`.
- AC-55 Speed proof reproducible: with the section 5 preview running on 3100, `bun agent_docs/polish-and-landing/research/speed-measure.mjs` (prerequisites documented at the top of the script; it never builds with plain `bun run build` and never starts the dev server) regenerates the raw output; the committed raw file has a timestamp, build commit, page, tool versions, throttling profile, TTFR target and >= 3 runs per metric with the median; the strip shows the medians.
- AC-56 Speed proof honesty: the FR-57 test passes and fails if a stat lacks `measuredOn` or its raw value differs; a text assertion confirms the strip text matches none of `/postman|insomnia|faster|slower|\d\s*[x×](?![a-z])|times/i`; the strip component source contains no `setInterval`, `setTimeout` or `requestAnimationFrame` (grep check), and the first render (no timers advanced) already shows the final values.
- AC-57 Layout/theme: Playwright screenshots at 375, 768 and 1440 in light and dark saved under `agent_docs/qa/p5b-comparison/` (the QA harness `snap()` path `agent_docs/qa/<spec-basename>/`, same as P5's `agent_docs/qa/p5-comparison/`); at 375 the table scroll container scrolls horizontally (`scrollWidth > clientWidth`) while `document.documentElement.scrollWidth <= innerWidth`; the strip lays out 2x2 at 375 with no overflow (each stat's box within the viewport); axe zero serious/critical in both themes; group headers and chips pass axe color-contrast in both themes.
- AC-58 Reduced motion: with emulated `prefers-reduced-motion: reduce`, `element.getAnimations({ subtree: true })` on the table section and strip returns no running animation with non-zero duration, and the final content is visible immediately.
- AC-59 Regression: `e2e/home.spec.ts`, `e2e/qa/polish-and-landing/p5-comparison.spec.ts` and the new `e2e/qa/polish-and-landing/p5b-comparison.spec.ts` are green (run only these, per the targeted-e2e rule); `ComparisonTable.spec.tsx`, `ComparisonTable.emphasis.spec.tsx` and `src/components/landing/data/comparison.spec.ts` are updated (not deleted) and green. Scope check, implementation paths only (planning docs SPEC/PLAN/TASKS and dashboards are excluded). Base = `a41f9b1` (the P5b baseline above; precondition before the first P5b task: the command below prints nothing). The check compares the working tree, including untracked files, because P5b work is committed only after the verifier passes: `{ git diff --name-only a41f9b1 -- src e2e; git ls-files --others --exclude-standard -- src e2e; } | sort -u` lists only `src/components/landing/{ComparisonTable*,ComparisonStatStrip*,LandingPage.tsx,data/comparison*,data/speedProof*}`, `src/app/globals.css` (theme tokens only), `e2e/qa/polish-and-landing/p5b-comparison.spec.ts` and `e2e/qa/polish-and-landing/p5-comparison.spec.ts` (updated only if it reads removed UI); P5b outputs under `agent_docs/` stay within `agent_docs/polish-and-landing/research/**` and `agent_docs/qa/p5b-comparison/**`. SPEC.md changes during implementation only by the D-5b-4 `LOGGED (P5b, ...)` lines in section 21 (checked by count in the data task). TASKS.md versus `a41f9b1`: T5.* and P1-P4 blocks identical; P6 blocks identical except the T6.1 `Depends on` line.

Edge cases
- Source URL 404 or vendor blocks scripted fetch (Postman/Insomnia often return 403 to bots): verify manually in a browser, log date and a one-line observation in `url-check.md`; if neither works, apply D-5b-4; never ship a link that is known dead.
- Vendor feature or plan changed since research: the claim is re-checked at implementation time; if the new fact differs, update text, tier, source and access date together; `COMPARISON_CHECKED_ON` is set to the actual last check date.
- A competitor has no equivalent (e.g. no visual workflow builder): cell says "No built-in equivalent found in docs" only if backed by an official feature list/pricing source; otherwise D-5b-4.
- Mobile 375px: group headers span all columns and are not sticky; chips wrap rather than overflow; the strip stacks 2x2; source links keep >= 44px tap area via padding without enlarging visible text.
- Dark mode: chip, group header and subtle Source link colors defined as theme tokens, verified by contrast check.
- Reduced motion: strip has no animation; any table entrance animation honors the media query (AC-58).
- Measurement variance: strip uses the median of >= 3 runs and displays rounded values (FR-57 rules). A failed or outlier run is kept in the raw file and noted, not silently discarded.
- Stale measurement: if the measured page's code changes after `measuredOn` (e.g. in P7), the script is re-run before release; values are never edited by hand.
- TTFR target unavailable: the run fails loudly (non-zero exit) instead of recording a partial number.
- Requestr cell whose feature cannot be found in code at implementation time: reworded to what code proves or the row is dropped (AC-29, D-5b-4).
- Long competitor text: clamping to one line is NOT used to hide claims; text is rewritten shorter and detail is deferred to the Source link.

Out of scope (P5b)
- Live timer/race/load-time demo or any competitor load-time claim.
- Building missing features (collaboration, offline/PWA, OAuth, gRPC, MQTT, SOAP, SSE) or changing Relay/app behavior.
- Hero and Relay landing sections; any change to Phases 1-4 and 6 content; reopening P5 tasks or the gap report.
- Visual/motion redesign of the table beyond what FR-49..FR-52 require (that is T7.13, constrained by FR-44).
- New dependencies (`bunx lighthouse` ad hoc, existing Playwright, axe and Vitest only; no package.json changes).
- Measuring or publishing competitor speed numbers.

## 14. Phase P6 - Hero concepts (GATE)

Requirements
- FR-33 Concept A, live interactive product hero: a real working mini Requestr (URL bar + Send, pre-filled public API, real response). Then a Relay line types "add a test that status is 200" and the assertion appears. Restrained motion, short confident headline. Must handle offline/API failure with a graceful recorded-fallback response.
- FR-34 Concept B, cinematic scripted auto-playing sequence (request -> response -> chain -> Relay) with scroll choreography.
- FR-35 Optional Concept C chosen by the implementer (documented rationale).
- FR-36 Prototypes are reachable at stable review URLs (e.g. `/hero-lab/a`, `/hero-lab/b`), not linked from public nav, with a short summary of each concept's trade-offs (wow factor, perf cost, a11y, maintenance).
- FR-37 HARD GATE: implementation stops here. Only the user picks (one concept or a hybrid); no implementer, agent or default may pick or assume a concept, and silence is not approval. P7 hero work (FR-38) does not start until the user's pick is recorded in this spec's Decision Log. P7 work not dependent on the hero (Relay section, video, legal pages, section pass) may proceed only after P6 deliverables are presented.

Acceptance criteria
- AC-32 At least 2 prototypes (target 3) load without console errors in light and dark.
- AC-33 Reduced motion: each prototype renders a static, meaningful state (no auto-play, no scroll-jacking).
- AC-34 Each prototype at 375px: no horizontal scroll, primary CTA visible without scrolling at 375x667.
- AC-35 Concept A, a real request via the existing proxy returns and renders in under 3 s on a normal connection, with a defined timeout and fallback; no secrets in client code.
- AC-36 Each prototype reports Lighthouse performance >= 80 mobile (informational for the pick) plus JS added (KB gzipped) in the review note.
- AC-37 Review note and screenshots/short capture for each concept are saved under `agent_docs/polish-and-landing/hero/`; the pick is recorded before P7.

## 15. Phase P7 - Landing build

Requirements: hero and Relay
- FR-38 Build the chosen hero to production quality (remove lab routes or keep them noindex until removed).
- FR-39 New Relay section with a coded scroll-triggered animated demo: mock Relay panel typing a prompt (e.g. "add auth header to every request in OpenAI collection"), streaming reply, change cards with Undo, sidebar updating live, looping 3-4 scenarios, theme-aware. Starts when in view, pauses when out of view or tab hidden.
- FR-40 A "Watch the demo" button opens a modal playing a video recorded FROM THE REAL APP via agent-browser + ffmpeg (never `/motion-video`, Remotion or a synthetic/coded render).

Requirements: video pipeline (mirrors visual-ai intro: `/Users/deepakdewani1/Documents/Programs/vue/text-to-image/visual-ai`, `apps/web/public/intro/slide-N.{webm,mp4,webp}`, see `agent_docs/v2-launch/TASKS.md` there)
- FR-41 Record short clips from the running app at `https://requestly.localhost/app` with agent-browser (never start the server): dark theme, tightly cropped, no personal data (no emails, real API keys, personal collections; use seeded demo data).
- FR-42 Encode with ffmpeg to WebM + MP4 + WebP poster per clip under `public/intro/`. Markup: `<video muted autoplay loop playsinline poster>` with WebM then MP4 sources. Reduced motion shows the poster only (no autoplay).
- FR-43 Modal: accessible dialog (focus trap, Esc closes, returns focus, video pauses on close, lazy-loaded so it adds no bytes before opening except poster).

Requirements: full landing pass
- FR-44 UI/UX/motion and copy pass on every existing section: Nav, Hero, ProductVisual, FeatureShowcase, HowItWorks, BeyondSend, ImportSection, ComparisonTable, FinalCta, Footer, AllFeaturesPage, using copywriting and copy-editing skills. Consider new sections/animations where justified. Evaluate https://github.com/Motionsites-AI/claude-skill and use it where it helps (document the decision either way). ComparisonTable (T7.13) builds on the P5b final data, groups and stat strip and MUST NOT change any sourced claim text, source URL, tier or codeRef; measured values change only by re-running `speed-measure.mjs` (mandatory if P7 changes `/app`, D-5b-5); otherwise only layout, spacing, typography, motion and chrome change.
- FR-45 Header: remove the Docs link (header only; the footer Docs link to the GitHub README via `DOCS_URL` stays). Improve header and footer layout (mobile menu, active/hover states, theme toggle, skip link).
- FR-46 Create Privacy Policy and Terms & Conditions pages (`/privacy`, `/terms`), linked from the footer. Find a skill via find-skills / skills.sh if none exists; otherwise draft manually. Operator, exactly: Deepak Dewani, an individual developer (no company); governing law: India; contact: deepakkumardewani@gmail.com. Each page carries a visible "not legal advice, review before relying on it" note.
- FR-47 Privacy content must describe ACTUAL data flows, verified against code at write time: local-first storage (no accounts; no analytics or tracking found in code), requests pass through the server proxy (`/api/proxy`), Relay/AI prompts go to third-party AI providers (`/api/ai`, `/api/relay`; no vendor names in UI copy, legal page says "third-party AI providers"), share links stored server-side (`/api/share`), hub (`/api/hub`). Includes retention, user controls (clear data), and contact.
- FR-48 SEO/metadata for new pages (title, description, canonical, OG); legal pages indexable.

Acceptance criteria (measurable)
- AC-38 Relay demo: loops >= 3 scenarios; with reduced motion it shows a static final frame of each scenario (or one) and never animates; animation pauses when off-screen (verify via IntersectionObserver test or manual trace: no rAF/timers running while hidden).
- AC-39 Video budgets: each clip <= 400 KB (WebM and MP4 each); each WebP poster < 100 KB; total `public/intro` <= 2.5 MB (hard cap; adjust only with note); clip length <= 12 s; resolution documented. `ffprobe`/`ls -l` output recorded.
- AC-40 On initial load no `.webm`/`.mp4` is requested (posters only); inline clips load only when near the viewport; the modal video loads only after the Watch-demo click; autoplaying inline clips are `muted loop playsinline`; Lighthouse mobile: Performance >= 85 (target 90), CLS < 0.1, LCP < 2.5 s on the landing page, Accessibility >= 95.
- AC-41 Landing JS added by P7 (gzipped, first load) is reported against baseline captured at start of P7; any growth > 60 KB gzipped requires lazy-loading or a justification.
- AC-42 Header contains no Docs link (`grep -in docs src/components/landing/Nav.tsx` shows none in link targets/labels); footer contains Privacy and Terms links that resolve to HTTP 200 pages.
- AC-43 Both legal pages contain: operator name, governing law (India), contact email, effective date, the not-legal-advice note, and a data-flow section that names each of server proxying (`/api/proxy`), third-party AI providers (no vendor names), share links (`/api/share`), hub (`/api/hub`), and local-first storage in plain language; operator text matches FR-46 exactly. A reviewer checklist maps each statement to a code location; no statement lacks a mapping.
- AC-44 Screenshots of every section at 375, 768, 1440 in light and dark, reduced-motion on and off, stored under `agent_docs/polish-and-landing/qa/p7/`; zero horizontal scroll; axe: zero serious/critical.
- AC-45 Copy review: no unsubstantiated superlatives, every comparison/number claim traces to P5/P5b sources or the committed speed raw output; no AI vendor names; consistent voice.
- AC-46 Existing landing specs (`Hero.spec.tsx`, `ComparisonTable.spec.tsx`, `FeatureShowcase.spec.tsx`, `HowItWorks.spec.tsx`, `BeyondSend.spec.tsx`, `ImportSection.spec.tsx`, `ProductVisual.spec.tsx`) updated and green; the P5b assertions (AC-47..AC-59: `ComparisonTable*.spec.tsx`, `ComparisonStatStrip.spec.tsx`, `data/comparison.spec.ts`, `data/speedProof.spec.ts` and `e2e/qa/polish-and-landing/p5b-comparison.spec.ts`) additionally stay green after the visual pass, with the claim/URL/tier/codeRef data unchanged by P7 and measured values changed only via a re-run of `speed-measure.mjs` (FR-44).

## 16. Cross-cutting constraints and edge cases

| Concern | Requirement |
|---|---|
| Reduced motion | Every new animation honors `prefers-reduced-motion: reduce` (static state, no autoplay video, no scroll-jacking). Tested with emulated media. |
| Light/dark | All new/changed UI verified in both themes; video clips are dark-only, landing wraps them with a theme-appropriate frame. |
| Mobile | 375px: no horizontal page scroll, tap targets >= 44px for new icon buttons on landing, 32px minimum in dense app toolbars with tooltip on focus. |
| Relay disabled | Open-in-Relay buttons, Relay icon, Relay settings tab, Relay shortcut rows behave consistently when disabled (FR-09, FR-23). |
| Empty collections | Collection row with 0 requests shows an empty hint, no chevron glitch, no virtualization error. |
| 150+ requests | P2 benchmarked at 148; also check 500 synthetic requests for no regression beyond the stated ms budget scaling. |
| Windows vs mac labels | All shortcut text renders from the registry formatter (ctrlOnly = literal Ctrl everywhere; mod = `modKey()`); tests cover both platforms; no hardcoded key strings in components. |
| i18n | New app strings go through the `messages/*` mechanism used by the shortcuts and settings sections where applicable. |
| Accessibility | Icon-only buttons have names; dialogs trap focus; tooltips reachable by keyboard. |
| Privacy of assets | No personal data in screenshots, recorded video, or docs. |

## 17. Execution order and checkpoints

P1 -> P2 -> P3 are independent app phases (may be parallelized by separate implementers, with P1 first because it fixes the shortcut registry that P3 reads). P4 is independent. P5 -> P5b -> P6: P5 must finish before P5b, and P5b must finish (verified) before P6 starts and therefore before any P7 work, including the ComparisonTable pass (T7.13). P6 gates the hero part of P7. Each phase ends with: typecheck once, lint, phase-relevant specs, browser verification via agent-browser, and independent verification before being marked done.

## 18. Success criteria summary

- P2: 148-request collection expand/collapse <= 100 ms click-to-paint, no long task > 50 ms.
- P5: 100% of comparison rows sourced; every URL resolves or is manually verified with access date.
- P7: clip <= 400 KB, poster < 100 KB, landing Lighthouse mobile perf >= 85, a11y >= 95, CLS < 0.1.
- P5b: 11 rows in three groups, 100% competitor cells officially sourced, zero code paths rendered, speed-strip values equal the committed raw output medians.
- P6: user picks hero before P7.
- Legal pages live, linked in footer, statements mapped to code.

## 19. Open risks

1. Sidebar lag root cause is unknown (virtualization already exists); fix scope may expand to store selectors or row rendering. Mitigation: profile first (FR-10).
2. Competitor features and pricing change; sources can go stale. Mitigation: access dates, plan tier noted.
3. Live hero (Concept A) depends on a public API and the proxy; failures hurt first impression. Mitigation: timeout plus recorded fallback.
4. Video size budget vs fidelity: tight crops and short clips are required; may need lower fps (e.g. 15-24) and CRF tuning.
5. Legal text is not legal advice; user must review. Statements must stay in sync with code if data flows change.
6. diagram-design install method and the Motionsites skill are third-party; verify before trusting their output.
7. Removing the Language tab and moving settings can break persisted state or deep links; needs migration/redirect test.
8. Landing JS weight from hero + Relay demo + modal; mitigate with lazy loading.
9. i18n: shortcut labels are keyed in `messages/{en,fr,ja}/shortcuts.json`; label fixes must update all three locales.

## 20. Open questions

None. Former defaults resolved within the plan's latitude, and P5b questions OQ-5b-1 (merge) and OQ-5b-2 (`/app`) answered by the user (see D-5b-1, D-5b-5 and Decision Log).

## 21. Decision log

- Resolved (plan latitude): P3 new settings = ask-before-closing unsaved tabs (opt-out, default ON) + reduced-motion override; no request-execution settings.
- Resolved (plan latitude): sidebar "+" menu groups = Requests / Workspace / Import.
- Resolved (plan latitude): hero prototypes at `/hero-lab/*`, noindex, unlinked.
- DECIDED (user, 2026-11-07): P5b merges "Real-time support" into "Protocols & real-time" (11 rows), D-5b-1.
- DECIDED (user, 2026-11-07): P5b speed stats measure `/app`, D-5b-5.
- DECIDED (user, 2026-11-07): Hybrid of Concept B and Concept C — "hybrid b and c"
