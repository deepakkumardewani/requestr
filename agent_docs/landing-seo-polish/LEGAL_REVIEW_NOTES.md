# Legal review notes (landing-seo-polish, Phase 11)

Internal only. Nothing here is published on `/privacy` or `/terms`. Line numbers were checked against the repo on 2026-11-12 and drift over time.

## Drafting-guide caveat

SPEC section D asks the implementer to read `~/.agents/skills/privacy-policy/SKILL.md` and `~/.agents/skills/terms-of-service/SKILL.md`. Neither file exists on this machine (no `privacy-policy` or `terms-of-service` skill under `~/.agents/skills` or `~/.claude/skills`). The pages were drafted from the verified code flows below and from general privacy-policy and terms practice. Owner: install the skills and re-run the drafting pass, or have a lawyer review.

## Data-flow verification (SPEC section D, ten rows)

| # | Flow | Citation | What the code does | Page wording |
|---|---|---|---|---|
| 1 | Local-first storage | `src/lib/idb.ts:84` (`openDB(IDB_DB_NAME, ...)`), `src/lib/constants.ts:55` (`"requestly"`), `src/lib/idbSchema.ts:31-58` (collections, requests, folders, environments, history, tabs, settings, chains, `relay_threads`); `src/stores/useFolderExpandStore.ts:18`, `src/stores/useEnvironmentsStore.ts:111` and `src/lib/relay/constants.ts:35` (localStorage keys) | Collections, environments, history, tabs, settings, chains and Relay conversations live in IndexedDB; small UI preferences live in localStorage. No server write. | Stated as browser-only storage. |
| 2 | Request proxy | `src/app/api/proxy/route.ts:60-65` (forwards `method`, `headers`, `body` to the target with `fetch`), `:77` and `:94` (size checks against `MAX_PROXY_RESPONSE_BYTES`, `src/lib/constants.ts:38`, 50 MB), `:33` (timeout clamp 1 s to 600 s) | Request is forwarded and the response returned. The route has zero `console` calls, so the app itself logs nothing and stores nothing. Platform-level request logs are not confirmable from code. | "Not stored by us"; hosting logs mentioned separately. |
| 3 | Upstash Redis | `src/lib/redis.ts:1,8` (`Redis.fromEnv()`, `UPSTASH_REDIS_REST_URL`/`_TOKEN`), `src/app/api/share/route.ts:57-58` (`redis.set` with `ex`), `src/lib/shareServer.ts:94-102` (rate-limit `INCR`/`EXPIRE`) | Upstash holds share ciphertext and the share rate-limit counter. | Upstash named as the storage and rate-limit provider. |
| 4 | AI providers | `src/lib/relay/server/model.ts:1,6,18,31` (`createDeepSeek`, `RELAY_MODEL_ID = "deepseek-flash"`, key from `RELAY_API_KEY` or `DEEPSEEK_API_KEY`); `src/app/api/ai/route.ts:6,56,65` and `src/app/api/relay/chat/route.ts:20` (both call `getRelayModel`) | Chat and `/api/ai` call DeepSeek only. STT calls xAI only (row 5). `grep -rniE "openai\|anthropic\|gemini" src` finds OpenAI and Anthropic only in `src/lib/relay/server/bannedTokens.ts:10-11` (plus the unrelated button handler `handleOpenAI` in `BodyEditor.tsx:65` and `ScriptEditor.tsx:94`, and the feature-copy string "Import GitHub, OpenAI, Stripe" in `src/components/landing/data/features.ts:144`, a template mention, not a call). Gemini appears nowhere in `src` (SPEC criterion 13 expected it in `bannedTokens.ts`; it is not there. Not a legal issue, only a spec inaccuracy). | Page names DeepSeek and xAI only, with a "providers may change" clause. Retention is the provider's own policy; the code cannot confirm it, so it is not asserted. |
| 5 | Voice input | `src/hooks/useSpeechDictation.ts:50-56` (browser `SpeechRecognition` / `webkitSpeechRecognition`); `src/app/api/relay/stt/route.ts:45` (`XAI_API_KEY`), `:56` (WAV only), `:59` (size cap, `STT_MAX_UPLOAD_BYTES` 8 MB, `src/lib/relay/constants.ts:150`), `:66` (fetch to `GROK_STT_URL = https://api.x.ai/v1/stt`, `constants.ts:147`), `:72,81` (logs fixed messages only, not audio) | Two paths: the browser's own speech service (audio may go to the browser vendor; not verifiable from code) or the server STT route that relays audio to xAI. | Both paths described; browser vendor handling flagged as the vendor's. |
| 6 | Share links | `src/lib/crypto.ts:1,33-42` (AES-256-GCM, 32-byte key), `src/lib/shareLink.ts:192` (`/?s={id}#{key}`), `:214-218` (key read from `location.hash`), `src/app/api/share/route.ts:42,57-58` (stores `{ciphertext, iv}` with `ex: SHARE_PAYLOAD_TTL_SEC`), `src/lib/shareServer.ts:8` (`86_400` = 24 h), `:4-5` (`SHARE_RATE_LIMIT_MAX = 20` per `SHARE_RATE_LIMIT_TTL_SEC = 3600`), `src/lib/shareServer.ts:61` (key `share:{id}`) | Only ciphertext and IV in Redis, key stays in the URL fragment (browsers do not send fragments), TTL 24 h, hourly counter keyed by a client id. | Stated as is. Caveat: the link holder, or anyone the link is sent to, can decrypt. |
| 7 | Relay rate limiting | `src/lib/relay/server/guard.ts:40-41` (IP from `x-forwarded-for` or `x-real-ip`), `src/lib/relay/server/rateLimit.ts:2-3` (30 per 600 s), `:86-100` (`consumeRateLimit`), `src/lib/relay/server/localRedisCounter.ts:9` (`REDIS_URL`, local TCP Redis), `rateLimit.ts:19-42` (in-memory fallback) | Per-IP counter in Upstash, a local Redis, or process memory. | IP-keyed counter disclosed. |
| 8 | Hub templates | `src/app/api/hub/route.ts:6-13` (`readdirSync` of `public/data/hub`, returns slugs) | Static bundled files, no third party. | Stated as is. |
| 9 | Hosting provider | `package.json:8` (`homepage: https://requestr-api.vercel.app/`), `src/lib/constants.ts:116` (default site URL) | Hosted on Vercel; Vercel necessarily sees IPs and request metadata. Vercel's own log retention is not confirmable here. | Vercel named; standard request logs mentioned conservatively. |
| 10 | Third-party fetches and analytics | `src/app/layout.tsx:2` (`next/font/google`, self-hosted at build), no `gtag`, analytics, or tracking script found (`grep -nEi "analytics\|gtag\|posthog\|plausible" src/app/layout.tsx package.json` is empty) | No analytics or ad trackers today. | "No analytics" stated; a clause that this page will be updated if that changes. |

Anonymous client id: `src/lib/anonUser.ts:4-18` stores a random id in localStorage and sends it as `userId` to `/api/share` for rate limiting.

## DPDP Act 2023 (India)

- The operator is an individual in India offering a service to people in India, so the Digital Personal Data Protection Act, 2023 likely applies to personal data processed (IP addresses in rate-limit keys and hosting logs, audio sent for STT, prompts that may contain personal data).
- Whether the operator is a "data fiduciary" with notice, consent, grievance-redressal and breach-notification duties, and whether any small-entity exemption in the final Rules applies, is a legal call. **Needs a lawyer.**
- The pages use an email contact for access, correction and deletion requests. A named grievance officer and a response timeline are not stated; **owner decision**.

## Cross-border transfer

- Prompts and Relay context go to DeepSeek; audio goes to xAI. Both are foreign providers; server regions, retention and training use are not confirmable from code. The DPDP regime allows transfers outside India except to countries the Government restricts; no restriction list entry was checked. **Needs a lawyer**, particularly for DeepSeek.
- The pages say content is sent to these providers and that they apply their own terms, and do not claim a retention period or region.

## Open items for the owner or a lawyer

1. Install the two drafting-guide skills (missing) and re-run the drafting pass.
2. Contact email: the pages use `kumard8308887772@gmail.com` (SPEC fixed fact). The previous page used a different address, so confirm.
3. Effective date was set at publish time (12 November 2026).
4. Grievance officer and response time for deletion requests (DPDP).
5. Provider retention and training use (DeepSeek, xAI, browser speech vendors, Vercel logs): not confirmable from code, so not asserted.
6. Governing law is India. Court jurisdiction (city) is not named; owner decision.
7. Minimum age or children's data (DPDP restricts processing children's data): the pages do not address it.
8. Whether the proxy should be described as able to see request content in transit (it does; it does not store it).
