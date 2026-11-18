# Relay architecture

Relay is the in-app assistant. The browser owns all workspace data and runs every tool; the server only talks to the model. Every claim cites a path.

![Relay flow](diagrams/relay-flow.svg)

## Layers

| Layer | Path | Role |
| --- | --- | --- |
| UI | `./src/components/relay` | Dock, composer, message and approval cards |
| Client state | `src/stores/useRelayStore.ts`, `src/stores/useRelayPermissionStore.ts`, `src/stores/useRelayRecentStore.ts` | Threads, preferences, permission mode, recents |
| Client library | `./src/lib/relay` | Tools, change log, redaction, context building, speech client |
| Server library | `./src/lib/relay/server` | `guard.ts`, `model.ts`, `rateLimit.ts`, `localRedisCounter.ts`, `bannedTokens.ts`, `systemPrompt.ts` |
| API routes | `src/app/api/relay/chat/route.ts`, `src/app/api/relay/stt/route.ts`, `src/app/api/relay/stt/status/route.ts`, `src/app/api/ai/route.ts` | Chat stream, speech-to-text, structured AI actions |

## Chat request

`POST /api/relay/chat` (`src/app/api/relay/chat/route.ts`):

1. Rejects cross-origin browser calls with `isSameOrigin` (`src/lib/relay/server/guard.ts`).
2. Reads the body, refusing anything over `RELAY_MAX_BODY_BYTES` (`src/lib/relay/tokenBudget.ts`) and validating it with a zod schema. A secret that slipped past client redaction is refused too (`hasUnredactedSecret` in `src/lib/relay/redact.ts`).
3. Runs `guardRelayRequest`: build flag, API key, then rate limits.
4. Streams the reply with `streamText` and the model from `getRelayModel` (`src/lib/relay/server/model.ts`). The system prompt comes from `buildSystemPrompt` (`src/lib/relay/server/systemPrompt.ts`).
5. Strips provider metadata from the stream so nothing vendor-specific reaches the client or IndexedDB.

Errors return a Relay code only (`src/lib/relay/errors.ts`), never provider text.

## Guard and limits

`guardRelayRequest` in `src/lib/relay/server/guard.ts` checks in order: the flag (`NEXT_PUBLIC_RELAY_ENABLED`, read once in `src/lib/relay/flag.ts`; on unless it is the string `false`), then a configured key (`isRelayConfigured` in `src/lib/relay/server/model.ts`), then, only for a user message, the rate limits. The limits are a burst limit (`RELAY_RATE_LIMIT_MAX` per `RELAY_RATE_LIMIT_WINDOW_SEC` in `src/lib/relay/server/rateLimit.ts`) tracked separately per user header (`RELAY_USER_HEADER`) and per IP, plus a daily cap (`RELAY_DAILY_MESSAGE_CAP` over `RELAY_DAILY_WINDOW_SEC` in `src/lib/relay/constants.ts`). Counters come from `getDefaultCounter` in `src/lib/relay/server/rateLimit.ts`.

## Tool loop

Tools are declared on the server from `RELAY_TOOL_SCHEMAS` (`src/lib/relay/tools/schemas.ts`) with schemas only and no `execute`, so each call streams to the browser, which runs it against the stores. Implementations are registered in `src/lib/relay/tools/registry.ts` and grouped by file in `./src/lib/relay/tools` (for example `workspaceRead.ts`, `requestWrite.ts`, `collectionWrite.ts`, `chainWrite.ts`, `settingsWrite.ts`, `navigationTools.ts`). Results are redacted and capped (`capToolResult` in `src/lib/relay/tokenBudget.ts`).

Each tool has a `kind` (`RelayToolKind`). `approvalNeeded` in `src/lib/relay/tools/schemas.ts` decides whether a call waits for the user, from the kind and the permission mode:

- `read` and `ui` tools never ask.
- `confirm` tools ask unless the mode is `skip` (some stay in `ALWAYS_ASK_TOOLS`).
- Navigation tools never ask.
- Turning Relay off asks unless the mode is `skip`.
- Other writes ask in `always-ask` mode, and in `review` mode when `requiresBulkApproval` says so.

The default mode is `review` (`RELAY_DEFAULT_PERMISSION_MODE` in `src/lib/relay/permission.ts`). Each user turn is limited to `RELAY_MAX_STEPS` (`src/lib/relay/constants.ts`); because every tool round trip is a new request, the route counts steps already taken since the last user message (`remainingSteps`).

## Changes and undo

Writes are recorded by `src/lib/relay/changeLog.ts` as `RelayChangeRecord` rows (`before` snapshot, `afterHash`, status `applied`, `undone` or `blocked`) in the `relay_changes` store, linked to a thread in `relay_threads` (`src/lib/relay/threadDb.ts`). Grouping for display is in `src/lib/relay/changeGroups.ts`.

## Structured AI actions

`POST /api/ai` (`src/app/api/ai/route.ts`) runs one named action from `ACTION_PROMPTS` (`src/lib/relay/prompts/index.ts`) through `generateText` using the same model. It is called from `src/hooks/useAI.ts`.

## Speech to text

- `POST /api/relay/stt` (`src/app/api/relay/stt/route.ts`) accepts a WAV recording (`audio/wav`) up to `STT_MAX_UPLOAD_BYTES` and forwards it to `GROK_STT_URL` (both in `src/lib/relay/constants.ts`) with the server-side `XAI_API_KEY`. Guards run in this order: same origin, flag, key. Responses are `Cache-Control: no-store`.
- `GET /api/relay/stt/status` (`src/app/api/relay/stt/status/route.ts`) applies the same-origin and flag checks and returns `{ configured: boolean }`, true when `XAI_API_KEY` is set. It never returns key material. The client reads it in `src/hooks/useSttConfigured.ts`.
- Client capture and encoding: `./src/lib/relay/stt` (`audioCapture.ts`, `wavEncoder.ts`, `client.ts`). Engine choice: `src/lib/relay/speechEngine.ts`.

## Configuration

| Variable | Read in | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_RELAY_ENABLED` | `src/lib/relay/flag.ts` | `false` turns Relay off at build time |
| `RELAY_API_KEY` (legacy `DEEPSEEK_API_KEY`) | `getRelayApiKey` in `src/lib/relay/server/model.ts` | Model key; absent means `not_configured` |
| `XAI_API_KEY` | `src/app/api/relay/stt/route.ts` | Server-side speech-to-text key |

The model id lives only in `RELAY_MODEL_ID` (`src/lib/relay/server/model.ts`), and thinking mode is disabled on every call through `relayProviderOptions`.

## Testing

Relay specs sit beside the code (`*.spec.ts` files in `./src/lib/relay`); fixtures are in `./src/lib/relay/testing`. Browser QA is in `./e2e/qa/relay`. See `docs/TESTING.md`.
