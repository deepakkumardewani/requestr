# P7.7 gate report (attempt 1): FAIL on non-Relay route growth
Passing: vitest relay+i18n (76 files, 2242 tests); playwright code+pills --repeat-each=2 (20 passed); check-ids OK; lint:check clean; BRAND_GREP exit 0; grep -c "After Phase 7" = 2.
Bundle (scratch builds, same script): shared 157.4 kB = baseline. Highlighter (token classes, JsonText, ArrowFunction) only in lazy chunks 178a5436a1290e1f, 3a0c26a1e20cae7f, 538d57e8b6dbf659, 92ca029859eac69c; none in shared or any route initial list.
Non-Relay routes grew vs P0.1 baseline: /import 360.0 -> 365.7, /_not-found 328.2 -> 333.8, /transform 352.1 -> 357.4 (about +5.6). P6 HEAD build (a14f404) = 333.4 for /_not-found, so Phase 7 added +0.4 kB; Phases 1-6 added +5.2 kB. Cause: Relay shell code in root layout chunks (useRelayStore, Relay strings in /_not-found initial chunks).
Full tables: agent_docs/relay-improvements/BUNDLE.md "After Phase 7".
