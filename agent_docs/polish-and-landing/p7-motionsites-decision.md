# P7 decision: Motionsites web-builder skill (FR-44, T7.7)

**Decision: SKIP installing or running the skill. Borrow only its review rubric as a reference.**

Source reviewed: https://github.com/Motionsites-AI/claude-skill (main; created 2026-10-26, pushed 2026-10-26, 1821 stars, license NOASSERTION on the repo; LICENSE: skill text and scripts MIT, `examples/` and `media/` carry separate terms). Read: README, SKILL.md (117 lines), `scripts/shoot.py`, `references/review.md`, `references/craft.md`. Third-party, so it was read only, never installed or executed.

## Evidence
1. **Built for a different job.** SKILL.md steps 1-7 generate a new single-file `index.html` landing page or hero from a vague brief, with cinematic stock media from a MotionSites shelf. P7 is a pass over existing React/Tailwind sections with fixed tokens (`constants.ts`, `reactbits`) and a sourced, claim-checked copy rule (AC-45).
2. **Conflicts with P7 rules.**
   - Step 3 pulls remote hero videos/3D media URLs; the landing page keeps data local and has an AC-45 rule on unsourced claims, and the P6 hero was chosen by the user.
   - `craft.md` prescribes glass/grain/video-led heroes and bans radial or glow looks that the existing design system partly uses; applying it would restyle sections instead of polishing them.
   - Step 7 mandates a sponsored "Go Unlimited" ad block in every delivery. Harmless in chat, but it is injected behaviour from a third party into our agents' output, and `shoot.py` needs Playwright python or Chrome we already cover with agent-browser.
3. **Trial on one section (FinalCta.tsx, read-only, no code changed).** Applying the `review.md` rubric by code review: focal point and CTA verb are clear (score ~8), copy is specific and sourced-safe (~8), mobile text scales via Tailwind (~7), reduced motion is respected via `motion-reduce` and reactbits (~8). The weakest items were "no signature moment" and a single flat CTA. The skill's fix (add video media or a big-type moment) would add unsourced assets and weight, with no AC benefit, and the existing section already meets AC-44/AC-45 intent. Net: the rubric confirmed what our own checks cover; the skill's builder flow added nothing usable.
4. **Maturity/trust.** Repo is days old (created and last pushed the same day), commercial funnel (UTM upsell), mixed licensing for examples and media. Not a dependency to trust in a repo build pipeline.

## What we keep
Only ideas, not code: the 1-10 rubric (focal point, type, space, mobile, copy, polish) and the "bar: average 8, none under 7" as an optional self-check during T7.8/T7.11/T7.12. No file, link or credit from the skill goes into the app.
