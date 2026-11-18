# Architecture

Requestr is a Next.js app (`./src/app`) whose UI state lives in Zustand stores (`./src/stores`) and whose workspace data is persisted in the browser. The server side is six API route groups under `./src/app/api`. Every claim cites a path.

![Architecture overview](diagrams/architecture.svg)

## API routes

Each route directory in `./src/app/api`:

| Route | File | Purpose |
| --- | --- | --- |
| `/api/proxy` | `src/app/api/proxy/route.ts` | `POST`. Forwards an outbound HTTP request server-side using `fetch`, with a clamped timeout and a response size guard (`MAX_PROXY_RESPONSE_BYTES` from `src/lib/constants.ts`). Called from `src/lib/requestRunner.ts`. |
| `/api/ai` | `src/app/api/ai/route.ts` | `POST`. Runs a named structured action (`ACTION_PROMPTS` in `src/lib/relay/prompts/index.ts`) through `generateText` with the model from `src/lib/relay/server/model.ts`. Called from `src/hooks/useAI.ts`. |
| `/api/relay` | `src/app/api/relay/chat/route.ts`, `src/app/api/relay/stt/route.ts`, `src/app/api/relay/stt/status/route.ts` | `chat` streams the Relay assistant (`streamText`) behind `guardRelayRequest` in `src/lib/relay/server/guard.ts`; `stt` forwards audio to a speech-to-text provider using a server-side key. |
| `/api/share` | `src/app/api/share/route.ts`, `src/app/api/share/[id]/route.ts` | `POST` stores a shared payload (`src/lib/shareServer.ts`, `src/lib/redis.ts`) after a rate-limit check; `GET` by id reads it back. Client side: `src/lib/shareLink.ts`. |
| `/api/schema` | `src/app/api/schema/route.ts` | `POST`. Generates types from a JSON response body with `quicktype-core`, rejecting bodies over 200 KB. Used by `src/components/response/DataSchemaDialog.tsx`. |
| `/api/hub` | `src/app/api/hub/route.ts` | `GET`. Lists the directory names under `public/data/hub` as `slugs`. Used by `src/components/hub/HubTab.tsx`. |

## Request pipeline

![Request pipeline](diagrams/request-pipeline.svg)

`runRequest` in `src/lib/requestRunner.ts` builds headers and body from a resolved request (`src/lib/resolveRequest.ts`) and posts it to `/api/proxy`. The proxy returns the upstream response, which is held in `src/stores/useResponseStore.ts`; sent requests are recorded by `src/stores/useHistoryStore.ts`.

## Relay

![Relay flow](diagrams/relay-flow.svg)

Relay client code lives in `./src/lib/relay`, with server-only pieces in `./src/lib/relay/server` (`guard.ts`, `model.ts`, `rateLimit.ts`, `systemPrompt.ts`). The chat route validates input, builds the system prompt and exposes tool schemas from `src/lib/relay/tools/schemas.ts`. Tool implementations are in `./src/lib/relay/tools`. Client state is in `src/stores/useRelayStore.ts`, `src/stores/useRelayPermissionStore.ts` and `src/stores/useRelayRecentStore.ts`; applied changes are tracked in `src/lib/relay/changeLog.ts`. UI is in `./src/components/relay`.

## Chain runner

The chain runner is in `src/lib/chainRunner.ts` (execution order, `CircularDependencyError`, `SchedulerDepthExceededError`) and `./src/lib/chainRunner/`: `scheduler.ts`, `schedulerGraph.ts`, `schedulerLanes.ts`, `schedulerQueue.ts`, `runGraph.ts`, and per-block executors in `./src/lib/chainRunner/executors` (`apiExecutor.ts`, `conditionExecutor.ts`, `delayExecutor.ts`, `displayExecutor.ts`, `evaluate.ts`, `loop.ts`, `merge.ts`, `start.ts`, `subchain.ts`, `validate.ts`). Scripted values are evaluated in `src/lib/chainEval.ts`. Stores: `src/stores/useChainStore.ts` (chain definitions), `src/stores/useChainRunStore.ts` (run state) and `src/stores/chainHistory.ts`.

## Stores

Every file in `./src/stores` (specs excluded) and where it persists, from `grep` of each file for `getDB`/`localStorage`. "memory" means neither is referenced.

| Store file | Persistence |
| --- | --- |
| `src/stores/useCollectionsStore.ts` | IndexedDB |
| `src/stores/useChainStore.ts` | IndexedDB |
| `src/stores/useChainRunStore.ts` | IndexedDB |
| `src/stores/chainHistory.ts` | memory |
| `src/stores/useHistoryStore.ts` | IndexedDB |
| `src/stores/useTabsStore.ts` | IndexedDB |
| `src/stores/useSettingsStore.ts` | IndexedDB |
| `src/stores/useEnvironmentsStore.ts` | IndexedDB and localStorage |
| `src/stores/useUIStore.ts` | localStorage |
| `src/stores/useFolderExpandStore.ts` | localStorage |
| `src/stores/useRelayStore.ts` | localStorage (threads use `src/lib/relay/threadDb.ts`) |
| `src/stores/useRelayPermissionStore.ts` | localStorage |
| `src/stores/useRelayRecentStore.ts` | localStorage |
| `src/stores/useResponseStore.ts` | memory |
| `src/stores/useConnectionStore.ts` | memory |
| `src/stores/useDataSchemaStore.ts` | memory |
| `src/stores/useJsonCompareStore.ts` | memory |
| `src/stores/useJsonVisualizeStore.ts` | memory |
| `src/stores/usePlaygroundStore.ts` | memory |
| `src/stores/useSettingsSectionStore.ts` | memory |
| `src/stores/useSidebarRevealStore.ts` | memory |
| `src/stores/useTransformStore.ts` | memory |

Store-versus-Context guidance is in `CLAUDE.md`. IndexedDB object stores are declared in `src/lib/idbSchema.ts` (`collections`, `requests`, `folders`, `environments`, `history`, `tabs`, `settings`, `chainConfigs`, `chains`, `chainRuns`, `relay_threads`, `relay_changes`); the full persisted shapes are covered in `docs/DATA_MODEL.md`.
