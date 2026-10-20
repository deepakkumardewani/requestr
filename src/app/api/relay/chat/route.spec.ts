/** @vitest-environment node */
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_MAX_STEPS } from "@/lib/relay/constants";
import { JWT_SECRET } from "@/lib/relay/redact.corpus";
import { relayProviderOptions, RELAY_MODEL_ID } from "@/lib/relay/server/model";
import { RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";

const BANNED = new RegExp(
  ["deepseek", "openai", "anthropic", "claude", "gpt", RELAY_MODEL_ID].join("|"),
  "i",
);

const holder = vi.hoisted(() => ({
  model: undefined as unknown,
  stepCaps: [] as number[],
}));

vi.mock("@/lib/relay/server/model", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/relay/server/model")>();
  return { ...actual, getRelayModel: () => holder.model };
});

vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof import("ai")>();
  return {
    ...actual,
    stepCountIs: (n: number) => {
      holder.stepCaps.push(n);
      return actual.stepCountIs(n);
    },
  };
});

import { POST } from "./route";

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const FINISH = {
  type: "finish" as const,
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: USAGE,
};

function textModel(options: { withMetadata?: boolean } = {}) {
  const meta = options.withMetadata
    ? { providerMetadata: { deepseek: { cacheHit: 1 } } }
    : {};
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          const parts = [
            { type: "stream-start", warnings: [] },
            {
              type: "response-metadata",
              id: "resp-1",
              modelId: RELAY_MODEL_ID,
            },
            { type: "text-start", id: "t1", ...meta },
            { type: "text-delta", id: "t1", delta: "Hello " },
            { type: "text-delta", id: "t1", delta: "there" },
            { type: "text-end", id: "t1", ...meta },
            { ...FINISH, ...meta },
          ] as LanguageModelV3StreamPart[];
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    }),
  });
}

const userMessage = (text = "hi") => ({
  id: "u1",
  role: "user",
  parts: [{ type: "text", text }],
});

function chatRequest(
  body: unknown,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Request {
  return new Request("http://localhost/api/relay/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal: init.signal,
  });
}

beforeEach(() => {
  vi.stubEnv("RELAY_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  holder.model = textModel();
  holder.stepCaps.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/relay/chat streaming", () => {
  it("streams a turn with a UI message stream", async () => {
    const res = await POST(
      chatRequest({ messages: [userMessage()] }, { headers: { "x-forwarded-for": "10.1.1.1" } }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"text-delta"');
    expect(text).toContain("Hello ");
    expect(text).toContain("[DONE]");
  });

  it("passes the non-thinking options and output cap to the model", async () => {
    const model = textModel();
    holder.model = model;
    await (await POST(chatRequest({ messages: [userMessage()] }))).text();
    const call = model.doStreamCalls[0];
    expect(call.providerOptions).toEqual(relayProviderOptions);
    expect(call.maxOutputTokens).toBe(4000);
  });

  it("emits no vendor token, model id or provider metadata in any chunk or header", async () => {
    holder.model = textModel({ withMetadata: true });
    const res = await POST(chatRequest({ messages: [userMessage()] }));
    const headers = JSON.stringify([...res.headers.entries()]);
    const text = await res.text();
    expect(text).not.toMatch(BANNED);
    expect(text).not.toContain("providerMetadata");
    expect(headers).not.toMatch(BANNED);
  });

  it("aborts upstream when the request is aborted", async () => {
    let upstream: AbortSignal | undefined;
    holder.model = new MockLanguageModelV3({
      doStream: async (options) => {
        upstream = options.abortSignal;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "t1" });
              controller.enqueue({ type: "text-delta", id: "t1", delta: "x" });
            },
          }),
        };
      },
    });
    const controller = new AbortController();
    const res = await POST(
      chatRequest({ messages: [userMessage()] }, { signal: controller.signal }),
    );
    const reader = res.body!.getReader();
    await reader.read();
    controller.abort();
    await vi.waitFor(() => expect(upstream?.aborted).toBe(true));
  });
});

describe("step cap", () => {
  const assistantWithSteps = (steps: number) => ({
    id: "a1",
    role: "assistant",
    parts: Array.from({ length: steps }, () => ({ type: "step-start" })),
  });

  it("caps a fresh turn at the full step budget", async () => {
    await (await POST(chatRequest({ messages: [userMessage()] }))).text();
    expect(holder.stepCaps).toEqual([RELAY_MAX_STEPS]);
  });

  it("subtracts step-start parts since the last user message", async () => {
    const messages = [
      { ...assistantWithSteps(9), id: "old" },
      userMessage(),
      assistantWithSteps(5),
    ];
    await (await POST(chatRequest({ messages }))).text();
    expect(holder.stepCaps).toEqual([RELAY_MAX_STEPS - 5]);
  });

  it("rejects a turn that has used all its steps", async () => {
    const res = await POST(
      chatRequest({ messages: [userMessage(), assistantWithSteps(RELAY_MAX_STEPS)] }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "tool_failed" });
  });
});

describe("rejections return a mapped Relay code only", () => {
  it("rejects an oversize body with context_too_long", async () => {
    const res = await POST(
      chatRequest({ messages: [userMessage("x".repeat(300 * 1024))] }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "context_too_long" });
  });

  it.each([
    ["invalid JSON", "{nope"],
    ["missing messages", {}],
    ["empty messages", { messages: [] }],
    ["bad role", { messages: [{ id: "1", role: "system", parts: [] }] }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await POST(chatRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "relay_unavailable" });
  });

  it("rejects a cross-origin browser call", async () => {
    const res = await POST(
      chatRequest(
        { messages: [userMessage()] },
        { headers: { origin: "https://evil.example", host: "localhost" } },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("accepts a same-origin browser call", async () => {
    const res = await POST(
      chatRequest(
        { messages: [userMessage()] },
        { headers: { origin: "http://localhost", host: "localhost" } },
      ),
    );
    expect(res.status).toBe(200);
    await res.text();
  });

  it("returns 404 not_configured when the flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    const res = await POST(chatRequest({ messages: [userMessage()] }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });

  it("returns not_configured without env var names when the key is missing", async () => {
    vi.stubEnv("RELAY_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const res = await POST(chatRequest({ messages: [userMessage()] }));
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: "not_configured" });
    expect(text).not.toMatch(/KEY|RELAY_|DEEPSEEK/);
  });

  it("returns 429 with Retry-After once the user limit trips", async () => {
    const headers = { "x-relay-user": "rate-limit-user", "x-forwarded-for": "10.2.2.2" };
    let last: Response | undefined;
    for (let i = 0; i < 31; i += 1) {
      last = await POST(chatRequest({ messages: [userMessage()] }, { headers }));
      await last.text();
    }
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("maps a provider failure to a code with no provider text", async () => {
    holder.model = new MockLanguageModelV3({
      doStream: async () => {
        throw Object.assign(
          new Error("Authentication Fails, Your api key: ****-000 (request_id: 9)"),
          { statusCode: 401 },
        );
      },
    });
    const res = await POST(chatRequest({ messages: [userMessage()] }));
    const text = await res.text();
    expect(text).toContain('"errorText":"not_configured"');
    expect(text).not.toMatch(/request_id|api key|\*\*\*\*/i);
  });
});

describe("tools and context", () => {
  const context = {
    workspace: { counts: { requests: 1 } },
    chips: [{ kind: "request", id: "r1", label: "Get thing" }],
  };

  it("passes every read tool to the model without an execute function", async () => {
    const model = textModel();
    holder.model = model;
    await (await POST(chatRequest({ messages: [userMessage()], context }))).text();
    const names = (model.doStreamCalls[0].tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual(Object.keys(RELAY_TOOL_SCHEMAS).sort());
  });

  it("streams a tool call to the client without running it", async () => {
    holder.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            const parts = [
              { type: "stream-start", warnings: [] },
              {
                type: "tool-call",
                toolCallId: "call1",
                toolName: "get_workspace_summary",
                input: "{}",
              },
              {
                ...FINISH,
                finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
              },
            ] as LanguageModelV3StreamPart[];
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      }),
    });
    const text = await (await POST(chatRequest({ messages: [userMessage()] }))).text();
    expect(text).toContain('"type":"tool-input-available"');
    expect(text).not.toContain("tool-output-available");
  });

  it("puts the snapshot in the system prompt as fenced data", async () => {
    const model = textModel();
    holder.model = model;
    await (await POST(chatRequest({ messages: [userMessage()], context }))).text();
    const system = JSON.stringify(model.doStreamCalls[0].prompt[0]);
    expect(system).toContain("workspace-context");
    expect(system).toContain("Get thing");
  });

  it("rejects a context that still holds a secret", async () => {
    const leaky = {
      ...context,
      activeTab: { url: `https://a.test/?token=${JWT_SECRET}`, auth: { token: JWT_SECRET } },
    };
    const res = await POST(chatRequest({ messages: [userMessage()], context: leaky }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "relay_unavailable" });
  });

  it("rejects history whose tool output still holds a secret", async () => {
    const leaky = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_request",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: { note: `key ${JWT_SECRET}` },
        },
      ],
    };
    const res = await POST(chatRequest({ messages: [userMessage(), leaky] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "relay_unavailable" });
  });

  it("accepts deeply nested history and context the client already redacted", async () => {
    const nest = (levels: number) =>
      Array.from({ length: levels }).reduce<unknown>((inner) => ({ inner }), "leaf");
    const deepTool = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_request",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: nest(23),
        },
      ],
    };
    const deepContext = { ...context, activeTab: nest(23) };
    const res = await POST(chatRequest({ messages: [userMessage(), deepTool], context: deepContext }));
    expect(res.status).toBe(200);
    await res.text();
  });

  it("rejects a malformed context", async () => {
    const res = await POST(chatRequest({ messages: [userMessage()], context: { workspace: 1 } }));
    expect(res.status).toBe(400);
  });

  it("still accepts a request with no context", async () => {
    const res = await POST(chatRequest({ messages: [userMessage()] }));
    expect(res.status).toBe(200);
    await res.text();
  });
});
