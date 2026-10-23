# Phase 5 builder a3
R1/R3: redact.ts gains redactHistory/hasUnredactedHistorySecret (tool part input/output/errorText only); contextBuilder uses it. Structure and user/assistant text untouched.
R2: route.ts checks context and history separately (depth matches client); route.spec has nested 23-level accept case and tool-output leak reject case (replaced user-text reject).
Q1: PICKER_* constants in e2e/fixtures/relayE2eHelpers.ts.
Evidence: vitest scoped 112 files/2117 passed; lint:check exit 0; typecheck exit 0; playwright 7 specs 50 passed; check-ids OK.
Decision: user/assistant text not redacted (FR-60 scope).
