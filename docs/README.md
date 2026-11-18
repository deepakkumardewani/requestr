# Requestr developer docs

Internal documentation index. Every claim below cites a path in this repo.

## Index

| Doc | Status | Scope |
| --- | --- | --- |
| `docs/README.md` | written (this file) | Index, audit gap list, tooling note |
| `docs/ARCHITECTURE.md` | written | Stores in `./src/stores`, API routes in `./src/app/api`, Relay in `./src/lib/relay`, chain runner in `./src/lib/chainRunner`. Diagrams: `docs/diagrams/architecture.svg`, `docs/diagrams/request-pipeline.svg`, `docs/diagrams/relay-flow.svg` |
| `docs/DATA_MODEL.md` | written | IndexedDB stores from `src/lib/idbSchema.ts`, persisted shapes from `./src/types`, `localStorage` keys. Diagram: `docs/diagrams/data-model.svg` |
| `docs/RELAY.md` | written | `./src/lib/relay`, `./src/app/api/relay` (chat, stt, stt/status), `./src/app/api/ai`. Diagram: `docs/diagrams/relay-flow.svg` |
| `docs/REQUEST_PIPELINE.md` | written | Tab to proxy to response, `src/lib/requestRunner.ts`, `src/app/api/proxy/route.ts`. Diagram: `docs/diagrams/request-pipeline.svg` |
| `docs/CHAIN_RUNNER.md` | written | `src/lib/chainRunner.ts`, `./src/lib/chainRunner`, `src/lib/chainEval.ts` |
| `docs/PERSISTENCE.md` | written | IndexedDB vs `localStorage` per store, hydration, backup. Diagram: `docs/diagrams/data-model.svg` |
| `docs/SHORTCUTS.md` | written | Registry in `src/app/settings/constants.ts`, formatters in `src/lib/shortcutFormat.ts` and `src/lib/formatShortcut.ts` |
| `docs/TESTING.md` | written | `vitest.config.ts`, `playwright.config.ts`, `e2e/`, QA seeds and prod mode |

Skipped candidates (T4.5): none. Gap list items 2, 5, 6, 7 and 8 each justified a doc, so all five candidates were written.

Existing docs reviewed: `README.md`, `CLAUDE.md`, `graphify-out/GRAPH_REPORT.md`, and the per-feature spec/plan folders under `agent_docs/` (`agent_docs/chain-e2e`, `agent_docs/relay-v2`, `agent_docs/relay-polish`, `agent_docs/relay-conversation-polish`, `agent_docs/relay-harness-audit/REPORT.md`, `agent_docs/polish-and-landing`, and QA evidence in `agent_docs/qa`).

## Gap list (audit findings)

1. **Gap: API routes under-documented.** `README.md` (section "Architecture") names only `/api/proxy`, `/api/ai` and `/api/share`. `./src/app/api` also contains `hub`, `relay` (`chat`, `stt`) and `schema`. Fix in `docs/ARCHITECTURE.md`.
2. **Gap: persistence description is imprecise.** `README.md` says stores persist to IndexedDB. `src/lib/idbSchema.ts` defines the IndexedDB schema, but `src/stores/useUIStore.ts`, `src/stores/useEnvironmentsStore.ts`, `src/stores/useFolderExpandStore.ts`, `src/stores/useRelayPermissionStore.ts` and `src/stores/useRelayRecentStore.ts` reference `localStorage`. The split per store is undocumented. Fix in `docs/DATA_MODEL.md` and `docs/PERSISTENCE.md`.
3. **Gap: store inventory.** `CLAUDE.md` gives the Zustand-vs-Context rule and names a few stores, but nothing lists the 20+ store files in `./src/stores` and what each owns. Fix in `docs/ARCHITECTURE.md`.
4. **Gap: Relay has no architecture doc.** Design lives only in feature plans (`agent_docs/relay-v2`, `agent_docs/relay-polish`, `agent_docs/relay-conversation-polish`) and `agent_docs/relay-harness-audit/REPORT.md`. Code spans `./src/lib/relay` (`server`, `tools`, `prompts`, `stt`, `testing`), `./src/app/api/relay` and `./src/app/api/ai`. Fix in `docs/RELAY.md`.
5. **Gap: chain runner has no standalone doc.** `README.md` describes chain blocks for users; the scheduler, executors and eval sandbox live in `./src/lib/chainRunner` and `src/lib/chainEval.ts`, and only appear in `agent_docs/chain-e2e`. Written as `docs/CHAIN_RUNNER.md`.
6. **Gap: request pipeline.** The path from the request builder through `src/app/api/proxy/route.ts` to the response store (`src/stores/useResponseStore.ts`) is not written down. Written as `docs/REQUEST_PIPELINE.md`.
7. **Gap: testing and QA harness.** `vitest.config.ts`, `playwright.config.ts`, `e2e/` (`fixtures`, `qa`, `scenarios`) and the QA evidence under `agent_docs/qa` have no guide. Written as `docs/TESTING.md`.
8. **Gap: shortcut registry.** `README.md` lists shortcuts for users; no developer doc covers the registry or formatter added in phase 1 of `agent_docs/polish-and-landing/TASKS.md`. Written as `docs/SHORTCUTS.md`.
9. **Gap: stale graph report.** `graphify-out/GRAPH_REPORT.md` is dated 2026-10-05 and lists anonymous "Community N" hubs only, so it is not a usable navigation doc until regenerated.

## Tooling note: diagram-design skill (T4.1, FR-24)

The `diagram-design` skill was installed by the user as a Claude Code plugin, not a git clone into `~/.claude/skills`:

- Commands: `/plugin marketplace add cathrynlavery/diagram-design` then `/plugin install diagram-design@diagram-design`
- Version: 2.6.142
- Skill file: `~/.claude/plugins/marketplaces/diagram-design/skills/diagram-design/SKILL.md` (cache copy: `~/.claude/plugins/cache/diagram-design/diagram-design/2.6.142/skills/diagram-design/SKILL.md`)
- Frontmatter `name: diagram-design` verified.

This is a user-approved deviation from the literal path `~/.claude/skills/diagram-design/SKILL.md` in T4.1 (see `agent_docs/polish-and-landing/TASKS.md`).
