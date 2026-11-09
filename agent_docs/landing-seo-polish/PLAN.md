# Plan: landing-seo-polish

Source: `SPEC.md` (final). Planning only. TASKS.md is written separately. Commands: `bun` only; targeted vitest/playwright only (`PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`, specs in `e2e/qa/landing-seo-polish/`); never run the dev server. Per phase: targeted vitest, `bunx biome check` on touched files and targeted e2e. `bun run typecheck` / `bun run verify` run once in the final gate (P12); `bun run build` at P0 (baseline), P8 (static params) and P12.

## Overview

Six workstreams (A-F) are sliced into 13 phases (P0-P12). Each phase leaves the app building, passing its targeted specs, and verifiable by itself. Shared foundations come first (baseline, site URL, `seoPages.ts`, capture pipeline), then consumers (landing sections, SEO pages), then independent app-side work (history, dialogs), then legal and the final gate.

## Dependency graph

```
P0 baseline + Motionsites research
 |
P1 foundations: SITE_URL, seoPages.ts + types, JsonLd, sitemap/robots/metadataBase, og-image placeholder
 |                                   \
P2 capture pipeline (screens + Relay recording, loop/full/poster)   (needs: running app, Relay env; no code dep on P1 except /public paths)
 |                \
P3 landing restructure  --> P4 Hero + Relay section (needs P2 media)
 |                          |
 |                          +--> P5 Command palette section (needs P2 screens)
 |                          +--> P6 Import & backup section (needs P2 screens; copy aligns with P10 dialogs, not code-dependent)
 |
P7 SEO templates + 9 feature pages (needs P1, P2 screens; batch C needs P10 dialog shots)  --> P8 compare pages + hub + footer (needs P1, P3, P7)
P9 History sidebar     (independent; may run parallel with P3-P8)
P10 Dialog polish      (independent; parallel; do before P6 screenshots if possible)
P11 Legal              (independent; parallel)
P12 Final gate         (needs everything)
```

Parallel-safe: P9, P10, P11 touch disjoint files from landing/SEO. P10 should land before the P6/P7 screenshots of the dialogs are captured (else recapture).

## Architecture decisions

- Single `SITE_URL` in `src/lib/constants.ts` (default `https://requestr-api.vercel.app`, overridable via `NEXT_PUBLIC_SITE_URL`). Used by `metadataBase`, canonicals, sitemap, robots, OG, JSON-LD, `SharePreview.tsx` mock, `src/app/page.tsx` OG url.
- `src/components/landing/data/seoPages.ts` is the sole source for slugs, metadata, copy, media, related links, sitemap, hub and footer. Pages are one template, SSG, server components.
- Capture pipeline is a script/runbook outside `src` (e.g. `scripts/capture/`) so assets are reproducible; outputs are committed to `public/screens/` and `public/media/relay/`.
- History grouping is a pure helper (`src/components/history/groupHistory.ts`) feeding a virtualized flat row model; store untouched. Expanded ids stay component state unless the sidebar remounts (decide in P9 against CLAUDE.md store rule).
- Dialog work is JSX/copy only; hooks (`useBackupExport/Import`, import parsers) untouched.

## Phases

### P0. Baseline and research (T-0, T-R1)
- Lighthouse (mobile) + bundle numbers for `/` and `/features` against a production build; save report to `agent_docs/landing-seo-polish/baseline/`.
- Motionsites research (https://github.com/Motionsites-AI/claude-skill): read the 55+ recipes, write the shortlist note (recipe, section, fit, perf cost) in the "Motionsites shortlist" section at the bottom of this file, and a 3D go/no-go against the 5 criteria in SPEC A. Default: no 3D.
- Verify: baseline report exists; shortlist and go/no-go recorded. No code change.
- Skills: `lighthouse-cli`, `premium-website-design`, `ui-ux-pro-max`, `impeccable`.

### P1. Foundations: site URL and SEO data (part of T-C1)
- Add `SITE_URL` to `src/lib/constants.ts`; wire `src/app/layout.tsx` (`metadataBase`, new default title/description), `src/app/page.tsx` OG url and canonical, `src/components/landing/features/previews/SharePreview.tsx` mock.
- Create `data/seoPages.ts` (types `FeaturePage`, `ComparePage`; 9 feature slugs + 2 compare entries with placeholder-final metadata, screenshot paths, related, CTA targets), `src/components/seo/JsonLd.tsx` (+ builders), `src/app/sitemap.ts`, `src/app/robots.ts`, and `public/og-image.png` (1200x630; may be refined after P2 screenshots).
- Verify: specs for seoPages (unique slugs, title <=60, description 120-160), sitemap (exact route list), robots, JSON-LD validity, `SITE_URL` override; `grep` shows no hard-coded `requestr.app|requestr.dev` domains outside constants; `/sitemap.xml` and `/robots.txt` respond.
- Skills: `seo-audit`, `ai-seo`, `site-architecture`, `next-best-practices`, `typescript-best-practices`, `code-style`, `test-driven-development`.

### P2. Capture pipeline: screenshots and real Relay footage (T-B1)
- Playwright capture script(s) producing deterministic light + dark screenshots (`public/screens/`: chains, transform, json-compare, json-visualize, import, collections-envs, command palette, relay panel; dialog shots are captured after P10 by the same script with `--only dialogs`) from https://requestly.localhost/app, using DummyJSON seed data from `e2e/dummyjson-api-reference.md`.
- Record the real Relay session (login, capture token, get user, get cart, add product, assert totals) with `NEXT_PUBLIC_RELAY_ENABLED` and the real key (never committed). Post-produce (ffmpeg, optional Remotion): 15-20 s seamless muted loop, 60-90 s captioned cut with "sped up" markers; mp4 + webm each; poster webp + avif into `public/media/relay/`.
- Verify: `ffprobe` durations, size budgets (loop <=1.5 MB, full <=8 MB, poster <=80 KB), first-vs-last frame SSIM >=0.98, all six steps visible, no secrets in frames (manual frame review), reviewer sees no jump.
- Skills: `agent-browser`, `playwright-cli`, `playwright-best-practices`, `remotion-best-practices` / `remotion-captions` (if used), `motion-video-production`, `ui-demo`.
- Risk: Relay key and model availability; re-record cost. Do P2 early, and do P10 before dialog screenshots.

### P3. Landing restructure and comparison rewrite (T-A1)
- `LandingPage.tsx` new order (Hero, Relay, HowItWorks, FeatureShowcase, Command palette slot, BeyondSend, Import & backup, ComparisonTable, FinalCta); command palette renders a temporary minimal stub until P5.
- Delete `ComparisonStatStrip` (+spec), `speedProof.ts` (+spec); rewrite the "Time to first request" row in `data/comparison.ts` + `comparison.spec.ts`; add a new `LandingPage.spec.tsx` order spec. `Nav.tsx` stays unchanged: its anchors (hero, how-it-works, features, compare) already follow the new order.
- Delete relay mocks (`ChangeCardMock`, `SidebarMock`, `RelayDemoPanel`, `relayDemoEngine`, `scenarios`, `useRelayDemo` + specs) and replace `RelaySection.tsx` with a poster-only shell (real poster from P2) so the build stays green; real section in P4.
- Verify: SPEC criteria 1, 2, 4, 5 greps and specs; `bunx biome check` on touched files; targeted vitest in `src/components/landing`.
- Skills: `code-simplification`, `typescript-best-practices`, `code-style`, `copywriting` + `copy-editing` + `humanizer` (comparison basis strings).

### P4. Hero + Relay section (T-A2)
- Hero headline/sub-line (Relay-first); `RelaySection` rewrite: word-by-word blur headline (confirmed Motionsites recipe, reduced-motion renders final text), real loop via `DemoVideo` (poster until playable, error keeps poster, reduced-motion = poster), `DemoModal` with full cut lazy-loaded with explicit Play; `WatchDemoButton` and section play affordance open it. Adopt any shortlisted recipe/3D only if P0 said go.
- Files: `Hero.tsx`, `relay/RelaySection.tsx`, `DemoModal.tsx`, `DemoVideo.tsx`, `WatchDemoButton.tsx`, `constants.ts`, specs.
- Verify: specs (blur fallback, poster on error, reduced-motion, modal lazy); `agent-browser` at 1280x800 and 390x844 light/dark, video-blocked, reduced-motion; fresh reviewer 10 s test recorded; banned-term grep.
- Skills: `ui-ux-pro-max`, `impeccable`, `frontend-design`, `premium-website-design`, `gsap-core`/`motion` recipes if shortlisted, `copywriting`, `copy-editing`, `humanizer`, `vercel-react-best-practices`, `agent-browser`.

### P5. Command palette section (T-A3)
- New `CommandPaletteSection.tsx` (real screenshot via `ProductVisual`/`next/image`, copy on keyboard reach), shared `SECTION_*` constants; replaces the P3 stub.
- Verify: section spec, order spec, visual at both widths/themes, CLS check.
- Skills: `ui-ux-pro-max`, `impeccable`, `frontend-design`, `copywriting`, `copy-editing`, `humanizer`, `shadcn`.

### P6. Import & backup section (T-A4)
- Expand `ImportSection.tsx` into two delineated groups (import formats; export/restore backup) with real screenshots; update spec.
- Verify: spec, visual at both widths/themes, order spec.
- Skills: `ui-ux-pro-max`, `impeccable`, `frontend-design`, `copywriting`, `copy-editing`, `humanizer`.

### P7. SEO templates + 9 feature pages (T-C1 remainder, T-C2 to T-C4)
- `src/components/seo/FeaturePageLayout.tsx`, `src/app/features/[slug]/page.tsx` (`generateStaticParams`, `generateMetadata`, `notFound()`), then final copy and media for 9 pages in three batches of 3 (relay, request-chains, transform-playground / json-compare, json-visualize, import / collections-environments, command-palette, backup-restore). Each batch: copy gate (`copy-editing` + `humanizer`), banned-term grep, recorded in TASKS.
- Verify per batch: 200, unique title/canonical, JSON-LD, one H1, alt text, internal links, CTA route; curl-free check via `agent-browser` or e2e; 375 px and 1280 px.
- Skills: `seo-audit`, `ai-seo`, `site-architecture`, `copywriting`, `copy-editing`, `humanizer`, `ui-ux-pro-max`, `impeccable`, `frontend-design`, `next-best-practices`.

### P8. Compare pages, hub redesign, footer (T-C5, T-C6)
- `src/app/compare/[competitor]/page.tsx` + `ComparePageLayout.tsx` using only sourced facts from `comparison.ts` and honest "where they are stronger" notes (+ `FAQPage` only with visible FAQ). Redesign `AllFeaturesPage.tsx` (flagships link to pages, `features/FeatureCard.tsx`, `data/features.ts`). `Footer.tsx` Features/Compare columns from `seoPages.ts`; update `Footer.spec.tsx`; keep Nav unchanged.
- Verify: link check (no dead links), sitemap lists all 11 + base routes, no "measured" in compare, `bun run build` for static params.
- Skills: same as P7 plus `critique`, `layout`, `web-design-guidelines` for hub.

### P9. History sidebar (T-E1 to T-E3; independent)
- T-E1 `groupHistory.ts` + spec (pure, TDD). T-E2 virtualized `HistoryList.tsx` with sticky day headers, new `HistoryDayHeader`/`HistoryGroupRow`, run expand/restore/delete. T-E3 truncation-only tooltip in `HistoryItem.tsx`, search-first filtering, compact rule (first 20 groups), a11y (`aria-expanded`), optional small UX items each justified in this file.
- `groupHistoryByDay(entries, { now, filter })` keeps the SPEC signature; a second pure `toVisibleRows(rows, expandedIds)` applies expansion for the virtualizer.
- Verify: specs per SPEC testing list; `store spec unchanged`; e2e in `e2e/qa/landing-seo-polish/history-grouping.spec.ts` and `history-virtualization.spec.ts` (plus the existing `e2e/history.spec.ts` regression) with 500 seeded entries (DOM rows <60, no long task >50 ms); midnight/DST cases.
- Skills: `test-driven-development`, `vercel-react-best-practices`, `typescript-best-practices`, `frontend-ui-engineering`, `playwright-best-practices`, `agent-browser`.

### P10. Dialog UI and copy polish (T-F1 to T-F3; independent)
- `ImportDialog.tsx`; `ExportBackupDialog.tsx` + `BackupSectionPicker.tsx`; `ImportBackupDialog.tsx` + `BackupPreview.tsx` + `ReplaceConfirmDialog.tsx`: dangling-links explanation, explicit Replace/Merge text, consistent verbs, secret-values consequence.
- Strings: `ImportDialog` stays hardcoded English (no next-intl today). The backup dialogs use next-intl (`settings`, `common`): add `en` keys, then keep `fr`/`ja` parity in one locale task.
- After polish, capture dialog screenshots (`--only dialogs`) for P6 and P7 batch C.
- Verify: updated dialog specs, hook/parser specs pass unmodified, `git diff` touches no hook/store/serializer, 375 px light/dark, focus trap and keyboard.
- Skills: `impeccable`, `clarify`, `polish`, `ui-ux-pro-max`, `frontend-design`, `copywriting`, `copy-editing`, `humanizer`, `shadcn`, `shadcn-component-rules`.

### P11. Legal rewrite (T-D1, T-D2; independent)
- Read `~/.agents/skills/privacy-policy/SKILL.md` and `terms-of-service/SKILL.md` first. Verify every data-flow row from SPEC D against code, writing citations into `LEGAL_REVIEW_NOTES.md` (incl. DPDP 2023 and cross-border to DeepSeek/xAI). Rewrite `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/legal/constants.ts` (effective date at publish time), `LegalLayout.tsx` if needed. Add a spec asserting no "legal review required" (case-insensitive).
- Verify: `grep -ri "legal review required" src` empty; providers match code; terms have no billing/account sections; fixed facts match.
- Skills: `privacy-policy`, `terms-of-service`, `copywriting`/`copy-editing`/`humanizer`, `repo-scout`.

### P12. Final gate (T-Z)
- Targeted e2e `e2e/qa/landing-seo-polish/*.spec.ts` (+ `e2e/history.spec.ts`; the SPEC's single `e2e/landing-seo-polish.spec.ts` is split per user flow under the QA harness), Lighthouse on production build vs P0 baseline (LCP <=2.5 s, CLS <0.1, TBT not worse), link check, banned-term and `speedProof` greps, copy-gate log, `bun run verify`, `bun run test` (affected), `bun run build`. Advisor audit of the full diff.
- Skills: `lighthouse-cli`, `playwright-best-practices`, `seo-audit`, `code-review-and-quality`, `agent-browser`.

## Checkpoints
After P1: typecheck, specs, sitemap/robots live. After P2: assets within budget. After P4: landing demonstrable end-to-end. After P8: SEO surface complete and build green. After P11: all workstreams done, then P12.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Relay recording fails or looks off | High | Do P2 early; keep the Playwright pacing script; re-record is cheap |
| LCP regression from video/blur | High | Poster-first, lazy modal, P0 baseline, check at P4 |
| Virtualization + sticky headers + variable heights | Med | Pure model first (P9 T-E1), measure rows, test in e2e |
| Screenshots outdated after dialog polish | Med | P10 before dialog captures |
| Legal claims unverifiable | Med | State conservatively; flag in `LEGAL_REVIEW_NOTES.md` |
| 3D scope creep | Low | Default no-3D; "Ask first" on any dependency |

## Motionsites shortlist (filled in P0)
Source: Motionsites-AI/claude-skill, `references/techniques/INDEX.md` (58 tested recipes in 7 files; read INDEX plus `3d-and-webgl.md`). Researched in T0.2. Vanilla/React recipes are re-implemented with the project's existing motion tooling and CSS; nothing is installed.

| Recipe | Landing section | Fit with design system | Perf cost |
|---|---|---|---|
| Word-by-word blur-in headline (confirmed) | Relay headline | Fits: plain type, token colours, no new font. Reduced-motion shows the text at rest | light (CSS/transform, opacity, filter on a few words) |
| Seamless video loop with rAF opacity fades (confirmed) | Relay media loop | Fits: `DemoVideo`/`IntroClip` patterns; poster-first | light (one muted <=1.5 MB clip, poster until playable) |
| Staggered blur-rise load choreography | Hero and Relay entrance | Fits: same blur-rise vocabulary as the headline | light |
| Viewport-triggered staggered reveal | Every section below the hero | Fits: subtle, one shared helper | light |
| Count-up stats | Comparison "Time to first request" row only if it stays a stated estimate | Partial: only with "about/~" wording, else skip | light |
| In-page product UI mockup | none | Rejected: SPEC forbids scripted mocks; real screenshots only | n/a |
| Cinematic background video, liquid glass, scroll-scrubbed video, sticky stage, marquees, sand dissolve | none | Rejected: dark-cinematic or heavy styling clashes with the light/dark token system and the LCP/TBT budget | medium to heavy |

Baseline to protect (T0.1, mobile): `/` LCP 10.7 s, CLS 0, TBT 150 ms; `/features` LCP 11.1 s, CLS 0, TBT 0 ms. Only "light" recipes are shortlisted.

### 3D go/no-go (SPEC section A, all five must pass)

Candidate considered: "Real 3D model hero (Three.js + GLB)" and "Animated shader backdrop" (both rated heavy in the library).

1. Supports the message (Relay is AI built into the app that does API work): FAIL. A 3D object would be decorative; the real Relay footage already shows the message.
2. Looks right in light and dark: FAIL. Both recipes are authored for dark backgrounds; no verified light-theme variant.
3. Lazy-loaded below the fold or idle, landing only: PASS in principle (`dynamic`, IntersectionObserver pause), but it adds a heavy chunk.
4. No budget regression (LCP/CLS/TBT/First Load JS vs the T0.1 baseline): FAIL. Three.js plus a GLB adds a large chunk and main-thread work against an already high 10.7 s mobile LCP.
5. Static fallback for reduced-motion and no-WebGL: PASS (recipes ship a PNG fallback), but this needs authored art.

Decision: **NO 3D** (3 of 5 fail). Re-open only if all five pass.

Ask first (not done): adopting any 3D or animation library would add a dependency (`three`, or `motion`/`framer-motion` if not already present). Question for the owner: "Approve adding a dependency for Motionsites effects?" Default answer assumed: no; `package.json` is unchanged.
