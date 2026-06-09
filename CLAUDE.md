## Important CLI Tools (use these, not the defaults)

- `bun` instead of `npm`
- `bun install` instead of `npm install`
- `bun run` instead of `npm run`
- `gh` is installed - use for all Git operations
- **IMPORTANT**: NEVER run `npm` commands (e.g., `npm install`, `npm run`) at the root directory. This will break the project. All package operations must be run using `bun`.

## Conditional Reference Table

| Task                                      | Reference                                           |
| ----------------------------------------- | --------------------------------------------------- |
| Naming conventions, code style            | `.claude/skills/code-style/SKILL.md`                |
| TypeScript best practices, error handling | `.claude/skills/typescript-best-practices/SKILL.md` |
| Shadcn usage                              | `.claude/skills/shadcn/SKILL.md`                    |
| Component Rules                           | `.claude/skills/component-rules/SKILL.md`           |

---

## Client state: Zustand store vs React Context

Use the pattern that matches **scope** and **persistence**. This project standardizes cross-cutting UI on **Zustand** (`src/stores/`).

### Prefer a Zustand store when

- State is shared by **sibling or distant** components (e.g. sidebar header + nested tree).
- State is **persisted** (`localStorage`, IndexedDB) or may be read outside React later.
- Multiple features might read/update the same state (command palette, shortcuts, panels).
- You want to avoid provider placement and test wrappers.
- The state is **app/sidebar UI preference**, not domain data — still use a store (see `useUIStore`, `useFolderExpandStore`).

Place new stores in `src/stores/use<Name>Store.ts`. Follow existing conventions: serializable state, persist in actions, no functions in persisted payloads.

### Prefer React Context when

- State is **scoped to one subtree** and only descendants consume it.
- State is **ephemeral** (wizard step, modal draft, open/closed for a single compound component).
- You are avoiding prop drilling **one level deep** inside a self-contained feature.
- The provider and all consumers live in the **same module/feature folder**.

### Quick decision

| Question                              | Store                      | Context     |
| ------------------------------------- | -------------------------- | ----------- |
| Needed outside the provider subtree?  | Yes                        | No          |
| Persisted across sessions?            | Yes                        | Rarely      |
| Used in tests without extra wrappers? | Prefer store               | OK if local |
| Domain/collection/request data?       | `useCollectionsStore` etc. | No          |

When unsure, check `src/stores/` for a similar case before adding Context.

---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
