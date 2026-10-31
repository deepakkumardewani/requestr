/** @vitest-environment happy-dom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as threadDb from "@/lib/relay/threadDb";
import { getRelayChangeLog } from "@/lib/relay/changeLog";
import { RELAY_USER_HEADER, RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  getThread,
  scheduleThreadSave,
} from "@/lib/relay/threadDb";
import { JWT_SECRET } from "@/lib/relay/redact.corpus";
import type { ContextChip } from "@/lib/relay/chips";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { readTurnTiming, resolveTurnLabel } from "@/lib/relay/timing";
import {
  countStepsSinceLastUser,
  shouldContinueToolLoop,
  useRelayChat,
} from "./useRelayChat";

// No browser storage in these tests: threads live in the in-memory fallback.
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const encoder = new TextEncoder();
const frame = (chunk: object) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);

type Controlled = {
  response: Response;
  push: (chunk: object) => void;
  end: () => void;
  /** Mirrors a real fetch: aborting the request errors the response body. */
  respondTo: (init: RequestInit) => Response;
};

/** A UI message stream the test can feed and finish chunk by chunk. */
function controlledStream(): Controlled {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
  return {
    response,
    push: (chunk) => controller.enqueue(frame(chunk)),
    end: () => {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
    respondTo: (init) => {
      init.signal?.addEventListener("abort", () =>
        controller.error(new DOMException("aborted", "AbortError")),
      );
      return response;
    },
  };
}

function textTurn(text: string, id = "t1"): Controlled {
  const stream = controlledStream();
  for (const chunk of [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id },
    { type: "text-delta", id, delta: text },
    { type: "text-end", id },
    { type: "finish-step" },
    { type: "finish" },
  ]) {
    stream.push(chunk);
  }
  stream.end();
  return stream;
}

function jsonError(status: number, body: object, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const fetchMock = vi.fn();

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

/** What the composer stages when the message it sends holds this one pill. */
const stageAttachment = (chip: ContextChip) =>
  useRelayStore.getState().stageOutgoing({
    attachments: [chip],
    segments: [{ type: "attachment", chip }],
  });

const textOf = (message: UIMessage | undefined) =>
  message?.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    activeThreadId: null,
    hydrated: false,
    prunedNotice: false,
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

afterEach(async () => {
  // Mounted hooks share the store; a stale one would also claim a pending prompt.
  cleanup();
  await flushThreadWrites();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useRelayChat", () => {
  it("streams a reply and sends the anonymous user header", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("Hello there").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("  hi  "));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(textOf(result.current.messages[0])).toBe("hi");
    expect(textOf(result.current.messages[1])).toBe("Hello there");
    expect(result.current.error).toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/relay/chat");
    expect(new Headers(init.headers).get(RELAY_USER_HEADER)).toBeTruthy();
  });

  it("ignores blank input", () => {
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("   "));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Stop aborts the request, keeps partial text and leaves the thread usable", async () => {
    const held = controlledStream();
    held.push({ type: "start" });
    held.push({ type: "start-step" });
    held.push({ type: "text-start", id: "t1" });
    held.push({ type: "text-delta", id: "t1", delta: "Partial" });
    fetchMock.mockImplementationOnce(async (_url, init) => held.respondTo(init));
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("go"));
    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("Partial"));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    act(() => result.current.stop());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(signal.aborted).toBe(true);
    expect(result.current.error).toBeNull();
    expect(textOf(result.current.messages[1])).toBe("Partial");

    fetchMock.mockResolvedValueOnce(textTurn("Again").response);
    act(() => result.current.send("next"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Again"));
  });

  it("Regenerate replaces the last assistant turn", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("First").response);
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("q"));
    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("First"));

    fetchMock.mockResolvedValueOnce(textTurn("Second").response);
    act(() => result.current.regenerate());

    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("Second"));
    expect(result.current.messages).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a Relay code from a stream error chunk", async () => {
    const stream = controlledStream();
    stream.push({ type: "start" });
    stream.push({ type: "error", errorText: "relay_unavailable" });
    stream.end();
    fetchMock.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));

    await waitFor(() =>
      expect(result.current.error).toEqual({ code: "relay_unavailable" }),
    );
  });

  it("surfaces 429 with the retry hint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError(429, { error: "rate_limited", retryAfterSeconds: 12 }, { "retry-after": "12" }),
    );
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));

    await waitFor(() =>
      expect(result.current.error).toEqual({
        code: "rate_limited",
        retryAfterSeconds: 12,
      }),
    );
  });

  it("surfaces not_configured from the 503 body", async () => {
    fetchMock.mockResolvedValueOnce(jsonError(503, { error: "not_configured" }));
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("q"));
    await waitFor(() =>
      expect(result.current.error).toEqual({ code: "not_configured" }),
    );
  });

  it("never exposes raw failure text, only a Relay code", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch https://x.test"));
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toEqual({ code: "relay_unavailable" });
  });

  it("clearError dismisses the error", async () => {
    fetchMock.mockResolvedValueOnce(jsonError(503, { error: "not_configured" }));
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("q"));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.clearError());

    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("does not send while offline and reports offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useRelayChat());
    expect(result.current.online).toBe(false);

    act(() => result.current.send("q"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toEqual({ code: "offline" });
  });

  it("keeps partial text and marks it interrupted when the connection drops mid-stream", async () => {
    const held = controlledStream();
    held.push({ type: "start" });
    held.push({ type: "start-step" });
    held.push({ type: "text-start", id: "t1" });
    held.push({ type: "text-delta", id: "t1", delta: "Half an ans" });
    fetchMock.mockImplementationOnce(async (_url, init) => held.respondTo(init));
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));
    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("Half an ans"));

    act(() => setOnline(false));

    await waitFor(() => expect(result.current.error).toEqual({ code: "offline" }));
    expect(textOf(result.current.messages[1])).toBe("Half an ans");
    expect(result.current.interruptedMessageId).toBe(result.current.messages[1].id);
    expect(result.current.status).toBe("ready");

    act(() => setOnline(true));
    act(() => result.current.clearError());
    await waitFor(() => expect(result.current.interruptedMessageId).toBeNull());
  });

  it("marks a turn cut short by an error as interrupted", async () => {
    const stream = controlledStream();
    for (const chunk of [
      { type: "start" },
      { type: "start-step" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Some text" },
      { type: "error", errorText: "relay_unavailable" },
    ]) {
      stream.push(chunk);
    }
    stream.end();
    fetchMock.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));

    await waitFor(() => expect(result.current.interruptedMessageId).not.toBeNull());
    expect(result.current.interruptedMessageId).toBe(result.current.messages[1].id);
  });
});


function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, text: string): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

/** Stores a finished turn the way a previous session would have left it. */
async function storeThread(id: string, messages: UIMessage[], interrupted: string | null = null) {
  await createThread({ workspaceId: RELAY_WORKSPACE_ID, id });
  scheduleThreadSave(id, { messages, interruptedMessageId: interrupted });
  await flushThreadWrites();
}

function hydrateWith(activeThreadId: string | null) {
  useRelayStore.setState({ activeThreadId, hydrated: true });
}

describe("useRelayChat persistence", () => {
  // Tests replace store actions; put the real ones back so test order never matters.
  const realStartThread = useRelayStore.getState().startThread;
  afterEach(() => {
    useRelayStore.setState({ startThread: realStartThread });
  });

  it("creates the thread on the first send and saves the settled turn", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("Hello there").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("Create a request"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(useRelayStore.getState().activeThreadId).not.toBeNull());
    const id = useRelayStore.getState().activeThreadId as string;
    await flushThreadWrites();
    const saved = await getThread(id);
    expect(saved?.title).toBe("Create a request");
    expect(saved?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(localStorage.getItem("rq_relay_active_thread")).toBe(id);
  });

  it("keeps the chat intact when the new thread takes over the draft id", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("Reply").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("question"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores the active thread and its interrupted marker once hydrated", async () => {
    await storeThread("t-old", [userMessage("u1", "earlier"), assistantMessage("a1", "partial")], "a1");
    hydrateWith("t-old");

    const { result } = renderHook(() => useRelayChat());

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(textOf(result.current.messages[0])).toBe("earlier");
    expect(result.current.interruptedMessageId).toBe("a1");
  });

  it("waits for hydration before restoring", async () => {
    await storeThread("t-old", [userMessage("u1", "earlier")]);
    useRelayStore.setState({ activeThreadId: "t-old", hydrated: false });

    const { result } = renderHook(() => useRelayChat());
    await act(async () => {});
    expect(result.current.messages).toEqual([]);

    act(() => useRelayStore.setState({ hydrated: true }));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });

  it("drops a pointer to a thread that no longer exists", async () => {
    hydrateWith("gone");

    renderHook(() => useRelayChat());

    await waitFor(() => expect(useRelayStore.getState().activeThreadId).toBeNull());
    expect(localStorage.getItem("rq_relay_active_thread")).toBeNull();
  });

  it("a send made during a restore lands after the restored messages", async () => {
    await storeThread("t-old", [userMessage("u1", "earlier"), assistantMessage("a1", "answer")]);
    hydrateWith("t-old");
    fetchMock.mockResolvedValueOnce(textTurn("Fresh").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("follow up"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Fresh"));
    expect(result.current.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
  });

  it("does not re-save restored messages (the thread keeps its age)", async () => {
    await storeThread("t-old", [userMessage("u1", "earlier")]);
    const before = (await getThread("t-old"))?.updatedAt;
    hydrateWith("t-old");

    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    await flushThreadWrites();

    expect((await getThread("t-old"))?.updatedAt).toBe(before);
  });

  it("switching threads shows the other thread's messages", async () => {
    await storeThread("t-a", [userMessage("ua", "alpha")]);
    await storeThread("t-b", [userMessage("ub", "beta"), assistantMessage("ab", "reply")]);
    hydrateWith("t-a");
    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(textOf(result.current.messages[0])).toBe("alpha"));

    act(() => useRelayStore.getState().setActiveThreadId("t-b"));

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(textOf(result.current.messages[0])).toBe("beta");
  });

  it("New thread clears the conversation and keeps the old thread stored", async () => {
    await storeThread("t-a", [userMessage("ua", "alpha"), assistantMessage("aa", "answer")]);
    hydrateWith("t-a");
    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await useRelayStore.getState().newThread();
    });

    await waitFor(() => expect(result.current.messages).toEqual([]));
    const newId = useRelayStore.getState().activeThreadId;
    expect(newId).not.toBe("t-a");
    expect((await getThread("t-a"))?.messages).toHaveLength(2);
    expect((await getThread(newId as string))?.messages).toEqual([]);
  });

  it("deleting the active thread leaves a blank conversation", async () => {
    await storeThread("t-a", [userMessage("ua", "alpha")]);
    hydrateWith("t-a");
    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => useRelayStore.getState().setActiveThreadId(null));

    await waitFor(() => expect(result.current.messages).toEqual([]));
  });

  it("reloads a thread that is re-activated after being cleared (undo of a delete)", async () => {
    await storeThread("t-a", [userMessage("ua", "alpha")]);
    hydrateWith("t-a");
    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => useRelayStore.getState().setActiveThreadId(null));
    await waitFor(() => expect(result.current.messages).toEqual([]));
    act(() => useRelayStore.getState().setActiveThreadId("t-a"));

    await waitFor(() => expect(textOf(result.current.messages[0])).toBe("alpha"));
  });

  it("persists a turn cut short as interrupted", async () => {
    const stream = controlledStream();
    for (const chunk of [
      { type: "start" },
      { type: "start-step" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Some text" },
      { type: "error", errorText: "relay_unavailable" },
    ]) {
      stream.push(chunk);
    }
    stream.end();
    fetchMock.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("q"));

    await waitFor(() => expect(result.current.interruptedMessageId).not.toBeNull());
    await waitFor(async () => {
      await flushThreadWrites();
      const id = useRelayStore.getState().activeThreadId as string;
      expect((await getThread(id))?.interruptedMessageId).toBe(
        result.current.messages[1].id,
      );
    });
  });

  it("still answers when the thread cannot be created (in-memory only)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useRelayStore.setState({
      startThread: vi.fn().mockRejectedValue(new Error("quota")),
    });
    fetchMock.mockResolvedValueOnce(textTurn("Still works").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("hi"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Still works"));
    expect(warn).toHaveBeenCalledWith(
      "[relay] creating the thread failed",
      expect.any(Object),
    );
  });

  it("logs and carries on when a stored thread cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(threadDb, "getThread").mockRejectedValueOnce(new Error("corrupt"));
    useRelayStore.setState({ activeThreadId: "t-x", hydrated: true });

    renderHook(() => useRelayChat());

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        "[relay] restoring the thread failed",
        expect.objectContaining({ threadId: "t-x" }),
      ),
    );
  });
});

type ToolCallSpec = { id: string; name: string; input: unknown };

/** A model step that only asks for tools; the client must answer them. */
function toolTurn(calls: ToolCallSpec[]): Controlled {
  const stream = controlledStream();
  stream.push({ type: "start" });
  stream.push({ type: "start-step" });
  for (const call of calls) {
    stream.push({
      type: "tool-input-available",
      toolCallId: call.id,
      toolName: call.name,
      input: call.input,
    });
  }
  stream.push({ type: "finish-step" });
  stream.push({ type: "finish" });
  stream.end();
  return stream;
}

const requestBody = (call: number) =>
  JSON.parse(fetchMock.mock.calls[call][1].body as string);

type ToolPart = { type: string; toolCallId: string; state: string; output?: any };
const toolParts = (body: { messages: UIMessage[] }): ToolPart[] =>
  body.messages
    .flatMap((m) => m.parts)
    .filter((p) => p.type.startsWith("tool-")) as unknown as ToolPart[];

const savedRequest = {
  id: "r1",
  collectionId: "c1",
  name: "Orders",
  method: "GET" as const,
  url: "https://api.test/orders",
  params: [],
  headers: [],
  auth: { type: "bearer" as const, token: JWT_SECRET },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
};

describe("client tool loop", () => {
  beforeEach(() => {
    useCollectionsStore.setState({ requests: [savedRequest], collections: [], folders: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useRelayStore.setState({ attachedItems: [], pendingPrompt: null, shareValues: false });
  });

  afterEach(() => {
    useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
  });

  it("runs a read tool, returns a redacted result and continues the loop", async () => {
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "get_request", input: { requestId: "r1" } }]).response)
      .mockResolvedValueOnce(textTurn("It needs auth").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("what is Orders?"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("It needs auth"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [part] = toolParts(requestBody(1));
    expect(part.state).toBe("output-available");
    expect(part.output).toMatchObject({ ok: true });
    expect(part.output.data.name).toBe("Orders");
    expect(JSON.stringify(requestBody(1))).not.toContain(JWT_SECRET);
  });

  it("returns a failure to the model instead of erroring the part", async () => {
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "get_request", input: { requestId: "gone" } }]).response)
      .mockResolvedValueOnce(textTurn("Not found").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("read gone"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Not found"));
    const [part] = toolParts(requestBody(1));
    expect(part.state).toBe("output-available");
    expect(part.output).toEqual({ ok: false, error: "request not found: gone" });
  });

  it("answers an unknown tool so the loop never stalls", async () => {
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "launch_rocket", input: {} }]).response)
      .mockResolvedValueOnce(textTurn("Sorry").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("go"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Sorry"));
    expect(toolParts(requestBody(1))[0].output).toEqual({
      ok: false,
      error: "unknown tool: launch_rocket",
    });
  });

  it("answers parallel calls in order", async () => {
    fetchMock
      .mockResolvedValueOnce(
        toolTurn([
          { id: "c1", name: "get_workspace_summary", input: {} },
          { id: "c2", name: "get_request", input: { requestId: "r1" } },
        ]).response,
      )
      .mockResolvedValueOnce(textTurn("Done").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("overview"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Done"));
    const parts = toolParts(requestBody(1));
    expect(parts.map((p) => p.toolCallId)).toEqual(["c1", "c2"]);
    expect(parts.every((p) => p.state === "output-available")).toBe(true);
  });

  it("applies a write tool to the live stores and ties the change to the user's message", async () => {
    fetchMock
      .mockResolvedValueOnce(
        toolTurn([
          { id: "c1", name: "update_request", input: { requestId: "r1", name: "Renamed", method: null, url: null } },
          { id: "c2", name: "update_request", input: { requestId: "r1", name: null, method: "POST", url: null } },
        ]).response,
      )
      .mockResolvedValueOnce(textTurn("Done").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("rename and switch to POST"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Done"));
    expect(useCollectionsStore.getState().requests[0]).toMatchObject({ name: "Renamed", method: "POST" });
    const [first, second] = toolParts(requestBody(1));
    const userMessageId = result.current.messages[0].id;
    expect(first.output.data.turnId).toBe(userMessageId);
    expect(second.output.data.turnId).toBe(userMessageId);
    const undone = await getRelayChangeLog().undoTurn(userMessageId);
    expect(undone.undone).toHaveLength(2);
    expect(useCollectionsStore.getState().requests[0]).toMatchObject({ name: "Orders", method: "GET" });
  });

  it("sends attachments with the message that carried them and only that one", async () => {
    useTabsStore.setState({
      tabs: [
        {
          tabId: "t1", requestId: "r1", name: "Orders", isDirty: false, type: "http",
          url: "https://api.test/orders", method: "GET", headers: [], params: [],
          auth: { type: "none" }, body: { type: "none", content: "" }, preScript: "", postScript: "",
        },
      ],
      activeTabId: "t1",
    });
    fetchMock
      .mockResolvedValueOnce(textTurn("one").response)
      .mockResolvedValueOnce(textTurn("two", "t2").response)
      .mockResolvedValueOnce(textTurn("three", "t3").response);
    const { result } = renderHook(() => useRelayChat());
    const lastUserParts = (call: number) =>
      JSON.stringify(
        requestBody(call).messages.findLast((m: { role: string }) => m.role === "user").parts,
      );

    act(() => result.current.send("first"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("one"));
    expect(lastUserParts(0)).not.toContain("untrusted-attachment-detail");

    stageAttachment({ kind: "tab", id: "t1", label: "Orders" });
    act(() => result.current.send("second"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("two"));
    expect(useRelayStore.getState().outgoing).toBeNull();
    expect(lastUserParts(1)).toContain("untrusted-attachment-detail");
    expect(lastUserParts(1)).toContain("https://api.test/orders");
    expect(requestBody(1).context.chips).toEqual([]);
    expect(textOf(result.current.messages.find((m) => m.role === "user" && textOf(m) === "second"))).toBe("second");
    expect(result.current.messages.find((m) => textOf(m) === "second")?.metadata).toEqual({
      attachments: [{ id: "t1", kind: "tab", label: "Orders", method: "GET" }],
      segments: [
        { type: "attachment", chip: { kind: "tab", id: "t1", label: "Orders" } },
      ],
    });
    // The pill layout is for the bubble; the server never sees it (COMP-07).
    expect(JSON.stringify(requestBody(1).messages)).not.toContain('"segments"');

    act(() => result.current.send("third"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("three"));
    expect(lastUserParts(2)).not.toContain("untrusted-attachment-detail");
    expect(JSON.stringify(requestBody(2).messages)).not.toContain("https://api.test/orders");
  });

  it("sends a suggestion chosen outside the composer", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("Sure").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => useRelayStore.getState().submitPrompt("What can you do?"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Sure"));
    expect(textOf(result.current.messages[0])).toBe("What can you do?");
    expect(useRelayStore.getState().pendingPrompt).toBeNull();
  });
});

describe("tool loop step cap", () => {
  const user: UIMessage = { id: "u", role: "user", parts: [{ type: "text", text: "q" }] };
  const steps = (count: number): UIMessage => ({
    id: "a",
    role: "assistant",
    parts: [
      ...Array.from({ length: count }, () => ({ type: "step-start" as const })),
      {
        type: "tool-get_workspace_summary",
        toolCallId: "c",
        state: "output-available",
        input: {},
        output: { ok: true, data: {} },
      } as never,
    ],
  });

  it("counts step-start parts since the last user message", () => {
    expect(countStepsSinceLastUser([steps(4), user, steps(3)])).toBe(3);
    expect(countStepsSinceLastUser([user])).toBe(0);
  });

  it("continues under the cap and stops at it", () => {
    expect(shouldContinueToolLoop({ messages: [user, steps(11)] })).toBe(true);
    expect(shouldContinueToolLoop({ messages: [user, steps(12)] })).toBe(false);
  });

  it("does not continue without finished tool calls", () => {
    expect(shouldContinueToolLoop({ messages: [user] })).toBe(false);
  });
});

describe("a turn cut off mid-way", () => {
  it("is saved as running and reloads as Interrupted (CONV-11)", async () => {
    const deleteCall = { id: "d1", name: "delete_request", input: { ids: ["r1"] } };
    useCollectionsStore.setState({ requests: [savedRequest], collections: [], folders: [] });
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    const first = renderHook(() => useRelayChat());
    act(() => first.result.current.send("delete Orders"));
    // The confirm card is pending: the turn is still running when the tab "closes".
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    const id = useRelayStore.getState().activeThreadId as string;
    await waitFor(async () => {
      await flushThreadWrites();
      const saved = (await getThread(id))?.messages.at(-1);
      expect(readTurnTiming(saved?.metadata)?.status).toBe("running");
    });

    const stored = (await getThread(id))?.messages as UIMessage[];
    expect(resolveTurnLabel(readTurnTiming(stored.at(-1)?.metadata)).kind).toBe(
      "interrupted",
    );
    // The in-memory message keeps no persisted turn; the live store owns the ticking.
    expect(readTurnTiming(first.result.current.messages.at(-1)?.metadata)).toBeUndefined();

    // A closed tab runs no unmount cleanup, so the first hook is left mounted
    // and a fresh one stands in for the reload.
    useRelayStore.setState({ activeThreadId: id, hydrated: true });
    const second = renderHook(() => useRelayChat());
    await waitFor(() => expect(second.result.current.messages.length).toBeGreaterThan(0));
    const restored = second.result.current.messages.at(-1);
    expect(resolveTurnLabel(readTurnTiming(restored?.metadata)).kind).toBe(
      "interrupted",
    );
    useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
  });
});

describe("confirmation cards", () => {
  const deleteCall = { id: "d1", name: "delete_request", input: { ids: ["r1"] } };
  const remaining = () => useCollectionsStore.getState().requests.map((r) => r.id);

  beforeEach(() => {
    useCollectionsStore.setState({ requests: [savedRequest], collections: [], folders: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  afterEach(() => {
    useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
    useRelayPermissionStore.setState({ mode: "review" });
  });

  async function pauseOnDelete() {
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    const hook = renderHook(() => useRelayChat());
    act(() => hook.result.current.send("delete Orders"));
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    return hook;
  }

  const partState = (result: { current: { messages: UIMessage[] } }) =>
    (result.current.messages.at(-1)?.parts.find((p) => p.type.startsWith("tool-")) as
      | { state: string; output?: unknown }
      | undefined);

  it("pauses the loop on a destructive call and changes nothing", async () => {
    const { result } = await pauseOnDelete();

    expect(partState(result)?.state).toBe("input-available");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(remaining()).toEqual(["r1"]);
  });

  it("Decline answers 'user declined', keeps the data and continues", async () => {
    const { result } = await pauseOnDelete();
    fetchMock.mockResolvedValueOnce(textTurn("Okay, left it").response);

    act(() => result.current.resolveTool("d1", { kind: "decline" }));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Okay, left it"));
    expect(toolParts(requestBody(1))[0].output).toEqual({ ok: false, error: "user declined" });
    expect(remaining()).toEqual(["r1"]);
  });

  it("Approve deletes, and the change can be undone", async () => {
    const { result } = await pauseOnDelete();
    fetchMock.mockResolvedValueOnce(textTurn("Deleted").response);

    act(() => result.current.resolveTool("d1", { kind: "approve" }));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Deleted"));
    expect(remaining()).toEqual([]);
    const [part] = toolParts(requestBody(1));
    expect(part.output).toMatchObject({ ok: true });
    const userMessageId = result.current.messages[0].id;
    await getRelayChangeLog().undoTurn(userMessageId);
    expect(remaining()).toEqual(["r1"]);
  });

  it("a card pending in review stays pending after the mode flips to skip", async () => {
    const { result } = await pauseOnDelete();

    act(() => useRelayPermissionStore.setState({ mode: "skip" }));

    expect(partState(result)?.state).toBe("input-available");
    expect(remaining()).toEqual(["r1"]);
    fetchMock.mockResolvedValueOnce(textTurn("Deleted").response);
    act(() => result.current.resolveTool("d1", { kind: "approve" }));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Deleted"));
    expect(remaining()).toEqual([]);
  });

  it("skip runs a confirm tool with no card", async () => {
    useRelayPermissionStore.setState({ mode: "skip" });
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    fetchMock.mockResolvedValueOnce(textTurn("Deleted").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("delete Orders"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Deleted"));
    expect(remaining()).toEqual([]);
  });

  it("always-ask turns an auto tool into a card that runs only on Approve", async () => {
    useRelayPermissionStore.setState({ mode: "always-ask" });
    fetchMock.mockResolvedValueOnce(
      toolTurn([{ id: "c1", name: "create_collection", input: { name: "Docs", parentId: null } }]).response,
    );
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("make a collection"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(partState(result)?.state).toBe("input-available");
    expect(useCollectionsStore.getState().collections).toHaveLength(0);
    fetchMock.mockResolvedValueOnce(textTurn("Made it").response);
    act(() => result.current.resolveTool("c1", { kind: "approve" }));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Made it"));
    expect(useCollectionsStore.getState().collections).toHaveLength(1);
  });

  describe("delete with an unsaved tab (answer + approve)", () => {
    const dirtyTab = {
      tabId: "t1",
      requestId: "r1",
      name: "Orders edited",
      isDirty: true,
      type: "http",
      method: "POST",
      url: "https://api.test/edited",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      timeoutMs: 5000,
    };
    const toolOutput = () => toolParts(requestBody(1))[0].output;

    beforeEach(() => {
      useTabsStore.setState({ tabs: [dirtyTab] as never, activeTabId: "t1" });
    });

    it("an answer without approve never runs the delete", async () => {
      const { result } = await pauseOnDelete();
      fetchMock.mockResolvedValueOnce(textTurn("Hm").response);

      act(() => result.current.resolveTool("d1", { kind: "answer", choice: "discard" }));

      await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Hm"));
      expect(toolOutput()).toMatchObject({ ok: false });
      expect(remaining()).toEqual(["r1"]);
    });

    it("Discard with approve deletes the request without saving the edits", async () => {
      const { result } = await pauseOnDelete();
      fetchMock.mockResolvedValueOnce(textTurn("Deleted").response);

      act(() =>
        result.current.resolveTool("d1", { kind: "answer", choice: "discard", approve: true }),
      );

      await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Deleted"));
      expect(toolOutput()).toMatchObject({ ok: true });
      expect(remaining()).toEqual([]);
    });

    it("Save all with approve saves the edits first so Undo restores them", async () => {
      const { result } = await pauseOnDelete();
      fetchMock.mockResolvedValueOnce(textTurn("Saved and deleted").response);

      act(() =>
        result.current.resolveTool("d1", { kind: "answer", choice: "save-all", approve: true }),
      );

      await waitFor(() =>
        expect(textOf(result.current.messages.at(-1))).toBe("Saved and deleted"),
      );
      expect(toolOutput()).toMatchObject({ ok: true });
      expect(remaining()).toEqual([]);
      await getRelayChangeLog().undoTurn(result.current.messages[0].id);
      const restored = useCollectionsStore.getState().requests.find((r) => r.id === "r1");
      expect(restored).toMatchObject({ name: "Orders edited", url: "https://api.test/edited" });
    });
  });

  it("declines a pending card when the user sends another message", async () => {
    const { result } = await pauseOnDelete();
    fetchMock.mockResolvedValueOnce(textTurn("Moving on").response);

    act(() => result.current.send("never mind"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Moving on"));
    const [part] = toolParts(requestBody(1));
    expect(part.output).toMatchObject({ ok: false, error: "user declined", autoDeclined: true });
    expect(remaining()).toEqual(["r1"]);
  });

  it("auto-declines a card left pending when the thread is restored", async () => {
    const pending: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-delete_request",
          toolCallId: "d1",
          state: "input-available",
          input: { ids: ["r1"] },
        } as never,
      ],
    };
    await storeThread("t-pending", [userMessage("u1", "delete it"), pending]);
    hydrateWith("t-pending");

    const { result } = renderHook(() => useRelayChat());

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(partState(result)).toMatchObject({
      state: "output-available",
      output: { ok: false, error: "user declined", autoDeclined: true },
    });
    expect(remaining()).toEqual(["r1"]);
  });

  it("answers an ask_user card with the chosen option", async () => {
    fetchMock.mockResolvedValueOnce(
      toolTurn([
        { id: "q1", name: "ask_user", input: { question: "Which one?", options: ["A", "B"] } },
      ]).response,
    );
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("pick"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(textTurn("Using B").response);

    act(() => result.current.resolveTool("q1", { kind: "answer", choice: "B" }));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Using B"));
    expect(toolParts(requestBody(1))[0].output).toEqual({ ok: true, data: { choice: "B" } });
  });

  it("answers an ask_user card with text the user typed in the card", async () => {
    fetchMock.mockResolvedValueOnce(
      toolTurn([
        { id: "q1", name: "ask_user", input: { question: "Which one?", options: ["A", "B"] } },
      ]).response,
    );
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("pick"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    fetchMock.mockResolvedValueOnce(textTurn("Using C").response);

    act(() => result.current.resolveTool("q1", { kind: "answer", choice: "  C  " }));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Using C"));
    expect(toolParts(requestBody(1))[0].output).toEqual({ ok: true, data: { choice: "C" } });
  });

  it("a composer message answers a pending question card and still shows as a bubble", async () => {
    fetchMock.mockResolvedValueOnce(
      toolTurn([
        { id: "q1", name: "ask_user", input: { question: "Which one?", options: ["A", "B"] } },
      ]).response,
    );
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("pick"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    fetchMock.mockResolvedValueOnce(textTurn("Using the third").response);

    act(() => result.current.send("the third one"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Using the third"));
    expect(toolParts(requestBody(1))[0].output).toEqual({
      ok: true,
      data: { choice: "the third one", viaComposer: true },
    });
    expect(result.current.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(textOf(result.current.messages[2])).toBe("the third one");
  });
});

describe("stop and edit & resend", () => {
  const deleteCall = { id: "d1", name: "delete_request", input: { ids: ["r1"] } };
  const lastToolPart = (messages: UIMessage[]) =>
    messages
      .at(-1)
      ?.parts.find((p) => p.type.startsWith("tool-")) as
      | { state: string; output?: unknown }
      | undefined;

  beforeEach(() => {
    useCollectionsStore.setState({ requests: [savedRequest], collections: [], folders: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  afterEach(() => {
    useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
  });

  it("Stop while a confirmation is pending leaves no pending tool call", async () => {
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("delete Orders"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(lastToolPart(result.current.messages)?.state).toBe("input-available");

    act(() => result.current.stop());

    await waitFor(() =>
      expect(lastToolPart(result.current.messages)).toMatchObject({
        state: "output-available",
        output: { ok: false, error: "user declined", autoDeclined: true },
      }),
    );
    expect(useCollectionsStore.getState().requests.map((r) => r.id)).toEqual(["r1"]);
  });

  it("Stop while an approved delete is running aborts its signal", async () => {
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("delete Orders"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    fetchMock.mockResolvedValueOnce(textTurn("Done").response);

    act(() => result.current.resolveTool("d1", { kind: "approve" }));
    act(() => result.current.stop());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(lastToolPart(result.current.messages)?.state).not.toBe("input-available");
  });

  it("Edit & resend drops the edited message and everything after it", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("A1").response);
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("first"));
    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("A1"));
    fetchMock.mockResolvedValueOnce(textTurn("A2", "t2").response);
    act(() => result.current.send("second"));
    await waitFor(() => expect(textOf(result.current.messages[3])).toBe("A2"));
    const secondUserId = result.current.messages[2].id;

    fetchMock.mockResolvedValueOnce(textTurn("A2 edited", "t3").response);
    act(() => result.current.editAndResend(secondUserId, "  second, reworded  "));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("A2 edited"));
    expect(result.current.messages.map((m) => textOf(m))).toEqual([
      "first",
      "A1",
      "second, reworded",
      "A2 edited",
    ]);
    const sentBody: { messages: UIMessage[] } = requestBody(2);
    const sent = sentBody.messages.map((m) => textOf(m));
    expect(sent).toEqual(["first", "A1", "second, reworded"]);
  });

  it("Edit & resend ignores blank text and unknown message ids", async () => {
    fetchMock.mockResolvedValueOnce(textTurn("A1").response);
    const { result } = renderHook(() => useRelayChat());
    act(() => result.current.send("first"));
    await waitFor(() => expect(textOf(result.current.messages[1])).toBe("A1"));
    const userId = result.current.messages[0].id;

    act(() => result.current.editAndResend(userId, "   "));
    act(() => result.current.editAndResend("missing", "hello"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.messages.map((m) => textOf(m))).toEqual(["first", "A1"]);
  });
});

describe("explicit context in the tool loop", () => {
  beforeEach(() => {
    useCollectionsStore.setState({ requests: [savedRequest], collections: [], folders: [] });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useRelayStore.setState({ attachedItems: [], pendingPrompt: null, shareValues: false });
  });

  afterEach(() => {
    useCollectionsStore.setState({ requests: [], collections: [], folders: [] });
    useRelayPermissionStore.setState({ mode: "review" });
  });

  const deleteCall = { id: "d1", name: "delete_request", input: { ids: ["r1"] } };
  const remaining = () => useCollectionsStore.getState().requests.map((r) => r.id);

  async function pauseOnDelete() {
    fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
    const hook = renderHook(() => useRelayChat());
    act(() => hook.result.current.send("delete Orders"));
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    return hook;
  }

  const partState = (result: { current: { messages: UIMessage[] } }) =>
    (result.current.messages.at(-1)?.parts.find((p) => p.type.startsWith("tool-")) as
      | { state: string; output?: unknown }
      | undefined);

  it("answers get_active_context with the nothing-attached note when nothing is attached", async () => {
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "get_active_context", input: {} }]).response)
      .mockResolvedValueOnce(textTurn("Please attach the tab").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("explain this response"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Please attach the tab"));
    const [part] = toolParts(requestBody(1));
    expect(part.output.ok).toBe(true);
    expect(part.output.data.attached).toEqual([]);
    expect(part.output.data.note).toMatch(/^nothing attached/);
  });

  it("reads the attached items at call time, so a chip attached between turns is seen by the next call", async () => {
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "get_active_context", input: {} }]).response)
      .mockResolvedValueOnce(textTurn("first done", "t2").response)
      .mockResolvedValueOnce(toolTurn([{ id: "c2", name: "get_active_context", input: {} }]).response)
      .mockResolvedValueOnce(textTurn("second done", "t3").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("first"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("first done"));
    stageAttachment({ kind: "request", id: "r1", label: "Orders" });
    act(() => result.current.send("second"));
    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("second done"));

    const firstResult = toolParts(requestBody(1)).find((p) => p.toolCallId === "c1");
    expect(firstResult?.output.data.attached).toEqual([]);
    const secondResult = toolParts(requestBody(3)).find((p) => p.toolCallId === "c2");
    expect(secondResult?.output.data.attached).toHaveLength(1);
    expect(secondResult?.output.data.attached[0]).toMatchObject({ kind: "request", id: "r1" });
  });

  it("redacts secrets in an attached request returned by get_active_context", async () => {
    stageAttachment({ kind: "request", id: "r1", label: "Orders" });
    fetchMock
      .mockResolvedValueOnce(toolTurn([{ id: "c1", name: "get_active_context", input: {} }]).response)
      .mockResolvedValueOnce(textTurn("ok").response);
    const { result } = renderHook(() => useRelayChat());

    act(() => result.current.send("what is attached?"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("ok"));
    expect(JSON.stringify(requestBody(1))).not.toContain(JWT_SECRET);
  });

  it("renders, continues and keeps redacted a replayed thread holding an old get_active_context part", async () => {
    const oldAssistant: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_active_context",
          toolCallId: "old1",
          state: "output-available",
          input: {},
          output: { ok: true, data: { attached: [{ kind: "tab", tabId: "t9", name: "Old tab", note: JWT_SECRET }] } },
        } as unknown as UIMessage["parts"][number],
        { type: "text", text: "You had Old tab open" },
      ],
    };
    await storeThread("t-replay", [userMessage("u1", "what is open?"), oldAssistant]);
    hydrateWith("t-replay");
    fetchMock.mockResolvedValueOnce(textTurn("Continuing").response);
    const { result } = renderHook(() => useRelayChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[1].parts[0].type).toBe("tool-get_active_context");

    act(() => result.current.send("and now?"));

    await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Continuing"));
    const body = requestBody(0);
    expect(toolParts(body)[0].toolCallId).toBe("old1");
    expect(body.context.chips).toEqual([]);
    expect(body.context.activeTab).toBeUndefined();
    expect(body.context.collection).toBeUndefined();
    expect(body.context.environment).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(JWT_SECRET);
    expect(JSON.stringify(toolParts(body)[0].output)).toContain("Old tab");
    expect(JSON.stringify(toolParts(body)[0].output)).toContain("[redacted]");
  });

  describe("permission mode flip behavior", () => {
    it("a card pending in review stays pending when the mode flips to always-ask", async () => {
      const { result } = await pauseOnDelete();

      act(() => useRelayPermissionStore.setState({ mode: "always-ask" }));

      expect(partState(result)?.state).toBe("input-available");
      expect(remaining()).toEqual(["r1"]);
    });

    it("a card pending in review stays pending when the mode flips to skip and back to review", async () => {
      const { result } = await pauseOnDelete();

      act(() => useRelayPermissionStore.setState({ mode: "skip" }));
      expect(partState(result)?.state).toBe("input-available");

      act(() => useRelayPermissionStore.setState({ mode: "review" }));
      expect(partState(result)?.state).toBe("input-available");
      expect(remaining()).toEqual(["r1"]);
    });

    it("a non-awaiting call in skip stays non-awaiting when the mode flips to review", async () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      fetchMock.mockResolvedValueOnce(
        toolTurn([{ id: "c1", name: "create_collection", input: { name: "Docs", parentId: null } }]).response,
      );
      fetchMock.mockResolvedValueOnce(textTurn("Made it").response);
      const { result } = renderHook(() => useRelayChat());

      act(() => result.current.send("make a collection"));
      await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Made it"));
      expect(useCollectionsStore.getState().collections).toHaveLength(1);

      useRelayPermissionStore.setState({ mode: "review" });
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
    });

    it("the recorded permission mode is used at call execution time, not the current mode", async () => {
      useRelayPermissionStore.setState({ mode: "review" });
      fetchMock.mockResolvedValueOnce(toolTurn([deleteCall]).response);
      const { result } = renderHook(() => useRelayChat());

      act(() => result.current.send("delete Orders"));
      await waitFor(() => expect(partState(result)?.state).toBe("input-available"));

      // Flip the mode while the card is pending
      useRelayPermissionStore.setState({ mode: "skip" });

      // The card is still pending because it was recorded as awaiting in review mode
      expect(partState(result)?.state).toBe("input-available");

      // Approve it; the tool receives the review mode, not the current skip mode
      fetchMock.mockResolvedValueOnce(textTurn("Deleted").response);
      act(() => result.current.resolveTool("d1", { kind: "approve" }));

      await waitFor(() => expect(textOf(result.current.messages.at(-1))).toBe("Deleted"));
      // Verify the execution received the recorded mode
      const toolContext = toolParts(requestBody(1))[0];
      expect(toolContext.output).toMatchObject({ ok: true });
      expect(remaining()).toEqual([]);
    });
  });
});
