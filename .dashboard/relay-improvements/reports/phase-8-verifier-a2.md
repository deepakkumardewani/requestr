Phase 8 verifier a2: FAIL (single hygiene issue)
- vitest checkpoint: 114 files, 3047 passed, no it.fails/test.fail/skip/only/fixme in phase specs (grep empty).
- qol stop/rewrite/actions/followups: each 15/15 passed at --repeat-each=5. relay-chat+threads 22/22. check-ids OK. lint:check clean. BRAND_GREP exit 0. typecheck clean.
- Coverage: unit lowest useRelayChat 97.58 stmts/94.69 br; components lowest RelayComposer/Conversation 96.84 stmts/92.13 br; new files 100%.
- a1 issues fixed: UserMessageActions focus via effect + real it(); lastUserId used for showEdit; test.fail removed.
- FAIL: stray untracked sed backup files committed-to-be: src/components/relay/MessageActions.spec.tsx-E and src/components/relay/UserMessageActions.spec.tsx-E (stale copies with old assertions). Delete them.
