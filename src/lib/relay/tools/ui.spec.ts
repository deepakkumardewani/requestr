import { describe, expect, it } from "vitest";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createRegistry, executeTool } from "./registry";
import { uiTools } from "./ui";

const registry = createRegistry(uiTools);

const request = (id: string) => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Req ${id}`,
  method: "GET",
  url: "https://api.test",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

function setup() {
  const fake = createFakeWriteContext({
    requests: [request("r1"), request("r2")],
  } as never);
  const run = (input: unknown) =>
    executeTool(registry, "open_item", input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const changeId = (out: Awaited<ReturnType<typeof run>>) =>
    (out as { data: { changeId: string } }).data.changeId;
  return { ...fake, run, changeId };
}

describe("open_item", () => {
  it("[success][undo] opens a tab and undo closes it, restoring the previous tab", async () => {
    const { run, writer, state, log, changeId } = setup();
    const previous = writer.openRequest(request("r1") as never);
    const out = await run({ kind: "request", id: "r2" });
    expect(out.ok).toBe(true);
    expect(state.tabs.map((t) => t.requestId)).toEqual(["r1", "r2"]);
    await log.undo(changeId(out));
    expect(state.tabs.map((t) => t.requestId)).toEqual(["r1"]);
    expect(state.activeTabId).toBe(previous);
  });

  it("[success][undo] only refocuses an already open tab, and undo keeps it open", async () => {
    const { run, writer, state, log, changeId } = setup();
    writer.openRequest(request("r1") as never);
    const second = writer.openRequest(request("r2") as never);
    const out = await run({ kind: "request", id: "r1" });
    expect(state.tabs).toHaveLength(2);
    await log.undo(changeId(out));
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(second);
  });

  it("[invalid] fails for an unknown request and when the write context is missing", async () => {
    const { run, store } = setup();
    expect((await run({ kind: "request", id: "zz" })).ok).toBe(false);
    const bare = await executeTool(
      registry,
      "open_item",
      { kind: "request", id: "r1" },
      { store, redact: DEFAULT_REDACT_CONTEXT },
    );
    expect(bare.ok).toBe(false);
  });

  it("includes the request id in refs", async () => {
    const { run } = setup();
    expect(uiTools[0]?.name).toBe("open_item");
    const refs = uiTools[0]?.refs?.({ kind: "request", id: "test-req" });
    expect(refs).toEqual([{ kind: "request", id: "test-req" }]);
  });

  it("returns the open request when successful", async () => {
    const { run } = setup();
    const result = await run({ kind: "request", id: "r1" });
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty("data.changeId");
  });

  it("propagates commit outcome when write context exists", async () => {
    const { run, writer, state } = setup();
    writer.openRequest(request("r1") as never);
    const result = await run({ kind: "request", id: "r2" });
    expect(result.ok).toBe(true);
    expect(state.tabs).toHaveLength(2);
  });
});

describe("ask_user", () => {
  const input = { question: "Which environment?", options: ["Dev", "Prod"] };
  const ask = (args: unknown, selection?: string) =>
    executeTool(registry, "ask_user", args, {
      store: createFakeWriteContext().store,
      redact: DEFAULT_REDACT_CONTEXT,
      selection,
    });

  it("[success] returns the option the user picked", async () => {
    expect(await ask(input, "Prod")).toEqual({ ok: true, data: { choice: "Prod" } });
  });

  it("[success][invalid] never answers for the user", async () => {
    expect(await ask(input)).toEqual({ ok: false, error: "the user has not answered yet" });
  });

  it("[success] accepts an answer the user typed instead of an option", async () => {
    expect(await ask(input, "  Staging  ")).toEqual({ ok: true, data: { choice: "Staging" } });
  });

  it("[invalid] rejects a blank answer", async () => {
    expect(await ask(input, "   ")).toEqual({ ok: false, error: "the answer is empty" });
  });

  it("[success] needs between 2 and 6 options", async () => {
    expect((await ask({ question: "Q", options: ["only"] }, "only")).ok).toBe(false);
    expect((await ask({ question: "Q", options: ["1", "2", "3", "4", "5", "6", "7"] }, "1")).ok).toBe(false);
  });

  it("accepts first option", async () => {
    expect(await ask(input, "Dev")).toEqual({ ok: true, data: { choice: "Dev" } });
  });

  it("keeps the exact casing the user typed", async () => {
    expect(await ask(input, "dev")).toEqual({ ok: true, data: { choice: "dev" } });
  });

  it("handles exactly 2 options (minimum)", async () => {
    expect((await ask({ question: "Q", options: ["a", "b"] }, "a")).ok).toBe(true);
  });

  it("handles exactly 6 options (maximum)", async () => {
    const sixOpts = { question: "Q", options: ["1", "2", "3", "4", "5", "6"] };
    expect((await ask(sixOpts, "3")).ok).toBe(true);
  });

  it("returns the selected choice in data field", async () => {
    const result = await ask(input, "Prod");
    expect(result).toHaveProperty("data.choice");
    expect(result).toEqual(expect.objectContaining({ data: { choice: "Prod" } }));
  });

  it("rejects when selection is null", async () => {
    expect(await ask(input, null as never)).toEqual({
      ok: false,
      error: "the answer is empty",
    });
  });

  it("handles options with special characters", async () => {
    const specialInput = { question: "Q", options: ["Env@1", "Env#2"] };
    expect(await ask(specialInput, "Env@1")).toEqual({ ok: true, data: { choice: "Env@1" } });
  });

  it("has correct tool name", () => {
    expect(uiTools[1].name).toBe("ask_user");
  });
});
