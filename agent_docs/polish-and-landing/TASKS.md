# Tasks: polish-and-landing

Source: `SPEC.md` and `PLAN.md` in this folder. Format per `~/.claude/docs/task-conventions.md`. Phases map 1:1 to the plan: Phase N = PN (P1 Misc, P2 Sidebar, P3 Settings, P4 Tech docs, P5 Research, P6 Hero concepts, P7 Landing build).

Conventions for this file:
- Package manager is bun; never `npm`. The dev server is `https://requestly.localhost/app` (landing at `/`) and is always running; never start it. E2E always sets `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app` inline (without it `playwright.config.ts` `webServer` starts a dev server). Only phase-relevant specs run, never the full suite.
- Phase 0 is not needed: Playwright/Vitest exist, `playwright.config.ts` already selects `webServer` by `E2E_SERVER=dev|prod` (`E2E_PROD_PORT`, `reuseExistingServer: false` for prod), `next.config` already honours `E2E_DIST_DIR`, `e2e/README.md` exists, and `.gitignore` already covers `test-results`, `playwright-report`, `coverage/`, `.dashboard/*/reports/`, `.next-e2e`. Any `bun run build` in this plan MUST use `E2E_DIST_DIR=.next-e2e` so it never overwrites the dev server's `.next`. Every `playwright test` command MUST set either `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app` (dev server, reused) or `E2E_SERVER=prod` (playwright builds into `.next-e2e` and serves on port 3100, then stops); a bare `playwright test` would run the dev-mode webServer's plain `bun run build` and clobber `.next`. Specs navigate with absolute paths (`/app`, `/`, `/hero-lab/a`) so they work under both base URLs.
- **Isolated prod preview** (used for Lighthouse and perf numbers; referenced below as "the isolated prod preview"): check port 3100 is free (`lsof -nP -iTCP:3100 -sTCP:LISTEN` prints nothing); `E2E_DIST_DIR=.next-e2e bun run build`; start in the background with `E2E_DIST_DIR=.next-e2e bun run start -p 3100` (the env var is required on start too, or `next start` reads `.next`) and note its PID; measure against `http://localhost:3100/...`; then `kill <PID>`. It writes only `.next-e2e` (and the gitignored `next-env.d.ts`, which the dev server regenerates); the dev server and its `.next` are never started, stopped or touched. Lighthouse runs as `bunx lighthouse <url> --form-factor=mobile --screenEmulation.mobile --only-categories=performance,accessibility --output=json --output-path=<file> --quiet --chrome-flags="--headless=new"` (never `npm install -g`; the `lighthouse-cli` skill is reference only).
- The project has the seeded QA harness (`e2e/fixtures/qa.ts`, `e2e/qa/`). New specs live in `e2e/qa/polish-and-landing/<area>.spec.ts` (one `test()` per checklist item, `consoleGuard` on, `snap()` at the end, no `waitForTimeout`). Seed data goes in `e2e/fixtures/seed/*.json` then `bun run qa:seed:build`. Browser Verify steps are Playwright specs; `agent-browser` is used only for visual/perf exploration and screenshots, always `export AGENT_BROWSER_SESSION=requestly` (repo name) in the same shell command, started with `--init-script e2e/fixtures/qa-seed.init.js`, and ended with `agent-browser close`. Never the chrome-devtools MCP.
- Implementation tasks keep EXISTING specs green (update assertions their change breaks) but do not author new coverage; new coverage comes from the dedicated `Unit:` and `E2E:` tasks, written by different agents. Pure documentation, research, capture and recording deliverables use `Kind: dod` (no code, so no unit/e2e tasks).
- `bun run typecheck` and `bun run lint:check` run once at the end of each phase in its Gate task, never mid-task. Do not commit unless told. No tests for `src/components/reactbits/`.
- Persisted store shape changes, new runtime dependencies and new API routes are Ask-first (SPEC section 8): stop and use AskUserQuestion (recommended option first) before doing them.
- Unit command form: `bunx vitest run <specs> --coverage --coverage.include=<src files> --coverage.reporter=text`.
- Screenshots and evidence go under `agent_docs/polish-and-landing/qa/<phase>/`; never personal data (seeded demo data only).
- PLAN.md step ids (`Pn.m`) map to these task ids as listed in PLAN.md "Plan step to task map"; this file is authoritative for ids, dependencies and Verify commands.

---

## Phase 1: Misc fixes (P1)

**Adds:** Correct, consistent shortcut labels everywhere (the "+" tooltip says Ctrl+T, the Relay icon shows its real chord), a clickable logo that returns to the landing page, a redesigned empty state, and tidy icon-only "Open in Relay" buttons with human prompts.
**Try in UI:** Hover the tab-bar "+" and the top-right Relay icon and read the shortcut ; Click the top-left logo and land on `/` ; Open a fresh workspace and check the empty state in light and dark ; Hover the wand/Relay icons in the headers, body, script and response panels and confirm icon-only buttons with tooltips.

### ✅ T1.1 ☐ Shortcut registry and shared formatter
- **Kind:** implementation
- **Files:** `src/app/settings/constants.ts`, `src/lib/formatShortcut.ts`, `messages/en/shortcuts.json`, `messages/fr/shortcuts.json`, `messages/ja/shortcuts.json`, `README.md`
- **Do:** Add a Ctrl+T "new tab" entry (alias of new request, `ctrlOnly`) to the registry and its label keys in all three locales. Add one pure `formatShortcut(entry)` in `src/lib/formatShortcut.ts`: `ctrlOnly` entries render a literal "Ctrl" on every platform (mac included), mod entries render through `modKey()`/`isMac()` from `src/lib/platform.ts`; Relay chords come from `getRelayShortcuts`/`toShortcutAlias` (source `src/lib/relay/constants.ts`). Resolve the known conflict in the registry: New Request Ctrl+N, New Collection Ctrl+Shift+N. Named constants only, no key strings elsewhere.
- **Acceptance:**
  - Formatter returns "Ctrl+T" with `isMac()` true and false (AC-01).
  - Mod entries differ per platform; ctrlOnly entries never show the command key.
  - Locale keys exist in en, fr, ja with key parity.
- **Verify:** `bunx vitest run src/app/settings`

### ✅ T1.2 ☐ Tab-bar "+" tooltip shows Ctrl+T
- **Kind:** implementation
- **Depends on:** T1.1
- **Files:** `src/components/layout/TabBar.tsx`, `src/components/layout/TabBar.spec.tsx`
- **Do:** Replace both `<Kbd>{modKey()}+N</Kbd>` sites (~215 and ~245) with output from the registry formatter (FR-01). It must never show N or the command key.
- **Acceptance:**
  - Both "+" tooltips render "Ctrl+T" on mac and non-mac (AC-01).
  - Existing `TabBar.spec.tsx` updated and green.
- **Verify:** `bunx vitest run src/components/layout/TabBar.spec.tsx`; `grep -n "modKey()}+N" src/components/layout/TabBar.tsx` prints nothing

### ✅ T1.3 ☐ Relay icon tooltip with real chord
- **Kind:** implementation
- **Depends on:** T1.1
- **Files:** `src/components/relay/RelayLauncher.tsx`, `src/app/settings/constants.ts`, `messages/en/relay.json`, `messages/fr/relay.json`, `messages/ja/relay.json`
- **Do:** Wrap the top-right Relay icon (`RelayLauncher.tsx`) in the same tooltip style as sibling toolbar buttons: label "Toggle Relay" plus the chord from the registry helpers (mac Cmd+I, others Ctrl+Shift+L), never a string literal (FR-02). The label comes from the `relay` namespace `RelayLauncher` already uses (add the key in en, fr, ja if missing). Add a registry accessor only if one is missing. Keep the launcher's existing Relay-disabled behavior unchanged (FR-09).
- **Acceptance:**
  - Tooltip shows "Toggle Relay" plus Cmd+I (mac) / Ctrl+Shift+L (other) (AC-02).
  - Pressing the chord still toggles the panel.
  - Tooltip opens on keyboard focus too.
- **Verify:** `bunx vitest run src/components/relay src/lib/relay/constants`

### ✅ T1.4 ☐ Shortcut labels: command palette and shortcuts modal
- **Kind:** implementation
- **Depends on:** T1.1
- **Files:** `src/components/common/CommandPalette.tsx`, `src/components/common/CommandPalette.spec.tsx`, `src/components/layout/KeyboardShortcutsModal.tsx`, `src/components/layout/KeyboardShortcutsModal.spec.tsx`
- **Do:** Route every label in both surfaces through the registry and formatter (FR-04); delete any hardcoded key arrays/strings; update the two existing specs.
- **Acceptance:**
  - Labels equal registry output on both platforms.
  - `grep -nE 'keys: \["(Ctrl|⌘)' src/components/common/CommandPalette.tsx src/components/layout/KeyboardShortcutsModal.tsx` prints nothing.
- **Verify:** `bunx vitest run src/components/common/CommandPalette.spec.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx`

### ✅ T1.5 ☐ Shortcut labels: settings Shortcuts tab and shared row/keys components
- **Kind:** implementation
- **Depends on:** T1.1
- **Files:** `src/components/settings/ShortcutsSection.tsx`, `src/components/settings/ShortcutsSection.spec.tsx`, `src/components/common/ShortcutKeys.tsx`, `src/components/common/ShortcutRow.tsx`, `src/components/common/ShortcutRow.spec.tsx`
- **Do:** Make `ShortcutKeys`/`ShortcutRow` render only from the formatter and make the Shortcuts tab read the registry (FR-04). Update the existing specs. No layout change here (the two-column layout is T3.9).
- **Acceptance:**
  - Shortcuts tab rows equal registry entries (AC-04).
  - No hardcoded key arrays in these files.
- **Verify:** `bunx vitest run src/components/settings/ShortcutsSection.spec.tsx src/components/common/ShortcutRow.spec.tsx`

### ✅ T1.6 ☐ Shortcut labels: remaining Kbd surfaces
- **Kind:** implementation
- **Depends on:** T1.1
- **Files:** `src/components/chain/canvas/CanvasEmptyState.tsx`, `src/components/request/UrlBar.tsx`, `src/components/relay/RelayHeader.tsx`
- **Do:** Run `grep -rnE "<Kbd|ShortcutKeys" src` and move every remaining `Kbd` usage in these files (and any other hit not covered by T1.2-T1.5, T1.8) onto the formatter. Do before T1.8 (same `UrlBar.tsx`).
- **Acceptance:**
  - Every surface enumerated by the grep reads from the registry (FR-04).
  - `grep -rnE 'keys: \["(Ctrl|⌘)' src/components` prints nothing (AC-04).
- **Verify:** `grep -rnE 'keys: \["(Ctrl|⌘)' src/components`; `bunx vitest run src/components/chain src/components/request src/components/relay`

### ✅ T1.7 ☐ Redesign the empty state
- **Kind:** implementation
- **Depends on:** T1.1, T1.4
- **Files:** `src/components/layout/EmptyState.tsx`, `src/components/layout/EmptyStateShortcuts.tsx`, `messages/en/common.json`, `messages/fr/common.json`, `messages/ja/common.json`
- **Do:** Invoke ui-ux-pro-max first. Keep a clear primary action (new request), a compact shortcut list rendered from the registry in its own `EmptyStateShortcuts` component (remove the hardcoded `keys: [...]` arrays and the literal "Press Ctrl+T to start."; fix "New collection Ctrl N" to Ctrl+Shift+N), review the copy "Send a request. Build a workflow.", respect light/dark, 375px and reduced motion (FR-05). All empty-state copy goes through `messages/*/common.json` in en, fr, ja with key parity (the component already uses `useTranslations`). Capture agent-browser screenshots (light/dark x 375/1440) to `agent_docs/polish-and-landing/qa/p1/`.
- **Acceptance:**
  - Four screenshots exist in `qa/p1/` with no overflow or horizontal scroll (AC-05). At 375px the app shows the "Best on desktop" gate (MainLayout renders the workspace from `md`), so the empty state itself is verified at 1440px.
  - No hardcoded key strings remain (AC-04).
  - Primary action opens a new request.
- **Verify:** `grep -nE '"Ctrl"|Press Ctrl' src/components/layout/EmptyState.tsx` prints nothing; `ls agent_docs/polish-and-landing/qa/p1`; agent-browser: `export AGENT_BROWSER_SESSION=requestly` then open `https://requestly.localhost/app` with `--init-script e2e/fixtures/qa-seed.init.js`, screenshot light/dark at 375 and 1440, then `agent-browser close`

### ✅ T1.8 ☐ Remove Open in Relay from the URL bar
- **Kind:** implementation
- **Depends on:** T1.6
- **Files:** `src/components/request/UrlBar.tsx`
- **Do:** Delete the `OpenInRelayButton` usage and import from `UrlBar.tsx` (duplicates the wand AI-generate button and leaks an internal prompt) (FR-06). Leave the wand untouched.
- **Acceptance:**
  - `grep -n OpenInRelayButton src/components/request/UrlBar.tsx` prints nothing (AC-06).
  - Non-spec files importing `OpenInRelayButton` (excluding itself) are exactly the 8 in FR-07.
- **Verify:** `grep -n OpenInRelayButton src/components/request/UrlBar.tsx`; `grep -rl OpenInRelayButton src --include=*.tsx | grep -v spec | grep -v OpenInRelayButton.tsx | wc -l`

### ✅ T1.9 ☐ Icon-only Open in Relay button and payload contract
- **Kind:** implementation
- **Files:** `src/components/relay/OpenInRelayButton.tsx`, `src/lib/relay/openInRelay.ts`, `src/components/relay/OpenInRelayButton.spec.tsx`
- **Do:** Make the button icon-only with a tooltip (label) and `aria-label` (FR-08), at least 32px hit area in the dense app toolbars, hidden entirely when Relay is disabled by setting (FR-09). Give `openInRelay.ts` a typed payload contract: short human prompt capped by a named constant (80 chars) plus context as a pill chip; reject/no-op internal instruction text. Define the 8 entry prompts once, as a named-constant map keyed by entry id in `openInRelay.ts` (single source of truth; the entry files only pass their key and context). Do NOT change Relay behavior beyond entry payloads. Update the existing spec.
- **Acceptance:**
  - Button is role button, has an accessible name and tooltip on hover/focus, no visible text, hit area >= 32px (AC-08).
  - Renders nothing when Relay is disabled (FR-09).
  - Prompt length is bounded by the named constant.
- **Verify:** `bunx vitest run src/components/relay/OpenInRelayButton.spec.tsx`

### ✅ T1.10 ☐ Entry-point prompts: request editors
- **Kind:** implementation
- **Depends on:** T1.9
- **Files:** `src/components/request/HeadersEditor.tsx`, `src/components/request/BodyEditor.tsx`, `src/components/request/ScriptEditor.tsx`, `src/components/response/AssertionsTab.tsx`
- **Do:** For each entry point pass its key from the T1.9 prompt map (a short human prompt, e.g. "Explain these headers") and attach the editor content as a pill chip; no internal instruction text in the composer (FR-07). Remove old "Build an HTTP request from this description"-style strings.
- **Acceptance:**
  - Each of the four passes a prompt of at most 80 chars with context as a chip (AC-07).
  - No "IMPORTANT:" or internal markers remain in these files.
- **Verify:** `grep -nE "IMPORTANT:|Build an HTTP request from this description" src/components/request/HeadersEditor.tsx src/components/request/BodyEditor.tsx src/components/request/ScriptEditor.tsx src/components/response/AssertionsTab.tsx`; `bunx vitest run src/components/request src/components/response`

### ✅ T1.11 ☐ Entry-point prompts: response and transform
- **Kind:** implementation
- **Depends on:** T1.9
- **Files:** `src/components/response/ResponsePanel.tsx`, `src/components/response/ErrorExplainer.tsx`, `src/components/response/TransformPlayground.tsx`, `src/components/transform/TransformPage.tsx`
- **Do:** Same contract as T1.10 for the remaining four entry points (FR-07, FR-08).
- **Acceptance:**
  - Each passes a prompt of at most 80 chars with context as a chip (AC-07); the TransformPage entry has no chip (its input JSON is page-local), only the short prompt.
  - Non-spec importers of `OpenInRelayButton` are exactly the 8 named files (AC-06).
- **Verify:** `grep -nE "IMPORTANT:|Build an HTTP request from this description" src/components/response/ResponsePanel.tsx src/components/response/ErrorExplainer.tsx src/components/response/TransformPlayground.tsx src/components/transform/TransformPage.tsx`; `bunx vitest run src/components/response src/components/transform`

### ✅ T1.12 ☐ Logo links to the landing page
- **Kind:** implementation
- **Files:** `src/components/layout/LeftPanel.tsx`, `src/components/layout/LeftPanel.spec.tsx`
- **Do:** Wrap `/logo.png` in `next/link` with `href="/"`, keyboard focusable, accessible name (FR-03). Confirm open/unsaved tabs persist when returning to `/app` (existing `useTabsStore` behavior); fix nothing else.
- **Acceptance:**
  - Logo is a real link to `/` with an accessible name (AC-03).
  - Returning to `/app` shows the same tabs.
- **Verify:** `bunx vitest run src/components/layout/LeftPanel.spec.tsx`

### ✅ T1.13 ☐ Unit: shortcut registry and formatter
- **Kind:** unit
- **Depends on:** T1.1
- **Files:** `src/lib/formatShortcut.ts`, `src/app/settings/constants.ts`
- **Do:** Cover AC-01 (Ctrl+T on both platforms via mocked `isMac()`), ctrlOnly vs mod rendering, Relay chord per platform, registry label-key parity across en/fr/ja, and the surface-enumeration check (AC-04).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/app/settings src/lib/formatShortcut.spec.ts --coverage --coverage.include=src/lib/formatShortcut.ts,src/app/settings/constants.ts --coverage.reporter=text`

### ✅ T1.14 ☐ Unit: shortcut surfaces
- **Kind:** unit
- **Depends on:** T1.3, T1.4, T1.5, T1.7
- **Files:** `src/components/layout/EmptyStateShortcuts.tsx`, `src/components/relay/RelayLauncher.tsx`, `src/components/layout/KeyboardShortcutsModal.tsx`, `src/components/settings/ShortcutsSection.tsx`, `src/components/common/ShortcutKeys.tsx`
- **Do:** Assert each surface renders exactly the registry label for both platforms (AC-02, AC-04), including the Relay tooltip label plus chord.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/layout src/components/relay/RelayLauncher.spec.tsx src/components/settings/ShortcutsSection.spec.tsx src/components/common --coverage --coverage.include=src/components/layout/EmptyStateShortcuts.tsx,src/components/relay/RelayLauncher.tsx,src/components/layout/KeyboardShortcutsModal.tsx,src/components/settings/ShortcutsSection.tsx,src/components/common/ShortcutKeys.tsx --coverage.reporter=text`

### ✅ T1.15 ☐ Unit: tab-bar tooltip, logo link and Open in Relay payloads
- **Kind:** unit
- **Depends on:** T1.2, T1.11, T1.12
- **Files:** `src/components/layout/TabBar.tsx`, `src/components/layout/LeftPanel.tsx`, `src/components/relay/OpenInRelayButton.tsx`, `src/lib/relay/openInRelay.ts`
- **Do:** Cover the "+" tooltip on both platforms (AC-01), logo link href and accessible name (AC-03), and a parametrised test across all 8 entry payloads asserting prompt text has no internal markers and at most 80 chars (AC-07), icon-only a11y (AC-08) and absence when Relay is disabled (FR-09).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/layout/TabBar.spec.tsx src/components/layout/LeftPanel.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx --coverage --coverage.include=src/components/layout/TabBar.tsx,src/components/layout/LeftPanel.tsx,src/components/relay/OpenInRelayButton.tsx,src/lib/relay/openInRelay.ts --coverage.reporter=text`

### ✅ T1.16 ☐ E2E: shortcut labels and Relay tooltip
- **Kind:** e2e
- **Depends on:** T1.2, T1.3, T1.6, T1.13, T1.14
- **Scenarios:**
  - `@critical` hovering the tab-bar "+" shows Ctrl+T with `navigator.platform` overridden to `MacIntel` and to `Win32` via `page.addInitScript` (`isMac()` reads `navigator.platform`, not the user agent) (AC-01)
  - `@critical` hovering the Relay icon shows "Toggle Relay" with the platform chord (same platform override, both values); pressing it toggles the panel (AC-02)
  - `@high` command palette, shortcuts modal and Settings Shortcuts show the same labels as the registry
  - `@medium` with Relay disabled in settings, the Relay icon and its shortcut follow the existing disabled behavior (FR-09; the Settings Relay row is P3, T3.12)
- **Spec:** `e2e/qa/polish-and-landing/p1-shortcuts.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/tabs.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-shortcuts.spec.ts e2e/tabs.spec.ts --repeat-each=3`

### ✅ T1.17 ☐ E2E: logo link and empty state
- **Kind:** e2e
- **Depends on:** T1.7, T1.12, T1.15
- **Scenarios:**
  - `@critical` clicking the logo navigates to `/` (URL equals `/`); Tab to the logo then Enter does the same (AC-03)
  - `@high` after returning to `/app`, previously open tabs are still present
  - `@high` at 375px the "Best on desktop" gate shows with no horizontal scroll; at 1440px the empty state has no horizontal scroll and its primary action opens a new request (AC-05)
  - `@medium` empty-state shortcut list equals the registry (no "New collection Ctrl N")
- **Spec:** `e2e/qa/polish-and-landing/p1-logo-empty.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/home.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-logo-empty.spec.ts e2e/home.spec.ts --repeat-each=3`

### ✅ T1.18 ☐ E2E: Open in Relay entry points
- **Kind:** e2e
- **Depends on:** T1.8, T1.11, T1.15
- **Scenarios:**
  - `@critical` URL bar has no Open-in-Relay button (AC-06)
  - `@critical` each of the 8 entry points opens Relay with a composer prompt of at most 80 chars, no internal markers, and a context chip (AC-07; Transform page: no chip)
  - `@high` each button is icon-only, has an accessible name and a tooltip on hover/focus (AC-08)
  - `@high` with Relay disabled, none of the buttons render (FR-09)
- **Spec:** `e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/qa/relay/relay-improvements-pills.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3`

### ✅ T1.19 ☐ Gate: P1 typecheck, lint, targeted suites
- **Kind:** gate
- **Depends on:** T1.16, T1.17, T1.18
- **Files:** none
- **Do:** Run the one end-of-phase `bun run typecheck` and `bun run lint:check`, the P1 vitest scopes, and the P1 e2e specs (targeted only).
- **Acceptance:**
  - Typecheck and lint clean.
  - `grep -rnE 'keys: \["(Ctrl|⌘)' src/components` prints nothing.
  - AC-01..08 evidenced by the specs above.
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/app/settings src/components/layout src/components/relay src/components/common src/components/request src/components/response src/components/transform src/components/chain`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-shortcuts.spec.ts e2e/qa/polish-and-landing/p1-logo-empty.spec.ts e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts e2e/tabs.spec.ts e2e/home.spec.ts --repeat-each=2`

🔶 **Checkpoint 1**: shortcut labels come only from the registry, logo links to `/`, empty state redesigned (screenshots in `qa/p1/`), Open-in-Relay is icon-only on exactly 8 entry points with human prompts; AC-01..08 pass and the verifier gives PASS.

---

## Phase 2: Left sidebar (P2)

**Adds:** Instant expand/collapse on large collections (profiled first, then fixed at the root cause), a polished collection row, a help cursor on the health pill, and a grouped "+" menu.
**Try in UI:** Expand and collapse the 148-request demo collection and confirm it feels instant ; Hover a request's health pill and see the help cursor and popover ; Open the sidebar "+" menu and read the three labeled groups ; Reload and confirm expand state persists.

### ✅ T2.1 ☐ Seed a 148-request collection and profile the baseline
- **Kind:** implementation
- **Files:** `e2e/fixtures/seed/polish-sidebar.json`, `e2e/fixtures/qa-seed.init.js`, `agent_docs/polish-and-landing/p2-profile.md`
- **Do:** Add a demo seed (no personal data) with an "OpenAI"-style collection of 148 requests, a 0-request collection and a generator for 500 synthetic requests; `bun run qa:seed:build`. Storage is per-origin, so apply the seed through `--init-script e2e/fixtures/qa-seed.init.js` on whichever origin is measured (the isolated prod preview for numbers of record). Then profile with agent-browser (`agent-browser trace start|stop`, `agent-browser react renders start`) BEFORE any fix: click-to-next-paint for expand and collapse, unthrottled and 4x CPU throttle. The AC-10 numbers of record are taken on the isolated prod preview (`http://localhost:3100/app`, see Conventions), because React dev mode inflates absolute timings; dev-server numbers (`https://requestly.localhost/app`) may be added as informational. Record what re-renders, layout/animation cost, and whether `VirtualizedRequestList.tsx` is bypassed (FR-10, AC-09). Write findings and the chosen fix to `p2-profile.md`. Read-only files: `CollectionTree.tsx`, `CollectionRequestTree.tsx`, `VirtualizedRequestList.tsx`, `RequestItem.tsx`, `HealthDot.tsx`, `useFolderExpandStore.ts`, `useCollectionsStore.ts`.
- **Acceptance:**
  - Seed builds and the 148/0/500 collections load.
  - `p2-profile.md` has baseline numbers (expand, collapse, unthrottled, 4x) and the root cause named (AC-09).
  - No source files outside the seed were changed.
- **Verify:** `bun run qa:seed:build`; `grep -cE "expand|collapse" agent_docs/polish-and-landing/p2-profile.md`; agent-browser: `export AGENT_BROWSER_SESSION=requestly`, load the seed with `--init-script e2e/fixtures/qa-seed.init.js`, run the trace, then `agent-browser close`

### ✅ T2.2 ☐ Fix the expand/collapse root cause
- **Kind:** implementation
- **Depends on:** T2.1
- **Files:** `src/components/collections/CollectionRequestTree.tsx`, `src/components/collections/VirtualizedRequestList.tsx`, `src/components/collections/RequestItem.tsx`, `src/components/collections/CollectionTree.tsx`, `src/components/collections/CollectionTree.spec.tsx`
- **Do:** Implement exactly the fix the profile names (virtualization wiring, memoized rows, narrowed store selectors, removing height animation over N rows; FR-11). Keep keyboard arrow nav, focus rings and `useFolderExpandStore` persistence intact (FR-15). A 0-request collection shows an empty hint with no chevron glitch. If the fix needs a new dependency or a persisted-shape change, STOP and Ask first. Re-measure and append after-numbers to `p2-profile.md`; if the store file must change, split into a follow-up task.
- **Acceptance:**
  - On the isolated prod preview, expand and collapse of the 148-request collection: click-to-next-paint <= 100 ms unthrottled (target <= 200 ms at 4x) and no long task > 50 ms; in addition, any metric that failed at baseline improves by >= 3x (AC-10).
  - Rendered request rows <= 40 when expanded (AC-11).
  - Scrolling has no long task > 50 ms and no blank-row flashes (AC-12).
  - 500 synthetic requests show no regression beyond the budget scaling.
- **Verify:** `bunx vitest run src/components/collections/CollectionTree.spec.tsx src/components/collections/CollectionRequestTree.spec.tsx src/components/collections/RequestItem.spec.tsx`; `grep -n "after" agent_docs/polish-and-landing/p2-profile.md`

### ✅ T2.3 ☐ Collection parent row polish
- **Kind:** implementation
- **Depends on:** T2.2
- **Files:** `src/components/collections/CollectionTree.tsx`, `src/components/collections/CollectionTree.spec.tsx`
- **Do:** Apply the impeccable and layout skills to the collection parent row: spacing, alignment, hover/active states, count badge, chevron, truncation, empty-collection hint (FR-12). Check light, dark and the narrowest supported desktop width (the app shows a mobile gate below it); screenshots registered with `DASH shot`.
- **Acceptance:**
  - Row passes visual review in both themes and at the narrowest supported desktop width.
  - Long names truncate; badge and chevron align.
  - Existing spec green.
- **Verify:** `bunx vitest run src/components/collections/CollectionTree.spec.tsx`; dashboard shots T2.3-1 and T2.3-2 exist in `.dashboard/polish-and-landing/shots/manifest.json`

### ✅ T2.4 ☐ Health pill uses the help cursor
- **Kind:** implementation
- **Files:** `src/components/collections/HealthDot.tsx`, `src/components/collections/HealthPopover.tsx`
- **Do:** Apply `cursor-help` to the pill trigger; the p50/p95/last popover still opens (FR-13). If `RequestItem.tsx` is touched by T2.2, do this after it.
- **Acceptance:**
  - Pill has the `cursor-help` class (computed `cursor: help`) and the popover still opens (AC-13).
- **Verify:** `grep -n "cursor-help" src/components/collections/HealthDot.tsx`; `bunx vitest run src/components/collections/HealthDot.spec.tsx`

### ✅ T2.5 ☐ Grouped sidebar "+" menu
- **Kind:** implementation
- **Files:** `src/components/layout/CreateNewDropdown.tsx`, `messages/en/navigation.json`, `messages/fr/navigation.json`, `messages/ja/navigation.json`
- **Do:** Confirm by grep that `CreateNewDropdown` backs the sidebar "+". Group items with shadcn `DropdownMenuGroup`/`DropdownMenuLabel`/separators per `.claude/skills/shadcn-component-rules/SKILL.md`: Requests (HTTP, GraphQL, WebSocket, Socket.IO), Workspace (Collection, Environment, Chain), Import (FR-14). Each item still creates the right entity; the three group labels go in the `navigation` namespace the component already uses, in en, fr, ja with key parity.
- **Acceptance:**
  - Menu renders three labeled groups in that order (AC-14).
  - Every item still creates its entity.
- **Verify:** `bunx vitest run src/components/layout`

### ✅ T2.6 ☐ Unit: health pill and grouped menu
- **Kind:** unit
- **Depends on:** T2.4, T2.5
- **Files:** `src/components/collections/HealthDot.tsx`, `src/components/collections/HealthPopover.tsx`, `src/components/layout/CreateNewDropdown.tsx`
- **Do:** Cover `cursor-help` plus popover open (AC-13) and the three labeled groups in order with each item firing the right handler (AC-14).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/collections/HealthDot.spec.tsx src/components/layout --coverage --coverage.include=src/components/collections/HealthDot.tsx,src/components/collections/HealthPopover.tsx,src/components/layout/CreateNewDropdown.tsx --coverage.reporter=text`

### ✅ T2.7 ☐ Unit: collection tree and virtualized list
- **Kind:** unit
- **Depends on:** T2.3
- **Files:** `src/components/collections/CollectionTree.tsx`, `src/components/collections/CollectionRequestTree.tsx`, `src/components/collections/VirtualizedRequestList.tsx`, `src/components/collections/RequestItem.tsx`, `src/stores/useFolderExpandStore.ts`
- **Do:** Cover rendered-row bound for a 148-item list (AC-11), 0-request empty hint, 500-item list, arrow-key navigation (AC-15), and expand-state persistence round trip.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/collections src/stores --coverage --coverage.include=src/components/collections/CollectionTree.tsx,src/components/collections/CollectionRequestTree.tsx,src/components/collections/VirtualizedRequestList.tsx,src/components/collections/RequestItem.tsx,src/stores/useFolderExpandStore.ts --coverage.reporter=text`

### ✅ T2.8 ☐ E2E: sidebar expand/collapse performance
- **Kind:** e2e
- **Depends on:** T2.7
- **Scenarios:**
  - `@critical` expand and collapse the 148-request collection: click-to-next-paint <= 100 ms and no long task > 50 ms measured with PerformanceObserver (AC-10)
  - `@critical` expanded list renders <= 40 request rows in the DOM (AC-11)
  - `@high` scrolling the expanded list produces no long task > 50 ms and no blank rows (AC-12)
  - `@medium` 0-request collection shows the empty hint and expands without error; 500-request collection stays within the budget scaling
- **Spec:** `e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts`
- **Files:** none expected (seed is in `e2e/fixtures/seed/polish-sidebar.json`)
- **Acceptance:** Every scenario passes 3 of 3 repeats on the same machine as the baseline, against the isolated prod build (`E2E_SERVER=prod`, matching the T2.1 measurement target); thresholds asserted in code.
- **Verify:** `E2E_SERVER=prod bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts --repeat-each=3`

### ✅ T2.9 ☐ E2E: sidebar menu, health cursor and persistence
- **Kind:** e2e
- **Depends on:** T2.6, T2.7
- **Scenarios:**
  - `@critical` "+" menu shows Requests / Workspace / Import labels in order and each item creates its entity (AC-14)
  - `@high` health pill computed cursor is `help` and the popover opens (AC-13)
  - `@high` expand state survives reload; arrow keys navigate the virtualized list (AC-15)
- **Spec:** `e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/collections.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts e2e/collections.spec.ts --repeat-each=3`

### ✅ T2.10 ☐ Gate: P2 typecheck, lint, targeted suites
- **Kind:** gate
- **Depends on:** T2.8, T2.9
- **Files:** none
- **Do:** One `bun run typecheck` and `bun run lint:check`; P2 vitest scopes; P2 e2e only.
- **Acceptance:**
  - Typecheck and lint clean.
  - `p2-profile.md` holds baseline and after numbers meeting AC-10.
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/components/collections src/components/layout src/stores`; `E2E_SERVER=prod bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts --repeat-each=2`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts e2e/collections.spec.ts --repeat-each=2`

🔶 **Checkpoint 2**: profile doc with before/after numbers meets AC-10, DOM rows <= 40, grouped "+" menu, `cursor: help` pill; AC-09..15 pass and the verifier gives PASS.

---

## Phase 3: Settings (P3)

**Adds:** A cleaned-up Settings page: Language lives in General, the Global tab has a clear purpose, history-clearing actions say exactly what they delete, Shortcuts fit in two columns, and two new low-risk options (confirm before closing unsaved tabs; reduced-motion override).
**Try in UI:** Open Settings and confirm there is no Language tab but a language row in General ; Visit `/settings#language` and land on General ; Open the Shortcuts tab at 1280x720 with no vertical scroll ; Toggle "confirm before closing" and the reduced-motion option, then reload and confirm they persist.

### ✅ T3.1 ☐ Settings audit and decisions
- **Kind:** dod
- **Files:** `agent_docs/polish-and-landing/p3-audit.md`, `agent_docs/polish-and-landing/qa/p3/before/`
- **Do:** With ui-ux-pro-max, impeccable and layout skills review every tab and the page shell (`src/components/settings/*`, `src/app/settings/{page,SettingsPageClient,constants}.tsx`). Capture before screenshots of all tabs in light and dark. Write `p3-audit.md` with: Global-tab decision (FR-18), Clear-history scope decision and exact dialog copy (FR-19), the FR-21 settings design (confirm-before-closing-unsaved, reduced-motion override system/on/off; at most one more UI-only setting only with written rationale), the copy list (FR-22), and the final tab set.
- **Acceptance:**
  - `p3-audit.md` lists every tab with findings and the four decisions above.
  - Before screenshots exist for all tabs in both themes (AC-22 baseline).
- **Verify:** `grep -ciE "global|clear history|reduced.motion|confirm" agent_docs/polish-and-landing/p3-audit.md`; `ls agent_docs/polish-and-landing/qa/p3/before`

### ✅ T3.2 ☐ Fold Language into General
- **Kind:** implementation
- **Depends on:** T3.1, T1.5
- **Files:** `src/components/settings/GeneralSection.tsx`, `src/components/settings/LanguageSection.tsx`, `src/components/settings/SettingsNav.tsx`, `src/app/settings/SettingsPageClient.tsx`, `src/stores/useSettingsSectionStore.ts`
- **Do:** Add a language row to General (shared row component if useful), reusing the existing language message keys (no new keys here), delete `LanguageSection.tsx` (no spec exists), remove the Language nav entry and section registration. `/settings#language` and any persisted "language" section value must land on General without error (hashchange handled in `useSettingsSectionStore`) (FR-17).
- **Acceptance:**
  - `SettingsNav` lists no Language tab; the language row works from General (AC-16, AC-17).
  - `#language` and persisted `language` section resolve to General with no error.
- **Verify:** `grep -rn LanguageSection src` prints nothing; `bunx vitest run src/stores/useSettingsSectionStore.spec.ts`

### ✅ T3.3 ☐ Update existing specs for the Language fold
- **Kind:** implementation
- **Depends on:** T3.2
- **Files:** `src/app/settings/page.spec.tsx`, `src/app/settings/constants.spec.ts`, `src/components/settings/GeneralSection.spec.tsx`, `e2e/settings.spec.ts`
- **Do:** Update only the assertions the fold breaks (tab set, section ids, language location); adapt the language e2e to the General row.
- **Acceptance:**
  - The four files green with Language absent from the tab set (AC-16).
- **Verify:** `bunx vitest run src/app/settings src/components/settings/GeneralSection.spec.tsx`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/settings.spec.ts`

### ✅ T3.4 ☐ Resolve the Global tab
- **Kind:** implementation
- **Depends on:** T3.2
- **Files:** `src/components/settings/GlobalSection.tsx`, `src/components/settings/SettingsNav.tsx`, `src/app/settings/SettingsPageClient.tsx`, `messages/en/settings.json`
- **Do:** Execute the audit's FR-18 decision: either rename with an explicit one-line purpose or merge its content into the correct tab; keep deep links to the old hash working (redirect to the new location).
- **Acceptance:**
  - No tab has an unclear name; the decision is reflected in `p3-audit.md`.
  - Old Global hash lands somewhere valid without error.
- **Verify:** `bunx vitest run src/app/settings src/components/settings`

### ✅ T3.5 ☐ De-duplicate Clear-history and Data actions
- **Kind:** implementation
- **Depends on:** T3.1
- **Files:** `src/components/settings/GeneralSection.tsx`, `src/components/settings/DataSection.tsx`, `src/components/settings/RelaySection.tsx`, `src/components/settings/ClearHistoryDialog.tsx`, `messages/en/settings.json`
- **Do:** Per the audit (FR-19): either merge into one Data location or label scope explicitly ("Request history" vs "Relay conversations") with confirm dialogs naming exactly what is deleted. General "Data Management" and the Data tab must not overlap. Update `DataSection.spec.tsx` and `RelaySection.spec.tsx` as needed.
- **Acceptance:**
  - No two visible actions share a label unless their scope text differs (AC-18).
  - Each confirm dialog states precisely what is deleted.
- **Verify:** `bunx vitest run src/components/settings/DataSection.spec.tsx src/components/settings/RelaySection.spec.tsx src/components/settings/GeneralSection.spec.tsx`

### ✅ T3.6 ☐ Setting: confirm before closing an unsaved tab
- **Kind:** implementation
- **Depends on:** T3.5
- **Files:** `src/stores/useSettingsStore.ts`, `src/hooks/useCloseTabGuard.ts`, `src/components/settings/GeneralSection.tsx`, `messages/en/settings.json`
- **Do:** ASK FIRST on the persisted shape change (new field) via AskUserQuestion. Today `useCloseTabGuard.ts` always prompts before closing a dirty tab (single, others, all), so this setting is an opt-out toggle "Ask before closing unsaved tabs", default ON (today's behavior). Add the field with default-merge on load so old persisted state loads defaults, a General control (en key here; fr/ja in T3.13), and make the guard skip the prompt only when the setting is OFF. Does not touch request execution (FR-21).
- **Acceptance:**
  - Store field, persistence, default ON, UI control, wiring for single, others and all closes (AC-20).
  - With the setting ON behavior is identical to today; OFF closes dirty tabs without a prompt.
  - Legacy persisted state without the field loads with defaults and no crash.
- **Verify:** `bunx vitest run src/stores/useSettingsStore.spec.ts src/hooks/useCloseTabGuard.spec.ts src/components/settings/GeneralSection.spec.tsx`

### ✅ T3.7 ☐ Setting: reduced-motion override (system / on / off)
- **Kind:** implementation
- **Depends on:** T3.6
- **Files:** `src/stores/useSettingsStore.ts`, `src/components/settings/AppearanceSection.tsx`, `src/hooks/useReducedMotion.ts`, `src/app/globals.css`, `messages/en/settings.json`
- **Do:** Add the three-value field (default `system`, default-merge on load), an Appearance control (en key here; fr/ja in T3.13), and extend the EXISTING `src/hooks/useReducedMotion.ts` (today media query only; keep its signature so current callers keep working) so it combines the OS media query with the override; apply a data attribute/class on `<html>` that CSS respects. This hook is reused by P6/P7 (FR-21). Persisted shape change was approved in T3.6.
- **Acceptance:**
  - `on` forces reduced motion, `off` forces motion, `system` follows the OS (AC-20).
  - Legacy state loads defaults.
- **Verify:** `bunx vitest run src/stores/useSettingsStore.spec.ts src/hooks src/components/settings`

### ✅ T3.8 ☐ Third UI-only setting (only if the audit justifies it)
- **Kind:** dod
- **Depends on:** T3.1
- **Files:** `agent_docs/polish-and-landing/p3-audit.md`
- **Do:** Read the audit rationale. If it justifies no third setting, record "none added" in `p3-audit.md` and stop. If it justifies one, it is a persisted-shape change, so STOP and Ask first (AskUserQuestion, recommended option first); only on approval append a full implementation/unit/e2e task trio to this phase before T3.20 (max one more, UI-only, excluded: timeout, follow-redirects, send-on-enter) before any code. Default when the audit is inconclusive: "none added".
- **Acceptance:** `p3-audit.md` states either "none added" or the approved extra setting with rationale and appended tasks (FR-21).
- **Verify:** `grep -niE "third setting|none added" agent_docs/polish-and-landing/p3-audit.md`

### ✅ T3.9 ☐ Shortcuts tab in two columns
- **Kind:** implementation
- **Depends on:** T1.5, T3.2
- **Files:** `src/components/settings/ShortcutsSection.tsx`, `src/components/settings/ShortcutsSection.spec.tsx`
- **Do:** CSS grid with two columns at a named breakpoint constant, one column below it, so all shortcuts fit without vertical scrolling at 1440x900 and 1280x720 (FR-20). Sequence after T3.4 if `SettingsPageClient.tsx` shell is touched.
- **Acceptance:**
  - At 1280x720 the content region has `scrollHeight <= clientHeight` (AC-19).
  - One column below the breakpoint; no horizontal scroll at 375px.
- **Verify:** `bunx vitest run src/components/settings/ShortcutsSection.spec.tsx`

### ✅ T3.10 ☐ Copy and polish: General, Appearance, Global
- **Kind:** implementation
- **Depends on:** T3.6, T3.7, T3.4
- **Files:** `src/components/settings/GeneralSection.tsx`, `src/components/settings/AppearanceSection.tsx`, `src/components/settings/GlobalSection.tsx`, `messages/en/settings.json`
- **Do:** Concise labels, one-line descriptions, consistent casing, no vendor names, strings via `messages/*` in en, fr, ja (FR-22). Visible focus rings; light/dark; 375px.
- **Acceptance:**
  - Copy matches the audit copy list; locale key parity holds.
  - Focus rings visible; no horizontal scroll at 375px (AC-21).
- **Verify:** `bunx vitest run src/components/settings src/i18n`

### ✅ T3.11 ☐ Copy and polish: Proxy, Shortcuts, Data, Relay
- **Kind:** implementation
- **Depends on:** T3.9, T3.5, T3.10
- **Files:** `src/components/settings/ProxySection.tsx`, `src/components/settings/ShortcutsSection.tsx`, `src/components/settings/DataSection.tsx`, `src/components/settings/RelaySection.tsx`, `messages/en/settings.json`, `src/components/common/ShortcutKeys.tsx`
- **Do:** Same copy rules as T3.10 for the remaining tabs (FR-22): labels and descriptions only. For the Relay tab this is copy only; Relay behavior and Relay settings logic are out of scope and unchanged. Introduce no AI vendor names (a regression guard; none exist today).
- **Acceptance:**
  - `grep -niE "grok|xai|openai|anthropic|gemini" messages/*/settings.json` prints nothing.
  - Focus rings visible; 375px clean (AC-21).
- **Verify:** `grep -niE "grok|xai|openai|anthropic|gemini" messages/*/settings.json`; `bunx vitest run src/components/settings`

### ✅ T3.12 ☐ Relay-disabled consistency in settings
- **Kind:** implementation
- **Depends on:** T1.11, T3.4, T3.11
- **Files:** `src/components/settings/RelaySection.tsx`, `src/components/settings/SettingsNav.tsx`, `src/components/settings/ShortcutsSection.tsx`, `src/components/settings/RelaySection.spec.tsx`, `messages/en/settings.json`
- **Do:** When Relay is disabled by setting, the Relay tab shows a clear disabled state (or is consistently hidden) and the Shortcuts tab hides the Relay toggle row (FR-23); consistent with the Open-in-Relay buttons from T1.9.
- **Acceptance:**
  - Disabled state is clear and consistent across tab, shortcut row and buttons.
  - `RelaySection.spec.tsx` covers it.
- **Verify:** `bunx vitest run src/components/settings/RelaySection.spec.tsx src/components/settings/ShortcutsSection.spec.tsx`

### ✅ T3.13 ☐ Settings copy: fr/ja translations and key parity
- **Kind:** implementation
- **Depends on:** T3.4, T3.5, T3.6, T3.7, T3.8, T3.11, T3.12
- **Files:** `messages/en/settings.json`, `messages/fr/settings.json`, `messages/ja/settings.json`
- **Do:** Each of T3.4-T3.12 adds its own en keys to `messages/en/settings.json` as it lands. This task adds the fr and ja translations for every en key those tasks introduced (language row, clear-history scopes, confirm-close and reduced-motion controls, polished copy) and enforces key parity across the three locales, with no vendor names (FR-19, FR-21, FR-22).
- **Acceptance:**
  - en, fr and ja have identical key sets.
  - `grep -niE "grok|xai|openai|anthropic|gemini" messages/*/settings.json` prints nothing.
- **Verify:** `bunx vitest run src/i18n src/components/settings`; `grep -niE "grok|xai|openai|anthropic|gemini" messages/*/settings.json`

### ✅ T3.14 ☐ After screenshots of every tab
- **Kind:** dod
- **Depends on:** T3.13
- **Files:** `agent_docs/polish-and-landing/qa/p3/after/`
- **Do:** agent-browser (`export AGENT_BROWSER_SESSION=requestly`, seeded) screenshots of all tabs in light and dark, plus Shortcuts at 1280x720; end with `agent-browser close`. No personal data.
- **Acceptance:** One image per tab per theme exists in `qa/p3/after/` (AC-22).
- **Verify:** `ls agent_docs/polish-and-landing/qa/p3/after | wc -l`

### ✅ T3.15 ☐ Unit: settings stores and hooks
- **Kind:** unit
- **Depends on:** T3.2, T3.7
- **Files:** `src/stores/useSettingsStore.ts`, `src/hooks/useCloseTabGuard.ts`, `src/hooks/useReducedMotion.ts`, `src/stores/useSettingsSectionStore.ts`, `src/hooks/useReducedMotion.ssr.spec.tsx`
- **Do:** Cover default-merge of legacy persisted state (AC-20), confirm-close guard on/off, reduced-motion system/on/off with mocked media query, and the `#language` / persisted-language redirect to General (AC-17).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/stores/useSettingsStore.spec.ts src/stores/useSettingsSectionStore.spec.ts src/hooks --coverage --coverage.include=src/stores/useSettingsStore.ts,src/hooks/useCloseTabGuard.ts,src/hooks/useReducedMotion.ts,src/stores/useSettingsSectionStore.ts --coverage.reporter=text`

### ✅ T3.16 ☐ Unit: settings sections
- **Kind:** unit
- **Depends on:** T3.13
- **Files:** `src/components/settings/GeneralSection.tsx`, `src/components/settings/AppearanceSection.tsx`, `src/components/settings/DataSection.tsx`, `src/components/settings/RelaySection.tsx`, `src/components/settings/ShortcutsSection.tsx`, `src/components/settings/AppearanceSection.spec.tsx`
- **Do:** Cover the language row, the two new controls, distinct Clear-history labels and dialog scope copy (AC-18), two-column class at the breakpoint, and the Relay-disabled state.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/settings --coverage --coverage.include=src/components/settings/GeneralSection.tsx,src/components/settings/AppearanceSection.tsx,src/components/settings/DataSection.tsx,src/components/settings/RelaySection.tsx,src/components/settings/ShortcutsSection.tsx --coverage.reporter=text`

### ✅ T3.17 ☐ E2E: Language in General and deep links
- **Kind:** e2e
- **Depends on:** T3.15, T3.16
- **Scenarios:**
  - `@critical` Settings nav has no Language tab; General has a language row (AC-16)
  - `@critical` changing language from General persists across reload (AC-17)
  - `@high` `/settings#language` lands on General without console errors
  - `@medium` the old Global hash redirects to its new location
- **Spec:** `e2e/qa/polish-and-landing/p3-language.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/settings.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-language.spec.ts e2e/settings.spec.ts --repeat-each=3`

### ✅ T3.18 ☐ E2E: new settings and clear-history scopes
- **Kind:** e2e
- **Depends on:** T3.15, T3.16
- **Scenarios:**
  - `@critical` "Ask before closing unsaved tabs" defaults ON and closing an unsaved tab prompts (today's behavior); toggled OFF, the tab closes immediately with no prompt; the choice persists across reload (AC-20)
  - `@high` reduced-motion override on/off/system persists across reload and sets the `<html>` marker
  - `@high` Request-history and Relay-conversation clear actions have distinct labels and their dialogs name what is deleted (AC-18)
  - `@medium` with seeded legacy persisted settings (no new fields) the page loads with defaults and no console error
- **Spec:** `e2e/qa/polish-and-landing/p3-settings-controls.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/history.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-settings-controls.spec.ts e2e/history.spec.ts --repeat-each=3`

### ✅ T3.19 ☐ E2E: Settings layout and accessibility
- **Kind:** e2e
- **Depends on:** T3.15, T3.16
- **Scenarios:**
  - `@critical` Shortcuts at 1280x720 and 1440x900: content region `scrollHeight <= clientHeight` (AC-19)
  - `@critical` every tab has zero serious/critical axe violations in light and dark (AC-21)
  - `@high` every tab at 375px has no horizontal scroll and visible focus rings (AC-21)
  - `@medium` Relay disabled: Relay tab shows its disabled state and Shortcuts hides the Relay toggle row
- **Spec:** `e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts --repeat-each=3`

### ✅ T3.20 ☐ Gate: P3 typecheck, lint, targeted suites
- **Kind:** gate
- **Depends on:** T3.8, T3.14, T3.17, T3.18, T3.19
- **Files:** none
- **Do:** One `bun run typecheck` and `bun run lint:check`; settings vitest scopes; P3 e2e only.
- **Acceptance:**
  - Typecheck and lint clean.
  - AC-16..22 evidenced.
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/components/settings src/app/settings src/stores src/hooks`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-language.spec.ts e2e/qa/polish-and-landing/p3-settings-controls.spec.ts e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts e2e/settings.spec.ts --repeat-each=2`

🔶 **Checkpoint 3**: Language folded into General, Global resolved, history scopes explicit, Shortcuts two-column with no vertical scroll at 1280x720, two new settings persisted with legacy-safe defaults, before/after screenshots stored; AC-16..22 pass and the verifier gives PASS.

---

## Phase 4: Technical docs (P4)

**Adds:** Internal developer documentation in `docs/` (architecture, data model, Relay, and audit-found gaps) with diagrams, plus the diagram-design skill installed for future agents. No user-facing UI change.
**Try in UI:** No UI. Open `docs/ARCHITECTURE.md` and confirm each of the six API routes and each store is named ; Run the docs link/path checker and expect zero broken paths ; Confirm `README.md` links to `docs/`.

### T4.1 ☐ Install the diagram-design skill
- **Kind:** dod
- **Files:** `~/.claude/skills/diagram-design/SKILL.md`
- **Do:** Read the upstream README and SKILL.md of https://github.com/cathrynlavery/diagram-design first and confirm the contents are what they claim. Install with `git clone https://github.com/cathrynlavery/diagram-design ~/.claude/skills/diagram-design` (user-level skills dir). If the install needs anything beyond a clone, STOP and Ask first. Record the exact command and result in `docs/README.md` once it exists (FR-24).
- **Acceptance:**
  - `~/.claude/skills/diagram-design/SKILL.md` exists with a valid `name` in its frontmatter (AC-23).
  - The skill appears in the skills list of a fresh session (manual note for the final summary).
- **Verify:** `test -f ~/.claude/skills/diagram-design/SKILL.md && head -5 ~/.claude/skills/diagram-design/SKILL.md`

### T4.2 ☐ Documentation audit
- **Kind:** dod
- **Files:** `docs/README.md`
- **Do:** Review `README.md`, `CLAUDE.md`, `agent_docs/*` and `graphify-out/GRAPH_REPORT.md` for accuracy and gaps. Write `docs/README.md` as an index with the gap list and the install note from T4.1 (FR-25). Internal docs only: no secrets, no invented behavior.
- **Acceptance:**
  - `docs/README.md` has an index and a gap list that names the docs to be written.
  - Every claim references a file path (FR-28).
- **Verify:** `test -f docs/README.md && grep -ci "gap" docs/README.md`

### T4.3 ☐ docs/ARCHITECTURE.md with diagrams
- **Kind:** dod
- **Depends on:** T4.1, T4.2
- **Files:** `docs/ARCHITECTURE.md`, `docs/diagrams/architecture.svg`, `docs/diagrams/request-pipeline.svg`, `docs/diagrams/relay-flow.svg`
- **Do:** Use one subagent per area to read code (stores in `src/stores`, Relay in `src/lib/relay`, chain runner, proxy/request pipeline, API routes), then assemble. Re-verify the route list against `src/app/api` (ai, hub, proxy, relay, schema, share) and each store file at write time. Draw diagrams with the diagram-design skill, legible in light and dark. Every claim cites a path (FR-26, FR-28).
- **Acceptance:**
  - Names each of the six API routes and every store file it mentions exists (AC-24).
  - Each diagram renders and is referenced by at least one doc (AC-25).
- **Verify:** `for r in ai hub proxy relay schema share; do test -d src/app/api/$r && grep -q "/api/$r" docs/ARCHITECTURE.md || echo MISSING $r; done`; `ls docs/diagrams`

### T4.4 ☐ Data model and Relay architecture docs
- **Kind:** dod
- **Depends on:** T4.3, T3.20
- **Files:** `docs/DATA_MODEL.md`, `docs/RELAY.md`, `docs/diagrams/data-model.svg`
- **Do:** Write after P1/P3 so the settings shape and shortcut registry are final. Data model from `src/types` and stores (storage keys, persisted shapes); Relay architecture from `src/lib/relay`, `src/app/api/relay`, `src/app/api/ai` (FR-27). Cite paths for every claim.
- **Acceptance:**
  - Both docs exist, cite real paths, and diagrams are referenced (AC-25).
- **Verify:** `test -f docs/DATA_MODEL.md && test -f docs/RELAY.md && echo ok`

### T4.5 ☐ Audit-found focused docs
- **Kind:** dod
- **Depends on:** T4.4
- **Files:** `docs/REQUEST_PIPELINE.md`, `docs/CHAIN_RUNNER.md`, `docs/PERSISTENCE.md`, `docs/SHORTCUTS.md`, `docs/TESTING.md`
- **Do:** Write the focused docs the audit (T4.2) flagged as missing, from this candidate list: request pipeline, chain runner, persistence and storage keys, shortcut registry (documents the P1 formatter), testing/QA (harness, seeds, e2e prod mode). Skip any the audit does not justify and record that in `docs/README.md` (FR-27).
- **Acceptance:**
  - Each doc named in the audit gap list exists and cites paths; `docs/README.md` indexes them all.
- **Verify:** `ls docs`

### T4.6 ☐ Link and path checker, README link
- **Kind:** dod
- **Depends on:** T4.5
- **Files:** `README.md`, `docs/README.md`
- **Do:** Write a throwaway checker script in the scratchpad (not shipped) that verifies every relative link and every referenced `src/`, `docs/`, `e2e/` path in `docs/**/*.md` exists. Add a link to `docs/` from `README.md` (FR-28). Fix findings and rerun.
- **Acceptance:**
  - Checker reports zero broken relative links or nonexistent file paths (AC-26).
  - `README.md` links to `docs/` (AC-27).
- **Verify:** `grep -n "docs/" README.md`; `bun -e 'const g=new Bun.Glob("docs/**/*.md");let bad=0;for(const f of g.scanSync(".")){const t=await Bun.file(f).text();for(const m of t.matchAll(/`((?:src|docs|e2e)\/[^`\s]+)`/g)){if(!(await Bun.file(m[1].replace(/[:#].*$/,"")).exists())&&!(await Bun.file(m[1]).exists())){bad++;console.log(f,m[1])}}}console.log("broken",bad);process.exit(bad?1:0)'`

🔶 **Checkpoint 4**: diagram-design skill installed, `docs/` indexed with architecture, data model, Relay and audit-found docs, diagrams render, zero broken paths, README links to `docs/`; AC-23..27 pass and the verifier gives PASS.

---

## Phase 5: Research (P5)

**Adds:** A source-backed comparison against Postman and Insomnia, a corrected comparison table on the landing page where every cell has a citation, and a ranked report of feature gaps (report only).
**Try in UI:** Scroll to the comparison table on `/` and click a source link in a Postman/Insomnia cell ; Tab through the table and confirm source links are keyboard reachable ; Check it in dark mode and at 375px ; Open `agent_docs/polish-and-landing/gap-report.md` and check the ranking rubric at the top.

### T5.1 ☐ Research: Postman features
- **Kind:** dod
- **Files:** `agent_docs/polish-and-landing/research/postman.md`
- **Do:** A dedicated subagent researches Postman features, plans/pricing and changelog from official sources only (FR-29). Table `| Feature | Claim | Source URL | Accessed | Plan tier |`, free vs paid stated where it differs.
- **Acceptance:** Every claim row has an https source URL and an access date.
- **Verify:** `awk -F'|' 'NR>2 && NF>4 && $4 !~ /https?:\/\//' agent_docs/polish-and-landing/research/postman.md`

### T5.2 ☐ Research: Insomnia features
- **Kind:** dod
- **Files:** `agent_docs/polish-and-landing/research/insomnia.md`
- **Do:** Same as T5.1 for Insomnia, by a separate subagent (FR-29).
- **Acceptance:** Every claim row has an https source URL and an access date.
- **Verify:** `awk -F'|' 'NR>2 && NF>4 && $4 !~ /https?:\/\//' agent_docs/polish-and-landing/research/insomnia.md`

### T5.3 ☐ Research: Requestr features from code
- **Kind:** dod
- **Files:** `agent_docs/polish-and-landing/research/requestr.md`
- **Do:** A third subagent derives Requestr's features from `src/` (not marketing), with a code path per claim and a note when a feature is partial (FR-29). Use the table `| Feature | Claim | Code path | Accessed | Notes |` (code path is the third column, which the Verify awk checks).
- **Acceptance:** Every row cites an existing file path and no row claims a feature a code search cannot find.
- **Verify:** `awk -F'|' 'NR>2 && NF>4 && $4 !~ /src\//' agent_docs/polish-and-landing/research/requestr.md`

### T5.4 ☐ Cross-verify and URL check
- **Kind:** dod
- **Depends on:** T5.1, T5.2, T5.3
- **Files:** `agent_docs/polish-and-landing/research/url-check.md`, `agent_docs/polish-and-landing/research/postman.md`, `agent_docs/polish-and-landing/research/insomnia.md`, `agent_docs/polish-and-landing/research/requestr.md`
- **Do:** A fourth pass reconciles disagreements; any claim that cannot be sourced is removed or marked "unverified" (never shown as fact on the landing page) (FR-30). Check every URL with a `bun` fetch script (HEAD, then GET; 2xx/3xx pass). Vendors that block scripted fetches get a manual verification note. Log status and access date per URL.
- **Acceptance:**
  - `url-check.md` has one row per URL with status, date and manual-verification flag (AC-28).
  - No claim is left both unsourced and unmarked.
- **Verify:** `grep -c "https://" agent_docs/polish-and-landing/research/url-check.md`; `grep -ci "unverified" agent_docs/polish-and-landing/research/*.md`

### T5.5 ☐ Correct the ComparisonTable data and render sources
- **Kind:** implementation
- **Depends on:** T5.4
- **Files:** `src/components/landing/data/comparison.ts`, `src/components/landing/ComparisonTable.tsx`, `src/components/landing/data/comparison.spec.ts`, `src/components/landing/ComparisonTable.spec.tsx`
- **Do:** Each row gets a `source` URL for the Postman and Insomnia cells and a `codeRef` path for the Requestr cell; fix stale claims; state plan tier where free/paid differ; unverified claims are dropped (FR-31). Render keyboard-reachable source links; light/dark; scroll container contained at 375px (visual restyle is T7.13). Update the existing specs.
- **Acceptance:**
  - 100% of competitor cells have a source URL (data-level assertion) (AC-28).
  - Every Requestr cell has a `codeRef` that exists in the repo (AC-29).
  - Source links are keyboard reachable (AC-31).
- **Verify:** `bunx vitest run src/components/landing/data/comparison.spec.ts src/components/landing/ComparisonTable.spec.tsx`

### T5.6 ☐ Gap report
- **Kind:** dod
- **Depends on:** T5.4
- **Files:** `agent_docs/polish-and-landing/gap-report.md`
- **Do:** Rank high-value features Postman/Insomnia have that Requestr lacks, with the value-vs-effort rubric stated at the top; each item has source URL, rationale and S/M/L size. Report only, no implementation (FR-32).
- **Acceptance:** At least 10 ranked items, each with source URL, rationale and size; rubric at the top (AC-30).
- **Verify:** `grep -cE "^\| ?[0-9]+|^[0-9]+\." agent_docs/polish-and-landing/gap-report.md`; `head -20 agent_docs/polish-and-landing/gap-report.md`

### T5.7 ☐ Unit: comparison data and table
- **Kind:** unit
- **Depends on:** T5.5
- **Files:** `src/components/landing/data/comparison.ts`, `src/components/landing/ComparisonTable.tsx`
- **Do:** Assert every competitor cell has an https `source`, every Requestr `codeRef` exists on disk, plan-tier notes render, and source links are reachable by keyboard (AC-28, AC-29, AC-31).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing/data/comparison.spec.ts src/components/landing/ComparisonTable.spec.tsx --coverage --coverage.include=src/components/landing/data/comparison.ts,src/components/landing/ComparisonTable.tsx --coverage.reporter=text`

### T5.8 ☐ E2E: comparison table on the landing page
- **Kind:** e2e
- **Depends on:** T5.7
- **Scenarios:**
  - `@critical` each competitor cell on `/` exposes a source link with an https href (AC-28)
  - `@high` source links are reachable with Tab and have visible focus (AC-31)
  - `@high` at 375px the table scrolls inside its container and the page has no horizontal scroll, in light and dark (AC-31)
- **Spec:** `e2e/qa/polish-and-landing/p5-comparison.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; existing `e2e/home.spec.ts` stays green.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p5-comparison.spec.ts e2e/home.spec.ts --repeat-each=3`

### T5.9 ☐ Gate: P5 typecheck, lint, targeted suites
- **Kind:** gate
- **Depends on:** T5.6, T5.8
- **Files:** none
- **Do:** One `bun run typecheck` and `bun run lint:check`; comparison vitest scope; P5 e2e only.
- **Acceptance:** Typecheck and lint clean; AC-28..31 evidenced.
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/components/landing/ComparisonTable.spec.tsx src/components/landing/data`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p5-comparison.spec.ts --repeat-each=2`

🔶 **Checkpoint 5**: research files cross-verified with logged URL checks, ComparisonTable 100% sourced, gap report with at least 10 ranked items; AC-28..31 pass and the verifier gives PASS.

---

## Phase 6: Hero concepts - HARD GATE (P6)

**Adds:** Two or three working hero prototypes at private review URLs (`/hero-lab/a`, `/b`, `/c`, noindex, unlinked) with a review pack so you can choose one. Nothing ships publicly in this phase.
**Try in UI:** Open `/hero-lab/a` and send the pre-filled request, then watch the Relay line add a test ; Open `/hero-lab/b` and scroll the cinematic sequence ; Open `/hero-lab/c` ; Toggle dark mode, reduced motion and a 375px width on each, then read `agent_docs/polish-and-landing/hero/` and pick one.

### T6.1 ☐ Lab shell and shared primitives
- **Kind:** implementation
- **Depends on:** T3.7
- **Files:** `src/app/hero-lab/layout.tsx`, `src/components/hero-lab/useHeroMotion.ts`, `src/components/hero-lab/fallbackResponse.ts`, `src/components/hero-lab/withTimeout.ts`
- **Do:** `layout.tsx` exports `robots: { index: false, follow: false }` and links nothing to `Nav.tsx`. `useHeroMotion` wraps the P3 `useReducedMotion`. Add a recorded fallback response fixture and a named-constant timeout helper, reused by P7 so the pick does not strand work (FR-36). No new dependencies.
- **Acceptance:**
  - Layout emits noindex; no public nav link points to `/hero-lab` (FR-36).
  - Primitives are pure and reusable.
- **Verify:** `grep -rn "hero-lab" src/components/landing`; `bunx vitest run src/components/hero-lab`

### T6.2 ☐ Concept A: live mini-Requestr request
- **Kind:** implementation
- **Depends on:** T6.1
- **Files:** `src/app/hero-lab/a/page.tsx`, `src/components/hero-lab/a/MiniRequestr.tsx`, `src/components/hero-lab/a/useLiveRequest.ts`
- **Do:** Read the `/api/proxy` contract first (read-only; no new API routes, Ask first). Mini URL bar + Send pre-filled with a public API; real response rendered; timeout (named constant, under 3 s target) with the recorded fallback on timeout/offline/failure; no secrets in client code (FR-33).
- **Acceptance:**
  - A real request via the existing proxy renders in under 3 s on a normal connection (AC-35).
  - Offline/failure shows the recorded fallback response gracefully.
  - No secrets in the bundle.
- **Verify:** `grep -rniE "api[_-]?key|secret|token" src/components/hero-lab/a src/app/hero-lab/a`; `bunx vitest run src/components/hero-lab`

### T6.3 ☐ Concept A: Relay line adds an assertion
- **Kind:** implementation
- **Depends on:** T6.2
- **Files:** `src/components/hero-lab/a/RelayLine.tsx`, `src/components/hero-lab/a/AssertionResult.tsx`, `src/app/hero-lab/a/page.tsx`
- **Do:** A Relay line types "add a test that status is 200" and the assertion appears under the response. Restrained motion; with reduced motion render the final static state (no auto-play) (FR-33). No vendor names in copy.
- **Acceptance:**
  - Typing then assertion sequence plays once the response arrives.
  - Reduced motion shows the static finished state (AC-33).
- **Verify:** `bunx vitest run src/components/hero-lab`

### T6.4 ☐ Concept B: cinematic scripted sequence
- **Kind:** implementation
- **Depends on:** T6.1
- **Files:** `src/app/hero-lab/b/page.tsx`, `src/components/hero-lab/b/CinematicHero.tsx`, `src/components/hero-lab/b/useScrollChoreography.ts`
- **Do:** Auto-playing request -> response -> chain -> Relay sequence with scroll choreography, reusing landing visual pieces (`ProductVisual.tsx`) (FR-34). Check `package.json` for an already-present animation approach (gsap/motion) before proposing any dependency; a new dependency is Ask first. Under reduced motion: static meaningful state, no scroll-jacking.
- **Acceptance:**
  - Sequence plays and pauses off-screen.
  - Reduced motion shows a static state with no scroll-jacking (AC-33).
- **Verify:** `bunx vitest run src/components/hero-lab`

### T6.5 ☐ Concept C (implementer's choice)
- **Kind:** implementation
- **Depends on:** T6.1
- **Files:** `src/app/hero-lab/c/page.tsx`, `src/components/hero-lab/c/ConceptC.tsx`, `agent_docs/polish-and-landing/hero/concept-c-rationale.md`
- **Do:** A distinct third direction chosen by the implementer (for example a restrained typographic hero with one live detail), with a written rationale for why it differs from A and B (FR-35). Same reduced-motion, light/dark and 375px rules.
- **Acceptance:**
  - Rationale file exists and names the trade-off versus A and B.
  - Prototype loads without console errors.
- **Verify:** `test -f agent_docs/polish-and-landing/hero/concept-c-rationale.md`; `bunx vitest run src/components/hero-lab`

### T6.6 ☐ Unit: lab primitives and Concept A logic
- **Kind:** unit
- **Depends on:** T6.3
- **Files:** `src/components/hero-lab/useHeroMotion.ts`, `src/components/hero-lab/fallbackResponse.ts`, `src/components/hero-lab/withTimeout.ts`, `src/components/hero-lab/a/useLiveRequest.ts`, `src/components/hero-lab/a/RelayLine.tsx`
- **Do:** Cover timeout then fallback, offline then fallback, success path, reduced-motion static state, and the typing sequence completing with the assertion (AC-33, AC-35).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/hero-lab --coverage --coverage.include=src/components/hero-lab/useHeroMotion.ts,src/components/hero-lab/fallbackResponse.ts,src/components/hero-lab/withTimeout.ts,src/components/hero-lab/a/useLiveRequest.ts,src/components/hero-lab/a/RelayLine.tsx --coverage.reporter=text`

### T6.7 ☐ Unit: Concepts B and C logic
- **Kind:** unit
- **Depends on:** T6.5
- **Files:** `src/components/hero-lab/b/useScrollChoreography.ts`, `src/components/hero-lab/b/CinematicHero.tsx`, `src/components/hero-lab/c/ConceptC.tsx`
- **Do:** Cover choreography state at scroll positions, pause off-screen, and the static reduced-motion render for both concepts (AC-33).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/hero-lab --coverage --coverage.include=src/components/hero-lab/b/useScrollChoreography.ts,src/components/hero-lab/b/CinematicHero.tsx,src/components/hero-lab/c/ConceptC.tsx --coverage.reporter=text`

### T6.8 ☐ E2E: hero prototypes load and behave
- **Kind:** e2e
- **Depends on:** T6.6, T6.7
- **Scenarios:**
  - `@critical` `/hero-lab/a`, `/b`, `/c` each load with no console errors in light and dark (AC-32)
  - `@critical` with reduced motion emulated each renders a static state with no auto-play (AC-33)
  - `@high` at 375x667 there is no horizontal scroll and the primary CTA is visible without scrolling (AC-34)
  - `@high` each lab page has `noindex` and no public nav links to it
- **Spec:** `e2e/qa/polish-and-landing/p6-hero-lab.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts --repeat-each=3`

### T6.9 ☐ E2E: Concept A request, timeout and fallback
- **Kind:** e2e
- **Depends on:** T6.6
- **Scenarios:**
  - `@critical` clicking Send returns and renders a response through the proxy within the timeout (AC-35)
  - `@critical` with the proxy route stalled past the timeout, the recorded fallback renders and the page stays usable
  - `@high` with the network offline, the fallback renders without console errors
  - `@high` after the response, the Relay line types and the assertion appears
- **Spec:** `e2e/qa/polish-and-landing/p6-concept-a.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; the network is stubbed with `page.route` so the spec does not depend on a public API.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-concept-a.spec.ts --repeat-each=3`

### T6.10 ☐ Review pack for the pick
- **Kind:** dod
- **Depends on:** T6.8, T6.9
- **Files:** `agent_docs/polish-and-landing/hero/review.md`, `agent_docs/polish-and-landing/hero/a/`, `agent_docs/polish-and-landing/hero/b/`, `agent_docs/polish-and-landing/hero/c/`
- **Do:** Per concept: screenshots or a short capture (agent-browser, `AGENT_BROWSER_SESSION=requestly`, light/dark, 375 and 1440, then `agent-browser close`), trade-offs (wow factor, perf cost, a11y, maintenance), Lighthouse mobile performance (the bunx command in Conventions; informational, target >= 80) and gzipped JS added in KB, console-error check, reduced-motion state, CTA visibility at 375x667 (FR-36, AC-36, AC-37). Lab pages are measured on the isolated prod preview (Conventions; `http://localhost:3100/...`, killed afterwards), never by starting or touching the dev server.
- **Acceptance:**
  - `review.md` has a row per concept with Lighthouse score, JS KB, trade-offs and links to screenshots (AC-36).
  - Screenshots exist for each concept in both themes and at 375px (AC-37).
- **Verify:** `grep -ciE "lighthouse" agent_docs/polish-and-landing/hero/review.md`; `ls agent_docs/polish-and-landing/hero/a agent_docs/polish-and-landing/hero/b agent_docs/polish-and-landing/hero/c`

### T6.11 ☐ Gate: P6 typecheck, lint, targeted suites
- **Kind:** gate
- **Depends on:** T6.10
- **Files:** none
- **Do:** One `bun run typecheck` and `bun run lint:check`; hero-lab vitest scope; P6 e2e only.
- **Acceptance:** Typecheck and lint clean; AC-32..37 evidenced.
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/components/hero-lab`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts e2e/qa/polish-and-landing/p6-concept-a.spec.ts --repeat-each=2`

### T6.12 ☐ USER GATE: hero pick (hard stop)
- **Kind:** gate
- **Depends on:** T6.11
- **Files:** `agent_docs/polish-and-landing/SPEC.md`
- **Do:** Suite evidence for this gate comes from T6.11; this task is a user-decision gate. STOP all hero work. Present the review pack to the user through AskUserQuestion (recommended option first with reasoning; options: Concept A, Concept B, Concept C, or a named hybrid). Only the user's explicit answer counts: no agent, default or inference may pick, and silence is not approval (FR-37). Record the answer in SPEC section 21 Decision Log, replacing the "PENDING USER (hard gate)" line with exactly `DECIDED (user, YYYY-MM-DD): <choice> — "<verbatim user answer>"`. T6.12 blocks T7.9 and T7.10; non-hero P7 tasks may start once this review pack has been presented.
- **Acceptance:**
  - The Decision Log names the user's pick in the exact format above, quoting the user's AskUserQuestion answer verbatim, and no longer says PENDING.
  - No P7 hero task (T7.9, T7.10) has started before this is recorded.
  - T6.11 evidence still holds: the P6 e2e specs pass.
- **Verify:** `! grep -q "PENDING USER (hard gate)" agent_docs/polish-and-landing/SPEC.md && grep -nE "DECIDED \(user, [0-9]{4}-[0-9]{2}-[0-9]{2}\): .+ — \".+\"" agent_docs/polish-and-landing/SPEC.md`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts e2e/qa/polish-and-landing/p6-concept-a.spec.ts`

🔶 **Checkpoint 6**: two to three prototypes reviewed with Lighthouse and JS cost, reduced motion and 375px verified; AC-32..37 pass and the user's hero pick is recorded in the SPEC Decision Log. The verifier gives PASS.

---

## Phase 7: Landing build (P7)

**Adds:** The chosen hero in production quality, a Relay section with a looping scroll-triggered demo, a Watch-the-demo modal with a video recorded from the real app, a polished landing page (header without Docs, redesigned footer, copy and motion pass), sourced comparison table styling, and live Privacy and Terms pages.
**Try in UI:** Load `/` and scroll to the Relay section and watch the demo loop (pauses off-screen) ; Click "Watch the demo" and check Esc, focus return and that modal video only loads after the click ; Check the header has no Docs link and the footer links to `/privacy` and `/terms` ; Toggle dark mode, reduced motion and 375px width on every section.

### T7.1 ☐ Capture the P7 baseline
- **Kind:** dod
- **Depends on:** T6.11
- **Files:** `agent_docs/polish-and-landing/p7-baseline.md`
- **Do:** Starts once T6.12 has presented the review pack to the user (the pick itself is not required; hero tasks T7.9 and T7.10 wait for it). Using the isolated prod preview (Conventions; never plain `bun run build`, which would overwrite the dev server's `.next`), record first-load JS (gzipped) for `/` from the build output, and the Lighthouse mobile baseline for `http://localhost:3100/` with the bunx command (save the JSON next to `p7-baseline.md`), then kill the preview.
- **Acceptance:** `p7-baseline.md` has first-load JS (KB gzipped) and Lighthouse performance, accessibility, CLS and LCP for `/` (AC-40, AC-41 baseline).
- **Verify:** `grep -ciE "gzip|lighthouse|LCP" agent_docs/polish-and-landing/p7-baseline.md`

### T7.2 ☐ Relay demo scenarios and engine
- **Kind:** implementation
- **Depends on:** T7.1
- **Files:** `src/components/landing/relay/scenarios.ts`, `src/components/landing/relay/relayDemoEngine.ts`, `src/components/landing/relay/useRelayDemo.ts`
- **Do:** Pure, testable scenario data (3-4 scenarios, e.g. "add auth header to every request in OpenAI collection") and a typing/streaming engine. `useRelayDemo` starts when in view (IntersectionObserver), pauses when out of view or when the tab is hidden (`visibilitychange`), and with reduced motion (the P3 hook) returns the static final frame (FR-39). No vendor names in copy.
- **Acceptance:**
  - Loops at least 3 scenarios (AC-38).
  - No timers or rAF run while hidden or off-screen.
  - Reduced motion yields a static final frame and never animates.
- **Verify:** `bunx vitest run src/components/landing/relay`

### T7.3 ☐ Relay section UI
- **Kind:** implementation
- **Depends on:** T7.2
- **Files:** `src/components/landing/relay/RelaySection.tsx`, `src/components/landing/relay/RelayDemoPanel.tsx`, `src/components/landing/relay/ChangeCardMock.tsx`, `src/components/landing/relay/SidebarMock.tsx`, `src/components/landing/LandingPage.tsx`
- **Do:** Mock Relay panel with typing prompt, streaming reply, change cards with Undo and a live-updating mock sidebar; theme-aware; lazy-loaded with `next/dynamic` in `LandingPage.tsx` (FR-39). Tap targets >= 44px on landing.
- **Acceptance:**
  - Section renders in light and dark, at 375px with no horizontal scroll.
  - Section is lazy-loaded and adds no eager JS.
- **Verify:** `bunx vitest run src/components/landing`

### T7.4 ☐ Record and encode clips from the real app
- **Kind:** dod
- **Depends on:** T3.20, T7.1
- **Files:** `public/intro/`, `scripts/encode-intro.sh`, `agent_docs/polish-and-landing/p7-video.md`
- **Do:** Record short clips (each <= 12 s) with `agent-browser record start <file>.webm <url>` / `agent-browser record stop` against `https://requestly.localhost/app` (never start the server; `export AGENT_BROWSER_SESSION=requestly`, `--init-script e2e/fixtures/qa-seed.init.js`, `agent-browser close` at the end): dark theme, tightly cropped, seeded demo data only, no emails, real keys or personal collections (FR-41). Encode with ffmpeg to `public/intro/clip-N.webm`, `clip-N.mp4` (<= 400 KB each, 15-24 fps, tuned CRF) and `clip-N.webp` poster (< 100 KB); total <= 2.5 MB (FR-42). Never `/motion-video`, Remotion or a synthetic render. Review a contact sheet of every clip for personal data before keeping it. Reference recipe (read-only): `/Users/deepakdewani1/Documents/Programs/vue/text-to-image/visual-ai/agent_docs/v2-launch/TASKS.md`.
- **Acceptance:**
  - Every WebM and MP4 <= 400 KB, every WebP < 100 KB, total <= 2.5 MB, each clip <= 12 s (AC-39).
  - `p7-video.md` records resolution and `ffprobe` / `ls -l` output.
  - Contact-sheet review found no personal data.
- **Verify:** `find public/intro \( -name "*.webm" -o -name "*.mp4" \) -size +400k` prints nothing; `find public/intro -name "*.webp" -size +99k` prints nothing; `test $(du -sk public/intro | cut -f1) -le 2560 || echo "FAIL: public/intro over 2.5 MB"`; `for f in public/intro/*.mp4 public/intro/*.webm; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); awk -v d="$d" -v f="$f" 'BEGIN{ if (d+0 > 12) print "FAIL: " f " " d "s" }'; done` prints nothing

### T7.5 ☐ Inline clip component (poster-only under reduced motion)
- **Kind:** implementation
- **Depends on:** T7.4, T3.7
- **Files:** `src/components/landing/IntroClip.tsx`
- **Do:** `<video muted autoplay loop playsinline poster>` with WebM then MP4 sources and a theme-appropriate frame around the dark clip; with reduced motion show the poster only (no autoplay) (FR-42). Lazy so it adds no bytes before it is near the viewport.
- **Acceptance:**
  - Autoplaying clips are `muted loop playsinline` (AC-40).
  - Reduced motion renders only the poster.
- **Verify:** `bunx vitest run src/components/landing`

### T7.6 ☐ Watch-the-demo modal
- **Kind:** implementation
- **Depends on:** T7.4, T7.3
- **Files:** `src/components/landing/DemoModal.tsx`, `src/components/landing/DemoVideo.tsx`, `src/components/landing/WatchDemoButton.tsx`, `src/components/landing/relay/RelaySection.tsx`
- **Do:** shadcn Dialog (per `.claude/skills/shadcn-component-rules/SKILL.md`), lazy-loaded with `next/dynamic` so only the poster is requested before opening; focus trap, Esc closes, focus returns to the button, video pauses on close; the button sits in the Relay section (FR-40, FR-43). Build against a placeholder asset if T7.4 clips are not final.
- **Acceptance:**
  - No `.webm`/`.mp4` request before the click (AC-40).
  - Esc closes, focus returns, video pauses on close.
- **Verify:** `bunx vitest run src/components/landing`

### T7.7 ☐ Motionsites skill evaluation
- **Kind:** dod
- **Depends on:** T7.1
- **Files:** `agent_docs/polish-and-landing/p7-motionsites-decision.md`
- **Do:** Read https://github.com/Motionsites-AI/claude-skill (SKILL.md first; it is third-party, verify before trusting), try it on one section, and document the decision to use or skip it and why (FR-44).
- **Acceptance:** Decision file states use/skip with evidence.
- **Verify:** `grep -ciE "use|skip" agent_docs/polish-and-landing/p7-motionsites-decision.md`

### T7.8 ☐ Section pass: FeatureShowcase and HowItWorks
- **Kind:** implementation
- **Depends on:** T5.5, T7.7
- **Files:** `src/components/landing/FeatureShowcase.tsx`, `src/components/landing/FeatureShowcase.spec.tsx`, `src/components/landing/HowItWorks.tsx`, `src/components/landing/HowItWorks.spec.tsx`
- **Do:** UI/UX/motion and copy pass with the copywriting, copy-editing and impeccable skills (FR-44). No unsubstantiated superlatives, no AI vendor names, numbers trace to P5 sources, `prefers-reduced-motion` respected. Update the existing specs.
- **Acceptance:**
  - Light/dark, 375/768/1440 clean; specs updated and green (AC-46).
  - Copy has no unsourced superlatives (AC-45).
- **Verify:** `bunx vitest run src/components/landing/FeatureShowcase.spec.tsx src/components/landing/HowItWorks.spec.tsx`

### T7.9 ☐ Build the chosen hero
- **Kind:** implementation
- **Depends on:** T6.12, T7.7
- **Files:** `src/components/landing/Hero.tsx`, `src/components/landing/Hero.spec.tsx`, `src/components/landing/ProductVisual.tsx`, `src/components/landing/ProductVisual.spec.tsx`
- **Do:** BLOCKED until the user's pick is in the SPEC Decision Log (T6.12). Productionize exactly the recorded pick into `Hero.tsx`/`ProductVisual.tsx`, reusing the lab's shared primitives; reduced-motion static state; copy pass; add a "Watch the demo" entry if the pick calls for it (FR-38). If the pick needs more than 5 files, split this task into numbered parts before starting.
- **Acceptance:**
  - Hero matches the recorded pick and is production quality (AC-44).
  - Reduced motion shows a meaningful static state.
  - Existing `Hero.spec.tsx` and `ProductVisual.spec.tsx` updated and green (AC-46).
- **Verify:** `bunx vitest run src/components/landing/Hero.spec.tsx src/components/landing/ProductVisual.spec.tsx`

### T7.10 ☐ Retire the hero lab routes
- **Kind:** implementation
- **Depends on:** T7.9
- **Files:** `src/app/hero-lab/` (deletion only), `src/components/hero-lab/` (deletion only), `e2e/qa/polish-and-landing/p6-hero-lab.spec.ts` (deletion only), `e2e/qa/polish-and-landing/p6-concept-a.spec.ts` (deletion only)
- **Do:** Remove the lab routes, their P6 e2e specs and any hero-lab code the chosen hero no longer needs (move reused primitives into `src/components/landing/` first). If the user wants the lab kept, keep it `noindex` and record that in the SPEC (FR-38).
- **Acceptance:**
  - No `/hero-lab` route is reachable (or it stays noindex by user decision).
  - No dead imports.
- **Verify:** `ls src/app/hero-lab 2>&1`; `grep -rn "hero-lab" src e2e`

### T7.11 ☐ Section pass: BeyondSend and ImportSection
- **Kind:** implementation
- **Depends on:** T5.5, T7.7, T7.5
- **Files:** `src/components/landing/BeyondSend.tsx`, `src/components/landing/BeyondSend.spec.tsx`, `src/components/landing/ImportSection.tsx`, `src/components/landing/ImportSection.spec.tsx`
- **Do:** Same pass as T7.8; place an `IntroClip` where a real-app clip strengthens the section (FR-44).
- **Acceptance:**
  - Light/dark, 375/768/1440 clean; specs updated and green (AC-46); copy passes AC-45.
- **Verify:** `bunx vitest run src/components/landing/BeyondSend.spec.tsx src/components/landing/ImportSection.spec.tsx`

### T7.12 ☐ Section pass: FinalCta and AllFeaturesPage
- **Kind:** implementation
- **Depends on:** T7.7
- **Files:** `src/components/landing/FinalCta.tsx`, `src/components/landing/AllFeaturesPage.tsx`, `src/app/features/page.tsx`
- **Do:** Same pass as T7.8 for the final call to action and the all-features page (FR-44); consider new sections or animations only where justified.
- **Acceptance:**
  - Light/dark, 375/768/1440 clean (AC-44); copy passes AC-45.
- **Verify:** `bunx vitest run src/components/landing`

### T7.13 ☐ ComparisonTable visual pass
- **Kind:** implementation
- **Depends on:** T5.5, T7.1
- **Files:** `src/components/landing/ComparisonTable.tsx`, `src/components/landing/ComparisonTable.spec.tsx`
- **Do:** Restyle after the P5 data is final: light/dark, 375px contained scroll, source links stay keyboard reachable (FR-44).
- **Acceptance:**
  - Visual pass done without changing any sourced claim; spec green (AC-46).
- **Verify:** `bunx vitest run src/components/landing/ComparisonTable.spec.tsx`

### T7.14 ☐ Header: remove Docs, mobile menu, skip link
- **Kind:** implementation
- **Depends on:** T7.1
- **Files:** `src/components/landing/Nav.tsx`, `src/components/landing/ThemeToggle.tsx`, `src/components/landing/LandingPage.tsx`
- **Do:** Remove the Docs link from the header only (the footer Docs link via `DOCS_URL` stays). Improve the mobile menu, active/hover states, theme toggle and add a skip link, and give header copy the copywriting pass (AC-45 rules) (FR-45). Sequence this before T7.15; do not edit `Nav.tsx` and `Footer.tsx` in parallel.
- **Acceptance:**
  - `grep -in docs src/components/landing/Nav.tsx` shows no link targets or labels (AC-42).
  - Skip link and mobile menu keyboard accessible.
- **Verify:** `grep -in docs src/components/landing/Nav.tsx`; `bunx vitest run src/components/landing`

### T7.15 ☐ Footer: layout and Privacy/Terms links
- **Kind:** implementation
- **Depends on:** T7.14
- **Files:** `src/components/landing/Footer.tsx`, `src/components/landing/constants.ts`
- **Do:** Improve footer layout and add Privacy (`/privacy`) and Terms (`/terms`) links via named route constants; keep the footer Docs link (`DOCS_URL`); give footer copy the copywriting pass (AC-45 rules) (FR-45, FR-46).
- **Acceptance:**
  - Footer links Privacy and Terms; Docs link retained (AC-42).
- **Verify:** `grep -nE "privacy|terms|DOCS_URL" src/components/landing/Footer.tsx`; `bunx vitest run src/components/landing`

### T7.16 ☐ Legal data-flow verification and checklist draft
- **Kind:** dod
- **Depends on:** T7.1
- **Files:** `agent_docs/polish-and-landing/legal-checklist.md`
- **Do:** Use find-skills / skills.sh to look for a privacy/terms skill; if none fits, draft manually. Verify ACTUAL data flows against code at write time: local-first storage (no accounts), `/api/proxy`, `/api/ai` and `/api/relay` (third-party AI providers, no vendor names in UI copy), `/api/share` (share links stored server-side), `/api/hub`; grep for analytics/tracking and record the evidence (none expected) (FR-47). Draft `legal-checklist.md` mapping every statement to a code location.
- **Acceptance:**
  - Every planned statement has a code location; analytics grep evidence recorded.
- **Verify:** `grep -cE "src/" agent_docs/polish-and-landing/legal-checklist.md`; `grep -rniE "gtag|google-analytics|plausible|posthog|mixpanel|segment" src package.json`

### T7.17 ☐ Privacy page
- **Kind:** implementation
- **Depends on:** T7.16
- **Files:** `src/app/privacy/page.tsx`, `src/components/legal/LegalLayout.tsx`, `src/components/legal/constants.ts`
- **Do:** Static server components with `metadata` (title, description, canonical, OG; indexable) (FR-46, FR-48). Operator text exactly: Deepak Dewani, an individual developer (no company); governing law India; contact deepakkumardewani@gmail.com (constants in one place). Visible effective date and "not legal advice, review before relying on it" note. Plain-language data-flow section naming local-first storage, server proxying (`/api/proxy`), third-party AI providers (no vendor names), share links (`/api/share`) and hub (`/api/hub`), plus retention, user controls (clear data) and contact (FR-47). No sitemap exists in `src/app`; do not add one.
- **Acceptance:**
  - `/privacy` renders all required items (AC-43) and uses the same operator constants as Terms.
  - Page is indexable (no `noindex`).
- **Verify:** `grep -rn "noindex" src/app/privacy`; `bunx vitest run src/components/legal`

### T7.18 ☐ Terms page and final checklist
- **Kind:** implementation
- **Depends on:** T7.17
- **Files:** `src/app/terms/page.tsx`, `src/components/legal/LegalLayout.tsx`, `agent_docs/polish-and-landing/legal-checklist.md`
- **Do:** Terms & Conditions page using the shared layout and operator constants, with metadata, effective date, not-legal-advice note and a data-flow summary consistent with Privacy (FR-46, FR-48). Update `legal-checklist.md` so every statement on both pages maps to a code location.
- **Acceptance:**
  - `/terms` contains operator, India governing law, contact, effective date and the note (AC-43).
  - Checklist has no unmapped statement.
- **Verify:** `grep -c "src/" agent_docs/polish-and-landing/legal-checklist.md`; `bunx vitest run src/components/legal`

### T7.19 ☐ Unit: Relay demo engine and hook
- **Kind:** unit
- **Depends on:** T7.2, T7.3
- **Files:** `src/components/landing/relay/scenarios.ts`, `src/components/landing/relay/relayDemoEngine.ts`, `src/components/landing/relay/useRelayDemo.ts`
- **Do:** Cover scenario loop (>= 3), typing/stream progression, start-on-view, pause when off-screen (mocked IntersectionObserver) and when the tab is hidden, no timers while paused, and the reduced-motion static final frame (AC-38).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing/relay --coverage --coverage.include=src/components/landing/relay/scenarios.ts,src/components/landing/relay/relayDemoEngine.ts,src/components/landing/relay/useRelayDemo.ts --coverage.reporter=text`

### T7.20 ☐ Unit: demo modal and clips
- **Kind:** unit
- **Depends on:** T7.5, T7.6
- **Files:** `src/components/landing/DemoModal.tsx`, `src/components/landing/DemoVideo.tsx`, `src/components/landing/WatchDemoButton.tsx`, `src/components/landing/IntroClip.tsx`
- **Do:** Cover open/close, Esc, focus return, pause on close, no video source mounted before open, and poster-only under reduced motion (AC-40).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing --coverage --coverage.include=src/components/landing/DemoModal.tsx,src/components/landing/DemoVideo.tsx,src/components/landing/WatchDemoButton.tsx,src/components/landing/IntroClip.tsx --coverage.reporter=text`

### T7.21 ☐ Unit: header, footer and legal content
- **Kind:** unit
- **Depends on:** T7.15, T7.18
- **Files:** `src/components/landing/Nav.tsx`, `src/components/landing/Footer.tsx`, `src/components/legal/LegalLayout.tsx`, `src/components/legal/constants.ts`
- **Do:** Cover no Docs link in the header, Privacy/Terms and Docs in the footer, legal layout rendering operator name, India governing law, contact, effective date and the not-legal-advice note, and the data-flow terms (AC-42, AC-43).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing src/components/legal --coverage --coverage.include=src/components/landing/Nav.tsx,src/components/landing/Footer.tsx,src/components/legal/LegalLayout.tsx,src/components/legal/constants.ts --coverage.reporter=text`

### T7.22 ☐ E2E: Relay section demo
- **Kind:** e2e
- **Depends on:** T7.19
- **Scenarios:**
  - `@critical` scrolling to the Relay section starts the demo and it cycles at least 3 scenarios (AC-38)
  - `@critical` scrolling away pauses it and it does not advance while hidden (AC-38)
  - `@high` with reduced motion emulated the section shows a static final frame and never animates (AC-38)
  - `@medium` the section renders in light and dark with no horizontal scroll at 375px
- **Spec:** `e2e/qa/polish-and-landing/p7-relay-demo.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-relay-demo.spec.ts --repeat-each=3`

### T7.23 ☐ E2E: Watch-the-demo modal and video loading
- **Kind:** e2e
- **Depends on:** T7.20
- **Scenarios:**
  - `@critical` on initial load (no scrolling) no `.webm`/`.mp4` request happens; only posters load; the modal video loads only after the Watch-demo click (AC-40)
  - `@high` an inline `IntroClip` video is requested only once it is scrolled near the viewport
  - `@critical` clicking opens a dialog that traps focus; Esc closes it and focus returns to the button
  - `@high` closing pauses the video
  - `@high` with reduced motion inline clips show posters only
- **Spec:** `e2e/qa/polish-and-landing/p7-demo-modal.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-demo-modal.spec.ts --repeat-each=3`

### T7.24 ☐ E2E: header, footer and legal pages
- **Kind:** e2e
- **Depends on:** T7.21
- **Scenarios:**
  - `@critical` header has no Docs link; footer still has Docs (AC-42)
  - `@critical` footer Privacy and Terms links navigate to `/privacy` and `/terms` and respond 200 (AC-42)
  - `@high` each legal page shows operator, India, contact email, effective date, the not-legal-advice note and the data-flow terms (AC-43)
  - `@high` each legal page has title, description, canonical and OG tags and no `noindex` (FR-48)
- **Spec:** `e2e/qa/polish-and-landing/p7-nav-legal.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-nav-legal.spec.ts --repeat-each=3`

### T7.25 ☐ E2E: landing sections layout, motion and accessibility
- **Kind:** e2e
- **Depends on:** T7.8, T7.9, T7.10, T7.11, T7.12, T7.13, T7.21
- **Scenarios:**
  - `@critical` every landing section at 375, 768 and 1440 has no horizontal scroll, in light and dark (AC-44)
  - `@critical` axe reports zero serious/critical violations on `/`, `/features`, `/privacy`, `/terms` (AC-44)
  - `@high` with reduced motion on and off every section renders; screenshots saved to `agent_docs/polish-and-landing/qa/p7/` (AC-44)
  - `@medium` no AI vendor names appear in landing copy (AC-45)
- **Spec:** `e2e/qa/polish-and-landing/p7-landing-qa.spec.ts`
- **Files:** none expected
- **Acceptance:** Every scenario passes 3 of 3 repeats; screenshots exist for the full matrix.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-landing-qa.spec.ts --repeat-each=3`; `ls agent_docs/polish-and-landing/qa/p7`

### T7.26 ☐ Gate: P7 build, performance, typecheck, lint, suites
- **Kind:** gate
- **Depends on:** T7.22, T7.23, T7.24, T7.25
- **Files:** none
- **Do:** One `bun run typecheck` and `bun run lint:check`; every landing vitest spec; the isolated prod preview (Conventions; never the dev server's `.next`) with Lighthouse mobile on `http://localhost:3100/` saved to `agent_docs/polish-and-landing/qa/p7/lighthouse.json`, then kill the preview; record first-load JS for `/` from the build output in `p7-baseline.md` under "After" and compare to the baseline (growth > 60 KB gzipped needs lazy-loading or a written justification there); check `public/intro` budgets.
- **Acceptance:**
  - Typecheck and lint clean; `E2E_DIST_DIR=.next-e2e bun run build` succeeds.
  - Lighthouse mobile: Performance >= 85, Accessibility >= 95, CLS < 0.1, LCP < 2.5 s (AC-40).
  - `p7-baseline.md` has an "After" first-load JS value and the delta; growth > 60 KB gzipped carries a written justification (AC-41).
  - `public/intro` totals <= 2.5 MB (AC-39); landing specs green (AC-46).
- **Verify:** `bun run typecheck`; `bun run lint:check`; `bunx vitest run src/components/landing src/components/legal`; the isolated prod preview steps and `bunx lighthouse http://localhost:3100/ --form-factor=mobile --screenEmulation.mobile --only-categories=performance,accessibility --output=json --output-path=agent_docs/polish-and-landing/qa/p7/lighthouse.json --quiet --chrome-flags="--headless=new"`, then `kill <PID>`; `bun -e 'const r=await Bun.file("agent_docs/polish-and-landing/qa/p7/lighthouse.json").json();const c=r.categories,a=r.audits;const v={perf:c.performance.score,a11y:c.accessibility.score,cls:a["cumulative-layout-shift"].numericValue,lcp:a["largest-contentful-paint"].numericValue};console.log(v);if(v.perf<0.85||v.a11y<0.95||v.cls>=0.1||v.lcp>=2500){console.log("FAIL: Lighthouse budget");process.exit(1)}'`; `grep -niE "after|delta" agent_docs/polish-and-landing/p7-baseline.md`; `test $(du -sk public/intro | cut -f1) -le 2560 || echo "FAIL: public/intro over 2.5 MB"`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-relay-demo.spec.ts e2e/qa/polish-and-landing/p7-demo-modal.spec.ts e2e/qa/polish-and-landing/p7-nav-legal.spec.ts e2e/qa/polish-and-landing/p7-landing-qa.spec.ts --repeat-each=2`

### T7.27 ☐ Walkthrough: all polish-and-landing flows end to end
- **Kind:** walkthrough
- **Depends on:** T7.26
- **Files:** `e2e/qa/polish-and-landing/polish-and-landing.spec.ts`, `agent_docs/polish-and-landing/qa/walkthrough/`
- **Do:** Write the combined Objective spec, one `test()` per flow, tagged `@qa`: "+" tooltip Ctrl+T and logo to `/`; Relay icon tooltip and Open in Relay icon-only in the URL bar; empty state; health indicator cursor; 148-request collection expands instantly and the grouped "+" menu; no Language tab and `#language` lands on General; Shortcuts two-column layout; the new settings (ask-before-closing, reduced motion) and the distinct clear-history scopes; comparison table sources; chosen hero renders; Relay demo loops; Watch-demo modal; header without Docs and footer legal pages with their operator, India, contact and data-flow content. Capture proof screenshots via `snap()` into `qa/walkthrough/`.
- **Acceptance:** All flows pass with `--repeat-each=2`; screenshots reviewed with no personal data.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/polish-and-landing.spec.ts --repeat-each=2`; plus the T7.26 suite commands as evidence

### T7.28 ☐ DoD: summary and items needing the user
- **Kind:** dod
- **Depends on:** T7.27
- **Files:** none
- **Do:** Produce the "Implementation Summary" with Verification Steps in the format required by CLAUDE.md. Flag for the user: legal text must be reviewed by them (not legal advice); the `diagram-design` skill appearing in a fresh session; any decisions taken (hero pick, Motionsites use/skip, Global tab, Clear-history scope).
- **Acceptance:** All AC items in SPEC.md pass; summary produced with browser verification steps; user-review items listed.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/polish-and-landing.spec.ts --repeat-each=2` green; T7.26 commands green

🔶 **Checkpoint 7**: chosen hero shipped, Relay demo and video modal live, header without Docs, `/privacy` and `/terms` return 200 and are linked from the footer, `public/intro` within budget, Lighthouse and JS budgets met, `E2E_DIST_DIR=.next-e2e bun run build` succeeds; AC-38..46 pass and the verifier gives PASS.

---

## Traceability: every SPEC FR maps to at least one task

| FR | Tasks | FR | Tasks |
|---|---|---|---|
| FR-01 | T1.1, T1.2 | FR-25 | T4.2 |
| FR-02 | T1.3 | FR-26 | T4.3 |
| FR-03 | T1.12 | FR-27 | T4.4, T4.5 |
| FR-04 | T1.1, T1.4, T1.5, T1.6 | FR-28 | T4.2, T4.3, T4.6 |
| FR-05 | T1.7 | FR-29 | T5.1, T5.2, T5.3 |
| FR-06 | T1.8 | FR-30 | T5.4 |
| FR-07 | T1.9, T1.10, T1.11 | FR-31 | T5.5, T7.13 |
| FR-08 | T1.9, T1.10, T1.11 | FR-32 | T5.6 |
| FR-09 | T1.9, T3.12 | FR-33 | T6.2, T6.3 |
| FR-10 | T2.1 | FR-34 | T6.4 |
| FR-11 | T2.2 | FR-35 | T6.5 |
| FR-12 | T2.3 | FR-36 | T6.1, T6.10 |
| FR-13 | T2.4 | FR-37 | T6.12 |
| FR-14 | T2.5 | FR-38 | T7.9, T7.10 |
| FR-15 | T2.2 | FR-39 | T7.2, T7.3 |
| FR-16 | T3.1 | FR-40 | T7.6 |
| FR-17 | T3.2, T3.3 | FR-41 | T7.4 |
| FR-18 | T3.4 | FR-42 | T7.4, T7.5 |
| FR-19 | T3.5 | FR-43 | T7.6 |
| FR-20 | T3.9 | FR-44 | T7.7, T7.8, T7.9, T7.11, T7.12, T7.13 |
| FR-21 | T3.6, T3.7, T3.8 | FR-45 | T7.14, T7.15 |
| FR-22 | T3.10, T3.11 | FR-46 | T7.15, T7.16, T7.17, T7.18 |
| FR-23 | T3.12 | FR-47 | T7.16, T7.17, T7.18 |
| FR-24 | T4.1 | FR-48 | T7.17, T7.18 |
