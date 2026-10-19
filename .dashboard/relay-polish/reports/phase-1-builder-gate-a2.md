# P1.10 gate a2
Result: PASS. All Checkpoint 1 commands run fresh.
- vitest src/components/relay src/lib/relay src/hooks src/i18n: 110 files, 2953 tests pass.
- relay-polish-msg.spec --repeat-each=3: 27 passed (all 9 tests, none test.fail). qol-actions + relay-chat: 19 passed.
- check-ids OK; lint:check exit 0; typecheck exit 0 (after fixing Page import and evaluate param types); brandGuard 12 passed; thumbs grep exit 0.
## MSG-04 investigation: test-fixture problem, not an app bug
Cause: the scripts pushed tool-input/output and then text in the same step. useRelayChat.shouldContinueToolLoop uses lastAssistantMessageIsCompleteWithToolCalls, which checks the last step only, so the client auto-resubmitted; status never settled and MessageActions (shown only when settled) never rendered. A real server emits finish-step/start-step after the tool result. Fix: NEXT_STEP_CHUNKS pushed after every tool result in the spec (5 places). test.fail removed.
## MSG-06 restored
Seeds a stored thread (step-start, text, tool-web_search output-available, step-start, text) into IndexedDB relay_threads, page.reload(), opens the thread list, selects it, asserts order with expectBefore. Passes x3.
Also: replaced waitForTimeout clipboard loop in MSG-04 with expect.poll.
Files: e2e/qa/relay/relay-polish-msg.spec.ts
