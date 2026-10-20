Phase 2 builder a3b (P2.7/P2.8 follow-ups)
- RelayRoot.tsx: dynamic loader .catch -> RelayLoadError (new RelayLoadError.tsx + spec); relay.json dockLoadError en/fr/ja.
- RelayRootChunkFailure.spec.tsx: failure-path unit spec.
- RelayHeader.tsx: HEADER_TOOLTIP_DELAY_MS 700 -> 500.
- relay-polish-shell.spec.ts: test.fail removed from SHELL-11 (asserts toggle + relay-dock-error), SHELL-05 bounds 850 -> 700.
- vitest relay/layout/i18n: 46 files, 1552 passed; typecheck clean; playwright shell spec --repeat-each=3: 33 passed (one earlier SHELL-08 flake under load, passed 3/3 isolated and in the final run).
