# PostHog provisioning (manual fallback checklist)

This is the documented fallback for R60/R61 (R62). It never blocks other work: analytics ships dark
(`NEXT_PUBLIC_ANALYTICS_ENABLED=false`) until the deliberate final switch. Never commit or paste real secret values.

Provisioning status (Phase 10): provisioned via the PostHog MCP and the Vercel CLI (project `requestly`, PostHog project 488071, US).
Sections 1-5 are done; section 6 (the production switch) stays a post-merge manual step.

## Recorded ids

SURVEY_ID: 01a20880-982c-0000-2f4e-874534fb3a96
DASHBOARD_ID: 2399994

The two ids above are the real ones; `POSTHOG_FEEDBACK_SURVEY_ID` in Vercel is set to the survey id.

## 1. Project (R60)

- [x] Create or confirm the PostHog project in the US region (`https://us.posthog.com`).
- [x] Copy the public project key (value for `POSTHOG_KEY`; it is only read server-side by `/api/ingest`).

## 2. Feedback survey (R60)

- [x] Create a survey in API mode (no PostHog-rendered UI) with three questions: rating 1-5, open text, email (optional).
- [x] Launch the survey and copy its id into `SURVEY_ID:` above and into `POSTHOG_FEEDBACK_SURVEY_ID`.
- [x] Note each question id; responses arrive as `survey sent` events with `$survey_id` and `$survey_response_<question_id>`.

## 3. "Launch" dashboard (R60)

Dashboard: https://us.posthog.com/project/488071/dashboard/2399994. Survey question ids: `rating`, `text`, `email`.

Create a dashboard named "Launch" and record its id in `DASHBOARD_ID:` above, with these four insights:

- [x] Activation funnel: `app_opened` (first session, `is_first_session = true`) -> `tour_*` (`tour_started`/`tour_completed`) -> `first_request_sent` -> `request_saved` -> `chain_run` or `relay_opened`.
- [x] Feature usage: counts of `request_sent`, `chain_run`, `relay_*` (e.g. `relay_opened`, `relay_message_sent`), `share_created`.
- [x] Retention: `app_opened` retention, broken down by `days_since_last_bucket`.
- [x] Landing -> app conversion: funnel `landing_viewed` -> `landing_cta_clicked` -> `app_opened`, broken down by `referrer_domain`.

## 4. Vercel environment variables (R61)

Set with `vercel env add <NAME> <environment>` (after `vercel link`) or in the Vercel dashboard. Do not print values into logs.

- [x] `POSTHOG_KEY` (all environments)
- [x] `POSTHOG_HOST=https://us.i.posthog.com` (all environments)
- [x] `POSTHOG_FEEDBACK_SURVEY_ID` (all environments)
- [x] Verify with `vercel env ls` that the three server vars are present.
- [ ] `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only, and only at the production switch (section 6). It is inlined at build time, so a redeploy is required.

## 5. Pre-merge verification (T10.6)

- [x] With the server env set locally, send one allowlisted test event, one survey response and one `$exception` through `src/lib/analytics/server/posthogSink.ts` and confirm all three appear in PostHog Live events (the survey response as `survey sent`, the exception under error tracking).
- [ ] If the `$exception_list` or `survey sent` wire shapes need adjusting, change only `posthogSink.ts` and its spec.

Evidence (2026-11-23, HogQL via the PostHog MCP, `distinct_id = 't10-6-sink-check'`): `app_opened`; `survey sent` with `$survey_id` = the survey id above, `$survey_response_rating` = 5 and `$survey_response_text` = "T10.6 sink check"; `$exception` with `$exception_list` = `[{"mechanism":{"handled":false,"type":"window"},"stacktrace":{"frames":[{"filename":"a.ts","lineno":1}],"type":"raw"},"type":"Error","value":"T10.6 sink check"}]`. Re-check with `SELECT event FROM events WHERE distinct_id = 't10-6-sink-check'`.

## 6. Post-merge production switch (manual, list in the PR)

- [ ] Confirm the analytics notice, the Settings toggle and the rewritten privacy page are deployed. Analytics never goes live before they ship.
- [ ] Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` in Production only.
- [ ] Redeploy (build-time inlined).
- [ ] Trigger an event in the app and confirm it appears in PostHog Live events; confirm the "Launch" dashboard populates.
