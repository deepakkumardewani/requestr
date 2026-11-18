# Spec: landing-seo-polish

Status: DRAFT for review. Planning only; no feature code is written by this document.

## Objective

Make a first-time API developer understand within ~10 s that Requestr has an AI (Relay) built fully into the app that can do anything they can do by hand, then give search traffic (many arriving from "postman alternative" / "insomnia alternative") real entry points.

**Why now:** Relay's value isn't landing; the current Relay demo is a scripted mock and looks fake; there are no SEO entry points; legal pages are generic.

**Users:** API developers landing on the site, many from Postman/Insomnia searches.

**Message priority:** (1) "AI that does your API work" leads. (2) No install / no sign-up speed is second.

### Workstreams

| # | Workstream | Summary |
|---|---|---|
| A | Landing rework | New order, Relay-first hero, rewritten Relay section, Command palette section, "Import & backup" section, stat strip removed, comparison row rewritten |
| B | Relay real-footage media | One real screen recording of the actual app: 15-20 s seamless muted loop in section, 60-90 s cut in the "Watch demo" modal |
| C | SEO pages | 9 `/features/<slug>` pages, `/compare/postman`, `/compare/insomnia`, redesigned `/features` hub, footer link columns, sitemap, robots, JSON-LD |
| D | Legal | Rewrite `/privacy` and `/terms` from real data flows, using the `privacy-policy` and `terms-of-service` skills |
| E | History sidebar | Day headers, same-request collapse with run count, virtualization, truncation-only tooltip |
| F | Dialog polish | Import dialog, Export backup dialog, Import backup dialog: UI and copy only, no logic change |

### Out of scope
Changing backup/import logic; new app features; accounts or paid tiers; i18n; changing how history is stored.

## Decisions and assumptions

1. **Origin (user decision):** `SITE_URL = "https://requestr-api.vercel.app"` for now, switching to `https://requestr.app` once that domain is live. Today the code has three domains: `requestr.app` in the `page.tsx` OG url, `requestr-api.vercel.app` in package.json and the README, and `requestr.dev` in the `SharePreview.tsx` mock. Canonicals, sitemap, robots, OG and JSON-LD all read one `SITE_URL` constant (in `src/lib/constants.ts`, overridable by `NEXT_PUBLIC_SITE_URL`) and are never hard-coded. The `SharePreview` mock and `page.tsx` OG url use the same constant. There is no `metadataBase`, `sitemap` or `robots` file today, so this spec adds them.
2. `src/app/features/page.tsx` stays the hub. New pages go at `src/app/features/[slug]/page.tsx`, and `src/app/compare/` is new. The existing app tool routes (`/app`, `/json-compare`, `/json-visualize`, `/transform`, `/import`, `/chain/*`, `/settings`, `/environments`) stay as they are and are left out of the sitemap.
3. Product screenshots come from the real running app (https://requestly.localhost/app) and are committed to `public/screens/`. Metadata references `/og-image.png`, but `public/` has no such file. In scope: one 1200×630 `public/og-image.png` built from a real product screenshot plus the wordmark, used site-wide. Per-page OG images are optional.
4. The Relay recording uses DummyJSON (`e2e/dummyjson-api-reference.md`). The recording environment needs `NEXT_PUBLIC_RELAY_ENABLED` and the real Relay key (`RELAY_API_KEY` / `DEEPSEEK_API_KEY`; the model is `RELAY_MODEL_ID` in `src/lib/relay/server/model.ts`). Recording happens once, outside CI, and the output files are committed.
5. Motion library is `motion` (already a dependency). `@tanstack/react-virtual` (already a dependency) handles history virtualization. No new dependency is expected; adding one (e.g. three / r3f) is "Ask first".
6. Skills the user asked for, required in the matching tasks: `ui-ux-pro-max`, `impeccable`, `frontend-design` (all UI), `copywriting`, `copy-editing`, `humanizer` (all copy), and `seo-audit`, `ai-seo`, `site-architecture` (SEO pages). Marketing pages are server components rendered SSG; client JS only where something is interactive.
7. The legal "Effective date" is set at publish time in `src/components/legal/constants.ts`.
8. Nav: footer-only, as confirmed. The top Nav is unchanged apart from its existing section anchors following the new landing order.

## Tech Stack

Next.js 16.1.6 (App Router), React, TypeScript, Tailwind + shadcn (`src/components/ui`), `reactbits` ports (`src/components/reactbits`), `motion` ^12, Zustand stores (`src/stores`), `@tanstack/react-virtual`, Vitest, Playwright, Biome, bun. Remotion optional for post-production of the demo cut.

## Commands

```
Install:    bun install
Typecheck:  bun run typecheck
Lint/fmt:   bun run lint:write && bun run format      (or: bun run verify)
Unit:       bun run test                               (targeted: bunx vitest run <path>)
E2E:        bunx playwright test e2e/<spec>            (targeted only, never full suite;
            PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost)
Build:      bun run build                              (once at end, to confirm static params + sitemap)
Lighthouse: lighthouse-cli skill against a production build, not the dev server
```
Never run the dev server (already running). Never use npm.

## Project Structure

```
src/app/page.tsx                          landing metadata + <LandingPage/>
src/app/features/page.tsx                 hub (redesigned)
src/app/features/[slug]/page.tsx          NEW  generateStaticParams + generateMetadata from data
src/app/compare/[competitor]/page.tsx     NEW  postman | insomnia
src/app/sitemap.ts, src/app/robots.ts     NEW
src/app/privacy/page.tsx, terms/page.tsx  rewritten
src/components/landing/                   LandingPage.tsx (order), Hero, HowItWorks, FeatureShowcase,
                                          BeyondSend, ImportSection (-> Import & backup), ComparisonTable,
                                          FinalCta, Footer, DemoModal, DemoVideo, WatchDemoButton, AllFeaturesPage
src/components/landing/relay/             RelaySection (rewritten); RelayDemoPanel, scenarios.ts,
                                          relayDemoEngine.ts, ChangeCardMock, SidebarMock, useRelayDemo (+ specs) REMOVED
src/components/landing/CommandPaletteSection.tsx   NEW
src/components/landing/data/              features.ts (extended), comparison.ts (row rewrite),
                                          seoPages.ts NEW (single source for slugs, titles, descriptions, copy, media),
                                          speedProof.ts + spec REMOVED if unreferenced
src/components/seo/                       NEW  FeaturePageLayout, ComparePageLayout, JsonLd
src/components/history/                   HistoryList, HistoryItem, + new HistoryDayHeader, HistoryGroupRow,
                                          lib helper groupHistory.ts (pure)
src/components/import/ImportDialog.tsx, src/components/settings/backup/*   dialog copy/UI
src/components/legal/                     LegalLayout, constants
public/media/relay/                       loop (mp4+webm), full cut (mp4+webm), poster (webp/avif)
public/screens/                           feature screenshots (light + dark where theme-dependent)
agent_docs/landing-seo-polish/            SPEC.md, LEGAL_REVIEW_NOTES.md, later PLAN.md/TASKS.md
```

Grounded facts: `LandingPage.tsx` currently orders Hero, HowItWorks, FeatureShowcase, BeyondSend, RelaySection (dynamic), ImportSection, ComparisonStatStrip, ComparisonTable, FinalCta. `ComparisonStatStrip` and `comparison.ts` both import `speedProof.ts` (comparison.ts line ~118 for the "Time to first request" row). Footer anchors currently use `#features` / `#compare`. History today renders a flat `entries.map` inside `ScrollArea` with no virtualization; `HistoryEntry = {id, method, url, status, duration, size, timestamp, request, response}`; trimming happens in `useHistoryStore` at `MAX_HISTORY_ENTRIES`; filtering matches url, method, and `healthKey`. `HistoryItem` uses `truncate` CSS with no tooltip; delete button has `title`.

## A. Landing rework

**New order:** Hero → Relay → HowItWorks → FeatureShowcase → Command palette → BeyondSend → Import & backup → ComparisonTable → FinalCta. `ComparisonStatStrip` (6.6 s LCP / 759 KB / 0.2 s / 0 downloads), its spec, and `speedProof.ts` + spec are deleted (verify via `grep -r speedProof src` returning nothing).

**Hero:** headline leads with "AI that does your API work" (final wording from the copywriting pass; may shift toward Relay). Sub-line states Relay is built into the app and can do what you can do by hand. No-install is secondary.

**Relay section:** directly after Hero. Its headline and sub-line must make two points clear at first glance: Relay is AI built fully into the app, and it can do anything the user can do by hand. New copy, new UI and animation, and a word-by-word blur headline (confirmed Motionsites recipe). Media is the real loop (see B). The existing Hero "Watch demo" button (`WatchDemoButton`) and any Relay-section play affordance open `DemoModal` with the full cut. No scripted mock components remain. Banned copy terms: "cards", "undone", internal names (FR-xx, scenario, engine, mock).

**Command palette section (new):** real screenshot (`src/components/ui/command.tsx` is the palette primitive; capture from the real app), proper copy about reaching any request, collection, environment, or action by keyboard. Use shared `SECTION_*` constants from `constants.ts`.

**Import & backup (expand `ImportSection`):** two clearly delineated groups. Import from Postman / Insomnia / OpenAPI / Swagger / cURL. Export backup / restore backup (the two backup dialogs are in `src/components/settings/backup`, and `RestoreBackupCard` in `src/components/import`). Design uses the existing design system; assets are real screenshots.

**Comparison row "Time to first request"** (data in `comparison.ts`; no "measured", no stopwatch, no `codeRef` to speedProof):

| Product | Range | One-line basis |
|---|---|---|
| Requestr | ~10-15 s | Open the URL, paste endpoint, Send. No install, no sign-up |
| Insomnia | ~2-3 min | Download, install, open Scratch Pad |
| Postman | ~2-4 min | Download or web app, sign-in prompt, workspace, new request |

Table copy marks them as typical estimates ("about", "~"). Update `comparison.spec.ts` accordingly.

### Motionsites (https://github.com/Motionsites-AI/claude-skill)

- **Confirmed:** word-by-word blur headlines; seamless video loops.
- **3D element:** adopt only if ALL hold: it clearly supports the message (not decorative); looks good in light and dark; lazy-loaded (`dynamic`, below-the-fold or idle), landing only; does not regress budgets in the success criteria; has a static fallback for reduced-motion and no-WebGL. Default decision if any fails: no 3D.
- **Research task (T-R1):** review the 55+ recipe list during implementation research; write a short shortlist note (recipe, section, fit, perf cost) in PLAN.md; adopt only those that fit the design system and budgets. Do not pre-commit to any beyond the two confirmed.

## B. Relay real footage

- Source: one real screen recording of the actual app in which Relay builds and runs a DummyJSON chain: login, capture token, get user, get cart, add product, assert totals. No scripted or synthetic UI. Capture with a Playwright-driven session (video plus deterministic pacing) and/or a screen recorder. Remotion post-production is optional (captions, crop, speed ramps).
- Editing rule (user decision): both cuts may trim or speed up idle and wait time. Relay's actions are never reordered, added or altered. Every accelerated segment in the full modal cut carries a visible "sped up" marker.
- Outputs: a 15-20 s loop, muted and seamless (first and last frames match, no visible jump); a 60-90 s full cut with captions for the modal; mp4 (H.264) and webm for each; one poster (webp + avif). Size budgets: loop ≤ 1.5 MB, full cut ≤ 8 MB, poster ≤ 80 KB.
- Loop uses `DemoVideo`/`IntroClip` patterns (existing `public/intro` clips are reference). Modal cut loads only on open.
- Fallbacks: poster shown until video can play; on `error` the poster stays with no broken-video chrome; `prefers-reduced-motion` shows the poster (loop does not autoplay) and the modal video requires an explicit Play; `preload="none"` or `metadata` for the modal.
- Privacy: recording contains no real keys, emails, or tokens (DummyJSON creds only).

## C. SEO pages

### Pages (slug in `seoPages.ts`; one data-driven template, not 11 hand-built pages)

Feature pages at `/features/<slug>`: `relay` (AI agent), `request-chains`, `transform-playground`, `json-compare`, `json-visualize`, `import` (Postman/Insomnia/OpenAPI/cURL), `collections-environments`, `command-palette`, `backup-restore`. Comparison pages: `/compare/postman`, `/compare/insomnia`.

Each page has: unique `<title>` and meta description (title ≤ 60, description 120-160 chars), `alternates.canonical`, OpenGraph and Twitter metadata, JSON-LD (feature pages: `SoftwareApplication` or `WebPage` + `BreadcrumbList`; compare pages: `WebPage` + `BreadcrumbList`, plus `FAQPage` only if the page has a visible FAQ), exactly one `<h1>`, sitemap entry, real screenshots or loops with descriptive `alt`, internal links (related features, back to hub, and a CTA to the matching tool route where one exists, e.g. `/features/json-compare` → `/json-compare`, otherwise `/app`), design consistent with the landing (`SECTION_*` constants, shadcn/reactbits). Compare pages must contain only factual claims already sourced in `comparison.ts` (existing `source` URLs) and honest "where they are stronger" notes.

Copy: no "cards", "undone", internal jargon, or AI-writing tells. Gate: `copy-editing` pass and `humanizer` pass recorded in PLAN/TASKS before each page ships. `seo-audit`, `ai-seo`, `site-architecture` skills inform keywords, hub-and-spoke linking, and answer-first structure.

### Hub `/features`
Redesign `AllFeaturesPage.tsx` (today: screenshot cards for `preview` features via `features/FeatureCard.tsx` and text-only cards for the rest, data in `data/features.ts`) so flagship features link to their new pages and all existing features sit in one coherent layout. Run `ui-ux-pro-max` / `impeccable` / `frontend-design` review. Every card is a link or is clearly non-interactive; same visual weight rules for screenshot and non-screenshot items.

### Site plumbing
- `src/app/sitemap.ts` lists `/`, `/features`, 9 feature pages, 2 compare pages, `/privacy`, `/terms` (not `/app`, `/api`).
- `src/app/robots.ts` allows crawl of marketing routes, disallows `/api/`, references the sitemap.
- `metadataBase` is set in the layout from `SITE_URL`. The layout's default title/description ("Browser-native API testing tool") is updated to match the new positioning.
- Footer: add "Features" and "Compare" link columns using real routes, replacing today's `#features` / `#compare` anchors. Privacy and Terms stay. Top Nav is unchanged (footer-only, as confirmed).

## D. Legal

Rewrite `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` (layout in `LegalLayout.tsx`, facts in `legal/constants.ts`) The implementer must read and follow `~/.agents/skills/privacy-policy/SKILL.md` and `~/.agents/skills/terms-of-service/SKILL.md` first. Both are installed and are plain drafting guides; invoking the skill alone does not count. Any "[⚠️ LEGAL REVIEW REQUIRED]" notes the skills would produce go into `LEGAL_REVIEW_NOTES.md`, never onto the published pages.

Fixed facts: operator Deepak Dewani (individual), India, governing law India, contact kumard8308887772@gmail.com, free product, no paid tier, no accounts. Do not include billing, subscription, account-termination, or refund sections.

**Data-flow verification (each claim cited to code in LEGAL_REVIEW_NOTES.md):**

| Flow | Where to verify |
|---|---|
| Local-first storage (IndexedDB / localStorage): collections, environments, tabs, history, Relay conversations | `src/stores/*`, persistence helpers |
| Request proxy: method/headers/body forwarded to the target, size caps, logging behaviour | `src/app/api/proxy/route.ts` |
| Upstash Redis: rate limiting, share-link storage and TTL | `src/lib/redis.ts`, `src/lib/shareServer.ts`, `src/lib/relay/server/rateLimit.ts` |
| AI providers: what is sent, which key, retention. **Code today:** Relay chat and `/api/ai` actions go to DeepSeek only (`@ai-sdk/deepseek`, `RELAY_MODEL_ID`, server key `RELAY_API_KEY`/`DEEPSEEK_API_KEY`). OpenAI, Anthropic and Gemini are never called; they appear only in `bannedTokens.ts`. User decision: name DeepSeek and xAI | `src/lib/relay/server/model.ts`, `src/app/api/ai`, `src/app/api/relay/chat` |
| Voice input: browser `SpeechRecognition` (audio may go to the browser vendor) vs server STT via xAI (`XAI_API_KEY`) | `src/hooks/useSpeechDictation.ts`, `src/app/api/relay/stt` |
| Share links: only ciphertext is stored in Redis, and the key stays in the URL fragment (`?s={id}#{key}`), so the server never sees it. Payloads auto-expire after 24 h (`SHARE_PAYLOAD_TTL_SEC`). Hourly rate-limit counter | `src/lib/shareLink.ts`, `src/lib/crypto.ts`, `shareServer.ts`, `src/app/api/share` |
| Relay rate limiting (Upstash, or a local Redis via `REDIS_URL`) | `src/lib/relay/server/rateLimit.ts`, `localRedisCounter.ts` |
| Hub templates: static files served from `public/data/hub`, no third party | `src/app/api/hub/route.ts` |
| Hosting provider (Vercel): sees IPs and request metadata | `package.json` homepage / deployment |
| Third-party fetches: fonts are self-hosted at build by `next/font/google`, and no analytics exist today | `src/app/layout.tsx` |

The privacy page names the providers the code actually calls, not a fixed list. It includes a clause that AI providers may change and that the listed providers are kept current on the page. Data deletion and other requests go through the contact email, which is a standard clause and not a user decision. `LEGAL_REVIEW_NOTES.md` records the India DPDP Act 2023 applicability and the cross-border transfer to DeepSeek and xAI.

Published pages contain no "LEGAL REVIEW REQUIRED" marker in any form, ⚠️ variant included. A case-insensitive `grep -ri "legal review required" src` must come back empty, and this is a test. Items needing a lawyer or the owner's decision go to `agent_docs/landing-seo-polish/LEGAL_REVIEW_NOTES.md`. Anything the code cannot confirm is stated conservatively or flagged there, never asserted.

## E. History sidebar

Files: `src/components/history/HistoryList.tsx`, `HistoryItem.tsx`, `src/stores/useHistoryStore.ts` (read only; storage unchanged), new pure helper `groupHistory.ts`.

Behaviour:
1. **Sticky day headers:** "Today", "Yesterday", then locale dates (e.g. "Mon, 3 Nov"). Day boundaries use the user's local timezone. Entries stay newest-first.
2. **Collapse within a day:** entries with identical `method` + `url` (exact string match) become one row showing method badge, URL, `×N`, latest status, latest time. `N=1` renders as today's single row (no `×1`).
3. **Expand inline:** click the chevron/count to show each run (time + status). Clicking a run restores that run's request (existing `handleClick` logic, per-entry data); each run has its own delete. Deleting the last run removes the group; deleting the latest updates the summary. Clicking the collapsed row opens the latest run.
4. **Virtualized** with `@tanstack/react-virtual` over a flattened row model (header | group | run); sticky headers must still work with virtualization; row height measured since expansion changes height.
5. **Tooltip** with full URL only when the URL is actually truncated (measure `scrollWidth > clientWidth`); no tooltip otherwise.
6. **Search** filters runs first, using the same predicate as today (url, method, `healthKey`), and groups second. A group appears if at least one of its runs matches, and while a filter is active its `×N` and its expanded runs cover only the matching runs.
7. Storage unchanged: every run remains in `useHistoryStore.entries` and is trimmed by `MAX_HISTORY_ENTRIES` as today. Grouping is derived in the view.
8. `compact` mode: no caller passes it today (`LeftPanel` uses the full list), but the prop stays working. Rule: filter, then group, then keep the first 20 groups, with their day headers.
9. Extra UX improvements only if clearly beneficial and small (candidates to evaluate: clearer empty/no-match states, keyboard navigation with arrow keys and Enter, `aria-expanded` on group rows, per-day clear). Each adopted item is listed in PLAN with justification; otherwise dropped.

State: derived data via `useMemo` over store entries; expanded-group ids are ephemeral view state (component state, or a small Zustand store if the sidebar remounts and loses it; decide per CLAUDE.md rules). Not persisted.

## F. Dialog polish (UI + copy only)

Targets: `src/components/import/ImportDialog.tsx` (File/cURL tabs, dropzone, trust warning, format chips, Scan button), `src/components/settings/backup/ExportBackupDialog.tsx` + `BackupSectionPicker.tsx` (Everything / Choose what to include, conversations note, "Include secret values" switch, estimated size, dangling-links message), `ImportBackupDialog.tsx` + `BackupPreview.tsx` + `ReplaceConfirmDialog.tsx` (counts, Merge/Replace, Restore).

Required changes:
- Dangling-links message ("N links point to items that are not in this backup") becomes explained and actionable: what a link is, why it dangles, what happens on restore, what to do (e.g. include those collections).
- Replace is explicit about what is deleted (current local data replaced) before the user commits; Merge says what is kept.
- Consistent button labels across the three dialogs (verbs: Scan / Export / Restore; Cancel everywhere).
- Secret-values switch states the consequence in plain words; default unchanged.
- Hierarchy, spacing, and mobile width reviewed with `impeccable`, `clarify`, `polish`.
- Acceptance: diff touches no `use*Import/Export` hook logic, store, serializer, or parser (reviewed in diff), and existing specs for those hooks pass unchanged.

## Code Style

Follow project and global CLAUDE.md: named constants, small pure functions, early returns, options object past 3 params, comment why, Zustand for cross-cutting state, Context only for one subtree. Data-driven pages:

```ts
// data/seoPages.ts: single source for route, metadata, sitemap and hub links
export const FEATURE_PAGES = [
  { slug: "request-chains", title: "...", description: "...", screenshot: "/screens/chains.webp", related: ["relay", "collections-environments"] },
] as const satisfies readonly FeaturePage[];
export type FeatureSlug = (typeof FEATURE_PAGES)[number]["slug"];
```
Pure grouping helper signature: `groupHistoryByDay(entries: HistoryEntry[], opts: { now: number; filter: string }): HistoryRow[]` where `HistoryRow` is a discriminated union (`header | group | run`).

## Testing Strategy

- **Unit (Vitest, colocated `.spec.ts(x)`):** `groupHistory` (empty, single run, same URL different method, midnight boundary, timezone, filter across runs, delete last run); `seoPages` data (unique slugs, title/description length, every slug in sitemap, every hub link resolves); `sitemap.ts`/`robots.ts`; `comparison.ts` row (no "measured", values match table above); JSON-LD builders produce valid JSON; legal pages contain no `[LEGAL REVIEW REQUIRED]`; landing section order in `LandingPage.spec`; Footer link columns.
- No tests under `src/components/reactbits/`.
- **Remove/update:** specs for deleted components (ComparisonStatStrip, speedProof, relay mock files).
- **Component:** HistoryItem/Group (expand, ×N, tooltip only when truncated), dialogs (labels, messages) with unchanged behaviour assertions.
- **E2E (targeted only, `e2e/landing-seo-polish.spec.ts` + history spec):** landing order and no stat strip; each of 11 routes returns 200 with unique title and canonical and a JSON-LD script; modal opens and plays; history with 500 seeded entries scrolls without long frames and shows day headers; run history expand and restore.
- **Manual/visual:** light and dark, 375 px and 1280 px, reduced-motion on, video blocked (poster fallback). Browser checks use the `agent-browser` skill with a repo-unique session.
- **Perf:** Lighthouse on production build (see criteria).

## Boundaries

- **Always:** use data-driven templates; real captures only; run `humanizer` and `copy-editing` on every user-facing string; keep sitemap, hub, footer driven by `seoPages.ts`; run targeted tests + `bun run verify` before reporting done; keep new client JS lazy on the landing.
- **Ask first:** adding any dependency (3D libs especially); changing route structure beyond this spec; adding analytics; changing `MAX_HISTORY_ENTRIES`; any legal claim the code cannot confirm.
- **Never:** change import/backup/history storage logic; fake or scripted Relay footage; leave "[LEGAL REVIEW REQUIRED]" on published pages; claim "measured" speed; use npm; run the dev server or the full e2e suite; commit unless told; commit secrets or real keys in recordings.

## Success Criteria (testable)

**Landing**
1. DOM order of sections under `<main>` is Hero, Relay, HowItWorks, FeatureShowcase, Command palette, BeyondSend, Import & backup, ComparisonTable, FinalCta (unit + e2e).
2. `grep -rn "ComparisonStatStrip\|speedProof\|6\.6 s\|759 KB" src` is empty, and `grep -rni "measured" src/components/landing src/app/compare` is empty.
3. Above the fold at 1280x800 and 390x844 the hero states that an AI built into the app does API work (checked by a reviewer who has not seen the page: can say what it is within 10 s; record result in TASKS).
4. Comparison row shows the three ranges and one-line bases above; no stopwatch/"measured" language.
5. Relay section contains no component from the deleted mock set; `grep -r "relayDemoEngine\|ChangeCardMock\|SidebarMock" src` is empty.
6. Landing perf on production build, mobile profile: LCP ≤ 2.5 s, CLS < 0.1, TBT not worse than current baseline (captured before work starts in T-0); lazy chunks for video modal and any 3D load only on need.

**Media**
7. Loop is 15-20 s (checked with `ffprobe`), muted, `playsInline`, and seamless: first-vs-last-frame SSIM ≥ 0.98 (ffmpeg `ssim` filter) and a reviewer sees no jump. Full cut is 60-90 s with captions. Both come from the same recorded session, and all six chain steps (login, capture token, get user, get cart, add product, assert totals) are visible. Sped-up spans are marked. Every file is within its size budget in section B.
8. With video blocked or erroring, the poster renders and layout does not shift; with `prefers-reduced-motion: reduce`, the loop does not autoplay and the headline renders without the blur animation (final text visible immediately).

**SEO**
9. 11 new routes return 200, each with unique title and description within length limits, canonical, OG/Twitter, valid JSON-LD (Rich Results / schema validator pass), single H1, ≥1 real screenshot or loop with alt text, links to hub and related pages.
10. `/sitemap.xml` lists every route above and no others; `/robots.txt` references it and blocks `/api/`.
11. Hub links to every flagship feature page; footer has Features and Compare columns with working links; no dead links (link check script/e2e).
12. Copy review: each page's copy has a recorded humanizer + copy-editing pass; banned-term grep ("cards", "undone", "seamlessly", "leverage", "unlock", "supercharge") returns nothing in new page data.

**Legal**
13. Every data-flow row in section D is cited to code in LEGAL_REVIEW_NOTES.md. The privacy page names every AI/STT provider the code calls (today DeepSeek and xAI) and no provider it does not call. It also covers Upstash, the hosting provider, the proxy, encrypted share links with 24 h expiry, browser and server voice input, local-only storage, and email-based deletion requests; terms contain no billing/account sections; operator, governing law (India), and contact email match the fixed facts; no "[LEGAL REVIEW REQUIRED]" in either page.

**History**
14. With 500+ seeded entries, DOM row count stays bounded (virtualized, e.g. < 60 row nodes) and scrolling stays smooth (no long task > 50 ms during scroll in a Playwright trace).
15. No two visible rows in one day share method+URL; collapsed row shows `×N`, latest status, latest time; expand shows N runs; restoring/deleting a run works as before; deleting all runs removes the group.
16. Day headers stay pinned while scrolling their day; "Today"/"Yesterday" correct across local midnight; empty history and no-match states render.
17. Full-URL tooltip appears only when the URL is truncated (short URL: none; long URL: yes).
18. Storage diff: `useHistoryStore` persisted shape and action semantics are unchanged (store spec passes untouched).

**Dialogs**
19. Dangling-links message, Replace/Merge text, button labels as specified; the three dialogs pass an a11y check (focus trap, labelled controls, keyboard operable) and render without overflow at 375 px, light and dark.
20. No change in import/backup hooks, parsers, or serializers; their existing specs pass unmodified.

**Global:** `bun run verify`, `bun run test` (targeted + affected), and `bun run build` are green.

## Edge cases to handle

Empty history; single run (no `×1`); same URL with different methods (separate groups); URL with only query differences (separate groups); very long URLs and no-whitespace URLs (truncate, tooltip, no horizontal scroll); entries spanning midnight and DST changes; history trimmed at the cap while a group is expanded; filter active while expanding; compact mode; reduced-motion users (no blur animation, no autoplay, no 3D); video load failure, slow network, autoplay blocked (poster fallback and a play affordance in modal); mobile (375 px) for landing sections, feature/compare pages, hub, dialogs; dark and light themes for every new screenshot (provide theme-matching assets or neutral frames); JS disabled (marketing pages render content and metadata server-side); 404 for unknown `/features/<slug>` and `/compare/<x>` (`notFound()`); no-WebGL browsers if 3D adopted.

## Task outline (to be expanded in PLAN/TASKS after approval)

- [ ] T-0 Baseline: capture Lighthouse and bundle numbers for `/` and `/features`; Verify: saved report.
- [ ] T-R1 Motionsites recipe research and 3D go/no-go note (criteria in section A).
- [ ] T-B1 Record the real Relay DummyJSON session; cut loop + full cut + poster + captions. Files: `public/media/relay/*`, optional Remotion project outside `src`.
- [ ] T-A1 Landing: reorder, remove stat strip + speedProof, comparison row rewrite, delete relay mocks. Files: `LandingPage.tsx`, `comparison.ts`, specs (<5 files per task; split as needed).
- [ ] T-A2 Hero + Relay section rewrite with blur headline, loop, modal cut.
- [ ] T-A3 Command palette section + screenshot.
- [ ] T-A4 Import & backup section.
- [ ] T-C1 `seoPages.ts`, templates, JSON-LD helper, sitemap, robots, metadataBase, og-image.
- [ ] T-C2 to T-C4 Nine feature pages in three batches (screenshots, copy, review gate each).
- [ ] T-C5 Compare pages (postman, insomnia).
- [ ] T-C6 Hub redesign + footer columns.
- [ ] T-D1 Read both skills, verify data flows, write notes file, rewrite privacy; T-D2 terms.
- [ ] T-E1 `groupHistory` pure helper + specs; T-E2 virtualized list + group row + headers; T-E3 tooltip + search + optional small UX items.
- [ ] T-F1 Import dialog; T-F2 Export backup dialog; T-F3 Import backup + Replace confirm.
- [ ] T-Z Final: targeted e2e, Lighthouse vs baseline, link check, copy gates, build.

## Open Questions

None. All resolved:
- **Origin (user):** one `SITE_URL` setting, set to `https://requestr-api.vercel.app` for now. It flips to `https://requestr.app` once that domain is live.
- **Demo editing (user):** both cuts may trim or speed up idle and wait time, never Relay's actions. The full modal cut shows a "sped up" marker on accelerated segments.
- **AI providers in legal (user):** name DeepSeek and xAI, as in the code, and add a clause that providers may change and the list is kept current.
- **Resolved from code or by default:** OG image (one site-wide image from a real screenshot), share-link retention (24 h, encrypted), deletion requests (by email), Nav (footer-only).
