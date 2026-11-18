/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  getThread,
  scheduleThreadSave,
} from "@/lib/relay/threadDb";
import { executeTool, type ToolOutcome } from "@/lib/relay/tools/registry";
import { DISABLE_AFTER_TURN } from "@/lib/relay/tools/settingsWrite";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { forgetAwaiting } from "./relayTurnHelpers";
import {
  ABORTED_BEFORE_START_ERROR,
  type AddToolOutput,
  RELAY_DISABLED_ERROR,
  useToolQueue,
} from "./useToolQueue";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/relay/tools/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/relay/tools/registry")>()),
  executeTool: vi.fn(),
}));

const executeMock = vi.mocked(executeTool);

const OK: ToolOutcome = { ok: true, data: { done: true } };
const DELETE_INPUT = { ids: ["r1"] };

/** A delete card only shows for ids that exist (L-06), so the request is seeded. */
const SAVED_REQUEST = {
  id: "r1",
  collectionId: "c1",
  name: "Orders",
  method: "GET" as const,
  url: "https://api.test/orders",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
};

const userMsg = (id: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text: "go" }],
});

const openCall = (id: string, name: string, input: unknown): UIMessage["parts"][number] =>
  ({ type: `tool-${name}`, toolCallId: id, state: "input-available", input }) as never;

const assistantWith = (...parts: UIMessage["parts"]): UIMessage => ({
  id: "a1",
  role: "assistant",
  parts,
});

type Setup = ReturnType<typeof setup>;

function setup(initial: UIMessage[] = [userMsg("u1")], chatId = "thread-1") {
  const addToolOutput = vi.fn().mockResolvedValue(undefined);
  const deps = {
    chatIdRef: { current: chatId },
    messagesRef: { current: initial },
    addToolOutputRef: { current: addToolOutput as unknown as AddToolOutput | null },
  };
  const hook = renderHook(() => useToolQueue(deps));
  return { ...hook, deps, addToolOutput };
}

/** A tool run the test finishes by hand. */
function deferredRun() {
  let finish!: (outcome: ToolOutcome) => void;
  const promise = new Promise<ToolOutcome>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

const lastContext = () => executeMock.mock.calls.at(-1)?.[3];
const delivered = (s: Setup) => s.addToolOutput.mock.calls.map(([arg]) => arg);

beforeEach(() => {
  executeMock.mockReset();
  executeMock.mockResolvedValue(OK);
  useRelayPermissionStore.setState({ mode: "review" });
  useRelayStore.setState({ enabled: true, pendingDisable: null });
  useCollectionsStore.setState({ requests: [SAVED_REQUEST], collections: [], folders: [] });
});

afterEach(async () => {
  cleanup();
  useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
  for (const id of ["c1", "c2", "d1", "q1"]) forgetAwaiting(id);
  await flushThreadWrites();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("useToolQueue", () => {
  describe("auto tools", () => {
    it("runs the call, delivers its output to the chat and settles idle", async () => {
      const s = setup();

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: { requestId: "r1" } }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(executeMock.mock.calls[0][1]).toBe("get_request");
      expect(delivered(s)).toEqual([{ tool: "get_request", toolCallId: "c1", output: OK }]);
      expect(s.result.current.running).toEqual([]);
      expect(s.result.current.runningRef.current.size).toBe(0);
    });

    it("counts an auto tool as running with its thread until it finishes (HH-M20)", async () => {
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup();

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: { requestId: "r1" } }));

      expect(s.result.current.running).toEqual([{ toolCallId: "c1", threadId: "thread-1" }]);
      expect(s.result.current.runningRef.current.has("c1")).toBe(true);

      run.finish(OK);
      await act(() => s.result.current.whenIdle());
      expect(s.result.current.running).toEqual([]);
    });

    it("runs calls one at a time in arrival order", async () => {
      const first = deferredRun();
      executeMock.mockReturnValueOnce(first.promise);
      const s = setup();

      act(() => {
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: { requestId: "r1" } });
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c2", input: { requestId: "r2" } });
      });
      await act(async () => {});
      expect(executeMock).toHaveBeenCalledTimes(1);

      first.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(executeMock.mock.calls.map((c) => (c[2] as { requestId: string }).requestId)).toEqual(["r1", "r2"]);
      expect(delivered(s).map((d) => d.toolCallId)).toEqual(["c1", "c2"]);
    });

    it("hands the tool a signal, the redacted-store ports and no grant", async () => {
      const s = setup();

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      const ctx = lastContext();
      expect(ctx?.signal?.aborted).toBe(false);
      expect(ctx?.approval).toBeUndefined();
      expect(ctx?.selection).toBeUndefined();
    });

    it("logs and carries on when the tool throws, and still frees the slot", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      executeMock.mockRejectedValueOnce(new Error("boom"));
      const s = setup();

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(error).toHaveBeenCalledWith("[relay] running a tool failed", expect.objectContaining({ tool: "get_request" }));
      expect(s.result.current.running).toEqual([]);
      expect(s.result.current.runningRef.current.size).toBe(0);
    });

    it("refuses a call when the chat is not ready to take output", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const s = setup();
      s.deps.addToolOutputRef.current = null;

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));

      expect(error).toHaveBeenCalledWith("[relay] chat is not ready for tool output", { toolCallId: "c1" });
      expect(executeMock).not.toHaveBeenCalled();
      expect(s.result.current.running).toEqual([]);
    });

    it("answers a call that arrives after Relay was turned off without running it", async () => {
      useRelayStore.setState({ enabled: false });
      const s = setup();

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).not.toHaveBeenCalled();
      expect(delivered(s)[0].output).toEqual({ ok: false, error: RELAY_DISABLED_ERROR });
    });

    it("queues a disable request when an approved preference change asks to turn Relay off", async () => {
      executeMock.mockResolvedValueOnce({ ok: true, data: { [DISABLE_AFTER_TURN]: true } });
      const s = setup([userMsg("u9")]);

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(useRelayStore.getState().pendingDisable).toEqual({
        threadId: "thread-1",
        turnId: "u9",
        toolCallId: "c1",
      });
    });

    it("does not queue a disable for a failed outcome or plain data", async () => {
      executeMock.mockResolvedValueOnce({ ok: false, error: "nope" });
      executeMock.mockResolvedValueOnce({ ok: true, data: null });
      const s = setup();

      act(() => {
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} });
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c2", input: {} });
      });
      await act(() => s.result.current.whenIdle());

      expect(useRelayStore.getState().pendingDisable).toBeNull();
    });

    it("logs a failed delivery instead of crashing", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const s = setup();
      s.addToolOutput.mockRejectedValueOnce(new Error("chat gone"));

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(error).toHaveBeenCalledWith("[relay] recording a tool output failed", expect.objectContaining({ tool: "get_request" }));
    });
  });

  describe("cards", () => {
    const deleteCall = { toolName: "delete_requests", toolCallId: "d1", input: DELETE_INPUT };
    const withPendingDelete = () =>
      setup([userMsg("u1"), assistantWith(openCall("d1", "delete_requests", DELETE_INPUT))]);

    it("holds a confirm tool until the user answers", async () => {
      const s = withPendingDelete();

      act(() => s.result.current.handleToolCall(deleteCall));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).not.toHaveBeenCalled();
      expect(s.result.current.running).toEqual([]);
    });

    it("Approve runs the tool with an approval grant under the mode it was decided in", async () => {
      const s = withPendingDelete();
      act(() => s.result.current.handleToolCall(deleteCall));
      useRelayPermissionStore.setState({ mode: "skip" });

      act(() => s.result.current.resolve("d1", { kind: "approve" }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).toHaveBeenCalledTimes(1);
      const ctx = lastContext();
      expect(ctx?.approval).toBeDefined();
      expect(ctx?.selection).toBeUndefined();
      expect(ctx?.permissionMode).toBe("review");
      expect(delivered(s)[0]).toMatchObject({ toolCallId: "d1", output: OK });
    });

    it("Decline answers 'user declined' without running the tool", async () => {
      const s = withPendingDelete();
      act(() => s.result.current.handleToolCall(deleteCall));

      act(() => s.result.current.resolve("d1", { kind: "decline" }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).not.toHaveBeenCalled();
      expect(delivered(s)[0].output).toEqual({ ok: false, error: "user declined" });
    });

    it("an answer without approve passes the choice but no approval", async () => {
      const s = withPendingDelete();
      act(() => s.result.current.handleToolCall(deleteCall));

      act(() => s.result.current.resolve("d1", { kind: "answer", choice: "discard" }));
      await act(() => s.result.current.whenIdle());

      const ctx = lastContext();
      expect(ctx?.selection).toBe("discard");
      expect(ctx?.approval).toBeUndefined();
    });

    it("an answer with approve passes both the choice and an approval", async () => {
      const s = withPendingDelete();
      act(() => s.result.current.handleToolCall(deleteCall));

      act(() => s.result.current.resolve("d1", { kind: "answer", choice: "save-all", approve: true }));
      await act(() => s.result.current.whenIdle());

      const ctx = lastContext();
      expect(ctx?.selection).toBe("save-all");
      expect(ctx?.approval).toBeDefined();
    });

    it("ignores an answer for a call that is not pending", async () => {
      const s = setup();

      act(() => s.result.current.resolve("nope", { kind: "approve" }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).not.toHaveBeenCalled();
      expect(s.addToolOutput).not.toHaveBeenCalled();
    });

    it("a card on a restored thread (no recorded binding) can still be answered", async () => {
      const s = withPendingDelete();

      act(() => s.result.current.resolve("d1", { kind: "approve" }));
      await act(() => s.result.current.whenIdle());

      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    it("does not answer a restored card when the chat is not ready", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const s = withPendingDelete();
      s.deps.addToolOutputRef.current = null;

      act(() => s.result.current.resolve("d1", { kind: "approve" }));

      expect(executeMock).not.toHaveBeenCalled();
    });

    it("marks an approved call as running in storage until it settles (HH-M22)", async () => {
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "thread-1" });
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = withPendingDelete();
      act(() => s.result.current.handleToolCall(deleteCall));

      act(() => s.result.current.resolve("d1", { kind: "approve" }));
      await vi.waitFor(async () =>
        expect((await getThread("thread-1"))?.runningToolCalls).toEqual(["d1"]),
      );

      run.finish(OK);
      await act(() => s.result.current.whenIdle());
      await vi.waitFor(async () =>
        expect((await getThread("thread-1"))?.runningToolCalls).toEqual([]),
      );
    });
  });

  describe("Stop (HH-H01, HH-M01)", () => {
    it("abortAll reaches the signal of a running tool", async () => {
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup();
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(async () => {});
      const signal = lastContext()?.signal as AbortSignal;
      expect(signal.aborted).toBe(false);

      act(() => s.result.current.abortAll());

      expect(signal.aborted).toBe(true);
      run.finish({ ok: false, error: "aborted" });
      await act(() => s.result.current.whenIdle());
      expect(delivered(s)[0].output).toEqual({ ok: false, error: "aborted" });
    });

    it("a call queued behind a running one is answered as stopped without running", async () => {
      const first = deferredRun();
      executeMock.mockReturnValueOnce(first.promise);
      const s = setup();
      act(() => {
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} });
        s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c2", input: {} });
      });
      await act(async () => {});

      act(() => s.result.current.abortAll());
      first.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(delivered(s).find((d) => d.toolCallId === "c2")?.output).toEqual({
        ok: false,
        error: ABORTED_BEFORE_START_ERROR,
      });
    });

    it("whenIdle waits for the late output to be recorded in the chat", async () => {
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      let recorded = false;
      const s = setup();
      s.addToolOutput.mockImplementation(async () => {
        await Promise.resolve();
        recorded = true;
      });
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      act(() => s.result.current.abortAll());
      run.finish(OK);

      await act(() => s.result.current.whenIdle());

      expect(recorded).toBe(true);
    });
  });

  describe("captured binding (HH-H06)", () => {
    it("attributes the call to the turn and thread captured when it arrived", async () => {
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup([userMsg("u1")], "thread-A");
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(async () => {});

      // The user switches thread and sends another message while the tool runs.
      s.deps.chatIdRef.current = "thread-B";
      s.deps.messagesRef.current = [userMsg("u2")];
      run.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(lastContext()?.write?.origin).toEqual({
        threadId: "thread-A",
        turnId: "u1",
        toolCallId: "c1",
      });
    });

    it("passes the turn's enabled set, which does not include the call itself (HH-M03)", async () => {
      const s = setup([
        userMsg("u1"),
        assistantWith(openCall("c1", "export_history", { format: "json" })),
      ]);

      act(() =>
        s.result.current.handleToolCall({ toolName: "export_history", toolCallId: "c1", input: {} }),
      );
      await act(() => s.result.current.whenIdle());

      const enabled = lastContext()?.enabledTools;
      expect(enabled?.has("get_request")).toBe(true);
      expect(enabled?.has("export_history")).toBe(false);
    });

    it("enables a tool once load_tools opened its group earlier in the turn (HH-M03)", async () => {
      const loaded = openCall("c0", "load_tools", { topic: "transfer" });
      const s = setup([userMsg("u1"), assistantWith(loaded, openCall("c1", "export_history", {}))]);

      act(() =>
        s.result.current.handleToolCall({ toolName: "export_history", toolCallId: "c1", input: {} }),
      );
      await act(() => s.result.current.whenIdle());

      expect(lastContext()?.enabledTools?.has("export_history")).toBe(true);
    });

    it("falls back to the thread id as turn id when no user message exists", async () => {
      const s = setup([], "thread-A");

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(lastContext()?.write?.origin?.turnId).toBe("thread-A");
    });

    it("keeps the turn's attachments from the message that carried them", async () => {
      const withChip: UIMessage = {
        ...userMsg("u1"),
        metadata: { attachments: [{ id: "t1", kind: "tab", label: "Orders" }] },
      };
      const s = setup([withChip]);

      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(() => s.result.current.whenIdle());

      expect(lastContext()?.attached).toEqual([{ kind: "tab", id: "t1", label: "Orders" }]);
    });

    it("writes the result of a call whose thread was left into the stored thread, not the shown chat", async () => {
      const toolMessage = assistantWith(openCall("c1", "get_request", {}));
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "thread-A" });
      scheduleThreadSave("thread-A", { messages: [userMsg("u1"), toolMessage], interruptedMessageId: null });
      await flushThreadWrites();
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup([userMsg("u1")], "thread-A");
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(async () => {});

      s.deps.chatIdRef.current = "thread-B";
      run.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(s.addToolOutput).not.toHaveBeenCalled();
      const stored = (await getThread("thread-A"))?.messages.at(-1)?.parts[0] as { state: string; output: unknown };
      expect(stored).toMatchObject({ state: "output-available", output: OK });
    });

    it("drops the result for a deleted thread with a warning and no crash", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup([userMsg("u1")], "thread-gone");
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(async () => {});

      s.deps.chatIdRef.current = "thread-B";
      run.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(warn).toHaveBeenCalledWith("[relay] dropped a tool output for a deleted thread", {
        threadId: "thread-gone",
        toolCallId: "c1",
      });
      expect(s.addToolOutput).not.toHaveBeenCalled();
      expect(s.result.current.running).toEqual([]);
    });

    it("delivers through the chat's current output function when the chat was rebuilt", async () => {
      const run = deferredRun();
      executeMock.mockReturnValueOnce(run.promise);
      const s = setup();
      act(() => s.result.current.handleToolCall({ toolName: "get_request", toolCallId: "c1", input: {} }));
      await act(async () => {});
      const rebuilt = vi.fn().mockResolvedValue(undefined);
      s.deps.addToolOutputRef.current = rebuilt as unknown as AddToolOutput;

      run.finish(OK);
      await act(() => s.result.current.whenIdle());

      expect(rebuilt).toHaveBeenCalledTimes(1);
      expect(s.addToolOutput).not.toHaveBeenCalled();
    });
  });
});
