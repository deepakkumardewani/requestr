Phase 8 verifier a1: FAIL
- vitest src/lib/relay src/components/relay src/hooks src/stores src/i18n: 114 files, 3046 passed | 1 expected fail (it.fails in UserMessageActions.spec.tsx:56).
- lint:check clean; check-ids.sh OK.
- BUG1 src/components/relay/UserMessageActions.tsx:24-26 close() focuses buttonRef.current which is null (edit button unmounted) -> focus not returned. Spec uses it.fails (forbidden). Fix source, convert to it().
- BUG2 src/components/relay/RelayConversation.tsx:340/358 lastId = messages.at(-1)?.id; edit is offered only if user msg is the thread's last, so never after an answer. Need last user message id for showEdit (line 250) and drop the isLast dependency.
- e2e rewrite spec: REL-QOL-03 and REL-QOL-09 fail (test.fail() at spec lines 95, 116, remove after fix); 1 passed, 2 failed in single run.
- Other e2e specs not run (phase already failing).
