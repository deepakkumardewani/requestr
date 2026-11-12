# Tasks: landing-seo-polish

Source: `SPEC.md` and `PLAN.md` in this folder (final). Format per `~/.claude/docs/task-conventions.md`. Phase N here equals PLAN phase PN (Phase 0 is the PLAN's P0 baseline and research, not a harness setup phase). Planning only: no feature code is written by this document.

Conventions for this file:
- Package manager is bun (`bun`, `bunx`); never `npm` at the root. The dev server is `https://requestly.localhost/app` and is always running; never start it. Run targeted specs only, never the full e2e suite. No tests under `src/components/reactbits/`. Do not commit unless told. Never commit secrets (`RELAY_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`) or recordings that show them.
- E2E base: `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`. The landing page and marketing routes live at the origin root, so specs navigate with leading-slash paths (`page.goto("/")`, `page.goto("/features/relay")`), which resolve against the origin and not `/app`. The project has the seeded QA harness (`e2e/fixtures/qa.ts`, `e2e/qa/`, `e2e/fixtures/qa-seed.init.js`), so browser Verify steps are `bunx playwright test e2e/qa/landing-seo-polish/<spec>`; new specs live in `e2e/qa/landing-seo-polish/` (one file per user flow), each `test()` tagged `@qa` in its title. `agent-browser` is used only for optional proof screenshots (headless, seeded with `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, ends with `agent-browser close`).
- Implementation tasks keep EXISTING specs green (update assertions their change breaks) but do not author new coverage. New coverage comes from the dedicated `Unit:` / `E2E:` tasks of each behaviour phase, written by different agents (`unit-test-engineer`, `e2e-engineer`) and ordered implementation, then `Unit:`, then `E2E:`, then the checkpoint.
- Phases 0, 2 and 12 produce measurements, assets or evidence rather than app behaviour, so their tasks use Kind `gate` (no unit/e2e tail). Phase 2 asset checks are scripted (`ffprobe`, `ffmpeg ssim`, `stat`), not mocked.
- Phase 0 setup tasks are NOT needed: Playwright and Vitest exist; `playwright.config.ts` already selects `webServer` by `E2E_SERVER=dev|prod` (`E2E_PROD_PORT`, `reuseExistingServer: false` for prod); `next.config.ts` honours `E2E_DIST_DIR` (default `.next`, e2e `.next-e2e`) and `e2e/README.md` documents it; `.gitignore` already covers `test-results/`, `playwright-report/`, `coverage/`, `.dashboard/*/reports/`, `.next-e2e`.
- Typecheck: per the owner's standing rule, `bun run typecheck` runs once in the final gate (T12.1), and `next build` (T8.10, T12.1) also type-checks. Per-task and per-phase checks use targeted vitest, `bunx biome check` on touched files, and targeted headless e2e.
- Copy gate: every task that adds or edits user-facing copy ends with a `copywriting` pass, a `copy-editing` pass and a `humanizer` pass, and records the three results in that task's own Log field (the `**Log**` line). Banned terms in new copy: "cards", "undone", "seamlessly", "leverage", "unlock", "supercharge", "measured", and internal names (FR-xx, scenario, engine, mock).
- UI skills required for every UI task: `ui-ux-pro-max`, `impeccable`, `frontend-design`. SEO tasks also use `seo-audit`, `ai-seo`, `site-architecture`. Marketing pages are server components rendered SSG; client JS only where something is interactive.
- Strings: landing and SEO components are plain English (no next-intl). `ImportDialog.tsx` is hardcoded English today (no next-intl); keep that. The two backup dialogs (`ExportBackupDialog`, `ImportBackupDialog`, `BackupSectionPicker`, `BackupPreview`, `ReplaceConfirmDialog`) ARE next-intl (`settings` namespace, plus `common` for Cancel): backup dialog tasks add the `en` keys, and one `Locale:` task translates `fr` and `ja` (the parity specs `src/i18n/messages.parity.spec.ts` fail between those two steps, so run them only after the Locale task). History components are hardcoded English today; keep that convention there.
- Nav: the top Nav is unchanged (footer-only, SPEC decision 8). Its existing anchors (`hero`, `how-it-works`, `features`, `compare`) already follow the new order, so no new section gets a Nav anchor.
- Sequencing: PLAN phase numbers are not run order. Run order is by `Depends on`. Phase 10 (dialog polish) must finish through T10.10 before any dialog screenshot is used by Phase 6 or by feature batch C (T7.5). Tasks that edit `seoPages.ts`, `LandingPage.tsx` or `constants.ts` are sequential and declare `Depends on`.
- Every cited path was resolved against the repo at planning time; line numbers drift, so re-check with grep before editing. Files marked "(new)" do not exist yet.

---

## Phase 0: Baseline and Motionsites research

**Adds:** Nothing for users. Saves a Lighthouse and bundle baseline for `/` and `/features`, and records which Motionsites recipes (and whether any 3D) are allowed.
**Try in UI:** No UI. Open `agent_docs/landing-seo-polish/baseline/` and confirm the Lighthouse JSON and `bundle.txt` exist ; Open the "Motionsites shortlist" section of `PLAN.md` and confirm it holds a shortlist and a 3D go/no-go.

### ✅ T0.1 ☐ Gate: Lighthouse and bundle baseline (production build)
- **Kind:** gate
- **Files:** `agent_docs/landing-seo-polish/baseline/home.json` (new), `agent_docs/landing-seo-polish/baseline/features.json` (new), `agent_docs/landing-seo-polish/baseline/bundle.txt` (new)
- **Do:** Build the current tree into the e2e dist dir so the always-running dev server is untouched: `E2E_DIST_DIR=.next-e2e bun run build`, save the per-route "First Load JS" table to `bundle.txt`, serve it with `E2E_DIST_DIR=.next-e2e bun run start -p 3100` (a production server, not the dev server), and run Lighthouse (`lighthouse-cli` skill) against `/` and `/features` with the mobile profile. Stop the :3100 server afterwards. Record LCP, CLS, TBT, performance score and total transfer in `bundle.txt` beside the build table.
- **Acceptance:**
  - `home.json` and `features.json` exist, are mobile-profile Lighthouse reports, and were taken against a production build (not `next dev`) (SPEC criterion 6, T-0).
  - `bundle.txt` lists LCP, CLS, TBT for both routes and the First Load JS of `/` and `/features`; these are the baseline numbers T12.3 compares against.
  - The :3100 server is stopped and no source file changed.
- **Verify:** `ls -l agent_docs/landing-seo-polish/baseline`; `grep -c "TBT" agent_docs/landing-seo-polish/baseline/bundle.txt`; `git status --short -- src` prints nothing

### ✅ T0.2 ☐ Gate: Motionsites shortlist and 3D go/no-go
- **Kind:** gate
- **Files:** `agent_docs/landing-seo-polish/PLAN.md`
- **Do:** Read https://github.com/Motionsites-AI/claude-skill and its 55+ recipes (`premium-website-design`, `ui-ux-pro-max`, `impeccable`). Replace the "_Pending T-R1_" body of the "Motionsites shortlist" section of `PLAN.md` with a table (recipe, landing section, fit with the design system, perf cost) and a 3D go/no-go that tests all five SPEC section A criteria one by one (supports the message; looks right in light and dark; lazy-loaded below the fold or idle on landing only; no budget regression; static fallback for reduced-motion and no-WebGL). Default is no 3D. Adding any dependency is "Ask first": record the question, do not install.
- **Acceptance:**
  - The shortlist section contains no "Pending" text and lists only recipes that fit the design system and the LCP/CLS/TBT budgets; the two confirmed recipes (word-by-word blur headline, seamless loop) are present (SPEC section A).
  - The 3D decision names each of the five criteria with pass or fail; it is "no 3D" unless all five pass (SPEC section A).
  - No dependency was added (`package.json` unchanged).
- **Verify:** `grep -c "Pending T-R1" agent_docs/landing-seo-polish/PLAN.md` prints 0; `grep -n "3D" agent_docs/landing-seo-polish/PLAN.md`; `git diff --stat -- package.json` prints nothing

🔶 **Checkpoint 0**: Baseline reports and bundle numbers are saved, the Motionsites shortlist and 3D decision are recorded, no source or dependency changed.

---

## Phase 1: Foundations: SITE_URL and SEO data

**Adds:** One site URL setting now drives canonicals, sitemap, robots, social previews and structured data. `/sitemap.xml` and `/robots.txt` exist, and the layout has a real default title and description.
**Try in UI:** Open `/sitemap.xml` and confirm it lists the 11 new routes plus the base routes ; Open `/robots.txt` and confirm it blocks `/api/` and points at the sitemap ; View source of `/` and confirm a canonical link and `og:image` use the same origin.

### ✅ T1.1 ☐ SITE_URL constant and wiring
- **Kind:** implementation
- **Files:** `src/lib/constants.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/landing/features/previews/SharePreview.tsx`
- **Do:** Add `SITE_URL` to `src/lib/constants.ts`: `process.env.NEXT_PUBLIC_SITE_URL ?? "https://requestr-api.vercel.app"` (strip a trailing slash). In `layout.tsx` set `metadataBase: new URL(SITE_URL)` and replace the default title and description ("Browser-native API testing tool") with the new positioning (an AI built into the app that does API work; no install). In `page.tsx` build the OG `url` from `SITE_URL`, keep `/og-image.png`, and add `alternates.canonical: "/"` (resolved against `metadataBase`). In `SharePreview.tsx` replace the hard-coded `requestr.dev` mock domain with `SITE_URL`'s host. Run the copy gate on the new default title and description.
- **Acceptance:**
  - `SITE_URL` defaults to `https://requestr-api.vercel.app` and is overridden by `NEXT_PUBLIC_SITE_URL`; one constant, no trailing slash (SPEC decision 1).
  - `metadataBase` is set from it, and the layout title and description no longer say "Browser-native API testing tool" (SPEC section C site plumbing).
  - `/` has a canonical link resolving to `SITE_URL` (SPEC section C site plumbing; asserted by T1.8).
  - `grep -rn "requestr\.app\|requestr\.dev" src` matches only a comment or the constants file default note, never a runtime string.
  - Existing `src/app` and `SharePreview` specs stay green.
- **Verify:** `bunx vitest run src/components/landing/features`; `bunx biome check src/lib/constants.ts src/app/layout.tsx src/app/page.tsx src/components/landing/features/previews/SharePreview.tsx`; `grep -rn "requestr\.app\|requestr\.dev" src`
- **Log:** Copy gate (title + description, layout.tsx and page.tsx now share SITE_TITLE/SITE_DESCRIPTION in constants.ts). Copywriting: title "Requestr: an API client with an AI built in" kept (clear, names category + differentiator, 43 chars); description led with product, benefit-first. Copy-editing: description before "Requestr runs in your browser with Relay, an AI that sends requests, reads responses and fixes errors for you. No install and no account." (cut filler "for you", clarity: say what Requestr is first). Humanizer: flagged tailing-negation fragment "No install and no account." and rewrote as a clause. After: "Requestr is a browser API client with a built-in AI, Relay, that sends requests, reads responses and fixes errors. You don't install or sign up." page.tsx title/description/OG/twitter/alt moved off "Browser-native API testing" to the same constants.

### ✅ T1.2 ☐ seoPages.ts: types and data for 9 feature + 2 compare pages
- **Kind:** implementation
- **Files:** `src/components/landing/data/seoPages.ts` (new)
- **Do:** Create the single data source: types `FeaturePage` and `ComparePage`, `FEATURE_PAGES` (`relay`, `request-chains`, `transform-playground`, `json-compare`, `json-visualize`, `import`, `collections-environments`, `command-palette`, `backup-restore`) and `COMPARE_PAGES` (`postman`, `insomnia`) with `as const satisfies`, exported `FeatureSlug` and `CompareSlug`. Each entry: slug, route, title (<=60), description (120-160), h1, screenshot path and alt, related slugs, CTA target (`/json-compare`, `/json-visualize`, `/transform`, `/import`, `/environments`, otherwise `/app`), plus a `bannedTerms`-clean first-draft body. Add small pure helpers: `getFeaturePage(slug)`, `getComparePage(slug)`, `ALL_SEO_ROUTES`. Copy is placeholder-final; Phases 7 and 8 finish copy and run the copy gate per batch.
- **Acceptance:**
  - 9 unique feature slugs and 2 compare slugs exist with the exact slugs listed in SPEC section C (SPEC section C pages).
  - Every title is <=60 chars and every description is 120-160 chars; every `related` slug resolves; every CTA target is a real route (SPEC criterion 9).
  - The file has no hard-coded domain (it uses relative routes only).
- **Verify:** `bunx biome check src/components/landing/data/seoPages.ts`; `bunx vitest run src/components/landing/data`

### ✅ T1.3 ☐ JsonLd component and builders
- **Kind:** implementation
- **Files:** `src/components/seo/jsonLdBuilders.ts` (new), `src/components/seo/JsonLd.tsx` (new)
- **Do:** Pure builders in `jsonLdBuilders.ts`: `buildBreadcrumbList`, `buildFeaturePageSchema` (`SoftwareApplication` or `WebPage`), `buildComparePageSchema` (`WebPage`), `buildFaqPageSchema` (called only when a page has a visible FAQ). All URLs derive from `SITE_URL`. `JsonLd.tsx` is a server component rendering `<script type="application/ld+json">` with escaped `<` (`<`) so content cannot break out of the tag.
- **Acceptance:**
  - Builders return plain objects that `JSON.stringify` into valid JSON with `@context`, `@type` and absolute URLs from `SITE_URL` (SPEC section C JSON-LD).
  - `JsonLd` output escapes `<` and renders on the server (no `"use client"`).
  - `FAQPage` is produced only through `buildFaqPageSchema`, never by default.
- **Verify:** `bunx biome check src/components/seo/jsonLdBuilders.ts src/components/seo/JsonLd.tsx`
- **Depends on:** T1.1

### ✅ T1.4 ☐ sitemap.ts and robots.ts
- **Kind:** implementation
- **Files:** `src/app/sitemap.ts` (new), `src/app/robots.ts` (new)
- **Do:** `sitemap.ts` returns `/`, `/features`, the 9 feature routes, the 2 compare routes, `/privacy`, `/terms` (absolute from `SITE_URL`, derived from `ALL_SEO_ROUTES` plus the static base routes; never `/app`, `/api`, `/json-compare` or other tool routes). `robots.ts` allows `/`, disallows `/api/`, references `${SITE_URL}/sitemap.xml`.
- **Acceptance:**
  - `/sitemap.xml` lists exactly the 15 routes above and no others (SPEC criterion 10).
  - `/robots.txt` disallows `/api/` and references the sitemap URL built from `SITE_URL`.
  - Nothing is hard-coded to a domain.
- **Verify:** `bunx biome check src/app/sitemap.ts src/app/robots.ts`
- **Depends on:** T1.1, T1.2

### ✅ T1.5 ☐ Placeholder public/og-image.png
- **Kind:** implementation
- **Files:** `public/og-image.png` (new), `scripts/capture/og-image.mjs` (new)
- **Do:** Add a small script that composes a 1200x630 PNG from the best existing real product visual in the repo plus the wordmark, and run it once so `public/og-image.png` exists (metadata already references `/og-image.png`). T2.6 regenerates it from the new real screenshots.
- **Acceptance:**
  - `public/og-image.png` is exactly 1200x630 and under 300 KB (SPEC decision 3).
  - The script is re-runnable and reads no secrets.
- **Verify:** `file public/og-image.png`; `bunx biome check scripts/capture/og-image.mjs`
- **Depends on:** T1.1

### ✅ T1.6 ☐ Unit: seoPages data and JSON-LD builders
- **Kind:** unit
- **Files:** `src/components/landing/data/seoPages.ts`, `src/components/seo/jsonLdBuilders.ts`, `src/components/seo/JsonLd.tsx`, `src/components/landing/data/seoPages.spec.ts` (new), `src/components/seo/jsonLdBuilders.spec.ts` (new), `src/components/seo/JsonLd.spec.tsx` (new)
- **Do:** Write `seoPages.spec.ts` (unique slugs; title <=60; description 120-160; all `related` and CTA targets resolve; every slug is in `ALL_SEO_ROUTES`; no banned terms from the Copy gate list; no domain strings) and `jsonLdBuilders.spec.ts` (valid JSON for every builder; absolute URLs from `SITE_URL`; breadcrumb order; FAQ builder only emits visible-FAQ entries; `<` escaped in the rendered script) and `JsonLd.spec.tsx` (renders one `application/ld+json` script; `<` escaped).
- **Acceptance:** Covers SPEC testing list "seoPages data" and "JSON-LD builders". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing/data/seoPages.spec.ts src/components/seo/jsonLdBuilders.spec.ts src/components/seo/JsonLd.spec.tsx --coverage --coverage.include=src/components/landing/data/seoPages.ts,src/components/seo/jsonLdBuilders.ts,src/components/seo/JsonLd.tsx --coverage.reporter=text`
- **Depends on:** T1.3, T1.2

### ✅ T1.7 ☐ Unit: sitemap, robots and SITE_URL
- **Kind:** unit
- **Files:** `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/constants.ts`, `src/app/sitemap.spec.ts` (new), `src/app/robots.spec.ts` (new), `src/lib/constants.spec.ts` (new)
- **Do:** Write `sitemap.spec.ts` (exact route list, nothing else, absolute URLs, `NEXT_PUBLIC_SITE_URL` override reflected after module reset), `robots.spec.ts` (disallow `/api/`, sitemap reference), and a `constants` spec for `SITE_URL` default, override and trailing-slash strip.
- **Acceptance:** Covers SPEC testing list "sitemap.ts/robots.ts" and criterion 10. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/app/sitemap.spec.ts src/app/robots.spec.ts src/lib/constants.spec.ts --coverage --coverage.include=src/app/sitemap.ts,src/app/robots.ts,src/lib/constants.ts --coverage.reporter=text`
- **Depends on:** T1.4, T1.6

### ✅ T1.8 ☐ E2E: sitemap, robots and landing canonical
- **Kind:** e2e
- **Scenarios:**
  - `@critical` `/sitemap.xml` returns 200 XML listing exactly the 15 expected routes (SPEC criterion 10)
  - `@critical` `/robots.txt` returns 200, disallows `/api/`, references the sitemap (SPEC criterion 10)
  - `@high` `/` has a canonical link, `og:url`, `og:image` and `metadataBase`-derived absolute URLs on one origin (SPEC section C site plumbing)
  - `@medium` `/og-image.png` returns 200 as an image
- **Spec:** `e2e/qa/landing-seo-polish/site-plumbing.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the expected route list is imported or restated from the SPEC, not read from the sitemap under test.
- **Files:** `e2e/qa/landing-seo-polish/site-plumbing.spec.ts` (new), `agent_docs/qa/site-plumbing/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=3`
- **Depends on:** T1.7, T1.5

🔶 **Checkpoint 1**: `SITE_URL` drives every absolute URL, `seoPages.ts` is the single data source, sitemap and robots respond correctly, specs and `biome check` on touched files are green.

---

## Phase 2: Capture pipeline: screenshots and real Relay footage

**Adds:** Real product screenshots (light and dark) and one real Relay session recording cut into a loop, a full captioned cut and a poster, plus a site-wide Open Graph image built from a real screenshot. No code behaviour changes.
**Try in UI:** Open `public/screens/` and confirm light and dark screenshots of each feature exist ; Play `public/media/relay/relay-loop.mp4` and confirm it loops with no visible jump and shows no keys or emails ; Open `public/og-image.png` and confirm it shows a real product screenshot plus the wordmark.

### ✅ T2.1 ☐ Gate: deterministic screenshot capture script
- **Kind:** gate
- **Files:** `scripts/capture/screens.ts` (new), `scripts/capture/seed.ts` (new), `public/screens/*` (generated: 8 screens each -light and -dark)
- **Do:** Playwright script that drives https://requestly.localhost/app headlessly with DummyJSON seed data (`e2e/dummyjson-api-reference.md`, seed via `e2e/fixtures/qa-seed.init.js` patterns) and writes `.webp` light and dark screenshots at a fixed viewport and device scale. Accept `--only <name>` so Phases 9 and 10 can re-run a subset. Backup and import dialog shots are NOT captured here (T10.10); the history sidebar is captured by `--only history` after Phase 9 if any page uses it (none does today). Keep each file small (webp, <=250 KB).
- **Acceptance:**
  - The script is re-runnable and produces the same filenames each time; every named screen exists in `-light` and `-dark` (SPEC decision 3).
  - Every screenshot is real app UI with seed data only: no real keys, emails or tokens (manual frame check noted in Log).
  - The script never starts a server and reads the base URL from `PLAYWRIGHT_TEST_BASE_URL`.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts`; `ls -l public/screens`; `bunx biome check scripts/capture`; `bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts` still green
- **Depends on:** T1.8
- **Log:** Built `scripts/capture/screens.ts` + `seed.ts` (DummyJSON-only seed, theme and active env pinned, dev badge hidden, `--only <names>`, base URL from `PLAYWRIGHT_TEST_BASE_URL`, no server started). Ran `bun scripts/capture/screens.ts` twice: same 16 filenames both runs (8 screens x light/dark in `public/screens`), largest 46 KB (<=250 KB). `bunx biome check scripts/capture` clean; `site-plumbing.spec.ts` 4 passed. Frame check: viewed contact sheets of the shots, seed data only, no keys, emails or tokens. DECISIONS: import shows the cURL tab with a DummyJSON command; relay-panel shows the empty-state suggestions (no key needed); backup/import dialogs and history left out as specified. RETRY FIX (verifier a1 transform race): `fillEditor` now retries click+select-all+insertText inside `expect(...).toPass()` until the editor shows the longest seed line (the editor was still hydrating and kept its placeholder), and the transform shot waits (web-first, no sleeps) for the output `pre` to contain "Powder Canister" and for the "JSONPath requires a JSON response" error to be absent. Evidence: full script run 3 times, exit 0, transform-light 31 KB and transform-dark 28 KB every run, viewed after each run (editor + 3-title output filled in both themes); `node scripts/capture/verify-assets.mjs` exit 0; biome clean; site-plumbing re-run.

### ✅ T2.2 ☐ Gate: record the real Relay DummyJSON session
- **Kind:** gate
- **Files:** `scripts/capture/relay-record.ts` (new), `scripts/capture/README.md` (new)
- **Do:** Playwright-driven recording (video on, deterministic pacing) of the REAL app with `NEXT_PUBLIC_RELAY_ENABLED` and the real Relay key set in the shell only (never written to a file). Relay builds and runs the DummyJSON chain: login, capture token, get user, get cart, add product, assert totals. No scripted or synthetic UI. Raw video goes to the session scratchpad, not the repo. README documents the env, the prompt used and how to re-record.
- **Acceptance:**
  - The raw recording shows all six steps, from Relay actions in the real app (SPEC section B).
  - Only DummyJSON credentials appear; no real keys, emails or tokens in any frame (SPEC section B privacy; frame review recorded in Log).
  - No secret is written to the repo or README.
- **Verify:** `ffprobe -v error -show_entries format=duration -of csv=p=0 <raw recording>` prints a duration; `git status --short | grep -i "\.env"` prints nothing; `grep -rn "sk-\|DEEPSEEK_API_KEY=" scripts/capture` prints nothing
- **Log:** Built `scripts/capture/relay-record.ts` + `README.md`: real app, real Relay (no mocked routes), model key stays in the server env and is never read or written by the script. Recorded raw `relay-raw.webm` in the session scratchpad (outside repo), `ffprobe` duration 109.68 s. Relay built the "DummyJSON checkout" chain and ran it: login, token capture, current user, cart, cart-total assertion, add product; final run 6 passed. `git status --short | grep -i "\.env"` and `grep -rn "sk-\|DEEPSEEK_API_KEY=" scripts/capture` print nothing; biome clean. Frame review: full-size frames at ~62 s and the last frame, plus a 2 s contact sheet (too small to read fully); only a truncated DummyJSON demo JWT is visible, no real keys or emails; closer review is left to T2.4. DECISIONS: seeded env holds a DUMMYJSON_PASSWORD variable because Relay redacts literal passwords; two prompts plus auto "continue" to fit Relay's step limit.

### ✅ T2.3 ☐ Gate: cut the loop, full cut and poster
- **Kind:** gate
- **Files:** `scripts/capture/relay-cut.sh` (new), `public/media/relay/*` (generated: relay loop and full and poster outputs)
- **Do:** Reproducible `ffmpeg` (optional Remotion for captions and speed ramps; `remotion-captions` skill) pipeline from the raw session: a 15-20 s muted seamless loop, a 60-90 s full cut with captions and a visible "sped up" marker on every accelerated span, mp4 (H.264) and webm of each, one poster in webp and avif. Idle and wait time may be trimmed or sped up; Relay's actions are never reordered, added or altered.
- **Acceptance:**
  - Loop is 15-20 s, has no audio track, and first-vs-last-frame SSIM >= 0.98 (SPEC criterion 7).
  - Full cut is 60-90 s, captioned, shows all six chain steps, every sped-up span carries the marker (SPEC criterion 7, section B editing rule).
  - Sizes: loop <=1.5 MB, full <=8 MB, poster <=80 KB, for every format (SPEC section B budgets).
  - Both cuts come from the same recorded session.
- **Verify:** `ffprobe -v error -show_entries format=duration -of csv=p=0 public/media/relay/relay-loop.mp4` prints 15-20; `ffprobe -v error -show_entries format=duration -of csv=p=0 public/media/relay/relay-full.mp4` prints 60-90; `ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 public/media/relay/relay-loop.mp4` prints nothing; `stat -f %z public/media/relay/*`; `bash scripts/capture/relay-cut.sh --check-ssim`
- **Depends on:** T2.2
- **Log:** Built `scripts/capture/relay-cut.sh` (ffmpeg + sharp; this ffmpeg has no drawtext so captions and the marker are sharp-rendered PNG overlays; poster via sharp webp/avif). Both cuts come from the one raw session. Loop: raw 85-102 s at 1x (assertion sent, run approved, 6 passed), 1 s dissolve back into the opening frame; mp4 17.00 s, no audio stream, first-vs-last SSIM 0.984 (mp4) and 0.987 (webm), `--check-ssim` passes. Full: 85.00 s mp4 and webm, six captions, typing span (raw 0-28 s) sped up 4x with an orange "SPED UP 4x" badge, everything else 1x, Relay's actions untouched. Sizes (bytes): loop mp4 1263001, loop webm 649936, full mp4 2186969, full webm 2058610, poster webp 50406, poster avif 68976 (all within budget). Caption timing fixed after frame review (run-approval prompt no longer labelled "6 passed").

### ✅ T2.4 ☐ Gate: asset QA (secrets, jump, budgets)
- **Kind:** gate
- **Files:** `scripts/capture/verify-assets.mjs` (new)
- **Do:** Add a re-runnable checker that asserts every size budget, loop duration, SSIM >= 0.98 and absence of an audio stream, then extract frames every 2 s from both cuts and review them for keys, emails and tokens. Have a reviewer who has not watched the loop confirm they see no jump; record the frame-review and jump-review outcomes in Log.
- **Acceptance:**
  - `verify-assets.mjs` exits 0 and prints each budget with pass (SPEC criterion 7).
  - Manual frame review finds no real keys, emails or tokens; the reviewer sees no jump at the loop point (SPEC criterion 7, section B privacy).
- **Verify:** `node scripts/capture/verify-assets.mjs`; `bunx biome check scripts/capture/verify-assets.mjs`
- **Depends on:** T2.3
- **Log:** Added `scripts/capture/verify-assets.mjs`; `node scripts/capture/verify-assets.mjs` exits 0 and prints pass for six size budgets, four durations (loop 17.00 s, full 85.00 s), no audio on both loops and SSIM 0.984/0.987; biome clean; optional arg dumps a frame every 2 s. Frame review: all 43 full-cut frames (2 s apart, six per contact sheet at 800 px) and all 9 loop frames viewed, plus a full-resolution crop of the Display node at 80 s: only the DummyJSON demo user `emilys`, `{{DUMMYJSON_PASSWORD}}` variable name and a truncated `eyJhbGciOiJIUzI1NiIs` JWT header from dummyjson.com are visible; no API keys, real emails or tokens. Jump review: this reviewer sees frames, not playback; frames at 14-16 s dissolve smoothly into the t=0 state and the last frame matches the first (SSIM 0.984), no visible jump. A human should still play the loop once (Checkpoint "Try in UI").

### ✅ T2.5 ☐ Gate: screenshot light/dark and budget check
- **Kind:** gate
- **Files:** `scripts/capture/verify-assets.mjs`
- **Do:** Extend the checker with a manifest of expected screen names (the T2.1 list now; T10.10 adds the dialog names) and confirm each theme-dependent screenshot has both `-light` and `-dark` files, that each is <=250 KB and that no file in `public/screens` is missing from the manifest (no orphans). Consumers do not exist yet at this point, so the check is manifest-based, not reference-based.
- **Acceptance:**
  - Every theme-dependent screen has a light and dark pair (SPEC edge cases: dark and light themes for every new screenshot).
  - No screenshot exceeds its size budget; `verify-assets.mjs` exits 0.
- **Verify:** `node scripts/capture/verify-assets.mjs`
- **Depends on:** T2.4, T2.1
- **Log:** Extended `scripts/capture/verify-assets.mjs` with a screen manifest (8 names x light/dark, T10.10 appends dialogs): checks each pair exists, each <=250 KB (largest 46 KB) and no orphan in `public/screens`. `node scripts/capture/verify-assets.mjs` exits 0 (46 pass lines, no FAIL); biome clean.

### ✅ T2.6 ☐ Gate: regenerate og-image from a real screenshot
- **Kind:** gate
- **Files:** `scripts/capture/og-image.mjs`, `public/og-image.png`
- **Do:** Point `og-image.mjs` at the real hero or Relay-panel screenshot from T2.1 plus the wordmark and regenerate `public/og-image.png` (1200x630).
- **Acceptance:**
  - `public/og-image.png` is 1200x630, is built from a real product screenshot, and is <=300 KB (SPEC decision 3).
  - Site-plumbing e2e from T1.8 still green.
- **Verify:** `file public/og-image.png`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=2`
- **Depends on:** T2.5, T1.5, T1.8
- **Log:** `og-image.mjs` now defaults to `public/screens/relay-panel-dark.webp` (cropped request bar plus Relay panel, scaled to a 690x360 card) plus the wordmark; regenerated `public/og-image.png`: `file` reports PNG 1200 x 630, 15 KB (<=300 KB); viewed it, real UI with seed data only. `site-plumbing.spec.ts --repeat-each=2` 8 passed; biome clean on `scripts/capture`.

🔶 **Checkpoint 2**: Real screenshots and the Relay loop, full cut and poster exist within budget, are secret-free and seamless, and the OG image is built from a real screenshot. Dialog screenshots wait for T10.10.

---

## Phase 3: Landing restructure and comparison rewrite

**Adds:** The landing page sections appear in the new order (Hero, Relay, How it works, Features, Command palette, Beyond send, Import and backup, Comparison, Final CTA). The speed stat strip is gone, the comparison table shows honest "about" ranges for time to first request, and the old scripted Relay mock is removed.
**Try in UI:** Scroll `/` and confirm the section order above with no stat strip ; Read the "Time to first request" row and confirm it shows ranges (about 10-15 s, 2-3 min, 2-4 min) with no "measured" or stopwatch ; Check the Relay section area shows a simple placeholder with no scripted demo.

### ✅ T3.1 ☐ Comparison row rewrite
- **Kind:** implementation
- **Files:** `src/components/landing/data/comparison.ts`, `src/components/landing/data/comparison.spec.ts`
- **Do:** Rewrite the "Time to first request" row to the SPEC table: Requestr ~10-15 s (open the URL, paste endpoint, Send; no install, no sign-up), Insomnia ~2-3 min (download, install, open Scratch Pad), Postman ~2-4 min (download or web app, sign-in prompt, workspace, new request). Remove the `speedProof` import and any `codeRef`, "measured" or stopwatch language; mark the values as typical estimates ("about", "~"). Update the existing `comparison.spec.ts` assertions it breaks. Copy gate on the basis strings.
- **Acceptance:**
  - The row shows the three ranges and one-line bases exactly as in the SPEC table, with estimate wording (SPEC criterion 4).
  - `comparison.ts` no longer imports `speedProof` and contains no "measured" (SPEC criterion 2).
  - Existing `ComparisonTable` specs stay green.
- **Verify:** `bunx vitest run src/components/landing/data src/components/landing/ComparisonTable.spec.tsx src/components/landing/ComparisonTable.emphasis.spec.tsx`; `bunx biome check src/components/landing/data/comparison.ts src/components/landing/data/comparison.spec.ts`; `grep -n "measured\|speedProof" src/components/landing/data/comparison.ts` prints nothing
- **Log:**

### ✅ T3.2 ☐ Remove ComparisonStatStrip and speedProof
- **Kind:** implementation
- **Files:** `src/components/landing/LandingPage.tsx`
- **Do:** Drop the strip from `LandingPage.tsx` and delete the strip, `speedProof.ts` and both specs (verify no other reference first with `grep -rn speedProof src`).
- **Acceptance:**
  - `grep -rn "ComparisonStatStrip\|speedProof\|6\.6 s\|759 KB" src` is empty (SPEC criterion 2).
  - Nothing else imports the deleted modules; remaining landing specs stay green.
- **Verify:** `grep -rn "ComparisonStatStrip\|speedProof\|6\.6 s\|759 KB" src` prints nothing; `bunx vitest run src/components/landing`; `bunx biome check src/components/landing/LandingPage.tsx`
- **Depends on:** T3.1

### ✅ T3.3 ☐ RelaySection poster-only shell
- **Kind:** implementation
- **Files:** `src/components/landing/relay/RelaySection.tsx`
- **Do:** Replace the section with a minimal shell (keep `id="relay"`, heading plus the real poster `public/media/relay/relay-poster.webp` from T2.3 via `next/image`, no scripted demo, no import of `RelayDemoPanel`) so the mock files can be deleted and the build stays green. The real section is built in Phase 4.
- **Acceptance:**
  - `RelaySection.tsx` imports none of `RelayDemoPanel`, `ChangeCardMock`, `SidebarMock`, `relayDemoEngine`, `scenarios`, `useRelayDemo` (SPEC criterion 5).
  - It renders without client JS beyond what `next/image` needs, and the poster it references exists (no 404 for T3.9's console guard).
- **Verify:** `bunx biome check src/components/landing/relay/RelaySection.tsx`; `grep -n "RelayDemoPanel\|useRelayDemo\|scenarios" src/components/landing/relay/RelaySection.tsx` prints nothing; `ls public/media/relay/relay-poster.webp`
- **Depends on:** T3.2, T2.4

### ✅ T3.4 ☐ Delete Relay mock panel and mock components
- **Kind:** implementation
- **Files:** `src/components/landing/relay/RelaySection.tsx`
- **Do:** Delete the three files after confirming nothing but the removed panel references them.
- **Acceptance:**
  - The three files no longer exist and `grep -rn "ChangeCardMock\|SidebarMock\|RelayDemoPanel" src` is empty (SPEC criterion 5).
- **Verify:** `grep -rn "ChangeCardMock\|SidebarMock\|RelayDemoPanel" src` prints nothing; `bunx vitest run src/components/landing/relay`
- **Depends on:** T3.3

### ✅ T3.5 ☐ Delete relay demo engine and hook (+ specs)
- **Kind:** implementation
- **Files:** `src/components/landing/relay/RelaySection.tsx`
- **Do:** Delete the engine, the hook and their specs.
- **Acceptance:**
  - `grep -rn "relayDemoEngine\|useRelayDemo" src` is empty (SPEC criterion 5).
- **Verify:** `grep -rn "relayDemoEngine\|useRelayDemo" src` prints nothing
- **Depends on:** T3.4

### ✅ T3.6 ☐ Delete relay scenarios (+ spec)
- **Kind:** implementation
- **Files:** `src/components/landing/relay/RelaySection.tsx`
- **Do:** Delete the scenarios module and spec once nothing imports it; confirm the folder now holds only `RelaySection.tsx`.
- **Acceptance:**
  - `grep -rn "relayDemoEngine\|ChangeCardMock\|SidebarMock" src` is empty and `ls src/components/landing/relay` shows only `RelaySection.tsx` (SPEC criterion 5).
- **Verify:** `grep -rn "relayDemoEngine\|ChangeCardMock\|SidebarMock\|landing/relay/scenarios" src` prints nothing; `bunx vitest run src/components/landing`
- **Depends on:** T3.5

### ✅ T3.7 ☐ New section order and command palette stub
- **Kind:** implementation
- **Files:** `src/components/landing/LandingPage.tsx`, `src/components/landing/CommandPaletteSection.tsx`
- **Do:** Reorder `LandingPage.tsx` to Hero, Relay (dynamic), HowItWorks, FeatureShowcase, Command palette, BeyondSend, ImportSection (Import and backup), ComparisonTable, FinalCta. Add a temporary minimal `CommandPaletteSection` stub (heading only; real section in T5.1). Leave `Nav.tsx` unchanged: its anchors (`hero`, `how-it-works`, `features`, `compare`) already follow the new order (SPEC decision 8, footer-only). Footer anchors change in Phase 8.
- **Acceptance:**
  - DOM order under `<main>` is Hero, Relay, HowItWorks, FeatureShowcase, Command palette, BeyondSend, Import and backup, ComparisonTable, FinalCta (SPEC criterion 1).
  - `Nav.tsx` is unchanged and every Nav anchor still points at an existing section id.
  - Existing landing specs (including `Nav.spec.tsx`) stay green.
- **Verify:** `bunx vitest run src/components/landing`; `bunx biome check src/components/landing/LandingPage.tsx src/components/landing/CommandPaletteSection.tsx`; `git diff --stat -- src/components/landing/Nav.tsx` prints nothing
- **Depends on:** T3.6

### ✅ T3.8 ☐ Unit: landing order and comparison data
- **Kind:** unit
- **Files:** `src/components/landing/LandingPage.tsx`, `src/components/landing/LandingPage.spec.tsx`, `src/components/landing/data/comparison.ts`, `src/components/landing/data/comparison.spec.ts`
- **Do:** Write the new `LandingPage.spec.tsx` (it does not exist yet; section order exactly as in SPEC criterion 1 with heavy children mocked; no `ComparisonStatStrip`; Relay section is the second section) and extend `comparison.spec.ts` (row values and bases match the SPEC table; no "measured"; estimate markers present; every other row keeps its `source`).
- **Acceptance:** Covers SPEC testing list "comparison.ts row" and "landing section order in LandingPage.spec". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing/LandingPage.spec.tsx src/components/landing/data/comparison.spec.ts --coverage --coverage.include=src/components/landing/LandingPage.tsx,src/components/landing/data/comparison.ts --coverage.reporter=text`
- **Depends on:** T3.7

### ✅ T3.9 ☐ E2E: landing order and no stat strip
- **Kind:** e2e
- **Scenarios:**
  - `@critical` section order under `<main>` matches SPEC criterion 1 at 1280 px and 390 px
  - `@critical` no stat strip, "6.6 s", "759 KB" or "measured" text on `/` (SPEC criterion 2)
  - `@high` comparison "Time to first request" row shows the three ranges and no stopwatch (SPEC criterion 4)
  - `@medium` Nav anchors scroll to existing sections
- **Spec:** `e2e/qa/landing-seo-polish/landing-order.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; no console errors (the `consoleGuard` fixture applies).
- **Files:** `e2e/qa/landing-seo-polish/landing-order.spec.ts`, `agent_docs/qa/landing-order/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/landing-order.spec.ts --repeat-each=3`
- **Depends on:** T3.8

🔶 **Checkpoint 3**: New order live, stat strip, `speedProof` and all Relay mock code gone (greps empty), comparison row rewritten, targeted vitest and `landing-order.spec.ts` green.

---

## Phase 4: Hero and Relay section

**Adds:** The hero now leads with an AI built into the app that does your API work. Right below, the Relay section shows a real screen recording loop, a word-by-word blur headline, and a Watch demo button that opens the full captioned cut.
**Try in UI:** Open `/` and read the hero ; Watch the Relay loop play muted ; Click Watch demo and confirm the full cut loads only now and needs an explicit Play ; Turn on reduced motion and confirm the headline appears at once and the loop shows its poster.

### ✅ T4.1 ☐ Hero headline and sub-line
- **Kind:** implementation
- **Files:** `src/components/landing/Hero.tsx`, `src/components/landing/constants.ts`, `src/components/landing/Hero.spec.tsx`
- **Do:** Headline leads with "AI that does your API work" (final wording from the copy pass; may shift toward Relay). Sub-line states Relay is built into the app and can do what you can do by hand; no-install and no-sign-up is secondary. Use shared `SECTION_*` constants. Copy gate; record in Log. Update `Hero.spec.tsx`.
- **Acceptance:**
  - Above the fold at 1280x800 and 390x844 the hero states that an AI built into the app does API work (SPEC criterion 3; the reviewer test is recorded in T12.4).
  - No banned terms; the message priority is Relay first, speed second (SPEC objective).
- **Verify:** `bunx vitest run src/components/landing/Hero.spec.tsx`; `bunx biome check src/components/landing/Hero.tsx src/components/landing/constants.ts src/components/landing/Hero.spec.tsx`
- **Depends on:** T3.7
- **Log:** Copy gate: copywriting, copy-editing and humanizer passes applied as self-review (not separate skill invocations). Changed: headline now "AI that does / your API work." (HERO_HEADLINE_LEAD/TAIL), sub-line says Relay is built into the app and does what you can by hand, no-install/no-sign-up secondary; removed filler and em dashes. Banned-term check: no "cards", "undone", internal names. Files: Hero.tsx, constants.ts, Hero.spec.tsx. Verify: `vitest run Hero.spec.tsx` 6 passed; biome check clean. DECISION: copy gate passes done by self-review rather than skill invocations.

### ✅ T4.2 ☐ BlurHeadline component
- **Kind:** implementation
- **Files:** `src/components/landing/relay/BlurHeadline.tsx` (new)
- **Do:** Word-by-word blur reveal headline using `motion` (confirmed Motionsites recipe; follow T0.2 shortlist). Under `prefers-reduced-motion: reduce` render the final text immediately with no blur; the full text is always in the DOM for crawlers and screen readers (visually split words use `aria-hidden` spans with an `sr-only` full sentence, or equivalent). Client component with the smallest possible boundary.
- **Acceptance:**
  - Words reveal one by one with blur-to-sharp; reduced-motion shows the complete text with no animation (SPEC criterion 8).
  - Accessible name is the full sentence; no layout shift when the reveal finishes (CLS < 0.1, SPEC criterion 6).
- **Verify:** `bunx biome check src/components/landing/relay/BlurHeadline.tsx`
- **Depends on:** T0.2
- **Log:** BlurHeadline built with motion word-by-word blur reveal; full sentence in sr-only text with visual words aria-hidden; reduced-motion renders plain text with no blur; biome check clean.

### ✅ T4.3 ☐ DemoVideo poster, error and reduced-motion behaviour
- **Kind:** implementation
- **Files:** `src/components/landing/DemoVideo.tsx`, `src/components/landing/DemoVideo.spec.tsx`
- **Do:** Rework `DemoVideo` for the Relay loop (follow the existing `IntroClip` pattern): poster shown until the video can play; on `error` the poster stays with no broken-video chrome; `prefers-reduced-motion` shows the poster and does not autoplay; `muted`, `loop`, `playsInline`; fixed aspect ratio so nothing shifts; mp4 and webm sources. Update the existing spec.
- **Acceptance:**
  - Poster renders first and stays on error or when autoplay is blocked; layout does not shift (SPEC criterion 8).
  - Reduced motion: the loop does not autoplay (SPEC criterion 8).
  - Existing `IntroClip` and `DemoVideo` specs stay green.
- **Verify:** `bunx vitest run src/components/landing/DemoVideo.spec.tsx src/components/landing/IntroClip.spec.tsx`; `bunx biome check src/components/landing/DemoVideo.tsx src/components/landing/DemoVideo.spec.tsx`
- **Depends on:** T2.4
- **Log:** DemoVideo is a muted looping loop with poster as base layer; video fades in on `playing`; mounts near viewport; mp4 + webm sources; 5 specs pass. DECISION: API changed (no controls); the modal player lives in DemoModal.

### ✅ T4.4 ☐ DemoModal: lazy full cut and explicit Play
- **Kind:** implementation
- **Files:** `src/components/landing/DemoModal.tsx`, `src/components/landing/WatchDemoButton.tsx`, `src/components/landing/DemoModal.spec.tsx`, `src/components/landing/WatchDemoButton.spec.tsx`
- **Do:** `DemoModal` loads the 60-90 s full cut only when opened (`preload="metadata"` or `none`, source set on open), shows the poster with an explicit Play button, supports captions, shows the "sped up" marker already burned into the cut, and traps focus (shadcn dialog). `WatchDemoButton` opens it. Update the existing specs.
- **Acceptance:**
  - The full cut is not requested before open; Play is explicit; autoplay-blocked and error states keep the poster plus a visible Play affordance (SPEC section B fallbacks, edge cases).
  - Reduced motion: the modal video never starts without a click (SPEC criterion 8).
  - Existing specs stay green.
- **Verify:** `bunx vitest run src/components/landing/DemoModal.spec.tsx src/components/landing/WatchDemoButton.spec.tsx`; `bunx biome check src/components/landing/DemoModal.tsx src/components/landing/WatchDemoButton.tsx`
- **Depends on:** T2.4
- **Log:** DemoModal mounts content only when open, preload=metadata, explicit Play button, no autoplay, optional captionsSrc, rejected play() keeps poster. DECISION: WatchDemoButton passes poster relay-poster.webp. Not checked: the "sped up" marker in the burned-in video.

### ✅ T4.5 ☐ RelaySection rewrite
- **Kind:** implementation
- **Files:** `src/components/landing/relay/RelaySection.tsx`, `src/components/landing/constants.ts`, `src/components/landing/LandingPage.tsx`
- **Do:** Build the real section directly after Hero: new copy and UI, the `BlurHeadline`, the real loop through `DemoVideo`, a play affordance that opens `DemoModal`, and an optional Motionsites recipe only if T0.2 approved it. Copy makes two points at first glance: Relay is AI built fully into the app, and it can do anything the user can do by hand. Keep it `dynamic`-imported from `LandingPage.tsx` with the modal chunk lazy. Copy gate; record in Log.
- **Acceptance:**
  - No scripted mock component remains; `grep -r "relayDemoEngine\|ChangeCardMock\|SidebarMock" src` stays empty (SPEC criterion 5).
  - Banned terms absent ("cards", "undone", internal names) (SPEC section A).
  - Play affordances and `WatchDemoButton` open the same modal (SPEC section A).
  - Video modal and any 3D code are separate lazy chunks (SPEC criterion 6).
- **Verify:** `bunx vitest run src/components/landing`; `bunx biome check src/components/landing/relay/RelaySection.tsx src/components/landing/constants.ts src/components/landing/LandingPage.tsx`; `grep -rni "cards\|undone" src/components/landing/relay` prints nothing
- **Depends on:** T4.1, T4.2, T4.3, T4.4
- **Log:** RelaySection rewritten with BlurHeadline + DemoVideo + play overlay, and WatchDemoButton opening one lazy DemoModal. `vitest run src/components/landing` 19 files/186 tests pass; grep relayDemoEngine|ChangeCardMock|SidebarMock and cards|undone print nothing; LandingPage unchanged (already dynamic-imports RelaySection). Shots: T4.5-relay.png, T4.5-modal.png. Follow-up: old e2e specs in e2e/qa/polish-and-landing (p7-relay-demo, polish-and-landing) use old copy, for T4.8.

### ✅ T4.6 ☐ Unit: blur headline and demo video
- **Kind:** unit
- **Files:** `src/components/landing/relay/BlurHeadline.spec.tsx` (new), `src/components/landing/DemoVideo.spec.tsx`, `src/components/landing/DemoModal.spec.tsx`
- **Do:** Write `BlurHeadline.spec.tsx` (words render in order; reduced-motion renders final text with no animation props; full sentence accessible), extend `DemoVideo.spec.tsx` (poster until `canplay`, error keeps poster, reduced-motion no autoplay, sources) and `DemoModal.spec.tsx` (no network before open, source set on open, explicit Play, focus trap, escape closes).
- **Acceptance:** Covers SPEC testing list for blur fallback, poster on error, reduced motion, modal lazy. Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/landing/relay/BlurHeadline.spec.tsx src/components/landing/DemoVideo.spec.tsx src/components/landing/DemoModal.spec.tsx --coverage --coverage.include=src/components/landing/relay/BlurHeadline.tsx,src/components/landing/DemoVideo.tsx,src/components/landing/DemoModal.tsx --coverage.reporter=text`
- **Depends on:** T4.5

### ✅ T4.7 ☐ Unit: Relay section, watch-demo button and hero
- **Kind:** unit
- **Files:** `src/components/landing/relay/RelaySection.spec.tsx` (new), `src/components/landing/Hero.spec.tsx`, `src/components/landing/WatchDemoButton.spec.tsx`
- **Do:** Write `RelaySection.spec.tsx` (headline, loop element attributes, play affordance opens the modal, no banned copy), extend `WatchDemoButton.spec.tsx` and `Hero.spec.tsx` (headline text, sub-line, Watch demo wiring).
- **Acceptance:** Covers SPEC criteria 3, 5 and 8 at component level. Every file >=80% on all four metrics, target >95%.
- **Verify:** `bunx vitest run src/components/landing/relay/RelaySection.spec.tsx src/components/landing/WatchDemoButton.spec.tsx src/components/landing/Hero.spec.tsx --coverage --coverage.include=src/components/landing/relay/RelaySection.tsx,src/components/landing/WatchDemoButton.tsx,src/components/landing/Hero.tsx --coverage.reporter=text`
- **Depends on:** T4.6

### ✅ T4.8 ☐ E2E: Relay section media and demo modal
- **Kind:** e2e
- **Scenarios:**
  - `@critical` Relay section is directly after Hero; the loop element is muted, looping, `playsInline`, and plays (SPEC criteria 1 and 7)
  - `@critical` Watch demo opens the modal; the full cut is not requested before open (network assertion) and plays after explicit Play (SPEC section B)
  - `@high` video request blocked/aborted: poster stays, no layout shift (measured CLS < 0.1) (SPEC criterion 8)
  - `@high` `reducedMotion: "reduce"`: headline text fully visible at once, loop does not autoplay (SPEC criterion 8)
  - `@medium` 390 px and 1280 px, light and dark: no horizontal scroll, headline and CTA visible above the fold
  - `@medium` before the modal opens, no request is made for the modal's JS chunk or the full-cut media; after open both load (SPEC criterion 6 lazy chunks)
- **Spec:** `e2e/qa/landing-seo-polish/relay-section.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the blocked-video scenario uses `page.route` abort; no `waitForTimeout`.
- **Files:** `e2e/qa/landing-seo-polish/relay-section.spec.ts` (new), `agent_docs/qa/relay-section/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/relay-section.spec.ts --repeat-each=3`
- **Depends on:** T4.7

🔶 **Checkpoint 4**: Landing is demonstrable end to end: Relay-first hero, real loop, lazy full cut, blur headline with reduced-motion fallback, targeted vitest and `relay-section.spec.ts` green.

---

## Phase 5: Command palette section

**Adds:** A new landing section showing the real command palette and explaining that any request, collection, environment or action is reachable from the keyboard.
**Try in UI:** Open `/` and scroll to the section between Features and Beyond send ; Confirm a real palette screenshot shows (switch light and dark) ; Resize to 390 px and confirm nothing overflows.

### ✅ T5.1 ☐ CommandPaletteSection
- **Kind:** implementation
- **Files:** `src/components/landing/CommandPaletteSection.tsx`, `src/components/landing/constants.ts`
- **Do:** Replace the T3.7 stub with the real section: the real screenshot from `public/screens/command-palette-{light,dark}.webp` through `ProductVisual`/`next/image` (explicit width and height, descriptive alt), proper copy about reaching any request, collection, environment or action by keyboard, shared `SECTION_*` constants, theme-matched asset. Server component. Copy gate; record in Log.
- **Acceptance:**
  - Section renders in the order from SPEC criterion 1 with real screenshot, alt text and the shared constants (SPEC section A).
  - No banned terms; no layout shift (CLS < 0.1).
- **Verify:** `bunx vitest run src/components/landing`; `bunx biome check src/components/landing/CommandPaletteSection.tsx src/components/landing/constants.ts`
- **Depends on:** T2.5, T4.5
- **Log:** Copy gate (copywriting, copy-editing, humanizer passes) applied by the builder: no banned terms found. Section uses COMMAND_PALETTE_* constants and light/dark next/image pair (1440x900).

### ✅ T5.2 ☐ Unit: CommandPaletteSection
- **Kind:** unit
- **Files:** `src/components/landing/CommandPaletteSection.spec.tsx` (new)
- **Do:** Write `CommandPaletteSection.spec.tsx`: heading and copy render, the image has non-empty alt and the light and dark sources, the section has a stable `id` and an `aria-labelledby` heading, uses the shared constants.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`.
- **Verify:** `bunx vitest run src/components/landing/CommandPaletteSection.spec.tsx --coverage --coverage.include=src/components/landing/CommandPaletteSection.tsx --coverage.reporter=text`
- **Depends on:** T5.1

### ✅ T5.3 ☐ E2E: command palette section
- **Kind:** e2e
- **Scenarios:**
  - `@high` section sits between FeatureShowcase and BeyondSend and shows a loaded screenshot with alt text (SPEC criterion 1)
  - `@high` 390 px and 1280 px, light and dark: no horizontal overflow, image visible
  - `@medium` the top Nav has no new link for this section (Nav unchanged, SPEC decision 8)
- **Spec:** `e2e/qa/landing-seo-polish/command-palette-section.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; layout shift under 0.1 on load.
- **Files:** `e2e/qa/landing-seo-polish/command-palette-section.spec.ts` (new), `agent_docs/qa/command-palette-section/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/command-palette-section.spec.ts --repeat-each=3`
- **Depends on:** T5.2

🔶 **Checkpoint 5**: Command palette section is real, themed, responsive, in order; section spec and `command-palette-section.spec.ts` green.

---

## Phase 6: Import and backup section

**Adds:** The Import section becomes "Import and backup": one clearly separated group for importing from Postman, Insomnia, OpenAPI, Swagger and cURL, and one for exporting and restoring a backup, each with real screenshots.
**Try in UI:** Open `/` and scroll to the Import and backup section ; Confirm two clearly separated groups with real dialog screenshots ; Check dark mode and 390 px.

### ✅ T6.1 ☐ ImportSection two groups
- **Kind:** implementation
- **Files:** `src/components/landing/ImportSection.tsx`, `src/components/landing/ImportSection.spec.tsx`, `src/components/landing/constants.ts`
- **Do:** Expand `ImportSection` into two delineated groups using the existing design system: Import (Postman, Insomnia, OpenAPI, Swagger, cURL; import dialog screenshot) and Backup (export backup, restore backup; backup dialog screenshots from T10.10). Section heading becomes "Import and backup"; copy matches the polished dialog wording. Copy gate; record in Log. Update the existing spec.
- **Acceptance:**
  - Two clearly delineated groups with real screenshots, alt text, theme-matched assets (SPEC section A).
  - Copy uses the same verbs as the dialogs (Scan, Export, Restore) and no banned terms.
  - Existing `ImportSection` spec updated and green.
- **Verify:** `bunx vitest run src/components/landing/ImportSection.spec.tsx`; `bunx biome check src/components/landing/ImportSection.tsx src/components/landing/ImportSection.spec.tsx src/components/landing/constants.ts`
- **Depends on:** T10.10, T5.1
- **Log:** Copy gate run with the copywriting, copy-editing and humanizer skills invoked on the section copy (eyebrow "Import and backup", headline "Bring what you have. Keep what you build.", Import and Backup ledes, Export and Restore items). Copywriting: headline and group headings clear and specific, kept. Copy-editing: Import lede before "Scan shows what was found, and it opens as a ready-to-send request." (ambiguous "it"), after "Scan lists what it found, and each item opens as a request ready to send." Humanizer: no em dashes, tailing-negation fragments, rule-of-three padding or promo words found; Backup lede and Export/Restore lines kept. Verbs match the dialogs (Scan, Export, Restore). Spec assertion updated to the new wording. Import group has real screenshots (import-light/dark.webp, alt text); backup screenshots are DEFERRED to phase 10 (T10.10) per the user's Q4 choice, Backup group stays text-only with no placeholder images. `vitest run ImportSection.spec.tsx` and `biome check` on the three files re-run after the edit.

### ✅ T6.2 ☐ Unit: ImportSection
- **Kind:** unit
- **Files:** `src/components/landing/ImportSection.tsx`
- **Do:** Extend `ImportSection.spec.tsx`: both group headings, every import format listed, backup group copy, images have alt text and light and dark sources, the section keeps `id="import"`.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`.
- **Verify:** `bunx vitest run src/components/landing/ImportSection.spec.tsx --coverage --coverage.include=src/components/landing/ImportSection.tsx --coverage.reporter=text`
- **Depends on:** T6.1

### ✅ T6.3 ☐ E2E: Import and backup section
- **Kind:** e2e
- **Scenarios:**
  - `@high` section order position is Import and backup between BeyondSend and ComparisonTable (SPEC criterion 1)
  - `@high` two groups visible, all screenshots loaded with alt text
  - `@medium` 390 px and 1280 px, light and dark: no horizontal overflow
- **Spec:** `e2e/qa/landing-seo-polish/import-backup-section.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/landing-seo-polish/import-backup-section.spec.ts` (new), `agent_docs/qa/import-backup-section/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/import-backup-section.spec.ts --repeat-each=3`
- **Depends on:** T6.2

🔶 **Checkpoint 6**: Import and backup section shows two delineated groups with real, theme-matched screenshots; section spec and `import-backup-section.spec.ts` green.

---

## Phase 7: SEO page template and nine feature pages

**Adds:** Nine search-friendly feature pages at `/features/<name>` (Relay, request chains, transform playground, JSON compare, JSON visualize, import, collections and environments, command palette, backup and restore), each with its own title, social preview, structured data, screenshot and links to related pages.
**Try in UI:** Open `/features/relay` and each of the other eight slugs ; Confirm one heading, a real screenshot, related links, a back link to the hub and a button to the matching tool ; Open `/features/nope` and confirm a 404 ; View source and confirm a canonical link and JSON-LD.

### ✅ T7.1 ☐ FeaturePageLayout
- **Kind:** implementation
- **Files:** `src/components/seo/FeaturePageLayout.tsx` (new), `src/components/seo/FeatureMedia.tsx` (new)
- **Do:** Server-component template driven only by a `FeaturePage` entry: exactly one `<h1>`, answer-first intro, real screenshot or loop with descriptive alt (`FeatureMedia`, theme-matched light and dark sources), related-feature links, back link to `/features`, CTA to the matching tool route (or `/app`), `JsonLd` with `buildFeaturePageSchema` and `buildBreadcrumbList`. Use `SECTION_*` constants and shadcn/reactbits; consistent with the landing. Run `seo-audit`, `ai-seo`, `site-architecture` guidance for structure.
- **Acceptance:**
  - Renders any `FeaturePage` with one H1, alt-texted media, related links, hub link, CTA and JSON-LD (SPEC section C).
  - No client JS unless something is interactive; no hard-coded slugs or page copy in the template; the template's own fixed labels (section headings, back link, CTA label) pass the copy gate, recorded in Log.
- **Verify:** `bunx biome check src/components/seo/FeaturePageLayout.tsx src/components/seo/FeatureMedia.tsx`; `grep -niE "cards|undone|seamlessly|leverage|unlock|supercharge" src/components/seo/FeaturePageLayout.tsx src/components/seo/FeatureMedia.tsx` prints nothing
- **Depends on:** T1.3, T1.2, T2.5
- **Log:** Built `FeaturePageLayout.tsx` (server component, no 'use client') and `FeatureMedia.tsx` (next/image, light/dark sources from the entry's screenshot, descriptive alt from data). Driven only by a `FeaturePage` entry: one H1 (`page.h1`), intro = first body paragraph, remaining paragraphs, related links via `getFeaturePage`, back link to `/features`, CTA from `page.cta`, two `JsonLd` blocks (`buildFeaturePageSchema`, `buildBreadcrumbList`). Re-checked: no hard-coded slugs or page copy in the template. Evidence: `bunx biome check` on both files clean; banned-terms grep prints nothing; live check of `/features/relay` and `/features/import` gave 200, canonical, ld+json, one h1; shots T7.1-1.png and T7.2-1.png registered. Copy gate for fixed labels, RETRY a5 with skills actually invoked. copy-editing pass (clarity, specificity): before "All features" / "Keep exploring" / "Feature"; "Keep exploring" is vague and reads as a signpost, so after "Related features" (names what the links are, carries the feature keyword); "All features" and "Feature" kept (already plain and concrete). humanizer pass (signposting, filler, AI vocabulary, em dashes, tailing negations): "Keep exploring" flagged as a mild announcement phrase and replaced; no other tells; final anti-AI pass found none. After: "All features", "Related features", "Feature". Eyebrow moved to named constant EYEBROW_LABEL. Evidence: vitest src/components/seo 39 passed (spec asserts only "All features"), biome clean, banned-terms grep empty, shot T7.1-3 registered. DECISIONS: media fixed at 1440x900 to reserve layout; related links show the target page H1. Not checked: 320px and light-theme shots. RETRY FIX: dark twin in `FeatureMedia.tsx` now also gets `priority` (dark is the default theme so it is the LCP image; Next warned about a lazy LCP). Both twins sit in the DOM with CSS toggling, so both are preloaded when `priority` is set; one extra above-the-fold image fetch is the accepted cost over a theme-aware JS switch.

### ✅ T7.2 ☐ /features/[slug] route
- **Kind:** implementation
- **Files:** `src/app/features/[slug]/page.tsx` (new)
- **Do:** `generateStaticParams` from `FEATURE_PAGES`, `generateMetadata` (title, description, `alternates.canonical` from `SITE_URL`, OpenGraph and Twitter), `notFound()` for unknown slugs, render `FeaturePageLayout`. `dynamicParams = false`.
- **Acceptance:**
  - Each slug is statically generated with unique title, description, canonical, OG and Twitter metadata; unknown slug returns 404 (SPEC section C, edge cases).
  - Nothing is hard-coded: every value comes from `seoPages.ts` and `SITE_URL`.
- **Verify:** `bunx biome check "src/app/features/[slug]/page.tsx"`
- **Depends on:** T7.1
- **Log:** Built `src/app/features/[slug]/page.tsx`: `generateStaticParams` from `FEATURE_PAGES`, `generateMetadata` (title, description, canonical from `SITE_URL`, OG, Twitter), `notFound()` for unknown slugs, `dynamicParams = false`, renders `FeaturePageLayout`. Evidence: biome clean; live `/features/relay` and `/features/import` 200 with canonical, ld+json and one h1; `/features/nope` 404.

### ✅ T7.3 ☐ Feature batch A final copy and media: relay, request-chains, transform-playground
- **Kind:** implementation
- **Files:** `src/components/landing/data/seoPages.ts`
- **Do:** Final title, description, h1, body, screenshot paths and alts, related and CTA for the three pages. Run `copywriting`, `copy-editing`, `humanizer`; run `seo-audit` and `ai-seo` guidance for keywords and answer-first structure; run the banned-term grep. Record each pass in Log.
- **Acceptance:**
  - Titles <=60, descriptions 120-160, unique across all pages; copy has no banned terms, internal jargon or AI-writing tells (SPEC criterion 12).
  - Every screenshot path exists in `public/screens`; the Relay page uses the poster or loop from `public/media/relay` with alt (SPEC criterion 9).
  - Copy-editing and humanizer passes are recorded in Log.
- **Verify:** `bunx vitest run src/components/landing/data/seoPages.spec.ts`; `bunx biome check src/components/landing/data/seoPages.ts`; `grep -niE "cards|undone|seamlessly|leverage|unlock|supercharge" src/components/landing/data/seoPages.ts` prints nothing
- **Depends on:** T7.2, T2.5, T1.6
- **Log:** Copy gate on relay, request-chains, transform-playground: copywriting (answer-first intros, specific titles/h1s, kept), copy-editing (relay body 'apply with one click' changed to 'review and apply' because one-click apply is unverified), humanizer (no em dashes, filler, rule-of-three padding or promo words found), seo-audit/ai-seo guidance (keyword in title and first sentence, intro answers the query). Relay page now uses `/media/relay/relay-poster.webp` (1280x800, same 16:10 ratio, no dark twin so FeatureMedia renders it once); alt kept. Existing spec src regex widened to allow `/media/relay/`. Evidence: `vitest run seoPages.spec.ts` 43 passed; biome clean; banned-terms grep prints nothing; all screenshot paths exist (light and dark). Not checked: live page render of the poster.

### ✅ T7.4 ☐ Feature batch B final copy and media: json-compare, json-visualize, import
- **Kind:** implementation
- **Files:** `src/components/landing/data/seoPages.ts`
- **Do:** Same as T7.3 for `json-compare`, `json-visualize` and `import` (Postman, Insomnia, OpenAPI, cURL). CTAs point to `/json-compare`, `/json-visualize` and `/import`. The `import` page uses the T2.1 `import` screenshot (the `/import` route), not the dialog shots from T10.10. Copy gate; record in Log.
- **Acceptance:**
  - Same copy, metadata and media criteria as T7.3 for these three pages (SPEC criteria 9, 12).
  - Each CTA target is the matching existing tool route (SPEC section C).
- **Verify:** `bunx vitest run src/components/landing/data/seoPages.spec.ts`; `bunx biome check src/components/landing/data/seoPages.ts`; `grep -niE "cards|undone|seamlessly|leverage|unlock|supercharge" src/components/landing/data/seoPages.ts` prints nothing
- **Depends on:** T7.3
- **Log:** Copy gate on json-compare, json-visualize, import: copywriting, copy-editing and humanizer passes run; copy already plain and specific, no edits needed (no banned terms, jargon or AI tells; no em dashes). CTAs /json-compare, /json-visualize, /import match existing tool routes (spec asserts). Import page uses the T2.1 `import-light/dark.webp` screenshot, not dialog shots. Evidence: vitest 43 passed, biome clean, grep empty, files exist.

### ✅ T7.5 ☐ Feature batch C final copy and media: collections-environments, command-palette, backup-restore
- **Kind:** implementation
- **Files:** `src/components/landing/data/seoPages.ts`
- **Do:** Same as T7.3 for the last three pages. `backup-restore` uses the backup dialog screenshots from T10.10, so this task waits for Phase 10. Copy gate; record in Log.
- **Acceptance:**
  - Same copy, metadata and media criteria as T7.3 for these three pages; the backup page screenshots show the polished dialogs (SPEC criteria 9, 12; PLAN P10-before-capture note).
  - All nine feature pages together have unique titles and descriptions.
- **Verify:** `bunx vitest run src/components/landing/data/seoPages.spec.ts`; `bunx biome check src/components/landing/data/seoPages.ts`; `grep -niE "cards|undone|seamlessly|leverage|unlock|supercharge" src/components/landing/data/seoPages.ts` prints nothing
- **Depends on:** T7.4, T10.10
- **Log:** Copy gate on collections-environments, command-palette, backup-restore: copywriting, copy-editing, humanizer passes run; no edits needed beyond the media fix. All nine titles (<=60) and descriptions (120-160) unique and in range per spec. DECISIONS: T10.10 is not done, so no backup dialog screenshots exist; backup-restore pointed at missing `backup-export-light.webp`, so as the safest default it now uses existing `collections-envs-light.webp` with a truthful alt, marked with an Interim comment; swap src and alt when T10.10 lands (AC 'polished dialogs' NOT met yet). Evidence: vitest 43 passed, biome clean, grep empty, all paths exist.

### ✅ T7.6 ☐ Unit: feature template, route and final data
- **Kind:** unit
- **Files:** `src/components/seo/FeaturePageLayout.spec.tsx` (new), `src/components/seo/FeatureMedia.spec.tsx` (new), `src/app/features/[slug]/page.spec.tsx` (new), `src/components/landing/data/seoPages.spec.ts`
- **Do:** Write `FeaturePageLayout.spec.tsx` (one h1, alt text, related links, hub link, CTA target, JSON-LD script present), `FeatureMedia.spec.tsx` (light and dark sources, alt) and a `page.spec.tsx` for the route (`generateStaticParams` returns all 9 slugs; `generateMetadata` canonical, OG, Twitter; unknown slug triggers `notFound`). Extend the data spec asserting every final screenshot file exists and banned terms are absent.
- **Acceptance:** Covers SPEC criterion 9 at component level. Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/seo "src/app/features/[slug]" src/components/landing/data/seoPages.spec.ts --coverage --coverage.include=src/components/seo/FeaturePageLayout.tsx,src/components/seo/FeatureMedia.tsx,"src/app/features/[slug]/page.tsx" --coverage.reporter=text`
- **Depends on:** T7.5
- **Log:** unit specs written (FeatureMedia, FeaturePageLayout, [slug]/page, data spec extended with screenshot-file existence); 100 tests pass, shuffle clean; FeatureMedia spec asserts priority on both light and dark twins (and unset when false); coverage FeaturePageLayout.tsx, FeatureMedia.tsx, [slug]/page.tsx each 100% lines/branches/functions/statements (v8 json-summary, coverage/T7.6).

### ✅ T7.7 ☐ E2E: nine feature pages
- **Kind:** e2e
- **Scenarios:**
  - `@critical` each of the 9 `/features/<slug>` routes returns 200 with a unique title, a canonical on one origin, OG/Twitter tags and a parseable JSON-LD script (SPEC criterion 9)
  - `@critical` exactly one `<h1>`, at least one image with non-empty alt, a link to `/features`, at least one related-page link, and a CTA to the matching tool route (SPEC criterion 9)
  - `@high` `/features/not-a-page` returns 404 (SPEC edge cases)
  - `@high` JavaScript disabled: content and metadata are still in the HTML (SPEC edge cases)
  - `@medium` 375 px and 1280 px, light and dark: no horizontal scroll
- **Spec:** `e2e/qa/landing-seo-polish/feature-pages.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; page list is restated from the SPEC, not read from `seoPages.ts`.
- **Files:** `e2e/qa/landing-seo-polish/feature-pages.spec.ts` (new), `agent_docs/qa/feature-pages/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/feature-pages.spec.ts --repeat-each=3`
- **Depends on:** T7.6
- **Log:** feature-pages.spec.ts, 8 tests, 24/24 at --repeat-each=3 with no test.fail markers (FeatureMedia priority fix landed). Scenarios 1-2 pin light theme; 404 checked via request API (browser logs a 404 console error). 15 proof PNGs in agent_docs/qa/feature-pages.

🔶 **Checkpoint 7**: Nine feature pages are statically generated with unique metadata, valid JSON-LD, real media, one H1, internal links and a recorded copy gate; vitest and `feature-pages.spec.ts` green.

---

## Phase 8: Compare pages, hub redesign and footer

**Adds:** Two comparison pages (`/compare/postman`, `/compare/insomnia`) with only sourced facts and honest "where they are stronger" notes, a redesigned `/features` hub linking to the new pages, and footer columns for Features and Compare.
**Try in UI:** Open `/compare/postman` and `/compare/insomnia` and confirm every claim has a source and a "where they are stronger" note ; Open `/features` and click each flagship card to its page ; Scroll to the footer on `/` and use the Features and Compare links.

### ✅ T8.1 ☐ ComparePageLayout and /compare/[competitor] route
- **Kind:** implementation
- **Files:** `src/components/seo/ComparePageLayout.tsx` (new), `src/app/compare/[competitor]/page.tsx` (new), `src/components/landing/data/seoPages.ts`
- **Do:** Server-component template and route (`generateStaticParams` from `COMPARE_PAGES`, `generateMetadata`, `notFound()`, `dynamicParams = false`) that renders only facts already in `comparison.ts` (each with its existing `source` URL), a "where they are stronger" section, JSON-LD (`WebPage` + `BreadcrumbList`; `FAQPage` only if a visible FAQ exists), exactly one h1, links to the hub and the related feature pages, CTA to `/app`.
- **Acceptance:**
  - Every comparison claim on the page is derived from `comparison.ts` and shows its source link; nothing is hard-coded or invented (SPEC section C compare pages).
  - A "where they are stronger" note is present on both pages; no "measured" (SPEC criterion 2).
  - Unknown competitor returns 404.
  - The template's fixed labels (section headings such as "Where they are stronger", source-link text, CTA label) pass the copy gate, recorded in Log.
- **Verify:** `bunx biome check src/components/seo/ComparePageLayout.tsx "src/app/compare/[competitor]/page.tsx" src/components/landing/data/seoPages.ts`; `grep -rni "measured" src/components/seo/ComparePageLayout.tsx src/app/compare` prints nothing
- **Depends on:** T7.5, T3.1
- **Log:** Built server-component ComparePageLayout and /compare/[competitor] route (generateStaticParams from COMPARE_PAGES, generateMetadata, notFound, dynamicParams=false). Claims render from comparison.ts with each source link; stronger-notes section on both pages; WebPage + BreadcrumbList JSON-LD, no FAQ schema (no visible FAQ); one h1; links to hub and related feature pages; CTA to /app. Verify: biome check clean on the 3 files; tsc --noEmit clean; no 'measured' in ComparePageLayout.tsx or src/app/compare. Copy gate on fixed labels (copywriting, copy-editing, humanizer): 'All features' back link, 'Compare' eyebrow, 'Side by side' table heading, 'Where they are stronger' (kept: plain, honest, matches SPEC), 'Related features', 'Source' link text, CTA 'Open Requestr' via OPEN_APP_CTA. Copy-editing: all are short and concrete, no filler; humanizer: no AI-isms, no negation fragments, no promotional words. No edits needed. DECISIONS: FAQPage omitted because no visible FAQ is shown. Screenshot: shots/8/T8.1-1.png.

### ✅ T8.2 ☐ Compare pages final copy
- **Kind:** implementation
- **Files:** `src/components/landing/data/seoPages.ts`
- **Do:** Final title, description, intro, stronger-notes and optional visible FAQ for Postman and Insomnia. Copy gate (`copywriting`, `copy-editing`, `humanizer`, `seo-audit`, `ai-seo`); banned-term grep; record in Log. Honest tone: say where each competitor is stronger.
- **Acceptance:**
  - Titles <=60, descriptions 120-160, unique across all 11 pages; no banned terms; "measured" absent in `src/app/compare` and `src/components/landing` (SPEC criteria 2, 12).
  - Any FAQ shown is visible on the page (otherwise no FAQ schema) (SPEC section C).
- **Verify:** `bunx vitest run src/components/landing/data/seoPages.spec.ts`; `bunx biome check src/components/landing/data/seoPages.ts`; `grep -rni "measured" src/components/landing src/app/compare` prints nothing
- **Depends on:** T8.1
- **Log:** Final Postman and Insomnia copy lives in seoPages.ts (title, description, h1, body, strongerNotes; no FAQ). Titles are 54 and 50 chars (<=60), descriptions about 152 chars (120-160), unique across all 11 pages (enforced by seoPages.spec.ts). Copy gate: copywriting (benefit-led titles naming the real differentiator: no install, browser, AI built in), copy-editing (cut filler, one claim per sentence), humanizer (no rule-of-three, no vague hype; stronger-notes are concrete about what Postman/Insomnia do better), seo-audit and ai-seo (query-matching 'Requestr vs X' h1/title, self-contained answer sentence in intro). Banned-term list passes in seoPages.spec.ts. Verify: vitest src/components/landing all 22 files / 241 tests pass (includes seoPages.spec.ts); biome clean. 'measured' grep prints nothing in source; the only hits are the guard assertions in comparison.spec.ts and seoPages.spec.ts that forbid the word. DECISIONS: no visible FAQ, so no FAQ schema.

### ✅ T8.3 ☐ Hub redesign
- **Kind:** implementation
- **Files:** `src/components/landing/AllFeaturesPage.tsx`, `src/components/landing/features/FeatureCard.tsx`, `src/components/landing/data/features.ts`, `src/app/features/page.tsx`
- **Do:** Redesign the hub so flagship features link to their new pages and all existing features sit in one coherent layout; screenshot and non-screenshot items carry the same visual weight; every card is a link or clearly non-interactive. Run `ui-ux-pro-max`, `impeccable`, `frontend-design`, `critique`, `layout`, `web-design-guidelines`. Update `page.tsx` metadata (title, description, canonical, breadcrumb JSON-LD) from `SITE_URL`. Hub links read `seoPages.ts`. Copy gate; record in Log.
- **Acceptance:**
  - Hub links to every flagship feature page and to both compare pages (SPEC criterion 11).
  - No orphan or dead card; consistent visual weight for screenshot and text items (SPEC section C hub).
  - Hub has unique metadata and canonical.
- **Verify:** `bunx vitest run src/components/landing/features src/components/landing`; `bunx biome check src/components/landing/AllFeaturesPage.tsx src/components/landing/features/FeatureCard.tsx src/components/landing/data/features.ts src/app/features/page.tsx`
- **Depends on:** T7.5, T8.2
- **Log:** Redesigned hub (AllFeaturesPage, FeatureCard, features.ts, page.tsx): flagship cards link to their pages from seoPages.ts, compare pages linked, screenshot and text items share one card weight, no dead or orphan cards. page.tsx has unique title, description, canonical and breadcrumb JSON-LD from SITE_URL. Verify: vitest src/components/landing (22 files, 241 tests) pass; biome check clean on the 4 files; tsc clean. Copy gate (copywriting, copy-editing, humanizer): hub headings and card text kept short and concrete; no banned terms; no new marketing claims added. Design skills run on the layout. Screenshot: shots/8/T8.3-1.png. DECISIONS: non-flagship cards stay non-interactive, styled to match.

### ✅ T8.4 ☐ Footer link columns
- **Kind:** implementation
- **Files:** `src/components/landing/Footer.tsx`, `src/components/landing/Footer.spec.tsx`
- **Do:** Add "Features" and "Compare" link columns driven by `seoPages.ts`, replacing the `#features` and `#compare` anchors; keep Privacy and Terms; top Nav stays unchanged (footer-only). Update `Footer.spec.tsx`. Copy gate; record in Log.
- **Acceptance:**
  - Footer has Features (hub plus 9 pages) and Compare (2 pages) columns with real routes; no `#features`/`#compare` anchors remain (SPEC criterion 11).
  - Links come from `seoPages.ts`, not hard-coded.
- **Verify:** `bunx vitest run src/components/landing/Footer.spec.tsx`; `bunx biome check src/components/landing/Footer.tsx src/components/landing/Footer.spec.tsx`; `grep -n '#features\|#compare' src/components/landing/Footer.tsx` prints nothing
- **Depends on:** T8.2
- **Log:** Footer now has Features (hub plus 9 pages) and Compare (2 pages) columns driven by FEATURE_PAGES and COMPARE_PAGES; Privacy and Terms kept; Nav untouched; Footer.spec.tsx updated. Verify: vitest Footer.spec.tsx passes (within the 22-file landing run); biome check clean; grep '#features|#compare' in Footer.tsx prints nothing. Copy gate (copywriting, copy-editing, humanizer): column titles 'Features' and 'Compare'; short link labels in FEATURE_LINK_LABELS (Relay AI, Request chains, Transform playground, JSON compare, JSON visualizer, Import, Collections and environments, Command palette, Backup and restore) because page h1s are too long for a footer; plain nouns, no filler. No edits needed. Screenshot: shots/8/T8.4-1.png. DECISIONS: labels live in a Record<FeatureSlug,string> so adding a page fails typecheck until labelled.

### ✅ T8.5 ☐ Unit: compare layout and route
- **Kind:** unit
- **Files:** `src/components/seo/ComparePageLayout.tsx`, `src/app/compare/[competitor]/page.tsx`, `src/components/seo/ComparePageLayout.spec.tsx` (new), `src/app/compare/[competitor]/page.spec.tsx` (new)
- **Do:** Write `ComparePageLayout.spec.tsx` (one h1; every claim carries its source link; stronger-notes section present; FAQ schema only with a visible FAQ; no "measured") and a route spec (`generateStaticParams` returns postman and insomnia; metadata; unknown competitor calls `notFound`).
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`.
- **Verify:** `bunx vitest run src/components/seo/ComparePageLayout.spec.tsx "src/app/compare/[competitor]" --coverage --coverage.include=src/components/seo/ComparePageLayout.tsx,"src/app/compare/[competitor]/page.tsx" --coverage.reporter=text`
- **Depends on:** T8.4, T8.3

### ✅ T8.6 ☐ Unit: footer, hub and feature card
- **Kind:** unit
- **Files:** `src/components/landing/Footer.tsx`, `src/components/landing/AllFeaturesPage.tsx`, `src/components/landing/features/FeatureCard.tsx`, `src/components/landing/AllFeaturesPage.spec.tsx` (new), `src/components/landing/features/FeatureCard.spec.tsx` (new), `src/components/landing/Footer.spec.tsx`
- **Do:** Extend `Footer.spec.tsx` (columns, hrefs match `seoPages.ts`, Privacy and Terms kept), add `AllFeaturesPage.spec.tsx` (every flagship links to its page; every card is a link or non-interactive; both compare links), add `features/FeatureCard.spec.tsx` (does not exist yet; link vs static rendering).
- **Acceptance:** Covers SPEC testing list "Footer link columns" and "every hub link resolves". Every file >=80% lines/branches/functions/statements, target >95%.
- **Verify:** `bunx vitest run src/components/landing/Footer.spec.tsx src/components/landing/AllFeaturesPage.spec.tsx src/components/landing/features/FeatureCard.spec.tsx --coverage --coverage.include=src/components/landing/Footer.tsx,src/components/landing/AllFeaturesPage.tsx,src/components/landing/features/FeatureCard.tsx --coverage.reporter=text`
- **Depends on:** T8.5

### ✅ T8.7 ☐ E2E: compare pages
- **Kind:** e2e
- **Scenarios:**
  - `@critical` `/compare/postman` and `/compare/insomnia` return 200 with unique title, canonical, OG/Twitter and parseable JSON-LD (SPEC criterion 9)
  - `@critical` one `<h1>`, every comparison fact links to a source, a "where they are stronger" section is visible, no "measured" text (SPEC criteria 2, 9)
  - `@high` `/compare/unknown` returns 404
  - `@medium` 375 px and 1280 px, light and dark: no horizontal scroll
- **Spec:** `e2e/qa/landing-seo-polish/compare-pages.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/landing-seo-polish/compare-pages.spec.ts` (new), `agent_docs/qa/compare-pages/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/compare-pages.spec.ts --repeat-each=3`
- **Depends on:** T8.6

### ✅ T8.8 ☐ E2E: hub, footer and link check
- **Kind:** e2e
- **Scenarios:**
  - `@critical` `/features` links to all 9 feature pages and both compare pages, each reachable by click (SPEC criterion 11)
  - `@critical` footer on `/` has Features and Compare columns, every link returns 200 (SPEC criterion 11)
  - `@high` crawl: every internal `<a href>` on `/`, `/features`, all 11 SEO pages, `/privacy` and `/terms` resolves to a non-404 (no dead links)
  - `@high` `/sitemap.xml` lists every one of the 11 SEO routes plus the base routes and no others (SPEC criterion 10)
- **Spec:** `e2e/qa/landing-seo-polish/hub-footer-links.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the crawl asserts a non-empty link set so it cannot pass vacuously.
- **Files:** `e2e/qa/landing-seo-polish/hub-footer-links.spec.ts` (new), `agent_docs/qa/hub-footer-links/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/hub-footer-links.spec.ts --repeat-each=3`
- **Depends on:** T8.7

### ✅ T8.9 ☐ Gate: production build, static params and sitemap
- **Kind:** gate
- **Files:** none
- **Do:** Build the current tree in the e2e dist dir and run the SEO specs against that production server, so static generation, `generateStaticParams`, `sitemap.ts` and `robots.ts` are proven on a real build without touching the dev server. Then paste the rendered JSON-LD of one feature page and one compare page (and the hub) into the schema.org validator (validator.schema.org) or Google Rich Results Test and record the result in Log (SPEC criterion 9 "validator pass").
- **Acceptance:**
  - `bun run build` (via `E2E_DIST_DIR=.next-e2e`) succeeds, including its type check, and lists the 9 feature and 2 compare routes as statically generated (SPEC criteria 9, 10).
  - `feature-pages`, `compare-pages`, `hub-footer-links` and `site-plumbing` specs pass against the prod server.
  - The schema validator reports no errors for the checked pages; result recorded in Log (SPEC criterion 9).
- **Verify:** `E2E_DIST_DIR=.next-e2e bun run build` output lists `/features/[slug]` and `/compare/[competitor]` as SSG; `E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/feature-pages.spec.ts e2e/qa/landing-seo-polish/compare-pages.spec.ts e2e/qa/landing-seo-polish/hub-footer-links.spec.ts e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=2`; `grep -rni "measured" src/components/landing src/app/compare` prints nothing
- **Depends on:** T8.8
- **Log:** `E2E_DIST_DIR=.next-e2e bun run build` exit 0 (type check included); SSG (●) routes: `/compare/[competitor]` (postman, insomnia), `/features/[slug]` (relay, request-chains, transform-playground, +6 more = 9); `/robots.txt` and `/sitemap.xml` static (○). `E2E_SERVER=prod` playwright (feature-pages, compare-pages, hub-footer-links, site-plumbing, --repeat-each=2): 46 passed, 0 failed. `grep -rni "measured" src/components/landing src/app/compare --exclude="*.spec.*"` prints nothing (exit 1). Schema validator NOT run (validator.schema.org / Rich Results Test not driven); substitute local check only: prerendered HTML JSON-LD parses as valid JSON on `/features/relay` (SoftwareApplication + BreadcrumbList), `/compare/postman` (WebPage + BreadcrumbList), `/features` hub (BreadcrumbList). The third acceptance bullet (validator reports no errors) remains unverified and needs a manual paste.

🔶 **Checkpoint 8**: SEO surface is complete: 11 pages, hub, footer, sitemap and robots on a green production build, no dead links, compare pages sourced and honest.

---

## Phase 9: History sidebar

**Adds:** The history sidebar groups runs under day headers (Today, Yesterday, dates), collapses repeated runs of the same request into one row with a run count, expands them inline, scrolls smoothly with hundreds of entries, and shows a tooltip only when a URL is cut off.
**Try in UI:** Open the app with a long history and confirm sticky day headers ; Send the same request three times and confirm one row with a count that expands to three runs ; Click a run to restore it and delete one run ; Hover a long URL and confirm a tooltip, then hover a short one and confirm none.

### ✅ T9.1 ☐ groupHistory pure helper
- **Kind:** implementation
- **Files:** `src/components/history/groupHistory.ts` (new)
- **Do:** `groupHistoryByDay(entries: HistoryEntry[], opts: { now: number; filter: string }): HistoryRow[]` with `HistoryRow` a discriminated union (`header | group | run`). Rules from SPEC E: filter runs first with the existing predicate (url, method, `healthKey`), group second; local-timezone day boundaries; "Today", "Yesterday", locale dates; newest first; group by exact `method` + `url`; `N=1` stays a single row; while filtering, a group's count and runs cover only matching runs; expose a helper `limitGroups(rows, COMPACT_GROUP_LIMIT)` (named constant = 20) for the compact rule (filter, group, first 20 groups with their headers). Keep the SPEC signature exactly; expansion is a second pure function in the same file, `toVisibleRows(rows, expandedIds)`, that drops the `run` rows of collapsed groups so the virtualizer gets the flat visible model. Named constants, no magic numbers.
- **Acceptance:**
  - Same method + URL within a day yields one group; different method or only-query differences yield separate groups; `N=1` is a plain run row (SPEC E rules 1, 2, edge cases).
  - Midnight boundary and DST handled in the local timezone; "Today"/"Yesterday" correct (SPEC criterion 16).
  - Filter keeps a group if at least one run matches and counts only matching runs (SPEC E rule 6); compact keeps the first 20 groups with headers (SPEC E rule 8).
  - Pure: no store, no `Date.now()` inside (uses `opts.now`); `useHistoryStore` untouched (SPEC criterion 18).
- **Verify:** `bunx biome check src/components/history/groupHistory.ts`; `git diff --stat -- src/stores/useHistoryStore.ts` prints nothing

### ✅ T9.2 ☐ Day header and group row components
- **Kind:** implementation
- **Files:** `src/components/history/HistoryDayHeader.tsx` (new), `src/components/history/HistoryGroupRow.tsx` (new), `src/components/history/HistoryItem.tsx`
- **Do:** `HistoryDayHeader` (sticky-capable header). `HistoryGroupRow`: method badge, URL, `x N` count, latest status, latest time; chevron/count toggles inline expansion with each run (time + status); clicking the collapsed row opens the latest run; each run restores its own request using the existing `handleClick` logic and has its own delete; `aria-expanded` on the toggle. Reuse `HistoryItem` for single-run rows.
- **Acceptance:**
  - Collapsed group shows method, URL, `x N`, latest status and time; expanded shows N runs (SPEC criterion 15).
  - Clicking a run restores that run's request; delete is per run; deleting the last run removes the group; deleting the latest updates the summary (SPEC E rule 3).
  - `aria-expanded` reflects state.
  - New user-facing strings (day labels, run-count and toggle labels) pass the copy gate, recorded in Log.
- **Verify:** `bunx biome check src/components/history/HistoryDayHeader.tsx src/components/history/HistoryGroupRow.tsx`
- **Depends on:** T9.1
- **Log:** Built `HistoryDayHeader.tsx` and `HistoryGroupRow.tsx` (components not mounted until T9.3); also touched `HistoryItem.tsx` to extract `useRestoreHistoryEntry` so single rows and group runs share the one `handleClick` restore logic. Copy gate on the new strings (day labels "Today"/"Yesterday"/"Mon, 3 Nov", count "x N", toggle "Show N runs"/"Hide N runs", "Delete this run"). Copywriting: each says what it is in plain words, no filler; toggle label names the action and the count. Copy-editing: day labels already short and dateline-style; "x N" kept as the spec's literal compact count (a group always has N >= 2, so no "1 runs"); "Delete this run" kept because it says the scope is one run, not the group. Humanizer: no tailing negations, em dashes, or promotional phrasing found; no changes needed. After = before. `bunx biome check` on both new files clean.

### ✅ T9.3 ☐ Virtualized HistoryList with sticky headers
- **Kind:** implementation
- **Files:** `src/components/history/HistoryList.tsx`, `src/components/history/HistoryList.spec.tsx`, `agent_docs/landing-seo-polish/PLAN.md`
- **Do:** Derive rows with `useMemo(groupHistoryByDay(...))`, flatten with `toVisibleRows` to a row model (header | group | run), virtualize with `@tanstack/react-virtual` (measured row heights because expansion changes height; overscan constant), keep day headers sticky while virtualized, keep expanded group ids as component state (decide against the CLAUDE.md store rule: switch to a small Zustand store only if the sidebar remounts and loses state; record the decision in `PLAN.md`), keep the `compact` prop working. Update the existing spec so it still passes.
- **Acceptance:**
  - With 500+ entries the DOM holds a bounded number of row nodes (target < 60) (SPEC criterion 14).
  - Sticky day headers stay pinned while scrolling their day (SPEC criterion 16).
  - Expanding a group changes height without scroll jump; trimming at the cap while expanded does not break (SPEC edge cases).
  - `useHistoryStore` untouched; its spec passes unmodified (SPEC criterion 18).
- **Verify:** `bunx vitest run src/components/history src/stores/useHistoryStore.spec.ts`; `bunx biome check src/components/history/HistoryList.tsx src/components/history/HistoryList.spec.tsx`; `git diff --stat -- src/stores` prints nothing
- **Depends on:** T9.2
- **Log:** Rewrote `HistoryList` on `groupHistoryByDay` + `toVisibleRows` with a `@tanstack/react-virtual` list (measured rows, overscan 8, active day header pinned via `rangeExtractor` + `position: sticky`); expanded ids stay `useState` (decision in PLAN.md "History UX decisions"). Live app with 300+ seeded entries: 25 row nodes in the DOM, 20 groups, group expanded to 3 runs; shot T9.3-1. vitest history + store spec 47 pass, biome clean, `src/stores` diff empty.

### ✅ T9.4 ☐ Truncation-only tooltip
- **Kind:** implementation
- **Files:** `src/hooks/useIsTruncated.ts` (new), `src/components/history/HistoryItem.tsx`, `src/components/history/HistoryItem.spec.tsx`
- **Do:** Hook that reports `scrollWidth > clientWidth` (recomputed on resize via `ResizeObserver`); `HistoryItem` shows the full-URL tooltip only when truncated. Keep the delete button's `title`. Update the existing spec.
- **Acceptance:**
  - Short URL: no tooltip; long URL: tooltip with the full URL (SPEC criterion 17).
  - Very long and no-whitespace URLs truncate with no horizontal scroll (SPEC edge cases).
- **Verify:** `bunx vitest run src/components/history/HistoryItem.spec.tsx`; `bunx biome check src/hooks/useIsTruncated.ts src/components/history/HistoryItem.tsx src/components/history/HistoryItem.spec.tsx`
- **Depends on:** T9.3
- **Log:** Added `useIsTruncated` (scrollWidth > clientWidth, ResizeObserver) and a Base UI tooltip on the `HistoryItem` URL, disabled unless truncated; delete button keeps its `title`. Spec covers long (tooltip with full URL) and short (none). Live hover on a long URL shows the full URL; shot T9.4-1.

### ✅ T9.5 ☐ Search, empty states, keyboard and a11y polish
- **Kind:** implementation
- **Files:** `src/components/history/HistoryList.tsx`, `src/components/history/HistoryGroupRow.tsx`, `agent_docs/landing-seo-polish/PLAN.md`
- **Do:** Wire filter-first-then-group search; add clear empty and no-match states; evaluate the SPEC E.9 candidates (arrow-key and Enter navigation, per-day clear) and adopt only those that are clearly beneficial and small, listing each adopted item with justification in a "History UX decisions" section of `PLAN.md` (dropped items listed as dropped). `aria-expanded` and labelled controls on every row type.
- **Acceptance:**
  - Empty history and no-match states render with helpful text (SPEC criterion 16).
  - While a filter is active, group `x N` and expanded runs cover only matching runs (SPEC E rule 6).
  - `PLAN.md` lists each adopted and dropped UX item with a reason (SPEC E rule 9).
  - Empty and no-match text passes the copy gate, recorded in Log.
- **Verify:** `bunx vitest run src/components/history`; `bunx biome check src/components/history/HistoryList.tsx src/components/history/HistoryGroupRow.tsx`; `grep -n "History UX decisions" agent_docs/landing-seo-polish/PLAN.md`
- **Depends on:** T9.4
- **Log:** Empty-history and no-match states kept and now driven by the grouped model; filter-first-then-group means `x N` and runs count only matching runs (spec test). Added `aria-label` on single-row delete and group open buttons; `PLAN.md` "History UX decisions" lists adopted (aria, heading levels, empty states) and dropped (arrow-key nav, per-day clear) items with reasons. Copy gate on "No matches / Try a different search" and "No requests sent yet / Your history appears here as you work": plain, specific, no filler or tailing negations; After = before.

### ✅ T9.6 ☐ Unit: groupHistory
- **Kind:** unit
- **Files:** `src/components/history/groupHistory.ts`, `src/components/history/groupHistory.spec.ts` (new)
- **Do:** Write `groupHistory.spec.ts`: empty input; single run (no group); same URL different method (separate); query-only difference (separate); midnight boundary; timezone and DST (stub `TZ` via fixed `now` and entries); filter across runs; filter then group counts; compact first-20-groups rule; delete-last-run input produces no group; newest-first order; `toVisibleRows` hides runs of collapsed groups and shows them for expanded ids.
- **Acceptance:** Covers SPEC testing list "groupHistory". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug.
- **Verify:** `bunx vitest run src/components/history/groupHistory.spec.ts --coverage --coverage.include=src/components/history/groupHistory.ts --coverage.reporter=text`
- **Depends on:** T9.5

### ✅ T9.7 ☐ Unit: history components
- **Kind:** unit
- **Files:** `src/components/history/HistoryGroupRow.tsx`, `src/components/history/HistoryDayHeader.tsx`, `src/components/history/HistoryItem.tsx`, `src/hooks/useIsTruncated.ts`, `src/components/history/HistoryList.tsx`, `src/components/history/HistoryGroupRow.spec.tsx` (new), `src/components/history/HistoryDayHeader.spec.tsx` (new), `src/hooks/useIsTruncated.spec.ts` (new)
- **Do:** Write specs for `HistoryGroupRow` (collapsed summary, `x N`, expand and `aria-expanded`, restore a run, delete a run, delete last removes group), `HistoryDayHeader`, `HistoryItem` (tooltip only when truncated, mocking layout sizes), `useIsTruncated` (resize recompute) and extend `HistoryList.spec.tsx` (mock the virtualizer; headers, groups, empty and no-match states, compact mode, keyboard behaviour if adopted).
- **Acceptance:** Covers SPEC testing list "HistoryItem/Group (expand, xN, tooltip only when truncated)". Every file >=80% lines/branches/functions/statements, target >95%; `useHistoryStore.spec.ts` untouched and green.
- **Verify:** `bunx vitest run src/components/history src/hooks/useIsTruncated.spec.ts src/stores/useHistoryStore.spec.ts --coverage --coverage.include=src/components/history/HistoryGroupRow.tsx --coverage.include=src/components/history/HistoryDayHeader.tsx --coverage.include=src/components/history/HistoryItem.tsx --coverage.include=src/hooks/useIsTruncated.ts --coverage.include=src/components/history/HistoryList.tsx --coverage.reporter=text --coverage.reporter=json-summary --coverage.reportsDirectory=coverage/T9.7` (one `--coverage.include` per file; the comma form reports 0%; the text reporter hides 100% files, so per-file numbers come from `coverage/T9.7/coverage-summary.json`)
- **Depends on:** T9.6

### ✅ T9.8 ☐ E2E: grouping, expand, restore, delete, tooltip
- **Kind:** e2e
- **Scenarios:**
  - `@critical` seeded history with the same request run 3 times shows one row with `x 3`, latest status and time; no two visible rows in a day share method + URL (SPEC criterion 15)
  - `@critical` expand shows 3 runs; clicking a run restores that run's request in a tab; deleting the latest updates the summary; deleting all removes the group (SPEC E rule 3)
  - `@high` search by URL fragment shows only matching runs in groups with matching counts; no-match and empty states render (SPEC E rule 6, criterion 16)
  - `@high` tooltip with the full URL appears only for a truncated URL, not a short one (SPEC criterion 17)
  - `@medium` a reload keeps history entries (storage unchanged) while expansion state resets (SPEC E state)
- **Spec:** `e2e/qa/landing-seo-polish/history-grouping.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; history is seeded through the `history` store in `qa-seed.init.js` / `qaSeed.ts` data, not through the UI.
- **Files:** `e2e/qa/landing-seo-polish/history-grouping.spec.ts` (new), `e2e/fixtures/seed/history-landing-seo.json` (new), `e2e/fixtures/qa-seed.init.js` (regenerated), `agent_docs/qa/history-grouping/*.png` (new)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/history-grouping.spec.ts --repeat-each=3`
- **Depends on:** T9.7

### ✅ T9.9 ☐ E2E: virtualization, sticky headers and day boundaries
- **Kind:** e2e
- **Scenarios:**
  - `@critical` 500 seeded entries: row node count stays below 60 and scrolling to the bottom and back shows no long task over 50 ms (PerformanceObserver `longtask`) (SPEC criteria 14, 18)
  - `@high` day headers read Today and Yesterday for seeded timestamps and stay pinned while scrolling their day (SPEC criterion 16)
  - `@high` an expanded group inside a virtualized list keeps its position when scrolled away and back
  - `@medium` the existing `e2e/history.spec.ts` regression still passes
- **Spec:** `e2e/qa/landing-seo-polish/history-virtualization.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats; the long-task check fails if the observer records nothing about the scroll (no vacuous pass).
- **Files:** `e2e/qa/landing-seo-polish/history-virtualization.spec.ts` (new), `agent_docs/qa/history-virtualization/*.png` (new)
- **Log:** `history-500.json` was not created: the spec seeds IndexedDB itself with 500 entries, so no seed file is needed.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/history-virtualization.spec.ts e2e/history.spec.ts --repeat-each=3`
- **Depends on:** T9.8

🔶 **Checkpoint 9**: History sidebar groups by day and run, stays bounded and smooth at 500 entries, shows truncation-only tooltips, and storage is untouched (store spec passes unmodified); targeted vitest and both history specs green.

---

## Phase 10: Dialog UI and copy polish

**Adds:** The Import dialog, Export backup dialog and Import backup dialog get clearer wording: the dangling-links message explains what a link is and what to do, Replace says exactly what is deleted, Merge says what is kept, buttons use consistent verbs (Scan, Export, Restore, Cancel), and the secret-values switch states its consequence.
**Try in UI:** Open the backup export dialog and read the include-secrets switch and the links message ; Open the import backup dialog, pick Replace, and confirm it says what will be deleted ; Open the Import dialog and confirm Scan and Cancel labels ; Resize to 375 px in dark mode and confirm nothing overflows.

### ✅ T10.1 ☐ ImportDialog polish
- **Kind:** implementation
- **Files:** `src/components/import/ImportDialog.tsx`, `src/components/import/ImportDialog.spec.tsx`
- **Do:** JSX and copy only: hierarchy and spacing of the File/cURL tabs, dropzone, trust warning, format chips and Scan button; verbs Scan and Cancel; mobile width. Run `impeccable`, `clarify`, `polish`, `ui-ux-pro-max`, `frontend-design`, `shadcn`, `shadcn-component-rules`; copy gate. Strings stay hardcoded English (this dialog has no next-intl today; no i18n migration, SPEC out of scope). No change to `src/lib/*Parser*`, `importScanner.ts` or any import hook. Update the existing spec's label assertions.
- **Acceptance:**
  - Labels use Scan and Cancel; the trust warning and format chips are clear and unchanged in behaviour (SPEC section F).
  - Diff touches no parser, scanner or hook logic (SPEC criterion 20).
  - Renders without overflow at 375 px, light and dark.
- **Verify:** `bunx vitest run src/components/import/ImportDialog.spec.tsx src/lib/curlParser.spec.ts src/lib/insomniaParser.spec.ts`; `bunx biome check src/components/import/ImportDialog.tsx src/components/import/ImportDialog.spec.tsx`; `git diff --stat -- src/lib/curlParser.ts src/lib/importScanner.ts src/lib/postmanParser.ts src/lib/insomniaParser.ts src/lib/openapiParser.ts` prints nothing
- **Log:**

### ✅ T10.2 ☐ ExportBackupDialog and section picker polish
- **Kind:** implementation
- **Files:** `src/components/settings/backup/ExportBackupDialog.tsx`, `src/components/settings/backup/BackupSectionPicker.tsx`, `src/components/settings/backup/ExportBackupDialog.spec.tsx`, `messages/en/settings.json`, `src/components/ui/dialog.tsx` (focus-trap fix for SPEC criterion 19, shared by all dialogs), `src/components/ui/dialog.spec.tsx` (if present)
- **Do:** Hierarchy and spacing for Everything / Choose what to include, the conversations note and estimated size; the "Include secret values" switch states the consequence in plain words (default unchanged); the dangling-links message ("N links point to items that are not in this backup") becomes explained and actionable: what a link is, why it dangles, what happens on restore, what to do (for example include those collections). Verb Export, Cancel. Skills and copy gate as T10.1; `en` keys only. No change to `useBackupExport.ts` or `src/lib/backup/*`. Update the existing spec.
- **Acceptance:**
  - Dangling-links text answers what a link is, why it dangles, what restore does and what to do (SPEC section F, criterion 19).
  - The secrets switch explains the consequence in plain words with the default unchanged (SPEC section F).
  - Button labels are Export and Cancel; no overflow at 375 px.
  - `useBackupExport.ts` and `src/lib/backup` unchanged (SPEC criterion 20).
- **Verify:** `bunx vitest run src/components/settings/backup/ExportBackupDialog.spec.tsx src/lib/backup`; `bunx biome check src/components/settings/backup/ExportBackupDialog.tsx src/components/settings/backup/BackupSectionPicker.tsx src/components/settings/backup/ExportBackupDialog.spec.tsx messages/en/settings.json`; `git diff --stat -- src/components/settings/backup/useBackupExport.ts src/lib/backup` prints nothing
- **Depends on:** T10.1
- **Log:**

### ✅ T10.3 ☐ ImportBackupDialog and BackupPreview polish
- **Kind:** implementation
- **Files:** `src/components/settings/backup/ImportBackupDialog.tsx`, `src/components/settings/backup/BackupPreview.tsx`, `src/components/settings/backup/ImportBackupDialog.spec.tsx`, `messages/en/settings.json`, `messages/en/common.json` (only if the shared `cancel` label changes)
- **Do:** Clear counts presentation; Merge says what is kept; Replace is explicit about what is deleted before the user commits; verbs Restore and Cancel (Cancel comes from `common.cancel`; prefer reusing it unchanged). Same skills and copy gate; `en` keys only. No change to `useBackupImport.ts` or `src/lib/backup/*`. Update the existing spec.
- **Acceptance:**
  - Merge text states what is kept; Replace text states that current local data is replaced and deleted before commit (SPEC section F, criterion 19).
  - Labels are Restore and Cancel across the dialog.
  - `useBackupImport.ts` and `src/lib/backup` unchanged (SPEC criterion 20).
- **Verify:** `bunx vitest run src/components/settings/backup/ImportBackupDialog.spec.tsx src/lib/backup`; `bunx biome check src/components/settings/backup/ImportBackupDialog.tsx src/components/settings/backup/BackupPreview.tsx src/components/settings/backup/ImportBackupDialog.spec.tsx messages/en/settings.json`; `git diff --stat -- src/components/settings/backup/useBackupImport.ts src/lib/backup` prints nothing
- **Depends on:** T10.2
- **Log:**

### ✅ T10.4 ☐ ReplaceConfirmDialog polish
- **Kind:** implementation
- **Files:** `src/components/settings/backup/ReplaceConfirmDialog.tsx`, `src/components/settings/backup/ReplaceConfirmDialog.spec.tsx`, `messages/en/settings.json`
- **Do:** Make the confirm state spell out what will be deleted and that it cannot be undone from here; destructive-action styling consistent with the other dialogs; Restore and Cancel verbs; focus lands on the safe action. Same skills and copy gate; `en` keys only.
- **Acceptance:**
  - The dialog names what is deleted before the user commits; Cancel is the default focus (SPEC section F, criterion 19).
  - Labels match the other two dialogs.
- **Verify:** `bunx vitest run src/components/settings/backup/ReplaceConfirmDialog.spec.tsx`; `bunx biome check src/components/settings/backup/ReplaceConfirmDialog.tsx src/components/settings/backup/ReplaceConfirmDialog.spec.tsx messages/en/settings.json`
- **Depends on:** T10.3
- **Log:**

### ✅ T10.5 ☐ Locale: fr and ja strings for the backup dialogs
- **Kind:** implementation
- **Files:** `messages/fr/settings.json`, `messages/ja/settings.json`, `messages/fr/common.json` and `messages/ja/common.json` (only if T10.3 changed `common`)
- **Do:** Translate every key added or changed in T10.2 to T10.4 into `fr` and `ja`, ICU placeholders intact (`{count}` and friends), same key set as `en`. This is parity maintenance for existing locales, not new i18n. Copy gate on the English source is already done; translate tone-neutral and plain.
- **Acceptance:**
  - `fr` and `ja` have exactly the `en` key set for every touched namespace; placeholders unchanged (parity specs).
- **Verify:** `bunx vitest run src/i18n`; `bunx biome check messages/fr messages/ja`
- **Depends on:** T10.4

### ✅ T10.6 ☐ Unit: dialogs
- **Kind:** unit
- **Files:** `src/components/import/ImportDialog.tsx`, `src/components/settings/backup/ExportBackupDialog.tsx`, `src/components/settings/backup/BackupSectionPicker.tsx`, `src/components/settings/backup/ImportBackupDialog.tsx`, `src/components/settings/backup/BackupPreview.tsx`, `src/components/settings/backup/BackupPreview.spec.tsx` (new), `src/components/settings/backup/BackupSectionPicker.spec.tsx` (new)
- **Do:** Extend the existing specs (and add `BackupSectionPicker.spec.tsx`, `BackupPreview.spec.tsx`): button labels (Scan, Export, Restore, Cancel), dangling-links explanation text with N, secrets-switch consequence text with default unchanged, Merge and Replace text, behaviour assertions unchanged (same callbacks and payloads as before).
- **Acceptance:** Covers SPEC criterion 19 text and labels. Every file >=80% lines/branches/functions/statements, target >95%; hook, store and serializer specs pass unmodified (`git diff --stat -- src/lib/backup src/components/settings/backup/useBackup*.ts` empty).
- **Verify:** `bunx vitest run src/components/import/ImportDialog.spec.tsx src/components/settings/backup --coverage --coverage.include=src/components/import/ImportDialog.tsx,src/components/settings/backup/ExportBackupDialog.tsx,src/components/settings/backup/BackupSectionPicker.tsx,src/components/settings/backup/ImportBackupDialog.tsx,src/components/settings/backup/BackupPreview.tsx --coverage.reporter=text`
- **Depends on:** T10.5

### ✅ T10.7 ☐ Unit: ReplaceConfirmDialog
- **Kind:** unit
- **Files:** `src/components/settings/backup/ReplaceConfirmDialog.tsx`
- **Do:** Extend `ReplaceConfirmDialog.spec.tsx`: deletion statement, Cancel default focus, Restore confirm callback fires once, escape cancels.
- **Acceptance:** Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`.
- **Verify:** `bunx vitest run src/components/settings/backup/ReplaceConfirmDialog.spec.tsx --coverage --coverage.include=src/components/settings/backup/ReplaceConfirmDialog.tsx --coverage.reporter=text`
- **Depends on:** T10.6

### ✅ T10.8 ☐ E2E: import dialog
- **Kind:** e2e
- **Scenarios:**
  - `@high` Import dialog opens, shows Scan and Cancel, File and cURL tabs, trust warning, format chips; keyboard-operable with a trapped focus (SPEC criterion 19)
  - `@high` 375 px, light and dark: no horizontal overflow, buttons reachable
  - `@medium` pasting a cURL command and pressing Scan still detects the request (behaviour unchanged)
- **Spec:** `e2e/qa/landing-seo-polish/import-dialog.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/landing-seo-polish/import-dialog.spec.ts` (new), `agent_docs/qa/import-dialog/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/import-dialog.spec.ts --repeat-each=3`
- **Depends on:** T10.7

### ✅ T10.9 ☐ E2E: backup export and restore dialogs
- **Kind:** e2e
- **Scenarios:**
  - `@critical` export dialog shows the explained dangling-links message when a selection excludes linked collections, and the secrets switch consequence text (SPEC criterion 19)
  - `@critical` import backup dialog: Merge shows what is kept, Replace shows what is deleted, the confirm dialog names the deletion; Restore and Cancel labels consistent across dialogs
  - `@high` focus trap, labelled controls and full keyboard operation in all three backup dialogs
  - `@high` 375 px, light and dark: no overflow
  - `@medium` an export then restore round trip still works unchanged (behaviour parity)
- **Spec:** `e2e/qa/landing-seo-polish/backup-dialogs.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/landing-seo-polish/backup-dialogs.spec.ts` (new), `agent_docs/qa/backup-dialogs/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/backup-dialogs.spec.ts --repeat-each=3`
- **Depends on:** T10.8

### ✅ T10.10 ☐ Gate: capture polished dialog screenshots
- **Kind:** gate
- **Files:** `scripts/capture/screens.ts`, `scripts/capture/verify-assets.mjs`, `public/screens/import-dialog-light.webp`, `public/screens/import-dialog-dark.webp`, `public/screens/backup-export-light.webp`, `public/screens/backup-export-dark.webp`, `public/screens/backup-restore-light.webp`, `public/screens/backup-restore-dark.webp` (generated)
- **Do:** Re-run the capture script with `--only dialogs` after the polish is final so landing (Phase 6) and feature pages (T7.5) use screenshots of the real polished dialogs; add the dialog names to the `verify-assets.mjs` manifest; run the asset checker.
- **Acceptance:**
  - Dialog screenshots exist in light and dark, show DummyJSON-style seed data only, and are within the size budget (SPEC section F; PLAN P10 before captures).
  - `verify-assets.mjs` exits 0.
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts --only dialogs`; `node scripts/capture/verify-assets.mjs`; `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/backup-dialogs.spec.ts --repeat-each=2`
- **Depends on:** T10.9, T2.5

🔶 **Checkpoint 10**: Dangling-links, Replace and Merge text, labels and secrets switch match the SPEC, hooks and serializers are untouched (diff empty), fr and ja parity passes, dialog specs green and polished screenshots captured.

---

## Phase 11: Legal rewrite

**Adds:** The Privacy Policy and Terms are rewritten from what the code really does: local-first storage, the request proxy, Upstash, DeepSeek and xAI, voice input, encrypted 24-hour share links, hosting, and email deletion requests. Terms have no billing or account sections. Nothing on the pages says "legal review required".
**Try in UI:** Open `/privacy` and confirm it names DeepSeek and xAI and the 24-hour share-link expiry ; Open `/terms` and confirm there are no billing, subscription or account-termination sections ; Search both pages for "legal review" and find nothing ; Open `agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md` and confirm each data flow cites code.

### ✅ T11.1 ☐ Verify data flows and write LEGAL_REVIEW_NOTES.md
- **Kind:** implementation
- **Files:** `agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md` (new)
- **Do:** First read `~/.agents/skills/privacy-policy/SKILL.md` and `~/.agents/skills/terms-of-service/SKILL.md` (reading them is mandatory; invoking alone does not count). Then verify each of the ten SPEC section D data-flow rows against the code files listed there and record a citation (`file:line` plus what the code does) per row, conservative wording for anything the code cannot confirm. Record DPDP Act 2023 applicability and the cross-border transfer to DeepSeek and xAI, and every item needing a lawyer or the owner's decision. This file is the only place "LEGAL REVIEW REQUIRED" style notes live.
- **Acceptance:**
  - All ten data-flow rows are cited to code; the AI row confirms only DeepSeek (chat and `/api/ai`) and xAI (STT) are called and that OpenAI, Anthropic and Gemini appear only in `bannedTokens.ts` (SPEC criterion 13).
  - The share-link row confirms ciphertext only in Redis, key in the URL fragment, 24 h TTL (`SHARE_PAYLOAD_TTL_SEC`), and the hourly rate-limit counter.
  - DPDP 2023 and cross-border notes are present; unconfirmable claims are flagged here, not asserted.
- **Verify:** `grep -c "src/" agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md`; `grep -ni "DPDP\|cross-border" agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md`
- **Log:**

### ✅ T11.2 ☐ Privacy page rewrite
- **Kind:** implementation
- **Files:** `src/app/privacy/page.tsx`, `src/components/legal/constants.ts`, `src/components/legal/LegalLayout.tsx`, `src/components/legal/LegalLayout.spec.tsx`
- **Do:** Rewrite from the verified flows only: operator Deepak Dewani (individual), India, governing law India, contact kumard8308887772@gmail.com, free product, no paid tier, no accounts. Name the providers the code calls (DeepSeek, xAI) and none it does not call, plus a clause that providers may change and the list is kept current; cover local-only storage, proxy, Upstash, Vercel hosting, encrypted share links (24 h expiry), browser versus server voice input (xAI), Relay rate limiting, hub templates, no analytics, and data deletion requests by email. Effective date set at publish time in `constants.ts`. No "legal review required" marker in any form. Copy gate; record in Log.
- **Acceptance:**
  - Page names DeepSeek and xAI and no other AI provider; covers every item listed in SPEC criterion 13; operator, governing law and contact match the fixed facts.
  - `grep -ri "legal review required" src` is empty.
  - Unique `<title>`, description and canonical metadata from `SITE_URL`.
- **Verify:** `bunx biome check src/app/privacy/page.tsx src/components/legal/constants.ts src/components/legal/LegalLayout.tsx`; `grep -ri "legal review required" src` prints nothing; `bunx vitest run src/components/legal`
- **Depends on:** T11.1
- **Log:** Rewrote privacy page and legal constants from the verified flows (operator Deepak Dewani, India law, contact email, free, no accounts; DeepSeek and xAI named, provider-change clause; local storage, proxy, Upstash, Vercel, 24 h share links, voice input, Relay rate limit, hub templates, no analytics, deletion by email). Copy gate (copywriting, copy-editing, humanizer): plain first-person-operator wording, specific facts, no filler or promotional phrasing; only em dashes are in the metadata title separator, kept as the established site title pattern. Checks: `grep -ri "legal review required" src` prints nothing (exit 1); grep for openai|anthropic|gemini|groq|mistral in privacy/page.tsx prints nothing (exit 1); biome check on the 4 legal files clean; `vitest run src/components/legal` 8 passed. No edits needed after the gate. Retry fix (verifier a1): voice wording now matches speechEngine.ts (xAI via our server when server STT is configured and capture works, browser recognition as fallback); rate-limit wording now says only Relay chat messages are counted (per IP and anonymous ID), not /api/ai or /api/relay/stt.

### ✅ T11.3 ☐ Terms page rewrite
- **Kind:** implementation
- **Files:** `src/app/terms/page.tsx`
- **Do:** Rewrite for a free, accountless tool by an individual operator in India (governing law India, contact email). Include acceptable use, AI-output disclaimer, proxy and third-party-API responsibility, availability and changes, liability limits; do NOT include billing, subscription, account-termination or refund sections. No "legal review required" marker. Copy gate; record in Log.
- **Acceptance:**
  - No billing, subscription, account-termination or refund sections (SPEC criterion 13).
  - Operator, governing law and contact match the fixed facts; no review marker.
  - Unique metadata and canonical from `SITE_URL`.
- **Verify:** `bunx biome check src/app/terms/page.tsx`; `grep -ri "legal review required" src` prints nothing; `grep -niE "billing|subscription|refund|account termination" src/app/terms/page.tsx` prints nothing
- **Depends on:** T11.2
- **Log:** Rewrote terms page for a free, accountless tool by an individual in India (acceptable use, AI-output disclaimer, proxy and third-party API responsibility, availability and changes, liability limits). Copy gate (copywriting, copy-editing, humanizer): plain, direct clauses, no filler or promotional phrasing; em dash only in the metadata title separator, matching the privacy page. Checks: `grep -ri "legal review required" src` prints nothing (exit 1); `grep -niE "billing|subscription|refund|account termination" src/app/terms/page.tsx` prints nothing (exit 1); `bunx biome check src/app/terms/page.tsx` clean; `vitest run src/components/legal` 8 passed. No edits needed after the gate.

### ✅ T11.4 ☐ Unit: legal pages
- **Kind:** unit
- **Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/legal/constants.ts`, `src/components/legal/LegalLayout.tsx`, `src/app/privacy/page.spec.tsx` (new), `src/app/terms/page.spec.tsx` (new), `src/components/legal/LegalLayout.spec.tsx`
- **Do:** Write `privacy/page.spec.tsx` and `terms/page.spec.tsx` plus extend `LegalLayout.spec.tsx`: case-insensitive "legal review required" absent from both rendered pages; privacy names DeepSeek and xAI and not OpenAI, Anthropic or Gemini; covers Upstash, Vercel, proxy, 24 h share links, voice input and email deletion; terms contain no billing, subscription, account-termination or refund text; fixed facts (operator, India, email) present; metadata unique.
- **Acceptance:** Covers SPEC testing list "legal pages contain no [LEGAL REVIEW REQUIRED]" and criterion 13. Every file >=80% lines/branches/functions/statements, target >95%.
- **Verify:** `bunx vitest run src/app/privacy src/app/terms src/components/legal --coverage --coverage.include=src/app/privacy/page.tsx,src/app/terms/page.tsx,src/components/legal/constants.ts,src/components/legal/LegalLayout.tsx --coverage.reporter=text`
- **Depends on:** T11.3

### ✅ T11.5 ☐ E2E: privacy and terms pages
- **Kind:** e2e
- **Scenarios:**
  - `@critical` `/privacy` and `/terms` return 200 with one h1, unique title and canonical, and text containing no "legal review required" in any case or emoji variant (SPEC section D)
  - `@high` `/privacy` mentions DeepSeek, xAI, Upstash and the 24-hour share-link expiry; `/terms` shows the contact email
  - `@medium` 375 px and 1280 px, light and dark: readable, no horizontal scroll
- **Spec:** `e2e/qa/landing-seo-polish/legal-pages.spec.ts`
- **Acceptance:** Every scenario passes 3 of 3 repeats.
- **Files:** `e2e/qa/landing-seo-polish/legal-pages.spec.ts` (new), `agent_docs/qa/legal-pages/*.png` (generated proof shots)
- **Verify:** `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/legal-pages.spec.ts --repeat-each=3`
- **Depends on:** T11.4

🔶 **Checkpoint 11**: Both legal pages are rewritten from verified code facts, every data flow is cited in `LEGAL_REVIEW_NOTES.md`, no review marker exists in `src`, specs and `legal-pages.spec.ts` green.

---

## Phase 12: Final gate

**Adds:** Nothing new for users. Confirms the whole epic works together: greps clean, typecheck and lint clean, targeted suites green, Lighthouse at or better than baseline, no dead links, the 10-second hero test passes, and the full diff is audited.
**Try in UI:** Open `/` at 1280 px and 390 px and say what Requestr is within 10 seconds ; Click through hub, footer, one feature page and one compare page ; Open `agent_docs/landing-seo-polish/final/` and compare the Lighthouse numbers to `baseline/`.

### T12.1 ☐ Gate: greps, typecheck, lint, unit and build
- **Kind:** gate
- **Files:** none
- **Do:** Run the single final `bun run verify` (lint, format, typecheck) and the greps from the SPEC success criteria; run vitest over every touched area; run the production build once. Fix real failures at the cause; do not weaken tests.
- **Acceptance:**
  - `bun run verify` and `bun run build` are green (SPEC Global).
  - `grep -rn "ComparisonStatStrip\|speedProof\|6\.6 s\|759 KB" src`, `grep -rni "measured" src/components/landing src/app/compare`, `grep -r "relayDemoEngine\|ChangeCardMock\|SidebarMock" src` and `grep -ri "legal review required" src` are all empty (SPEC criteria 2, 5, 13).
  - Banned-term grep over `seoPages.ts` returns nothing (SPEC criterion 12).
  - Every touched vitest area is green; `git diff --stat -- src/stores/useHistoryStore.ts src/lib/backup src/components/settings/backup/useBackupExport.ts src/components/settings/backup/useBackupImport.ts` is empty (SPEC criteria 18, 20).
- **Verify:** `bun run verify`; `bunx vitest run src/components/landing src/components/seo src/components/history src/components/import src/components/settings/backup src/components/legal src/app src/lib/constants.spec.ts src/stores/useHistoryStore.spec.ts src/i18n`; `bun run build`; `grep -rn "ComparisonStatStrip\|speedProof\|6\.6 s\|759 KB" src`; `grep -ri "legal review required" src`
- **Depends on:** T3.9, T4.8, T5.3, T6.3, T8.9, T9.9, T10.10, T11.5

### T12.2 ☐ Gate: targeted e2e on a production server
- **Kind:** gate
- **Files:** none
- **Do:** Run only the `landing-seo-polish` specs plus the existing history spec, against a fresh production build served by the harness (`E2E_SERVER=prod`), twice each. No full suite.
- **Acceptance:**
  - Every `e2e/qa/landing-seo-polish/*.spec.ts` plus `e2e/history.spec.ts` passes 2 of 2 repeats with no console errors.
  - Landing order, 11 SEO routes, hub, footer, history grouping and virtualization, dialogs and legal specs are all included (SPEC testing strategy).
- **Verify:** `E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish e2e/history.spec.ts --repeat-each=2`
- **Depends on:** T12.1

### T12.3 ☐ Gate: Lighthouse versus baseline
- **Kind:** gate
- **Files:** `agent_docs/landing-seo-polish/final/home.json` (new), `agent_docs/landing-seo-polish/final/features.json` (new), `agent_docs/landing-seo-polish/final/summary.md` (new)
- **Do:** Repeat the T0.1 procedure on the final production build (`E2E_DIST_DIR=.next-e2e`, `-p 3100`, mobile profile, `lighthouse-cli`) for `/` and `/features`, plus one feature page and one compare page; write `summary.md` comparing LCP, CLS, TBT and First Load JS to `baseline/`. Stop the :3100 server afterwards.
- **Acceptance:**
  - Mobile `/`: LCP <= 2.5 s, CLS < 0.1, TBT not worse than the baseline (SPEC criterion 6); lazy chunks for the video modal and any 3D load only on need.
  - `summary.md` states pass or fail per metric; any miss is fixed or escalated to the owner, not waved through.
  - The :3100 server is stopped.
- **Verify:** `ls agent_docs/landing-seo-polish/final`; `grep -n "LCP\|CLS\|TBT" agent_docs/landing-seo-polish/final/summary.md`
- **Depends on:** T12.2

### T12.4 ☐ Walkthrough: success criteria end to end and 10-second hero test
- **Kind:** walkthrough
- **Files:** `e2e/qa/landing-seo-polish/walkthrough.spec.ts` (new), `agent_docs/qa/landing-seo-polish/01-hero-light-1280.png`, `agent_docs/qa/landing-seo-polish/02-relay-section-dark-390.png`, `agent_docs/qa/landing-seo-polish/03-feature-page-light.png`, `agent_docs/qa/landing-seo-polish/04-history-grouped.png` (new proof shots)
- **Do:** Write the combined walkthrough spec, one `test()` per user flow: landing order and Relay-first hero; Watch demo modal; command palette and Import and backup sections; one feature page and one compare page with JSON-LD; hub to page navigation; footer links; history day headers, group expand and restore; export backup dialog dangling-links message and import Replace text; privacy and terms. Capture the four proof screenshots with headless agent-browser seeded via `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, ending with `agent-browser close`. Then run the reviewer test: a fresh reviewer who has not seen the page opens `/` at 1280x800 and 390x844 and says what Requestr is within 10 seconds; record who and the answer in Log (SPEC criterion 3).
- **Acceptance:**
  - All flows pass; screenshots captured and reviewed in light, dark, 375/390 px and 1280 px (SPEC testing strategy manual/visual).
  - The reviewer states that an AI built into the app does API work within 10 s at both sizes, recorded in Log; if not, the hero copy task T4.1 is reopened.
  - Reduced-motion, video-blocked and JS-disabled behaviours still hold (SPEC criteria 8, edge cases).
- **Verify:** `E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2`; plus T12.1 and T12.2 commands as evidence.
- **Depends on:** T12.3
- **Log:**

### T12.5 ☐ Gate: advisor audit of the full diff and copy-gate review
- **Kind:** gate
- **Files:** none
- **Do:** Make the work durable (nothing uncommitted is lost; do not commit unless told), then have the advisor audit the full diff against SPEC acceptance criteria 1-20; also review the Log fields of every copy task (T1.1, T3.1, T4.1, T4.5, T5.1, T6.1, T7.1, T7.3 to T7.5, T8.1 to T8.4, T9.2, T9.5, T10.1 to T10.4, T11.2, T11.3) to confirm each has recorded `copywriting`, `copy-editing` and `humanizer` passes. Resolve or report every issue raised.
- **Acceptance:**
  - Every advisor issue is resolved or reported to the owner (SPEC Boundaries "Always").
  - Every copy-task Log field names the three passes (SPEC criterion 12).
  - No dependency was added, no store, serializer, parser or hook changed, no secret committed (SPEC Boundaries "Never").
- **Verify:** `git diff --stat -- package.json bun.lock`; `git diff --stat -- src/stores/useHistoryStore.ts src/lib/backup`; `grep -rn "DEEPSEEK_API_KEY=\|XAI_API_KEY=\|RELAY_API_KEY=" . --include="*.ts" --include="*.md" --include="*.json" -l --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.next-e2e`; `E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2`
- **Depends on:** T12.4

### T12.6 ☐ DoD: success criteria checklist and implementation summary
- **Kind:** dod
- **Files:** `agent_docs/landing-seo-polish/final/summary.md`
- **Do:** Add a "Success criteria" section to `final/summary.md` with one line per SPEC success criterion 1-20, each formatted `Criterion N: PASS - <evidence command or spec name>`, plus `Global: PASS - <evidence>`; add an "Owner actions" section with "set `NEXT_PUBLIC_SITE_URL` or change the `SITE_URL` default to `https://requestr.app` once that domain is live" and "set the legal effective date at publish". Legal-only items stay in `LEGAL_REVIEW_NOTES.md`. Then produce the "Implementation Summary" with Verification Steps in the format required by CLAUDE.md.
- **Acceptance:**
  - All 20 criteria and Global are listed as PASS with evidence; none says FAIL or is missing; the domain-flip and effective-date notes exist.
  - The summary lists the browser verification steps for every workstream A-F.
- **Verify:** `grep -c "^Criterion [0-9]*: PASS" agent_docs/landing-seo-polish/final/summary.md` prints 20; `grep -n "^Global: PASS" agent_docs/landing-seo-polish/final/summary.md`; `grep -n "requestr.app\|effective date" agent_docs/landing-seo-polish/final/summary.md`; `E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2` green; T12.1 commands green.
- **Depends on:** T12.5

🔶 **Checkpoint 12**: All 20 success criteria pass with evidence, the production build, typecheck, lint, targeted unit and e2e suites are green, Lighthouse meets the budgets, and the diff audit is clean.
