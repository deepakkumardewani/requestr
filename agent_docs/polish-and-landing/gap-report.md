# Gap report: Postman / Insomnia features Requestr lacks

Report only. No implementation (FR-32). Date checked: 2026-11-07. Requestr state comes from `research/requestr.md` (code search of `src/`); competitor state from `research/postman.md`, `research/insomnia.md` and the extra pages below. Every source URL returned HTTP 200 on 2026-11-07 (see `research/url-check.md` for the first ten; the rest were fetched in this task).

## Rubric

Each item is scored on two axes, then ranked by value, with smaller size first on ties.

- **Value (1-5):** how many typical API-client users hit the gap (5 = most), and whether its absence blocks a Postman/Insomnia migration.
- **Effort size:**
  - **S** = about 1-3 days, one module, reuses existing code (for example a new auth editor tab).
  - **M** = about 1-2 weeks, new runner or store plus UI, no new infrastructure.
  - **L** = more than 2 weeks, or needs a new backend, accounts or hosting.
- **Rank:** higher value first; ties go to the smaller size.

## Ranked gaps

| Rank | Feature | Requestr today | Competitor evidence (source URL) | Rationale | Value | Size |
|---|---|---|---|---|---|---|
| 1 | OAuth 2.0 auth flow | Bearer, basic, API key only; no OAuth (`src/components/request/AuthEditor.tsx`) | Postman: https://learning.postman.com/docs/sending-requests/authorization/oauth-20/ ; Insomnia: https://docs.insomnia.rest/insomnia/authentication | Most real APIs use OAuth 2.0; without it users must paste tokens by hand. Fits the existing auth editor. | 5 | S |
| 2 | Collection runner with iterations and data files | Chain runner exists (`src/lib/chainRunner.ts`) but no runner over a whole collection or CSV/JSON data | Postman: https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/ | Regression runs over a collection are a core Postman habit; builds on the chain runner. | 5 | M |
| 3 | Secrets vault for sensitive variables | Plain environment variables only (`src/stores/useEnvironmentsStore.ts`) | Postman: https://learning.postman.com/docs/sending-requests/postman-vault/postman-vault-secrets/ | Keeps tokens out of exports, share links and backups; a trust item for a browser app. | 4 | S |
| 4 | Server-Sent Events client | No SSE client in `src/` | Insomnia: https://insomnia.rest/pricing/ and https://github.com/Kong/insomnia/blob/develop/README.md | Needed for streaming and LLM APIs. Browser EventSource or fetch streams make it small. | 4 | S |
| 5 | CLI runner for CI | None | Insomnia: https://docs.insomnia.rest/inso-cli/introduction | Lets saved requests and assertions run in CI; reuses the script and chain runners. | 4 | M |
| 6 | Git sync for collections | Backup export/import only (`src/lib/backup/exporter.ts`) | Insomnia: https://docs.insomnia.rest/insomnia/git-sync | Teams want collections versioned with code; Insomnia ships it on its free tier (3 users per https://insomnia.rest/pricing/). | 4 | L |
| 7 | Mock servers | None | Postman: https://learning.postman.com/docs/design-apis/mock-apis/set-up-mock-servers/ ; Insomnia: https://insomnia.rest/pricing/ (1,000 mock requests per month on Essentials) | Frontend devs use mocks before the API exists. Needs hosted endpoints, so effort is high. | 4 | L |
| 8 | Team workspaces and collaboration | Local IndexedDB only; share links for single requests (`src/lib/shareLink.ts`) | Postman: https://learning.postman.com/docs/collaborating-in-postman/collaboration-intro/ | Shared collections are what Postman monetizes. Needs accounts and a backend. | 4 | L |
| 9 | Dedicated test scripts and assertions UI (Insomnia unit tests) | Scripts exist (`src/lib/scriptRunner.ts`); assertions only in chains | Insomnia: https://docs.insomnia.rest/insomnia/unit-testing | Per-request test results with pass/fail would make existing scripts easier to use. | 3 | S |
| 10 | API design and OpenAPI editor | OpenAPI import only (`src/lib/openapiParser.ts`) | Insomnia: https://docs.insomnia.rest/insomnia/design-documents | Design-first teams edit specs in the client. Import already exists, so a basic editor is a stretch step. | 3 | M |
| 11 | gRPC client | No gRPC client in `src/` | Postman: https://learning.postman.com/docs/use/send-requests/protocols/protocols ; Insomnia: https://docs.insomnia.rest/insomnia/grpc | Common for backend teams, but browsers need grpc-web or a proxy, which adds work. | 3 | L |
| 12 | Scheduled monitors | None | Postman: https://learning.postman.com/docs/monitoring-your-api/intro-monitors/ | Uptime and contract checks on a schedule need a server worker. Lower priority for a local-first tool. | 3 | L |
| 13 | Visual request workflows (Flows) | Chain runner is already visual (`src/lib/chainRunner.ts`) | Postman: https://learning.postman.com/docs/postman-flows/gs/flows-overview/ | Mostly covered by chains; the gap is branching, loops and richer blocks. | 2 | M |
| 14 | MQTT and SOAP clients | Absent from `src/` | Postman: https://learning.postman.com/docs/use/send-requests/protocols/protocols ; Insomnia (SOAP): https://insomnia.rest/pricing/ | Niche protocols; low value for the target audience. | 2 | M |

## Notes

- The top five (OAuth 2.0, collection runner, secrets vault, SSE, test assertions UI) are the suggested next picks: high value, small to medium size.
- Postman prices and plan limits in `research/postman.md` apply to hosted features (items 6, 9, 11); these are paid or limited by tier.
- Postman web app vs desktop and CORS claims are covered in the comparison table, not repeated here.
