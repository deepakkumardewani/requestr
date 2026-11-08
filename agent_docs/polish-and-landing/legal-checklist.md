# Legal data-flow checklist (T7.16, FR-47)

Skill search: no privacy/terms skill in the available list fits (closest: none); drafted manually from code.
Every statement below maps to a code location, verified at write time. Not legal advice; review before publishing.

## Operator (fixed text, FR-46)
- Deepak Dewani, an individual developer (no company); governing law India; contact deepakkumardewani@gmail.com. Keep in one constants file (`src/components/legal/constants.ts`, T7.17).

## Data-flow statements

| # | Statement for Privacy/Terms | Code location |
|---|---|---|
| 1 | Local-first: collections, environments, tabs, history are stored in the browser (IndexedDB / localStorage); no accounts or sign-in. | `src/lib/idb.ts` (`openDB`), `src/lib/idbSchema.ts` (`IDB_DB_NAME`), `src/stores/useCollectionsStore.ts`, `src/stores/useEnvironmentsStore.ts`, `src/stores/useTabsStore.ts` |
| 2 | Users can clear their data by clearing browser storage / deleting the local database. | `src/lib/idb.ts`, `src/lib/idbSchema.ts` |
| 3 | Requests are sent through our server proxy so browsers can reach APIs; the proxy forwards method, headers and body to the target URL and returns the response. Responses are capped in size and not stored. | `src/app/api/proxy/route.ts` (`fetch(url…)` L60, `MAX_PROXY_RESPONSE_BYTES` check L74-94) |
| 4 | AI helpers (`/api/ai`): the prompt and selected request/response context are sent to a third-party AI provider to generate text (vendor not named in UI copy). | `src/app/api/ai/route.ts` (`generateText`), `src/lib/relay/server/model.ts` (`getRelayModel`, key from env) |
| 5 | Relay chat (`/api/relay/chat`): messages are sent to a third-party AI provider; client redacts secrets and the server refuses what slipped through; output and message counts are capped. | `src/app/api/relay/chat/route.ts` (L128 redaction check, `MAX_MESSAGES`, `MAX_OUTPUT_TOKENS`), `src/lib/relay/redact.ts` |
| 6 | Voice input (`/api/relay/stt`): uploaded audio is forwarded to a third-party speech-to-text provider; size capped. | `src/app/api/relay/stt/route.ts` (`GROK_STT_URL` fetch L66, `STT_MAX_UPLOAD_BYTES`), `src/lib/relay/constants.ts` |
| 7 | Rate limiting: relay uses a per-client key derived from the `x-forwarded-for` IP, held in a counter (30 turns / 10 min); share uses an anonymous client id (20 / hour). | `src/lib/relay/server/guard.ts` L40, `src/lib/relay/server/rateLimit.ts` (`RELAY_RATE_LIMIT_MAX`, `RELAY_RATE_LIMIT_WINDOW_SEC`), `src/lib/shareServer.ts` (`SHARE_RATE_LIMIT_MAX`, `SHARE_RATE_LIMIT_TTL_SEC`) |
| 8 | Share links: content is encrypted in the browser (AES); only ciphertext + IV are stored server-side (Redis); the key lives in the URL fragment and is never sent to us; links expire after 24 hours. | `src/lib/shareLink.ts` (`encryptPayload` L127, key in `#` hash), `src/lib/crypto.ts`, `src/app/api/share/route.ts` (`redis.set … ex`), `src/app/api/share/[id]/route.ts`, `src/lib/shareServer.ts` (`SHARE_PAYLOAD_TTL_SEC = 86_400`), `src/lib/redis.ts` |
| 9 | Hub: lists bundled public template folders from the app's own files; no user data involved. | `src/app/api/hub/route.ts` (`readdirSync` of `public/data/hub`) |
| 10 | Schema helper: request body size-capped (200 KB); processed in-request. | `src/app/api/schema/route.ts` (`MAX_BODY_BYTES`) |
| 11 | No analytics or tracking scripts, no ad trackers. | Evidence below; `package.json` has no analytics dependency |

## Analytics grep evidence
Command: `grep -rniE "gtag|google-analytics|plausible|posthog|mixpanel|segment" src package.json`
Result: only false positives for the word "segment(s)" in unrelated code (`src/types/chain.ts:156` URL path segment; `src/stores/useRelayStore.ts` and its spec: prompt segments). No analytics/tracking library, script tag or dependency found. Statement 11 is supported.

## Open items for the reviewer (not verified in code)
- Retention of data held by third-party AI providers is governed by their terms; page should say so without naming vendors.
- Hosting-provider request logs (IP, timestamps) are outside app code; mention generically.
- Cookies: none set by app code found in `src/app/api`; confirm before claiming "no cookies".

## Page statement mapping (T7.17, T7.18)
Operator, law, contact, effective date and note render from `src/components/legal/constants.ts` via `src/components/legal/LegalLayout.tsx`, used by `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`.

| Page section | Checklist # | Code location |
|---|---|---|
| Privacy: Local-first storage | 1, 2 | `src/lib/idb.ts`, `src/lib/idbSchema.ts` |
| Privacy: Request proxying | 3 | `src/app/api/proxy/route.ts` |
| Privacy: AI helpers and voice input | 4, 5, 6 | `src/app/api/ai/route.ts`, `src/app/api/relay/chat/route.ts`, `src/lib/relay/redact.ts`, `src/app/api/relay/stt/route.ts` |
| Privacy: Share links (24h, key in fragment) | 8 | `src/lib/shareLink.ts`, `src/lib/shareServer.ts`, `src/app/api/share/route.ts` |
| Privacy: Hub templates | 9 | `src/app/api/hub/route.ts` |
| Privacy: Rate limiting and server logs | 7 | `src/lib/relay/server/guard.ts`, `src/lib/relay/server/rateLimit.ts`, `src/lib/shareServer.ts` |
| Privacy: What we do not collect | 11 | analytics grep evidence above; `package.json` |
| Privacy: Retention and controls | 2, 3, 8 | `src/lib/idb.ts`, `src/app/api/proxy/route.ts`, `src/lib/shareServer.ts` |
| Terms: Your data (summary) | 1, 3, 4, 6, 8, 11 | same locations as the rows above |
| Terms: Third-party services | 4, 5, 6 | `src/app/api/ai/route.ts`, `src/app/api/relay/stt/route.ts` |
| Terms: Using the service (abuse, rate limits) | 7 | `src/lib/relay/server/rateLimit.ts`, `src/lib/shareServer.ts` |
| Terms: No warranty / governing law | n/a (legal text) | `src/components/legal/constants.ts` (`LEGAL_GOVERNING_LAW`) |

Resolved open items: retention at AI providers and host logs are stated generically on both pages. Cookies are not claimed either way (no "no cookies" statement made).
