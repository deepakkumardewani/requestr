# Phase 12 verifier a1
FAIL overall due to P12.4 only; everything else verified PASS by my own runs.
- P12.1 PASS: both grep counts =1; package.json/bun.lock changed only by P12.8 (axe devDep + lock entries).
- P12.2 PASS: biome clean; vitest relay+i18n 58 files/2172 pass; ContextChips useMemo for chips/attachedKeys.
- P12.3 PASS: biome clean; brandGuard covers history/speech/nav/fixtures; parity spec checks common.history + navigation.breadcrumbHome in en/fr/ja; planted-token test pre-exists (line 115); BRAND_GREP exit 0; no skip/only/fixme.
- P12.4 FAIL: Acceptance "No growth in ... non-Relay route first-load JS versus baseline". BUNDLE.md Final shows +7.1..+8.0 kB on all non-Relay routes (/import 360.0 -> 367.9, /_not-found 328.2 -> 336.0). The user's 2026-10-16 acceptance covered only ~+5.6 kB (Checkpoint 7); final is +2.2 kB beyond it and has no new owner approval. Builder's own text says "recorded for an owner decision". Shared chunk 157.4 no growth and highlighter/speech lazy-only (AC-24 SPEC wording met), but the task AC is not. Needs either lazy-loading the Relay shell or explicit owner acceptance of the larger delta (then record it in BUNDLE.md). I did not rebuild; relied on the builder's table (it fails by its own numbers).
- P12.5 PASS: 61 tests pass; aggregate lines 100 / branches 93.26 / funcs 100 / stmts 97.98; RelayConversation 100/92.13/100/96.84; render-count specs use Profiler/mocked derivation; uncovered lines justified as defensive.
- P12.6 PASS keyboard 10/10 x5 retries=0; P12.7 mic 5/5; P12.8 axe 10/10 (real AxeBuilder, passes>0 guard, serious/critical filter); P12.9 layout 10/10; check-ids OK (11/11); seed rebuilt.
- P12.10 PASS on commands: vitest --coverage 420 files/5997 pass, lines 95.7; tsc 0; lint:check clean; playwright e2e/qa/relay x2 286 passed retries=0; chain trio 198 passed; check-ids OK; BRAND_GREP 0.
  Unrelated spec edit (chaining-ui-overhaul PICKER-4 regex /POST\s*3\d/ -> /POST\s*\d{2,3}/): legitimate fixture interaction (new 500-request relay seed adds POSTs); PATCH count assertion kept; slightly weaker but justified and documented in comment. Acceptable.
- P12.11 PASS on mechanics: all REL ids cited in coverage table exist in e2e/qa/relay and relay run green x2; no agent-browser.
- P12.12: lint/tsc/vitest/BRAND_GREP re-run green; sign-offs P5.1, P7.1, P12.1 logged. AC-24 row depends on P12.4, which fails.
