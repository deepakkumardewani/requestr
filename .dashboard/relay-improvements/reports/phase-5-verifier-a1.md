# Phase 5 verifier a1: FAIL
- Unit/vitest (12 files, 208 tests) pass; biome clean on touched src; sign-off logged; check-ids OK; playwright kinds spec 12/12 (x2) but only because all 6 tests use test.fail().
- FAIL P5.10 / app bug: messages/{en,fr,ja}/relay.json lack tools.{create_graphql_request,create_websocket_request,create_socketio_request,update_tab_request,get_tab_request}.{running,done} (only the status-line keys ~line 280 exist; tools section ends around create_request/update_request). ToolRow emits next-intl MISSING_MESSAGE, failing the console guard. Fix: add running/done to all 3 locales, remove test.fail() (spec lines 175,201,218,236,303,341) and APP_BUG constant, re-run --repeat-each=5.
- messages/ is outside P5 Files lists but required by FR-140..143 UX.
