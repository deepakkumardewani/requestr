window.DASHBOARD = {
 "generatedAt": "2026-11-11T15:58:14.106Z",
 "maxAttempts": 5,
 "feature": {
  "slug": "landing-seo-polish",
  "title": "landing-seo-polish"
 },
 "tasksFile": "agent_docs/landing-seo-polish/TASKS.md",
 "projectRoot": "/Users/deepakdewani1/Documents/Programs/react/requestly",
 "docs": [
  {
   "name": "PLAN",
   "href": "docs/PLAN.html",
   "source": "agent_docs/landing-seo-polish/PLAN.md"
  },
  {
   "name": "SPEC",
   "href": "docs/SPEC.html",
   "source": "agent_docs/landing-seo-polish/SPEC.md"
  },
  {
   "name": "TASKS",
   "href": "docs/TASKS.html",
   "source": "agent_docs/landing-seo-polish/TASKS.md"
  }
 ],
 "totals": {
  "phases": 13,
  "tasks": 85,
  "byStatus": {
   "verified": 64,
   "ready": 2,
   "waiting": 19
  }
 },
 "phases": [
  {
   "id": "0",
   "name": "Baseline and Motionsites research",
   "startLine": 21,
   "endLine": 49,
   "adds": "Nothing for users. Saves a Lighthouse and bundle baseline for `/` and `/features`, and records which Motionsites recipes (and whether any 3D) are allowed.",
   "tryInUi": [
    "No UI. Open `agent_docs/landing-seo-polish/baseline/` and confirm the Lighthouse JSON and `bundle.txt` exist",
    "Open the \"Motionsites shortlist\" section of `PLAN.md` and confirm it holds a shortlist and a 3D go/no-go."
   ],
   "checkpoint": {
    "title": "Checkpoint 0",
    "line": 46,
    "items": [
     "Baseline reports and bundle numbers are saved, the Motionsites shortlist and 3D decision are recorded, no source or dependency changed."
    ]
   },
   "tasks": [
    {
     "id": "T0.1",
     "title": "Gate: Lighthouse and bundle baseline (production build)",
     "done": true,
     "kind": "gate",
     "depends": [],
     "files": [
      "agent_docs/landing-seo-polish/baseline/home.json (new)",
      "agent_docs/landing-seo-polish/baseline/features.json (new)",
      "agent_docs/landing-seo-polish/baseline/bundle.txt (new)"
     ],
     "gherkin": null,
     "do": "Build the current tree into the e2e dist dir so the always-running dev server is untouched: `E2E_DIST_DIR=.next-e2e bun run build`, save the per-route \"First Load JS\" table to `bundle.txt`, serve it with `E2E_DIST_DIR=.next-e2e bun run start -p 3100` (a production server, not the dev server), and run Lighthouse (`lighthouse-cli` skill) against `/` and `/features` with the mobile profile. Stop the :3100 server afterwards. Record LCP, CLS, TBT, performance score and total transfer in `bundle.txt` beside the build table.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`home.json` and `features.json` exist, are mobile-profile Lighthouse reports, and were taken against a production build (not `next dev`) (SPEC criterion 6, T-0).",
      "`bundle.txt` lists LCP, CLS, TBT for both routes and the First Load JS of `/` and `/features`; these are the baseline numbers T12.3 compares against.",
      "The :3100 server is stopped and no source file changed."
     ],
     "verify": [
      "ls -l agent_docs/landing-seo-polish/baseline",
      "grep -c \"TBT\" agent_docs/landing-seo-polish/baseline/bundle.txt",
      "`git status --short -- src` prints nothing"
     ],
     "line": 26,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T11:52:10.963Z"
    },
    {
     "id": "T0.2",
     "title": "Gate: Motionsites shortlist and 3D go/no-go",
     "done": true,
     "kind": "gate",
     "depends": [],
     "files": [
      "agent_docs/landing-seo-polish/PLAN.md"
     ],
     "gherkin": null,
     "do": "Read https://github.com/Motionsites-AI/claude-skill and its 55+ recipes (`premium-website-design`, `ui-ux-pro-max`, `impeccable`). Replace the \"_Pending T-R1_\" body of the \"Motionsites shortlist\" section of `PLAN.md` with a table (recipe, landing section, fit with the design system, perf cost) and a 3D go/no-go that tests all five SPEC section A criteria one by one (supports the message; looks right in light and dark; lazy-loaded below the fold or idle on landing only; no budget regression; static fallback for reduced-motion and no-WebGL). Default is no 3D. Adding any dependency is \"Ask first\": record the question, do not install.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The shortlist section contains no \"Pending\" text and lists only recipes that fit the design system and the LCP/CLS/TBT budgets; the two confirmed recipes (word-by-word blur headline, seamless loop) are present (SPEC section A).",
      "The 3D decision names each of the five criteria with pass or fail; it is \"no 3D\" unless all five pass (SPEC section A).",
      "No dependency was added (`package.json` unchanged)."
     ],
     "verify": [
      "`grep -c \"Pending T-R1\" agent_docs/landing-seo-polish/PLAN.md` prints 0",
      "grep -n \"3D\" agent_docs/landing-seo-polish/PLAN.md",
      "`git diff --stat -- package.json` prints nothing"
     ],
     "line": 36,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T11:52:10.963Z"
    }
   ],
   "verified": 2,
   "total": 2,
   "complete": true
  },
  {
   "id": "1",
   "name": "Foundations: SITE_URL and SEO data",
   "startLine": 50,
   "endLine": 142,
   "adds": "One site URL setting now drives canonicals, sitemap, robots, social previews and structured data. `/sitemap.xml` and `/robots.txt` exist, and the layout has a real default title and description.",
   "tryInUi": [
    "Open `/sitemap.xml` and confirm it lists the 11 new routes plus the base routes",
    "Open `/robots.txt` and confirm it blocks `/api/` and points at the sitemap",
    "View source of `/` and confirm a canonical link and `og:image` use the same origin."
   ],
   "checkpoint": {
    "title": "Checkpoint 1",
    "line": 139,
    "items": [
     "`SITE_URL` drives every absolute URL, `seoPages.ts` is the single data source, sitemap and robots respond correctly, specs and `biome check` on touched files are green."
    ]
   },
   "tasks": [
    {
     "id": "T1.1",
     "title": "SITE_URL constant and wiring",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/constants.ts",
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/components/landing/features/previews/SharePreview.tsx"
     ],
     "gherkin": null,
     "do": "Add `SITE_URL` to `src/lib/constants.ts`: `process.env.NEXT_PUBLIC_SITE_URL ?? \"https://requestr-api.vercel.app\"` (strip a trailing slash). In `layout.tsx` set `metadataBase: new URL(SITE_URL)` and replace the default title and description (\"Browser-native API testing tool\") with the new positioning (an AI built into the app that does API work; no install). In `page.tsx` build the OG `url` from `SITE_URL`, keep `/og-image.png`, and add `alternates.canonical: \"/\"` (resolved against `metadataBase`). In `SharePreview.tsx` replace the hard-coded `requestr.dev` mock domain with `SITE_URL`'s host. Run the copy gate on the new default title and description.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`SITE_URL` defaults to `https://requestr-api.vercel.app` and is overridden by `NEXT_PUBLIC_SITE_URL`; one constant, no trailing slash (SPEC decision 1).",
      "`metadataBase` is set from it, and the layout title and description no longer say \"Browser-native API testing tool\" (SPEC section C site plumbing).",
      "`/` has a canonical link resolving to `SITE_URL` (SPEC section C site plumbing; asserted by T1.8).",
      "`grep -rn \"requestr\\.app\\|requestr\\.dev\" src` matches only a comment or the constants file default note, never a runtime string.",
      "Existing `src/app` and `SharePreview` specs stay green."
     ],
     "verify": [
      "bunx vitest run src/components/landing/features",
      "bunx biome check src/lib/constants.ts src/app/layout.tsx src/app/page.tsx src/components/landing/features/previews/SharePreview.tsx",
      "grep -rn \"requestr\\.app\\|requestr\\.dev\" src"
     ],
     "line": 55,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.2",
     "title": "seoPages.ts: types and data for 9 feature + 2 compare pages",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/landing/data/seoPages.ts (new)"
     ],
     "gherkin": null,
     "do": "Create the single data source: types `FeaturePage` and `ComparePage`, `FEATURE_PAGES` (`relay`, `request-chains`, `transform-playground`, `json-compare`, `json-visualize`, `import`, `collections-environments`, `command-palette`, `backup-restore`) and `COMPARE_PAGES` (`postman`, `insomnia`) with `as const satisfies`, exported `FeatureSlug` and `CompareSlug`. Each entry: slug, route, title (<=60), description (120-160), h1, screenshot path and alt, related slugs, CTA target (`/json-compare`, `/json-visualize`, `/transform`, `/import`, `/environments`, otherwise `/app`), plus a `bannedTerms`-clean first-draft body. Add small pure helpers: `getFeaturePage(slug)`, `getComparePage(slug)`, `ALL_SEO_ROUTES`. Copy is placeholder-final; Phases 7 and 8 finish copy and run the copy gate per batch.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "9 unique feature slugs and 2 compare slugs exist with the exact slugs listed in SPEC section C (SPEC section C pages).",
      "Every title is <=60 chars and every description is 120-160 chars; every `related` slug resolves; every CTA target is a real route (SPEC criterion 9).",
      "The file has no hard-coded domain (it uses relative routes only)."
     ],
     "verify": [
      "bunx biome check src/components/landing/data/seoPages.ts",
      "bunx vitest run src/components/landing/data"
     ],
     "line": 68,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.3",
     "title": "JsonLd component and builders",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/seo/jsonLdBuilders.ts (new)",
      "src/components/seo/JsonLd.tsx (new)"
     ],
     "gherkin": null,
     "do": "Pure builders in `jsonLdBuilders.ts`: `buildBreadcrumbList`, `buildFeaturePageSchema` (`SoftwareApplication` or `WebPage`), `buildComparePageSchema` (`WebPage`), `buildFaqPageSchema` (called only when a page has a visible FAQ). All URLs derive from `SITE_URL`. `JsonLd.tsx` is a server component rendering `<script type=\"application/ld+json\">` with escaped `<` (`<`) so content cannot break out of the tag.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Builders return plain objects that `JSON.stringify` into valid JSON with `@context`, `@type` and absolute URLs from `SITE_URL` (SPEC section C JSON-LD).",
      "`JsonLd` output escapes `<` and renders on the server (no `\"use client\"`).",
      "`FAQPage` is produced only through `buildFaqPageSchema`, never by default."
     ],
     "verify": [
      "bunx biome check src/components/seo/jsonLdBuilders.ts src/components/seo/JsonLd.tsx"
     ],
     "line": 78,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.4",
     "title": "sitemap.ts and robots.ts",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1",
      "T1.2"
     ],
     "files": [
      "src/app/sitemap.ts (new)",
      "src/app/robots.ts (new)"
     ],
     "gherkin": null,
     "do": "`sitemap.ts` returns `/`, `/features`, the 9 feature routes, the 2 compare routes, `/privacy`, `/terms` (absolute from `SITE_URL`, derived from `ALL_SEO_ROUTES` plus the static base routes; never `/app`, `/api`, `/json-compare` or other tool routes). `robots.ts` allows `/`, disallows `/api/`, references `${SITE_URL}/sitemap.xml`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`/sitemap.xml` lists exactly the 15 routes above and no others (SPEC criterion 10).",
      "`/robots.txt` disallows `/api/` and references the sitemap URL built from `SITE_URL`.",
      "Nothing is hard-coded to a domain."
     ],
     "verify": [
      "bunx biome check src/app/sitemap.ts src/app/robots.ts"
     ],
     "line": 89,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.5",
     "title": "Placeholder public/og-image.png",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "public/og-image.png (new)",
      "scripts/capture/og-image.mjs (new)"
     ],
     "gherkin": null,
     "do": "Add a small script that composes a 1200x630 PNG from the best existing real product visual in the repo plus the wordmark, and run it once so `public/og-image.png` exists (metadata already references `/og-image.png`). T2.6 regenerates it from the new real screenshots.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`public/og-image.png` is exactly 1200x630 and under 300 KB (SPEC decision 3).",
      "The script is re-runnable and reads no secrets."
     ],
     "verify": [
      "file public/og-image.png",
      "bunx biome check scripts/capture/og-image.mjs"
     ],
     "line": 100,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.6",
     "title": "Unit: seoPages data and JSON-LD builders",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.3",
      "T1.2"
     ],
     "files": [
      "src/components/landing/data/seoPages.ts",
      "src/components/seo/jsonLdBuilders.ts",
      "src/components/seo/JsonLd.tsx",
      "src/components/landing/data/seoPages.spec.ts (new)",
      "src/components/seo/jsonLdBuilders.spec.ts (new)",
      "src/components/seo/JsonLd.spec.tsx (new)"
     ],
     "gherkin": null,
     "do": "Write `seoPages.spec.ts` (unique slugs; title <=60; description 120-160; all `related` and CTA targets resolve; every slug is in `ALL_SEO_ROUTES`; no banned terms from the Copy gate list; no domain strings) and `jsonLdBuilders.spec.ts` (valid JSON for every builder; absolute URLs from `SITE_URL`; breadcrumb order; FAQ builder only emits visible-FAQ entries; `<` escaped in the rendered script) and `JsonLd.spec.tsx` (renders one `application/ld+json` script; `<` escaped).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"seoPages data\" and \"JSON-LD builders\". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/seoPages.spec.ts src/components/seo/jsonLdBuilders.spec.ts src/components/seo/JsonLd.spec.tsx --coverage --coverage.include=src/components/landing/data/seoPages.ts,src/components/seo/jsonLdBuilders.ts,src/components/seo/JsonLd.tsx --coverage.reporter=text"
     ],
     "line": 110,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.7",
     "title": "Unit: sitemap, robots and SITE_URL",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.4",
      "T1.6"
     ],
     "files": [
      "src/app/sitemap.ts",
      "src/app/robots.ts",
      "src/lib/constants.ts",
      "src/app/sitemap.spec.ts (new)",
      "src/app/robots.spec.ts (new)",
      "src/lib/constants.spec.ts (new)"
     ],
     "gherkin": null,
     "do": "Write `sitemap.spec.ts` (exact route list, nothing else, absolute URLs, `NEXT_PUBLIC_SITE_URL` override reflected after module reset), `robots.spec.ts` (disallow `/api/`, sitemap reference), and a `constants` spec for `SITE_URL` default, override and trailing-slash strip.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"sitemap.ts/robots.ts\" and criterion 10. Every file >=80% on all four metrics, target >95%."
     ],
     "verify": [
      "bunx vitest run src/app/sitemap.spec.ts src/app/robots.spec.ts src/lib/constants.spec.ts --coverage --coverage.include=src/app/sitemap.ts,src/app/robots.ts,src/lib/constants.ts --coverage.reporter=text"
     ],
     "line": 118,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    },
    {
     "id": "T1.8",
     "title": "E2E: sitemap, robots and landing canonical",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T1.7",
      "T1.5"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/site-plumbing.spec.ts (new)",
      "agent_docs/qa/site-plumbing/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/site-plumbing.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; the expected route list is imported or restated from the SPEC, not read from the sitemap under test."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=3"
     ],
     "line": 126,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T13:20:57.830Z"
    }
   ],
   "verified": 8,
   "total": 8,
   "complete": true
  },
  {
   "id": "2",
   "name": "Capture pipeline: screenshots and real Relay footage",
   "startLine": 143,
   "endLine": 220,
   "adds": "Real product screenshots (light and dark) and one real Relay session recording cut into a loop, a full captioned cut and a poster, plus a site-wide Open Graph image built from a real screenshot. No code behaviour changes.",
   "tryInUi": [
    "Open `public/screens/` and confirm light and dark screenshots of each feature exist",
    "Play `public/media/relay/relay-loop.mp4` and confirm it loops with no visible jump and shows no keys or emails",
    "Open `public/og-image.png` and confirm it shows a real product screenshot plus the wordmark."
   ],
   "checkpoint": {
    "title": "Checkpoint 2",
    "line": 217,
    "items": [
     "Real screenshots and the Relay loop, full cut and poster exist within budget, are secret-free and seamless, and the OG image is built from a real screenshot. Dialog screenshots wait for T10.10."
    ]
   },
   "tasks": [
    {
     "id": "T2.1",
     "title": "Gate: deterministic screenshot capture script",
     "done": true,
     "kind": "gate",
     "depends": [
      "T1.8"
     ],
     "files": [
      "scripts/capture/screens.ts (new)",
      "scripts/capture/seed.ts (new)",
      "public/screens/* (generated: 8 screens each -light and -dark)"
     ],
     "gherkin": null,
     "do": "Playwright script that drives https://requestly.localhost/app headlessly with DummyJSON seed data (`e2e/dummyjson-api-reference.md`, seed via `e2e/fixtures/qa-seed.init.js` patterns) and writes `.webp` light and dark screenshots at a fixed viewport and device scale. Accept `--only <name>` so Phases 9 and 10 can re-run a subset. Backup and import dialog shots are NOT captured here (T10.10); the history sidebar is captured by `--only history` after Phase 9 if any page uses it (none does today). Keep each file small (webp, <=250 KB).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The script is re-runnable and produces the same filenames each time; every named screen exists in `-light` and `-dark` (SPEC decision 3).",
      "Every screenshot is real app UI with seed data only: no real keys, emails or tokens (manual frame check noted in Log).",
      "The script never starts a server and reads the base URL from `PLAYWRIGHT_TEST_BASE_URL`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts",
      "ls -l public/screens",
      "bunx biome check scripts/capture",
      "`bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts` still green"
     ],
     "line": 148,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    },
    {
     "id": "T2.2",
     "title": "Gate: record the real Relay DummyJSON session",
     "done": true,
     "kind": "gate",
     "depends": [],
     "files": [
      "scripts/capture/relay-record.ts (new)",
      "scripts/capture/README.md (new)"
     ],
     "gherkin": null,
     "do": "Playwright-driven recording (video on, deterministic pacing) of the REAL app with `NEXT_PUBLIC_RELAY_ENABLED` and the real Relay key set in the shell only (never written to a file). Relay builds and runs the DummyJSON chain: login, capture token, get user, get cart, add product, assert totals. No scripted or synthetic UI. Raw video goes to the session scratchpad, not the repo. README documents the env, the prompt used and how to re-record.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The raw recording shows all six steps, from Relay actions in the real app (SPEC section B).",
      "Only DummyJSON credentials appear; no real keys, emails or tokens in any frame (SPEC section B privacy; frame review recorded in Log).",
      "No secret is written to the repo or README."
     ],
     "verify": [
      "`ffprobe -v error -show_entries format=duration -of csv=p=0 <raw recording>` prints a duration",
      "`git status --short | grep -i \"\\.env\"` prints nothing",
      "`grep -rn \"sk-\\|DEEPSEEK_API_KEY=\" scripts/capture` prints nothing"
     ],
     "line": 160,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    },
    {
     "id": "T2.3",
     "title": "Gate: cut the loop, full cut and poster",
     "done": true,
     "kind": "gate",
     "depends": [
      "T2.2"
     ],
     "files": [
      "scripts/capture/relay-cut.sh (new)",
      "public/media/relay/* (generated: relay loop and full and poster outputs)"
     ],
     "gherkin": null,
     "do": "Reproducible `ffmpeg` (optional Remotion for captions and speed ramps; `remotion-captions` skill) pipeline from the raw session: a 15-20 s muted seamless loop, a 60-90 s full cut with captions and a visible \"sped up\" marker on every accelerated span, mp4 (H.264) and webm of each, one poster in webp and avif. Idle and wait time may be trimmed or sped up; Relay's actions are never reordered, added or altered.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Loop is 15-20 s, has no audio track, and first-vs-last-frame SSIM >= 0.98 (SPEC criterion 7).",
      "Full cut is 60-90 s, captioned, shows all six chain steps, every sped-up span carries the marker (SPEC criterion 7, section B editing rule).",
      "Sizes: loop <=1.5 MB, full <=8 MB, poster <=80 KB, for every format (SPEC section B budgets).",
      "Both cuts come from the same recorded session."
     ],
     "verify": [
      "`ffprobe -v error -show_entries format=duration -of csv=p=0 public/media/relay/relay-loop.mp4` prints 15-20",
      "`ffprobe -v error -show_entries format=duration -of csv=p=0 public/media/relay/relay-full.mp4` prints 60-90",
      "`ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 public/media/relay/relay-loop.mp4` prints nothing",
      "stat -f %z public/media/relay/*",
      "bash scripts/capture/relay-cut.sh --check-ssim"
     ],
     "line": 171,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    },
    {
     "id": "T2.4",
     "title": "Gate: asset QA (secrets, jump, budgets)",
     "done": true,
     "kind": "gate",
     "depends": [
      "T2.3"
     ],
     "files": [
      "scripts/capture/verify-assets.mjs (new)"
     ],
     "gherkin": null,
     "do": "Add a re-runnable checker that asserts every size budget, loop duration, SSIM >= 0.98 and absence of an audio stream, then extract frames every 2 s from both cuts and review them for keys, emails and tokens. Have a reviewer who has not watched the loop confirm they see no jump; record the frame-review and jump-review outcomes in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`verify-assets.mjs` exits 0 and prints each budget with pass (SPEC criterion 7).",
      "Manual frame review finds no real keys, emails or tokens; the reviewer sees no jump at the loop point (SPEC criterion 7, section B privacy)."
     ],
     "verify": [
      "node scripts/capture/verify-assets.mjs",
      "bunx biome check scripts/capture/verify-assets.mjs"
     ],
     "line": 184,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    },
    {
     "id": "T2.5",
     "title": "Gate: screenshot light/dark and budget check",
     "done": true,
     "kind": "gate",
     "depends": [
      "T2.4",
      "T2.1"
     ],
     "files": [
      "scripts/capture/verify-assets.mjs"
     ],
     "gherkin": null,
     "do": "Extend the checker with a manifest of expected screen names (the T2.1 list now; T10.10 adds the dialog names) and confirm each theme-dependent screenshot has both `-light` and `-dark` files, that each is <=250 KB and that no file in `public/screens` is missing from the manifest (no orphans). Consumers do not exist yet at this point, so the check is manifest-based, not reference-based.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every theme-dependent screen has a light and dark pair (SPEC edge cases: dark and light themes for every new screenshot).",
      "No screenshot exceeds its size budget; `verify-assets.mjs` exits 0."
     ],
     "verify": [
      "node scripts/capture/verify-assets.mjs"
     ],
     "line": 195,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    },
    {
     "id": "T2.6",
     "title": "Gate: regenerate og-image from a real screenshot",
     "done": true,
     "kind": "gate",
     "depends": [
      "T2.5",
      "T1.5",
      "T1.8"
     ],
     "files": [
      "scripts/capture/og-image.mjs",
      "public/og-image.png"
     ],
     "gherkin": null,
     "do": "Point `og-image.mjs` at the real hero or Relay-panel screenshot from T2.1 plus the wordmark and regenerate `public/og-image.png` (1200x630).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`public/og-image.png` is 1200x630, is built from a real product screenshot, and is <=300 KB (SPEC decision 3).",
      "Site-plumbing e2e from T1.8 still green."
     ],
     "verify": [
      "file public/og-image.png",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=2"
     ],
     "line": 206,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:04:06.206Z"
    }
   ],
   "verified": 6,
   "total": 6,
   "complete": true
  },
  {
   "id": "3",
   "name": "Landing restructure and comparison rewrite",
   "startLine": 221,
   "endLine": 319,
   "adds": "The landing page sections appear in the new order (Hero, Relay, How it works, Features, Command palette, Beyond send, Import and backup, Comparison, Final CTA). The speed stat strip is gone, the comparison table shows honest \"about\" ranges for time to first request, and the old scripted Relay mock is removed.",
   "tryInUi": [
    "Scroll `/` and confirm the section order above with no stat strip",
    "Read the \"Time to first request\" row and confirm it shows ranges (about 10-15 s, 2-3 min, 2-4 min) with no \"measured\" or stopwatch",
    "Check the Relay section area shows a simple placeholder with no scripted demo."
   ],
   "checkpoint": {
    "title": "Checkpoint 3",
    "line": 316,
    "items": [
     "New order live, stat strip, `speedProof` and all Relay mock code gone (greps empty), comparison row rewritten, targeted vitest and `landing-order.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T3.1",
     "title": "Comparison row rewrite",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/landing/data/comparison.ts",
      "src/components/landing/data/comparison.spec.ts"
     ],
     "gherkin": null,
     "do": "Rewrite the \"Time to first request\" row to the SPEC table: Requestr ~10-15 s (open the URL, paste endpoint, Send; no install, no sign-up), Insomnia ~2-3 min (download, install, open Scratch Pad), Postman ~2-4 min (download or web app, sign-in prompt, workspace, new request). Remove the `speedProof` import and any `codeRef`, \"measured\" or stopwatch language; mark the values as typical estimates (\"about\", \"~\"). Update the existing `comparison.spec.ts` assertions it breaks. Copy gate on the basis strings.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The row shows the three ranges and one-line bases exactly as in the SPEC table, with estimate wording (SPEC criterion 4).",
      "`comparison.ts` no longer imports `speedProof` and contains no \"measured\" (SPEC criterion 2).",
      "Existing `ComparisonTable` specs stay green."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data src/components/landing/ComparisonTable.spec.tsx src/components/landing/ComparisonTable.emphasis.spec.tsx",
      "bunx biome check src/components/landing/data/comparison.ts src/components/landing/data/comparison.spec.ts",
      "`grep -n \"measured\\|speedProof\" src/components/landing/data/comparison.ts` prints nothing"
     ],
     "line": 226,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.2",
     "title": "Remove ComparisonStatStrip and speedProof",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/components/landing/LandingPage.tsx"
     ],
     "gherkin": null,
     "do": "Drop the strip from `LandingPage.tsx` and delete the strip, `speedProof.ts` and both specs (verify no other reference first with `grep -rn speedProof src`).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -rn \"ComparisonStatStrip\\|speedProof\\|6\\.6 s\\|759 KB\" src` is empty (SPEC criterion 2).",
      "Nothing else imports the deleted modules; remaining landing specs stay green."
     ],
     "verify": [
      "`grep -rn \"ComparisonStatStrip\\|speedProof\\|6\\.6 s\\|759 KB\" src` prints nothing",
      "bunx vitest run src/components/landing",
      "bunx biome check src/components/landing/LandingPage.tsx"
     ],
     "line": 237,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.3",
     "title": "RelaySection poster-only shell",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.2",
      "T2.4"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx"
     ],
     "gherkin": null,
     "do": "Replace the section with a minimal shell (keep `id=\"relay\"`, heading plus the real poster `public/media/relay/relay-poster.webp` from T2.3 via `next/image`, no scripted demo, no import of `RelayDemoPanel`) so the mock files can be deleted and the build stays green. The real section is built in Phase 4.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`RelaySection.tsx` imports none of `RelayDemoPanel`, `ChangeCardMock`, `SidebarMock`, `relayDemoEngine`, `scenarios`, `useRelayDemo` (SPEC criterion 5).",
      "It renders without client JS beyond what `next/image` needs, and the poster it references exists (no 404 for T3.9's console guard)."
     ],
     "verify": [
      "bunx biome check src/components/landing/relay/RelaySection.tsx",
      "`grep -n \"RelayDemoPanel\\|useRelayDemo\\|scenarios\" src/components/landing/relay/RelaySection.tsx` prints nothing",
      "ls public/media/relay/relay-poster.webp"
     ],
     "line": 247,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.4",
     "title": "Delete Relay mock panel and mock components",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.3"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx"
     ],
     "gherkin": null,
     "do": "Delete the three files after confirming nothing but the removed panel references them.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The three files no longer exist and `grep -rn \"ChangeCardMock\\|SidebarMock\\|RelayDemoPanel\" src` is empty (SPEC criterion 5)."
     ],
     "verify": [
      "`grep -rn \"ChangeCardMock\\|SidebarMock\\|RelayDemoPanel\" src` prints nothing",
      "bunx vitest run src/components/landing/relay"
     ],
     "line": 257,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.5",
     "title": "Delete relay demo engine and hook (+ specs)",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.4"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx"
     ],
     "gherkin": null,
     "do": "Delete the engine, the hook and their specs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -rn \"relayDemoEngine\\|useRelayDemo\" src` is empty (SPEC criterion 5)."
     ],
     "verify": [
      "`grep -rn \"relayDemoEngine\\|useRelayDemo\" src` prints nothing"
     ],
     "line": 266,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.6",
     "title": "Delete relay scenarios (+ spec)",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.5"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx"
     ],
     "gherkin": null,
     "do": "Delete the scenarios module and spec once nothing imports it; confirm the folder now holds only `RelaySection.tsx`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -rn \"relayDemoEngine\\|ChangeCardMock\\|SidebarMock\" src` is empty and `ls src/components/landing/relay` shows only `RelaySection.tsx` (SPEC criterion 5)."
     ],
     "verify": [
      "`grep -rn \"relayDemoEngine\\|ChangeCardMock\\|SidebarMock\\|landing/relay/scenarios\" src` prints nothing",
      "bunx vitest run src/components/landing"
     ],
     "line": 275,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.7",
     "title": "New section order and command palette stub",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.6"
     ],
     "files": [
      "src/components/landing/LandingPage.tsx",
      "src/components/landing/CommandPaletteSection.tsx"
     ],
     "gherkin": null,
     "do": "Reorder `LandingPage.tsx` to Hero, Relay (dynamic), HowItWorks, FeatureShowcase, Command palette, BeyondSend, ImportSection (Import and backup), ComparisonTable, FinalCta. Add a temporary minimal `CommandPaletteSection` stub (heading only; real section in T5.1). Leave `Nav.tsx` unchanged: its anchors (`hero`, `how-it-works`, `features`, `compare`) already follow the new order (SPEC decision 8, footer-only). Footer anchors change in Phase 8.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "DOM order under `<main>` is Hero, Relay, HowItWorks, FeatureShowcase, Command palette, BeyondSend, Import and backup, ComparisonTable, FinalCta (SPEC criterion 1).",
      "`Nav.tsx` is unchanged and every Nav anchor still points at an existing section id.",
      "Existing landing specs (including `Nav.spec.tsx`) stay green."
     ],
     "verify": [
      "bunx vitest run src/components/landing",
      "bunx biome check src/components/landing/LandingPage.tsx src/components/landing/CommandPaletteSection.tsx",
      "`git diff --stat -- src/components/landing/Nav.tsx` prints nothing"
     ],
     "line": 284,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.8",
     "title": "Unit: landing order and comparison data",
     "done": true,
     "kind": "unit",
     "depends": [
      "T3.7"
     ],
     "files": [
      "src/components/landing/LandingPage.tsx",
      "src/components/landing/LandingPage.spec.tsx",
      "src/components/landing/data/comparison.ts",
      "src/components/landing/data/comparison.spec.ts"
     ],
     "gherkin": null,
     "do": "Write the new `LandingPage.spec.tsx` (it does not exist yet; section order exactly as in SPEC criterion 1 with heavy children mocked; no `ComparisonStatStrip`; Relay section is the second section) and extend `comparison.spec.ts` (row values and bases match the SPEC table; no \"measured\"; estimate markers present; every other row keeps its `source`).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"comparison.ts row\" and \"landing section order in LandingPage.spec\". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing/LandingPage.spec.tsx src/components/landing/data/comparison.spec.ts --coverage --coverage.include=src/components/landing/LandingPage.tsx,src/components/landing/data/comparison.ts --coverage.reporter=text"
     ],
     "line": 295,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    },
    {
     "id": "T3.9",
     "title": "E2E: landing order and no stat strip",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T3.8"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/landing-order.spec.ts",
      "agent_docs/qa/landing-order/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/landing-order.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; no console errors (the `consoleGuard` fixture applies)."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/landing-order.spec.ts --repeat-each=3"
     ],
     "line": 303,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T14:41:53.363Z"
    }
   ],
   "verified": 9,
   "total": 9,
   "complete": true
  },
  {
   "id": "4",
   "name": "Hero and Relay section",
   "startLine": 320,
   "endLine": 418,
   "adds": "The hero now leads with an AI built into the app that does your API work. Right below, the Relay section shows a real screen recording loop, a word-by-word blur headline, and a Watch demo button that opens the full captioned cut.",
   "tryInUi": [
    "Open `/` and read the hero",
    "Watch the Relay loop play muted",
    "Click Watch demo and confirm the full cut loads only now and needs an explicit Play",
    "Turn on reduced motion and confirm the headline appears at once and the loop shows its poster."
   ],
   "checkpoint": {
    "title": "Checkpoint 4",
    "line": 415,
    "items": [
     "Landing is demonstrable end to end: Relay-first hero, real loop, lazy full cut, blur headline with reduced-motion fallback, targeted vitest and `relay-section.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T4.1",
     "title": "Hero headline and sub-line",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.7"
     ],
     "files": [
      "src/components/landing/Hero.tsx",
      "src/components/landing/constants.ts",
      "src/components/landing/Hero.spec.tsx"
     ],
     "gherkin": null,
     "do": "Headline leads with \"AI that does your API work\" (final wording from the copy pass; may shift toward Relay). Sub-line states Relay is built into the app and can do what you can do by hand; no-install and no-sign-up is secondary. Use shared `SECTION_*` constants. Copy gate; record in Log. Update `Hero.spec.tsx`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Above the fold at 1280x800 and 390x844 the hero states that an AI built into the app does API work (SPEC criterion 3; the reviewer test is recorded in T12.4).",
      "No banned terms; the message priority is Relay first, speed second (SPEC objective)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/Hero.spec.tsx",
      "bunx biome check src/components/landing/Hero.tsx src/components/landing/constants.ts src/components/landing/Hero.spec.tsx"
     ],
     "line": 325,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.2",
     "title": "BlurHeadline component",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T0.2"
     ],
     "files": [
      "src/components/landing/relay/BlurHeadline.tsx (new)"
     ],
     "gherkin": null,
     "do": "Word-by-word blur reveal headline using `motion` (confirmed Motionsites recipe; follow T0.2 shortlist). Under `prefers-reduced-motion: reduce` render the final text immediately with no blur; the full text is always in the DOM for crawlers and screen readers (visually split words use `aria-hidden` spans with an `sr-only` full sentence, or equivalent). Client component with the smallest possible boundary.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Words reveal one by one with blur-to-sharp; reduced-motion shows the complete text with no animation (SPEC criterion 8).",
      "Accessible name is the full sentence; no layout shift when the reveal finishes (CLS < 0.1, SPEC criterion 6)."
     ],
     "verify": [
      "bunx biome check src/components/landing/relay/BlurHeadline.tsx"
     ],
     "line": 336,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.3",
     "title": "DemoVideo poster, error and reduced-motion behaviour",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.4"
     ],
     "files": [
      "src/components/landing/DemoVideo.tsx",
      "src/components/landing/DemoVideo.spec.tsx"
     ],
     "gherkin": null,
     "do": "Rework `DemoVideo` for the Relay loop (follow the existing `IntroClip` pattern): poster shown until the video can play; on `error` the poster stays with no broken-video chrome; `prefers-reduced-motion` shows the poster and does not autoplay; `muted`, `loop`, `playsInline`; fixed aspect ratio so nothing shifts; mp4 and webm sources. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Poster renders first and stays on error or when autoplay is blocked; layout does not shift (SPEC criterion 8).",
      "Reduced motion: the loop does not autoplay (SPEC criterion 8).",
      "Existing `IntroClip` and `DemoVideo` specs stay green."
     ],
     "verify": [
      "bunx vitest run src/components/landing/DemoVideo.spec.tsx src/components/landing/IntroClip.spec.tsx",
      "bunx biome check src/components/landing/DemoVideo.tsx src/components/landing/DemoVideo.spec.tsx"
     ],
     "line": 347,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.4",
     "title": "DemoModal: lazy full cut and explicit Play",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.4"
     ],
     "files": [
      "src/components/landing/DemoModal.tsx",
      "src/components/landing/WatchDemoButton.tsx",
      "src/components/landing/DemoModal.spec.tsx",
      "src/components/landing/WatchDemoButton.spec.tsx"
     ],
     "gherkin": null,
     "do": "`DemoModal` loads the 60-90 s full cut only when opened (`preload=\"metadata\"` or `none`, source set on open), shows the poster with an explicit Play button, supports captions, shows the \"sped up\" marker already burned into the cut, and traps focus (shadcn dialog). `WatchDemoButton` opens it. Update the existing specs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The full cut is not requested before open; Play is explicit; autoplay-blocked and error states keep the poster plus a visible Play affordance (SPEC section B fallbacks, edge cases).",
      "Reduced motion: the modal video never starts without a click (SPEC criterion 8).",
      "Existing specs stay green."
     ],
     "verify": [
      "bunx vitest run src/components/landing/DemoModal.spec.tsx src/components/landing/WatchDemoButton.spec.tsx",
      "bunx biome check src/components/landing/DemoModal.tsx src/components/landing/WatchDemoButton.tsx"
     ],
     "line": 359,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.5",
     "title": "RelaySection rewrite",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T4.1",
      "T4.2",
      "T4.3",
      "T4.4"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx",
      "src/components/landing/constants.ts",
      "src/components/landing/LandingPage.tsx"
     ],
     "gherkin": null,
     "do": "Build the real section directly after Hero: new copy and UI, the `BlurHeadline`, the real loop through `DemoVideo`, a play affordance that opens `DemoModal`, and an optional Motionsites recipe only if T0.2 approved it. Copy makes two points at first glance: Relay is AI built fully into the app, and it can do anything the user can do by hand. Keep it `dynamic`-imported from `LandingPage.tsx` with the modal chunk lazy. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No scripted mock component remains; `grep -r \"relayDemoEngine\\|ChangeCardMock\\|SidebarMock\" src` stays empty (SPEC criterion 5).",
      "Banned terms absent (\"cards\", \"undone\", internal names) (SPEC section A).",
      "Play affordances and `WatchDemoButton` open the same modal (SPEC section A).",
      "Video modal and any 3D code are separate lazy chunks (SPEC criterion 6)."
     ],
     "verify": [
      "bunx vitest run src/components/landing",
      "bunx biome check src/components/landing/relay/RelaySection.tsx src/components/landing/constants.ts src/components/landing/LandingPage.tsx",
      "`grep -rni \"cards\\|undone\" src/components/landing/relay` prints nothing"
     ],
     "line": 371,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.6",
     "title": "Unit: blur headline and demo video",
     "done": true,
     "kind": "unit",
     "depends": [
      "T4.5"
     ],
     "files": [
      "src/components/landing/relay/BlurHeadline.spec.tsx (new)",
      "src/components/landing/DemoVideo.spec.tsx",
      "src/components/landing/DemoModal.spec.tsx"
     ],
     "gherkin": null,
     "do": "Write `BlurHeadline.spec.tsx` (words render in order; reduced-motion renders final text with no animation props; full sentence accessible), extend `DemoVideo.spec.tsx` (poster until `canplay`, error keeps poster, reduced-motion no autoplay, sources) and `DemoModal.spec.tsx` (no network before open, source set on open, explicit Play, focus trap, escape closes).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list for blur fallback, poster on error, reduced motion, modal lazy. Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing/relay/BlurHeadline.spec.tsx src/components/landing/DemoVideo.spec.tsx src/components/landing/DemoModal.spec.tsx --coverage --coverage.include=src/components/landing/relay/BlurHeadline.tsx,src/components/landing/DemoVideo.tsx,src/components/landing/DemoModal.tsx --coverage.reporter=text"
     ],
     "line": 384,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.7",
     "title": "Unit: Relay section, watch-demo button and hero",
     "done": true,
     "kind": "unit",
     "depends": [
      "T4.6"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.spec.tsx (new)",
      "src/components/landing/Hero.spec.tsx",
      "src/components/landing/WatchDemoButton.spec.tsx"
     ],
     "gherkin": null,
     "do": "Write `RelaySection.spec.tsx` (headline, loop element attributes, play affordance opens the modal, no banned copy), extend `WatchDemoButton.spec.tsx` and `Hero.spec.tsx` (headline text, sub-line, Watch demo wiring).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC criteria 3, 5 and 8 at component level. Every file >=80% on all four metrics, target >95%."
     ],
     "verify": [
      "bunx vitest run src/components/landing/relay/RelaySection.spec.tsx src/components/landing/WatchDemoButton.spec.tsx src/components/landing/Hero.spec.tsx --coverage --coverage.include=src/components/landing/relay/RelaySection.tsx,src/components/landing/WatchDemoButton.tsx,src/components/landing/Hero.tsx --coverage.reporter=text"
     ],
     "line": 392,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    },
    {
     "id": "T4.8",
     "title": "E2E: Relay section media and demo modal",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T4.7"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/relay-section.spec.ts (new)",
      "agent_docs/qa/relay-section/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/relay-section.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; the blocked-video scenario uses `page.route` abort; no `waitForTimeout`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/relay-section.spec.ts --repeat-each=3"
     ],
     "line": 400,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T15:50:22.069Z"
    }
   ],
   "verified": 8,
   "total": 8,
   "complete": true
  },
  {
   "id": "5",
   "name": "Command palette section",
   "startLine": 419,
   "endLine": 458,
   "adds": "A new landing section showing the real command palette and explaining that any request, collection, environment or action is reachable from the keyboard.",
   "tryInUi": [
    "Open `/` and scroll to the section between Features and Beyond send",
    "Confirm a real palette screenshot shows (switch light and dark)",
    "Resize to 390 px and confirm nothing overflows."
   ],
   "checkpoint": {
    "title": "Checkpoint 5",
    "line": 455,
    "items": [
     "Command palette section is real, themed, responsive, in order; section spec and `command-palette-section.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T5.1",
     "title": "CommandPaletteSection",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.5",
      "T4.5"
     ],
     "files": [
      "src/components/landing/CommandPaletteSection.tsx",
      "src/components/landing/constants.ts"
     ],
     "gherkin": null,
     "do": "Replace the T3.7 stub with the real section: the real screenshot from `public/screens/command-palette-{light,dark}.webp` through `ProductVisual`/`next/image` (explicit width and height, descriptive alt), proper copy about reaching any request, collection, environment or action by keyboard, shared `SECTION_*` constants, theme-matched asset. Server component. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Section renders in the order from SPEC criterion 1 with real screenshot, alt text and the shared constants (SPEC section A).",
      "No banned terms; no layout shift (CLS < 0.1)."
     ],
     "verify": [
      "bunx vitest run src/components/landing",
      "bunx biome check src/components/landing/CommandPaletteSection.tsx src/components/landing/constants.ts"
     ],
     "line": 424,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T16:01:37.418Z"
    },
    {
     "id": "T5.2",
     "title": "Unit: CommandPaletteSection",
     "done": true,
     "kind": "unit",
     "depends": [
      "T5.1"
     ],
     "files": [
      "src/components/landing/CommandPaletteSection.spec.tsx (new)"
     ],
     "gherkin": null,
     "do": "Write `CommandPaletteSection.spec.tsx`: heading and copy render, the image has non-empty alt and the light and dark sources, the section has a stable `id` and an `aria-labelledby` heading, uses the shared constants.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`."
     ],
     "verify": [
      "bunx vitest run src/components/landing/CommandPaletteSection.spec.tsx --coverage --coverage.include=src/components/landing/CommandPaletteSection.tsx --coverage.reporter=text"
     ],
     "line": 435,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-09T16:01:37.418Z"
    },
    {
     "id": "T5.3",
     "title": "E2E: command palette section",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T5.2"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/command-palette-section.spec.ts (new)",
      "agent_docs/qa/command-palette-section/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/command-palette-section.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; layout shift under 0.1 on load."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/command-palette-section.spec.ts --repeat-each=3"
     ],
     "line": 443,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-09T16:01:37.418Z"
    }
   ],
   "verified": 3,
   "total": 3,
   "complete": true
  },
  {
   "id": "6",
   "name": "Import and backup section",
   "startLine": 459,
   "endLine": 499,
   "adds": "The Import section becomes \"Import and backup\": one clearly separated group for importing from Postman, Insomnia, OpenAPI, Swagger and cURL, and one for exporting and restoring a backup, each with real screenshots.",
   "tryInUi": [
    "Open `/` and scroll to the Import and backup section",
    "Confirm two clearly separated groups with real dialog screenshots",
    "Check dark mode and 390 px."
   ],
   "checkpoint": {
    "title": "Checkpoint 6",
    "line": 496,
    "items": [
     "Import and backup section shows two delineated groups with real, theme-matched screenshots; section spec and `import-backup-section.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T6.1",
     "title": "ImportSection two groups",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T10.10",
      "T5.1"
     ],
     "files": [
      "src/components/landing/ImportSection.tsx",
      "src/components/landing/ImportSection.spec.tsx",
      "src/components/landing/constants.ts"
     ],
     "gherkin": null,
     "do": "Expand `ImportSection` into two delineated groups using the existing design system: Import (Postman, Insomnia, OpenAPI, Swagger, cURL; import dialog screenshot) and Backup (export backup, restore backup; backup dialog screenshots from T10.10). Section heading becomes \"Import and backup\"; copy matches the polished dialog wording. Copy gate; record in Log. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Two clearly delineated groups with real screenshots, alt text, theme-matched assets (SPEC section A).",
      "Copy uses the same verbs as the dialogs (Scan, Export, Restore) and no banned terms.",
      "Existing `ImportSection` spec updated and green."
     ],
     "verify": [
      "bunx vitest run src/components/landing/ImportSection.spec.tsx",
      "bunx biome check src/components/landing/ImportSection.tsx src/components/landing/ImportSection.spec.tsx src/components/landing/constants.ts"
     ],
     "line": 464,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T13:21:59.702Z"
    },
    {
     "id": "T6.2",
     "title": "Unit: ImportSection",
     "done": true,
     "kind": "unit",
     "depends": [
      "T6.1"
     ],
     "files": [
      "src/components/landing/ImportSection.tsx"
     ],
     "gherkin": null,
     "do": "Extend `ImportSection.spec.tsx`: both group headings, every import format listed, backup group copy, images have alt text and light and dark sources, the section keeps `id=\"import\"`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`."
     ],
     "verify": [
      "bunx vitest run src/components/landing/ImportSection.spec.tsx --coverage --coverage.include=src/components/landing/ImportSection.tsx --coverage.reporter=text"
     ],
     "line": 476,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T13:21:59.702Z"
    },
    {
     "id": "T6.3",
     "title": "E2E: Import and backup section",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T6.2"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/import-backup-section.spec.ts (new)",
      "agent_docs/qa/import-backup-section/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/import-backup-section.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/import-backup-section.spec.ts --repeat-each=3"
     ],
     "line": 484,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T13:21:59.702Z"
    }
   ],
   "verified": 3,
   "total": 3,
   "complete": true
  },
  {
   "id": "7",
   "name": "SEO page template and nine feature pages",
   "startLine": 500,
   "endLine": 588,
   "adds": "Nine search-friendly feature pages at `/features/<name>` (Relay, request chains, transform playground, JSON compare, JSON visualize, import, collections and environments, command palette, backup and restore), each with its own title, social preview, structured data, screenshot and links to related pages.",
   "tryInUi": [
    "Open `/features/relay` and each of the other eight slugs",
    "Confirm one heading, a real screenshot, related links, a back link to the hub and a button to the matching tool",
    "Open `/features/nope` and confirm a 404",
    "View source and confirm a canonical link and JSON-LD."
   ],
   "checkpoint": {
    "title": "Checkpoint 7",
    "line": 585,
    "items": [
     "Nine feature pages are statically generated with unique metadata, valid JSON-LD, real media, one H1, internal links and a recorded copy gate; vitest and `feature-pages.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T7.1",
     "title": "FeaturePageLayout",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.3",
      "T1.2",
      "T2.5"
     ],
     "files": [
      "src/components/seo/FeaturePageLayout.tsx (new)",
      "src/components/seo/FeatureMedia.tsx (new)"
     ],
     "gherkin": null,
     "do": "Server-component template driven only by a `FeaturePage` entry: exactly one `<h1>`, answer-first intro, real screenshot or loop with descriptive alt (`FeatureMedia`, theme-matched light and dark sources), related-feature links, back link to `/features`, CTA to the matching tool route (or `/app`), `JsonLd` with `buildFeaturePageSchema` and `buildBreadcrumbList`. Use `SECTION_*` constants and shadcn/reactbits; consistent with the landing. Run `seo-audit`, `ai-seo`, `site-architecture` guidance for structure.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Renders any `FeaturePage` with one H1, alt-texted media, related links, hub link, CTA and JSON-LD (SPEC section C).",
      "No client JS unless something is interactive; no hard-coded slugs or page copy in the template; the template's own fixed labels (section headings, back link, CTA label) pass the copy gate, recorded in Log."
     ],
     "verify": [
      "bunx biome check src/components/seo/FeaturePageLayout.tsx src/components/seo/FeatureMedia.tsx",
      "`grep -niE \"cards|undone|seamlessly|leverage|unlock|supercharge\" src/components/seo/FeaturePageLayout.tsx src/components/seo/FeatureMedia.tsx` prints nothing"
     ],
     "line": 505,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.2",
     "title": "/features/[slug] route",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.1"
     ],
     "files": [
      "src/app/features/[slug]/page.tsx (new)"
     ],
     "gherkin": null,
     "do": "`generateStaticParams` from `FEATURE_PAGES`, `generateMetadata` (title, description, `alternates.canonical` from `SITE_URL`, OpenGraph and Twitter), `notFound()` for unknown slugs, render `FeaturePageLayout`. `dynamicParams = false`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Each slug is statically generated with unique title, description, canonical, OG and Twitter metadata; unknown slug returns 404 (SPEC section C, edge cases).",
      "Nothing is hard-coded: every value comes from `seoPages.ts` and `SITE_URL`."
     ],
     "verify": [
      "bunx biome check \"src/app/features/[slug]/page.tsx\""
     ],
     "line": 516,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.3",
     "title": "Feature batch A final copy and media: relay, request-chains, transform-playground",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.2",
      "T2.5",
      "T1.6"
     ],
     "files": [
      "src/components/landing/data/seoPages.ts"
     ],
     "gherkin": null,
     "do": "Final title, description, h1, body, screenshot paths and alts, related and CTA for the three pages. Run `copywriting`, `copy-editing`, `humanizer`; run `seo-audit` and `ai-seo` guidance for keywords and answer-first structure; run the banned-term grep. Record each pass in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Titles <=60, descriptions 120-160, unique across all pages; copy has no banned terms, internal jargon or AI-writing tells (SPEC criterion 12).",
      "Every screenshot path exists in `public/screens`; the Relay page uses the poster or loop from `public/media/relay` with alt (SPEC criterion 9).",
      "Copy-editing and humanizer passes are recorded in Log."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/seoPages.spec.ts",
      "bunx biome check src/components/landing/data/seoPages.ts",
      "`grep -niE \"cards|undone|seamlessly|leverage|unlock|supercharge\" src/components/landing/data/seoPages.ts` prints nothing"
     ],
     "line": 527,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.4",
     "title": "Feature batch B final copy and media: json-compare, json-visualize, import",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.3"
     ],
     "files": [
      "src/components/landing/data/seoPages.ts"
     ],
     "gherkin": null,
     "do": "Same as T7.3 for `json-compare`, `json-visualize` and `import` (Postman, Insomnia, OpenAPI, cURL). CTAs point to `/json-compare`, `/json-visualize` and `/import`. The `import` page uses the T2.1 `import` screenshot (the `/import` route), not the dialog shots from T10.10. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Same copy, metadata and media criteria as T7.3 for these three pages (SPEC criteria 9, 12).",
      "Each CTA target is the matching existing tool route (SPEC section C)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/seoPages.spec.ts",
      "bunx biome check src/components/landing/data/seoPages.ts",
      "`grep -niE \"cards|undone|seamlessly|leverage|unlock|supercharge\" src/components/landing/data/seoPages.ts` prints nothing"
     ],
     "line": 539,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.5",
     "title": "Feature batch C final copy and media: collections-environments, command-palette, backup-restore",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.4",
      "T10.10"
     ],
     "files": [
      "src/components/landing/data/seoPages.ts"
     ],
     "gherkin": null,
     "do": "Same as T7.3 for the last three pages. `backup-restore` uses the backup dialog screenshots from T10.10, so this task waits for Phase 10. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Same copy, metadata and media criteria as T7.3 for these three pages; the backup page screenshots show the polished dialogs (SPEC criteria 9, 12; PLAN P10-before-capture note).",
      "All nine feature pages together have unique titles and descriptions."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/seoPages.spec.ts",
      "bunx biome check src/components/landing/data/seoPages.ts",
      "`grep -niE \"cards|undone|seamlessly|leverage|unlock|supercharge\" src/components/landing/data/seoPages.ts` prints nothing"
     ],
     "line": 550,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.6",
     "title": "Unit: feature template, route and final data",
     "done": true,
     "kind": "unit",
     "depends": [
      "T7.5"
     ],
     "files": [
      "src/components/seo/FeaturePageLayout.spec.tsx (new)",
      "src/components/seo/FeatureMedia.spec.tsx (new)",
      "src/app/features/[slug]/page.spec.tsx (new)",
      "src/components/landing/data/seoPages.spec.ts"
     ],
     "gherkin": null,
     "do": "Write `FeaturePageLayout.spec.tsx` (one h1, alt text, related links, hub link, CTA target, JSON-LD script present), `FeatureMedia.spec.tsx` (light and dark sources, alt) and a `page.spec.tsx` for the route (`generateStaticParams` returns all 9 slugs; `generateMetadata` canonical, OG, Twitter; unknown slug triggers `notFound`). Extend the data spec asserting every final screenshot file exists and banned terms are absent.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC criterion 9 at component level. Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/seo \"src/app/features/[slug]\" src/components/landing/data/seoPages.spec.ts --coverage --coverage.include=src/components/seo/FeaturePageLayout.tsx,src/components/seo/FeatureMedia.tsx,\"src/app/features/[slug]/page.tsx\" --coverage.reporter=text"
     ],
     "line": 561,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    },
    {
     "id": "T7.7",
     "title": "E2E: nine feature pages",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T7.6"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/feature-pages.spec.ts (new)",
      "agent_docs/qa/feature-pages/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/feature-pages.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; page list is restated from the SPEC, not read from `seoPages.ts`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/feature-pages.spec.ts --repeat-each=3"
     ],
     "line": 570,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T13:51:36.587Z"
    }
   ],
   "verified": 7,
   "total": 7,
   "complete": true
  },
  {
   "id": "8",
   "name": "Compare pages, hub redesign and footer",
   "startLine": 589,
   "endLine": 698,
   "adds": "Two comparison pages (`/compare/postman`, `/compare/insomnia`) with only sourced facts and honest \"where they are stronger\" notes, a redesigned `/features` hub linking to the new pages, and footer columns for Features and Compare.",
   "tryInUi": [
    "Open `/compare/postman` and `/compare/insomnia` and confirm every claim has a source and a \"where they are stronger\" note",
    "Open `/features` and click each flagship card to its page",
    "Scroll to the footer on `/` and use the Features and Compare links."
   ],
   "checkpoint": {
    "title": "Checkpoint 8",
    "line": 695,
    "items": [
     "SEO surface is complete: 11 pages, hub, footer, sitemap and robots on a green production build, no dead links, compare pages sourced and honest."
    ]
   },
   "tasks": [
    {
     "id": "T8.1",
     "title": "ComparePageLayout and /compare/[competitor] route",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.5",
      "T3.1"
     ],
     "files": [
      "src/components/seo/ComparePageLayout.tsx (new)",
      "src/app/compare/[competitor]/page.tsx (new)",
      "src/components/landing/data/seoPages.ts"
     ],
     "gherkin": null,
     "do": "Server-component template and route (`generateStaticParams` from `COMPARE_PAGES`, `generateMetadata`, `notFound()`, `dynamicParams = false`) that renders only facts already in `comparison.ts` (each with its existing `source` URL), a \"where they are stronger\" section, JSON-LD (`WebPage` + `BreadcrumbList`; `FAQPage` only if a visible FAQ exists), exactly one h1, links to the hub and the related feature pages, CTA to `/app`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every comparison claim on the page is derived from `comparison.ts` and shows its source link; nothing is hard-coded or invented (SPEC section C compare pages).",
      "A \"where they are stronger\" note is present on both pages; no \"measured\" (SPEC criterion 2).",
      "Unknown competitor returns 404.",
      "The template's fixed labels (section headings such as \"Where they are stronger\", source-link text, CTA label) pass the copy gate, recorded in Log."
     ],
     "verify": [
      "bunx biome check src/components/seo/ComparePageLayout.tsx \"src/app/compare/[competitor]/page.tsx\" src/components/landing/data/seoPages.ts",
      "`grep -rni \"measured\" src/components/seo/ComparePageLayout.tsx src/app/compare` prints nothing"
     ],
     "line": 594,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.2",
     "title": "Compare pages final copy",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T8.1"
     ],
     "files": [
      "src/components/landing/data/seoPages.ts"
     ],
     "gherkin": null,
     "do": "Final title, description, intro, stronger-notes and optional visible FAQ for Postman and Insomnia. Copy gate (`copywriting`, `copy-editing`, `humanizer`, `seo-audit`, `ai-seo`); banned-term grep; record in Log. Honest tone: say where each competitor is stronger.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Titles <=60, descriptions 120-160, unique across all 11 pages; no banned terms; \"measured\" absent in `src/app/compare` and `src/components/landing` (SPEC criteria 2, 12).",
      "Any FAQ shown is visible on the page (otherwise no FAQ schema) (SPEC section C)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/seoPages.spec.ts",
      "bunx biome check src/components/landing/data/seoPages.ts",
      "`grep -rni \"measured\" src/components/landing src/app/compare` prints nothing"
     ],
     "line": 607,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.3",
     "title": "Hub redesign",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T7.5",
      "T8.2"
     ],
     "files": [
      "src/components/landing/AllFeaturesPage.tsx",
      "src/components/landing/features/FeatureCard.tsx",
      "src/components/landing/data/features.ts",
      "src/app/features/page.tsx"
     ],
     "gherkin": null,
     "do": "Redesign the hub so flagship features link to their new pages and all existing features sit in one coherent layout; screenshot and non-screenshot items carry the same visual weight; every card is a link or clearly non-interactive. Run `ui-ux-pro-max`, `impeccable`, `frontend-design`, `critique`, `layout`, `web-design-guidelines`. Update `page.tsx` metadata (title, description, canonical, breadcrumb JSON-LD) from `SITE_URL`. Hub links read `seoPages.ts`. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Hub links to every flagship feature page and to both compare pages (SPEC criterion 11).",
      "No orphan or dead card; consistent visual weight for screenshot and text items (SPEC section C hub).",
      "Hub has unique metadata and canonical."
     ],
     "verify": [
      "bunx vitest run src/components/landing/features src/components/landing",
      "bunx biome check src/components/landing/AllFeaturesPage.tsx src/components/landing/features/FeatureCard.tsx src/components/landing/data/features.ts src/app/features/page.tsx"
     ],
     "line": 618,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.4",
     "title": "Footer link columns",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T8.2"
     ],
     "files": [
      "src/components/landing/Footer.tsx",
      "src/components/landing/Footer.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add \"Features\" and \"Compare\" link columns driven by `seoPages.ts`, replacing the `#features` and `#compare` anchors; keep Privacy and Terms; top Nav stays unchanged (footer-only). Update `Footer.spec.tsx`. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Footer has Features (hub plus 9 pages) and Compare (2 pages) columns with real routes; no `#features`/`#compare` anchors remain (SPEC criterion 11).",
      "Links come from `seoPages.ts`, not hard-coded."
     ],
     "verify": [
      "bunx vitest run src/components/landing/Footer.spec.tsx",
      "bunx biome check src/components/landing/Footer.tsx src/components/landing/Footer.spec.tsx",
      "`grep -n '#features\\|#compare' src/components/landing/Footer.tsx` prints nothing"
     ],
     "line": 630,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.5",
     "title": "Unit: compare layout and route",
     "done": true,
     "kind": "unit",
     "depends": [
      "T8.4",
      "T8.3"
     ],
     "files": [
      "src/components/seo/ComparePageLayout.tsx",
      "src/app/compare/[competitor]/page.tsx",
      "src/components/seo/ComparePageLayout.spec.tsx (new)",
      "src/app/compare/[competitor]/page.spec.tsx (new)"
     ],
     "gherkin": null,
     "do": "Write `ComparePageLayout.spec.tsx` (one h1; every claim carries its source link; stronger-notes section present; FAQ schema only with a visible FAQ; no \"measured\") and a route spec (`generateStaticParams` returns postman and insomnia; metadata; unknown competitor calls `notFound`).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`."
     ],
     "verify": [
      "bunx vitest run src/components/seo/ComparePageLayout.spec.tsx \"src/app/compare/[competitor]\" --coverage --coverage.include=src/components/seo/ComparePageLayout.tsx,\"src/app/compare/[competitor]/page.tsx\" --coverage.reporter=text"
     ],
     "line": 641,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.6",
     "title": "Unit: footer, hub and feature card",
     "done": true,
     "kind": "unit",
     "depends": [
      "T8.5"
     ],
     "files": [
      "src/components/landing/Footer.tsx",
      "src/components/landing/AllFeaturesPage.tsx",
      "src/components/landing/features/FeatureCard.tsx",
      "src/components/landing/AllFeaturesPage.spec.tsx (new)",
      "src/components/landing/features/FeatureCard.spec.tsx (new)",
      "src/components/landing/Footer.spec.tsx"
     ],
     "gherkin": null,
     "do": "Extend `Footer.spec.tsx` (columns, hrefs match `seoPages.ts`, Privacy and Terms kept), add `AllFeaturesPage.spec.tsx` (every flagship links to its page; every card is a link or non-interactive; both compare links), add `features/FeatureCard.spec.tsx` (does not exist yet; link vs static rendering).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"Footer link columns\" and \"every hub link resolves\". Every file >=80% lines/branches/functions/statements, target >95%."
     ],
     "verify": [
      "bunx vitest run src/components/landing/Footer.spec.tsx src/components/landing/AllFeaturesPage.spec.tsx src/components/landing/features/FeatureCard.spec.tsx --coverage --coverage.include=src/components/landing/Footer.tsx,src/components/landing/AllFeaturesPage.tsx,src/components/landing/features/FeatureCard.tsx --coverage.reporter=text"
     ],
     "line": 649,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.7",
     "title": "E2E: compare pages",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T8.6"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/compare-pages.spec.ts (new)",
      "agent_docs/qa/compare-pages/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/compare-pages.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/compare-pages.spec.ts --repeat-each=3"
     ],
     "line": 657,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.8",
     "title": "E2E: hub, footer and link check",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T8.7"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/hub-footer-links.spec.ts (new)",
      "agent_docs/qa/hub-footer-links/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/hub-footer-links.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; the crawl asserts a non-empty link set so it cannot pass vacuously."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/hub-footer-links.spec.ts --repeat-each=3"
     ],
     "line": 670,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    },
    {
     "id": "T8.9",
     "title": "Gate: production build, static params and sitemap",
     "done": true,
     "kind": "gate",
     "depends": [
      "T8.8"
     ],
     "files": [],
     "gherkin": null,
     "do": "Build the current tree in the e2e dist dir and run the SEO specs against that production server, so static generation, `generateStaticParams`, `sitemap.ts` and `robots.ts` are proven on a real build without touching the dev server. Then paste the rendered JSON-LD of one feature page and one compare page (and the hub) into the schema.org validator (validator.schema.org) or Google Rich Results Test and record the result in Log (SPEC criterion 9 \"validator pass\").",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`bun run build` (via `E2E_DIST_DIR=.next-e2e`) succeeds, including its type check, and lists the 9 feature and 2 compare routes as statically generated (SPEC criteria 9, 10).",
      "`feature-pages`, `compare-pages`, `hub-footer-links` and `site-plumbing` specs pass against the prod server.",
      "The schema validator reports no errors for the checked pages; result recorded in Log (SPEC criterion 9)."
     ],
     "verify": [
      "`E2E_DIST_DIR=.next-e2e bun run build` output lists `/features/[slug]` and `/compare/[competitor]` as SSG",
      "E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/feature-pages.spec.ts e2e/qa/landing-seo-polish/compare-pages.spec.ts e2e/qa/landing-seo-polish/hub-footer-links.spec.ts e2e/qa/landing-seo-polish/site-plumbing.spec.ts --repeat-each=2",
      "`grep -rni \"measured\" src/components/landing src/app/compare` prints nothing"
     ],
     "line": 683,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T14:51:58.814Z"
    }
   ],
   "verified": 9,
   "total": 9,
   "complete": true
  },
  {
   "id": "9",
   "name": "History sidebar",
   "startLine": 699,
   "endLine": 812,
   "adds": "The history sidebar groups runs under day headers (Today, Yesterday, dates), collapses repeated runs of the same request into one row with a run count, expands them inline, scrolls smoothly with hundreds of entries, and shows a tooltip only when a URL is cut off.",
   "tryInUi": [
    "Open the app with a long history and confirm sticky day headers",
    "Send the same request three times and confirm one row with a count that expands to three runs",
    "Click a run to restore it and delete one run",
    "Hover a long URL and confirm a tooltip, then hover a short one and confirm none."
   ],
   "checkpoint": {
    "title": "Checkpoint 9",
    "line": 809,
    "items": [
     "History sidebar groups by day and run, stays bounded and smooth at 500 entries, shows truncation-only tooltips, and storage is untouched (store spec passes unmodified); targeted vitest and both history specs green."
    ]
   },
   "tasks": [
    {
     "id": "T9.1",
     "title": "groupHistory pure helper",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/history/groupHistory.ts (new)"
     ],
     "gherkin": null,
     "do": "`groupHistoryByDay(entries: HistoryEntry[], opts: { now: number; filter: string }): HistoryRow[]` with `HistoryRow` a discriminated union (`header | group | run`). Rules from SPEC E: filter runs first with the existing predicate (url, method, `healthKey`), group second; local-timezone day boundaries; \"Today\", \"Yesterday\", locale dates; newest first; group by exact `method` + `url`; `N=1` stays a single row; while filtering, a group's count and runs cover only matching runs; expose a helper `limitGroups(rows, COMPACT_GROUP_LIMIT)` (named constant = 20) for the compact rule (filter, group, first 20 groups with their headers). Keep the SPEC signature exactly; expansion is a second pure function in the same file, `toVisibleRows(rows, expandedIds)`, that drops the `run` rows of collapsed groups so the virtualizer gets the flat visible model. Named constants, no magic numbers.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Same method + URL within a day yields one group; different method or only-query differences yield separate groups; `N=1` is a plain run row (SPEC E rules 1, 2, edge cases).",
      "Midnight boundary and DST handled in the local timezone; \"Today\"/\"Yesterday\" correct (SPEC criterion 16).",
      "Filter keeps a group if at least one run matches and counts only matching runs (SPEC E rule 6); compact keeps the first 20 groups with headers (SPEC E rule 8).",
      "Pure: no store, no `Date.now()` inside (uses `opts.now`); `useHistoryStore` untouched (SPEC criterion 18)."
     ],
     "verify": [
      "bunx biome check src/components/history/groupHistory.ts",
      "`git diff --stat -- src/stores/useHistoryStore.ts` prints nothing"
     ],
     "line": 704,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.2",
     "title": "Day header and group row components",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T9.1"
     ],
     "files": [
      "src/components/history/HistoryDayHeader.tsx (new)",
      "src/components/history/HistoryGroupRow.tsx (new)",
      "src/components/history/HistoryItem.tsx"
     ],
     "gherkin": null,
     "do": "`HistoryDayHeader` (sticky-capable header). `HistoryGroupRow`: method badge, URL, `x N` count, latest status, latest time; chevron/count toggles inline expansion with each run (time + status); clicking the collapsed row opens the latest run; each run restores its own request using the existing `handleClick` logic and has its own delete; `aria-expanded` on the toggle. Reuse `HistoryItem` for single-run rows.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Collapsed group shows method, URL, `x N`, latest status and time; expanded shows N runs (SPEC criterion 15).",
      "Clicking a run restores that run's request; delete is per run; deleting the last run removes the group; deleting the latest updates the summary (SPEC E rule 3).",
      "`aria-expanded` reflects state.",
      "New user-facing strings (day labels, run-count and toggle labels) pass the copy gate, recorded in Log."
     ],
     "verify": [
      "bunx biome check src/components/history/HistoryDayHeader.tsx src/components/history/HistoryGroupRow.tsx"
     ],
     "line": 715,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.3",
     "title": "Virtualized HistoryList with sticky headers",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T9.2"
     ],
     "files": [
      "src/components/history/HistoryList.tsx",
      "src/components/history/HistoryList.spec.tsx",
      "agent_docs/landing-seo-polish/PLAN.md"
     ],
     "gherkin": null,
     "do": "Derive rows with `useMemo(groupHistoryByDay(...))`, flatten with `toVisibleRows` to a row model (header | group | run), virtualize with `@tanstack/react-virtual` (measured row heights because expansion changes height; overscan constant), keep day headers sticky while virtualized, keep expanded group ids as component state (decide against the CLAUDE.md store rule: switch to a small Zustand store only if the sidebar remounts and loses state; record the decision in `PLAN.md`), keep the `compact` prop working. Update the existing spec so it still passes.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "With 500+ entries the DOM holds a bounded number of row nodes (target < 60) (SPEC criterion 14).",
      "Sticky day headers stay pinned while scrolling their day (SPEC criterion 16).",
      "Expanding a group changes height without scroll jump; trimming at the cap while expanded does not break (SPEC edge cases).",
      "`useHistoryStore` untouched; its spec passes unmodified (SPEC criterion 18)."
     ],
     "verify": [
      "bunx vitest run src/components/history src/stores/useHistoryStore.spec.ts",
      "bunx biome check src/components/history/HistoryList.tsx src/components/history/HistoryList.spec.tsx",
      "`git diff --stat -- src/stores` prints nothing"
     ],
     "line": 728,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.4",
     "title": "Truncation-only tooltip",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T9.3"
     ],
     "files": [
      "src/hooks/useIsTruncated.ts (new)",
      "src/components/history/HistoryItem.tsx",
      "src/components/history/HistoryItem.spec.tsx"
     ],
     "gherkin": null,
     "do": "Hook that reports `scrollWidth > clientWidth` (recomputed on resize via `ResizeObserver`); `HistoryItem` shows the full-URL tooltip only when truncated. Keep the delete button's `title`. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Short URL: no tooltip; long URL: tooltip with the full URL (SPEC criterion 17).",
      "Very long and no-whitespace URLs truncate with no horizontal scroll (SPEC edge cases)."
     ],
     "verify": [
      "bunx vitest run src/components/history/HistoryItem.spec.tsx",
      "bunx biome check src/hooks/useIsTruncated.ts src/components/history/HistoryItem.tsx src/components/history/HistoryItem.spec.tsx"
     ],
     "line": 741,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.5",
     "title": "Search, empty states, keyboard and a11y polish",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T9.4"
     ],
     "files": [
      "src/components/history/HistoryList.tsx",
      "src/components/history/HistoryGroupRow.tsx",
      "agent_docs/landing-seo-polish/PLAN.md"
     ],
     "gherkin": null,
     "do": "Wire filter-first-then-group search; add clear empty and no-match states; evaluate the SPEC E.9 candidates (arrow-key and Enter navigation, per-day clear) and adopt only those that are clearly beneficial and small, listing each adopted item with justification in a \"History UX decisions\" section of `PLAN.md` (dropped items listed as dropped). `aria-expanded` and labelled controls on every row type.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Empty history and no-match states render with helpful text (SPEC criterion 16).",
      "While a filter is active, group `x N` and expanded runs cover only matching runs (SPEC E rule 6).",
      "`PLAN.md` lists each adopted and dropped UX item with a reason (SPEC E rule 9).",
      "Empty and no-match text passes the copy gate, recorded in Log."
     ],
     "verify": [
      "bunx vitest run src/components/history",
      "bunx biome check src/components/history/HistoryList.tsx src/components/history/HistoryGroupRow.tsx",
      "grep -n \"History UX decisions\" agent_docs/landing-seo-polish/PLAN.md"
     ],
     "line": 752,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.6",
     "title": "Unit: groupHistory",
     "done": true,
     "kind": "unit",
     "depends": [
      "T9.5"
     ],
     "files": [
      "src/components/history/groupHistory.ts",
      "src/components/history/groupHistory.spec.ts (new)"
     ],
     "gherkin": null,
     "do": "Write `groupHistory.spec.ts`: empty input; single run (no group); same URL different method (separate); query-only difference (separate); midnight boundary; timezone and DST (stub `TZ` via fixed `now` and entries); filter across runs; filter then group counts; compact first-20-groups rule; delete-last-run input produces no group; newest-first order; `toVisibleRows` hides runs of collapsed groups and shows them for expanded ids.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"groupHistory\". Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/history/groupHistory.spec.ts --coverage --coverage.include=src/components/history/groupHistory.ts --coverage.reporter=text"
     ],
     "line": 765,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.7",
     "title": "Unit: history components",
     "done": true,
     "kind": "unit",
     "depends": [
      "T9.6"
     ],
     "files": [
      "src/components/history/HistoryGroupRow.tsx",
      "src/components/history/HistoryDayHeader.tsx",
      "src/components/history/HistoryItem.tsx",
      "src/hooks/useIsTruncated.ts",
      "src/components/history/HistoryList.tsx",
      "src/components/history/HistoryGroupRow.spec.tsx (new)",
      "src/components/history/HistoryDayHeader.spec.tsx (new)",
      "src/hooks/useIsTruncated.spec.ts (new)"
     ],
     "gherkin": null,
     "do": "Write specs for `HistoryGroupRow` (collapsed summary, `x N`, expand and `aria-expanded`, restore a run, delete a run, delete last removes group), `HistoryDayHeader`, `HistoryItem` (tooltip only when truncated, mocking layout sizes), `useIsTruncated` (resize recompute) and extend `HistoryList.spec.tsx` (mock the virtualizer; headers, groups, empty and no-match states, compact mode, keyboard behaviour if adopted).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"HistoryItem/Group (expand, xN, tooltip only when truncated)\". Every file >=80% lines/branches/functions/statements, target >95%; `useHistoryStore.spec.ts` untouched and green."
     ],
     "verify": [
      "`bunx vitest run src/components/history src/hooks/useIsTruncated.spec.ts src/stores/useHistoryStore.spec.ts --coverage --coverage.include=src/components/history/HistoryGroupRow.tsx --coverage.include=src/components/history/HistoryDayHeader.tsx --coverage.include=src/components/history/HistoryItem.tsx --coverage.include=src/hooks/useIsTruncated.ts --coverage.include=src/components/history/HistoryList.tsx --coverage.reporter=text --coverage.reporter=json-summary --coverage.reportsDirectory=coverage/T9.7` (one `--coverage.include` per file",
      "the comma form reports 0%",
      "the text reporter hides 100% files, so per-file numbers come from `coverage/T9.7/coverage-summary.json`)"
     ],
     "line": 773,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.8",
     "title": "E2E: grouping, expand, restore, delete, tooltip",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T9.7"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/history-grouping.spec.ts (new)",
      "e2e/fixtures/seed/history-landing-seo.json (new)",
      "e2e/fixtures/qa-seed.init.js (regenerated)",
      "agent_docs/qa/history-grouping/*.png (new)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/history-grouping.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; history is seeded through the `history` store in `qa-seed.init.js` / `qaSeed.ts` data, not through the UI."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/history-grouping.spec.ts --repeat-each=3"
     ],
     "line": 781,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    },
    {
     "id": "T9.9",
     "title": "E2E: virtualization, sticky headers and day boundaries",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T9.8"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/history-virtualization.spec.ts (new)",
      "agent_docs/qa/history-virtualization/*.png (new)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/history-virtualization.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; the long-task check fails if the observer records nothing about the scroll (no vacuous pass)."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/history-virtualization.spec.ts e2e/history.spec.ts --repeat-each=3"
     ],
     "line": 795,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-11T15:58:14.101Z"
    }
   ],
   "verified": 9,
   "total": 9,
   "complete": true
  },
  {
   "id": "10",
   "name": "Dialog UI and copy polish",
   "startLine": 813,
   "endLine": 929,
   "adds": "The Import dialog, Export backup dialog and Import backup dialog get clearer wording: the dangling-links message explains what a link is and what to do, Replace says exactly what is deleted, Merge says what is kept, buttons use consistent verbs (Scan, Export, Restore, Cancel), and the secret-values switch states its consequence.",
   "tryInUi": [
    "Open the backup export dialog and read the include-secrets switch and the links message",
    "Open the import backup dialog, pick Replace, and confirm it says what will be deleted",
    "Open the Import dialog and confirm Scan and Cancel labels",
    "Resize to 375 px in dark mode and confirm nothing overflows."
   ],
   "checkpoint": {
    "title": "Checkpoint 10",
    "line": 926,
    "items": [
     "Dangling-links, Replace and Merge text, labels and secrets switch match the SPEC, hooks and serializers are untouched (diff empty), fr and ja parity passes, dialog specs green and polished screenshots captured."
    ]
   },
   "tasks": [
    {
     "id": "T10.1",
     "title": "ImportDialog polish",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/import/ImportDialog.tsx",
      "src/components/import/ImportDialog.spec.tsx"
     ],
     "gherkin": null,
     "do": "JSX and copy only: hierarchy and spacing of the File/cURL tabs, dropzone, trust warning, format chips and Scan button; verbs Scan and Cancel; mobile width. Run `impeccable`, `clarify`, `polish`, `ui-ux-pro-max`, `frontend-design`, `shadcn`, `shadcn-component-rules`; copy gate. Strings stay hardcoded English (this dialog has no next-intl today; no i18n migration, SPEC out of scope). No change to `src/lib/*Parser*`, `importScanner.ts` or any import hook. Update the existing spec's label assertions.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Labels use Scan and Cancel; the trust warning and format chips are clear and unchanged in behaviour (SPEC section F).",
      "Diff touches no parser, scanner or hook logic (SPEC criterion 20).",
      "Renders without overflow at 375 px, light and dark."
     ],
     "verify": [
      "bunx vitest run src/components/import/ImportDialog.spec.tsx src/lib/curlParser.spec.ts src/lib/insomniaParser.spec.ts",
      "bunx biome check src/components/import/ImportDialog.tsx src/components/import/ImportDialog.spec.tsx",
      "`git diff --stat -- src/lib/curlParser.ts src/lib/importScanner.ts src/lib/postmanParser.ts src/lib/insomniaParser.ts src/lib/openapiParser.ts` prints nothing"
     ],
     "line": 818,
     "ui": true,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T10.2",
     "title": "ExportBackupDialog and section picker polish",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T10.1"
     ],
     "files": [
      "src/components/settings/backup/ExportBackupDialog.tsx",
      "src/components/settings/backup/BackupSectionPicker.tsx",
      "src/components/settings/backup/ExportBackupDialog.spec.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Hierarchy and spacing for Everything / Choose what to include, the conversations note and estimated size; the \"Include secret values\" switch states the consequence in plain words (default unchanged); the dangling-links message (\"N links point to items that are not in this backup\") becomes explained and actionable: what a link is, why it dangles, what happens on restore, what to do (for example include those collections). Verb Export, Cancel. Skills and copy gate as T10.1; `en` keys only. No change to `useBackupExport.ts` or `src/lib/backup/*`. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Dangling-links text answers what a link is, why it dangles, what restore does and what to do (SPEC section F, criterion 19).",
      "The secrets switch explains the consequence in plain words with the default unchanged (SPEC section F).",
      "Button labels are Export and Cancel; no overflow at 375 px.",
      "`useBackupExport.ts` and `src/lib/backup` unchanged (SPEC criterion 20)."
     ],
     "verify": [
      "bunx vitest run src/components/settings/backup/ExportBackupDialog.spec.tsx src/lib/backup",
      "bunx biome check src/components/settings/backup/ExportBackupDialog.tsx src/components/settings/backup/BackupSectionPicker.tsx src/components/settings/backup/ExportBackupDialog.spec.tsx messages/en/settings.json",
      "`git diff --stat -- src/components/settings/backup/useBackupExport.ts src/lib/backup` prints nothing"
     ],
     "line": 829,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.3",
     "title": "ImportBackupDialog and BackupPreview polish",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T10.2"
     ],
     "files": [
      "src/components/settings/backup/ImportBackupDialog.tsx",
      "src/components/settings/backup/BackupPreview.tsx",
      "src/components/settings/backup/ImportBackupDialog.spec.tsx",
      "messages/en/settings.json",
      "messages/en/common.json (only if the shared cancel label changes)"
     ],
     "gherkin": null,
     "do": "Clear counts presentation; Merge says what is kept; Replace is explicit about what is deleted before the user commits; verbs Restore and Cancel (Cancel comes from `common.cancel`; prefer reusing it unchanged). Same skills and copy gate; `en` keys only. No change to `useBackupImport.ts` or `src/lib/backup/*`. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Merge text states what is kept; Replace text states that current local data is replaced and deleted before commit (SPEC section F, criterion 19).",
      "Labels are Restore and Cancel across the dialog.",
      "`useBackupImport.ts` and `src/lib/backup` unchanged (SPEC criterion 20)."
     ],
     "verify": [
      "bunx vitest run src/components/settings/backup/ImportBackupDialog.spec.tsx src/lib/backup",
      "bunx biome check src/components/settings/backup/ImportBackupDialog.tsx src/components/settings/backup/BackupPreview.tsx src/components/settings/backup/ImportBackupDialog.spec.tsx messages/en/settings.json",
      "`git diff --stat -- src/components/settings/backup/useBackupImport.ts src/lib/backup` prints nothing"
     ],
     "line": 842,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.4",
     "title": "ReplaceConfirmDialog polish",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T10.3"
     ],
     "files": [
      "src/components/settings/backup/ReplaceConfirmDialog.tsx",
      "src/components/settings/backup/ReplaceConfirmDialog.spec.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Make the confirm state spell out what will be deleted and that it cannot be undone from here; destructive-action styling consistent with the other dialogs; Restore and Cancel verbs; focus lands on the safe action. Same skills and copy gate; `en` keys only.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The dialog names what is deleted before the user commits; Cancel is the default focus (SPEC section F, criterion 19).",
      "Labels match the other two dialogs."
     ],
     "verify": [
      "bunx vitest run src/components/settings/backup/ReplaceConfirmDialog.spec.tsx",
      "bunx biome check src/components/settings/backup/ReplaceConfirmDialog.tsx src/components/settings/backup/ReplaceConfirmDialog.spec.tsx messages/en/settings.json"
     ],
     "line": 854,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.5",
     "title": "Locale: fr and ja strings for the backup dialogs",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T10.4"
     ],
     "files": [
      "messages/fr/settings.json",
      "messages/ja/settings.json",
      "messages/fr/common.json and messages/ja/common.json (only if T10.3 changed common)"
     ],
     "gherkin": null,
     "do": "Translate every key added or changed in T10.2 to T10.4 into `fr` and `ja`, ICU placeholders intact (`{count}` and friends), same key set as `en`. This is parity maintenance for existing locales, not new i18n. Copy gate on the English source is already done; translate tone-neutral and plain.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`fr` and `ja` have exactly the `en` key set for every touched namespace; placeholders unchanged (parity specs)."
     ],
     "verify": [
      "bunx vitest run src/i18n",
      "bunx biome check messages/fr messages/ja"
     ],
     "line": 865,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.6",
     "title": "Unit: dialogs",
     "done": false,
     "kind": "unit",
     "depends": [
      "T10.5"
     ],
     "files": [
      "src/components/import/ImportDialog.tsx",
      "src/components/settings/backup/ExportBackupDialog.tsx",
      "src/components/settings/backup/BackupSectionPicker.tsx",
      "src/components/settings/backup/ImportBackupDialog.tsx",
      "src/components/settings/backup/BackupPreview.tsx"
     ],
     "gherkin": null,
     "do": "Extend the existing specs (and add `BackupSectionPicker.spec.tsx`, `BackupPreview.spec.tsx`): button labels (Scan, Export, Restore, Cancel), dangling-links explanation text with N, secrets-switch consequence text with default unchanged, Merge and Replace text, behaviour assertions unchanged (same callbacks and payloads as before).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC criterion 19 text and labels. Every file >=80% lines/branches/functions/statements, target >95%; hook, store and serializer specs pass unmodified (`git diff --stat -- src/lib/backup src/components/settings/backup/useBackup*.ts` empty)."
     ],
     "verify": [
      "bunx vitest run src/components/import/ImportDialog.spec.tsx src/components/settings/backup --coverage --coverage.include=src/components/import/ImportDialog.tsx,src/components/settings/backup/ExportBackupDialog.tsx,src/components/settings/backup/BackupSectionPicker.tsx,src/components/settings/backup/ImportBackupDialog.tsx,src/components/settings/backup/BackupPreview.tsx --coverage.reporter=text"
     ],
     "line": 874,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.7",
     "title": "Unit: ReplaceConfirmDialog",
     "done": false,
     "kind": "unit",
     "depends": [
      "T10.6"
     ],
     "files": [
      "src/components/settings/backup/ReplaceConfirmDialog.tsx"
     ],
     "gherkin": null,
     "do": "Extend `ReplaceConfirmDialog.spec.tsx`: deletion statement, Cancel default focus, Restore confirm callback fires once, escape cancels.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails`."
     ],
     "verify": [
      "bunx vitest run src/components/settings/backup/ReplaceConfirmDialog.spec.tsx --coverage --coverage.include=src/components/settings/backup/ReplaceConfirmDialog.tsx --coverage.reporter=text"
     ],
     "line": 882,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.8",
     "title": "E2E: import dialog",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T10.7"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/site-plumbing.spec.ts (new)",
      "agent_docs/qa/site-plumbing/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/import-dialog.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/import-dialog.spec.ts --repeat-each=3"
     ],
     "line": 890,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.9",
     "title": "E2E: backup export and restore dialogs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T10.8"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/site-plumbing.spec.ts (new)",
      "agent_docs/qa/site-plumbing/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/backup-dialogs.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/backup-dialogs.spec.ts --repeat-each=3"
     ],
     "line": 902,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T10.10",
     "title": "Gate: capture polished dialog screenshots",
     "done": false,
     "kind": "gate",
     "depends": [
      "T10.9",
      "T2.5"
     ],
     "files": [
      "scripts/capture/screens.ts",
      "scripts/capture/verify-assets.mjs",
      "public/screens/* (generated: import-dialog",
      "backup-export",
      "backup-restore",
      "each -light and -dark)"
     ],
     "gherkin": null,
     "do": "Re-run the capture script with `--only dialogs` after the polish is final so landing (Phase 6) and feature pages (T7.5) use screenshots of the real polished dialogs; add the dialog names to the `verify-assets.mjs` manifest; run the asset checker.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Dialog screenshots exist in light and dark, show DummyJSON-style seed data only, and are within the size budget (SPEC section F; PLAN P10 before captures).",
      "`verify-assets.mjs` exits 0."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bun scripts/capture/screens.ts --only dialogs",
      "node scripts/capture/verify-assets.mjs",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/backup-dialogs.spec.ts --repeat-each=2"
     ],
     "line": 916,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 10,
   "complete": false
  },
  {
   "id": "11",
   "name": "Legal rewrite",
   "startLine": 930,
   "endLine": 993,
   "adds": "The Privacy Policy and Terms are rewritten from what the code really does: local-first storage, the request proxy, Upstash, DeepSeek and xAI, voice input, encrypted 24-hour share links, hosting, and email deletion requests. Terms have no billing or account sections. Nothing on the pages says \"legal review required\".",
   "tryInUi": [
    "Open `/privacy` and confirm it names DeepSeek and xAI and the 24-hour share-link expiry",
    "Open `/terms` and confirm there are no billing, subscription or account-termination sections",
    "Search both pages for \"legal review\" and find nothing",
    "Open `agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md` and confirm each data flow cites code."
   ],
   "checkpoint": {
    "title": "Checkpoint 11",
    "line": 990,
    "items": [
     "Both legal pages are rewritten from verified code facts, every data flow is cited in `LEGAL_REVIEW_NOTES.md`, no review marker exists in `src`, specs and `legal-pages.spec.ts` green."
    ]
   },
   "tasks": [
    {
     "id": "T11.1",
     "title": "Verify data flows and write LEGAL_REVIEW_NOTES.md",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md (new)"
     ],
     "gherkin": null,
     "do": "First read `~/.agents/skills/privacy-policy/SKILL.md` and `~/.agents/skills/terms-of-service/SKILL.md` (reading them is mandatory; invoking alone does not count). Then verify each of the ten SPEC section D data-flow rows against the code files listed there and record a citation (`file:line` plus what the code does) per row, conservative wording for anything the code cannot confirm. Record DPDP Act 2023 applicability and the cross-border transfer to DeepSeek and xAI, and every item needing a lawyer or the owner's decision. This file is the only place \"LEGAL REVIEW REQUIRED\" style notes live.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "All ten data-flow rows are cited to code; the AI row confirms only DeepSeek (chat and `/api/ai`) and xAI (STT) are called and that OpenAI, Anthropic and Gemini appear only in `bannedTokens.ts` (SPEC criterion 13).",
      "The share-link row confirms ciphertext only in Redis, key in the URL fragment, 24 h TTL (`SHARE_PAYLOAD_TTL_SEC`), and the hourly rate-limit counter.",
      "DPDP 2023 and cross-border notes are present; unconfirmable claims are flagged here, not asserted."
     ],
     "verify": [
      "grep -c \"src/\" agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md",
      "grep -ni \"DPDP\\|cross-border\" agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md"
     ],
     "line": 935,
     "ui": false,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T11.2",
     "title": "Privacy page rewrite",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T11.1"
     ],
     "files": [
      "src/app/privacy/page.tsx",
      "src/components/legal/constants.ts",
      "src/components/legal/LegalLayout.tsx"
     ],
     "gherkin": null,
     "do": "Rewrite from the verified flows only: operator Deepak Dewani (individual), India, governing law India, contact kumard8308887772@gmail.com, free product, no paid tier, no accounts. Name the providers the code calls (DeepSeek, xAI) and none it does not call, plus a clause that providers may change and the list is kept current; cover local-only storage, proxy, Upstash, Vercel hosting, encrypted share links (24 h expiry), browser versus server voice input (xAI), Relay rate limiting, hub templates, no analytics, and data deletion requests by email. Effective date set at publish time in `constants.ts`. No \"legal review required\" marker in any form. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Page names DeepSeek and xAI and no other AI provider; covers every item listed in SPEC criterion 13; operator, governing law and contact match the fixed facts.",
      "`grep -ri \"legal review required\" src` is empty.",
      "Unique `<title>`, description and canonical metadata from `SITE_URL`."
     ],
     "verify": [
      "bunx biome check src/app/privacy/page.tsx src/components/legal/constants.ts src/components/legal/LegalLayout.tsx",
      "`grep -ri \"legal review required\" src` prints nothing",
      "bunx vitest run src/components/legal"
     ],
     "line": 946,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T11.3",
     "title": "Terms page rewrite",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T11.2"
     ],
     "files": [
      "src/app/terms/page.tsx"
     ],
     "gherkin": null,
     "do": "Rewrite for a free, accountless tool by an individual operator in India (governing law India, contact email). Include acceptable use, AI-output disclaimer, proxy and third-party-API responsibility, availability and changes, liability limits; do NOT include billing, subscription, account-termination or refund sections. No \"legal review required\" marker. Copy gate; record in Log.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No billing, subscription, account-termination or refund sections (SPEC criterion 13).",
      "Operator, governing law and contact match the fixed facts; no review marker.",
      "Unique metadata and canonical from `SITE_URL`."
     ],
     "verify": [
      "bunx biome check src/app/terms/page.tsx",
      "`grep -ri \"legal review required\" src` prints nothing",
      "`grep -niE \"billing|subscription|refund|account termination\" src/app/terms/page.tsx` prints nothing"
     ],
     "line": 958,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T11.4",
     "title": "Unit: legal pages",
     "done": false,
     "kind": "unit",
     "depends": [
      "T11.3"
     ],
     "files": [
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
      "src/components/legal/constants.ts",
      "src/components/legal/LegalLayout.tsx"
     ],
     "gherkin": null,
     "do": "Write `privacy/page.spec.tsx` and `terms/page.spec.tsx` plus extend `LegalLayout.spec.tsx`: case-insensitive \"legal review required\" absent from both rendered pages; privacy names DeepSeek and xAI and not OpenAI, Anthropic or Gemini; covers Upstash, Vercel, proxy, 24 h share links, voice input and email deletion; terms contain no billing, subscription, account-termination or refund text; fixed facts (operator, India, email) present; metadata unique.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Covers SPEC testing list \"legal pages contain no [LEGAL REVIEW REQUIRED]\" and criterion 13. Every file >=80% lines/branches/functions/statements, target >95%."
     ],
     "verify": [
      "bunx vitest run src/app/privacy src/app/terms src/components/legal --coverage --coverage.include=src/app/privacy/page.tsx,src/app/terms/page.tsx,src/components/legal/constants.ts,src/components/legal/LegalLayout.tsx --coverage.reporter=text"
     ],
     "line": 970,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T11.5",
     "title": "E2E: privacy and terms pages",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T11.4"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/site-plumbing.spec.ts (new)",
      "agent_docs/qa/site-plumbing/*.png (generated proof shots)"
     ],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/landing-seo-polish/legal-pages.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/landing-seo-polish/legal-pages.spec.ts --repeat-each=3"
     ],
     "line": 978,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 5,
   "complete": false
  },
  {
   "id": "12",
   "name": "Final gate",
   "startLine": 994,
   "endLine": 1066,
   "adds": "Nothing new for users. Confirms the whole epic works together: greps clean, typecheck and lint clean, targeted suites green, Lighthouse at or better than baseline, no dead links, the 10-second hero test passes, and the full diff is audited.",
   "tryInUi": [
    "Open `/` at 1280 px and 390 px and say what Requestr is within 10 seconds",
    "Click through hub, footer, one feature page and one compare page",
    "Open `agent_docs/landing-seo-polish/final/` and compare the Lighthouse numbers to `baseline/`."
   ],
   "checkpoint": {
    "title": "Checkpoint 12",
    "line": 1065,
    "items": [
     "All 20 success criteria pass with evidence, the production build, typecheck, lint, targeted unit and e2e suites are green, Lighthouse meets the budgets, and the diff audit is clean."
    ]
   },
   "tasks": [
    {
     "id": "T12.1",
     "title": "Gate: greps, typecheck, lint, unit and build",
     "done": false,
     "kind": "gate",
     "depends": [
      "T3.9",
      "T4.8",
      "T5.3",
      "T6.3",
      "T8.9",
      "T9.9",
      "T10.10",
      "T11.5"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the single final `bun run verify` (lint, format, typecheck) and the greps from the SPEC success criteria; run vitest over every touched area; run the production build once. Fix real failures at the cause; do not weaken tests.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`bun run verify` and `bun run build` are green (SPEC Global).",
      "`grep -rn \"ComparisonStatStrip\\|speedProof\\|6\\.6 s\\|759 KB\" src`, `grep -rni \"measured\" src/components/landing src/app/compare`, `grep -r \"relayDemoEngine\\|ChangeCardMock\\|SidebarMock\" src` and `grep -ri \"legal review required\" src` are all empty (SPEC criteria 2, 5, 13).",
      "Banned-term grep over `seoPages.ts` returns nothing (SPEC criterion 12).",
      "Every touched vitest area is green; `git diff --stat -- src/stores/useHistoryStore.ts src/lib/backup src/components/settings/backup/useBackupExport.ts src/components/settings/backup/useBackupImport.ts` is empty (SPEC criteria 18, 20)."
     ],
     "verify": [
      "bun run verify",
      "bunx vitest run src/components/landing src/components/seo src/components/history src/components/import src/components/settings/backup src/components/legal src/app src/lib/constants.spec.ts src/stores/useHistoryStore.spec.ts src/i18n",
      "bun run build",
      "grep -rn \"ComparisonStatStrip\\|speedProof\\|6\\.6 s\\|759 KB\" src",
      "grep -ri \"legal review required\" src"
     ],
     "line": 999,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T12.2",
     "title": "Gate: targeted e2e on a production server",
     "done": false,
     "kind": "gate",
     "depends": [
      "T12.1"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run only the `landing-seo-polish` specs plus the existing history spec, against a fresh production build served by the harness (`E2E_SERVER=prod`), twice each. No full suite.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every `e2e/qa/landing-seo-polish/*.spec.ts` plus `e2e/history.spec.ts` passes 2 of 2 repeats with no console errors.",
      "Landing order, 11 SEO routes, hub, footer, history grouping and virtualization, dialogs and legal specs are all included (SPEC testing strategy)."
     ],
     "verify": [
      "E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish e2e/history.spec.ts --repeat-each=2"
     ],
     "line": 1011,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T12.3",
     "title": "Gate: Lighthouse versus baseline",
     "done": false,
     "kind": "gate",
     "depends": [
      "T12.2"
     ],
     "files": [
      "agent_docs/landing-seo-polish/final/home.json (new)",
      "agent_docs/landing-seo-polish/final/features.json (new)",
      "agent_docs/landing-seo-polish/final/summary.md (new)"
     ],
     "gherkin": null,
     "do": "Repeat the T0.1 procedure on the final production build (`E2E_DIST_DIR=.next-e2e`, `-p 3100`, mobile profile, `lighthouse-cli`) for `/` and `/features`, plus one feature page and one compare page; write `summary.md` comparing LCP, CLS, TBT and First Load JS to `baseline/`. Stop the :3100 server afterwards.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Mobile `/`: LCP <= 2.5 s, CLS < 0.1, TBT not worse than the baseline (SPEC criterion 6); lazy chunks for the video modal and any 3D load only on need.",
      "`summary.md` states pass or fail per metric; any miss is fixed or escalated to the owner, not waved through.",
      "The :3100 server is stopped."
     ],
     "verify": [
      "ls agent_docs/landing-seo-polish/final",
      "grep -n \"LCP\\|CLS\\|TBT\" agent_docs/landing-seo-polish/final/summary.md"
     ],
     "line": 1021,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T12.4",
     "title": "Walkthrough: success criteria end to end and 10-second hero test",
     "done": false,
     "kind": "walkthrough",
     "depends": [
      "T12.3"
     ],
     "files": [
      "e2e/qa/landing-seo-polish/walkthrough.spec.ts (new)",
      "agent_docs/qa/landing-seo-polish/01-hero-light-1280.png",
      "agent_docs/qa/landing-seo-polish/02-relay-section-dark-390.png",
      "agent_docs/qa/landing-seo-polish/03-feature-page-light.png",
      "agent_docs/qa/landing-seo-polish/04-history-grouped.png (new proof shots)"
     ],
     "gherkin": null,
     "do": "Write the combined walkthrough spec, one `test()` per user flow: landing order and Relay-first hero; Watch demo modal; command palette and Import and backup sections; one feature page and one compare page with JSON-LD; hub to page navigation; footer links; history day headers, group expand and restore; export backup dialog dangling-links message and import Replace text; privacy and terms. Capture the four proof screenshots with headless agent-browser seeded via `--init-script e2e/fixtures/qa-seed.init.js`, `AGENT_BROWSER_SESSION=requestly`, ending with `agent-browser close`. Then run the reviewer test: a fresh reviewer who has not seen the page opens `/` at 1280x800 and 390x844 and says what Requestr is within 10 seconds; record who and the answer in Log (SPEC criterion 3).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "All flows pass; screenshots captured and reviewed in light, dark, 375/390 px and 1280 px (SPEC testing strategy manual/visual).",
      "The reviewer states that an AI built into the app does API work within 10 s at both sizes, recorded in Log; if not, the hero copy task T4.1 is reopened.",
      "Reduced-motion, video-blocked and JS-disabled behaviours still hold (SPEC criteria 8, edge cases)."
     ],
     "verify": [
      "E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2",
      "plus T12.1 and T12.2 commands as evidence."
     ],
     "line": 1032,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T12.5",
     "title": "Gate: advisor audit of the full diff and copy-gate review",
     "done": false,
     "kind": "gate",
     "depends": [
      "T12.4"
     ],
     "files": [],
     "gherkin": null,
     "do": "Make the work durable (nothing uncommitted is lost; do not commit unless told), then have the advisor audit the full diff against SPEC acceptance criteria 1-20; also review the Log fields of every copy task (T1.1, T3.1, T4.1, T4.5, T5.1, T6.1, T7.1, T7.3 to T7.5, T8.1 to T8.4, T9.2, T9.5, T10.1 to T10.4, T11.2, T11.3) to confirm each has recorded `copywriting`, `copy-editing` and `humanizer` passes. Resolve or report every issue raised.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every advisor issue is resolved or reported to the owner (SPEC Boundaries \"Always\").",
      "Every copy-task Log field names the three passes (SPEC criterion 12).",
      "No dependency was added, no store, serializer, parser or hook changed, no secret committed (SPEC Boundaries \"Never\")."
     ],
     "verify": [
      "git diff --stat -- package.json bun.lock",
      "git diff --stat -- src/stores/useHistoryStore.ts src/lib/backup",
      "grep -rn \"DEEPSEEK_API_KEY=\\|XAI_API_KEY=\\|RELAY_API_KEY=\" . --include=\"*.ts\" --include=\"*.md\" --include=\"*.json\" -l --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.next-e2e",
      "E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2"
     ],
     "line": 1044,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T12.6",
     "title": "DoD: success criteria checklist and implementation summary",
     "done": false,
     "kind": "dod",
     "depends": [
      "T12.5"
     ],
     "files": [
      "agent_docs/landing-seo-polish/final/summary.md"
     ],
     "gherkin": null,
     "do": "Add a \"Success criteria\" section to `final/summary.md` with one line per SPEC success criterion 1-20, each formatted `Criterion N: PASS - <evidence command or spec name>`, plus `Global: PASS - <evidence>`; add an \"Owner actions\" section with \"set `NEXT_PUBLIC_SITE_URL` or change the `SITE_URL` default to `https://requestr.app` once that domain is live\" and \"set the legal effective date at publish\". Legal-only items stay in `LEGAL_REVIEW_NOTES.md`. Then produce the \"Implementation Summary\" with Verification Steps in the format required by CLAUDE.md.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "All 20 criteria and Global are listed as PASS with evidence; none says FAIL or is missing; the domain-flip and effective-date notes exist.",
      "The summary lists the browser verification steps for every workstream A-F."
     ],
     "verify": [
      "`grep -c \"^Criterion [0-9]*: PASS\" agent_docs/landing-seo-polish/final/summary.md` prints 20",
      "grep -n \"^Global: PASS\" agent_docs/landing-seo-polish/final/summary.md",
      "grep -n \"requestr.app\\|effective date\" agent_docs/landing-seo-polish/final/summary.md",
      "`E2E_SERVER=prod bunx playwright test e2e/qa/landing-seo-polish/walkthrough.spec.ts --repeat-each=2` green",
      "T12.1 commands green."
     ],
     "line": 1055,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 6,
   "complete": false
  }
 ],
 "current": null,
 "nextCommand": "/build-phases agent_docs/landing-seo-polish/TASKS.md phase 10",
 "questions": [
  {
   "at": "2026-11-09T11:50:56.849Z",
   "type": "question",
   "tasks": [
    "T0.1",
    "T0.2"
   ],
   "id": "Q1",
   "text": "Verifier reported PASS for both, but first report lacked a PASSED heading so dashboard recorded unparseable-report inconclusive; fixed report format but plan now returns ASK (repeat-inconclusive). How to proceed?",
   "answer": "Accept verifier PASS, mark done",
   "answeredAt": "2026-11-09T11:51:46.968Z"
  },
  {
   "at": "2026-11-09T14:14:10.888Z",
   "type": "question",
   "tasks": [
    "T3.2"
   ],
   "id": "Q2",
   "text": "dashboard preflight crashes (ENOENT) on Files entries deliberately deleted by T3.2/T3.5/T3.6; cannot gate or verify phase 3",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-09T15:41:33.236Z",
   "type": "question",
   "tasks": [
    "T4.6",
    "T4.7",
    "T4.8"
   ],
   "id": "Q3",
   "text": "Preflight stray failures are caused by TASKS.md Files lines: T4.6/T4.7 list source files, not the new specs (BlurHeadline.spec.tsx, RelaySection.spec.tsx); T4.8 lists site-plumbing.spec.ts and agent_docs/qa/site-plumbing/*.png instead of relay-section.spec.ts and agent_docs/qa/relay-section/*.png. Approve correcting Files lines?",
   "answer": "Correct Files lines; leave old specs for later",
   "answeredAt": "2026-11-09T15:42:55.851Z"
  },
  {
   "at": "2026-11-11T13:02:45.629Z",
   "type": "question",
   "tasks": [
    "T6.1"
   ],
   "id": "Q4",
   "text": "T6.1 blocked: deps T10.9/T10.10 unbuilt, backup screenshots missing. Run phase 10 first?",
   "answer": "Skip backup part: build T6.1 with only import screenshots; add backup cards after phase 10",
   "answeredAt": "2026-11-11T13:03:56.119Z"
  },
  {
   "at": "2026-11-11T13:36:46.320Z",
   "type": "question",
   "tasks": [
    "T7.6",
    "T7.7"
   ],
   "id": "Q5",
   "text": "Files: lists in T7.6/T7.7 are wrong (spec files, feature-pages paths); plus FeatureMedia dark-twin priority bug",
   "answer": "Fix Files lists + bug",
   "answeredAt": "2026-11-11T13:37:47.243Z"
  },
  {
   "at": "2026-11-11T13:47:18.911Z",
   "type": "question",
   "tasks": [
    "T7.5"
   ],
   "id": "Q6",
   "text": "T7.5 backup page needs polished dialog screenshots from T10.10 (whole Phase 10, 0/10 done). Interim image rejected by verifier.",
   "answer": "Accept interim image; swap when T10.10 lands",
   "answeredAt": "2026-11-11T13:47:59.582Z"
  }
 ],
 "stuck": [],
 "commits": [
  {
   "at": "2026-11-11T15:58:14.101Z",
   "ok": true,
   "phase": "9",
   "tasks": [
    "T9.1",
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "attempt": "7",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 24/24 + 18/18 x3; unit 101 tests, lowest file 94.4% functions",
   "error": null,
   "sha": "04632385136d24e758b713b68104b7eb41e3752e",
   "shortSha": "0463238",
   "url": "https://github.com/deepakkumardewani/requestr/commit/04632385136d24e758b713b68104b7eb41e3752e",
   "subject": "feat(landing-seo-polish): phase 9 history sidebar grouping",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-11T21:28:04+05:30",
   "filesChanged": 47,
   "added": 2691,
   "removed": 69
  },
  {
   "at": "2026-11-11T14:51:58.814Z",
   "ok": true,
   "phase": "8",
   "tasks": [
    "T8.1",
    "T8.2",
    "T8.3",
    "T8.4",
    "T8.5",
    "T8.6",
    "T8.7",
    "T8.8",
    "T8.9"
   ],
   "attempt": "3",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 12/12, 21/21, prod 46/46; unit coverage 100%",
   "error": null,
   "sha": "945077c1b6222843d2abb93435bba7b799198c4c",
   "shortSha": "945077c",
   "url": "https://github.com/deepakkumardewani/requestr/commit/945077c1b6222843d2abb93435bba7b799198c4c",
   "subject": "feat(landing-seo-polish): phase 8 compare pages, hub redesign and footer",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-11T20:21:50+05:30",
   "filesChanged": 25,
   "added": 1390,
   "removed": 57
  },
  {
   "at": "2026-11-11T13:51:36.587Z",
   "ok": true,
   "phase": "7",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3",
    "T7.4",
    "T7.5",
    "T7.6",
    "T7.7"
   ],
   "attempt": "6",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 24/24 x3 (prod+dev), unit lowest 100% coverage",
   "error": null,
   "sha": "5013a51142f0737a28d66cebbbc41ff5acae23a3",
   "shortSha": "5013a51",
   "url": "https://github.com/deepakkumardewani/requestr/commit/5013a51142f0737a28d66cebbbc41ff5acae23a3",
   "subject": "feat(landing-seo-polish): phase 7 SEO page template and nine feature pages",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-11T19:21:28+05:30",
   "filesChanged": 25,
   "added": 805,
   "removed": 18
  },
  {
   "at": "2026-11-11T13:21:59.702Z",
   "ok": true,
   "phase": "6",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3"
   ],
   "attempt": "4",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 18/18, ImportSection unit coverage 100%",
   "error": null,
   "sha": "04072846b2f942a697070228494e29609a1cd59b",
   "shortSha": "0407284",
   "url": "https://github.com/deepakkumardewani/requestr/commit/04072846b2f942a697070228494e29609a1cd59b",
   "subject": "feat(landing-seo-polish): phase 6 import and backup section",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-11T18:51:52+05:30",
   "filesChanged": 31,
   "added": 1544,
   "removed": 599
  },
  {
   "at": "2026-11-09T16:01:37.418Z",
   "ok": true,
   "phase": "5",
   "tasks": [
    "T5.1",
    "T5.2",
    "T5.3"
   ],
   "attempt": "1",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 18/18, unit coverage 100%",
   "error": null,
   "sha": "6bdc7d6fb8d6ff617a8c1359c024f70ee0881b99",
   "shortSha": "6bdc7d6",
   "url": "https://github.com/deepakkumardewani/requestr/commit/6bdc7d6fb8d6ff617a8c1359c024f70ee0881b99",
   "subject": "feat(landing-seo-polish): phase 5 command palette section",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T21:31:28+05:30",
   "filesChanged": 11,
   "added": 290,
   "removed": 12
  },
  {
   "at": "2026-11-09T15:50:22.069Z",
   "ok": true,
   "phase": "4",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6",
    "T4.7",
    "T4.8"
   ],
   "attempt": "1",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 27/27, unit lowest 85.71% branches (DemoModal), 100% lines",
   "error": null,
   "sha": "0aaff4628f8ef114f00faa91c2c41250b6e80659",
   "shortSha": "0aaff46",
   "url": "https://github.com/deepakkumardewani/requestr/commit/0aaff4628f8ef114f00faa91c2c41250b6e80659",
   "subject": "feat(landing-seo-polish): phase 4 hero and relay section",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T21:20:13+05:30",
   "filesChanged": 25,
   "added": 1072,
   "removed": 90
  },
  {
   "at": "2026-11-09T14:41:53.363Z",
   "ok": true,
   "phase": "3",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9"
   ],
   "attempt": "4",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 15/15, unit 100% coverage",
   "error": null,
   "sha": "79da315a5f2a25530a2074c35fe74a72abdc8bf7",
   "shortSha": "79da315",
   "url": "https://github.com/deepakkumardewani/requestr/commit/79da315a5f2a25530a2074c35fe74a72abdc8bf7",
   "subject": "feat(landing-seo-polish): phase 3 landing restructure and comparison rewrite",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T20:11:44+05:30",
   "filesChanged": 27,
   "added": 312,
   "removed": 1418
  },
  {
   "at": "2026-11-09T14:04:06.206Z",
   "ok": true,
   "phase": "2",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "verify-assets 46/46 pass; site-plumbing 8/8",
   "error": null,
   "sha": "c938017882c5ac2dbcc0040ca16ada7fcebe3530",
   "shortSha": "c938017",
   "url": "https://github.com/deepakkumardewani/requestr/commit/c938017882c5ac2dbcc0040ca16ada7fcebe3530",
   "subject": "feat(landing-seo-polish): phase 2 capture pipeline (screenshots and Relay footage)",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T19:33:54+05:30",
   "filesChanged": 31,
   "added": 1043,
   "removed": 17
  },
  {
   "at": "2026-11-09T13:20:57.830Z",
   "ok": true,
   "phase": "1",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 12/12 x dev+prod, unit coverage 100%",
   "error": null,
   "sha": "1df67be89353bb623575b560af17c9c0de5dcffe",
   "shortSha": "1df67be",
   "url": "https://github.com/deepakkumardewani/requestr/commit/1df67be89353bb623575b560af17c9c0de5dcffe",
   "subject": "feat(landing-seo-polish): phase 1 foundations (SITE_URL and SEO data)",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T18:50:49+05:30",
   "filesChanged": 22,
   "added": 1465,
   "removed": 43
  },
  {
   "at": "2026-11-09T11:52:10.963Z",
   "ok": true,
   "phase": "0",
   "tasks": [
    "T0.1",
    "T0.2"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "no e2e/unit in phase 0",
   "error": null,
   "sha": "1bb6223fe7bce74d88976f675c192ca767955539",
   "shortSha": "1bb6223",
   "url": "https://github.com/deepakkumardewani/requestr/commit/1bb6223fe7bce74d88976f675c192ca767955539",
   "subject": "docs(landing-seo-polish): phase 0 baseline and Motionsites research",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-09T17:22:01+05:30",
   "filesChanged": 5,
   "added": 14657,
   "removed": 0
  }
 ],
 "shots": [
  {
   "taskId": "T1.1",
   "kind": "after",
   "step": "SharePreview mock domain uses SITE_URL host",
   "attempt": 1,
   "caption": "The Shareable links preview on the landing shows the SITE_URL host (requestr-api.vercel.app) instead of requestr.dev.",
   "annotations": [
    {
     "x": 53,
     "y": 45,
     "w": 37,
     "h": 3.6,
     "label": "Share link pill shows requestr-api.vercel.app/s/4f9...#key"
    }
   ],
   "at": "2026-11-09T12:36:51.330Z",
   "file": "1/T1.1-1.png",
   "phase": "1",
   "href": "shots/1/T1.1-1.png"
  },
  {
   "taskId": "T1.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing home page rendered, meta tags asserted",
   "annotations": [],
   "at": "2026-11-09T12:42:59.054Z",
   "file": "1/T1.8-1.png",
   "phase": "1",
   "href": "shots/1/T1.8-1.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "every screen has light and dark",
   "attempt": null,
   "caption": "Relay panel screenshot (dark) from seed data",
   "annotations": [
    {
     "x": 70,
     "y": 0,
     "w": 30,
     "h": 100,
     "label": "Relay dock"
    }
   ],
   "at": "2026-11-09T13:42:25.609Z",
   "file": "2/T2.1-1.png",
   "phase": "2",
   "href": "shots/2/T2.1-1.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "real app UI with seed data",
   "attempt": null,
   "caption": "Chains screenshot (light), DummyJSON seed only",
   "annotations": [
    {
     "x": 8,
     "y": 40,
     "w": 85,
     "h": 25,
     "label": "chain nodes"
    }
   ],
   "at": "2026-11-09T13:42:25.696Z",
   "file": "2/T2.1-2.png",
   "phase": "2",
   "href": "shots/2/T2.1-2.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "Every screenshot is real app UI with seed data",
   "attempt": 4,
   "caption": "Transform screenshot (light) filled: seed JSON in the editor and three product titles in the output, no JSONPath error.",
   "annotations": [
    {
     "x": 50,
     "y": 20,
     "w": 50,
     "h": 40,
     "label": "JSONPath output with the three seed titles"
    }
   ],
   "at": "2026-11-09T14:01:17.175Z",
   "file": "2/T2.1-3.png",
   "phase": "2",
   "href": "shots/2/T2.1-3.png"
  },
  {
   "taskId": "T2.1",
   "kind": "proof",
   "step": "Every screenshot is real app UI with seed data",
   "attempt": 4,
   "caption": "Transform screenshot (dark) filled: seed JSON in the editor and three product titles in the output, no JSONPath error.",
   "annotations": [
    {
     "x": 50,
     "y": 20,
     "w": 50,
     "h": 40,
     "label": "JSONPath output with the three seed titles"
    }
   ],
   "at": "2026-11-09T14:01:17.270Z",
   "file": "2/T2.1-4.png",
   "phase": "2",
   "href": "shots/2/T2.1-4.png"
  },
  {
   "taskId": "T2.2",
   "kind": "proof",
   "step": "all six steps from Relay actions",
   "attempt": null,
   "caption": "Final frame of the raw recording: Relay ran the chain, 6 passed",
   "annotations": [
    {
     "x": 0,
     "y": 40,
     "w": 65,
     "h": 15,
     "label": "chain nodes"
    },
    {
     "x": 70,
     "y": 10,
     "w": 30,
     "h": 55,
     "label": "Relay result table"
    }
   ],
   "at": "2026-11-09T13:42:25.774Z",
   "file": "2/T2.2-1.png",
   "phase": "2",
   "href": "shots/2/T2.2-1.png"
  },
  {
   "taskId": "T2.3",
   "kind": "proof",
   "step": "Full cut is captioned and every sped-up span carries the marker",
   "attempt": null,
   "caption": "Full cut frame with the SPED UP 4x marker and caption over the real Relay session.",
   "annotations": [
    {
     "x": 26,
     "y": 9,
     "w": 15,
     "h": 5,
     "label": "SPED UP 4x marker"
    },
    {
     "x": 5,
     "y": 77,
     "w": 50,
     "h": 9,
     "label": "Caption"
    }
   ],
   "at": "2026-11-09T13:50:06.055Z",
   "file": "2/T2.3-1.png",
   "phase": "2",
   "href": "shots/2/T2.3-1.png"
  },
  {
   "taskId": "T2.4",
   "kind": "proof",
   "step": "No jump at the loop point",
   "attempt": null,
   "caption": "Last frame of the loop: matches the first frame (typed assertion prompt, chain not yet run), so the loop point has no jump.",
   "annotations": [
    {
     "x": 0,
     "y": 0,
     "w": 100,
     "h": 100,
     "label": "Loop last frame"
    }
   ],
   "at": "2026-11-09T13:50:06.143Z",
   "file": "2/T2.4-1.png",
   "phase": "2",
   "href": "shots/2/T2.4-1.png"
  },
  {
   "taskId": "T2.4",
   "kind": "proof",
   "step": "First vs last frame",
   "attempt": null,
   "caption": "First frame of the loop, for comparison (SSIM 0.984 against the last frame).",
   "annotations": [
    {
     "x": 0,
     "y": 0,
     "w": 100,
     "h": 100,
     "label": "Loop first frame"
    }
   ],
   "at": "2026-11-09T13:50:06.221Z",
   "file": "2/T2.4-2.png",
   "phase": "2",
   "href": "shots/2/T2.4-2.png"
  },
  {
   "taskId": "T3.3",
   "kind": "proof",
   "step": "RelaySection renders the real poster, no mock demo",
   "attempt": 2,
   "caption": "Relay section shows the static poster image (relay-poster.webp via next/image) with no scripted demo or controls.",
   "annotations": [
    {
     "x": 15.1,
     "y": 27.4,
     "w": 69.8,
     "h": 72.6,
     "label": "Static Relay poster"
    }
   ],
   "at": "2026-11-09T14:33:27.376Z",
   "file": "3/T3.3-1.png",
   "phase": "3",
   "href": "shots/3/T3.3-1.png"
  },
  {
   "taskId": "T3.7",
   "kind": "proof",
   "step": "Command palette section placed after FeatureShowcase and before BeyondSend",
   "attempt": 2,
   "caption": "Command palette stub heading sits between Features and Beyond send.",
   "annotations": [
    {
     "x": 0,
     "y": 36.7,
     "w": 100,
     "h": 40.4,
     "label": "Command palette stub section"
    }
   ],
   "at": "2026-11-09T14:33:27.477Z",
   "file": "3/T3.7-1.png",
   "phase": "3",
   "href": "shots/3/T3.7-1.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing at 1280 px, section order verified",
   "annotations": [],
   "at": "2026-11-09T14:28:32.848Z",
   "file": "3/T3.9-1.png",
   "phase": "3",
   "href": "shots/3/T3.9-1.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing at 390 px, section order verified",
   "annotations": [],
   "at": "2026-11-09T14:28:32.986Z",
   "file": "3/T3.9-2.png",
   "phase": "3",
   "href": "shots/3/T3.9-2.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Time to first request row: three ranges, no stopwatch",
   "annotations": [],
   "at": "2026-11-09T14:28:33.094Z",
   "file": "3/T3.9-3.png",
   "phase": "3",
   "href": "shots/3/T3.9-3.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Nav Compare anchor scrolled to comparison section",
   "annotations": [],
   "at": "2026-11-09T14:28:33.242Z",
   "file": "3/T3.9-4.png",
   "phase": "3",
   "href": "shots/3/T3.9-4.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": "Section order under main matches SPEC criterion 1; no stat strip",
   "attempt": 2,
   "caption": "Full landing page at 1280 px: Hero, Relay, How it works, Features, Command palette, Beyond send, Import, Compare, Final CTA, with no stat strip between Import and Compare.",
   "annotations": [
    {
     "x": 0,
     "y": 0,
     "w": 100,
     "h": 8.7,
     "label": "1 Hero"
    },
    {
     "x": 0,
     "y": 8.7,
     "w": 100,
     "h": 12.1,
     "label": "2 Relay"
    },
    {
     "x": 0,
     "y": 20.8,
     "w": 100,
     "h": 6.2,
     "label": "3 How it works"
    },
    {
     "x": 0,
     "y": 27,
     "w": 100,
     "h": 11.4,
     "label": "4 Features"
    },
    {
     "x": 0,
     "y": 38.4,
     "w": 100,
     "h": 2.9,
     "label": "5 Command palette"
    },
    {
     "x": 0,
     "y": 41.3,
     "w": 100,
     "h": 17.9,
     "label": "6 Beyond send"
    },
    {
     "x": 0,
     "y": 59.2,
     "w": 100,
     "h": 5.3,
     "label": "7 Import"
    },
    {
     "x": 0,
     "y": 64.4,
     "w": 100,
     "h": 26,
     "label": "8 Comparison"
    },
    {
     "x": 0,
     "y": 90.5,
     "w": 100,
     "h": 5.9,
     "label": "9 Final CTA"
    }
   ],
   "at": "2026-11-09T14:33:27.152Z",
   "file": "3/T3.9-5.png",
   "phase": "3",
   "href": "shots/3/T3.9-5.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": "Comparison Time to first request row shows the three ranges, no stopwatch",
   "attempt": 2,
   "caption": "Time to first request row shows About 10-15 s, About 2-4 min and About 2-3 min with one-line bases and no stopwatch or measured wording.",
   "annotations": [
    {
     "x": 7.6,
     "y": 34.4,
     "w": 84.8,
     "h": 23,
     "label": "Time to first request row with the three estimate ranges"
    }
   ],
   "at": "2026-11-09T14:33:27.277Z",
   "file": "3/T3.9-6.png",
   "phase": "3",
   "href": "shots/3/T3.9-6.png"
  },
  {
   "taskId": "T4.1",
   "kind": "after",
   "step": "Hero states an AI built into the app does API work",
   "attempt": null,
   "caption": "Hero leads with AI that does your API work and says Relay is built in.",
   "annotations": [
    {
     "x": 7,
     "y": 28,
     "w": 40,
     "h": 28,
     "label": "headline and sub-line"
    }
   ],
   "at": "2026-11-09T15:35:24.201Z",
   "file": "4/T4.1-1.png",
   "phase": "4",
   "href": "shots/4/T4.1-1.png"
  },
  {
   "taskId": "T4.1",
   "kind": "after",
   "step": "Above the fold at 390x844 the hero states an AI built into the app does API work",
   "attempt": 1,
   "caption": "At 390x844 the hero headline, the built-into-the-app sub-line and Watch the demo are all above the fold.",
   "annotations": [
    {
     "x": 4,
     "y": 12,
     "w": 64,
     "h": 10,
     "label": "headline AI that does your API work"
    },
    {
     "x": 4,
     "y": 23,
     "w": 92,
     "h": 13,
     "label": "sub-line Relay is built into the app"
    },
    {
     "x": 46,
     "y": 40,
     "w": 40,
     "h": 4,
     "label": "Watch the demo CTA"
    }
   ],
   "at": "2026-11-09T15:47:27.054Z",
   "file": "4/T4.1-2.png",
   "phase": "4",
   "href": "shots/4/T4.1-2.png"
  },
  {
   "taskId": "T4.5",
   "kind": "after",
   "step": "Real loop and play affordance",
   "attempt": null,
   "caption": "Relay section: blur headline, real loop with play affordance.",
   "annotations": [
    {
     "x": 30,
     "y": 5,
     "w": 40,
     "h": 18,
     "label": "headline;15,52,70,48:loop with play"
    }
   ],
   "at": "2026-11-09T15:35:24.304Z",
   "file": "4/T4.5-1.png",
   "phase": "4",
   "href": "shots/4/T4.5-1.png"
  },
  {
   "taskId": "T4.5",
   "kind": "after",
   "step": "Modal needs explicit Play",
   "attempt": null,
   "caption": "Watch demo opens the full cut with an explicit Play button.",
   "annotations": [
    {
     "x": 47,
     "y": 51,
     "w": 10,
     "h": 6,
     "label": "Play button"
    }
   ],
   "at": "2026-11-09T15:35:24.412Z",
   "file": "4/T4.5-2.png",
   "phase": "4",
   "href": "shots/4/T4.5-2.png"
  },
  {
   "taskId": "T4.5",
   "kind": "after",
   "step": "Real loop and play affordance (verifier retake with separate boxes)",
   "attempt": 1,
   "caption": "Relay section at 390 px after the reveal: blur headline fully sharp, real loop with play affordance, Watch the demo button.",
   "annotations": [
    {
     "x": 7,
     "y": 21,
     "w": 86,
     "h": 10,
     "label": "BlurHeadline revealed"
    },
    {
     "x": 4,
     "y": 48,
     "w": 92,
     "h": 27,
     "label": "real loop with play affordance"
    },
    {
     "x": 31,
     "y": 74,
     "w": 38,
     "h": 5,
     "label": "Watch the demo opens the modal"
    }
   ],
   "at": "2026-11-09T15:47:27.202Z",
   "file": "4/T4.5-3.png",
   "phase": "4",
   "href": "shots/4/T4.5-3.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay loop playing",
   "annotations": [],
   "at": "2026-11-09T15:41:08.305Z",
   "file": "4/T4.8-1.png",
   "phase": "4",
   "href": "shots/4/T4.8-1.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Demo modal open, Play not yet clicked",
   "annotations": [],
   "at": "2026-11-09T15:41:08.466Z",
   "file": "4/T4.8-2.png",
   "phase": "4",
   "href": "shots/4/T4.8-2.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Full cut playing after Play",
   "annotations": [],
   "at": "2026-11-09T15:41:08.587Z",
   "file": "4/T4.8-3.png",
   "phase": "4",
   "href": "shots/4/T4.8-3.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Loop blocked, poster stays",
   "annotations": [],
   "at": "2026-11-09T15:41:08.720Z",
   "file": "4/T4.8-4.png",
   "phase": "4",
   "href": "shots/4/T4.8-4.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion: static headline and poster",
   "annotations": [],
   "at": "2026-11-09T15:41:08.845Z",
   "file": "4/T4.8-5.png",
   "phase": "4",
   "href": "shots/4/T4.8-5.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "390px dark above the fold",
   "annotations": [],
   "at": "2026-11-09T15:41:08.966Z",
   "file": "4/T4.8-6.png",
   "phase": "4",
   "href": "shots/4/T4.8-6.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280px light above the fold",
   "annotations": [],
   "at": "2026-11-09T15:41:09.087Z",
   "file": "4/T4.8-7.png",
   "phase": "4",
   "href": "shots/4/T4.8-7.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Modal and full cut loaded after open",
   "annotations": [],
   "at": "2026-11-09T15:41:09.215Z",
   "file": "4/T4.8-8.png",
   "phase": "4",
   "href": "shots/4/T4.8-8.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": "1280 px light: no horizontal scroll, headline and CTA above the fold",
   "attempt": 1,
   "caption": "1280x800 light theme: hero headline and Watch the demo CTA above the fold, no horizontal scroll (scrollWidth-clientWidth = 0).",
   "annotations": [
    {
     "x": 7,
     "y": 29,
     "w": 32,
     "h": 16,
     "label": "h1 headline"
    },
    {
     "x": 20,
     "y": 63,
     "w": 12,
     "h": 4,
     "label": "Watch the demo CTA"
    }
   ],
   "at": "2026-11-09T15:49:25.010Z",
   "file": "4/T4.8-9.png",
   "phase": "4",
   "href": "shots/4/T4.8-9.png"
  },
  {
   "taskId": "T4.8",
   "kind": "proof",
   "step": "390 px dark: no horizontal scroll, headline and CTA above the fold",
   "attempt": 1,
   "caption": "390x844 dark theme: hero headline and Watch the demo CTA above the fold, no horizontal scroll (scrollWidth-clientWidth = 0).",
   "annotations": [
    {
     "x": 4,
     "y": 12,
     "w": 64,
     "h": 10,
     "label": "h1 headline"
    },
    {
     "x": 46,
     "y": 40,
     "w": 39,
     "h": 4,
     "label": "Watch the demo CTA"
    }
   ],
   "at": "2026-11-09T15:49:25.152Z",
   "file": "4/T4.8-10.png",
   "phase": "4",
   "href": "shots/4/T4.8-10.png"
  },
  {
   "taskId": "T5.1",
   "kind": "after",
   "step": "Section renders with real screenshot",
   "attempt": null,
   "caption": "Command palette section with heading, lede and themed screenshot (dark theme, 1440 wide).",
   "annotations": [
    {
     "x": 10,
     "y": 10,
     "w": 80,
     "h": 80,
     "label": "themed screenshot with explicit 1440x900 size"
    }
   ],
   "at": "2026-11-09T15:54:40.257Z",
   "file": "5/T5.1-1.png",
   "phase": "5",
   "href": "shots/5/T5.1-1.png"
  },
  {
   "taskId": "T5.1",
   "kind": "after",
   "step": "Section renders with real screenshot, alt text and shared constants",
   "attempt": 3,
   "caption": "Command palette section in dark theme at 1280 px: eyebrow, heading, lede and the dark palette screenshot.",
   "annotations": [
    {
     "x": 23.8,
     "y": 21.1,
     "w": 52.5,
     "h": 5,
     "label": "section heading"
    },
    {
     "x": 7.6,
     "y": 39.3,
     "w": 84.8,
     "h": 60.8,
     "label": "dark-theme palette screenshot (1440x900 next/image)"
    }
   ],
   "at": "2026-11-09T16:00:27.231Z",
   "file": "5/T5.1-2.png",
   "phase": "5",
   "href": "shots/5/T5.1-2.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Command palette section between Features and Beyond Send, 1280 light",
   "annotations": [],
   "at": "2026-11-09T15:56:21.688Z",
   "file": "5/T5.3-1.png",
   "phase": "5",
   "href": "shots/5/T5.3-1.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "390 px light",
   "annotations": [],
   "at": "2026-11-09T15:56:21.836Z",
   "file": "5/T5.3-2.png",
   "phase": "5",
   "href": "shots/5/T5.3-2.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "390 px dark",
   "annotations": [],
   "at": "2026-11-09T15:56:21.952Z",
   "file": "5/T5.3-3.png",
   "phase": "5",
   "href": "shots/5/T5.3-3.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280 px light",
   "annotations": [],
   "at": "2026-11-09T15:56:22.068Z",
   "file": "5/T5.3-4.png",
   "phase": "5",
   "href": "shots/5/T5.3-4.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280 px dark",
   "annotations": [],
   "at": "2026-11-09T15:56:22.185Z",
   "file": "5/T5.3-5.png",
   "phase": "5",
   "href": "shots/5/T5.3-5.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Top nav with no command palette link",
   "annotations": [],
   "at": "2026-11-09T15:56:22.303Z",
   "file": "5/T5.3-6.png",
   "phase": "5",
   "href": "shots/5/T5.3-6.png"
  },
  {
   "taskId": "T5.3",
   "kind": "proof",
   "step": "1280 px light: image visible, no overflow",
   "attempt": 3,
   "caption": "Light theme at 1280 px: the section loads the light palette screenshot (replaces the mis-captioned dark shot T5.3-1).",
   "annotations": [
    {
     "x": 7.6,
     "y": 39.3,
     "w": 84.8,
     "h": 60.8,
     "label": "light-theme palette screenshot loaded"
    }
   ],
   "at": "2026-11-09T16:00:27.385Z",
   "file": "5/T5.3-7.png",
   "phase": "5",
   "href": "shots/5/T5.3-7.png"
  },
  {
   "taskId": "T6.1",
   "kind": "proof",
   "step": "Two groups with real screenshots",
   "attempt": null,
   "caption": "Import and backup section renders the Import group with the real import dialog screenshot (dark theme, 1440 wide).",
   "annotations": [
    {
     "x": 8,
     "y": 50,
     "w": 85,
     "h": 50,
     "label": "Import group with screenshot"
    }
   ],
   "at": "2026-11-11T13:04:48.031Z",
   "file": "6/T6.1-1.png",
   "phase": "6",
   "href": "shots/6/T6.1-1.png"
  },
  {
   "taskId": "T6.1",
   "kind": "proof",
   "step": "Two clearly delineated groups (Import with real screenshot, Backup text-only until T10.10)",
   "attempt": 1,
   "caption": "Verifier retake, light 1280 px: Import and backup section with the Import group (format chips, /import page screenshot) and the text-only Backup group (Export, Restore).",
   "annotations": [
    {
     "x": 7.5,
     "y": 32.9,
     "w": 85,
     "h": 37.6,
     "label": "Import group with screenshot"
    },
    {
     "x": 7.5,
     "y": 73.7,
     "w": 85,
     "h": 26,
     "label": "Backup group, Export and Restore"
    }
   ],
   "at": "2026-11-11T13:10:28.711Z",
   "file": "6/T6.1-2.png",
   "phase": "6",
   "href": "shots/6/T6.1-2.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import and backup section sits between Beyond Send and the comparison table",
   "annotations": [],
   "at": "2026-11-11T13:07:01.307Z",
   "file": "6/T6.3-1.png",
   "phase": "6",
   "href": "shots/6/T6.3-1.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import and Backup groups visible with the Import screenshot loaded",
   "annotations": [],
   "at": "2026-11-11T13:07:01.482Z",
   "file": "6/T6.3-2.png",
   "phase": "6",
   "href": "shots/6/T6.3-2.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import section at 390 px dark with no horizontal overflow",
   "annotations": [],
   "at": "2026-11-11T13:07:01.610Z",
   "file": "6/T6.3-3.png",
   "phase": "6",
   "href": "shots/6/T6.3-3.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "Section order: BeyondSend then Import and backup",
   "attempt": 1,
   "caption": "Verifier retake: the BeyondSend section ends directly above the Import and backup section.",
   "annotations": [
    {
     "x": 0,
     "y": 5.2,
     "w": 100,
     "h": 39.8,
     "label": "End of BeyondSend section"
    },
    {
     "x": 0,
     "y": 45,
     "w": 100,
     "h": 55,
     "label": "Import and backup section"
    }
   ],
   "at": "2026-11-11T13:10:28.881Z",
   "file": "6/T6.3-4.png",
   "phase": "6",
   "href": "shots/6/T6.3-4.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "Two groups visible, screenshot loaded",
   "attempt": 1,
   "caption": "Verifier retake: both groups fully visible at 1280 px light, Import screenshot loaded.",
   "annotations": [
    {
     "x": 7.5,
     "y": 32.9,
     "w": 85,
     "h": 37.6,
     "label": "Import group"
    },
    {
     "x": 7.5,
     "y": 73.7,
     "w": 85,
     "h": 26,
     "label": "Backup group"
    }
   ],
   "at": "2026-11-11T13:10:29.013Z",
   "file": "6/T6.3-5.png",
   "phase": "6",
   "href": "shots/6/T6.3-5.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": "390 px dark, no horizontal overflow",
   "attempt": 1,
   "caption": "Verifier retake: 390 px dark, dark-theme import screenshot shown, scrollWidth minus clientWidth = 0.",
   "annotations": [
    {
     "x": 4.1,
     "y": 5.5,
     "w": 91.8,
     "h": 59.1,
     "label": "Import group fits the viewport"
    },
    {
     "x": 10.8,
     "y": 38.9,
     "w": 78.5,
     "h": 22.6,
     "label": "Dark import screenshot"
    }
   ],
   "at": "2026-11-11T13:10:29.143Z",
   "file": "6/T6.3-6.png",
   "phase": "6",
   "href": "shots/6/T6.3-6.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import and backup section between BeyondSend and Compare",
   "annotations": [],
   "at": "2026-11-11T13:14:42.620Z",
   "file": "6/T6.3-7.png",
   "phase": "6",
   "href": "shots/6/T6.3-7.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import and Backup groups, fade-in finished",
   "annotations": [],
   "at": "2026-11-11T13:14:42.758Z",
   "file": "6/T6.3-8.png",
   "phase": "6",
   "href": "shots/6/T6.3-8.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Section at 390px light",
   "annotations": [],
   "at": "2026-11-11T13:14:42.900Z",
   "file": "6/T6.3-9.png",
   "phase": "6",
   "href": "shots/6/T6.3-9.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Section at 390px dark",
   "annotations": [],
   "at": "2026-11-11T13:14:43.046Z",
   "file": "6/T6.3-10.png",
   "phase": "6",
   "href": "shots/6/T6.3-10.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Section at 1280px light",
   "annotations": [],
   "at": "2026-11-11T13:14:43.186Z",
   "file": "6/T6.3-11.png",
   "phase": "6",
   "href": "shots/6/T6.3-11.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Section at 1280px dark",
   "annotations": [],
   "at": "2026-11-11T13:14:43.320Z",
   "file": "6/T6.3-12.png",
   "phase": "6",
   "href": "shots/6/T6.3-12.png"
  },
  {
   "taskId": "T6.3",
   "kind": "proof",
   "step": null,
   "attempt": 4,
   "caption": "Verifier retake: Backup group fully faded in, Compare section starts directly below (main > section ids: ... beyond-send, import, compare)",
   "annotations": [],
   "at": "2026-11-11T13:21:21.951Z",
   "file": "6/T6.3-13.png",
   "phase": "6",
   "href": "shots/6/T6.3-13.png"
  },
  {
   "taskId": "T7.1",
   "kind": "proof",
   "step": "Renders a FeaturePage with H1, media, related links, hub link, CTA",
   "attempt": null,
   "caption": "Relay feature page: one heading, intro, CTA, screenshot, related links, back link.",
   "annotations": [
    {
     "x": 5,
     "y": 10,
     "w": 60,
     "h": 30,
     "label": "H1, intro and CTA"
    }
   ],
   "at": "2026-11-11T13:31:07.884Z",
   "file": "7/T7.1-1.png",
   "phase": "7",
   "href": "shots/7/T7.1-1.png"
  },
  {
   "taskId": "T7.1",
   "kind": "proof",
   "step": "Renders any FeaturePage with one H1, alt-texted media, related links, hub link, CTA",
   "attempt": 4,
   "caption": "Relay feature page (current copy and Relay poster): back link, one H1, intro, CTA, alt-texted media and related links.",
   "annotations": [
    {
     "x": 12,
     "y": 5,
     "w": 6,
     "h": 1.6,
     "label": "Back link to /features"
    },
    {
     "x": 12,
     "y": 9.6,
     "w": 54,
     "h": 5.3,
     "label": "Single H1"
    },
    {
     "x": 12,
     "y": 20.2,
     "w": 10,
     "h": 2.4,
     "label": "CTA to the tool route"
    },
    {
     "x": 12,
     "y": 24.6,
     "w": 76,
     "h": 37.2,
     "label": "Media with alt text"
    },
    {
     "x": 12,
     "y": 73.9,
     "w": 76,
     "h": 6.5,
     "label": "Related feature links"
    }
   ],
   "at": "2026-11-11T13:43:15.810Z",
   "file": "7/T7.1-2.png",
   "phase": "7",
   "href": "shots/7/T7.1-2.png"
  },
  {
   "taskId": "T7.1",
   "kind": "after",
   "step": "Related-feature links",
   "attempt": null,
   "caption": "Related-features heading after the copy-gate relabel, with links to sibling feature pages.",
   "annotations": [
    {
     "x": 12.2,
     "y": 47.1,
     "w": 75.6,
     "h": 4.4,
     "label": "Related features heading and links"
    }
   ],
   "at": "2026-11-11T13:47:04.833Z",
   "file": "7/T7.1-3.png",
   "phase": "7",
   "href": "shots/7/T7.1-3.png"
  },
  {
   "taskId": "T7.2",
   "kind": "proof",
   "step": "Unknown slug returns 404",
   "attempt": null,
   "caption": "Unknown slug returns the 404 page.",
   "annotations": [
    {
     "x": 30,
     "y": 40,
     "w": 40,
     "h": 20,
     "label": "404 message"
    }
   ],
   "at": "2026-11-11T13:31:08.083Z",
   "file": "7/T7.2-1.png",
   "phase": "7",
   "href": "shots/7/T7.2-1.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Last feature page with metadata asserted",
   "annotations": [],
   "at": "2026-11-11T13:36:18.074Z",
   "file": "7/T7.7-1.png",
   "phase": "7",
   "href": "shots/7/T7.7-1.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay feature page",
   "annotations": [],
   "at": "2026-11-11T13:36:18.275Z",
   "file": "7/T7.7-2.png",
   "phase": "7",
   "href": "shots/7/T7.7-2.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "JSON compare feature page",
   "annotations": [],
   "at": "2026-11-11T13:36:18.436Z",
   "file": "7/T7.7-3.png",
   "phase": "7",
   "href": "shots/7/T7.7-3.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Feature page with JavaScript disabled",
   "annotations": [],
   "at": "2026-11-11T13:36:18.584Z",
   "file": "7/T7.7-4.png",
   "phase": "7",
   "href": "shots/7/T7.7-4.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "375 px light, no horizontal scroll",
   "annotations": [],
   "at": "2026-11-11T13:36:18.726Z",
   "file": "7/T7.7-5.png",
   "phase": "7",
   "href": "shots/7/T7.7-5.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280 px light, no horizontal scroll",
   "annotations": [],
   "at": "2026-11-11T13:36:18.887Z",
   "file": "7/T7.7-6.png",
   "phase": "7",
   "href": "shots/7/T7.7-6.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Feature pages 05-375-dark no horizontal scroll",
   "annotations": [],
   "at": "2026-11-11T13:39:49.484Z",
   "file": "7/T7.7-7.png",
   "phase": "7",
   "href": "shots/7/T7.7-7.png"
  },
  {
   "taskId": "T7.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Feature pages 05-1280-dark no horizontal scroll",
   "annotations": [],
   "at": "2026-11-11T13:39:49.690Z",
   "file": "7/T7.7-8.png",
   "phase": "7",
   "href": "shots/7/T7.7-8.png"
  },
  {
   "taskId": "T8.1",
   "kind": "after",
   "step": "Compare page content",
   "attempt": null,
   "caption": "Compare page lists each claim with a source link and a section on where Postman is stronger.",
   "annotations": [
    {
     "x": 5,
     "y": 5,
     "w": 60,
     "h": 10,
     "label": "single h1"
    }
   ],
   "at": "2026-11-11T14:30:02.621Z",
   "file": "8/T8.1-1.png",
   "phase": "8",
   "href": "shots/8/T8.1-1.png"
  },
  {
   "taskId": "T8.3",
   "kind": "after",
   "step": "Hub links to flagship pages and both compare pages",
   "attempt": null,
   "caption": "Hub groups every feature by category; linked cards show Learn more and a Compare section links both compare pages.",
   "annotations": [
    {
     "x": 7,
     "y": 8,
     "w": 25,
     "h": 5,
     "label": "Relay flagship card links to its page"
    },
    {
     "x": 7,
     "y": 82,
     "w": 86,
     "h": 3,
     "label": "Compare section links Postman and Insomnia"
    }
   ],
   "at": "2026-11-11T14:30:02.268Z",
   "file": "8/T8.3-1.png",
   "phase": "8",
   "href": "shots/8/T8.3-1.png"
  },
  {
   "taskId": "T8.4",
   "kind": "after",
   "step": "Footer columns",
   "attempt": null,
   "caption": "Footer shows Features and Compare columns with real routes.",
   "annotations": [
    {
     "x": 30,
     "y": 88,
     "w": 55,
     "h": 10,
     "label": "Features and Compare columns"
    }
   ],
   "at": "2026-11-11T14:30:02.456Z",
   "file": "8/T8.4-1.png",
   "phase": "8",
   "href": "shots/8/T8.4-1.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Compare page metadata check",
   "annotations": [],
   "at": "2026-11-11T14:33:12.055Z",
   "file": "8/T8.7-1.png",
   "phase": "8",
   "href": "shots/8/T8.7-1.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Postman compare, stronger section",
   "annotations": [],
   "at": "2026-11-11T14:33:12.281Z",
   "file": "8/T8.7-2.png",
   "phase": "8",
   "href": "shots/8/T8.7-2.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Insomnia compare, stronger section",
   "annotations": [],
   "at": "2026-11-11T14:33:12.444Z",
   "file": "8/T8.7-3.png",
   "phase": "8",
   "href": "shots/8/T8.7-3.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "375px light, no scroll",
   "annotations": [],
   "at": "2026-11-11T14:33:12.606Z",
   "file": "8/T8.7-4.png",
   "phase": "8",
   "href": "shots/8/T8.7-4.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "375px dark, no scroll",
   "annotations": [],
   "at": "2026-11-11T14:33:12.768Z",
   "file": "8/T8.7-5.png",
   "phase": "8",
   "href": "shots/8/T8.7-5.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280px light, no scroll",
   "annotations": [],
   "at": "2026-11-11T14:33:12.938Z",
   "file": "8/T8.7-6.png",
   "phase": "8",
   "href": "shots/8/T8.7-6.png"
  },
  {
   "taskId": "T8.7",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "1280px dark, no scroll",
   "annotations": [],
   "at": "2026-11-11T14:33:13.103Z",
   "file": "8/T8.7-7.png",
   "phase": "8",
   "href": "shots/8/T8.7-7.png"
  },
  {
   "taskId": "T8.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "/features hub linking all 11 SEO pages",
   "annotations": [],
   "at": "2026-11-11T14:34:06.434Z",
   "file": "8/T8.8-1.png",
   "phase": "8",
   "href": "shots/8/T8.8-1.png"
  },
  {
   "taskId": "T8.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Landing footer with Features and Compare columns",
   "annotations": [],
   "at": "2026-11-11T14:34:06.655Z",
   "file": "8/T8.8-2.png",
   "phase": "8",
   "href": "shots/8/T8.8-2.png"
  },
  {
   "taskId": "T8.8",
   "kind": "proof",
   "step": "features hub links to all 9 feature pages and both compare pages",
   "attempt": 3,
   "caption": "/features hub after reveal animation: category sections with feature cards, each with a Learn more link to its SEO page",
   "annotations": [
    {
     "x": 2.5,
     "y": 13.9,
     "w": 30.4,
     "h": 16.1,
     "label": "Relay card with Learn more link to /features/relay"
    }
   ],
   "at": "2026-11-11T14:51:05.658Z",
   "file": "8/T8.8-3.png",
   "phase": "8",
   "href": "shots/8/T8.8-3.png"
  },
  {
   "taskId": "T9.2",
   "kind": "after",
   "step": "Clicking a run restores that run's request",
   "attempt": 6,
   "caption": "Clicking the oldest and then the latest run of the GET /orders x 3 group opens two separate tabs, Orders run 1 and Orders run 3, each with its own request.",
   "annotations": [
    {
     "x": 0.3,
     "y": 51,
     "w": 19.3,
     "h": 15.5,
     "label": "Expanded x 3 group with its runs"
    },
    {
     "x": 20.1,
     "y": 3.6,
     "w": 10.4,
     "h": 4.5,
     "label": "Tab restored from run 1"
    },
    {
     "x": 30.4,
     "y": 3.6,
     "w": 10.6,
     "h": 4.5,
     "label": "Tab restored from run 3"
    }
   ],
   "at": "2026-11-11T15:38:08.172Z",
   "file": "9/T9.2-1.png",
   "phase": "9",
   "href": "shots/9/T9.2-1.png"
  },
  {
   "taskId": "T9.3",
   "kind": "proof",
   "step": "Day headers, x N group expands inline, bounded DOM",
   "attempt": null,
   "caption": "History sidebar with 300+ entries: sticky day headers, a group expanded to its 3 runs, and 25 DOM row nodes.",
   "annotations": [
    {
     "x": 0.3,
     "y": 28,
     "w": 19.6,
     "h": 2.5,
     "label": "Day header"
    },
    {
     "x": 0.8,
     "y": 31,
     "w": 18.5,
     "h": 4.5,
     "label": "Group x 3 expanded"
    }
   ],
   "at": "2026-11-11T15:10:45.714Z",
   "file": "9/T9.3-1.png",
   "phase": "9",
   "href": "shots/9/T9.3-1.png"
  },
  {
   "taskId": "T9.3",
   "kind": "proof",
   "step": "Sticky day header while virtualized; expanding a group changes height without scroll jump",
   "attempt": 5,
   "caption": "With 500 history entries scrolled to an older day, that day header stays pinned at the top and a GET group is expanded inline to its 4 runs (31 row nodes in the DOM).",
   "annotations": [
    {
     "x": 0.3,
     "y": 35,
     "w": 19.3,
     "h": 3.3,
     "label": "Pinned day header"
    },
    {
     "x": 0.3,
     "y": 60,
     "w": 19.3,
     "h": 6.1,
     "label": "Group x 4, expanded"
    },
    {
     "x": 2.2,
     "y": 66.1,
     "w": 15.1,
     "h": 14.5,
     "label": "Its 4 runs shown inline"
    }
   ],
   "at": "2026-11-11T15:29:50.686Z",
   "file": "9/T9.3-2.png",
   "phase": "9",
   "href": "shots/9/T9.3-2.png"
  },
  {
   "taskId": "T9.4",
   "kind": "proof",
   "step": "Long URL shows tooltip",
   "attempt": null,
   "caption": "Hovering a cut-off URL shows the full URL in a tooltip.",
   "annotations": [
    {
     "x": 0.4,
     "y": 37.8,
     "w": 26.6,
     "h": 6.5,
     "label": "Full URL tooltip"
    }
   ],
   "at": "2026-11-11T15:10:45.958Z",
   "file": "9/T9.4-1.png",
   "phase": "9",
   "href": "shots/9/T9.4-1.png"
  },
  {
   "taskId": "T9.5",
   "kind": "proof",
   "step": "No-match state",
   "attempt": 5,
   "caption": "A search with no hits shows No matches with a hint to try a different search.",
   "annotations": [
    {
     "x": 5.5,
     "y": 64.4,
     "w": 9,
     "h": 5.6,
     "label": "No matches state"
    }
   ],
   "at": "2026-11-11T15:29:51.110Z",
   "file": "9/T9.5-1.png",
   "phase": "9",
   "href": "shots/9/T9.5-1.png"
  },
  {
   "taskId": "T9.5",
   "kind": "proof",
   "step": "Empty history state",
   "attempt": 5,
   "caption": "An empty history shows No requests sent yet and sample requests to try.",
   "annotations": [
    {
     "x": 3.4,
     "y": 37.8,
     "w": 13,
     "h": 7.8,
     "label": "Empty history state"
    }
   ],
   "at": "2026-11-11T15:29:51.289Z",
   "file": "9/T9.5-2.png",
   "phase": "9",
   "href": "shots/9/T9.5-2.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Repeated GET /orders collapsed into one row with x 3, latest status 404 and time",
   "annotations": [],
   "at": "2026-11-11T15:18:46.389Z",
   "file": "9/T9.8-1.png",
   "phase": "9",
   "href": "shots/9/T9.8-1.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Expanded group listing the 3 runs, each with its own status and delete",
   "annotations": [],
   "at": "2026-11-11T15:18:46.609Z",
   "file": "9/T9.8-2.png",
   "phase": "9",
   "href": "shots/9/T9.8-2.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "After deleting every run the group and its rows are gone",
   "annotations": [],
   "at": "2026-11-11T15:18:46.799Z",
   "file": "9/T9.8-3.png",
   "phase": "9",
   "href": "shots/9/T9.8-3.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "URL-fragment search keeps only matching rows, group still x 3",
   "annotations": [],
   "at": "2026-11-11T15:18:46.973Z",
   "file": "9/T9.8-4.png",
   "phase": "9",
   "href": "shots/9/T9.8-4.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "No matches empty state",
   "annotations": [],
   "at": "2026-11-11T15:18:47.144Z",
   "file": "9/T9.8-5.png",
   "phase": "9",
   "href": "shots/9/T9.8-5.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Full-URL tooltip on a truncated URL",
   "annotations": [],
   "at": "2026-11-11T15:18:47.320Z",
   "file": "9/T9.8-6.png",
   "phase": "9",
   "href": "shots/9/T9.8-6.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "After reload entries persist and the group is collapsed again",
   "annotations": [],
   "at": "2026-11-11T15:18:47.506Z",
   "file": "9/T9.8-7.png",
   "phase": "9",
   "href": "shots/9/T9.8-7.png"
  },
  {
   "taskId": "T9.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Tooltip shows full URL only for truncated row",
   "annotations": [],
   "at": "2026-11-11T15:51:30.129Z",
   "file": "9/T9.8-8.png",
   "phase": "9",
   "href": "shots/9/T9.8-8.png"
  },
  {
   "taskId": "T9.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "500 history entries render as a bounded window of rows",
   "annotations": [],
   "at": "2026-11-11T15:15:49.993Z",
   "file": "9/T9.9-1.png",
   "phase": "9",
   "href": "shots/9/T9.9-1.png"
  },
  {
   "taskId": "T9.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Yesterday header stays pinned while scrolling its day",
   "annotations": [],
   "at": "2026-11-11T15:15:50.234Z",
   "file": "9/T9.9-2.png",
   "phase": "9",
   "href": "shots/9/T9.9-2.png"
  },
  {
   "taskId": "T9.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Expanded run group inside the virtualized list",
   "annotations": [],
   "at": "2026-11-11T15:15:50.412Z",
   "file": "9/T9.9-3.png",
   "phase": "9",
   "href": "shots/9/T9.9-3.png"
  },
  {
   "taskId": "T9.9",
   "kind": "proof",
   "step": "Expanded group inside a virtualized list",
   "attempt": 5,
   "caption": "An expanded group deep in the 500-entry virtualized list shows all 4 runs, with the day header pinned above.",
   "annotations": [
    {
     "x": 0.3,
     "y": 60,
     "w": 19.3,
     "h": 6.1,
     "label": "Expanded group"
    },
    {
     "x": 2.2,
     "y": 66.1,
     "w": 15.1,
     "h": 14.5,
     "label": "4 runs"
    }
   ],
   "at": "2026-11-11T15:29:50.934Z",
   "file": "9/T9.9-4.png",
   "phase": "9",
   "href": "shots/9/T9.9-4.png"
  }
 ],
 "deliverables": [
  {
   "at": "2026-11-11T15:57:54.843Z",
   "type": "deliverable",
   "tasks": [
    "T9.1",
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "text": "History sidebar: grouped by day, x N run groups, virtualized, truncation tooltip, unit+e2e tests",
   "files": [
    "src/components/history"
   ]
  },
  {
   "at": "2026-11-11T14:51:38.767Z",
   "type": "deliverable",
   "tasks": [
    "T8.1",
    "T8.2",
    "T8.3",
    "T8.4",
    "T8.5",
    "T8.6",
    "T8.7",
    "T8.8",
    "T8.9"
   ],
   "text": "Compare pages, hub redesign with category groups and SEO links, footer Features/Compare columns; unit + e2e + prod-build gate",
   "files": [
    "src/components/seo/ComparePageLayout.tsx"
   ]
  },
  {
   "at": "2026-11-11T13:51:20.499Z",
   "type": "deliverable",
   "tasks": [
    "T7.1",
    "T7.2",
    "T7.3",
    "T7.4",
    "T7.5",
    "T7.6",
    "T7.7"
   ],
   "text": "SEO feature page template, /features/[slug] route and nine feature pages",
   "files": [
    "src/components/seo",
    "src/app/features/[slug]",
    "src/components/landing/data/seoPages.ts",
    "e2e/qa/landing-seo-polish/feature-pages.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T13:21:44.297Z",
   "type": "deliverable",
   "tasks": [
    "T6.1",
    "T6.2",
    "T6.3"
   ],
   "text": "Import and backup section: two groups, real import screenshots, unit 100% + e2e 18/18; backup shots deferred to phase 10",
   "files": [
    "src/components/landing/ImportSection.tsx",
    "src/components/landing/ImportSection.spec.tsx",
    "src/components/landing/constants.ts",
    "e2e/qa/landing-seo-polish/import-backup-section.spec.ts"
   ]
  },
  {
   "at": "2026-11-09T16:01:22.929Z",
   "type": "deliverable",
   "tasks": [
    "T5.1",
    "T5.2",
    "T5.3"
   ],
   "text": "Command palette landing section with themed screenshot, unit and e2e specs",
   "files": [
    "src/components/landing/CommandPaletteSection.tsx",
    "src/components/landing/constants.ts",
    "src/components/landing/CommandPaletteSection.spec.tsx",
    "e2e/qa/landing-seo-polish/command-palette-section.spec.ts"
   ]
  },
  {
   "at": "2026-11-09T15:50:05.898Z",
   "type": "deliverable",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6",
    "T4.7",
    "T4.8"
   ],
   "text": "Relay-first hero, BlurHeadline, real loop DemoVideo, lazy DemoModal, RelaySection rewrite; unit and e2e green",
   "files": [
    "src/components/landing/Hero.tsx",
    "src/components/landing/relay/RelaySection.tsx",
    "src/components/landing/relay/BlurHeadline.tsx",
    "src/components/landing/DemoVideo.tsx",
    "src/components/landing/DemoModal.tsx",
    "src/components/landing/WatchDemoButton.tsx",
    "src/components/landing/constants.ts",
    "e2e/qa/landing-seo-polish/relay-section.spec.ts"
   ]
  },
  {
   "at": "2026-11-09T14:41:38.159Z",
   "type": "deliverable",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9"
   ],
   "text": "Landing restructured (Relay second, CommandPalette stub), stat strip and Relay mocks removed, time-to-first-request row rewritten with estimates",
   "files": [
    "src/components/landing/LandingPage.tsx",
    "src/components/landing/data/comparison.ts"
   ]
  },
  {
   "at": "2026-11-09T14:03:48.951Z",
   "type": "deliverable",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6"
   ],
   "text": "Capture pipeline: 16 screenshots, Relay loop/full cut/poster, asset verifier, og-image",
   "files": [
    "scripts/capture",
    "public/screens",
    "public/media/relay",
    "public/og-image.png"
   ]
  },
  {
   "at": "2026-11-09T12:45:40.982Z",
   "type": "deliverable",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8"
   ],
   "text": "SITE_URL + metadataBase, seoPages data, JSON-LD builders, sitemap/robots, og-image, unit+e2e specs",
   "files": [
    "src/lib/constants.ts"
   ]
  },
  {
   "at": "2026-11-09T11:51:47.074Z",
   "type": "deliverable",
   "tasks": [
    "T0.1",
    "T0.2"
   ],
   "text": "Lighthouse/bundle baseline and Motionsites shortlist with no-3D decision",
   "files": [
    "agent_docs/landing-seo-polish/PLAN.md",
    "agent_docs/landing-seo-polish/baseline/home.json",
    "agent_docs/landing-seo-polish/baseline/features.json",
    "agent_docs/landing-seo-polish/baseline/bundle.txt"
   ]
  }
 ],
 "advisories": [
  {
   "at": "2026-11-11T15:57:34.663Z",
   "type": "advisory",
   "tasks": [
    "T9.7"
   ],
   "text": "HistoryList.tsx only file below 100% (97.5 lines, virtualizer callbacks); above 95% target"
  },
  {
   "at": "2026-11-11T15:57:11.709Z",
   "type": "advisory",
   "tasks": [
    "T9.8"
   ],
   "text": "history-grouping.spec.ts:211 comment says 300 ms tooltip open delay; Base UI trigger default is 600 ms (unit spec uses 600); runFor(1000) covers both"
  },
  {
   "at": "2026-11-11T15:40:29.064Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "Runs with identical requests dedupe to one tab by design; restore proof relies on seed names Orders run 1/2/3"
  },
  {
   "at": "2026-11-11T15:40:28.879Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "HistoryItem.tsx:22-72 the 9 restorable request fields are listed three times (toRestoredTab, RestorableFields, pickRestorable)"
  },
  {
   "at": "2026-11-11T15:38:41.487Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "No proof shot was registered for T9.2; verifier added 9/T9.2-1.png (per-run restore, two tabs)"
  },
  {
   "at": "2026-11-11T15:30:20.552Z",
   "type": "advisory",
   "tasks": [
    "T9.3"
   ],
   "text": "HistoryList.tsx:58 Date.now() is captured in a useMemo keyed on entries/filter, so Today/Yesterday labels go stale across midnight while the app stays open with no new entries."
  },
  {
   "at": "2026-11-11T15:30:20.368Z",
   "type": "advisory",
   "tasks": [
    "T9.5"
   ],
   "text": "No proof shot was registered; verifier added T9.5-1 (no matches) and T9.5-2 (empty history)."
  },
  {
   "at": "2026-11-11T15:30:20.193Z",
   "type": "advisory",
   "tasks": [
    "T9.3"
   ],
   "text": "Shot T9.3-1 was byte-identical to T9.4-1 (tooltip covers the expanded runs); verifier retook it as T9.3-2. T9.9-3 showed the group at the viewport edge with runs offscreen; retaken as T9.9-4."
  },
  {
   "at": "2026-11-11T15:30:20.019Z",
   "type": "advisory",
   "tasks": [
    "T9.9"
   ],
   "text": "history-virtualization.spec.ts:164,190 in-page setTimeout settles before reading longtask entries; observer.takeRecords() would be deterministic."
  },
  {
   "at": "2026-11-11T15:30:19.845Z",
   "type": "advisory",
   "tasks": [
    "T9.7"
   ],
   "text": "Verify line comma-separated --coverage.include matches no file (0%); verified with repeated --coverage.include flags. HistoryList.tsx branches 93.75% with one uncovered branch not itemized in the report."
  },
  {
   "at": "2026-11-11T15:30:19.667Z",
   "type": "advisory",
   "tasks": [
    "T9.6"
   ],
   "text": "groupHistory.spec.ts:166 expected date label is computed with the production toLocaleDateString options instead of an independent literal."
  },
  {
   "at": "2026-11-11T15:30:19.472Z",
   "type": "advisory",
   "tasks": [
    "T9.6"
   ],
   "text": "groupHistory.spec.ts:142 DST test only exercises a 23h day in a DST zone; default TZ here is IST (passes under TZ=America/New_York and Europe/London). Pin TZ for the run."
  },
  {
   "at": "2026-11-11T14:51:09.839Z",
   "type": "advisory",
   "tasks": [
    "T8.8"
   ],
   "text": "Proof shot 8/T8.8-1.png and agent_docs/qa/hub-footer-links/hub.png were captured mid reveal-animation (hub content blank/faded); verifier retook as 8/T8.8-3.png. Spec snap should wait for the reveal to settle."
  },
  {
   "at": "2026-11-11T14:49:21.369Z",
   "type": "advisory",
   "tasks": [
    "T8.6"
   ],
   "text": "FeatureCard.spec.tsx preview test counts .mb-3 class nodes; brittle styling selector, prefer a testid or role"
  },
  {
   "at": "2026-11-11T14:49:21.143Z",
   "type": "advisory",
   "tasks": [
    "T8.5"
   ],
   "text": "ComparePageLayout.spec.tsx:142 test titled \"every row\" asserts only row 0 claim text; related-links check at :186 loops over data with no literal count"
  },
  {
   "at": "2026-11-11T14:43:06.720Z",
   "type": "advisory",
   "tasks": [
    "T8.9"
   ],
   "text": "Gate Log still says validator not run; verifier ran validator.schema.org on /compare/postman, /features, /features/relay: 0 errors 0 warnings (evidence/phase-8/val-*.png); orchestrator to update Log"
  },
  {
   "at": "2026-11-11T14:43:06.557Z",
   "type": "advisory",
   "tasks": [
    "T8.7"
   ],
   "text": "Proof shots T8.7-1..7 and T8.8-1..2 carry no annotation boxes or step text"
  },
  {
   "at": "2026-11-11T14:43:06.384Z",
   "type": "advisory",
   "tasks": [
    "T8.6"
   ],
   "text": "UI-kind task (.tsx Files) with no registered proof shot and no Design field; Verify --coverage.include comma form reports 0 files, use repeated --coverage.include"
  },
  {
   "at": "2026-11-11T14:43:06.221Z",
   "type": "advisory",
   "tasks": [
    "T8.5"
   ],
   "text": "UI-kind task (.tsx Files) with no registered proof shot and no Design field; Verify --coverage.include comma/bracket form reports 0 files, use repeated --coverage.include with escaped brackets"
  },
  {
   "at": "2026-11-11T14:43:06.010Z",
   "type": "advisory",
   "tasks": [
    "T8.1"
   ],
   "text": "src/app/compare/[competitor]/page.tsx:22-49 generateMetadata is a verbatim copy of src/app/features/[slug]/page.tsx:22-49; extract a shared buildSeoPageMetadata(page) helper"
  },
  {
   "at": "2026-11-11T13:50:12.234Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "shot T7.1-3 annotation covers heading only though label says heading and links; T7.1-1/2 show old Keep exploring label"
  },
  {
   "at": "2026-11-11T13:50:12.099Z",
   "type": "advisory",
   "tasks": [
    "T7.5"
   ],
   "text": "backup-restore CTA is /app; backup UI lives on /settings"
  },
  {
   "at": "2026-11-11T13:50:11.911Z",
   "type": "advisory",
   "tasks": [
    "T7.5"
   ],
   "text": "backup-restore uses interim collections-envs screenshot (user-waived Q6); swap to backup dialog captures when T10.10 lands"
  },
  {
   "at": "2026-11-11T13:45:31.288Z",
   "type": "advisory",
   "tasks": [
    "T7.2"
   ],
   "text": "prod server logs Internal NoFallbackError for /features/not-a-page while correctly returning 404 (Next dynamicParams=false behavior)"
  },
  {
   "at": "2026-11-11T13:45:31.152Z",
   "type": "advisory",
   "tasks": [
    "T7.5"
   ],
   "text": "backup-restore CTA is /app; SPEC section C says matching tool route where one exists and backup UI lives on /settings (Data section)"
  },
  {
   "at": "2026-11-11T13:45:31.013Z",
   "type": "advisory",
   "tasks": [
    "T7.3"
   ],
   "text": "Relay poster alt says \"beside a request\" but the poster shows Relay beside a request chain canvas"
  },
  {
   "at": "2026-11-11T13:45:30.865Z",
   "type": "advisory",
   "tasks": [
    "T7.7"
   ],
   "text": "T7.7 proof shots 1-8 have no step or annotations; captions only"
  },
  {
   "at": "2026-11-11T13:45:30.726Z",
   "type": "advisory",
   "tasks": [
    "T7.6"
   ],
   "text": "FeaturePageLayout.spec.tsx JSON-LD test is titled FAQ-free but never asserts FAQ absence or the WebPage/SoftwareApplication @type"
  },
  {
   "at": "2026-11-11T13:45:30.524Z",
   "type": "advisory",
   "tasks": [
    "T7.1"
   ],
   "text": "FeaturePageLayout.tsx:85 eyebrow \"Feature\" is an inline literal while BACK_LABEL/RELATED_HEADING are named constants"
  },
  {
   "at": "2026-11-11T13:20:19.046Z",
   "type": "advisory",
   "tasks": [
    "T6.3"
   ],
   "text": "shot T6.3-7.png is blank (dark page, section not rendered) but captioned as section order; T6.3-4 covers it, re-snap after fade-in"
  },
  {
   "at": "2026-11-11T13:16:29.947Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "Import lede says Scan but the screenshot is the /import page (Import Command button); swap to ImportDialog capture in T10.10"
  },
  {
   "at": "2026-11-11T13:16:29.815Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "Backup group text-only; backup dialog screenshots deferred to T10.10 per user Q4"
  },
  {
   "at": "2026-11-11T13:16:29.683Z",
   "type": "advisory",
   "tasks": [
    "T6.3"
   ],
   "text": "import-backup-section.spec.ts:65,137 duplicate mouse.wheel(0,1) already done in gotoLanding:17"
  },
  {
   "at": "2026-11-11T13:16:29.500Z",
   "type": "advisory",
   "tasks": [
    "T6.3"
   ],
   "text": "import-backup-section.spec.ts:124-155 viewport tests snap before AnimatedContent fade completes (T6.3-10 Backup group faded); reuse the opacity poll from the groups test"
  },
  {
   "at": "2026-11-11T13:11:52.176Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "biome.json excludes **/*.spec.*, so biome check on ImportSection.spec.tsx lints nothing (Checked 2 files)"
  },
  {
   "at": "2026-11-11T13:11:52.030Z",
   "type": "advisory",
   "tasks": [
    "T6.3"
   ],
   "text": "import-backup-section.spec.ts:69-75 toBeVisible ignores opacity; groups are asserted and snapped mid AnimatedContent fade. Wait for computed opacity 1 before asserting and snap"
  },
  {
   "at": "2026-11-11T13:11:51.900Z",
   "type": "advisory",
   "tasks": [
    "T6.3"
   ],
   "text": "Builder shots T6.3-1 (blank viewport) and T6.3-2/3 (Backup group mid-fade) do not show the AC; superseded by verifier retakes T6.3-4/5/6"
  },
  {
   "at": "2026-11-11T13:11:51.769Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "Builder shot shots/6/T6.1-1.png is stale (old lede copy, caption says 1440 wide); superseded by verifier retake T6.1-2.png"
  },
  {
   "at": "2026-11-11T13:11:51.641Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "Import group image is the /import route (Import Command button), not ImportDialog (Scan); swap to the polished dialog capture in T10.10"
  },
  {
   "at": "2026-11-11T13:11:51.480Z",
   "type": "advisory",
   "tasks": [
    "T6.1"
   ],
   "text": "Backup group is text-only; backup dialog screenshots deferred to T10.10 per user Q4 decision"
  },
  {
   "at": "2026-11-09T16:00:36.150Z",
   "type": "advisory",
   "tasks": [
    "T5.1"
   ],
   "text": "Pre-existing uncommitted PNG changes outside phase 5 (agent_docs/polish-and-landing/qa/walkthrough/*.png mtime 21:10, agent_docs/qa/site-plumbing/01-home-meta.png 19:33, both before HEAD 21:20); keep them out of the phase-5 commit. 12-comparison-sources.png shrank 84K->18K, likely a broken capture."
  },
  {
   "at": "2026-11-09T16:00:36.035Z",
   "type": "advisory",
   "tasks": [
    "T5.1"
   ],
   "text": "Proof shot 5/T5.1-1.png annotation box 10,10,80,80 covers heading not the screenshot; verifier added 5/T5.1-2.png with boxes on heading and image."
  },
  {
   "at": "2026-11-09T16:00:35.903Z",
   "type": "advisory",
   "tasks": [
    "T5.3"
   ],
   "text": "Proof shot 5/T5.3-1.png caption says 1280 light but shows dark theme; verifier added 5/T5.3-7.png (light, annotated). 1280 snaps also show the heading under the fixed nav (capture artifact)."
  },
  {
   "at": "2026-11-09T15:49:25.260Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[test-quality] verifier retook fold shots (1280 light, 390 dark) of the hero to replace the miscaptioned T4.8-6/T4.8-7"
  },
  {
   "at": "2026-11-09T15:47:47.337Z",
   "type": "advisory",
   "tasks": [
    "T4.7"
   ],
   "text": "[test-quality] RelaySection.spec.tsx:65-82 asserts headline/eyebrow/lede against imported constants, not literals (e2e pins the headline literal)"
  },
  {
   "at": "2026-11-09T15:47:47.227Z",
   "type": "advisory",
   "tasks": [
    "T4.2"
   ],
   "text": "[test-quality] no registered proof shot for T4.2/T4.3/T4.4 (no Design field); covered by T4.5 and T4.8 shots"
  },
  {
   "at": "2026-11-09T15:47:47.115Z",
   "type": "advisory",
   "tasks": [
    "T4.5"
   ],
   "text": "[test-quality] T4.5-1 shot annotation malformed (second box folded into label); verifier added T4.5-3 with separate boxes"
  },
  {
   "at": "2026-11-09T15:47:47.002Z",
   "type": "advisory",
   "tasks": [
    "T4.4"
   ],
   "text": "[code-bug] DemoModal.tsx:46 play() rejection caught without logging"
  },
  {
   "at": "2026-11-09T15:47:46.890Z",
   "type": "advisory",
   "tasks": [
    "T4.4"
   ],
   "text": "[code-bug] WatchDemoButton.tsx:11-12 DEMO_CUT/DEMO_POSTER duplicate RELAY_FULL_SRC/RELAY_POSTER_SRC from constants.ts"
  },
  {
   "at": "2026-11-09T15:47:46.778Z",
   "type": "advisory",
   "tasks": [
    "T4.5"
   ],
   "text": "[code-bug] RelaySection.tsx:27-41,76-90 re-implements WatchDemoButton (dynamic DemoModal, requested/open state, button) instead of reusing it"
  },
  {
   "at": "2026-11-09T15:47:46.671Z",
   "type": "advisory",
   "tasks": [
    "T4.5"
   ],
   "text": "[spec-issue] Verify grep cards|undone in src/components/landing/relay matches RelaySection.spec.tsx:16-17 (BANNED_COPY list); Verify should add --exclude=*.spec.tsx"
  },
  {
   "at": "2026-11-09T15:47:46.568Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[test-quality] registered shots T4.8-6/T4.8-7 captions say above the fold but show the scrolled Relay section with the headline mid-reveal; T4.8-7 captioned light shows dark theme"
  },
  {
   "at": "2026-11-09T15:47:46.458Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[test-quality] relay-section.spec.ts:228-270 blocked-video test uses plain Playwright test with a scoped console guard tolerating only net::ERR_FAILED (forced by AC page.route abort) instead of the shared consoleGuard fixture"
  },
  {
   "at": "2026-11-09T15:47:46.351Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[flaky-env] e2e run with E2E_SERVER=dev against https://requestly.localhost/app per orchestrator, no prod build this round"
  },
  {
   "at": "2026-11-09T15:47:46.237Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[flaky-env] 10 PNGs under agent_docs/polish-and-landing/qa/walkthrough/ overwritten by those older spec runs; user deferred, do not commit unintentionally"
  },
  {
   "at": "2026-11-09T15:47:46.074Z",
   "type": "advisory",
   "tasks": [
    "T4.8"
   ],
   "text": "[spec-issue] e2e/qa/polish-and-landing/p7-relay-demo.spec.ts and polish-and-landing.spec.ts (5 tests) fail on the new Relay copy/structure; user deferred out of phase 4"
  },
  {
   "at": "2026-11-09T14:38:13.057Z",
   "type": "advisory",
   "tasks": [
    "T3.9"
   ],
   "text": "agent_docs/qa/site-plumbing/01-home-meta.png changed in the working tree but is not in any Phase 3 Files; it is a regenerated T1.8 proof shot. Orchestrator should decide whether to keep it"
  },
  {
   "at": "2026-11-09T14:38:12.957Z",
   "type": "advisory",
   "tasks": [
    "T3.9"
   ],
   "text": "Engineer proof shots T3.9-1..3 showed a blank or animating viewport, not the claimed state; verifier retook them as T3.9-5/6"
  },
  {
   "at": "2026-11-09T14:38:12.856Z",
   "type": "advisory",
   "tasks": [
    "T3.8"
   ],
   "text": "LandingPage.spec.tsx no-stat-strip test can never fail (no mock emits that testid); order toEqual is the real guard. comparison.spec says distinct sources but does not assert distinctness"
  },
  {
   "at": "2026-11-09T14:38:12.762Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "Copy gate not run on CommandPaletteSection stub heading"
  },
  {
   "at": "2026-11-09T14:38:12.671Z",
   "type": "advisory",
   "tasks": [
    "T3.3"
   ],
   "text": "Copy gate not run on the edited Relay lede (RelaySection.tsx:30-31)"
  },
  {
   "at": "2026-11-09T14:38:12.576Z",
   "type": "advisory",
   "tasks": [
    "T3.1"
   ],
   "text": "comparison.ts:116 requestr codeRef now src/app/page.tsx; Do says remove any codeRef, kept only to satisfy AC-29 spec"
  },
  {
   "at": "2026-11-09T14:38:12.437Z",
   "type": "advisory",
   "tasks": [
    "T3.1"
   ],
   "text": "Copy gate (copywriting/copy-editing/humanizer) not run on the Time to first request basis strings; Log line empty"
  },
  {
   "at": "2026-11-09T14:03:35.843Z",
   "type": "advisory",
   "tasks": [
    "T2.1"
   ],
   "text": "01-home-meta.png tracked snapshot rewritten by site-plumbing spec"
  },
  {
   "at": "2026-11-09T14:03:35.754Z",
   "type": "advisory",
   "tasks": [
    "T2.6"
   ],
   "text": "scripts/capture/og-image.mjs:22 crop cuts request bar mid-word"
  },
  {
   "at": "2026-11-09T13:54:17.671Z",
   "type": "advisory",
   "tasks": [
    "T2.1"
   ],
   "text": "running site-plumbing.spec.ts rewrites tracked agent_docs/qa/site-plumbing/01-home-meta.png (spec side-effect, shows as modified)"
  },
  {
   "at": "2026-11-09T13:54:17.595Z",
   "type": "advisory",
   "tasks": [
    "T2.6"
   ],
   "text": "og-image crop cuts the request bar mid-word (\"=5\", \"anced\") and leaves the lower card empty; consider a tighter crop"
  },
  {
   "at": "2026-11-09T13:54:17.520Z",
   "type": "advisory",
   "tasks": [
    "T2.1"
   ],
   "text": "public/screens/transform-*.webp shows the placeholder input and a \"JSONPath requires a JSON response\" error; seed real JSON before using it on a feature page"
  },
  {
   "at": "2026-11-09T12:45:06.084Z",
   "type": "advisory",
   "tasks": [
    "T1.8"
   ],
   "text": "proof shot 01-home-meta/T1.8-1.png shows hero mid-animation (blurred headline) and no meta tags; weak visual proof for a head-only assertion"
  },
  {
   "at": "2026-11-09T12:37:20.596Z",
   "type": "advisory",
   "tasks": [
    "T1.6"
   ],
   "text": "[type-lint] biome.json ignores **/*.spec.*, so the six new spec files and site-plumbing.spec.ts are not biome-checked (project config, informational)."
  },
  {
   "at": "2026-11-09T12:37:20.546Z",
   "type": "advisory",
   "tasks": [
    "T1.8"
   ],
   "text": "[test-quality] No proof shot registered for T1.8 (kind e2e, no Design field)."
  },
  {
   "at": "2026-11-09T12:37:20.494Z",
   "type": "advisory",
   "tasks": [
    "T1.5"
   ],
   "text": "[code-bug] .gitignore:55-56 edited outside Files (scripts/ -> scripts/* + !scripts/capture/) so og-image.mjs is committable; other scripts/ files stay ignored (verified with git status -uall)."
  },
  {
   "at": "2026-11-09T12:37:20.440Z",
   "type": "advisory",
   "tasks": [
    "T1.1"
   ],
   "text": "[code-bug] src/app/page.tsx:6-12 page-level title, description and OG still say \"Browser-native API testing\", overriding the new layout positioning on /."
  },
  {
   "at": "2026-11-09T12:37:20.387Z",
   "type": "advisory",
   "tasks": [
    "T1.1"
   ],
   "text": "[flaky-env] src/app/settings/page.spec.tsx and src/app/chain/[collectionId]/page.spec.tsx fail 10 tests (localStorage undefined, Node 26); identical 10 failures on a 1bb6223 export, so pre-existing, not caused by phase 1."
  },
  {
   "at": "2026-11-09T12:37:20.335Z",
   "type": "advisory",
   "tasks": [
    "T1.7"
   ],
   "text": "[test-quality] TASKS.md T1.7 Verify joins --coverage.include with commas; measures 0/0 here. Repeat the flag per file (verifier did: 100% all metrics)."
  },
  {
   "at": "2026-11-09T12:37:20.282Z",
   "type": "advisory",
   "tasks": [
    "T1.6"
   ],
   "text": "[test-quality] TASKS.md T1.6 Verify joins --coverage.include with commas; this vitest then measures 0/0 (Unknown%). Repeat the flag per file (verifier did: 100% all metrics)."
  },
  {
   "at": "2026-11-09T11:50:05.293Z",
   "type": "advisory",
   "tasks": [
    "T0.1"
   ],
   "text": "bundle.txt First Load JS is Lighthouse script transfer (Turbopack prints no table); T12.3 must use the same method for a like-for-like compare"
  },
  {
   "at": "2026-11-09T11:50:05.241Z",
   "type": "advisory",
   "tasks": [
    "T0.2"
   ],
   "text": "PLAN.md:149 criterion 2 says both 3D recipes are dark-authored, but the library lists the shader backdrop for \"a light agency hero\"; decision still NO 3D via criteria 1 and 4"
  }
 ],
 "activity": [
  {
   "at": "2026-11-11T15:58:14.101Z",
   "type": "commit",
   "tasks": [
    "T9.1",
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "attempt": "7",
   "text": "feat(landing-seo-polish): phase 9 history sidebar grouping",
   "sha": "04632385136d24e758b713b68104b7eb41e3752e",
   "branch": "feature/ai-agent",
   "pushed": "yes",
   "evidence": "e2e 24/24 + 18/18 x3; unit 101 tests, lowest file 94.4% functions"
  },
  {
   "at": "2026-11-11T15:57:54.843Z",
   "type": "deliverable",
   "tasks": [
    "T9.1",
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "text": "History sidebar: grouped by day, x N run groups, virtualized, truncation tooltip, unit+e2e tests",
   "files": [
    "src/components/history"
   ]
  },
  {
   "at": "2026-11-11T15:57:51.320Z",
   "tasks": [
    "T9.9"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "Verify line 24/24 x3 on dev (incl. e2e/history.spec.ts); the long-task flush is a sentinel block awaited through the observer callback, with no timers; mutation injecting a 120 ms block mid-scroll -> failed with [122]; prod 42/42 x3",
   "fingerprint": "1290192be6a16298517d0b9c4118457bdb77758cac8f8059b3d05bbc77aa285c"
  },
  {
   "at": "2026-11-11T15:57:51.319Z",
   "tasks": [
    "T9.8"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "Verify line 18/18 x3 on dev; the absence step now uses page.clock.install + runFor(1000), no sleep; mutation hovering the long URL in the absence step -> toHaveCount(0) failed, Received 1; shot agent_docs/qa/history-grouping/07-tooltip-truncated.png",
   "fingerprint": "a23dd67b0af835c63b74900e83fe67ca71bd1cb4532e88866f5951b40b966e66"
  },
  {
   "at": "2026-11-11T15:57:51.314Z",
   "tasks": [
    "T9.7"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "Verify line 9 files 101 passed; coverage-summary: HistoryDayHeader, HistoryGroupRow, HistoryItem, useIsTruncated 100% on all four metrics; HistoryList 97.5/93.75/94.44/97.91; store spec green and untouched",
   "fingerprint": "2fdc022614f6bf7715552114172a79e0e5b007904fb931a713c27bc3ffacb0b4"
  },
  {
   "at": "2026-11-11T15:57:51.314Z",
   "tasks": [
    "T9.6"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "groupHistory.spec 34/34; groupHistory.ts 100/100/100/100 (lines/branches/funcs/stmts)",
   "fingerprint": "ee3744a1106f33071011c1835d17db5adaca7c41f4d08dc7f13a69309d5795ef"
  },
  {
   "at": "2026-11-11T15:57:51.314Z",
   "tasks": [
    "T9.5"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "vitest src/components/history green (empty, no-match, filter counts); `grep -n \"History UX decisions\" PLAN.md` -> 158; biome clean",
   "fingerprint": "782e823d51f51a14036c020cd14eb8b99772a3f88f43b8ee37cb2245e260c130"
  },
  {
   "at": "2026-11-11T15:57:51.314Z",
   "tasks": [
    "T9.4"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "HistoryItem.spec now fake timers (fireEvent + act/advanceTimersByTime), no sleep; mutation stubWidths(500,100) on the short test -> 1 failed; advancing only 1 ms -> long-URL test fails (the delay step matters); shot 9/T9.4-1.png (full URL tooltip on the truncated row); biome clean",
   "fingerprint": "09512965d486549bcfb689861899986602b7a8b16b2073bf0ec8452bc5e1a462"
  },
  {
   "at": "2026-11-11T15:57:51.313Z",
   "tasks": [
    "T9.3"
   ],
   "attempt": "7",
   "type": "verify_passed",
   "evidence": "history vitest + store spec 101/101; `git diff --stat -- src/stores` empty (store spec unmodified); biome clean; virtualization e2e 24/24 x3 dev and 42/42 x3 on a fresh prod build; HistoryList 97.5% lines",
   "fingerprint": "654caa8fcca7b52027711c15951b250b193903db1342bd317c33326f7576fe23"
  },
  {
   "at": "2026-11-11T15:57:34.663Z",
   "type": "advisory",
   "tasks": [
    "T9.7"
   ],
   "text": "HistoryList.tsx only file below 100% (97.5 lines, virtualizer callbacks); above 95% target"
  },
  {
   "at": "2026-11-11T15:57:11.709Z",
   "type": "advisory",
   "tasks": [
    "T9.8"
   ],
   "text": "history-grouping.spec.ts:211 comment says 300 ms tooltip open delay; Base UI trigger default is 600 ms (unit spec uses 600); runFor(1000) covers both"
  },
  {
   "at": "2026-11-11T15:53:47.161Z",
   "type": "verify_started",
   "tasks": [
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-11-11T15:53:42.329Z",
   "type": "task_built",
   "tasks": [
    "T9.9"
   ],
   "text": "timer-free long-task check via sentinel observer flush; vacuity guard kept; 24/24 x3; mutation-checked",
   "files": [
    "e2e/qa/landing-seo-polish/history-virtualization.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:52:03.994Z",
   "type": "task_started",
   "tasks": [
    "T9.9"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-11-11T15:52:03.756Z",
   "type": "task_built",
   "tasks": [
    "T9.8"
   ],
   "text": "page.clock replaces in-page sleep; mutation-checked; 18/18 x3",
   "files": [
    "e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:50:29.989Z",
   "type": "task_started",
   "tasks": [
    "T9.8"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-11-11T15:50:27.328Z",
   "type": "task_built",
   "tasks": [
    "T9.7"
   ],
   "text": "no sleeps; fixed real-clock fixtures; 101 tests; coverage via repeated include flags",
   "files": [
    "src/components/history/HistoryList.spec.tsx",
    "src/components/history/groupHistory.spec.ts",
    "src/components/history/HistoryItem.spec.tsx",
    "src/components/history/HistoryGroupRow.spec.tsx",
    "agent_docs/landing-seo-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-11-11T15:45:36.734Z",
   "type": "task_started",
   "tasks": [
    "T9.7"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-11-11T15:45:34.048Z",
   "type": "task_built",
   "tasks": [
    "T9.4"
   ],
   "text": "fake-timer tooltip tests via fireEvent+act; 3 mutations fail as expected",
   "files": [
    "src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:45:20.532Z",
   "type": "task_built",
   "tasks": [
    "T9.4"
   ],
   "text": "tooltip unit tests use vitest fake timers + fireEvent, no sleeps; history vitest 85/85; mutations M1-M3 fail",
   "files": [
    "src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:45:02.550Z",
   "type": "task_started",
   "tasks": [
    "T9.4"
   ]
  },
  {
   "at": "2026-11-11T15:40:53.597Z",
   "type": "task_started",
   "tasks": [
    "T9.4"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-11-11T15:40:53.398Z",
   "type": "build_started",
   "tasks": [
    "T9.4",
    "T9.7"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-11-11T15:40:50.384Z",
   "tasks": [
    "T9.5"
   ],
   "attempt": "6",
   "type": "verify_passed",
   "evidence": "history vitest 100/100 (empty, no-match, filter counts); `grep -n \"History UX decisions\" PLAN.md` -> 158; biome clean",
   "fingerprint": "6aa69ef2c15662e0bd441d5a258f4eb67825fb6af0d98049c20c2c7e85741473"
  },
  {
   "at": "2026-11-11T15:40:50.384Z",
   "tasks": [
    "T9.3"
   ],
   "attempt": "6",
   "type": "verify_passed",
   "evidence": "history vitest + store spec 100/100; `git diff --stat -- src/stores` empty; virtualization e2e green on dev x3 and on a fresh prod build x3; biome clean",
   "fingerprint": "a4c0935d19aa8dcb16376f7dea28a7d858f51361926a324ffa18683142fb3693"
  },
  {
   "at": "2026-11-11T15:40:50.384Z",
   "tasks": [
    "T9.2"
   ],
   "attempt": "6",
   "type": "verify_passed",
   "evidence": "per-run restore fixed (useRestoreHistoryEntry matches the full restorable request); unit \"restores each run ... as its own tab\" green; live probe run 1 then run 3 -> tabs [\"Orders run 1\",\"Orders run 3\"], re-click run 1 -> still 2; delete per run, delete-latest summary, delete-all removes group, aria-expanded via T9.8 e2e 18/18 x3; shot 9/T9.2-1.png; biome clean",
   "fingerprint": "b64fcd04737d0769deb9800cf5322e9b4e8929ba0cdb7fdef29dcf53a3d6f67f"
  },
  {
   "at": "2026-11-11T15:40:50.384Z",
   "tasks": [
    "T9.9"
   ],
   "attempt": "6",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · e2e/qa/landing-seo-polish/history-virtualization.spec.ts:164,190 · in-page `setTimeout(r, 300)` / `setTimeout(r, 200)` settle sleeps before reading long-task entries (rule 4; a5 logged this as advisory, but the rule says blocking) · read pending entries with `observer.takeRecords()` (synchronous) instead of sleeping. Runs otherwise green: 24/24 x3 dev, 42/42 x3 prod",
   "files": [
    "e2e/qa/landing-seo-polish/history-virtualization.spec.ts"
   ],
   "sigs": [
    "T9.9|test-quality|e2e/qa/landing-seo-polish/history-virtualization.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:40:50.382Z",
   "tasks": [
    "T9.8"
   ],
   "attempt": "6",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · e2e/qa/landing-seo-polish/history-grouping.spec.ts:208-211 · the no-tooltip step sleeps 800 ms through `page.evaluate(setTimeout)`, a waitForTimeout in disguise (rule 4). It can fail now (mutation hovering the long URL -> Received 1) · install `page.clock` before navigation, hover the short URL, `page.clock.runFor(1000)`, then assert `toHaveCount(0)`",
   "files": [
    "e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ],
   "sigs": [
    "T9.8|test-quality|e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:40:50.379Z",
   "tasks": [
    "T9.7"
   ],
   "attempt": "6",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · AC \"tooltip only when truncated\" · the unit proof of the short-URL half is the sleep-based HistoryItem.spec.tsx:245 test · same fix as T9.4 (coverage otherwise OK: 100% on 4 files, HistoryList 95.83/93.75/88.88/95)",
   "files": [
    "ac \"tooltip only when truncated\""
   ],
   "sigs": [
    "T9.7|test-quality|ac \"tooltip only when truncated\""
   ]
  },
  {
   "at": "2026-11-11T15:40:50.378Z",
   "tasks": [
    "T9.4"
   ],
   "attempt": "6",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · src/components/history/HistoryItem.spec.tsx:245 · \"shows no tooltip when the URL fits\" now sleeps a real 600 ms (`await new Promise(r => setTimeout(r, TOOLTIP_DELAY_MS))`). It can fail now (mutation stubWidths(500,100) -> 1 failed), but test-quality.md rule 4 bans sleeps · use fake timers (vi.useFakeTimers + userEvent.setup({ advanceTimers: vi.advanceTimersByTime }), advance past ",
   "files": [
    "src/components/history/HistoryItem.spec.tsx"
   ],
   "sigs": [
    "T9.4|test-quality|src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:40:29.064Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "Runs with identical requests dedupe to one tab by design; restore proof relies on seed names Orders run 1/2/3"
  },
  {
   "at": "2026-11-11T15:40:28.879Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "HistoryItem.tsx:22-72 the 9 restorable request fields are listed three times (toRestoredTab, RestorableFields, pickRestorable)"
  },
  {
   "at": "2026-11-11T15:38:41.487Z",
   "type": "advisory",
   "tasks": [
    "T9.2"
   ],
   "text": "No proof shot was registered for T9.2; verifier added 9/T9.2-1.png (per-run restore, two tabs)"
  },
  {
   "at": "2026-11-11T15:34:46.715Z",
   "type": "verify_started",
   "tasks": [
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-11T15:34:41.952Z",
   "type": "task_built",
   "tasks": [
    "T9.8"
   ],
   "text": "tooltip wait + two-run restore; mutation-checked; 18/18 x3",
   "files": [
    "e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:33:32.771Z",
   "type": "task_started",
   "tasks": [
    "T9.8"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-11-11T15:33:30.810Z",
   "type": "task_built",
   "tasks": [
    "T9.7"
   ],
   "text": "specs confirmed adequate via mutation checks; 100 tests green shuffled",
   "files": [
    "src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:32:57.818Z",
   "type": "task_started",
   "tasks": [
    "T9.7"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-11-11T15:32:57.580Z",
   "type": "task_built",
   "tasks": [
    "T9.2",
    "T9.4"
   ],
   "text": "per-run tab matching fix; tooltip-absence test waits past delay (mutation-checked)",
   "files": [
    "src/components/history/HistoryItem.tsx",
    "src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:31:55.392Z",
   "type": "task_started",
   "tasks": [
    "T9.2",
    "T9.4"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-11-11T15:31:55.194Z",
   "type": "build_started",
   "tasks": [
    "T9.2",
    "T9.4",
    "T9.7"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-11T15:31:52.220Z",
   "tasks": [
    "T9.9"
   ],
   "attempt": "5",
   "type": "verify_passed",
   "evidence": "virtualization 9/9 + history.spec 15/15 x3 on a fresh prod build (E2E_SERVER=prod, .next-e2e built 20:51), 24/24 x3 on dev; long-task control asserts the observer saw a blocking task; history-500.json is not required by the AC or Files (spec seeds IDB itself)",
   "fingerprint": "2e494c75a3d0ad6a2c8eae2a864fadf5f63b37d427c67ee000b9e5ca902fd089"
  },
  {
   "at": "2026-11-11T15:31:52.219Z",
   "tasks": [
    "T9.6"
   ],
   "attempt": "5",
   "type": "verify_passed",
   "evidence": "groupHistory.spec 34/34, 100% all metrics; also 34/34 under TZ=America/New_York and Europe/London",
   "fingerprint": "a2ebdb2ef83dd67470e53c0ed7afa0f8632516fabc91c280e9adb296854008d8"
  },
  {
   "at": "2026-11-11T15:31:52.218Z",
   "tasks": [
    "T9.5"
   ],
   "attempt": "5",
   "type": "verify_passed",
   "evidence": "empty and no-match states render (e2e + shots T9.5-1/T9.5-2); filter counts only matching runs (HistoryList.spec \"x 2\"); PLAN.md \"History UX decisions\" lists adopted and dropped items with reasons (line 158); copy gate in Log; biome clean",
   "fingerprint": "fca83ad5ea5626f0d4cf70f143666305f878b6686a95eec2213d79c7909a3bf3"
  },
  {
   "at": "2026-11-11T15:31:52.218Z",
   "tasks": [
    "T9.3"
   ],
   "attempt": "5",
   "type": "verify_passed",
   "evidence": "500-entry list peak rows < 60 in e2e (prod x3), 31 row nodes in probe; sticky header pinned (e2e); expand probe y 432->432, scrollTop 14256->14256 (no jump); cap-trim probe (200 entries, expanded group, 2x addEntry) ok; store spec green and untouched; shot T9.3-2 (retaken)",
   "fingerprint": "ce84bd18c0a6cc431b2eb2960d5e5e0c300996edc49e0ab36877cacaf9fbfc33"
  },
  {
   "at": "2026-11-11T15:31:52.218Z",
   "tasks": [
    "T9.1"
   ],
   "attempt": "5",
   "type": "verify_passed",
   "evidence": "biome clean; `git diff --stat -- src/stores` empty; groupHistory.ts pure (now via opts, no store); groupHistory.spec 34/34, coverage 100% lines/branches/funcs/stmts",
   "fingerprint": "3c8aa9b32e39d206481afe3f8d6b90113be1f50dc2d6dc11545243448507a541"
  },
  {
   "at": "2026-11-11T15:31:52.218Z",
   "tasks": [
    "T9.8"
   ],
   "attempt": "5",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · e2e/qa/landing-seo-polish/history-grouping.spec.ts:201-202 and :91-96 · (a) `toHaveCount(0)` right after hovering the short URL passes before the 300 ms provider delay (probe: same assertion passed 3/3 right after hovering the TRUNCATED URL); (b) restore test clicks only one run, so it cannot catch the per-run restore bug · (a) wait out the delay deterministically (hover long firs",
   "files": [
    "e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ],
   "sigs": [
    "T9.8|test-quality|e2e/qa/landing-seo-polish/history-grouping.spec.ts"
   ]
  },
  {
   "at": "2026-11-11T15:31:52.215Z",
   "tasks": [
    "T9.7"
   ],
   "attempt": "5",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · AC \"tooltip only when truncated\" · the only unit proof of the short-URL half is the vacuous HistoryItem.spec.tsx:208 test (mutant passes) · make the absence assertion fail when a tooltip would open",
   "files": [
    "ac \"tooltip only when truncated\""
   ],
   "sigs": [
    "T9.7|test-quality|ac \"tooltip only when truncated\""
   ]
  },
  {
   "at": "2026-11-11T15:31:52.215Z",
   "tasks": [
    "T9.4"
   ],
   "attempt": "5",
   "type": "verify_failed",
   "category": "test-quality",
   "text": "[test-quality] · src/components/history/HistoryItem.spec.tsx:208-216 · \"shows no tooltip when the URL fits\" asserts immediately after hover, before the tooltip open delay; a mutant with stubWidths(500,100) still passes · advance fake timers past the delay (or open a truncated tooltip first) before asserting absence",
   "files": [
    "src/components/history/HistoryItem.spec.tsx"
   ],
   "sigs": [
    "T9.4|test-quality|src/components/history/HistoryItem.spec.tsx"
   ]
  },
  {
   "at": "2026-11-11T15:31:52.213Z",
   "tasks": [
    "T9.2"
   ],
   "attempt": "5",
   "type": "verify_failed",
   "category": "code-bug",
   "text": "[code-bug] · AC \"Clicking a run restores that run's request\" · src/components/history/HistoryItem.tsx:26-31 `useRestoreHistoryEntry` focuses any open tab with the same method+URL; all runs in a group share method+URL, so after restoring run 1, clicking run 3 just refocuses the \"Orders run 1\" tab (probe: tabs = [\"Orders run 1\"], evidence/phase-9/T9.2-restore-bug.png) · runs must restore their own r",
   "files": [
    "ac \"clicking a run restores that run's request\""
   ],
   "sigs": [
    "T9.2|code-bug|ac \"clicking a run restores that run's request\""
   ]
  },
  {
   "at": "2026-11-11T15:30:20.552Z",
   "type": "advisory",
   "tasks": [
    "T9.3"
   ],
   "text": "HistoryList.tsx:58 Date.now() is captured in a useMemo keyed on entries/filter, so Today/Yesterday labels go stale across midnight while the app stays open with no new entries."
  },
  {
   "at": "2026-11-11T15:30:20.368Z",
   "type": "advisory",
   "tasks": [
    "T9.5"
   ],
   "text": "No proof shot was registered; verifier added T9.5-1 (no matches) and T9.5-2 (empty history)."
  },
  {
   "at": "2026-11-11T15:30:20.193Z",
   "type": "advisory",
   "tasks": [
    "T9.3"
   ],
   "text": "Shot T9.3-1 was byte-identical to T9.4-1 (tooltip covers the expanded runs); verifier retook it as T9.3-2. T9.9-3 showed the group at the viewport edge with runs offscreen; retaken as T9.9-4."
  },
  {
   "at": "2026-11-11T15:30:20.019Z",
   "type": "advisory",
   "tasks": [
    "T9.9"
   ],
   "text": "history-virtualization.spec.ts:164,190 in-page setTimeout settles before reading longtask entries; observer.takeRecords() would be deterministic."
  },
  {
   "at": "2026-11-11T15:30:19.845Z",
   "type": "advisory",
   "tasks": [
    "T9.7"
   ],
   "text": "Verify line comma-separated --coverage.include matches no file (0%); verified with repeated --coverage.include flags. HistoryList.tsx branches 93.75% with one uncovered branch not itemized in the report."
  },
  {
   "at": "2026-11-11T15:30:19.667Z",
   "type": "advisory",
   "tasks": [
    "T9.6"
   ],
   "text": "groupHistory.spec.ts:166 expected date label is computed with the production toLocaleDateString options instead of an independent literal."
  },
  {
   "at": "2026-11-11T15:30:19.472Z",
   "type": "advisory",
   "tasks": [
    "T9.6"
   ],
   "text": "groupHistory.spec.ts:142 DST test only exercises a 23h day in a DST zone; default TZ here is IST (passes under TZ=America/New_York and Europe/London). Pin TZ for the run."
  },
  {
   "at": "2026-11-11T15:19:56.240Z",
   "type": "verify_started",
   "tasks": [
    "T9.1",
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "attempt": "5"
  },
  {
   "at": "2026-11-11T15:19:52.958Z",
   "type": "task_built",
   "tasks": [
    "T9.2",
    "T9.3",
    "T9.4",
    "T9.5",
    "T9.6",
    "T9.7",
    "T9.8",
    "T9.9"
   ],
   "text": "Work unchanged and built earlier; preceding task_failed was an over-broad preflight stray log, now fixed (preflight PASS)",
   "files": [
    "agent_docs/landing-seo-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-11-11T15:19:43.689Z",
   "type": "task_built",
   "tasks": [
    "T9.1"
   ],
   "text": "Files lines amended for phase outputs; preflight clean",
   "files": [
    "agent_docs/landing-seo-polish/TASKS.md"
   ]
  }
 ]
};
