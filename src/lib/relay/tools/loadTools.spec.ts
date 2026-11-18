import { describe, expect, it } from "vitest";
import { CAPABILITY_CATEGORY_BY_TOOL, CORE_TOOLS, loadToolsFirstError, toolsForTopic } from "../capabilities";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import { enabledToolNames, loadToolsTools, type TurnMessage } from "./loadTools";
import { createRegistry, executeTool } from "./registry";
import type { RelayToolName } from "./schemas";

const registry = createRegistry(loadToolsTools);
const base = { store: createFakeStoreAccess().access, redact: DEFAULT_REDACT_CONTEXT };

const user = (metadata?: unknown): TurnMessage => ({ role: "user", parts: [{ type: "text" }], metadata });
const assistantCalling = (...parts: { type: string; input?: unknown }[]): TurnMessage => ({
  role: "assistant",
  parts,
});
const loadTopic = (topic: unknown) => ({ type: "tool-load_tools", input: { topic } });
const names = (set: ReadonlySet<RelayToolName>) => [...set].sort();
const withTopics = (...topics: Parameters<typeof toolsForTopic>[0][]) =>
  names(new Set([...CORE_TOOLS, ...topics.flatMap((topic) => toolsForTopic(topic))]));

describe("load_tools tool", () => {
  it("[success] returns the topic and the tools it enables", async () => {
    const out = await executeTool(registry, "load_tools", { topic: "run" }, base);
    expect(out).toEqual({ ok: true, data: { topic: "run", enabled: toolsForTopic("run") } });
  });

  it("[invalid] rejects an unknown topic and names nothing", async () => {
    const out = await executeTool(registry, "load_tools", { topic: "wizardry" }, base);
    expect(out.ok).toBe(false);
  });

  it("[invalid] rejects the core topic, which is always on, and extra keys or a missing topic", async () => {
    for (const input of [{ topic: "read" }, { topic: "run", extra: 1 }, {}]) {
      expect((await executeTool(registry, "load_tools", input, base)).ok).toBe(false);
    }
  });

  it("[success] is itself always enabled", () => {
    expect(CORE_TOOLS.has("load_tools")).toBe(true);
  });
});

describe("enabledToolNames", () => {
  it("[success] a plain turn gets only the core tools", () => {
    expect(names(enabledToolNames([user()]))).toEqual([...CORE_TOOLS].sort());
  });

  it("[success] no messages at all still yields the core tools", () => {
    expect(names(enabledToolNames([]))).toEqual([...CORE_TOOLS].sort());
  });

  it("[success] a load_tools call in this turn enables that group", () => {
    const messages = [user(), assistantCalling(loadTopic("run"))];
    expect(names(enabledToolNames(messages))).toEqual(withTopics("run"));
  });

  it("[success] several load_tools calls in one turn add up", () => {
    const messages = [user(), assistantCalling(loadTopic("run"), loadTopic("settings"))];
    expect(names(enabledToolNames(messages))).toEqual(withTopics("run", "settings"));
  });

  it("[success] a group loaded in an earlier turn is not carried over", () => {
    const messages = [user(), assistantCalling(loadTopic("run")), user(), assistantCalling()];
    expect(names(enabledToolNames(messages))).toEqual(withTopics());
  });

  it("[invalid] an unknown or malformed topic in history enables nothing extra", () => {
    for (const topic of ["wizardry", "read", 7, null, undefined]) {
      const messages = [user(), assistantCalling(loadTopic(topic))];
      expect(names(enabledToolNames(messages))).toEqual(withTopics());
    }
    const noInput = [user(), assistantCalling({ type: "tool-load_tools" })];
    expect(names(enabledToolNames(noInput))).toEqual(withTopics());
    const nullInput = [user(), assistantCalling({ type: "tool-load_tools", input: null })];
    expect(names(enabledToolNames(nullInput))).toEqual(withTopics());
  });

  it("[success] a tool already called this turn stays enabled, so a pending result never loses its tool", () => {
    const messages = [user(), assistantCalling({ type: "tool-send_request", input: {} })];
    const enabled = enabledToolNames(messages);
    expect(enabled.has("send_request")).toBe(true);
    expect(enabled.has("run_chain")).toBe(false);
  });

  it("[success] a removed tool name in an old thread is ignored, not enabled", () => {
    const messages = [user(), assistantCalling({ type: "tool-delete_request", input: {} })];
    expect(names(enabledToolNames(messages))).toEqual(withTopics());
  });

  it("[success] non-tool parts are ignored", () => {
    const messages = [user(), assistantCalling({ type: "text" }, { type: "step-start" }, { type: "tool-" })];
    expect(names(enabledToolNames(messages))).toEqual(withTopics());
  });

  it("[success] the slash command of the turn enables its group", () => {
    expect(names(enabledToolNames([user({ slashCommand: "run" })]))).toEqual(withTopics("run"));
    expect(names(enabledToolNames([user({ slashCommand: "import" })]))).toEqual(withTopics("transfer"));
  });

  it("[invalid] an unknown slash command adds nothing", () => {
    expect(names(enabledToolNames([user({ slashCommand: "nope" })]))).toEqual(withTopics());
  });

  it("[success] an attached item kind enables its group", () => {
    const attached = (kind: string) => user({ attachments: [{ kind }] });
    expect(names(enabledToolNames([attached("tab")]))).toEqual(withTopics("write"));
    expect(names(enabledToolNames([attached("collection")]))).toEqual(withTopics("organize"));
  });

  it("[invalid] malformed attachment metadata is ignored", () => {
    const cases: unknown[] = [
      null,
      "text",
      { attachments: "nope" },
      { attachments: [null, {}, { kind: 3 }, { kind: "toString" }, { kind: "unknown" }] },
    ];
    for (const metadata of cases) {
      expect(names(enabledToolNames([user(metadata)]))).toEqual(withTopics());
    }
  });

  it("[success] slash, attachments and load_tools combine", () => {
    const messages = [
      user({ slashCommand: "run", attachments: [{ kind: "collection" }] }),
      assistantCalling(loadTopic("backup")),
    ];
    expect(names(enabledToolNames(messages))).toEqual(withTopics("run", "organize", "backup"));
  });

  it("[success] only the last user message sets the turn's topics", () => {
    const messages = [user({ slashCommand: "run" }), assistantCalling(), user()];
    expect(names(enabledToolNames(messages))).toEqual(withTopics());
  });

  it("[success] a tool outside the set is refused with load_tools_first, then enabled by load_tools, never disappearing once called", async () => {
    const turn = [user()];
    const run = (enabled: ReadonlySet<RelayToolName>) =>
      executeTool(createRegistry(loadToolsTools), "load_tools", { topic: "run" }, { ...base, enabledTools: enabled });
    // Core includes load_tools, so the call itself runs.
    expect((await run(enabledToolNames(turn))).ok).toBe(true);
    const afterLoad = enabledToolNames([...turn, assistantCalling(loadTopic("run"))]);
    for (const tool of toolsForTopic("run")) expect(afterLoad.has(tool)).toBe(true);
    // A tool of an unloaded group is refused with a pointer to its topic.
    expect(loadToolsFirstError("send_request")).toContain("load_tools_first");
    expect(CAPABILITY_CATEGORY_BY_TOOL.send_request).toBe("run");
    expect(enabledToolNames(turn).has("send_request")).toBe(false);
  });
});
