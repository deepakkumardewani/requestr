# Implementation Plan: polish-and-landing

Source of truth: `agent_docs/polish-and-landing/SPEC.md` (FR-01..FR-48, AC-01..AC-46). This plan only orders and slices work; it does not restate every AC. Task IDs are `Pn.m`. Size: XS/S/M (nothing larger; L items are split).

## Overview

Seven phases, spec order: P1 Misc -> P2 Sidebar -> P3 Settings -> P4 Tech docs -> P5 Research -> P6 Hero concepts (HARD GATE) -> P7 Landing build. Each phase is a set of vertical slices (a user-visible fix with its spec/e2e), ends with a checkpoint, and is independently verified before being marked done.

## Architecture decisions

- Shortcut registry `src/app/settings/constants.ts` is the single source of truth. P1 creates one shared formatter (ctrlOnly = literal "Ctrl" everywhere; mod = `modKey()`/`isMac()` from `src/lib/platform.ts`). P1 lands first because P3 (Shortcuts tab, Relay row) and EmptyState/TabBar/CommandPalette/KeyboardShortcutsModal all read it. Locale labels in `messages/{en,fr,ja}/shortcuts.json` change in the same commit as the registry.
- New persisted settings (P3) go through `useSettingsStore` (`src/stores/useSettingsStore.ts`) with default-merge on load (AC-20). No new store unless the audit proves it is needed. Persisted shape changes are Ask-first per spec section 8, so P3.5 flags the shape change to the user before coding.
- P2 fix is decided by measurement (FR-10): `VirtualizedRequestList.tsx` already exists, so candidates are bypassed virtualization in `CollectionRequestTree.tsx`, un-narrowed `useCollectionsStore`/`useFolderExpandStore` selectors, un-memoized `RequestItem`/`HealthDot`, or height animation over N rows. Do not pick a fix before the profile doc exists.
- Hero prototypes live at `src/app/hero-lab/{a,b,c}/page.tsx` with `robots: noindex`, not in `Nav.tsx`. Shared hero primitives (reduced-motion hook, fallback response fixture) are built once and reused by P7 so the pick does not strand work.
- Video pipeline mirrors visual-ai intro (`public/intro/slide-N.{webm,mp4,webp}`), recorded from the real app via agent-browser, encoded with ffmpeg. Modal is a lazy `next/dynamic` import; no `<video>` request before click.
- Legal pages `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` are static server components with `metadata`; statements mapped to code in a reviewer checklist `agent_docs/polish-and-landing/legal-checklist.md`.

## Dependency graph

```
P1.1 shortcut registry+formatter ──┬─> P1.2 TabBar tooltip, P1.3 Relay tooltip, P1.5 EmptyState
                                   ├─> P1.4 label audit (all surfaces)  ──> P3.6 Shortcuts 2-col
P1.6 OpenInRelay (UrlBar removal, 8 entry audit)  ─> P3.8 Relay-disabled consistency
P1.7 logo link (independent)
P2.1 profile ─> P2.2 fix ─> P2.3 row polish ; P2.4 cursor/menu (parallel to P2.2, small)
P3.1 audit doc ─> P3.2..P3.8
P4.1 skill install ─> P4.3 diagrams ; P4.2 doc audit ─> P4.3..P4.5   (P4 independent of P1-P3 code, but docs for shortcut registry/settings are best written after P1/P3)
P5.1a/b/c (parallel) ─> P5.2 reconcile ─> P5.3 ComparisonTable ; P5.2 ─> P5.4 gap report
P6.0 shared primitives ─> P6.1 Concept A ∥ P6.2 Concept B ∥ P6.3 Concept C ─> P6.4 review pack ─> [GATE: user pick] ─> P7.1
P7: P7.2..P7.9 independent of the pick; P7.6 ComparisonTable styling needs P5.3; P7.5 section pass for Hero needs P7.1
```

## Parallelism

- Phase level: P1, P4 (skill install + doc audit), P5 research and P6 prototypes touch disjoint files from P2/P3 and could run on separate worktrees. Default run order stays sequential per the spec; parallel is an option, not a requirement. Constraint: P1.1 must merge before P3 starts.
- P5: P5.1a Postman, P5.1b Insomnia, P5.1c Requestr (code-derived) are three independent subagents; P5.2 reconciles after all three.
- P6: Concepts A/B/C are independent after P6.0; one agent each.
- P7 not dependent on the hero pick (may start only after P6 deliverables are presented, per FR-37): P7.2 Relay section, P7.3 video recording/encoding, P7.4 modal, P7.7 Nav/Footer, P7.8 legal pages, P7.6 ComparisonTable styling, section pass for non-hero sections. P7.3 recording needs the app polish from P1-P3 done (clips show the final sidebar/settings/empty states), so schedule after P3.
- Not parallel: anything editing `src/app/settings/constants.ts` (P1.1, P1.4, P3.6) or `Nav.tsx`/`Footer.tsx` (P7.7, P7.8 footer links) at the same time.

## Verification approach (all phases)

- Browser: `export AGENT_BROWSER_SESSION="requestly"` (repo-named; confirm with `basename $(git rev-parse --show-toplevel)`) in the same shell command as each agent-browser call; `agent-browser close` at the end. Target `https://requestly.localhost/app` and `/`. Never start the dev server. Check light + dark and 375px for every UI change; reduced motion via emulated media.
- Unit: `bun run test <path>` targeted. Update the existing specs listed in spec section 7 as behavior changes.
- E2E: only phase-relevant specs, always `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/<spec>.spec.ts` (without the env var playwright starts a dev server, forbidden). Existing: `tabs`, `collections`, `settings`, `home`, `chain`, `history`.
- Phase end only (not mid-task): `bun run typecheck`, `bun run lint:check`. Then independent verifier (phase-verifier) against AC. Screenshots under `agent_docs/polish-and-landing/qa/<phase>/`; no personal data.
- bun only; no `npm`; no commits unless instructed (the `/build-phases` flow is the only standing exception).

---

## Phase P1 - Misc fixes (FR-01..FR-09)

### P1.1 Shortcut registry + shared formatter (S-M) [FR-01, FR-04 foundation]
- Add Ctrl+T new-tab entry (alias of new request, ctrlOnly) to `src/app/settings/constants.ts`; add a single `formatShortcut(entry)` helper (ctrlOnly -> literal Ctrl; mod -> `modKey()`); add `messages/{en,fr,ja}/shortcuts.json` keys.
- AC: formatter returns "Ctrl+T" with `isMac()` true and false; mod entries differ per platform.
- Verify: new `src/app/settings/constants.spec.ts` cases; `bun run test src/app/settings`.
- Files: `src/app/settings/constants.ts`, `src/lib/platform.ts` (read), `messages/*/shortcuts.json`, spec.
- Deps: none.

### P1.2 TabBar "+" tooltip (XS) [FR-01 -> AC-01]
- Replace both `<Kbd>{modKey()}+N</Kbd>` sites (~215, ~245) in `src/components/layout/TabBar.tsx` with registry output.
- Verify: spec with `isMac` mocked both ways; manual hover check in agent-browser; `e2e/tabs.spec.ts`.
- Deps: P1.1.

### P1.3 Relay icon tooltip (S) [FR-02 -> AC-02]
- Find the Relay toggle button (top-right; see `useRelayShortcut.ts`, `src/lib/relay/constants.ts`, `getRelayShortcuts`/`toShortcutAlias`); wrap in the same tooltip style as sibling toolbar buttons with "Toggle Relay" + chord from registry helpers.
- Verify: spec asserting label + chord for mac/non-mac; press chord toggles panel (agent-browser).
- Deps: P1.1.

### P1.4 Shortcut label audit and unification (M) [FR-04 -> AC-04]
- Enumerate every surface: `EmptyState.tsx`, `TabBar.tsx`, `CommandPalette.tsx`, `KeyboardShortcutsModal`, `ShortcutsSection.tsx`, any `Kbd` usage (`grep -rn "<Kbd" src`). Route all through the formatter. Resolve conflict: New Request Ctrl+N, New Collection Ctrl+Shift+N.
- AC: surface-enumeration test equals registry; `grep -rnE 'keys: \["(Ctrl|⌘)' src/components` empty.
- Verify: update `ShortcutsSection.spec.tsx`, `KeyboardShortcutsModal.spec.tsx`, `CommandPalette.spec.tsx`; typecheck at end of phase.
- Deps: P1.1. Split into two tasks if more than 5 files (modal+palette / empty+tabbar).

### P1.5 EmptyState redesign (M) [FR-05 -> AC-05]
- Invoke ui-ux-pro-max first, then implement in `src/components/layout/EmptyState.tsx` (extract shortcut list into its own component). Primary action New Request; compact registry-driven shortcut list; reduced motion respected; copy review of "Send a request. Build a workflow."
- Verify: screenshots light/dark x 375/1440 in `qa/p1/`; no horizontal scroll; spec.
- Deps: P1.1, P1.4 (shares formatter).

### P1.6 Open-in-Relay cleanup (M, split in two) [FR-06..FR-09 -> AC-06..08]
- P1.6a: remove from `src/components/request/UrlBar.tsx` (XS). Check `grep -n OpenInRelayButton` and that the import set is exactly the 8 named files.
- P1.6b: audit each of the 8 (`HeadersEditor`, `BodyEditor`, `ScriptEditor`, `ResponsePanel`, `AssertionsTab`, `ErrorExplainer`, `TransformPlayground`, `TransformPage`) plus `OpenInRelayButton.tsx` and `src/lib/relay/openInRelay.ts`: short human prompt (<= 80 chars, named constant per entry), context as chip, icon-only + tooltip + `aria-label`, hidden when Relay disabled. Do NOT change Relay behavior beyond the entry payloads. Extend `OpenInRelayButton.spec.tsx` with a parametrised test across the 8 payloads (no "IMPORTANT:" etc.). If more than 5 files, batch 4+4.
- Verify: spec; agent-browser spot check of two entries; disable Relay in settings and confirm absence.
- Deps: none (parallel to P1.1-P1.5).

### P1.7 Logo link (XS) [FR-03 -> AC-03]
- `src/components/layout/LeftPanel.tsx`: wrap `/logo.png` in `next/link` href `/`, accessible name; confirm tabs persist after returning (`useTabsStore`).
- Verify: Playwright URL equals `/` (in `e2e/qa/polish-and-landing/p1-logo-empty.spec.ts`, see T1.17); Tab+Enter; reopen `/app` and unsaved tabs remain.
- Deps: none.

### Checkpoint P1
- [ ] typecheck + lint clean; specs listed pass; e2e `tabs`, `home` green; AC-01..08 evidenced; verifier PASS.

---

## Phase P2 - Left sidebar (FR-10..FR-15)

### P2.1 Profile and baseline (S) [FR-10, AC-09]
- Seed a 148-request collection (use a seeded demo "OpenAI"-like collection; no personal data). Measure click-to-next-paint expand/collapse, unthrottled and 4x CPU, via agent-browser performance trace/eval; identify re-render sources (React Profiler), virtualization bypass, layout/animation cost. Write `agent_docs/polish-and-landing/p2-profile.md` BEFORE any fix.
- Files read: `src/components/collections/{CollectionTree,CollectionRequestTree,VirtualizedRequestList,RequestItem,HealthDot}.tsx`, `src/stores/useFolderExpandStore.ts`, `src/stores/useCollectionsStore.ts`.
- Deps: none (after P1 checkpoint).

### P2.2 Fix root cause (M) [FR-11, AC-10..12, AC-15]
- Implement the fix indicated by the profile; also ensure rendered request rows <= 40 (AC-11); keyboard arrow nav and `useFolderExpandStore` persistence intact (FR-15). Check 0-request collection and 500 synthetic requests.
- Verify: re-measure and record after-numbers in the profile doc: AC-10 thresholds met AND >= 3x improvement on every metric that failed at baseline. Numbers of record come from the isolated prod preview (`http://localhost:3100/app`, see TASKS.md Conventions); dev-server numbers are informational; devtools DOM-count eval; `CollectionTree.spec.tsx` updated; `e2e/collections.spec.ts`.
- Deps: P2.1.
- Risk gate: if the fix needs a new dependency (e.g. a virtualization lib), stop and Ask first.

### P2.3 Collection parent row polish (S) [FR-12]
- Apply impeccable + layout skills: spacing, alignment, hover/active, count badge, chevron, truncation, empty-collection hint. Light/dark/375px screenshots.
- Deps: P2.2 (same files; avoid conflicts).

### P2.4 Health pill cursor (XS) [FR-13 -> AC-13]
- `cursor-help` on `HealthDot.tsx` trigger; spec asserts class/computed style; tooltip still opens (`HealthPopover.tsx`).
- Deps: none (parallel with P2.2 if on different files; `RequestItem` row memoization may overlap, so sequence if touching the same file).

### P2.5 Grouped "+" menu (S) [FR-14 -> AC-14]
- Locate the sidebar "+" dropdown (likely in `LeftPanel.tsx`/collections header; confirm by grep). Use shadcn `DropdownMenuGroup`/`DropdownMenuLabel`/separators per `.claude/skills/shadcn-component-rules`: Requests (HTTP, GraphQL, WebSocket, Socket.IO), Workspace (Collection, Environment, Chain), Import. Labels via messages if the surrounding strings are i18n.
- Verify: spec for three labeled groups in order; `e2e/collections.spec.ts` stays green.
- Deps: none.

### Checkpoint P2
- [ ] profile doc with before/after numbers meeting AC-10; AC-09..15 evidenced; typecheck/lint; `collections` e2e; verifier PASS.

---

## Phase P3 - Settings (FR-16..FR-23)

### P3.1 Audit (S) [FR-16]
- With ui-ux-pro-max, impeccable, layout skills, review all tabs and the page shell. Capture "before" screenshots (light+dark) into `qa/p3/before/`. Write `agent_docs/polish-and-landing/p3-audit.md` including: Global tab decision (FR-18), Clear-history scope decision (FR-19), the FR-21 settings design (confirm-close-unsaved, reduced-motion override; optional one more UI-only with rationale), copy list (FR-22), final tab set.
- Files read: `src/components/settings/*`, `src/app/settings/{page,SettingsPageClient,constants}.tsx`.
- Deps: P1.1 merged.

### P3.2 Fold Language into General (M) [FR-17 -> AC-16, AC-17]
- Add a language row to `GeneralSection.tsx` (shared row component); delete `LanguageSection.tsx`; remove from `SettingsNav.tsx` and section registry; `useSettingsSectionStore` + hashchange: `#language` maps to General without error (includes persisted section value). Update `page.spec.tsx`, `constants.spec.ts`, `GeneralSection.spec.tsx`; adapt language e2e in `e2e/settings.spec.ts`.
- Deps: P3.1.

### P3.3 Global tab resolution (S) [FR-18]
- Execute the audit decision (rename with description or merge into correct tab). Keep deep links working.
- Deps: P3.1, P3.2 (nav changes).

### P3.4 Clear-history/Data de-duplication (M) [FR-19 -> AC-18]
- Files: `GeneralSection.tsx` (Data Management card), `DataSection.tsx`, `RelaySection.tsx`, `ClearHistoryDialog.tsx`. Merge or explicitly scope ("Request history" vs "Relay conversations"), confirm dialogs naming exactly what is deleted. Spec asserts distinct labels/dialog copy.
- Deps: P3.1.

### P3.5 New settings (M, split per setting) [FR-21 -> AC-20]
- P3.5a "Ask before closing unsaved tabs": `useCloseTabGuard.ts` already prompts on dirty tabs today, so this is an opt-out toggle, default ON (today's behavior); store field in `useSettingsStore`, UI control in General, the guard skips the prompt only when OFF.
- P3.5b reduced-motion override (system/on/off): store field, control in Appearance, applied via a data attribute/class on `<html>` that CSS and JS motion hooks respect; extends the existing `src/hooks/useReducedMotion.ts` (media query only today) rather than adding a hook (reused by P6/P7).
- P3.5c optional third UI-only setting only if the audit justifies it.
- Each: store field + persistence + default + control + spec + test that legacy persisted state without the field loads defaults. Ask first on the persisted shape change (spec section 8).
- Deps: P3.1.

### P3.6 Shortcuts tab two-column (S) [FR-20 -> AC-19]
- `ShortcutsSection.tsx`: CSS grid 2 columns at a named breakpoint constant, 1 column below; no vertical scroll at 1440x900 and 1280x720 (agent-browser `scrollHeight <= clientHeight`).
- Deps: P1.1, P1.4.

### P3.7 Copy and polish all tabs (M, batch by 3 tabs) [FR-22, AC-21]
- Concise labels, one-line descriptions, consistent casing, no vendor names; all strings via `messages/*` where the section already uses it (update en/fr/ja). axe zero serious/critical, focus rings, 375px.
- Deps: P3.2-P3.6 (final structure).

### P3.8 Relay-disabled consistency (S) [FR-23]
- Relay tab shows disabled state (or hidden consistently) and Shortcuts hides Relay toggle row; `RelaySection.spec.tsx`.
- Deps: P1.6b, P3.1.

### P3.9 After screenshots (XS) [AC-22]
- All tabs, both themes into `qa/p3/after/`.

### Checkpoint P3
- [ ] AC-16..22; `bun run test src/components/settings src/app/settings`; `e2e/settings.spec.ts`; typecheck/lint; verifier PASS.

---

## Phase P4 - Technical docs (FR-24..FR-28)

### P4.1 Install diagram-design skill (XS) [FR-24 -> AC-23]
- Clone https://github.com/cathrynlavery/diagram-design into `~/.claude/skills/diagram-design` (read its README/SKILL.md first and verify contents; Ask first if install needs more than a clone). Record exact command and result; confirm it is listed in a fresh session.

### P4.2 Docs audit (S) [FR-25]
- Review `README.md`, `CLAUDE.md`, `agent_docs/*`, `graphify-out/GRAPH_REPORT.md` for accuracy/gaps; write gap list in `docs/README.md` (index).
- Deps: none. Parallel with P4.1.

### P4.3 `docs/ARCHITECTURE.md` (M) [FR-26 -> AC-24, AC-25]
- Cover `src/stores` (each file verified), Relay, chain runner, proxy/request pipeline, six routes under `src/app/api` (ai, hub, proxy, relay, schema, share; re-verify at write time). Diagrams via diagram-design, legible in light/dark, referenced from docs. Every claim cites a path.
- Deps: P4.1, P4.2. Use subagents (one per area) to read code; main agent assembles.

### P4.4 Focused docs (M, 2-3 tasks) [FR-27]
- `docs/DATA_MODEL.md`, `docs/RELAY.md`, plus audit-found gaps (request pipeline, chain runner, persistence/storage keys, shortcut registry, testing/QA). Write after P1/P3 so the shortcut registry and settings are final.
- Deps: P4.3 structure; P1/P3 done.

### P4.5 Link and path checks (XS) [FR-28 -> AC-26, AC-27]
- Script (in scratchpad, not shipped unless useful) verifying relative links and referenced file paths in `docs/`; add README link to `docs/`.

### Checkpoint P4
- [ ] AC-23..27 evidenced; no secrets; verifier PASS.

---

## Phase P5 - Research (FR-29..FR-32)

### P5.1 Three parallel research subagents (S each) [FR-29]
- a) Postman, b) Insomnia (official docs/pricing/changelog, plan tier noted, access date, URL per claim), c) Requestr features derived from code (`src/`, with file paths), not marketing. Output to `agent_docs/polish-and-landing/research/{postman,insomnia,requestr}.md`. Deps: none.

### P5.2 Cross-verify pass (S) [FR-30]
- Fourth agent reconciles disagreements; unsourced claims removed or marked unverified; checks each URL (2xx/3xx; for blocked vendors manual verification note) and logs results with access date to `research/url-check.md`.
- Deps: P5.1a-c.

### P5.3 Correct ComparisonTable (M) [FR-31 -> AC-28, AC-29, AC-31]
- Files: `src/components/landing/ComparisonTable.tsx`, data under `src/components/landing/data/`, `ComparisonTable.spec.tsx`. Add `source` URL per competitor cell, `codeRef` per Requestr cell, plan-tier notes; render accessible keyboard-reachable source links; light/dark/375px (contained scroll). Data-level spec: 100% cells sourced.
- Deps: P5.2. (Visual restyle belongs to P7.6; this task is data + minimal render.)

### P5.4 Gap report (S) [FR-32 -> AC-30]
- `agent_docs/polish-and-landing/gap-report.md`: rubric at top, >= 10 ranked items with source URL, rationale, S/M/L. Report only.
- Deps: P5.2. Parallel with P5.3.

### Checkpoint P5
- [ ] AC-28..31; `bun run test src/components/landing/ComparisonTable`; verifier PASS.

---

## Phase P6 - Hero concepts (FR-33..FR-37) - HARD GATE

### P6.0 Shared primitives and lab shell (S)
- `src/app/hero-lab/layout.tsx` with `robots: { index: false }`, no nav links; reuse the `useReducedMotion` hook extended in P3.5b (override + media query), recorded-fallback fixture, timeout util. Deps: P3.5b (P3 checkpoint).

### P6.1 Concept A: live mini-Requestr hero (M-L, split) [FR-33 -> AC-35]
- P6.1a: mini URL bar + Send hitting `/api/proxy` with a public API, timeout (named constant, < 3 s target), recorded fallback, no secrets in client code. P6.1b: Relay line typing "add a test that status is 200" and assertion appearing; reduced-motion static state.
- Files: `src/app/hero-lab/a/page.tsx`, `src/components/hero-lab/a/*`. Check the proxy route contract (`src/app/api/proxy`) read-only first; no new API routes (Ask first).

### P6.2 Concept B: cinematic scripted sequence (M) [FR-34]
- Scroll choreography request -> response -> chain -> Relay; reuse landing visual pieces (`ProductVisual.tsx`); no scroll-jacking under reduced motion. Uses an already-present animation approach (check `package.json` for gsap/motion before proposing any dependency; new deps Ask first).

### P6.3 Concept C (S-M) [FR-35]
- Implementer's choice with rationale doc.

### P6.4 Review pack (S) [FR-36, AC-32..37]
- Per concept under `agent_docs/polish-and-landing/hero/`: screenshots/short capture, trade-offs (wow, perf, a11y, maintenance), Lighthouse mobile perf (>= 80) and gzipped JS added, console-error check light/dark, reduced-motion state, 375x667 CTA visibility.
- Present to user via AskUserQuestion, recommended option first with reasoning.

### GATE (FR-37)
- STOP. Only the user's explicit pick (one or hybrid) is recorded in SPEC Decision Log. No default, no inference, silence is not approval. P7.1 and Hero section pass are blocked until recorded. Non-hero P7 tasks may begin only after P6.4 is presented.

### Checkpoint P6
- [ ] AC-32..37; user pick recorded.

---

## Phase P7 - Landing build (FR-38..FR-48)

Start: capture baseline first-load JS (gzipped) and Lighthouse from the isolated prod preview (`E2E_DIST_DIR=.next-e2e bun run build`, `E2E_DIST_DIR=.next-e2e bun run start -p 3100`, `bunx lighthouse`, then kill; never plain `bun run build`, which overwrites the dev server's `.next`) for AC-41 and AC-40 comparisons (P7.0, XS, record in `agent_docs/polish-and-landing/p7-baseline.md`).

### P7.1 Build chosen hero (M-L, split by pick) [FR-38] - BLOCKED on gate
- Productionize chosen concept into `src/components/landing/Hero.tsx` (and `ProductVisual.tsx`), update `Hero.spec.tsx`/`ProductVisual.spec.tsx`; remove lab routes (or keep noindex until removed); tests for reduced motion.

### P7.2 Relay section with coded demo (M, split) [FR-39 -> AC-38]
- P7.2a: scenario data + typing/streaming engine (pure, testable, 3-4 scenarios: e.g. add auth header to every request in OpenAI collection) in `src/components/landing/relay/`. P7.2b: mock panel UI (change cards with Undo, live sidebar mock, theme-aware), IntersectionObserver start/pause, `visibilitychange` pause, reduced-motion static final frame. Spec for pause-offscreen and reduced-motion. Lazy-load the section.
- Deps: P6.0 reduced-motion hook; independent of hero pick.

### P7.3 Record and encode clips (M) [FR-41, FR-42 -> AC-39]
- agent-browser against `https://requestly.localhost/app` with seeded demo data (no personal data), dark theme, tight crop, <= 12 s each; ffmpeg to WebM + MP4 (<= 400 KB each, fps 15-24, CRF tuned) + WebP poster (< 100 KB) into `public/intro/`; total <= 2.5 MB; record `ffprobe`/`ls -l` in `agent_docs/polish-and-landing/p7-video.md`. Reuse the visual-ai `agent_docs/v2-launch/TASKS.md` recipe (read-only reference).
- Deps: P1-P3 done so UI is final; Relay seeded demo. Never start server.

### P7.4 Watch-the-demo modal (S-M) [FR-40, FR-43 -> AC-40]
- Dialog (shadcn Dialog per rules) lazy-loaded with `next/dynamic`; focus trap, Esc, focus return, pauses on close; no `.webm`/`.mp4` on initial load (posters only), inline clips load near the viewport, the modal video only after the click; reduced motion = poster only for inline clips. Spec + agent-browser network check (no `.webm/.mp4` request pre-click).
- Deps: P7.3 (assets) - can build with placeholder asset first.

### P7.5 Section-by-section UI/UX/motion/copy pass (M each, batch 2-3 sections) [FR-44 -> AC-44, AC-45, AC-46]
- Batches: (a) Nav+Footer see P7.7; (b) FeatureShowcase, HowItWorks; (c) BeyondSend, ImportSection; (d) FinalCta, AllFeaturesPage (`src/app/features`); (e) ProductVisual; (f) Hero after P7.1. ProductVisual is restyled with the hero in T7.9. Use copywriting + copy-editing + impeccable skills; evaluate https://github.com/Motionsites-AI/claude-skill (read SKILL.md, try on one section, document use/skip in `agent_docs/polish-and-landing/p7-motionsites-decision.md`; third-party, verify before trusting). No unsubstantiated superlatives; no AI vendor names; numbers trace to P5. Update the corresponding `*.spec.tsx`.
- Deps: P7.1 for Hero; P5.3 for comparison claims.

### P7.6 ComparisonTable visual pass (S) [FR-44]
- Restyle after P5.3 data is final; light/dark/375px; update spec. Deps: P5.3.

### P7.7 Header and footer (M) [FR-45 -> AC-42]
- `Nav.tsx`: remove Docs link (keep footer `DOCS_URL`), mobile menu, active/hover, theme toggle (`ThemeToggle.tsx`), skip link. `Footer.tsx`: layout, Privacy/Terms links. Verify `grep -in docs src/components/landing/Nav.tsx` has no link targets/labels. Deps: P7.8 for footer link targets (links can land first, pages 200 before checkpoint).

### P7.8 Legal pages (M, split) [FR-46..FR-48 -> AC-43]
- P7.8a: use find-skills (skills.sh) for a privacy/terms skill; else draft manually. Verify data flows against code: `src/app/api/{proxy,ai,relay,share,hub}`, storage layer, search for analytics/tracking (none expected; evidence in checklist). P7.8b: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` with operator text EXACTLY per FR-46 (Deepak Dewani, an individual developer, no company; India; deepakkumardewani@gmail.com), effective date, not-legal-advice note, data-flow section (local-first, `/api/proxy`, third-party AI providers with no vendor names, `/api/share`, `/api/hub`), retention, user controls (clear data), contact. SEO: title, description, canonical, OG via `metadata`; indexable; add to sitemap if one exists. `legal-checklist.md` maps each statement to a code location. Spec rendering required strings.
- User must review legal text (risk 5); flag in summary.

### P7.9 Perf/a11y/visual QA (M) [AC-40, AC-41, AC-44]
- Lighthouse mobile (Perf >= 85, A11y >= 95, CLS < 0.1, LCP < 2.5 s), gzipped JS delta vs baseline (lazy-load anything over +60 KB), axe zero serious/critical, screenshots of all sections at 375/768/1440 x light/dark x reduced-motion on/off into `qa/p7/`, zero horizontal scroll. Fix findings; rerun.

### Checkpoint P7 (final)
- [ ] AC-38..46 evidenced; all landing specs green; `E2E_DIST_DIR=.next-e2e bun run build` succeeds; typecheck/lint; `/privacy` and `/terms` return 200 linked from footer; verifier PASS; final Implementation Summary with browser verification steps.

---

## Plan step to task map

TASKS.md is authoritative for ids, dependencies and Verify commands.

| Plan step | Tasks | Plan step | Tasks |
|---|---|---|---|
| P1.1 | T1.1 | P4.1 | T4.1 |
| P1.2 | T1.2 | P4.2 | T4.2 |
| P1.3 | T1.3 | P4.3 | T4.3 |
| P1.4 | T1.4, T1.5, T1.6 | P4.4 | T4.4, T4.5 |
| P1.5 | T1.7 | P4.5 | T4.6 |
| P1.6 | T1.8, T1.9, T1.10, T1.11 | P5.1 | T5.1, T5.2, T5.3 |
| P1.7 | T1.12 | P5.2 | T5.4 |
| P1 tests + checkpoint | T1.13-T1.19 | P5.3 | T5.5 |
| P2.1 | T2.1 | P5.4 | T5.6 |
| P2.2 | T2.2 | P5 tests + checkpoint | T5.7-T5.9 |
| P2.3 | T2.3 | P6.0 | T6.1 |
| P2.4 | T2.4 | P6.1 | T6.2, T6.3 |
| P2.5 | T2.5 | P6.2 | T6.4 |
| P2 tests + checkpoint | T2.6-T2.10 | P6.3 | T6.5 |
| P3.1 | T3.1 | P6 tests | T6.6-T6.9 |
| P3.2 | T3.2, T3.3 | P6.4 | T6.10 |
| P3.3 | T3.4 | Checkpoint P6 / GATE | T6.11 / T6.12 |
| P3.4 | T3.5 | P7.0 baseline | T7.1 |
| P3.5a / b / c | T3.6 / T3.7 / T3.8 | P7.1 | T7.9, T7.10 |
| P3.6 | T3.9 | P7.2 | T7.2, T7.3 |
| P3.7 | T3.10, T3.11, T3.13 | P7.3 | T7.4, T7.5 |
| P3.8 | T3.12 | P7.4 | T7.6 |
| P3.9 | T3.14 | P7.5 | T7.7, T7.8, T7.11, T7.12 (+ Hero/ProductVisual in T7.9) |
| P3 tests + checkpoint | T3.15-T3.20 | P7.6 | T7.13 |
| | | P7.7 | T7.14, T7.15 |
| | | P7.8 | T7.16, T7.17, T7.18 |
| | | P7.9 + checkpoint | T7.19-T7.28 |

## FR to plan-step map

| FR | Step | FR | Step |
|---|---|---|---|
| FR-01 | P1.1, P1.2 | FR-25 | P4.2 |
| FR-02 | P1.3 | FR-26 | P4.3 |
| FR-03 | P1.7 | FR-27 | P4.4 |
| FR-04 | P1.1, P1.4 | FR-28 | P4.3-P4.5 |
| FR-05 | P1.5 | FR-29 | P5.1 |
| FR-06 | P1.6a | FR-30 | P5.2 |
| FR-07 | P1.6b | FR-31 | P5.3 (+P7.6 styling) |
| FR-08 | P1.6b | FR-32 | P5.4 |
| FR-09 | P1.6b, P3.8 | FR-33 | P6.1 |
| FR-10 | P2.1 | FR-34 | P6.2 |
| FR-11 | P2.2 | FR-35 | P6.3 |
| FR-12 | P2.3 | FR-36 | P6.4 |
| FR-13 | P2.4 | FR-37 | GATE |
| FR-14 | P2.5 | FR-38 | P7.1 |
| FR-15 | P2.2 | FR-39 | P7.2 |
| FR-16 | P3.1 | FR-40 | P7.4 |
| FR-17 | P3.2 | FR-41 | P7.3 |
| FR-18 | P3.3 | FR-42 | P7.3 |
| FR-19 | P3.4 | FR-43 | P7.4 |
| FR-20 | P3.6 | FR-44 | P7.5, P7.6 |
| FR-21 | P3.5 | FR-45 | P7.7 |
| FR-22 | P3.7 | FR-46 | P7.8 |
| FR-23 | P3.8 | FR-47 | P7.8 |
| FR-24 | P4.1 | FR-48 | P7.8 |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sidebar lag root cause unknown (virtualization exists) | High | P2.1 profile-first, doc before fix; Ask first if a new dependency is needed |
| `ctrlOnly` vs mod label bugs recur across surfaces | Med | One formatter + enumeration test (AC-04) + grep guard |
| Persisted settings shape change breaks old state / deep links (`#language`) | High | Default-merge on load, legacy-state tests, hash redirect test, Ask first on shape |
| Locale files drift (`messages/{en,fr,ja}`) | Med | Every label change touches all three; spec checks key parity |
| Competitor facts stale/blocked from scripted fetch | Med | Access dates, plan tiers, manual verification notes, "unverified" never shown on landing |
| Concept A depends on public API + proxy | High | Timeout + recorded fallback fixture; no secrets; test offline path |
| Hero pick ignored or assumed | High | Hard gate; P7.1 blocked in plan; pick must be in Decision Log |
| Video size budget vs fidelity | Med | Tight crops, <= 12 s, 15-24 fps, CRF tuning, hard 2.5 MB cap |
| Landing JS weight (hero + Relay demo + modal) | Med | `next/dynamic` for Relay section and modal, baseline in P7.0, +60 KB rule |
| Third-party skills (diagram-design, Motionsites) untrusted | Low-Med | Read SKILL.md before use; document decisions |
| Legal text accuracy | High | Statement-to-code checklist; visible not-legal-advice note; user review; re-sync if flows change |
| Recording leaks personal data | High | Seeded demo data only; review frames before commit |
| Agent accidentally starts dev server / uses npm / full e2e | Med | `PLAYWRIGHT_TEST_BASE_URL` always set; bun only; targeted specs only |
| Parallel edits collide (`settings/constants.ts`, `Nav.tsx`, `Footer.tsx`) | Med | Sequence those tasks; separate worktrees otherwise |

## Open questions

None blocking. Items that trigger Ask-first during execution: new runtime dependency (P2.2, P6.2), persisted store shape change (P3.5), diagram-design install beyond a clone (P4.1), any new API route (P6.1).
