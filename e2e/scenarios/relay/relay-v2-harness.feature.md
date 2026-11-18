# Feature: Relay v2 e2e helper self-test

Tests in `e2e/qa/relay/relay-v2-harness.spec.ts`. Exercises the T0.3 helpers (`relayRoutes.ts`, `relayV2Helpers.ts`, `speechStub.ts`) through minimal consumers so later phases can rely on them. This spec tests tooling, so empty, error and persistence cases do not apply.

---

@critical
## Scenario: [REL-V2-HARNESS-01] a scripted ask_user stream renders a question card and the body capture helper returns the last user message

@high
## Scenario: [REL-V2-HARNESS-02] a scripted multi-step tool turn with delays and a step-cap hit completes deterministically

@high
## Scenario: [REL-V2-HARNESS-03] the IDB dump helper returns per-store records for seeded data

@medium
## Scenario: [REL-V2-HARNESS-04] the computed-colour helper returns an rgb that differs from the var(--primary) probe

@high
## Scenario: [REL-V2-HARNESS-05] the twoContexts helper opens two isolated profiles with separate IndexedDB

@medium
## Scenario: [REL-V2-HARNESS-06] the fake-audio flags plus STT page.route mock return a transcript
