# Tasks: Relay Improvements (Polish, Context, Tools, Rich Replies)

Inputs: `SPEC.md` Draft v1 and `PLAN.md` (this folder), extending `agent_docs/relay-agent/{SPEC,PLAN,TASKS}.md`. Planning artifact only; no feature code is written by this document. Commands: `bun`/`bunx` only, never `npm`. Never start the server (running on :3000). Commits: only the /build-phases orchestrator, after verifier PASS, one commit per phase (pushes feature/ai-agent). The user has confirmed this. Never run the full e2e suite: only the specs named in a task. Env prefix on every Playwright command: `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000`; it disables the Playwright `webServer` block so nothing runs `bun run build` over the dev server, and it also means the Socket.IO echo on :3333 is not auto-started, so only specs that connect to it start it first, with ECHO_START (see Decisions). Compile check: every implementation task runs `bun run typecheck` (phase-builder does this after each implementation task); the full-gate `bunx tsc --noEmit` run together with the whole vitest/e2e/lint sweep is P12.10, re-confirmed by the DoD P12.12. Per-task lint is `bunx biome check <files>`; full lint (`bun run lint:check`) runs at phase gates.

Conventions follow `agent_docs/relay-agent/TASKS.md`: Gherkin-first (`e2e/scenarios/relay/relay-improvements-<area>.feature.md`, one scenario per ID `REL-<AREA>-nn`, `bash e2e/scenarios/relay/check-ids.sh` parity with `e2e/qa/relay/relay-improvements-<area>.spec.ts`), every e2e task has a **Gherkin** field, tests are tagged `@qa`, use `seededPage`, hermetic `e2e/fixtures/relayRoutes.ts` mocks (no real provider), no `waitForTimeout`, `getByTestId` first. Browser evidence comes only from the seeded QA specs; `agent-browser` is never used as evidence (it may be used for exploratory visual checks during implementation only). No tests under `src/components/reactbits/`.

- Seed data stays small (<~500 records per scenario need). A scale scenario needs only cap+1 matching items and should reuse existing large collections such as `qa-e2e-relayimp-col-500`. Never commit generated bulk data to `seed/*.json`. If a later phase (P4 bulk delete, P9 history) truly needs more, extend `seedQaData` with an optional `bulk` option exposed through `seededPage` (`test.use`), in the same single init script; do not add a second init script.

Test ownership: implementation tasks write no new specs; they keep existing specs green (`bunx biome check` on their files plus the existing specs of touched files). P12.3 is the one implementation task whose Files are specs: it only extends existing guard/parity specs (no new spec files, no source file under test, so no coverage target). Each phase then has `Unit:` tasks (kind `unit`, unit-test-engineer, at most 5 logic files each) that write the specs and prove >= 80% lines/branches/functions/statements per file (target > 95%) plus the `vitest.config.ts` thresholds with `bunx vitest run <specs> --coverage --coverage.include=<src> --coverage.reporter=text` (the default include covers only lib/stores/hooks/api, so component files are passed explicitly; `src/lib/historyExport.ts` is excluded from coverage and never listed). Component specs start with `// @vitest-environment happy-dom`. Then `E2E:` tasks (kind `e2e`, e2e-engineer, one flow each) name their `Spec:` and `Scenarios:`; every scenario title starts with `[REL-…]` and carries one of `@critical`, `@high`, `@medium` via Playwright's `tag` option. IDs REL-ICTX-nn and REL-IA11Y-nn are used because REL-CTX and REL-A11Y already exist in `relay-chat.feature.md` and `relay-a11y.feature.md` (`check-ids.sh` needs unique ids).

Path legend: (new) marks a file that the citing task itself creates; (generated) marks a file rebuilt by a script (`bun run qa:seed:build`), never hand-edited. Every other cited path either existed when this file was written (checked with `ls`/`grep`) or is created by an earlier task (for example Unit P1.4 cites `src/lib/relay/activity.ts`, created by P1.2). Unit tasks list the source files under test in Files and name the specs they create, marked (new), in Do.

Build and compile checks: never run `bun run build` (`next build`) in the repo: it rebuilds `.next` under the always-running dev server. The only builds are P0.1 and P12.4, inside a scratch copy (see Decisions). For compile checks use `bun run typecheck` (`tsc --noEmit`, the same command as `bunx tsc --noEmit`): phase-builder runs it after every implementation task, and P12.10 is the full-gate run.

**Hard constraint (NFR-3): no vendor/provider/model name appears in any user-visible string** (speech note, errors, tooltips, labels, fixtures). Every UI-facing task carries this as an acceptance bullet; every gate runs BRAND_GREP; `src/lib/relay/brandGuard.spec.ts` is extended in P12.3.

**Decisions recorded in this document**
- BRAND_GREP: one canonical command, written out in full in every Verify step that uses it (tagged `(BRAND_GREP)` so it can be found), so a verifier can run the line as-is. It exits 0 only when there is no output. It uses `test -z "$(…)"` rather than `! grep …` on purpose: several listed paths do not exist until later phases (`src/lib/history`, `useRelayPickerItems.ts`, `useSpeechDictation.ts`, `speechStub.ts`, the seed JSON), and grep exits 2 when a path is missing even if it found a match, so `! grep` would falsely pass. The banned words mirror `BANNED_TOKENS` in `src/lib/relay/server/bannedTokens.ts` (`RELAY_MODEL_ID` is covered by `deepseek`). Scope rules match the relay-agent BRAND_GREP: only `src/lib/relay/server/**` and specs are excluded. Command:
  `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`
- Ask-first items (SPEC section 7) are flagged **NEEDS USER SIGN-OFF** and are each preceded by an explicit `gate` task whose Do step is to ask the user with AskUserQuestion; the dependent task must not start until the answer is recorded in the gate's Log. The /build-phases orchestrator runs these sign-off gates itself (phase-builder cannot call AskUserQuestion). Stages follow file order, and each sign-off gate sits before its dependents in its phase (P5.1 before P5.2, P7.1 before P7.2, P12.1 before P12.8 and P12.10), so the answer is recorded before any dependent runs. The same file-order staging applies to ordinary implementation dependencies, for example P12.3 (brand guard and parity spec sweep) runs before P12.4 (final bundle comparison), which depends on it. Each sign-off gate also snapshots a `git status … | shasum` hash into its Log for audit; its Verify checks only the Log line format, not the live hash, because the verifier runs after the whole phase when those paths have legitimately changed. Items: (1) persisted tab shape `draft`/`eventName` (P5.1); (2) new dependency for highlighter grammars, only if installed CodeMirror grammars are insufficient (P7.1); (3) new dependency `@axe-core/playwright` for the AC-25 axe check (P12.1). `@tanstack/react-virtual`, `cmdk` and `codemirror` are already in `package.json`, so the picker (P3) needs no sign-off. The `useRelayStore` persisted shape and the IndexedDB schema are deliberately not touched: new attachment/picker/voice state lives in a non-persisted slice (PLAN section 2C), and Unit P2.6 asserts the persisted payload is byte-for-byte unchanged.
- ECHO_START (Socket.IO echo on :3333): `scripts/run-socketio-echo.sh`, referenced by `playwright.config.ts` and `e2e/socketio.spec.ts`, is absent from the working tree (`scripts/` is gitignored and the file was removed from git in commit 96a6780). Restore it locally (untracked, ignored, nothing to commit), start it in the background only when nothing listens on :3333, store the pid of a server started here in `scripts/.socketio-echo.pid` (ignored with `scripts/`), then wait up to 120 s (the first run does an `npm install`) for the port to accept connections; the final `nc -z` makes the command exit non-zero if it never came up. `nc` ships with macOS (`/usr/bin/nc`). Command:
  `nc -z 127.0.0.1 3333 || { test -f scripts/run-socketio-echo.sh || git show 96a6780^:scripts/run-socketio-echo.sh > scripts/run-socketio-echo.sh; bash scripts/run-socketio-echo.sh > /dev/null 2>&1 & echo $! > scripts/.socketio-echo.pid; }; for i in $(seq 120); do nc -z 127.0.0.1 3333 && break; sleep 1; done; nc -z 127.0.0.1 3333`
  ECHO_STOP: whichever task ran ECHO_START stops it after its specs (P5.11 does so as its last step). It only stops a server that ECHO_START itself started (no pid file means an already-running echo, which is left alone); killing the `node` child lets the wrapper exit and remove its temp dir: `test ! -f scripts/.socketio-echo.pid || { pkill -P "$(cat scripts/.socketio-echo.pid)"; rm -f scripts/.socketio-echo.pid; }`. Its internal `npm install socket.io@4` runs in a `mktemp -d` directory outside the repo, so it is the one accepted exception to the bun-only rule.
- Breadcrumb key location (PLAN open item 3): `breadcrumbHome` currently exists only in `messages/*/chain.json`. Decision: add it to `messages/{en,fr,ja}/navigation.json` and have the three pages call `useTranslations("navigation")`, leaving the chain page untouched.
- Privacy-note "seen" flag (PLAN open item 4): per-session component state, no storage and no schema change.
- Bundle baseline (NFR-5, AC-24): `next build` would clobber the `.next` directory used by the running dev server, so builds run in a scratch copy (P0.1 for the baseline from `git archive HEAD`, P12.4 for the final from an `rsync` of the working tree, both with `node_modules` symlinked), never in the repo root.
- HAR/JSON export reuses the existing `src/lib/historyExport.ts` (`exportHistoryAsJSON`, `downloadFile`, `buildExportFilename`) instead of duplicating it; the new `src/lib/history/` holds only HAR, clear, and the single `exportHistory` facade shared by the menu and the tools (FR-153). The existing CSV export item is kept in the new menu so nothing regresses.

Legend: ☐ todo (flip to ✅ in the implementation loop). Kinds: implementation | unit | e2e | gate | walkthrough | dod. Order inside a phase: implementation -> Unit -> E2E -> checkpoint. Each phase ends with a checkpoint gate. At most 5 files per task. Message files (en/fr/ja) are their own task per phase so i18n parity stays green.


## Phase 0: Quick wins and baseline

**Adds:** Fixes small layout problems in Relay: the Home breadcrumb on the transform, JSON compare and JSON visualize pages, an opaque Jump-to-latest pill, a composer where Send sits on the same row as the text box, and a footer that always shows. Also records the bundle-size baseline used later.

**Try in UI:** Open /transform, /json-compare and /json-visualize and click Home in the breadcrumb (goes to /app) ; Open Relay with a long thread and check the Jump-to-latest pill is solid with a border and shadow ; Resize the panel to 320px and confirm Send stays right of the text box on one row ; Check the footer is always visible and onboarding mentions it once

Breadcrumb, jump pill, inline composer row, footer, bundle baseline

### ✅ P0.1 Record the bundle baseline in a scratch copy
- **Kind**: implementation
- **Files** (1): `agent_docs/relay-improvements/BUNDLE.md` (new)
- **Depends on**: none
- **Do**: From the repo root run `git archive HEAD | tar -x -C <scratchpad>/baseline`, symlink `node_modules` and any env files needed to build, run `bun run build` inside the scratch copy only (never at the repo root: it would clobber the dev server's `.next`), and copy the route-size table plus first-load JS of the Relay chunk into `BUNDLE.md` under a "Baseline" heading.
- **Acceptance**:
  - `BUNDLE.md` records per-route first-load JS and the main shared chunk size before any change (NFR-5, AC-24).
  - Repo root `.next` and `package.json` are untouched.
- **Verify**:
  - `grep -c "Baseline" agent_docs/relay-improvements/BUNDLE.md`  (expect >= 1)
  - `git diff --stat -- src messages e2e package.json`  (expect empty)

### ✅ P0.2 Breadcrumb i18n keys
- **Kind**: implementation
- **Files** (3): `messages/en/navigation.json`; `messages/fr/navigation.json`; `messages/ja/navigation.json`
- **Depends on**: P0.1
- **Do**: Add `breadcrumbHome` ("Home", fr "Accueil", ja "ホーム") to the `navigation` namespace in all three locales.
- **Acceptance**:
  - Key present in en/fr/ja with identical key sets (FR-160, NFR-9, AC-23).
  - No vendor name in any value (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json`
  - `bunx vitest run src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P0.3 Breadcrumb Home link on transform, json-compare, json-visualize
- **Kind**: implementation
- **Files** (3): `src/app/transform/page.tsx`; `src/app/json-compare/page.tsx`; `src/app/json-visualize/page.tsx`
- **Depends on**: P0.2
- **Do**: Move the module-level `BREADCRUMB_ITEMS` constants inside the components, use `useTranslations("navigation")`, `{ label: t("breadcrumbHome"), href: "/app" }`. The shared breadcrumb spec is written by Unit P0.8.
- **Acceptance**:
  - Home breadcrumb `href` is `/app` and the label comes from `t("breadcrumbHome")` on all three pages (FR-160, AC-14).
  - The page's own trailing crumb and `<h1>` are unchanged.
- **Verify**:
  - `bunx biome check src/app/transform/page.tsx src/app/json-compare/page.tsx src/app/json-visualize/page.tsx`
  - `bunx vitest run src/components/layout`

### ✅ P0.4 Jump-to-latest pill restyle
- **Kind**: implementation
- **Files** (2): `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayConversation.spec.tsx`
- **Depends on**: P0.1
- **Do**: Give the `relay-jump-latest` control (around line 355) an opaque themed background (`bg-popover`), border, shadow and a `z-20` so it sits above messages in its own bottom gutter of the scroll container; add bottom padding to the list so the last message is never covered.
- **Acceptance**:
  - Pill has opaque background, border, shadow, z-index above messages and is anchored above the composer (FR-110, AC-02).
  - Existing jump behaviour and `aria-label` are unchanged.
- **Verify**:
  - `bunx biome check src/components/relay/RelayConversation.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`

### ✅ P0.5 Inline composer row
- **Kind**: implementation
- **Files** (2): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`
- **Depends on**: P0.1
- **Do**: Lay the composer out as a single flex row `[leading slot] [textarea, min-w-0] [trailing slot] [send]`, with the send button inline on the right, same row as the textfield. Leading and trailing slots are empty containers with test ids now so P3 ("+") and P10 (mic) fill them without relayout. Controls keep at least 36px hit targets and accessible names.
- **Acceptance**:
  - Send button shares a row with the textfield and sits on its right at 320px, 400px and mobile sheet widths (FR-111, AC-03).
  - Touch targets >= 36px, icon buttons have accessible names (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx`

### ✅ P0.6 Footer and onboarding strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P0.1
- **Do**: Add `composerFooter` ("Relay is AI and can make mistakes. Check important changes.") and one onboarding sentence key (appended to an existing step's copy, not a new step) in all three locales.
- **Acceptance**:
  - Keys present with identical key sets across locales (FR-112, NFR-9, AC-23).
  - No vendor/model name in the new strings (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P0.7 Footer under the composer and onboarding mention
- **Kind**: implementation
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/RelayOnboarding.tsx`; `src/components/relay/RelayOnboarding.spec.tsx`
- **Depends on**: P0.5, P0.6
- **Do**: Render a persistent, non-dismissible muted footer line under the composer row (`data-testid="relay-footer"`). Add the one-line mention to an existing onboarding step, with no new step.
- **Acceptance**:
  - Footer is always rendered under the composer and has no dismiss control (FR-112, AC-04).
  - Onboarding keeps its step count and shows the mention exactly once (FR-112, AC-04).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayOnboarding.tsx src/components/relay/RelayOnboarding.spec.tsx`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayOnboarding.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P0.8 Unit: breadcrumb pages
- **Kind**: unit
- **Files** (3): `src/app/transform/page.tsx`; `src/app/json-compare/page.tsx`; `src/app/json-visualize/page.tsx`
- **Depends on**: P0.3
- **Do**: unit-test-engineer writes `src/app/breadcrumbHome.spec.tsx` (new, `// @vitest-environment happy-dom`): one shared spec mocks `AppBreadcrumb` and the heavy child components and asserts the items each of the three pages passes. Report source bugs instead of weakening tests.
- **Acceptance**:
  - For all three pages the Home item is `{ label: t("breadcrumbHome"), href: "/app" }`; the page's trailing crumb and `<h1>` are unchanged (FR-160, AC-14).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/app/breadcrumbHome.spec.tsx --coverage --coverage.include=src/app/transform/page.tsx --coverage.include=src/app/json-compare/page.tsx --coverage.include=src/app/json-visualize/page.tsx --coverage.reporter=text`

### ✅ P0.9 Unit: composer row, jump pill, onboarding
- **Kind**: unit
- **Files** (3): `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayOnboarding.tsx`
- **Depends on**: P0.4, P0.7
- **Do**: unit-test-engineer extends `RelayConversation.spec.tsx`, `RelayComposer.spec.tsx` and `RelayOnboarding.spec.tsx` (adding the happy-dom header if missing). Report source bugs instead of weakening tests.
- **Acceptance**:
  - Jump pill carries the opaque background, border, shadow and `z-20` classes; jump behaviour and `aria-label` unchanged (FR-110, AC-02).
  - Composer renders leading slot, textarea, trailing slot and send in one row in that order; buttons have accessible names and >= 36px targets (FR-111, NFR-8).
  - Footer is always rendered with no dismiss control; onboarding keeps its step count and shows the mention exactly once (FR-112, AC-04).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayOnboarding.spec.tsx --coverage --coverage.include=src/components/relay/RelayConversation.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/RelayOnboarding.tsx --coverage.reporter=text`

### ✅ P0.10 E2E: layout fixes and breadcrumb
- **Kind**: e2e
- **Files** (0): none (no app or fixture change)
- **Depends on**: P0.8, P0.9
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-layout.feature.md`: REL-LAYOUT-01..05
- **Spec**: `e2e/qa/relay/relay-improvements-layout.spec.ts`
- **Scenarios**:
  - `[REL-LAYOUT-01] jump pill is opaque with border and shadow in light and dark` @high (AC-02)
  - `[REL-LAYOUT-02] send sits in the textarea row on its right at 320px, 400px and mobile sheet width` @critical (AC-03, send part)
  - `[REL-LAYOUT-03] footer stays visible and onboarding mentions it once` @high (AC-04)
  - `[REL-LAYOUT-04] Home breadcrumb on /transform, /json-compare, /json-visualize links to /app` @high (AC-14)
  - `[REL-LAYOUT-05] after a reload with a long thread the composer row and footer are unchanged` @medium (persistence)
- **Do**: 01 checks computed opaque background (alpha 1), non-zero border and box-shadow, and that `document.elementFromPoint` at the pill centre returns the pill; 02 compares bounding boxes ("+" and mic positions are asserted in REL-IA11Y-05 once they exist); 04 deep-links straight to each page. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-02, AC-03 (send part), AC-04, AC-14, FR-110, FR-111, FR-112, FR-160.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P0.11 Checkpoint 0
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P0.1, P0.2, P0.3, P0.4, P0.5, P0.6, P0.7, P0.8, P0.9, P0.10
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.
- **Acceptance**:
  - All commands below exit 0; the layout spec is flake-free at `--repeat-each=2`.
  - Existing Relay specs still green (no regression).
- **Verify**:
  - `bunx vitest run src/components/relay src/app src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 0**: all Phase 0 tasks ✅, Verify commands green, no regression in earlier Relay specs.


## Phase 1: Loading and status feedback

**Adds:** Relay now shows a shimmering "Thinking…" line while it works and then names the live step (for example the tool it is running) before the answer appears. With reduced motion on, the text and dot stay but nothing animates.

**Try in UI:** Send a message in Relay and watch Thinking… change to a named tool step, then the answer ; Turn on reduced motion in the OS and send again: no animation, text and dot still show ; Screen reader check: the indicator is a polite live region

Thinking shimmer, live tool steps, reduced motion

### ✅ P1.1 Step-label strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P0.11
- **Do**: Add `activity.thinking`, `activity.generic` ("Working…") and one key per tool name: every tool registered today plus every new tool named in the SPEC (`close_tab`, `close_all_tabs`, `delete_requests`, `delete_requests_in_collection`, `create_graphql_request`, `create_websocket_request`, `create_socketio_request`, `update_tab_request`, `get_tab_request`, `clear_history`, `export_history`, `generate_tests`, `generate_docs`, `import_curl`, `export_curl`, `diff_responses`, `rename_environment`, `rename_chain`), so later phases need no extra label strings (with `{name}` params where the tool input carries a target, e.g. "Reading {name}…", "Searching workspace…") in all three locales.
- **Acceptance**:
  - Keys keyed by tool name with parity across locales (FR-103, NFR-9, AC-23).
  - No vendor/model names (FR-103, NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P1.2 Activity derivation and step labels
- **Kind**: implementation
- **Files** (2): `src/lib/relay/activity.ts` (new); `src/lib/relay/stepLabels.ts` (new)
- **Depends on**: P1.1
- **Do**: Pure `deriveActivity(messages, status)` returns `{kind:"thinking"}`, `{kind:"tool", toolName, input}` for the single active step, or `null` when assistant text is streaming or the turn is idle. `stepLabelFor(toolName, input)` returns an i18n key plus params (name taken from the tool input) and falls back to the generic key for unknown tools. Registry-iteration and non-generic-label specs are written by Unit P1.4.
- **Acceptance**:
  - Thinking is returned only while in flight with no assistant text; tool steps are derived from tool name and input, one active at a time (FR-101, FR-102).
  - Unknown tools fall back to the generic key (FR-103).
- **Verify**:
  - `bunx biome check src/lib/relay/activity.ts src/lib/relay/stepLabels.ts`

### ✅ P1.3 RelayActivityIndicator wired into the conversation
- **Kind**: implementation
- **Files** (3): `src/components/relay/RelayActivityIndicator.tsx` (new); `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayConversation.spec.tsx`
- **Depends on**: P1.2
- **Do**: Indicator renders the shimmer "Thinking…" line or the live step with a soft pulsing dot. `role="status"`, `aria-live="polite"`. Shimmer and pulse classes are gated by `motion-safe:` so reduced motion leaves static text and dot. `RelayConversation` renders it only while streaming with no assistant text; finished steps stay in `ToolRow`.
- **Acceptance**:
  - Thinking line then labelled step ("Reading <name>…") with pulsing dot; completed steps collapse into `ToolRow` (FR-101, FR-102, AC-01).
  - No animation class applies under reduced motion; region has `role="status"` and `aria-live="polite"` (FR-104, AC-01).
  - No vendor/model names in rendered text (FR-103, NFR-3).
- **Verify**:
  - `bunx biome check src/components/relay/RelayActivityIndicator.tsx src/components/relay/RelayConversation.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P1.4 Unit: activity derivation and indicator
- **Kind**: unit
- **Files** (4): `src/lib/relay/activity.ts`; `src/lib/relay/stepLabels.ts`; `src/components/relay/RelayActivityIndicator.tsx`; `src/components/relay/RelayConversation.tsx`
- **Depends on**: P1.3
- **Do**: unit-test-engineer writes `activity.spec.ts`, `stepLabels.spec.ts` and `RelayActivityIndicator.spec.tsx` (all new; happy-dom header on the component spec) and extends `RelayConversation.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - `deriveActivity` returns thinking only while in flight with no assistant text, one active tool step derived from tool name and input, and `null` while text streams or the turn is idle (FR-101, FR-102).
  - The `stepLabels` spec iterates the tool registry so a tool without a label resolves to the generic key, and asserts that each SPEC-named tool listed in P1.1 has its own non-generic label (FR-103).
  - Indicator has `role="status"` and `aria-live="polite"`; shimmer and pulse classes are only `motion-safe:`; the conversation renders it only while streaming with no assistant text (FR-104, AC-01).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/activity.spec.ts src/lib/relay/stepLabels.spec.ts src/components/relay/RelayActivityIndicator.spec.tsx src/components/relay/RelayConversation.spec.tsx --coverage --coverage.include=src/lib/relay/activity.ts --coverage.include=src/lib/relay/stepLabels.ts --coverage.include=src/components/relay/RelayActivityIndicator.tsx --coverage.include=src/components/relay/RelayConversation.tsx --coverage.reporter=text`

### ✅ P1.5 E2E: loading phases
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P1.4
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-loading.feature.md`: REL-LOAD-01..04
- **Spec**: `e2e/qa/relay/relay-improvements-loading.spec.ts`
- **Scenarios**:
  - `[REL-LOAD-01] sending shows Thinking, then the labelled tool step, then the answer and a ToolRow` @critical (AC-01)
  - `[REL-LOAD-02] with reduced motion the indicator has no running animation but keeps text and dot` @high (FR-104)
  - `[REL-LOAD-03] the indicator region is role=status with aria-live=polite` @high (FR-104)
  - `[REL-LOAD-04] a chat route error while thinking clears the indicator and shows the error` @medium (error)
- **Do**: Extend `relayRoutes.ts` with a scripted slow stream gated by a test-controlled release (no sleeps) and an error variant. 02 asserts computed `animation-name` is `none` under `reducedMotion: "reduce"`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-01, FR-101, FR-102, FR-103, FR-104.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-loading.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P1.6 Checkpoint 1
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P1.1, P1.2, P1.3, P1.4, P1.5
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands below exit 0; no regression in earlier Relay specs.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-loading.spec.ts e2e/qa/relay/relay-improvements-layout.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 1**: all Phase 1 tasks ✅, Verify commands green, no regression.


## Phase 2: Live context chips, resets, contextual suggestions

**Adds:** Relay shows a live "Using: <request> - current tab" chip that follows the open tab, a new conversation clears attached items, and the empty-state suggestions depend on the current tab (for example "Why did this fail?" on a 500). Environment values are shared by name only unless Share is on, and big collections are capped.

**Try in UI:** Open request A, open Relay and read the chip, then switch to B and watch it change ; Start a new conversation: attachments clear and the chip and suggestions re-derive ; Open a tab with a 500 response and check the "Why did this fail?" suggestion ; Remove the chip and send: it is left out of that send only

Auto chip follows the tab, manual attachments slice, env/collection payload safety

### ✅ P2.1 Context strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P1.6
- **Do**: Add the "Using: {name} · current tab" chip label, its tooltip ("Relay can see this tab's request, and the chip updates when you switch tabs."), "values hidden" note, "…and {count} more — use search", and contextual suggestion prompts (5xx "Why did this fail?", no request "Create a request", with response "Add assertions", plus GraphQL/WebSocket/Socket.IO prompts) in all three locales.
- **Acceptance**:
  - All new keys present with parity (FR-120, FR-123, FR-126, FR-127, FR-195, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P2.2 Manual attachments slice, reset on new conversation
- **Kind**: implementation
- **Files** (2): `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`
- **Depends on**: P2.1
- **Do**: Read how `useRelayStore` persists today (it has no `partialize`; persisted fields are documented in the file) and add a transient, non-persisted `attachedItems` slice with add/remove actions and a `dismissedAutoChipTabId` for per-turn removal. `newConversation` clears both. Plain serializable data only, no functions in persisted payloads.
- **Acceptance**:
  - New conversation clears manual attachments and dismissals (FR-122, AC-06).
  - The persisted payload is byte-for-byte unchanged (NFR-10, SPEC Ask-first "persisted `useRelayStore` shape"); the proof is written by Unit P2.6.
  - Shared UI state lives in the store, not in component state (NFR-10).
- **Verify**:
  - `bunx biome check src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts`
  - `bunx vitest run src/stores/useRelayStore.spec.ts`

### ✅ P2.3 Live auto chip with tooltip
- **Kind**: implementation
- **Files** (3): `src/lib/relay/chips.ts`; `src/components/relay/ContextChips.tsx`; `src/components/relay/ContextChips.spec.tsx`
- **Depends on**: P2.2
- **Do**: Extend `computeContextChips`/`useAvailableChips` (do not duplicate): derive ONE auto chip "Using: <name> · current tab" from `useTabsStore` via a memoized selector so it follows tab switches; chain and utility tabs follow SPEC Assumption 1 (chain attaches the chain, utility pages attach none). Chip is removable for the current turn, keyboard reachable, shows exactly what is sent, with the tooltip.
- **Acceptance**:
  - Chip reads "Using: A · current tab", updates to B on tab switch without user action, tooltip explains (FR-120, FR-121, AC-05).
  - Chips are removable, keyboard reachable and show what is sent (FR-128, NFR-8).
  - Selector-derived and memoized, no re-render of the conversation on tab switch (NFR-7).
- **Verify**:
  - `bunx biome check src/lib/relay/chips.ts src/components/relay/ContextChips.tsx src/components/relay/ContextChips.spec.tsx`
  - `bunx vitest run src/components/relay/ContextChips.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P2.4 Contextual suggestions
- **Kind**: implementation
- **Files** (3): `src/lib/relay/suggestions.ts` (new); `src/components/relay/EmptyState.tsx`; `src/components/relay/EmptyState.spec.tsx`
- **Depends on**: P2.1
- **Do**: Pure `deriveSuggestions(tab, lastResponse)` returning prompt keys: 4xx/5xx last response gives "Why did this fail?", no request tab gives "Create a request", request with response gives "Add assertions", GraphQL/WebSocket/Socket.IO tabs get kind-specific prompts. `EmptyState` recomputes from the current tab and therefore resets on tab switch and new conversation. `suggestions.ts` is the shared source for the follow-up chips of P8.6.
- **Acceptance**:
  - Suggestions come from the current tab and never go stale after a tab switch or new conversation (FR-123, AC-06).
  - 500 response shows "Why did this fail?"; no tab shows "Create a request" (FR-195, AC-22).
  - Kind-specific prompts exist for GraphQL, WebSocket and Socket.IO (FR-195).
- **Verify**:
  - `bunx biome check src/lib/relay/suggestions.ts src/components/relay/EmptyState.tsx src/components/relay/EmptyState.spec.tsx`
  - `bunx vitest run src/components/relay/EmptyState.spec.tsx`

### ✅ P2.5 Context builder: env names-only, collection cap, secrets
- **Kind**: implementation
- **Files** (4): `src/lib/relay/contextBuilder.ts`; `src/lib/relay/contextBuilder.spec.ts`; `src/lib/relay/constants.ts`; `src/lib/relay/collectionSummary.ts` (new)
- **Depends on**: P2.2
- **Do**: Named constants for the 50-item cap and the 20-message log cap in `constants.ts`. `summarizeCollection(collection, cap = 50)` returns names, methods, URLs for at most 50 items and the "…and N more — use search" tail (shared with `generate_docs` in P11.7). `contextBuilder.ts`: an attached environment emits variable names plus a has-value flag only, values only when `shareValues` is on, and `isSecret` variables always `[redacted]` via `redact.ts`; collections go through `summarizeCollection`.
- **Acceptance**:
  - Share off: only names plus has-value flags in the built payload; Share on: non-secret values sent, secret values `[redacted]` (FR-126, NFR-1, AC-08).
  - A 500-request collection yields at most 50 entries plus "…and 450 more — use search" (FR-127, AC-09).
  - Payload-level specs (built request payload and the secrets corpus, not only helper output) are written by Unit P2.6 (AC-08, AC-09).
- **Verify**:
  - `bunx biome check src/lib/relay/contextBuilder.ts src/lib/relay/contextBuilder.spec.ts src/lib/relay/constants.ts src/lib/relay/collectionSummary.ts`
  - `bunx vitest run src/lib/relay/contextBuilder.spec.ts src/lib/relay/redact.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P2.6 Unit: context store, chips, suggestions, payload builders
- **Kind**: unit
- **Files** (5): `src/stores/useRelayStore.ts`; `src/lib/relay/chips.ts`; `src/lib/relay/suggestions.ts`; `src/lib/relay/contextBuilder.ts`; `src/lib/relay/collectionSummary.ts`
- **Depends on**: P2.2, P2.3, P2.4, P2.5
- **Do**: unit-test-engineer extends `useRelayStore.spec.ts` and `contextBuilder.spec.ts`, and writes `chips.spec.ts`, `suggestions.spec.ts` and `collectionSummary.spec.ts` (new). `constants.ts` holds only named constants and is not listed. Report source bugs instead of weakening tests.
- **Acceptance**:
  - The persisted `useRelayStore` payload is byte-for-byte unchanged with attachments and dismissals set (serialize before and after); `newConversation` clears `attachedItems` and `dismissedAutoChipTabId` (FR-122, NFR-10, AC-06).
  - The auto chip is derived from the active tab, follows a switch, attaches the chain on chain tabs and nothing on utility pages; the memoized selector returns the same reference when unrelated state changes (FR-120, FR-121, NFR-7).
  - `deriveSuggestions` covers 4xx/5xx, no request tab, request with response, and GraphQL/WebSocket/Socket.IO kinds (FR-123, FR-195).
  - Payload-level: Share off sends names plus has-value flags only; Share on sends non-secret values and `[redacted]` for `isSecret`; no value from the `redact.corpus.ts` secrets corpus appears in the built payload (FR-126, NFR-1, AC-08).
  - A 500-request collection yields 50 entries plus "…and 450 more — use search" in the built payload (FR-127, AC-09).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/stores/useRelayStore.spec.ts src/lib/relay/chips.spec.ts src/lib/relay/suggestions.spec.ts src/lib/relay/contextBuilder.spec.ts src/lib/relay/collectionSummary.spec.ts src/lib/relay/redact.spec.ts --coverage --coverage.include=src/stores/useRelayStore.ts --coverage.include=src/lib/relay/chips.ts --coverage.include=src/lib/relay/suggestions.ts --coverage.include=src/lib/relay/contextBuilder.ts --coverage.include=src/lib/relay/collectionSummary.ts --coverage.reporter=text`

### ✅ P2.7 Unit: context chips and empty state UI
- **Kind**: unit
- **Files** (2): `src/components/relay/ContextChips.tsx`; `src/components/relay/EmptyState.tsx`
- **Depends on**: P2.3, P2.4
- **Do**: unit-test-engineer extends `ContextChips.spec.tsx` and `EmptyState.spec.tsx` (happy-dom header). Report source bugs instead of weakening tests.
- **Acceptance**:
  - Chip reads "Using: <name> · current tab" with the tooltip, is removable for the current turn and keyboard reachable (FR-120, FR-128, NFR-8).
  - `EmptyState` re-derives suggestions on tab switch and new conversation (FR-123, AC-06).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/ContextChips.spec.tsx src/components/relay/EmptyState.spec.tsx --coverage --coverage.include=src/components/relay/ContextChips.tsx --coverage.include=src/components/relay/EmptyState.tsx --coverage.reporter=text`

### ✅ P2.8 E2E: live context chip and resets
- **Kind**: e2e
- **Files** (3): `e2e/fixtures/seed/relay-improvements.json` (new); `e2e/fixtures/seed/index.ts`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P2.6, P2.7
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-context-chip.feature.md`: REL-ICTX-01, REL-ICTX-02, REL-ICTX-06..08
- **Spec**: `e2e/qa/relay/relay-improvements-context-chip.spec.ts`
- **Scenarios**:
  - `[REL-ICTX-01] chip reads "Using: A · current tab" and follows a switch to B` @critical (AC-05)
  - `[REL-ICTX-02] new conversation clears attached items and re-derives chip and suggestions` @high (AC-06)
  - `[REL-ICTX-06] removing the auto chip leaves it out of the next send only` @medium (FR-128)
  - `[REL-ICTX-07] a utility page with no request tab shows no chip` @medium (empty, Assumption 1)
  - `[REL-ICTX-08] reloading with request B open restores the chip for B` @medium (persistence)
- **Do**: Seed ids `qa-e2e-relayimp-*` (two requests, an environment with a secret variable, a 500-request collection), shared by all context specs. Regenerate with `bun run qa:seed:build`, never hand-edit. The id prefix is REL-ICTX because REL-CTX already exists in `relay-chat.feature.md`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-05, AC-06, FR-120, FR-121, FR-122, FR-128.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P2.9 E2E: contextual suggestions
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P2.8
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-context-suggestions.feature.md`: REL-ICTX-03, REL-ICTX-09, REL-ICTX-10
- **Spec**: `e2e/qa/relay/relay-improvements-context-suggestions.spec.ts`
- **Scenarios**:
  - `[REL-ICTX-03] a tab with a 500 response suggests "Why did this fail?"` @high (AC-22)
  - `[REL-ICTX-09] an empty workspace with no tab suggests "Create a request"` @medium (AC-22, empty)
  - `[REL-ICTX-10] switching from the 500 tab to a GraphQL tab replaces the suggestions` @high (FR-123, FR-195)
- **Do**: Reuse the P2.8 seed (add a stored 500 response and a GraphQL tab if missing, then `bun run qa:seed:build`). Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-22 (suggestion part), FR-123, FR-195.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-suggestions.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P2.10 E2E: context payload safety
- **Kind**: e2e
- **Files** (3): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated); `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P2.9
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-context-payload.feature.md`: REL-ICTX-04, REL-ICTX-05, REL-ICTX-11
- **Spec**: `e2e/qa/relay/relay-improvements-context-payload.spec.ts`
- **Scenarios**:
  - `[REL-ICTX-04] env with Share off sends names only; Share on sends non-secret values and [redacted] for the secret` @critical (AC-08)
  - `[REL-ICTX-05] a 500-request collection sends at most 50 entries plus "…and 450 more"` @high (AC-09)
  - `[REL-ICTX-11] a 500 from the chat route keeps the attachments and shows a retryable error` @medium (error)
- **Do**: The mocked chat route captures the request body and the spec asserts on it. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-08, AC-09, FR-126, FR-127, NFR-1.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P2.11 Checkpoint 2
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P2.1, P2.2, P2.3, P2.4, P2.5, P2.6, P2.7, P2.8, P2.9, P2.10
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; the redact corpus spec is still green with the new payload specs.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/stores/useRelayStore.spec.ts src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-suggestions.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-loading.spec.ts e2e/qa/relay/relay-improvements-layout.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 2**: all Phase 2 tasks ✅, Verify commands green, no regression.


## Phase 3: Picker (+ and @) and slash commands

**Adds:** The composer gets a "+" button and an @ trigger that open one shared picker for attaching requests, collections and environments, plus a slash menu with five commands (including /clear, which asks for confirmation).

**Try in UI:** Click "+" and type @ in the Relay text box: both open the same picker; filter and pick an item to attach it as a chip ; Type / to see the five commands and press Enter on /explain to fill the prompt ; Run /clear on a thread with messages and confirm; on an empty thread it starts a new conversation without asking

Virtualized shared picker, mention token, slash menu

### ✅ P3.1 Picker and slash strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P2.11
- **Do**: Add picker strings (search placeholder, kind filter labels, "Keep typing to narrow results", "values hidden", "+" button name), slash command names/descriptions/prompt templates for `/explain /assert /curl /docs /clear`, and the `/clear` confirm copy in all three locales.
- **Acceptance**:
  - Keys present with parity (FR-124, FR-125, FR-193, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P3.2 Picker items hook over the workspace index
- **Kind**: implementation
- **Files** (3): `src/hooks/useRelayPickerItems.ts` (new); `src/lib/relay/tools/workspaceRead.ts`; `src/lib/relay/tools/workspaceRead.spec.ts`
- **Depends on**: P3.1
- **Do**: Hook returns requests, collections, environments and chains filtered by kind and query using the existing workspace search/index in `workspaceRead.ts` (expose a small pure search helper there if needed), capped at the default 50 results with a `truncated` flag. Memoized from store selectors.
- **Acceptance**:
  - Search is driven by the existing workspace index and results are capped at 50 with a truncation flag (FR-125).
  - Filtering 5,000 items stays well under the NFR-6 typing budget (NFR-6, AC-07); the loose timing spec is written by Unit P3.7.
- **Verify**:
  - `bunx biome check src/hooks/useRelayPickerItems.ts src/lib/relay/tools/workspaceRead.ts src/lib/relay/tools/workspaceRead.spec.ts`
  - `bunx vitest run src/lib/relay/tools/workspaceRead.spec.ts`

### ✅ P3.3 RelayPicker component
- **Kind**: implementation
- **Files** (2): `src/components/relay/RelayPicker.tsx` (new); `src/components/relay/RelayPickerRow.tsx` (new)
- **Depends on**: P3.2
- **Do**: shadcn `Popover` + `Command` (cmdk, `src/components/ui/command.tsx`) with `@tanstack/react-virtual` windowing (already installed, no new dependency), kind filter, search input, "Keep typing to narrow results" footer when truncated, and the "values hidden" note on environments while `shareValues` is off. Shared by "+", `@` and later slash. No Relay imports from the main bundle.
- **Acceptance**:
  - Only a bounded window of rows is in the DOM with 5,000 items; opens and filters within NFR-6 (loose timing) (FR-124, FR-125, NFR-6, AC-07).
  - "values hidden" note appears when Share is off (FR-126).
  - Fully keyboard operable with visible focus and accessible names (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/RelayPicker.tsx src/components/relay/RelayPickerRow.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P3.4 "+" button and @ trigger in the composer
- **Kind**: implementation
- **Files** (3): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/lib/relay/mentions.ts` (new)
- **Depends on**: P3.3, P2.2
- **Do**: Fill the leading slot from P0.5 with the "+" button opening `RelayPicker`; typing `@` in the textfield opens the same picker (shared component and hook), selecting inserts a mention token (pure `mentions.ts` finds the active `@query` at the caret and replaces it) and attaches the item as a chip through the P2.2 slice.
- **Acceptance**:
  - "+" and `@` open the same picker; the choice inserts a token and attaches a removable chip (FR-124, FR-128, AC-07).
  - Esc closes the picker returning focus to the textfield; keyboard only operation works (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/lib/relay/mentions.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx`

### ✅ P3.5 Slash command table and menu
- **Kind**: implementation
- **Files** (2): `src/lib/relay/slashCommands.ts` (new); `src/components/relay/SlashMenu.tsx` (new)
- **Depends on**: P3.1, P2.3
- **Do**: Command table for `/explain /assert /curl /docs /clear` expanding to prompt templates bound to the current tab (`/assert` maps to `generate_tests`, `/curl` to `export_curl`, `/docs` to `generate_docs`; they work as plain prompts before P11 lands). `SlashMenu` is an `aria-activedescendant` listbox with arrows, Enter and Esc. `/clear` is marked as needing confirm when the thread is non-empty.
- **Acceptance**:
  - Five commands listed and navigable by keyboard; `/explain` fills an explain prompt for the current tab (FR-193, AC-20).
  - Listbox uses `aria-activedescendant`, items have accessible names (FR-193, NFR-8).
  - Slash-menu highlighted index is component-local state (NFR-10).
- **Verify**:
  - `bunx biome check src/lib/relay/slashCommands.ts src/components/relay/SlashMenu.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P3.6 Slash menu wired into the composer, /clear confirm
- **Kind**: implementation
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/components/relay/RelayHeader.tsx`; `src/components/relay/RelayHeader.spec.tsx`
- **Depends on**: P3.4, P3.5
- **Do**: Typing `/` at the start of the composer opens `SlashMenu`; selecting a command fills the prompt; `/clear` opens an inline confirm when the thread is non-empty, then calls the existing new-conversation action. Header change only if the new-conversation action needs to be exposed.
- **Acceptance**:
  - `/` opens only at the start of the composer; `/clear` starts a new conversation after confirm, and without confirm when the thread is empty (FR-193, AC-20).
  - Existing send/Enter behaviour is unchanged when no menu is open (FR-193).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayHeader.spec.tsx`

### ✅ P3.7 Unit: picker items, mentions, slash commands
- **Kind**: unit
- **Files** (4): `src/hooks/useRelayPickerItems.ts`; `src/lib/relay/tools/workspaceRead.ts`; `src/lib/relay/mentions.ts`; `src/lib/relay/slashCommands.ts`
- **Depends on**: P3.2, P3.4, P3.5
- **Do**: unit-test-engineer writes `useRelayPickerItems.spec.ts` (happy-dom header, it uses `renderHook`), `mentions.spec.ts`, `slashCommands.spec.ts` (new) and extends `workspaceRead.spec.ts`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Results come from the existing workspace index, are capped at 50 and set `truncated` (FR-125).
  - A 5,000-item fixture filters well under the NFR-6 typing budget (loose timing assertion) (NFR-6, AC-07).
  - `mentions.ts` finds the active `@query` at the caret and replaces it (FR-124).
  - Five commands map to their prompts (`/assert` to `generate_tests`, `/curl` to `export_curl`, `/docs` to `generate_docs`); `/clear` needs confirm only when the thread is non-empty (FR-193, AC-20).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/hooks/useRelayPickerItems.spec.ts src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/mentions.spec.ts src/lib/relay/slashCommands.spec.ts --coverage --coverage.include=src/hooks/useRelayPickerItems.ts --coverage.include=src/lib/relay/tools/workspaceRead.ts --coverage.include=src/lib/relay/mentions.ts --coverage.include=src/lib/relay/slashCommands.ts --coverage.reporter=text`

### ✅ P3.8 Unit: picker, slash menu and composer UI
- **Kind**: unit
- **Files** (5): `src/components/relay/RelayPicker.tsx`; `src/components/relay/RelayPickerRow.tsx`; `src/components/relay/SlashMenu.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayHeader.tsx`
- **Depends on**: P3.3, P3.6
- **Do**: unit-test-engineer writes `RelayPicker.spec.tsx` and `SlashMenu.spec.tsx` (new, happy-dom header; `RelayPickerRow` is covered through the picker spec) and extends `RelayComposer.spec.tsx` and `RelayHeader.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - With 5,000 items only a bounded window of rows is in the DOM; "values hidden" shows while Share is off (FR-124, FR-125, FR-126, NFR-6).
  - "+" and `@` open the same picker; a choice inserts a token and attaches a removable chip; Esc closes and returns focus (FR-124, FR-128, NFR-8).
  - Slash menu is an `aria-activedescendant` listbox with arrows, Enter and Esc; `/` opens only at the start; `/clear` confirms when the thread is non-empty (FR-193, AC-20).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayPicker.spec.tsx src/components/relay/SlashMenu.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayHeader.spec.tsx --coverage --coverage.include=src/components/relay/RelayPicker.tsx --coverage.include=src/components/relay/RelayPickerRow.tsx --coverage.include=src/components/relay/SlashMenu.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text`

### ✅ P3.9 E2E: picker attach and slash commands
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P3.7, P3.8
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-picker.feature.md`: REL-PICK-01..06
- **Spec**: `e2e/qa/relay/relay-improvements-picker.spec.ts`
- **Scenarios**:
  - `[REL-PICK-01] "+" and "@" open the same picker and the chosen item is sent as a chip` @critical (AC-07)
  - `[REL-PICK-02] with more requests than the result cap the picker opens, filters and renders a bounded number of rows` @high (AC-07, NFR-6)
  - `[REL-PICK-03] "/" lists five commands and Enter on /explain fills the prompt` @high (AC-20)
  - `[REL-PICK-04] /clear asks to confirm, then starts a new conversation` @high (AC-20)
  - `[REL-PICK-05] a query with no match shows the empty state and Esc returns focus to the textfield` @medium (empty)
  - `[REL-PICK-06] /clear on an empty thread starts a new conversation without a confirm` @medium (FR-193)
- **Do**: Scale comes from the existing 500-request collection `qa-e2e-relayimp-col-500` (more than the picker result cap); no bulk seed data is added. Regenerate the seed with `bun run qa:seed:build` if the JSON changes. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-07, AC-20, FR-124, FR-125, FR-128, FR-193, NFR-6.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P3.10 Checkpoint 3
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P3.1, P3.2, P3.3, P3.4, P3.5, P3.6, P3.7, P3.8, P3.9
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; no regression.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/hooks src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-suggestions.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-shell.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 3**: all Phase 3 tasks ✅, Verify commands green, no regression.


## Phase 4: Tab and bulk tools

**Adds:** Relay can close tabs for you (close_tab, close_all_tabs) and bulk-delete requests, always behind a confirm card. Unsaved tabs are listed with Save all & close, Discard & close and Cancel, and pinned tabs are kept unless you name them.

**Try in UI:** Ask Relay to close a clean tab: it closes silently ; Make a tab dirty and ask it to close all tabs: pick Save all & close, Discard & close or Cancel ; Ask it to delete all requests in a collection: the destructive card shows the count; decline and reload to see everything still there

close_tab, close_all_tabs, dirty confirm, bulk delete

### ✅ P4.1 Tab and bulk-delete strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P3.10
- **Do**: Add the dirty-close card copy ("Save all & close", "Discard & close", "Cancel", unsaved-work warning, "{count} pinned tabs kept open", "needs a destination") and the bulk-delete card copy (count, "and {n} more") in all three locales.
- **Acceptance**:
  - Keys present with parity (FR-131, FR-132, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P4.2 close_tab and close_all_tabs tools
- **Kind**: implementation
- **Files** (4): `src/lib/relay/tools/tabs.ts` (new); `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.spec.ts`
- **Depends on**: P4.1
- **Do**: `close_tab({tabId})` kind auto when `isDirty` is false, confirm when true; `close_all_tabs({includePinned?})` built on `useTabsStore.closeTab/closeAllTabs`. A tab is pinned when its `requestId` is in `useSettingsStore.pinnedRequestIds`; pinned tabs are skipped unless `includePinned` is true, and the schema description states it may be set only when the user explicitly names pinned tabs. Result reports `pinnedKept`. Both declare `kind` in the registry. Read `src/hooks/useCloseTabGuard.ts` first and reuse its dirty logic rather than duplicating it.
- **Acceptance**:
  - Clean tabs close silently; pinned tabs are kept and `pinnedKept` is reported; `includePinned` closes them (FR-130, D-1, AC-10).
  - Tools declare `kind` and registry spec still asserts every registered tool has one (NFR-4).
  - Results are redacted and never include secrets (NFR-1).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/tabs.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.spec.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts`

### ✅ P4.3 Dirty-close confirm card
- **Kind**: implementation
- **Files** (3): `src/components/relay/CloseTabsConfirmCard.tsx` (new); `src/components/relay/RelayConversation.tsx`; `src/lib/relay/tools/tabs.ts`
- **Depends on**: P4.2
- **Do**: When any target tab is dirty, render a card listing the dirty tabs with [Save all & close] [Discard & close] [Cancel], default focus on Cancel, mapped to `save-all | discard | cancel`. Save reuses the existing save path in `src/hooks/useSaveRequest.ts` (Assumption 13); tabs without a `requestId`/destination are listed on the card as needing one and are not closed. Cancel returns "user declined" to the model. `tabs.spec.ts` is written by Unit P4.6 and the card spec by Unit P4.7.
- **Acceptance**:
  - Card lists the dirty tabs and warns that discarding loses unsaved work (FR-131, AC-10).
  - Save all & close saves then closes, Discard & close closes without saving, Cancel leaves all tabs open and returns "user declined" (FR-131, AC-10).
  - Default focus is Cancel and the card is keyboard operable (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/CloseTabsConfirmCard.tsx src/components/relay/RelayConversation.tsx src/lib/relay/tools/tabs.ts`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P4.4 Bulk delete tools and card content
- **Kind**: implementation
- **Files** (5): `src/lib/relay/tools/destructive.ts`; `src/lib/relay/tools/destructive.spec.ts`; `src/lib/relay/tools/schemas.ts`; `src/components/relay/ConfirmCard.tsx`; `src/components/relay/ConfirmCard.spec.tsx`
- **Depends on**: P4.1
- **Do**: Add `delete_requests({ids})` and `delete_requests_in_collection({collectionId})` as kind `destructive` (existing single `delete_request` stays unchanged). `ConfirmCard` shows the count and the first N names (named constant) with "and {n} more"; always requires confirmation, even if the plan had pre-approved a prior single delete.
- **Acceptance**:
  - Both tools are `destructive` and always render the card with count and first names; nothing is deleted until confirm, declining leaves data unchanged (FR-132, AC-11).
  - Existing single delete tools and their specs are unchanged (FR-132).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/destructive.ts src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/schemas.ts src/components/relay/ConfirmCard.tsx src/components/relay/ConfirmCard.spec.tsx`
  - `bunx vitest run src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/gating.spec.ts src/components/relay/ConfirmCard.spec.tsx`

### ✅ P4.5 Entity delete routes through the dirty-close confirm
- **Kind**: implementation
- **Files** (4): `src/lib/relay/tools/destructive.ts`; `src/lib/relay/tools/destructive.spec.ts`; `src/lib/relay/tools/collectionWrite.ts`; `src/lib/relay/tools/collectionWrite.spec.ts`
- **Depends on**: P4.3, P4.4
- **Do**: When deleting an entity (request, collection, bulk) closes its open tabs, any dirty tab among them goes through the same dirty-close decision as P4.3 instead of closing silently. Existing closing behaviour for clean tabs is preserved.
- **Acceptance**:
  - Deleting an entity still closes its open tabs; if one is dirty the FR-131 decision applies first (FR-133).
  - Clean-tab behaviour is unchanged (FR-133).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/destructive.ts src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/collectionWrite.ts src/lib/relay/tools/collectionWrite.spec.ts`
  - `bunx vitest run src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/collectionWrite.spec.ts`

### ✅ P4.6 Unit: tab and bulk-delete tools
- **Kind**: unit
- **Files** (5): `src/lib/relay/tools/tabs.ts`; `src/lib/relay/tools/destructive.ts`; `src/lib/relay/tools/collectionWrite.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: P4.2, P4.3, P4.4, P4.5
- **Do**: unit-test-engineer writes `tabs.spec.ts` (new) and extends `destructive.spec.ts`, `collectionWrite.spec.ts`, `registry.spec.ts` and `schemas.spec.ts`; `gating.spec.ts` must stay green. Report source bugs instead of weakening tests.
- **Acceptance**:
  - `close_tab` is auto when clean and confirm when dirty; `close_all_tabs` skips pinned tabs unless `includePinned`, and reports `pinnedKept` (FR-130, D-1, AC-10).
  - Dirty-close maps to `save-all | discard | cancel`: save-all saves then closes, discard closes without saving, cancel leaves every tab open and returns "user declined"; tabs without a destination are listed and not closed (FR-131, AC-10).
  - `delete_requests*` are `destructive` and delete nothing before confirm; entity deletes route dirty tabs through the FR-131 decision and leave clean-tab behaviour unchanged (FR-132, FR-133, AC-11).
  - Every registered tool has a `kind`; results are redacted (NFR-1, NFR-4).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/tabs.spec.ts src/lib/relay/tools/destructive.spec.ts src/lib/relay/tools/collectionWrite.spec.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/gating.spec.ts --coverage --coverage.include=src/lib/relay/tools/tabs.ts --coverage.include=src/lib/relay/tools/destructive.ts --coverage.include=src/lib/relay/tools/collectionWrite.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/tools/schemas.ts --coverage.reporter=text`

### ✅ P4.7 Unit: confirm cards
- **Kind**: unit
- **Files** (3): `src/components/relay/CloseTabsConfirmCard.tsx`; `src/components/relay/ConfirmCard.tsx`; `src/components/relay/RelayConversation.tsx`
- **Depends on**: P4.3, P4.4
- **Do**: unit-test-engineer writes `CloseTabsConfirmCard.spec.tsx` (new, happy-dom header) and extends `ConfirmCard.spec.tsx` and `RelayConversation.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - The dirty-close card lists dirty tabs, warns about lost work, offers Save all & close / Discard & close / Cancel, and focuses Cancel by default (FR-131, NFR-8, AC-10).
  - `ConfirmCard` shows the count, the first N names and "and {n} more" for bulk deletes (FR-132, AC-11).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/CloseTabsConfirmCard.spec.tsx src/components/relay/ConfirmCard.spec.tsx src/components/relay/RelayConversation.spec.tsx --coverage --coverage.include=src/components/relay/CloseTabsConfirmCard.tsx --coverage.include=src/components/relay/ConfirmCard.tsx --coverage.include=src/components/relay/RelayConversation.tsx --coverage.reporter=text`

### ✅ P4.8 E2E: close tabs and bulk delete
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P4.6, P4.7
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-tabs.feature.md`: REL-TAB-01..07
- **Spec**: `e2e/qa/relay/relay-improvements-tabs.spec.ts`
- **Scenarios**:
  - `[REL-TAB-01] close_tab on a clean tab closes it silently` @high (AC-10)
  - `[REL-TAB-02] close_all_tabs keeps the pinned tab and reports the kept count; naming pinned tabs closes them` @critical (AC-10, D-1)
  - `[REL-TAB-03] with a dirty tab the card lists it and Save all & close saves then closes` @critical (AC-10)
  - `[REL-TAB-04] Discard & close closes without saving and Cancel leaves every tab open` @critical (AC-10)
  - `[REL-TAB-05] delete_requests_in_collection shows the destructive card with the count; declining changes nothing` @critical (AC-11)
  - `[REL-TAB-06] after declining the bulk delete and reloading, every request is still there` @medium (persistence)
  - `[REL-TAB-07] close_all_tabs with no open tabs reports that nothing was closed` @medium (empty)
- **Do**: Seed a pinned request and several tabs (one dirty); mocked tool calls come from `relayRoutes.ts`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-10, AC-11, FR-130, FR-131, FR-132, FR-133, D-1.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-tabs.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P4.9 Checkpoint 4
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; registry/gating specs prove every tool has a `kind` (NFR-4); no regression in earlier Relay confirm/write specs.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-tabs.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 4**: all Phase 4 tasks ✅, Verify commands green, no regression.


## Phase 5: GraphQL, WebSocket, Socket.IO tab tools

**Adds:** Relay can create and edit GraphQL, WebSocket and Socket.IO requests, not just HTTP: it opens the right kind of tab with query, variables, headers, event name and draft message filled in. Needs your sign-off first because it changes the stored tab shape.

**Try in UI:** Ask Relay to create a GraphQL request: a graphql tab opens with query, variables and operation name ; Ask for a WebSocket and a Socket.IO request: tabs open with URL and draft, and nothing connects ; Ask it to change one field: only that field changes ; Give invalid variables JSON: a recoverable error and the tab is unchanged

Tab model change (ask first), per-kind tools, get_tab_request

### ✅ P5.1 SIGN-OFF: persisted tab shape (draft, eventName)
- **Kind**: gate
- **Files** (0): none (decision only)
- **Depends on**: P4.9
- **Gherkin**: none (decision only)
- **Do**: **NEEDS USER SIGN-OFF** (SPEC Ask-first: "Adding optional `draft`/`eventName` fields to `WebSocketTab`/`SocketIOTab` (persisted tab shape)"). Ask the user with AskUserQuestion to approve adding optional `draft?: string` to `WebSocketTab` and `SocketIOTab` and optional `eventName?: string` to `SocketIOTab` in `src/types/index.ts`, with no migration (fields are optional and absent on old tabs). Before asking, snapshot `git status --porcelain -- src messages e2e | shasum` into the Log (P0–P4 are already committed, one commit per phase, by the /build-phases orchestrator after verifier PASS, so only Phase 5 work can show). Record the answer and the snapshot on the single Log line as `P5.1 sign-off: approved|declined, YYYY-MM-DD; snapshot: <hash>` (`<hash>` is the 40 hex characters shasum printed, without the trailing `-`). If declined, P5.2..P5.7 (including P5.3), P7.4 and the WS/Socket.IO parts of FR-142/143/183 are blocked and must be re-planned.
- **Acceptance**:
  - The user's decision is recorded in the Log with date (SPEC section 7, FR-142, FR-143).
  - No file under `src/`, `messages/` or `e2e/` is modified by this task.
- **Verify**:
  - `grep -cE "^- \*\*Log\*\*: .*P5\.1 sign-off: (approved|declined), [0-9]{4}-[0-9]{2}-[0-9]{2}" agent_docs/relay-improvements/TASKS.md`  (expect 1)
  - `grep -cE "^- \*\*Log\*\*: .*P5\.1 sign-off: .*; snapshot: [0-9a-f]{40}( |$)" agent_docs/relay-improvements/TASKS.md`  (expect 1; the live hash is not recompared, the verifier runs after Phase 5 work has changed these paths)
- **Log**: P5.1 sign-off: approved, 2026-10-16; snapshot: da39a3ee5e6b4b0d3255bfef95601890afd80709

### ✅ P5.2 Tab model fields and WebSocket compose-state refactor
- **Kind**: implementation
- **Files** (3): `src/types/index.ts`; `src/components/request/tabs/WebSocketTabs.tsx`; `src/components/request/tabs/WebSocketTabs.spec.tsx`
- **Depends on**: P5.1
- **Do**: Add the optional `draft` (`WebSocketTab` and `SocketIOTab`) and `eventName` (`SocketIOTab`, UI default "message") fields. Refactor the compose `draft` in `src/components/request/tabs/WebSocketTabs.tsx` (today `useState("")` at line 20) to `updateTabState` reads/writes. Old persisted WebSocket and Socket.IO tabs without the new fields must hydrate with empty defaults; that spec is written by Unit P5.9.
- **Acceptance**:
  - WebSocket compose text is read from and written to the tab via `updateTabState` and survives switching tabs (FR-142).
  - Old persisted tabs without the fields still load; no migration needed (FR-142, FR-143, PLAN risk "persisted tab shape").
  - Existing WebSocket behaviour is unchanged (FR-142).
- **Verify**:
  - `bunx biome check src/types/index.ts src/components/request/tabs/WebSocketTabs.tsx src/components/request/tabs/WebSocketTabs.spec.tsx`
  - `bunx vitest run src/components/request/tabs/WebSocketTabs.spec.tsx src/stores/useTabsStore.spec.ts`

### ✅ P5.3 Socket.IO compose-state refactor
- **Kind**: implementation
- **Files** (1): `src/components/request/tabs/SocketIOTabs.tsx`
- **Depends on**: P5.2
- **Do**: Refactor the component-local `eventName` (`useState("message")`) and `draft` (`useState("")`) in `src/components/request/tabs/SocketIOTabs.tsx` to the new tab fields via `updateTabState`, defaulting `eventName` to "message" when absent. The component spec (none exists today) is written by Unit P5.9.
- **Acceptance**:
  - Socket.IO `draft` and `eventName` are read from and written to the tab and survive switching tabs; absent `eventName` shows "message" (FR-143).
  - Existing Socket.IO behaviour is unchanged (FR-143).
- **Verify**:
  - `bunx biome check src/components/request/tabs/SocketIOTabs.tsx`
  - `bunx vitest run src/stores/useTabsStore.spec.ts`

### ✅ P5.4 Per-kind schemas
- **Kind**: implementation
- **Files** (2): `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/schemas.spec.ts`
- **Depends on**: P5.2, P5.3
- **Do**: Zod schemas per kind: GraphQL (`name`, `url`, `query`, `variables` as a validated JSON string, `operationName`, `headers`, `auth`), WebSocket (`name`, `url` requiring ws/wss, `headers`, `draft`), Socket.IO (`name`, `url`, `headers`, `draft`, `eventName` default "message"), and an `update_tab_request` partial schema discriminated by kind. Validation failures map to structured `{ok:false, error}`.
- **Acceptance**:
  - Invalid variables JSON and non-ws/wss URLs fail with a structured error the model can self-correct from (FR-141, FR-142, FR-143, FR-144, AC-12).
  - Valid inputs per kind pass; HTTP `create_request` schema is unchanged (AC-12).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/schemas.spec.ts`
  - `bunx vitest run src/lib/relay/tools/schemas.spec.ts`

### ✅ P5.5 create_graphql_request, create_websocket_request, create_socketio_request
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tools/tabRequests.ts` (new); `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/registry.spec.ts`
- **Depends on**: P5.4
- **Do**: Three tools that open a tab through `useTabsStore.openTab` populated from the validated input, recording a `changeLog` entry for Undo. They never save to collections and never connect or emit (Assumption 11, FR-143). Each declares a `kind` in the registry. Existing `create_request`/`update_request` stay HTTP-only and untouched.
- **Acceptance**:
  - Asking for each kind opens a tab of that type with query/variables/operationName, url/headers/draft, url/eventName/draft populated (FR-140, FR-141, FR-142, FR-143, AC-12).
  - Undo removes the tab it created (FR-144); HTTP `create_request` behaviour unchanged (AC-12).
  - Tools declare `kind` (NFR-4); nothing is sent or connected (FR-143).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/tabRequests.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/registry.spec.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/requestWrite.spec.ts`

### ✅ P5.6 update_tab_request and get_tab_request
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tools/tabRequests.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/redact.corpus.ts`
- **Depends on**: P5.5
- **Do**: `update_tab_request({tabId, ...fields})` edits only the given fields via `updateTabState` with `changeLog` Undo. `get_tab_request({tabId})` (auto, read-only) returns kind-specific fields through `redact.ts`, with `messageLog` capped to the last 20 (named constant from P2.5). Extend `redact.corpus.ts` with tab-request secrets (auth tokens, headers). `tabRequests.spec.ts` is written by Unit P5.8.
- **Acceptance**:
  - `update_tab_request` changes only the supplied fields and Undo restores them (FR-144, AC-12).
  - `get_tab_request` returns redacted kind-specific data and at most 20 log messages (FR-144, NFR-1).
  - Invalid variables JSON returns `{ok:false, error}` and leaves the tab unchanged (FR-144, AC-12).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/tabRequests.ts src/lib/relay/tools/registry.ts src/lib/relay/redact.corpus.ts`
  - `bunx vitest run src/lib/relay/redact.spec.ts src/lib/relay/tools/registry.spec.ts`

### ✅ P5.7 System prompt kinds section
- **Kind**: implementation
- **Files** (2): `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`
- **Depends on**: P5.6
- **Do**: Add a short section explaining HTTP vs GraphQL vs WebSocket vs Socket.IO tab-only requests and when to use each tool. System prompt structure change is a SPEC Ask-first item: append a section only, do not restructure; if the spec cannot be satisfied by appending, stop and ask.
- **Acceptance**:
  - Prompt names each kind and its tool and states WS/Socket.IO are prepared, never sent (FR-145).
  - `systemPrompt.spec.ts` asserts the section exists; no vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check src/lib/relay/server/systemPrompt.ts src/lib/relay/server/systemPrompt.spec.ts`
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/brandGuard.spec.ts`

### ✅ P5.8 Unit: per-kind tab tools and prompt section
- **Kind**: unit
- **Files** (4): `src/lib/relay/tools/tabRequests.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/server/systemPrompt.ts`
- **Depends on**: P5.4, P5.5, P5.6, P5.7
- **Do**: unit-test-engineer writes `tabRequests.spec.ts` (new) and extends `schemas.spec.ts`, `registry.spec.ts` and `systemPrompt.spec.ts`; `redact.spec.ts` (with the P5.6 corpus) and `requestWrite.spec.ts` must stay green. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Each `create_*` tool opens a tab of its kind with the given fields, never saves or connects, and Undo removes the tab (FR-140..143, AC-12).
  - `update_tab_request` changes only the supplied fields with Undo; invalid variables JSON returns `{ok:false, error}` and leaves the tab unchanged; non-ws/wss URLs are rejected (FR-141, FR-142, FR-144, AC-12).
  - `get_tab_request` is redacted and returns at most 20 log messages; HTTP `create_request` is unchanged (FR-144, NFR-1).
  - The prompt section names each kind and tool and says WS/Socket.IO are prepared, never sent (FR-145).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/tabRequests.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/redact.spec.ts src/lib/relay/tools/requestWrite.spec.ts --coverage --coverage.include=src/lib/relay/tools/tabRequests.ts --coverage.include=src/lib/relay/tools/schemas.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/server/systemPrompt.ts --coverage.reporter=text`

### ✅ P5.9 Unit: WebSocket and Socket.IO compose state
- **Kind**: unit
- **Files** (3): `src/components/request/tabs/WebSocketTabs.tsx`; `src/components/request/tabs/SocketIOTabs.tsx`; `src/stores/useTabsStore.ts`
- **Depends on**: P5.2, P5.3
- **Do**: unit-test-engineer extends `WebSocketTabs.spec.tsx` and `useTabsStore.spec.ts`, and writes `SocketIOTabs.spec.tsx` (new, happy-dom header; none exists today). Report source bugs instead of weakening tests.
- **Acceptance**:
  - Old persisted WebSocket and Socket.IO tabs without `draft`/`eventName` hydrate and load with empty defaults; absent `eventName` shows "message" (FR-142, FR-143).
  - WebSocket and Socket.IO `draft`/`eventName` are read and written through `updateTabState` and survive switching tabs (FR-142, FR-143).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/request/tabs/WebSocketTabs.spec.tsx src/components/request/tabs/SocketIOTabs.spec.tsx src/stores/useTabsStore.spec.ts --coverage --coverage.include=src/components/request/tabs/WebSocketTabs.tsx --coverage.include=src/components/request/tabs/SocketIOTabs.tsx --coverage.include=src/stores/useTabsStore.ts --coverage.reporter=text`

### ✅ P5.10 E2E: GraphQL, WebSocket, Socket.IO tools
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/relayRoutes.ts`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P5.8, P5.9
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-kinds.feature.md`: REL-KIND-01..06
- **Spec**: `e2e/qa/relay/relay-improvements-kinds.spec.ts`
- **Scenarios**:
  - `[REL-KIND-01] create_graphql_request opens a graphql tab with query, variables and operationName` @critical (AC-12)
  - `[REL-KIND-02] create_websocket_request opens a websocket tab with url, headers and draft and does not connect` @high (AC-12)
  - `[REL-KIND-03] create_socketio_request opens a socketio tab with url, eventName and draft` @high (AC-12)
  - `[REL-KIND-04] update_tab_request edits only the named field and HTTP create_request still creates an HTTP request` @high (AC-12)
  - `[REL-KIND-05] invalid variables JSON shows a recoverable tool error and leaves the tab unchanged` @medium (error)
  - `[REL-KIND-06] the created WebSocket draft survives switching tabs and back` @medium (persistence)
- **Do**: Mocked tool calls from `relayRoutes.ts`. No scenario connects, so the Socket.IO echo is not used. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-12, FR-140..145.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-kinds.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P5.11 Checkpoint 5
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P5.1, P5.2, P5.3, P5.4, P5.5, P5.6, P5.7, P5.8, P5.9, P5.10
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task. Confirm the P5.1 sign-off is recorded. The env prefix disables the Playwright `webServer` block, so the Socket.IO echo on :3333 is not auto-started: run ECHO_START (see Decisions; it starts the echo only if :3333 is not already listening and waits up to 120 s for it) before running `e2e/socketio.spec.ts`: `nc -z 127.0.0.1 3333 || { test -f scripts/run-socketio-echo.sh || git show 96a6780^:scripts/run-socketio-echo.sh > scripts/run-socketio-echo.sh; bash scripts/run-socketio-echo.sh > /dev/null 2>&1 & echo $! > scripts/.socketio-echo.pid; }; for i in $(seq 120); do nc -z 127.0.0.1 3333 && break; sleep 1; done; nc -z 127.0.0.1 3333`. As the last step, after the specs finish (pass or fail), run ECHO_STOP: `test ! -f scripts/.socketio-echo.pid || { pkill -P "$(cat scripts/.socketio-echo.pid)"; rm -f scripts/.socketio-echo.pid; }`.
- **Acceptance**:
  - All commands exit 0; existing WebSocket, Socket.IO and GraphQL e2e specs still green.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/request src/stores/useTabsStore.spec.ts`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-kinds.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/websocket.spec.ts e2e/socketio.spec.ts e2e/graphql.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 5**: all Phase 5 tasks ✅, sign-off recorded, Verify commands green, no regression.


## Phase 6: Rich replies, part 1 (entity pills and colour)

**Adds:** Relay replies can contain clickable pills for your requests, collections and environments (relay:// links) and colour-code HTTP methods and status codes in prose. Unknown ids show as plain text and unsafe links are never linkified.

**Try in UI:** Ask Relay about a request in your workspace: the reply shows a pill with a method badge, click it to open that tab ; Check GET/POST and 404/500 words are colour-coded and still readable as text ; Delete the referenced request and reopen the thread: the link is plain text

relay:// links, pills, method/status colour, prompt instruction

### ✅ P6.1 Pill strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P5.11
- **Do**: Add the pill accessible-name template ("Open {kind} {name}") and kind labels in all three locales.
- **Acceptance**:
  - Keys present with parity (FR-180, NFR-8, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P6.2 relay:// parser and sanitizer
- **Kind**: implementation
- **Files** (1): `src/lib/relay/entityLinks.ts` (new)
- **Depends on**: P6.1
- **Do**: `parseRelayHref(href)` accepts only `relay://(request|collection|environment|chain)/<id>` with a strict id regex; everything else returns `null`. `resolveEntity(kind, id)` checks the stores and returns the entity or `null`. Pure parse, no execution of content.
- **Acceptance**:
  - Only the four kinds with a valid id are accepted; `javascript:` and unknown `relay://` kinds are rejected (FR-180, FR-182, AC-16).
  - Unknown/deleted ids resolve to `null` so callers render plain text (FR-180, AC-16).
  - Parsing never executes content (NFR-2).
- **Verify**:
  - `bunx biome check src/lib/relay/entityLinks.ts`

### ✅ P6.3 Shared openEntity helper
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tools/ui.ts`; `src/lib/relay/tools/ui.spec.ts`; `src/lib/relay/openEntity.ts` (new)
- **Depends on**: P6.2
- **Do**: Extract the logic behind the `open_item` tool in `ui.ts` into `openEntity(kind, id)` so the tool and the pill click share one implementation. The tool's behaviour and result shape are unchanged.
- **Acceptance**:
  - `open_item` and the pill click call the same function (FR-180).
  - Existing `open_item` specs pass unchanged (FR-180).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/ui.ts src/lib/relay/tools/ui.spec.ts src/lib/relay/openEntity.ts`
  - `bunx vitest run src/lib/relay/tools/ui.spec.ts`

### ✅ P6.4 EntityPill and markdown link renderer
- **Kind**: implementation
- **Files** (3): `src/components/relay/EntityPill.tsx` (new); `src/components/relay/RelayMarkdown.tsx`; `src/components/relay/RelayMarkdown.spec.tsx`
- **Depends on**: P6.3
- **Do**: `RelayMarkdown` gets a custom `a` renderer: valid resolvable `relay://` links render `EntityPill` (method badge for requests plus name, kind icon otherwise, accent colour, a button with accessible name that calls `openEntity`); unknown/deleted ids and unknown kinds render the plain label; every other scheme keeps the existing link sanitisation. No `dangerouslySetInnerHTML`.
- **Acceptance**:
  - `[GET users](relay://request/<valid id>)` renders a coloured pill with method badge that opens that request on click (FR-180, FR-181, AC-16).
  - Unknown id renders plain text; `javascript:` and unknown `relay://` kinds are not linkified (FR-180, FR-182, AC-16).
  - Pills are keyboard operable with visible focus (NFR-8); no raw HTML rendering (NFR-2).
- **Verify**:
  - `bunx biome check src/components/relay/EntityPill.tsx src/components/relay/RelayMarkdown.tsx src/components/relay/RelayMarkdown.spec.tsx`
  - `bunx vitest run src/components/relay/RelayMarkdown.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P6.5 Method and status colour in prose
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tokenize.ts` (new); `src/components/relay/RelayMarkdown.tsx`; `src/components/relay/RelayMarkdown.spec.tsx`
- **Depends on**: P6.4
- **Do**: Text-node pass wrapping HTTP method tokens and 3-digit status codes in spans. Before writing, grep for the existing method badge tokens (`src/hooks/useMethodTheme.ts`) and the response viewer's status colour map and reuse them; do not define new colours. Code blocks and inline code are skipped for method/status colouring. Inline code spans that look like file paths or URLs (working interpretation of "file-like references"; confirm with the user before starting if unsure) get the same accent colour as pills (FR-181). Text is always present (colour is never the only signal).
- **Acceptance**:
  - GET/POST and 404/500 tokens are colour-coded with text still present (FR-181, AC-16).
  - File-like inline references use the pill accent colour (FR-181).
  - Colours reuse the existing tokens and meet AA in light and dark (FR-181, NFR-8).
  - Tokens inside code blocks are untouched (FR-181).
- **Verify**:
  - `bunx biome check src/lib/relay/tokenize.ts src/components/relay/RelayMarkdown.tsx src/components/relay/RelayMarkdown.spec.tsx`
  - `bunx vitest run src/components/relay/RelayMarkdown.spec.tsx`

### ✅ P6.6 System prompt relay:// instruction
- **Kind**: implementation
- **Files** (2): `src/lib/relay/server/systemPrompt.ts`; `src/lib/relay/server/systemPrompt.spec.ts`
- **Depends on**: P6.2
- **Do**: Append an instruction to reference entities as `[Name](relay://request/<id>)` (also collection, environment, chain) using ids from tool results only. Append only; no restructure (SPEC Ask-first).
- **Acceptance**:
  - Prompt instructs `relay://` links with ids taken from tool results (FR-182).
  - `systemPrompt.spec.ts` asserts it; brand guard still passes (FR-182, NFR-3).
- **Verify**:
  - `bunx biome check src/lib/relay/server/systemPrompt.ts src/lib/relay/server/systemPrompt.spec.ts`
  - `bunx vitest run src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/brandGuard.spec.ts`

### ✅ P6.7 Unit: entity links, openEntity, tokenizer
- **Kind**: unit
- **Files** (4): `src/lib/relay/entityLinks.ts`; `src/lib/relay/openEntity.ts`; `src/lib/relay/tools/ui.ts`; `src/lib/relay/tokenize.ts`
- **Depends on**: P6.2, P6.3, P6.5
- **Do**: unit-test-engineer writes `entityLinks.spec.ts`, `openEntity.spec.ts`, `tokenize.spec.ts` (new) and extends `ui.spec.ts`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - `parseRelayHref` accepts only the four kinds with a strict id; `javascript:` and unknown kinds return `null`; unknown ids resolve to `null`; nothing is executed (FR-180, FR-182, NFR-2, AC-16).
  - `open_item` and the pill share `openEntity`; the tool's result shape is unchanged (FR-180).
  - Method and status tokens are wrapped with their text kept, code is skipped, and file-like inline code gets the pill accent (FR-181, AC-16).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/entityLinks.spec.ts src/lib/relay/openEntity.spec.ts src/lib/relay/tools/ui.spec.ts src/lib/relay/tokenize.spec.ts --coverage --coverage.include=src/lib/relay/entityLinks.ts --coverage.include=src/lib/relay/openEntity.ts --coverage.include=src/lib/relay/tools/ui.ts --coverage.include=src/lib/relay/tokenize.ts --coverage.reporter=text`

### ✅ P6.8 Unit: pills, markdown renderer, prompt instruction
- **Kind**: unit
- **Files** (3): `src/components/relay/EntityPill.tsx`; `src/components/relay/RelayMarkdown.tsx`; `src/lib/relay/server/systemPrompt.ts`
- **Depends on**: P6.4, P6.5, P6.6
- **Do**: unit-test-engineer writes `EntityPill.spec.tsx` (new, happy-dom header) and extends `RelayMarkdown.spec.tsx` and `systemPrompt.spec.ts`; `brandGuard.spec.ts` must stay green. Report source bugs instead of weakening tests.
- **Acceptance**:
  - A valid request link renders a pill with method badge and accessible name that calls `openEntity`; unknown ids render plain text; other schemes keep the existing sanitisation; no `dangerouslySetInnerHTML` (FR-180, FR-182, NFR-2, AC-16).
  - The prompt instructs `relay://` links with ids from tool results only (FR-182).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/EntityPill.spec.tsx src/components/relay/RelayMarkdown.spec.tsx src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/brandGuard.spec.ts --coverage --coverage.include=src/components/relay/EntityPill.tsx --coverage.include=src/components/relay/RelayMarkdown.tsx --coverage.include=src/lib/relay/server/systemPrompt.ts --coverage.reporter=text`

### ✅ P6.9 E2E: pills open tabs
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/relayRoutes.ts`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P6.7, P6.8
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-pills.feature.md`: REL-PILL-01..05
- **Spec**: `e2e/qa/relay/relay-improvements-pills.spec.ts`
- **Scenarios**:
  - `[REL-PILL-01] a valid request link renders a pill with method badge and clicking opens that request` @critical (AC-16)
  - `[REL-PILL-02] an unknown id renders plain label text with no link role` @high (AC-16)
  - `[REL-PILL-03] javascript: and unknown relay:// kinds are not linkified` @critical (AC-16, NFR-2)
  - `[REL-PILL-04] GET/POST and 404/500 tokens are colour-coded with their text present` @medium (AC-16)
  - `[REL-PILL-05] after the referenced request is deleted, reopening the thread renders the link as plain text` @medium (persistence)
- **Do**: Mocked reply text with `relay://` links from `relayRoutes.ts`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-16, FR-180, FR-181, FR-182.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P6.10 Checkpoint 6
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P6.1, P6.2, P6.3, P6.4, P6.5, P6.6, P6.7, P6.8, P6.9
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; no regression in markdown rendering or `open_item`.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 6**: all Phase 6 tasks ✅, Verify commands green, no regression.


## Phase 7: Rich replies, part 2 (code blocks)

**Adds:** Code blocks in Relay replies are syntax highlighted with a Copy button and an Apply action that puts the code into the current tab as body, variables or message, with Undo. The highlighter loads lazily so the main bundle does not grow.

**Try in UI:** Ask Relay for a JSON example: the block is highlighted and Copy puts it on the clipboard ; On an HTTP tab click Apply as body, confirm, then Undo to restore the old body ; Try Apply as variables with invalid JSON (disabled) and with no request tab open (disabled with a tooltip)

Lazy highlighter, copy, Apply as body / variables / message

### ✅ P7.1 SIGN-OFF: highlighter grammars (only if needed)
- **Kind**: gate
- **Files** (0): none (decision only)
- **Depends on**: P6.10
- **Gherkin**: none (decision only)
- **Do**: **NEEDS USER SIGN-OFF only if a new dependency is required** (SPEC Ask-first: "Adding dependencies"). `package.json` has `codemirror` and `@codemirror/lang-{javascript,json,java,php,python}` but no GraphQL, HTML, XML or shell grammar. Default plan: lazy-import the installed grammars (JSON/JS/TS) and render GraphQL/bash/HTML/XML with a plain-text fallback, which needs no dependency but only partly meets FR-183 "at minimum" languages. Ask the user via AskUserQuestion: (a) accept plain-text fallback for GraphQL/bash/HTML/XML, or (b) approve adding the specific small lazy grammars (name them from `bun pm ls` / registry check). Before asking, snapshot `git status --porcelain -- src messages package.json | shasum` into the Log (earlier phases are already committed per phase by the /build-phases orchestrator, so only Phase 7 work can show). Record the answer and the snapshot on the single Log line as `P7.1 sign-off: fallback|approved <packages>, YYYY-MM-DD; snapshot: <hash>` (`<hash>` is the 40 hex characters shasum printed, without the trailing `-`).
- **Acceptance**:
  - Decision and package list (if any) recorded with date (FR-183, NFR-5, SPEC section 7).
  - No file under `src/`, `messages/` or `package.json` is modified by this task.
- **Verify**:
  - `grep -cE "^- \*\*Log\*\*: .*P7\.1 sign-off: (fallback|approved).*, [0-9]{4}-[0-9]{2}-[0-9]{2}" agent_docs/relay-improvements/TASKS.md`  (expect 1)
  - `grep -cE "^- \*\*Log\*\*: .*P7\.1 sign-off: .*; snapshot: [0-9a-f]{40}( |$)" agent_docs/relay-improvements/TASKS.md`  (expect 1; the live hash is not recompared, the verifier runs after Phase 7 work has changed these paths)
- **Log**: P7.1 sign-off: fallback, 2026-10-16; snapshot: da39a3ee5e6b4b0d3255bfef95601890afd80709

### ✅ P7.2 Apply-as-code strings (and approved grammar packages)
- **Kind**: implementation
- **Files** (4): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`; `package.json` (only if P7.1 approved packages, with `bun.lock` regenerated)
- **Depends on**: P7.1
- **Do**: If P7.1 approved grammar packages, install exactly those with `bun add <pkgs>` first. Add Copy, "Apply as body", "Apply as variables", "Apply as message", the disabled reasons ("Invalid JSON", "Open a request tab to apply this") and the apply-confirm copy in all three locales.
- **Acceptance**:
  - Keys present with parity (FR-183, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P7.3 Lazy CodeBlock with highlighter and copy
- **Kind**: implementation
- **Files** (4): `src/components/relay/CodeBlock.tsx` (new); `src/lib/relay/codeHighlight.ts` (new); `src/components/relay/RelayMarkdown.tsx`; `src/components/relay/RelayMarkdown.spec.tsx`
- **Depends on**: P7.2
- **Do**: `codeHighlight.ts` dynamically imports the CodeMirror highlighter on first code block (per P7.1 outcome) and exposes a language map; `CodeBlock` shows highlighted code via `React.lazy` (plain text while loading and as fallback), a Copy button, and is wired into `RelayMarkdown` for fenced blocks. No code from this task is imported by the main bundle.
- **Acceptance**:
  - A fenced `json` block shows highlighting and a Copy button; JSON/JS/TS render highlighted, other languages per the P7.1 decision (FR-183, AC-17).
  - Highlighter and its grammars load only after the first code block renders (NFR-5).
  - Model output is never rendered as HTML (NFR-2); copy has an accessible name (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/CodeBlock.tsx src/lib/relay/codeHighlight.ts src/components/relay/RelayMarkdown.tsx src/components/relay/RelayMarkdown.spec.tsx`
  - `bunx vitest run src/components/relay/RelayMarkdown.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P7.4 Apply action per tab kind
- **Kind**: implementation
- **Files** (3): `src/lib/relay/applyCode.ts` (new); `src/components/relay/ApplyCodeAction.tsx` (new); `src/components/relay/CodeBlock.tsx`
- **Depends on**: P7.3, P5.2, P5.3
- **Do**: Pure `resolveApplyAction(activeTab, code)` returns `{label, field, disabledReason?}`: HTTP maps to body ("Apply as body"), GraphQL to variables (disabled with reason unless the code is valid JSON), WebSocket/Socket.IO to the tab `draft` ("Apply as message"), no request tab or a non-request tab disabled with a tooltip. `ApplyCodeAction` is confirm-gated in chat, updates only that field via `updateTabState`, records a `changeLog` Undo entry, and never sends or connects.
- **Acceptance**:
  - Label reads Apply as body / variables / message by tab type; each confirms then updates only that field and never sends (FR-183, D-2, AC-17).
  - Invalid JSON disables the GraphQL action with a reason; no request tab disables it with a tooltip (FR-183, AC-17).
  - Content is applied as data, never executed (NFR-2).
- **Verify**:
  - `bunx biome check src/lib/relay/applyCode.ts src/components/relay/ApplyCodeAction.tsx src/components/relay/CodeBlock.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P7.5 Unit: code blocks and apply action
- **Kind**: unit
- **Files** (5): `src/lib/relay/applyCode.ts`; `src/lib/relay/codeHighlight.ts`; `src/components/relay/CodeBlock.tsx`; `src/components/relay/ApplyCodeAction.tsx`; `src/components/relay/RelayMarkdown.tsx`
- **Depends on**: P7.3, P7.4
- **Do**: unit-test-engineer writes `applyCode.spec.ts`, `codeHighlight.spec.ts`, `CodeBlock.spec.tsx` and `ApplyCodeAction.spec.tsx` (new; happy-dom header on component specs) and extends `RelayMarkdown.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - `resolveApplyAction` maps HTTP to body, GraphQL to variables (disabled for invalid JSON), WebSocket/Socket.IO to message, and no request tab to disabled with a reason (FR-183, D-2, AC-17).
  - `ApplyCodeAction` confirms, updates only that field via `updateTabState`, records Undo, and never sends or connects (FR-183, NFR-2).
  - `CodeBlock` shows plain text while loading and as fallback, has a Copy button with an accessible name, and the highlighter is imported only on first use (FR-183, NFR-5, NFR-8).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/applyCode.spec.ts src/lib/relay/codeHighlight.spec.ts src/components/relay/CodeBlock.spec.tsx src/components/relay/ApplyCodeAction.spec.tsx src/components/relay/RelayMarkdown.spec.tsx --coverage --coverage.include=src/lib/relay/applyCode.ts --coverage.include=src/lib/relay/codeHighlight.ts --coverage.include=src/components/relay/CodeBlock.tsx --coverage.include=src/components/relay/ApplyCodeAction.tsx --coverage.include=src/components/relay/RelayMarkdown.tsx --coverage.reporter=text`

### ✅ P7.6 E2E: code blocks and apply
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/relayRoutes.ts`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P7.5
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-code.feature.md`: REL-CODE-01..05
- **Spec**: `e2e/qa/relay/relay-improvements-code.spec.ts`
- **Scenarios**:
  - `[REL-CODE-01] a fenced json block is highlighted and Copy puts the code on the clipboard` @high (AC-17)
  - `[REL-CODE-02] on an HTTP tab Apply as body confirms and updates only the body; nothing is sent` @critical (AC-17)
  - `[REL-CODE-03] Apply as variables works for valid JSON and is disabled for invalid JSON; Apply as message fills the WebSocket draft` @high (AC-17)
  - `[REL-CODE-04] with no request tab the apply button is disabled with a tooltip` @medium (empty)
  - `[REL-CODE-05] Undo after Apply as body restores the previous body` @medium (FR-183)
- **Do**: Mocked fenced blocks from `relayRoutes.ts`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-17, FR-183, D-2.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-code.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P7.7 Checkpoint 7 (includes bundle comparison)
- **Kind**: gate
- **Files** (1): `agent_docs/relay-improvements/BUNDLE.md`
- **Depends on**: P7.1, P7.2, P7.3, P7.4, P7.5, P7.6
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands. Rebuild in a scratch copy (see Decisions: `rsync` the working tree excluding `.next`, `node_modules` and `.git`, symlink `node_modules`, `bun run build` there only) and append an "After Phase 7" route-size table to `BUNDLE.md`.
- **Acceptance**:
  - All commands exit 0; main shared chunk and non-Relay route first-load JS show no growth versus the P0.1 baseline (NFR-5, AC-24).
  - Highlighter code appears only in the lazy Relay chunk (NFR-5, AC-24).
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-code.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `grep -c "After Phase 7" agent_docs/relay-improvements/BUNDLE.md`  (expect >= 1)
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 7**: all Phase 7 tasks ✅, sign-off recorded, bundle comparison shows no main-bundle growth, no regression.


## Phase 8: Quality of life (stop, regenerate, edit, copy, feedback, follow-ups)

**Adds:** Adds everyday chat controls: Stop for a streaming reply, Regenerate, Edit and resend your last message, Copy, thumbs up/down feedback (rating only, nothing stored), and up to three follow-up chips after a result.

**Try in UI:** Send a prompt and click Stop mid-stream: the reply halts and Send returns ; After an answer use Regenerate, Edit & resend and Copy ; Click a thumb: no text is collected ; After a 500 result click a follow-up chip: it sends and the chips clear

### ✅ P8.1 QoL strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P7.7
- **Do**: Add Stop, Regenerate, Edit & resend, Copy message, thumbs up/down names, follow-up chip labels (e.g. "Fix the request", "Explain headers") in all three locales.
- **Acceptance**:
  - Keys present with parity (FR-190, FR-191, FR-192, FR-196, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P8.2 Stop control
- **Kind**: implementation
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/hooks/useRelayChat.ts`; `src/hooks/useRelayChat.spec.ts`
- **Depends on**: P8.1
- **Do**: While `status` is streaming the stop control replaces send in the same slot (calling the existing `useRelayChat` `stop`); Esc behaviour for voice (P10) is not changed. Reuse the existing `stopControllersRef` abort path so a pending tool call is aborted; the mid-tool abort spec is written by Unit P8.8.
- **Acceptance**:
  - Stop replaces send while streaming and halts the stream and the pending tool (FR-190, AC-18).
  - No orphan pending tool calls remain after stop (FR-190, SPEC risk "stop leaves pending tools").
  - Stop has an accessible name and a >= 36px target (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayChat.spec.ts`

### ✅ P8.3 Feedback telemetry event
- **Kind**: implementation
- **Files** (2): `src/lib/relay/telemetry.ts`; `src/lib/relay/telemetry.spec.ts`
- **Depends on**: P8.1
- **Do**: Add `relay_feedback: { rating: "up" | "down" }` to `RelayEventMap`. The event carries no message text and nothing is persisted (Assumption 7: existing no-op pluggable sink).
- **Acceptance**:
  - `relay_feedback` is a typed event with rating only, emitted through the existing sink (FR-192, AC-19).
  - The emitted payload has no message text and nothing is written to storage (FR-192, AC-19, NFR-1); proven by Unit P8.8.
- **Verify**:
  - `bunx biome check src/lib/relay/telemetry.ts src/lib/relay/telemetry.spec.ts`
  - `bunx vitest run src/lib/relay/telemetry.spec.ts`

### ✅ P8.4 Message actions: copy, regenerate, thumbs
- **Kind**: implementation
- **Files** (3): `src/components/relay/MessageActions.tsx` (new); `src/components/relay/RelayConversation.tsx`; `src/components/relay/RelayConversation.spec.tsx`
- **Depends on**: P8.2, P8.3
- **Do**: Actions bar on assistant messages: Copy (plain markdown to clipboard), Regenerate (last assistant message only, calling `useRelayChat.regenerate`), thumbs up/down emitting `relay_feedback` with the rating only. Icon buttons have accessible names.
- **Acceptance**:
  - Copy puts the markdown on the clipboard; Regenerate replaces the last answer and appears only on the last assistant message (FR-191, AC-18).
  - Thumbs emit `relay_feedback` with rating and no message text (FR-192, AC-19).
  - Buttons keyboard operable with accessible names (NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/MessageActions.tsx src/components/relay/RelayConversation.tsx src/components/relay/RelayConversation.spec.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P8.5 Edit and resend last user message
- **Kind**: implementation
- **Files** (4): `src/components/relay/UserMessageActions.tsx` (new); `src/hooks/useRelayChat.ts`; `src/hooks/useRelayChat.spec.ts`; `src/components/relay/RelayConversation.tsx`
- **Depends on**: P8.4
- **Do**: On the last user message offer Edit & resend: inline edit, then trim `messages` through `setMessages` (dropping that message and everything after) and call `sendMessage` with the edited text. Offered only when not streaming.
- **Acceptance**:
  - Edit & resend replaces the last user message and drops later messages (FR-191, AC-18).
  - Only the last user message is editable and only while idle (FR-191).
- **Verify**:
  - `bunx biome check src/components/relay/UserMessageActions.tsx src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts src/components/relay/RelayConversation.tsx`
  - `bunx vitest run src/hooks/useRelayChat.spec.ts src/components/relay/RelayConversation.spec.tsx`

### ✅ P8.6 Follow-up chips derivation and UI
- **Kind**: implementation
- **Files** (3): `src/lib/relay/followUps.ts` (new); `src/components/relay/FollowUpChips.tsx` (new); `src/components/relay/RelayConversation.tsx`
- **Depends on**: P8.4, P2.4
- **Do**: Pure `followUps.ts` maps the last tool/result kinds to at most 3 chips (e.g. after a failing send: "Fix the request", "Explain headers"), with no extra model call, reusing `suggestions.ts` vocabulary where it fits. `FollowUpChips` renders under the last assistant answer.
- **Acceptance**:
  - At most 3 chips derived client-side from the last tool/result kinds, no model call (FR-196, AC-22).
  - Chips are keyboard operable and send their prompt on activation (FR-196, NFR-8).
- **Verify**:
  - `bunx biome check src/lib/relay/followUps.ts src/components/relay/FollowUpChips.tsx src/components/relay/RelayConversation.tsx`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx`

### ✅ P8.7 Follow-up chips clear on typing or send
- **Kind**: implementation
- **Files** (4): `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/stores/useRelayStore.ts`; `src/stores/useRelayStore.spec.ts`
- **Depends on**: P8.6
- **Do**: Add a transient (non-persisted) `composerHasText` flag set by the composer on change and cleared on send; `FollowUpChips` hides when it is true or a new turn starts. Keep the persisted payload spec from P2.2 green.
- **Acceptance**:
  - Follow-up chips disappear when the user types or sends (FR-196, AC-22).
  - Persisted store payload unchanged (NFR-10).
- **Verify**:
  - `bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/stores/useRelayStore.spec.ts`

### ✅ P8.8 Unit: stop, feedback, follow-ups, transient composer flag
- **Kind**: unit
- **Files** (4): `src/lib/relay/telemetry.ts`; `src/lib/relay/followUps.ts`; `src/hooks/useRelayChat.ts`; `src/stores/useRelayStore.ts`
- **Depends on**: P8.2, P8.3, P8.5, P8.6, P8.7
- **Do**: unit-test-engineer extends `telemetry.spec.ts`, `useRelayChat.spec.ts` and `useRelayStore.spec.ts`, and writes `followUps.spec.ts` (new). Report source bugs instead of weakening tests.
- **Acceptance**:
  - `relay_feedback` carries the rating only: the emitted payload has no message text and nothing is written to storage (spy on localStorage and IndexedDB) (FR-192, NFR-1, AC-19).
  - Stopping mid-tool aborts the stream and leaves no orphan pending tool call; edit and resend trims the dropped messages (FR-190, FR-191, AC-18).
  - `followUps` returns at most 3 chips per result kind without any model call (FR-196, AC-22).
  - `composerHasText` is transient and the persisted payload stays byte-for-byte unchanged (NFR-10).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/telemetry.spec.ts src/lib/relay/followUps.spec.ts src/hooks/useRelayChat.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/telemetry.ts --coverage.include=src/lib/relay/followUps.ts --coverage.include=src/hooks/useRelayChat.ts --coverage.include=src/stores/useRelayStore.ts --coverage.reporter=text`

### ✅ P8.9 Unit: message actions and follow-up chips UI
- **Kind**: unit
- **Files** (5): `src/components/relay/MessageActions.tsx`; `src/components/relay/UserMessageActions.tsx`; `src/components/relay/FollowUpChips.tsx`; `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayConversation.tsx`
- **Depends on**: P8.4, P8.5, P8.6, P8.7
- **Do**: unit-test-engineer writes `MessageActions.spec.tsx`, `UserMessageActions.spec.tsx` and `FollowUpChips.spec.tsx` (new, happy-dom header) and extends `RelayComposer.spec.tsx` and `RelayConversation.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - Copy writes markdown; Regenerate appears only on the last assistant message; thumbs emit `relay_feedback` with the rating only (FR-191, FR-192, AC-18, AC-19).
  - Edit & resend is offered only on the last user message while idle (FR-191).
  - Stop replaces send while streaming with an accessible name and a >= 36px target; follow-up chips (max 3) hide when the composer has text (FR-190, FR-196, NFR-8).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/MessageActions.spec.tsx src/components/relay/UserMessageActions.spec.tsx src/components/relay/FollowUpChips.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/RelayConversation.spec.tsx --coverage --coverage.include=src/components/relay/MessageActions.tsx --coverage.include=src/components/relay/UserMessageActions.tsx --coverage.include=src/components/relay/FollowUpChips.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/RelayConversation.tsx --coverage.reporter=text`

### ✅ P8.10 E2E: stop streaming
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P8.8, P8.9
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-qol-stop.feature.md`: REL-QOL-01, REL-QOL-07, REL-QOL-08
- **Spec**: `e2e/qa/relay/relay-improvements-qol-stop.spec.ts`
- **Scenarios**:
  - `[REL-QOL-01] Stop mid-stream halts the reply and send returns` @critical (AC-18)
  - `[REL-QOL-07] Stop during a pending tool call leaves no pending tool and the next prompt sends normally` @high (FR-190)
  - `[REL-QOL-08] a chat route error mid-stream shows the error and restores send` @medium (error)
- **Do**: Use the release-controlled stream from P1.5. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-18 (stop), FR-190.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-stop.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P8.11 E2E: regenerate and edit & resend
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P8.10
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-qol-rewrite.feature.md`: REL-QOL-02, REL-QOL-03, REL-QOL-09
- **Spec**: `e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts`
- **Scenarios**:
  - `[REL-QOL-02] Regenerate replaces the last answer` @high (AC-18)
  - `[REL-QOL-03] Edit & resend replaces the last user message and drops later messages` @high (AC-18)
  - `[REL-QOL-09] after Edit & resend a reload shows only the trimmed thread` @medium (persistence)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-18 (regenerate, edit), FR-191.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P8.12 E2E: copy and feedback
- **Kind**: e2e
- **Files** (0): none (no app or fixture change)
- **Depends on**: P8.11
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-qol-actions.feature.md`: REL-QOL-04, REL-QOL-05, REL-QOL-10
- **Spec**: `e2e/qa/relay/relay-improvements-qol-actions.spec.ts`
- **Scenarios**:
  - `[REL-QOL-04] Copy puts the answer's markdown on the clipboard` @high (AC-18)
  - `[REL-QOL-05] a thumbs click emits relay_feedback with the rating and no text, and nothing is stored` @critical (AC-19)
  - `[REL-QOL-10] message actions are hidden while streaming and appear when the answer completes` @medium (FR-191)
- **Do**: 05 installs a test sink and compares storage before and after. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-18 (copy), AC-19, FR-191, FR-192.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P8.13 E2E: follow-up chips
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P8.12
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-qol-followups.feature.md`: REL-QOL-06, REL-QOL-11, REL-QOL-12
- **Spec**: `e2e/qa/relay/relay-improvements-qol-followups.spec.ts`
- **Scenarios**:
  - `[REL-QOL-06] after a 500 result up to 3 follow-up chips appear and vanish on typing` @high (AC-22)
  - `[REL-QOL-11] clicking a follow-up chip sends its prompt and the chips clear` @high (FR-196)
  - `[REL-QOL-12] an answer with no tool result shows no follow-up chips` @medium (empty)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-22 (follow-up part), FR-196.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-followups.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P8.14 Checkpoint 8
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P8.1, P8.2, P8.3, P8.4, P8.5, P8.6, P8.7, P8.8, P8.9, P8.10, P8.11, P8.12, P8.13
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; no regression in chat and thread specs.
- **Verify**:
  - `bunx vitest run src/lib/relay src/components/relay src/hooks src/stores src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-improvements-qol-followups.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-threads.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 8**: all Phase 8 tasks ✅, Verify commands green, no regression.


## Phase 9: History management

**Adds:** The history panel gets a … menu with Export (JSON or HAR) and a red Clear all with a count, and Relay can clear or export history through chat, with a confirm card for clearing.

**Try in UI:** Open History and click the … menu: Export submenu and Clear all are listed ; Export JSON and HAR and open the downloaded files ; Click Clear all, check the count, Cancel keeps entries and Confirm clears them ; Ask Relay to export history: a file downloads

HAR/JSON export, clear, overflow menu, chat tools

### ✅ P9.1 History menu strings
- **Kind**: implementation
- **Files** (3): `messages/en/common.json`; `messages/fr/common.json`; `messages/ja/common.json`
- **Depends on**: P8.14
- **Do**: Add a `history` section: menu label, "Export history", JSON, HAR, "Clear all history", dialog title/body with `{count}` and "cannot be undone", confirm/cancel, the not-redacted note for exports, and the excluded note "{count} WebSocket/Socket.IO entries were not included" (note: the existing history UI hardcodes English; only the new strings are i18n'd here).
- **Acceptance**:
  - Keys present with parity (FR-150, FR-151, FR-152, NFR-9, AC-23).
  - No vendor/model names (NFR-3).
- **Verify**:
  - `bunx biome check messages/en/common.json messages/fr/common.json messages/ja/common.json`
  - `bunx vitest run src/i18n/messages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P9.2 HAR 1.2 builder
- **Kind**: implementation
- **Files** (1): `src/lib/history/exportHar.ts` (new)
- **Depends on**: P9.1
- **Do**: Pure `buildHar(entries)` returns `{ har, excludedCount }`. It maps `HistoryEntry` (method, url, status, duration, size, timestamp, request, response) to HAR 1.2 `log.entries` including request headers/query/body and response status/headers/content/timings. It includes only entries whose request `type` is HTTP or GraphQL and counts the rest in `excludedCount`; the filter keys off the request `type`, so it stays correct if more types are added (today `HistoryEntry.request` is `HttpTab`, so the count is 0).
- **Acceptance**:
  - Output has the required HAR 1.2 fields (`log.version` "1.2", `creator`, `entries[].startedDateTime/time/request/response/cache/timings`) proven by Unit P9.6 (FR-152, AC-13).
  - A fixture with WebSocket/Socket.IO typed entries yields them excluded with the exact count (FR-152, D-3, AC-13).
- **Verify**:
  - `bunx biome check src/lib/history/exportHar.ts`

### ✅ P9.3 Export and clear facade
- **Kind**: implementation
- **Files** (3): `src/lib/history/exportHistory.ts` (new); `src/lib/history/clearHistory.ts` (new); `src/lib/historyExport.ts`
- **Depends on**: P9.2
- **Do**: `exportHistory(format)` for `"json" | "har"` reads `useHistoryStore`, builds with the existing `exportHistoryAsJSON` (every entry) or `buildHar`, and downloads via the existing `downloadFile`, returning `{count, excludedCount}`; `clearHistory()` wraps the store's `clearHistory`. Update `buildExportFilename` in `src/lib/historyExport.ts` (line 75, currently the legacy `requestly-history-<date>.<ext>` prefix; the product and package name is `requestr`) to the SPEC name `requestr-history-<date>.<ext>` and extend `ExportFormat` with `"har"`. Because the helper is shared, the CSV export filename also becomes `requestr-history-<date>.csv` (one prefix for all formats). `historyExport.spec.ts` (filenames for csv/json/har) is written by Unit P9.6.
- **Acceptance**:
  - One implementation serves both the menu and the tools (FR-153).
  - Filename is `requestr-history-<date>.json|.har` (and `.csv`); no `requestly-history` string remains in `src/` (FR-151, AC-13).
  - JSON export includes every entry; HAR includes only HTTP/GraphQL entries with the excluded count returned (FR-152, D-3, AC-13).
  - Existing CSV export content is unchanged (non-regression; CSV is not in the SPEC).
- **Verify**:
  - `bunx biome check src/lib/history/exportHistory.ts src/lib/history/clearHistory.ts src/lib/historyExport.ts`
  - `bunx vitest run src/stores/useHistoryStore.spec.ts`
  - `test -z "$(grep -rn 'requestly-history' src)"`  (expect exit 0)

### ✅ P9.4 History actions menu and clear dialog
- **Kind**: implementation
- **Files** (4): `src/components/history/HistoryActionsMenu.tsx` (new); `src/components/history/ClearHistoryDialog.tsx` (new); `src/components/history/HistoryList.tsx`; `src/components/history/HistoryList.spec.tsx`
- **Depends on**: P9.3
- **Do**: The history panel is `src/components/history/HistoryList.tsx` (rendered by `LeftPanel.tsx`; it already has an Export dropdown with CSV and JSON). Replace that dropdown with `HistoryActionsMenu` (shadcn DropdownMenu "⋯"): Export history submenu (JSON, HAR, and the existing CSV), and a red "Clear all history" item that opens `ClearHistoryDialog` (shadcn AlertDialog) stating the count and that it cannot be undone; it clears only on confirm. Show the exact excluded-count note after a HAR export when above 0. The menu description states exports are not redacted. Exports in the menu cover the full history (not the current search filter that the old dropdown used), as FR-153 requires one function for menu and tool.
- **Acceptance**:
  - "⋯" menu has Export (JSON, HAR) and a red Clear all history; clear needs dialog confirmation and does nothing on cancel (FR-150, FR-151, AC-13).
  - Excluded note shows the exact count and is hidden when 0 (FR-152, AC-13).
  - Menu and dialog are keyboard operable with accessible names (NFR-8); CSV export still works (non-regression).
- **Verify**:
  - `bunx biome check src/components/history/HistoryActionsMenu.tsx src/components/history/ClearHistoryDialog.tsx src/components/history/HistoryList.tsx src/components/history/HistoryList.spec.tsx`
  - `bunx vitest run src/components/history src/components/layout/LeftPanel.spec.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P9.5 clear_history and export_history tools
- **Kind**: implementation
- **Files** (4): `src/lib/relay/tools/history.ts` (new); `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/gating.spec.ts`
- **Depends on**: P9.3
- **Do**: `clear_history` kind `destructive` (ConfirmCard with the count) and `export_history({format: "json" | "har"})` kind auto (triggers the download), both calling the P9.3 facade. Register with `kind`.
- **Acceptance**:
  - `clear_history` via chat requires the ConfirmCard and clears nothing until confirmed (FR-153, AC-13).
  - `export_history` downloads a file through the same function as the menu (FR-153, AC-13).
  - Both declare `kind` (NFR-4).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/history.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/gating.spec.ts`
  - `bunx vitest run src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/registry.spec.ts`

### ✅ P9.6 Unit: history export, clear and tools
- **Kind**: unit
- **Files** (4): `src/lib/history/exportHar.ts`; `src/lib/history/exportHistory.ts`; `src/lib/history/clearHistory.ts`; `src/lib/relay/tools/history.ts`
- **Depends on**: P9.2, P9.3, P9.5
- **Do**: unit-test-engineer writes `exportHar.spec.ts`, `exportHistory.spec.ts`, `src/lib/relay/tools/history.spec.ts` and `src/lib/historyExport.spec.ts` (all new). `src/lib/historyExport.ts` is excluded from coverage in `vitest.config.ts`, so it is not in the include list: its spec is the only evidence for it. Report source bugs instead of weakening tests.
- **Acceptance**:
  - HAR output has `log.version` "1.2", `creator`, and `entries[].startedDateTime/time/request/response/cache/timings` (FR-152, AC-13).
  - A fixture with WebSocket/Socket.IO typed entries is excluded with the exact `excludedCount`; JSON export keeps every entry (FR-152, D-3, AC-13).
  - `historyExport.spec.ts` asserts the filename `requestr-history-<date>.<ext>` for csv, json and har, and unchanged CSV content (FR-151, AC-13).
  - `clear_history` is `destructive` and `export_history` is auto; both call the same facade as the menu and return `{count, excludedCount}` (FR-153, NFR-4).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/history src/lib/relay/tools/history.spec.ts src/lib/historyExport.spec.ts src/lib/relay/tools/gating.spec.ts --coverage --coverage.include=src/lib/history/exportHar.ts --coverage.include=src/lib/history/exportHistory.ts --coverage.include=src/lib/history/clearHistory.ts --coverage.include=src/lib/relay/tools/history.ts --coverage.reporter=text`

### ✅ P9.7 Unit: history menu and clear dialog
- **Kind**: unit
- **Files** (3): `src/components/history/HistoryActionsMenu.tsx`; `src/components/history/ClearHistoryDialog.tsx`; `src/components/history/HistoryList.tsx`
- **Depends on**: P9.4
- **Do**: unit-test-engineer writes `HistoryActionsMenu.spec.tsx` and `ClearHistoryDialog.spec.tsx` (new, happy-dom header) and extends `HistoryList.spec.tsx`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - The "⋯" menu has Export (JSON, HAR, CSV) and a red Clear all history; the dialog states the count and that it cannot be undone, and Cancel clears nothing (FR-150, FR-151, AC-13).
  - The excluded note shows the exact count and is hidden at 0 (FR-152).
  - Menu and dialog are keyboard operable with accessible names (NFR-8).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/history --coverage --coverage.include=src/components/history/HistoryActionsMenu.tsx --coverage.include=src/components/history/ClearHistoryDialog.tsx --coverage.include=src/components/history/HistoryList.tsx --coverage.reporter=text`

### ✅ P9.8 E2E: history menu, export, clear
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P9.6, P9.7
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-history.feature.md`: REL-HIST-01..06
- **Spec**: `e2e/qa/relay/relay-improvements-history.spec.ts`
- **Scenarios**:
  - `[REL-HIST-01] the ⋯ menu lists Export (JSON, HAR) and a red Clear all` @high (AC-13)
  - `[REL-HIST-02] JSON export downloads requestr-history-<date>.json and HAR export parses with log.version 1.2` @critical (AC-13)
  - `[REL-HIST-03] Clear all shows the count; Cancel keeps entries and Confirm clears them` @critical (AC-13)
  - `[REL-HIST-04] chat clear_history needs the ConfirmCard and export_history downloads a file` @high (AC-13)
  - `[REL-HIST-05] with no history entries the menu still opens and Export produces a file with zero entries` @medium (empty)
  - `[REL-HIST-06] after Confirm clear, a reload still shows an empty history` @medium (persistence)
- **Do**: Seed history entries. The WebSocket/Socket.IO exclusion count is covered by P9.6 because `HistoryEntry` is HTTP-only today. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-13, FR-150, FR-151, FR-152, FR-153.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-history.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P9.9 Checkpoint 9
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P9.1, P9.2, P9.3, P9.4, P9.5, P9.6, P9.7, P9.8
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; existing history e2e still green.
- **Verify**:
  - `bunx vitest run src/lib/history src/lib/historyExport.spec.ts src/components/history src/lib/relay/tools src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-history.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/history.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 9**: all Phase 9 tasks ✅, Verify commands green, no regression.


## Phase 10: Voice dictation

**Adds:** Adds a microphone button to the Relay composer for voice dictation in browsers that support speech recognition: interim text streams into the text box and is never sent automatically. A short privacy note shows on first use.

**Try in UI:** In a browser with speech recognition, click the mic and speak: text streams into the box and nothing is sent ; Deny the mic permission: an inline error shows and the button resets ; Press Esc: dictation stops and the text stays ; In an unsupported browser no mic is shown

### ✅ P10.1 Voice strings
- **Kind**: implementation
- **Files** (3): `messages/en/relay.json`; `messages/fr/relay.json`; `messages/ja/relay.json`
- **Depends on**: P9.9
- **Do**: Add mic button names (start/stop dictation), listening state, error messages with a next step ("Microphone access is blocked. Allow it in your browser settings."), and the privacy note ("In some browsers, speech is processed by an online service from your browser's provider.") in all three locales, with no vendor names.
- **Acceptance**:
  - Keys present with parity (FR-172, FR-173, NFR-9, AC-23).
  - Privacy note and errors contain no vendor/model names (FR-173, NFR-3, AC-15).
- **Verify**:
  - `bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json`
  - `bunx vitest run src/i18n/relayMessages.parity.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P10.2 useSpeechDictation hook
- **Kind**: implementation
- **Files** (1): `src/hooks/useSpeechDictation.ts` (new)
- **Depends on**: P10.1
- **Do**: Hook returns `{supported, state, interim, start, stop, error}`. Feature detect `SpeechRecognition` / `webkitSpeechRecognition` inside `useEffect` after mount (no SSR/hydration mismatch). `lang` from the app locale map (en-US, fr-FR, ja-JP). Interim results stream, final text is committed; never calls send. Permission-denied and other errors set a typed error and return to idle. No external library.
- **Acceptance**:
  - `supported` is false when neither global exists; both prefixed and unprefixed globals work (FR-170, AC-15).
  - Interim text streams, final text commits and nothing is ever sent (FR-171, AC-15).
  - Errors map to a state `error` then idle; `stop` works (FR-172, AC-15).
  - Language follows the locale (FR-174).
- **Verify**:
  - `bunx biome check src/hooks/useSpeechDictation.ts`

### ✅ P10.3 MicButton in the composer
- **Kind**: implementation
- **Files** (4): `src/components/relay/MicButton.tsx` (new); `src/components/relay/RelayComposer.tsx`; `src/components/relay/RelayComposer.spec.tsx`; `src/stores/useRelayStore.ts`
- **Depends on**: P10.2, P8.2
- **Do**: `MicButton` renders `null` where unsupported, otherwise a button in the trailing slot beside send with states idle / listening (`aria-pressed`, pulsing indicator behind `motion-safe:`) / error (inline message with next step, returns to idle). Clicking again or pressing Esc stops. Interim text is merged with the base draft into the textfield. Only touch `useRelayStore` if the voice state must be shared with another component; otherwise keep it in the hook (NFR-10), and say so in the task log.
- **Acceptance**:
  - Mic appears only when supported and is absent otherwise (FR-170, AC-15).
  - Speaking streams interim text into the textfield and never auto-sends (FR-171, AC-15).
  - Denied permission shows the error with a next step and resets to idle; click or Esc stops (FR-172, AC-15).
  - `aria-pressed`, accessible name, reduced motion honoured, mic fits the 320px row (FR-172, FR-111, NFR-8).
- **Verify**:
  - `bunx biome check src/components/relay/MicButton.tsx src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/stores/useRelayStore.ts`
  - `bunx vitest run src/components/relay/RelayComposer.spec.tsx src/stores/useRelayStore.spec.ts`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P10.4 First-use privacy note
- **Kind**: implementation
- **Files** (2): `src/components/relay/SpeechPrivacyNote.tsx` (new); `src/components/relay/MicButton.tsx`
- **Depends on**: P10.3
- **Do**: On first use of the mic show a short note with the P10.1 copy; "seen" flag is per-session component state (decision recorded above), no storage and no schema change.
- **Acceptance**:
  - First start shows the note once per session; it contains no vendor names (FR-173, NFR-3, AC-15).
  - No persisted flag is introduced (NFR-10, SPEC section 7).
- **Verify**:
  - `bunx biome check src/components/relay/SpeechPrivacyNote.tsx src/components/relay/MicButton.tsx`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ✅ P10.5 Unit: dictation hook, mic button, privacy note
- **Kind**: unit
- **Files** (4): `src/hooks/useSpeechDictation.ts`; `src/components/relay/MicButton.tsx`; `src/components/relay/SpeechPrivacyNote.tsx`; `src/components/relay/RelayComposer.tsx`
- **Depends on**: P10.2, P10.3, P10.4
- **Do**: unit-test-engineer writes `useSpeechDictation.spec.ts`, `MicButton.spec.tsx` and `SpeechPrivacyNote.spec.tsx` (new, happy-dom header, mocked `SpeechRecognition`) and extends `RelayComposer.spec.tsx`. If P10.3 changed `src/stores/useRelayStore.ts`, add it to the include list and extend `useRelayStore.spec.ts` (still at most 5 files). Report source bugs instead of weakening tests.
- **Acceptance**:
  - `supported` is false without either global; prefixed and unprefixed globals work; `lang` follows the locale map (FR-170, FR-174, AC-15).
  - Interim text streams, final text commits, nothing is ever sent; errors go to `error` then idle; click or Esc stops (FR-171, FR-172, AC-15).
  - The mic renders `null` when unsupported and uses `aria-pressed`; the privacy note shows once per session with no storage and no vendor names (FR-170, FR-173, NFR-3, NFR-8).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/hooks/useSpeechDictation.spec.ts src/components/relay/MicButton.spec.tsx src/components/relay/SpeechPrivacyNote.spec.tsx src/components/relay/RelayComposer.spec.tsx --coverage --coverage.include=src/hooks/useSpeechDictation.ts --coverage.include=src/components/relay/MicButton.tsx --coverage.include=src/components/relay/SpeechPrivacyNote.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.reporter=text`

### ✅ P10.6 E2E: dictation with a stubbed SpeechRecognition
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/speechStub.ts` (new); `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P10.5
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-voice.feature.md`: REL-VOICE-01..05
- **Spec**: `e2e/qa/relay/relay-improvements-voice.spec.ts`
- **Scenarios**:
  - `[REL-VOICE-01] with the stub the mic shows, interim text streams into the textfield and nothing is sent` @critical (AC-15)
  - `[REL-VOICE-02] permission denied shows the inline error and the button returns to idle` @high (AC-15)
  - `[REL-VOICE-03] with both globals removed no mic is rendered` @high (AC-15)
  - `[REL-VOICE-04] the first-use note appears once and names no vendor` @medium (FR-173)
  - `[REL-VOICE-05] Esc stops dictation and keeps the dictated text unsent` @medium (FR-172)
- **Do**: `speechStub.ts` installs a controllable fake `SpeechRecognition` through `addInitScript`, plus a variant that removes both globals. Real-browser speech stays a manual check in P12.11. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-15, FR-170..174; no real microphone.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-voice.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P10.7 Checkpoint 10
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P10.1, P10.2, P10.3, P10.4, P10.5, P10.6
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands. Manual check in a real supporting browser is deferred to the user (needs a real microphone; not evidence for automation): record the request in the Log.
- **Acceptance**:
  - All commands exit 0; no regression in composer specs.
- **Verify**:
  - `bunx vitest run src/hooks src/components/relay src/i18n`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-layout.spec.ts --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)
- **Log**: (manual: dictate in a browser with SpeechRecognition support, deny permission once, confirm no auto-send; to be run by the user)
  - Manual mic check DEFERRED to the user (needs a real microphone).
  - 2026-10-17: vitest src/hooks src/components/relay src/i18n: 54 files, 1706 tests passed. Playwright voice+layout --repeat-each=2: 20 passed. check-ids.sh: OK. lint:check: clean (712 files). BRAND_GREP: exit 0.

🔶 **Checkpoint 10**: all Phase 10 tasks ✅, Verify commands green, no regression.


## Phase 11: New smart tools

**Adds:** Relay gains smart tools: import_curl and export_curl (secrets redacted), diff_responses, generate_tests with a /assert command, generate_docs, plus rename and move for environments and chains.

**Try in UI:** Paste a curl command and ask Relay to import it: a matching request is created ; Ask it to export a request as curl: the secret header shows redacted ; Ask for a diff of two responses and for generated tests (or type /assert), then Undo ; Ask it to rename an environment or move an item

curl, response diff, test generation, docs, renames

### ✅ P11.1 curl parse and export helpers
- **Kind**: implementation
- **Files** (1): `src/lib/relay/curl.ts` (new)
- **Depends on**: P10.7
- **Do**: Pure `parseCurl(text)` (method, url, headers, data, basic auth) returning a request draft or a structured error, and `buildCurl(request)` that routes headers/auth/body through `redact.ts` so secrets never appear. The curl corpus cases (Authorization, tokens in URL and body) are added to `redact.corpus.ts` by Unit P11.10.
- **Acceptance**:
  - A sample curl parses to the correct method/url/headers/body (FR-194, AC-21).
  - `buildCurl` output contains no secret values (FR-194, NFR-1, AC-21).
- **Verify**:
  - `bunx biome check src/lib/relay/curl.ts`
  - `bunx vitest run src/lib/relay/redact.spec.ts`

### ✅ P11.2 import_curl and export_curl tools
- **Kind**: implementation
- **Files** (4): `src/lib/relay/tools/smart.ts` (new); `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/gating.spec.ts`
- **Depends on**: P11.1
- **Do**: `import_curl({curl, collectionId?})` (auto) creates an HTTP request through the existing `create_request` path with `changeLog` Undo; `export_curl({requestId})` (auto, read-only) returns the redacted curl. Both declare `kind`.
- **Acceptance**:
  - `import_curl` on a sample curl creates the correct request; Undo removes it (FR-194, AC-21).
  - `export_curl` output contains no secret values (FR-194, NFR-1, AC-21).
  - Both register with `kind` (NFR-4).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/smart.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/gating.spec.ts`
  - `bunx vitest run src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/registry.spec.ts`

### ✅ P11.3 Response diff helper
- **Kind**: implementation
- **Files** (1): `src/lib/relay/responseDiff.ts` (new)
- **Depends on**: P11.1
- **Do**: Pure `diffResponses(a, b)` comparing status, headers and a structural body diff (JSON paths added/removed/changed), with named caps on entries and string length, passing values through `redact.ts`.
- **Acceptance**:
  - Reports status, header and body differences, capped (FR-194, AC-21).
  - Output is redacted (NFR-1).
- **Verify**:
  - `bunx biome check src/lib/relay/responseDiff.ts`

### ✅ P11.4 diff_responses tool
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tools/smart.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: P11.2, P11.3
- **Do**: `diff_responses({requestId, a, b})` (auto, read-only) loads two stored responses from `useHistoryStore`/response store and returns `diffResponses` output; an unknown index returns a structured `{ok:false, error}`. `smart.spec.ts` is written by Unit P11.11.
- **Acceptance**:
  - Reports status/header/body differences for two stored responses (FR-194, AC-21).
  - Registered with `kind` (NFR-4); invalid indexes return a structured error (FR-194).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/smart.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts`

### ✅ P11.5 Assertion builder
- **Kind**: implementation
- **Files** (1): `src/lib/relay/assertionBuilder.ts` (new)
- **Depends on**: P11.3
- **Do**: Grep the request model for where a request's tests/assertions live (`HttpTab` and `RequestModel` in `src/types/index.ts`; `ChainAssertion` in `src/types/chain.ts` is the chain shape) and build assertions (status, content-type, key JSON fields present) from the last response in that shape. Pure and capped.
- **Acceptance**:
  - Given a response, produces assertions in the request's real tests shape (FR-194, AC-21).
  - Output carries no secret values (NFR-1).
- **Verify**:
  - `bunx biome check src/lib/relay/assertionBuilder.ts`

### ✅ P11.6 generate_tests tool
- **Kind**: implementation
- **Files** (3): `src/lib/relay/tools/smart.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: P11.4, P11.5
- **Do**: `generate_tests({requestId})` (auto) builds assertions from the last response with `assertionBuilder`, applies them to the request's tests through the existing request-write path, and records `changeLog` Undo. `smart.spec.ts` is written by Unit P11.11.
- **Acceptance**:
  - Adds assertions to the request; Undo restores the previous tests (FR-194, AC-21).
  - Registered with `kind` (NFR-4).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/smart.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/changeLog.spec.ts`

### ✅ P11.7 generate_docs tool
- **Kind**: implementation
- **Files** (4): `src/lib/relay/collectionDocs.ts` (new); `src/lib/relay/tools/smart.ts`; `src/lib/relay/tools/registry.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: P11.6, P2.5
- **Do**: `buildCollectionDocs(summary)` renders markdown from `summarizeCollection` (cap 50 plus the "…and N more" tail), and `generate_docs({collectionId})` (auto, read-only) returns it; the reply presents it in chat with the Copy action from P7.3.
- **Acceptance**:
  - Returns markdown documentation for a collection built only from the capped summary (FR-194, FR-127).
  - Registered with `kind`; output is redacted (NFR-4, NFR-1).
- **Verify**:
  - `bunx biome check src/lib/relay/collectionDocs.ts src/lib/relay/tools/smart.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/schemas.ts`
  - `bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts`

### ✅ P11.8 rename_environment and rename_chain
- **Kind**: implementation
- **Files** (5): `src/lib/relay/tools/environmentWrite.ts`; `src/lib/relay/tools/environmentWrite.spec.ts`; `src/lib/relay/tools/chainWrite.ts`; `src/lib/relay/tools/chainWrite.spec.ts`; `src/lib/relay/tools/registry.ts`
- **Depends on**: P11.7
- **Do**: Create `rename_environment` and `rename_chain` (neither exists today: only `rename_collection` does) as kind confirm-or-auto matching `rename_collection`'s gating, with `changeLog` Undo. Register in the registry; add their input schemas next to the existing schemas of each write file.
- **Acceptance**:
  - Both tools rename and Undo restores the old name (FR-194).
  - Gating matches the existing rename tool and every tool has a `kind` (NFR-4).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/environmentWrite.ts src/lib/relay/tools/environmentWrite.spec.ts src/lib/relay/tools/chainWrite.ts src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/registry.ts`
  - `bunx vitest run src/lib/relay/tools/environmentWrite.spec.ts src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/registry.spec.ts`

### ✅ P11.9 move_item for environments and chains
- **Kind**: implementation
- **Files** (4): `src/lib/relay/tools/collectionWrite.ts`; `src/lib/relay/tools/collectionWrite.spec.ts`; `src/lib/relay/tools/schemas.ts`; `src/lib/relay/tools/registry.ts`
- **Depends on**: P11.8
- **Do**: Check whether the sidebar supports ordering/folders for environments and chains (Assumption 5). If an ordering action exists in `useEnvironmentsStore`/`useChainStore`, extend `move_item` to reorder; otherwise leave `move_item` unchanged and return a structured "rename only" error for those kinds. Record the finding in the task Log.
- **Acceptance**:
  - `move_item` extends to environments/chains only where the store supports ordering; otherwise it returns a structured unsupported result (FR-194, Assumption 5).
  - Existing request/collection `move_item` specs are unchanged and green (FR-194).
- **Verify**:
  - `bunx biome check src/lib/relay/tools/collectionWrite.ts src/lib/relay/tools/collectionWrite.spec.ts src/lib/relay/tools/schemas.ts src/lib/relay/tools/registry.ts`
  - `bunx vitest run src/lib/relay/tools/collectionWrite.spec.ts src/lib/relay/tools/registry.spec.ts`
- **Log**: (record finding)

### ✅ P11.10 Unit: curl, diff, assertion and docs helpers
- **Kind**: unit
- **Files** (5): `src/lib/relay/curl.ts`; `src/lib/relay/responseDiff.ts`; `src/lib/relay/assertionBuilder.ts`; `src/lib/relay/collectionDocs.ts`; `src/lib/relay/tools/schemas.ts`
- **Depends on**: P11.1, P11.3, P11.5, P11.7, P11.9
- **Do**: unit-test-engineer writes `curl.spec.ts`, `responseDiff.spec.ts`, `assertionBuilder.spec.ts`, `collectionDocs.spec.ts` (new), extends `schemas.spec.ts`, and adds curl cases (Authorization, tokens in URL and body) to `src/lib/relay/redact.corpus.ts` so `redact.spec.ts` covers them. Report source bugs instead of weakening tests.
- **Acceptance**:
  - A sample curl parses to the right method, url, headers and body; malformed input returns a structured error (FR-194, AC-21).
  - `buildCurl` output contains no value from the corpus curl cases (FR-194, NFR-1, AC-21).
  - `diffResponses` reports status, header and body differences, capped and redacted (FR-194, NFR-1).
  - Assertions match the request's real tests shape; docs are built only from the capped summary (FR-194, FR-127).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/curl.spec.ts src/lib/relay/responseDiff.spec.ts src/lib/relay/assertionBuilder.spec.ts src/lib/relay/collectionDocs.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/redact.spec.ts --coverage --coverage.include=src/lib/relay/curl.ts --coverage.include=src/lib/relay/responseDiff.ts --coverage.include=src/lib/relay/assertionBuilder.ts --coverage.include=src/lib/relay/collectionDocs.ts --coverage.include=src/lib/relay/tools/schemas.ts --coverage.reporter=text`

### ✅ P11.11 Unit: smart tools, renames, move_item
- **Kind**: unit
- **Files** (5): `src/lib/relay/tools/smart.ts`; `src/lib/relay/tools/environmentWrite.ts`; `src/lib/relay/tools/chainWrite.ts`; `src/lib/relay/tools/collectionWrite.ts`; `src/lib/relay/tools/registry.ts`
- **Depends on**: P11.2, P11.4, P11.6, P11.8, P11.9
- **Do**: unit-test-engineer writes `smart.spec.ts` (new) and extends `environmentWrite.spec.ts`, `chainWrite.spec.ts`, `collectionWrite.spec.ts` and `registry.spec.ts`; `gating.spec.ts` and `changeLog.spec.ts` must stay green. Report source bugs instead of weakening tests.
- **Acceptance**:
  - `import_curl` creates the request with Undo; `export_curl` is redacted; `diff_responses` reports status/header/body differences for two stored responses and returns a structured `{ok:false, error}` for unknown indexes; `generate_tests` adds assertions to the request and Undo restores the previous tests; `generate_docs` is read-only (FR-194, AC-21).
  - `rename_environment`/`rename_chain` rename with Undo and match `rename_collection` gating; `move_item` returns a structured unsupported result where the store has no ordering (FR-194, Assumption 5).
  - Every registered tool has a `kind` (NFR-4).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/lib/relay/tools/smart.spec.ts src/lib/relay/tools/environmentWrite.spec.ts src/lib/relay/tools/chainWrite.spec.ts src/lib/relay/tools/collectionWrite.spec.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts src/lib/relay/changeLog.spec.ts --coverage --coverage.include=src/lib/relay/tools/smart.ts --coverage.include=src/lib/relay/tools/environmentWrite.ts --coverage.include=src/lib/relay/tools/chainWrite.ts --coverage.include=src/lib/relay/tools/collectionWrite.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.reporter=text`

### ✅ P11.12 E2E: import curl
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/relayRoutes.ts`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P11.10, P11.11
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-smart-import.feature.md`: REL-SMART-01, REL-SMART-05
- **Spec**: `e2e/qa/relay/relay-improvements-smart-import.spec.ts`
- **Scenarios**:
  - `[REL-SMART-01] import_curl with a sample curl creates the matching request` @critical (AC-21)
  - `[REL-SMART-05] a malformed curl returns a recoverable error and creates nothing` @medium (error)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-21 (import), FR-194.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-smart-import.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P11.13 E2E: export curl
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P11.12
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-smart-export.feature.md`: REL-SMART-02, REL-SMART-06
- **Spec**: `e2e/qa/relay/relay-improvements-smart-export.spec.ts`
- **Scenarios**:
  - `[REL-SMART-02] export_curl replies with the curl and the secret header redacted` @critical (AC-21, NFR-1)
  - `[REL-SMART-06] export_curl for an unknown request id shows a recoverable error` @medium (error)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-21 (export), FR-194, NFR-1.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-smart-export.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P11.14 E2E: diff responses
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P11.13
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-smart-diff.feature.md`: REL-SMART-03, REL-SMART-07
- **Spec**: `e2e/qa/relay/relay-improvements-smart-diff.spec.ts`
- **Scenarios**:
  - `[REL-SMART-03] diff_responses reports the differing status and a changed body field` @high (AC-21)
  - `[REL-SMART-07] two identical responses report no differences` @medium (empty)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-21 (diff), FR-194.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-smart-diff.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P11.15 E2E: generate tests and /assert
- **Kind**: e2e
- **Files** (1): `e2e/fixtures/relayRoutes.ts`
- **Depends on**: P11.14, P3.6
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-smart-tests.feature.md`: REL-SMART-04, REL-SMART-08
- **Spec**: `e2e/qa/relay/relay-improvements-smart-tests.spec.ts`
- **Scenarios**:
  - `[REL-SMART-04] generate_tests adds assertions and Undo restores them; /assert produces the prompt answered with generate_tests` @high (AC-21, AC-20)
  - `[REL-SMART-08] generated assertions are still on the request after a reload` @medium (persistence)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-21 (tests), AC-20 link, FR-194.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ✅ P11.16 Checkpoint 11
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P11.1, P11.2, P11.3, P11.4, P11.5, P11.6, P11.7, P11.8, P11.9, P11.10, P11.11, P11.12, P11.13, P11.14, P11.15
- **Gherkin**: none (verification only)
- **Do**: Run the phase checkpoint commands; fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; registry `kind` spec green; redact corpus extended with curl cases is green (NFR-1, NFR-4).
- **Verify**:
  - `bunx vitest run src/lib/relay`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-smart-import.spec.ts e2e/qa/relay/relay-improvements-smart-export.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-confirm.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `bun run lint:check`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

🔶 **Checkpoint 11**: all Phase 11 tasks ✅, Verify commands green, no regression.


## Phase 12: Hardening

**Adds:** Final hardening with no new feature: keyboard and screen-reader accessibility (axe scan, 36px touch targets), render-count and memoization fixes, a brand and translation parity sweep, and the final bundle comparison.

**Try in UI:** No new screen. Tab through Relay with the keyboard only (picker, slash menu, pills, history menu) and check Esc returns focus ; Check the mic toggles with aria-pressed ; Inspect agent_docs/relay-improvements/TASKS.md P12.4 output for the final bundle table and run bun run lint:check

Accessibility, memoization, parity and brand sweep, bundle, final checks

### ☐ P12.1 SIGN-OFF: axe dependency for AC-25
- **Kind**: gate
- **Files** (0): none (decision only)
- **Depends on**: P11.16
- **Gherkin**: none (decision only)
- **Do**: **NEEDS USER SIGN-OFF** (SPEC Ask-first: "Adding dependencies"). AC-25 requires an axe check, but `package.json` has no axe package. Ask the user via AskUserQuestion whether to add `@axe-core/playwright` as a devDependency (`bun add -d @axe-core/playwright`), or to accept role/name and tab-order assertions in Playwright as the substitute (which does not literally satisfy the AC-25 "axe check" wording; say so in the question). Before asking, snapshot `git status --porcelain -- package.json bun.lock | shasum` into the Log (a P7.1-approved dependency, if any, is already in the Phase 7 commit made by the /build-phases orchestrator). Record the answer and the snapshot on the single Log line as `P12.1 sign-off: approved|substitute, YYYY-MM-DD; snapshot: <hash>` (`<hash>` is the 40 hex characters shasum printed, without the trailing `-`); the dependency itself is installed by P12.8, not here.
- **Acceptance**:
  - Decision recorded with date (AC-25, SPEC section 7).
  - `package.json` and `bun.lock` are unchanged by this task.
- **Verify**:
  - `grep -cE "^- \*\*Log\*\*: .*P12\.1 sign-off: (approved|substitute), [0-9]{4}-[0-9]{2}-[0-9]{2}" agent_docs/relay-improvements/TASKS.md`  (expect 1)
  - `grep -cE "^- \*\*Log\*\*: .*P12\.1 sign-off: .*; snapshot: [0-9a-f]{40}( |$)" agent_docs/relay-improvements/TASKS.md`  (expect 1; the live hash is not recompared, the verifier runs after P12.8 may have changed these paths)
- **Log**: (pending user answer)

### ☐ P12.2 Memoization and re-render audit
- **Kind**: implementation
- **Files** (3): `src/components/relay/RelayConversation.tsx`; `src/components/relay/ContextChips.tsx`; `src/lib/relay/chips.ts`
- **Depends on**: P11.16
- **Do**: Fix any offending selector or missing memo so a tab switch re-renders the chip row but not the conversation message list (smallest change, no speculative memoization). The render-count specs are written by Unit P12.5.
- **Acceptance**:
  - Tab switch does not re-render the whole conversation; chip and suggestion derivation is memoized from store selectors (NFR-7).
  - Existing behaviour specs stay green (FR-121).
- **Verify**:
  - `bunx biome check src/components/relay/RelayConversation.tsx src/components/relay/ContextChips.tsx src/lib/relay/chips.ts`
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/ContextChips.spec.tsx src/lib/relay`

### ☐ P12.3 Brand guard and i18n parity spec sweep
- **Kind**: implementation
- **Files** (3): `src/lib/relay/brandGuard.spec.ts`; `src/i18n/relayMessages.parity.spec.ts`; `src/i18n/messages.parity.spec.ts`
- **Depends on**: P11.16
- **Do**: Extend existing specs only, no new spec files (there is no source file under test, so there is no per-file coverage target). Extend the brand guard spec so its scan covers the new surfaces (`src/lib/history`, `src/components/history`, `src/hooks/useSpeechDictation.ts`, new messages in `common.json`/`navigation.json`, new e2e fixtures such as `speechStub.ts`) and the new fixture strings; confirm the parity specs cover the `history` and `breadcrumbHome` keys, extending them if they do not.
- **Acceptance**:
  - Brand guard and parity specs pass for en/fr/ja including every new string (NFR-3, NFR-9, AC-23).
  - A deliberately banned token in a temp fixture makes the guard fail (checked in the spec, not left in the repo) (NFR-3).
  - No `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx biome check src/lib/relay/brandGuard.spec.ts src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts`
  - `bunx vitest run src/lib/relay/brandGuard.spec.ts src/i18n`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ☐ P12.4 Final bundle comparison
- **Kind**: implementation
- **Files** (1): `agent_docs/relay-improvements/BUNDLE.md`
- **Depends on**: P12.2, P12.3
- **Do**: In a scratch copy of the working tree (see Decisions; never at the repo root, the dev server is running) run `bun run build`, append a "Final" route-size table and the Relay chunk contents check (highlighter and speech code present only in the lazy Relay chunk) to `BUNDLE.md`, and state the delta against the P0.1 baseline.
- **Acceptance**:
  - No growth in main/shared chunks or non-Relay route first-load JS versus baseline (NFR-5, AC-24).
  - Highlighter and speech code are confirmed only in the lazy Relay chunk (NFR-5, AC-24).
- **Verify**:
  - `grep -c "Final" agent_docs/relay-improvements/BUNDLE.md`  (expect >= 1)
  - `git diff --stat -- package.json`  (expect empty unless a sign-off approved a dependency)

### ☐ P12.5 Unit: memoization render counts
- **Kind**: unit
- **Files** (3): `src/components/relay/RelayConversation.tsx`; `src/components/relay/ContextChips.tsx`; `src/lib/relay/chips.ts`
- **Depends on**: P12.2
- **Do**: unit-test-engineer adds render-count specs to `RelayConversation.spec.tsx` and `ContextChips.spec.tsx` and extends `chips.spec.ts`. Report source bugs instead of weakening tests.
- **Acceptance**:
  - A tab switch re-renders the chip row but not the conversation message list; chip and suggestion derivation is memoized from store selectors (NFR-7).
  - Existing behaviour specs stay green (FR-121).
  - Each listed file reaches >= 80% lines, branches, functions and statements in the scoped run (target > 95%), and the run also passes the `vitest.config.ts` thresholds (lines 90, branches 70, functions 90, statements 85; `src/lib/**` lines 85; `src/stores/**` 90; `src/hooks/**` 95).
  - Specs that render components or hooks start with `// @vitest-environment happy-dom`; no `.skip`, `.only`, `.fixme`, `it.fails` or `test.fail`.
- **Verify**:
  - `bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/ContextChips.spec.tsx src/lib/relay/chips.spec.ts --coverage --coverage.include=src/components/relay/RelayConversation.tsx --coverage.include=src/components/relay/ContextChips.tsx --coverage.include=src/lib/relay/chips.ts --coverage.reporter=text`

### ☐ P12.6 E2E: keyboard walkthrough
- **Kind**: e2e
- **Files** (2): `e2e/fixtures/seed/relay-improvements.json`; `e2e/fixtures/qa-seed.init.js` (generated)
- **Depends on**: P12.3, P12.4, P12.5
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md`: REL-IA11Y-01, REL-IA11Y-06
- **Spec**: `e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts`
- **Scenarios**:
  - `[REL-IA11Y-01] keyboard only: "+" picker, slash menu, pill Enter, history ⋯ and Export submenu` @critical (AC-25)
  - `[REL-IA11Y-06] Esc from the picker, slash menu and history menu returns focus to the trigger` @medium (NFR-8)
- **Do**: The id prefix is REL-IA11Y because REL-A11Y already exists in `relay-a11y.feature.md`. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-25 (keyboard), NFR-8.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `bun run qa:seed:build`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P12.7 E2E: mic toggle accessibility
- **Kind**: e2e
- **Files** (0): none (reuses `speechStub.ts` from P10.6)
- **Depends on**: P12.6
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-a11y-mic.feature.md`: REL-IA11Y-02
- **Spec**: `e2e/qa/relay/relay-improvements-a11y-mic.spec.ts`
- **Scenarios**:
  - `[REL-IA11Y-02] the mic is reachable by keyboard and aria-pressed toggles with the speech stub` @high (FR-172, NFR-8)
- **Do**: Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers FR-172, NFR-8.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-mic.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P12.8 E2E: axe scan or accessible names
- **Kind**: e2e
- **Files** (1): `package.json` (only if P12.1 approved, with `bun.lock` regenerated)
- **Depends on**: P12.7
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-a11y-axe.feature.md`: REL-IA11Y-03, REL-IA11Y-07
- **Spec**: `e2e/qa/relay/relay-improvements-a11y-axe.spec.ts`
- **Scenarios**:
  - `[REL-IA11Y-03] the Relay panel has no serious or critical axe violations (or, per P12.1, every icon button and the live region have accessible names)` @critical (AC-25)
  - `[REL-IA11Y-07] the same check passes in the dark theme` @medium (NFR-8)
- **Do**: If P12.1 approved, run `bun add -d @axe-core/playwright` first. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-25 (axe), NFR-8.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-axe.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P12.9 E2E: composer row geometry and touch targets
- **Kind**: e2e
- **Files** (0): none (reuses `speechStub.ts` from P10.6)
- **Depends on**: P12.8
- **Gherkin**: `e2e/scenarios/relay/relay-improvements-a11y-layout.feature.md`: REL-IA11Y-04, REL-IA11Y-05
- **Spec**: `e2e/qa/relay/relay-improvements-a11y-layout.spec.ts`
- **Scenarios**:
  - `[REL-IA11Y-04] composer buttons have >= 36px touch targets at mobile sheet width` @high (NFR-8)
  - `[REL-IA11Y-05] at 320px, 400px and mobile sheet width "+" is left of the textarea and mic and send are right of it, on one row` @high (AC-03, FR-111)
- **Do**: 05 uses the speech stub and bounding boxes, completing AC-03 now that "+" (P3.4) and mic (P10.3) exist. Run against the already-running dev server: the `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000` prefix disables the Playwright `webServer` block, so it never runs `bun run build` over the dev server and does not auto-start the Socket.IO echo on :3333 (start it with ECHO_START (see Decisions) only for specs that connect to it; this one does not).
- **Acceptance**:
  - Covers AC-03 (full row), FR-111, NFR-8.
  - One `test()` per scenario ID, title starting with its `[REL-…]` id, tagged `@qa` plus the listed priority tag via Playwright's `tag` option; uses `seededPage` and hermetic `relayRoutes.ts` mocks; no `waitForTimeout`; `getByTestId` first; web-first assertions.
  - Feature file and spec pass `check-ids.sh`; flake-free at `--repeat-each=5`, zero retries-to-green.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-layout.spec.ts --repeat-each=5`
  - `bash e2e/scenarios/relay/check-ids.sh`

### ☐ P12.10 Checkpoint 12
- **Kind**: gate
- **Files** (0): none (verification only)
- **Depends on**: P12.1, P12.2, P12.3, P12.4, P12.5, P12.6, P12.7, P12.8, P12.9
- **Gherkin**: none (verification only)
- **Do**: Run the full set of improvement specs plus the static checks. Per-task `bun run typecheck` already ran after each implementation task; this is the full-gate `bunx tsc --noEmit` run over the finished feature. Fix forward in the owning task.
- **Acceptance**:
  - All commands exit 0; flake-free at `--repeat-each=2` with zero retries-to-green.
  - Existing Relay and chain suites are green (no regression).
- **Verify**:
  - `bunx vitest run --coverage`
  - `bunx tsc --noEmit`
  - `bun run lint:check`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay --repeat-each=2`
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/chain.spec.ts e2e/qa/chaining-ui-overhaul.spec.ts e2e/qa/parallel-merge.spec.ts`
  - `bash e2e/scenarios/relay/check-ids.sh`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)

### ☐ P12.11 Final walkthrough of the seeded QA suites
- **Kind**: walkthrough
- **Files** (0): none (verification only)
- **Depends on**: P12.10
- **Do**: Run every `relay-improvements-*` QA spec end to end against the already-running server and tick each acceptance criterion AC-01..AC-25 against a passing scenario ID or unit spec in the coverage table. Manual checks that automation cannot cover are listed for the user in the Log (real-browser dictation, a visual light/dark pass of the Jump pill and pills). Record any failing scenario as a bug task rather than editing assertions.
- **Acceptance**:
  - Every AC-01..AC-25 maps to at least one green scenario or unit spec in the coverage table.
  - Full run is green with `--repeat-each=2` and zero retries-to-green.
  - `agent-browser` is not used as evidence.
- **Verify**:
  - `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay --repeat-each=2`
  - `bash e2e/scenarios/relay/check-ids.sh`
- **Log**: (manual checks for the user: dictation in a supporting browser; light/dark visual pass)

### ☐ P12.12 Definition of done
- **Kind**: dod
- **Files** (0): none (verification only)
- **Depends on**: P12.11
- **Do**: Final static checks and sign-off. Do not commit here: the /build-phases orchestrator makes the Phase 12 commit after verifier PASS. Produce the Implementation Summary in the format required by the user's CLAUDE.md (Feature name, Verification Steps from the acceptance criteria a user can follow in the browser).
- **Acceptance**:
  - `bun run lint:check`, `bunx tsc --noEmit`, `bunx vitest run` all exit 0.
  - Brand guard spec passes and BRAND_GREP is clean (NFR-3, AC-23).
  - The coverage table has no uncovered FR/AC; all three sign-offs (P5.1, P7.1, P12.1) are recorded.
- **Verify**:
  - `bun run lint:check`
  - `bunx tsc --noEmit`
  - `bunx vitest run`
  - `test -z "$(grep -rniE 'deepseek|openai|anthropic|claude|gpt' messages/en/relay.json messages/fr/relay.json messages/ja/relay.json messages/en/common.json messages/fr/common.json messages/ja/common.json messages/en/navigation.json messages/fr/navigation.json messages/ja/navigation.json src/components/relay src/components/history src/lib/relay src/lib/history src/lib/historyExport.ts src/hooks/useRelayChat.ts src/hooks/useRelayPickerItems.ts src/hooks/useSpeechDictation.ts src/stores/useRelayStore.ts e2e/fixtures/relayRoutes.ts e2e/fixtures/speechStub.ts e2e/fixtures/seed/relay-improvements.json --exclude-dir=server --exclude='*.spec.ts*' 2>/dev/null)"`  (BRAND_GREP; expect exit 0)


🔶 **Checkpoint 12**: all Phase 12 tasks ✅ (P12.10 gate, P12.11 walkthrough, P12.12 DoD), Verify commands green, no regression.


## Coverage

Every SPEC requirement maps to the tasks that deliver it and the evidence that proves it (scenario IDs live in `e2e/qa/relay/relay-improvements-<area>.spec.ts`; unit specs sit next to source and are written by each phase's Unit tasks). P12.11 ticks each row against a green run.

| Requirement | Tasks | Evidence |
|---|---|---|
| FR-101, FR-102 | P1.2, P1.3, P1.4, P1.5 | REL-LOAD-01; `activity.spec.ts` |
| FR-103 | P1.1, P1.2, P1.4, P1.5 | `stepLabels.spec.ts`; REL-LOAD-01 |
| FR-104 | P1.3, P1.4, P1.5 | REL-LOAD-02, REL-LOAD-03 |
| FR-110 | P0.4, P0.9, P0.10 | REL-LAYOUT-01 |
| FR-111 | P0.5, P3.4, P10.3, P0.9, P0.10, P3.8, P10.5, P12.9 | REL-LAYOUT-02, REL-IA11Y-05 |
| FR-112 | P0.6, P0.7, P0.9, P0.10 | REL-LAYOUT-03 |
| FR-120, FR-121 | P2.1, P2.3, P12.2, P2.6, P2.7, P2.8, P12.5 | REL-ICTX-01 |
| FR-122 | P2.2, P2.6, P2.8 | REL-ICTX-02; `useRelayStore.spec.ts` |
| FR-123 | P2.4, P2.6, P2.7, P2.9 | REL-ICTX-02 |
| FR-124 | P3.2, P3.3, P3.4, P3.7, P3.8, P3.9 | REL-PICK-01 |
| FR-125 | P3.2, P3.3, P3.7, P3.8, P3.9 | REL-PICK-02 |
| FR-126 | P2.5, P3.3, P2.6, P3.8, P2.10 | REL-ICTX-04; `RelayPicker.spec.tsx` ("values hidden") |
| FR-127 | P2.5, P2.6, P2.10 | REL-ICTX-05 |
| FR-128 | P2.3, P3.4, P2.7, P3.8, P2.8, P3.9 | REL-PICK-01; `ContextChips.spec.tsx` |
| FR-130 | P4.2, P4.6, P4.8 | REL-TAB-01, REL-TAB-02 |
| FR-131 | P4.3, P4.6, P4.7, P4.8 | REL-TAB-03, REL-TAB-04 |
| FR-132 | P4.4, P4.6, P4.7, P4.8 | REL-TAB-05; `destructive.spec.ts` |
| FR-133 | P4.5, P4.6, P4.8 | `destructive.spec.ts`, `collectionWrite.spec.ts` |
| FR-140 | P5.5, P5.8, P5.10 | REL-KIND-01..03 |
| FR-141 | P5.4, P5.5, P5.8, P5.10 | REL-KIND-01; `schemas.spec.ts` |
| FR-142 | P5.1, P5.2, P5.4, P5.5, P5.8, P5.9, P5.10 | REL-KIND-02; `WebSocketTabs.spec.tsx` |
| FR-143 | P5.1, P5.3, P5.4, P5.5, P5.8, P5.9, P5.10 | REL-KIND-03; `SocketIOTabs.spec.tsx` |
| FR-144 | P5.4, P5.6, P5.8, P5.10 | REL-KIND-04; `tabRequests.spec.ts` |
| FR-145 | P5.7, P5.8 | `systemPrompt.spec.ts` |
| FR-150 | P9.1, P9.4, P9.7, P9.8 | REL-HIST-01 |
| FR-151 | P9.3, P9.4, P9.6, P9.7, P9.8 | REL-HIST-02, REL-HIST-03; `historyExport.spec.ts` (filenames) |
| FR-152 | P9.2, P9.3, P9.4, P9.6, P9.7, P9.8 | REL-HIST-02; `exportHar.spec.ts` (excluded count); `HistoryActionsMenu.spec.tsx` (note) |
| FR-153 | P9.3, P9.5, P9.6, P9.8 | REL-HIST-04 |
| FR-160 | P0.2, P0.3, P0.8, P0.10 | REL-LAYOUT-04; `breadcrumbHome.spec.tsx` |
| FR-170, FR-171 | P10.2, P10.3, P10.5, P10.6 | REL-VOICE-01, REL-VOICE-03 |
| FR-172 | P10.2, P10.3, P10.5, P10.6, P12.7 | REL-VOICE-02, REL-IA11Y-02 |
| FR-173 | P10.1, P10.4, P10.5, P10.6 | REL-VOICE-04 |
| FR-174 | P10.2, P10.5 | `useSpeechDictation.spec.ts` |
| FR-180 | P6.2, P6.3, P6.4, P6.7, P6.8, P6.9 | REL-PILL-01, REL-PILL-02 |
| FR-181 | P6.4, P6.5, P6.7, P6.9 | REL-PILL-04; `tokenize.spec.ts` |
| FR-182 | P6.2, P6.4, P6.6, P6.7, P6.8, P6.9 | REL-PILL-03; `systemPrompt.spec.ts` |
| FR-183 | P7.1, P7.2, P7.3, P7.4, P7.5, P7.6 | REL-CODE-01..04 |
| FR-190 | P8.2, P8.8, P8.9, P8.10 | REL-QOL-01 |
| FR-191 | P8.4, P8.5, P8.8, P8.9, P8.11, P8.12 | REL-QOL-02..04 |
| FR-192 | P8.3, P8.4, P8.8, P8.9, P8.12 | REL-QOL-05 |
| FR-193 | P3.5, P3.6, P3.7, P3.8, P3.9 | REL-PICK-03, REL-PICK-04 |
| FR-194 | P11.1..P11.9, P11.10, P11.11, P11.12, P11.13, P11.14, P11.15 | REL-SMART-01..04; `collectionDocs.spec.ts`, `environmentWrite.spec.ts`, `chainWrite.spec.ts`, `collectionWrite.spec.ts` |
| FR-195 | P2.4, P2.6, P2.9 | REL-ICTX-03; `suggestions.spec.ts` |
| FR-196 | P8.6, P8.7, P8.8, P8.9, P8.13 | REL-QOL-06 |
| NFR-1 | P2.5, P4.2, P5.6, P8.3, P11.1..P11.7, P2.6, P2.10, P11.10, P11.13 | `redact.spec.ts` (corpus), REL-ICTX-04, REL-SMART-02 |
| NFR-2 | P6.2, P6.4, P7.3, P7.4, P6.7, P6.8, P7.5, P6.9 | `entityLinks.spec.ts`, REL-PILL-03 |
| NFR-3 | every strings task, P12.3 | `brandGuard.spec.ts`; BRAND_GREP at every gate |
| NFR-4 | P4.2, P4.4, P5.5, P9.5, P11.2..P11.8, P4.6, P5.8, P9.6, P11.11 | `registry.spec.ts`, `gating.spec.ts` |
| NFR-5 | P0.1, P7.3, P7.7, P12.4, P7.5 | `BUNDLE.md` (Baseline, After Phase 7, Final) |
| NFR-6 | P3.2, P3.3, P3.7, P3.8, P3.9 | REL-PICK-02 |
| NFR-7 | P2.3, P12.2, P2.6, P12.5 | render-count specs in `RelayConversation.spec.tsx`, `ContextChips.spec.tsx` |
| NFR-8 | every UI task, P12.6, P12.7, P12.8, P12.9 | REL-IA11Y-01..05 |
| NFR-9 | every strings task, P12.3 | `messages.parity.spec.ts`, `relayMessages.parity.spec.ts` |
| NFR-10 | P2.2, P3.5, P8.7, P10.3, P2.6, P8.8 | `useRelayStore.spec.ts` (persisted payload unchanged) |
| AC-01 | P1.3, P1.4, P1.5 | REL-LOAD-01..03 |
| AC-02 | P0.4, P0.9, P0.10 | REL-LAYOUT-01 |
| AC-03 | P0.5, P3.4, P10.3, P0.9, P0.10, P12.9 | REL-LAYOUT-02, REL-IA11Y-05 |
| AC-04 | P0.7, P0.9, P0.10 | REL-LAYOUT-03 |
| AC-05 | P2.3, P2.7, P2.8 | REL-ICTX-01 |
| AC-06 | P2.2, P2.4, P2.6, P2.7, P2.8 | REL-ICTX-02 |
| AC-07 | P3.2, P3.3, P3.4, P3.7, P3.8, P3.9 | REL-PICK-01, REL-PICK-02 |
| AC-08 | P2.5, P2.6, P2.10 | REL-ICTX-04 |
| AC-09 | P2.5, P2.6, P2.10 | REL-ICTX-05 |
| AC-10 | P4.2, P4.3, P4.6, P4.7, P4.8 | REL-TAB-01..04 |
| AC-11 | P4.4, P4.6, P4.7, P4.8 | REL-TAB-05 |
| AC-12 | P5.4, P5.5, P5.6, P5.8, P5.9, P5.10 | REL-KIND-01..04 |
| AC-13 | P9.2..P9.5, P9.6, P9.7, P9.8 | REL-HIST-01..04; `exportHar.spec.ts` |
| AC-14 | P0.3, P0.8, P0.10 | REL-LAYOUT-04 |
| AC-15 | P10.2, P10.3, P10.4, P10.5, P10.6 | REL-VOICE-01..04 |
| AC-16 | P6.4, P6.5, P6.7, P6.8, P6.9 | REL-PILL-01..04 |
| AC-17 | P7.3, P7.4, P7.5, P7.6 | REL-CODE-01..04 |
| AC-18 | P8.2, P8.4, P8.5, P8.8, P8.9, P8.10, P8.11, P8.12 | REL-QOL-01..04 |
| AC-19 | P8.3, P8.4, P8.8, P8.9, P8.12 | REL-QOL-05 |
| AC-20 | P3.5, P3.6, P3.7, P3.8, P3.9, P11.15 | REL-PICK-03, REL-PICK-04 |
| AC-21 | P11.1..P11.6, P11.10, P11.11, P11.12, P11.13, P11.14, P11.15 | REL-SMART-01..04; `registry.spec.ts` |
| AC-22 | P2.4, P8.6, P8.7, P2.6, P2.9, P8.8, P8.13 | REL-ICTX-03, REL-QOL-06 |
| AC-23 | strings tasks, P12.3 | `brandGuard.spec.ts`, parity specs |
| AC-24 | P0.1, P7.7, P12.4 | `BUNDLE.md` |
| AC-25 | P12.1, P12.6, P12.8 | REL-IA11Y-01..05 |
| D-1 | P4.2, P4.6, P4.8 | REL-TAB-02 |
| D-2 | P7.4, P7.5, P7.6 | REL-CODE-02, REL-CODE-03 |
| D-3 | P9.2, P9.3, P9.6, P9.8 | `exportHar.spec.ts` |
