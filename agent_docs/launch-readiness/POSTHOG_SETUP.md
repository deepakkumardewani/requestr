# PostHog provisioning (manual fallback checklist)

This is the documented fallback for R60/R61 (R62). It never blocks other work: analytics ships dark
(`NEXT_PUBLIC_ANALYTICS_ENABLED=false`) until the deliberate final switch. Never commit or paste real secret values.

Provisioning status (Phase 10): the PostHog MCP was not connected in the build environment, and the Vercel CLI is
logged in but the repo is not linked (no `.vercel/project.json`). All steps below are therefore pending manual work.

## Recorded ids

SURVEY_ID: pending-manual
DASHBOARD_ID: pending-manual

Replace the two values above with the real ids once created, and set `POSTHOG_FEEDBACK_SURVEY_ID` to the survey id.

## 1. Project (R60)

- [ ] Create or confirm the PostHog project in the US region (`https://us.posthog.com`).
- [ ] Copy the public project key (value for `POSTHOG_KEY`; it is only read server-side by `/api/ingest`).

## 2. Feedback survey (R60)

- [ ] Create a survey in API mode (no PostHog-rendered UI) with three questions: rating 1-5, open text, email (optional).
- [ ] Launch the survey and copy its id into `SURVEY_ID:` above and into `POSTHOG_FEEDBACK_SURVEY_ID`.
- [ ] Note each question id; responses arrive as `survey sent` events with `$survey_id` and `$survey_response_<question_id>`.

## 3. "Launch" dashboard (R60)

Create a dashboard named "Launch" and record its id in `DASHBOARD_ID:` above, with these four insights:

- [ ] Activation funnel: `app_opened` (first session, `is_first_session = true`) -> `tour_*` (`tour_started`/`tour_completed`) -> `first_request_sent` -> `request_saved` -> `chain_run` or `relay_opened`.
- [ ] Feature usage: counts of `request_sent`, `chain_run`, `relay_*` (e.g. `relay_opened`, `relay_message_sent`), `share_created`.
- [ ] Retention: `app_opened` retention, broken down by `days_since_last_bucket`.
- [ ] Landing -> app conversion: funnel `landing_viewed` -> `landing_cta_clicked` -> `app_opened`, broken down by `referrer_domain`.

## 4. Vercel environment variables (R61)

Set with `vercel env add <NAME> <environment>` (after `vercel link`) or in the Vercel dashboard. Do not print values into logs.

- [ ] `POSTHOG_KEY` (all environments)
- [ ] `POSTHOG_HOST=https://us.i.posthog.com` (all environments)
- [ ] `POSTHOG_FEEDBACK_SURVEY_ID` (all environments)
- [ ] Verify with `vercel env ls` that the three server vars are present.
- [ ] `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, and only at the production switch (section 6). It is inlined at build time, so a redeploy is required.

## 5. Pre-merge verification (T10.6)

- [ ] With the server env set locally, send one allowlisted test event, one survey response and one `$exception` through `src/lib/analytics/server/posthogSink.ts` and confirm all three appear in PostHog Live events (the survey response as `survey sent`, the exception under error tracking).
- [ ] If the `$exception_list` or `survey sent` wire shapes need adjusting, change only `posthogSink.ts` and its spec.

## 6. Post-merge production switch (manual, list in the PR)

- [ ] Confirm the analytics notice, the Settings toggle and the rewritten privacy page are deployed. Analytics never goes live before they ship.
- [ ] Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only.
- [ ] Redeploy (build-time inlined).
- [ ] Trigger an event in the app and confirm it appears in PostHog Live events; confirm the "Launch" dashboard populates.
