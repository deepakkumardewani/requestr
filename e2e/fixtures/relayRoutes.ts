import type { Page, Request, Route } from "@playwright/test";

const RELAY_CHAT_PATH = "/api/relay/chat";
const UI_MESSAGE_STREAM_HEADER = "x-vercel-ai-ui-message-stream";
const UI_MESSAGE_STREAM_VERSION = "v1";
const STREAM_DONE_EVENT = "data: [DONE]\n\n";
const TEXT_PART_ID = "relay-text-1";
const FIRST_TOOL_CALL_ID = "relay-tool-1";
const TOOL_CALL_ID_PREFIX = "relay-tool-";

type ClientToolCalls = { toolName: string; input: unknown }[];

/** One scripted reply to a chat request. Nothing here ever reaches a real provider. */
export type RelayScript =
  /** `delayMs` holds the reply back so the pending row is observable before text arrives. */
  | { kind: "text"; text: string; delayMs?: number }
  | {
      kind: "tool";
      toolName: string;
      input: unknown;
      output: unknown;
      text?: string;
    }
  /**
   * Asks the client to run a read tool. Only the call is streamed, so the real
   * client registry executes it and sends the (redacted) result back as the
   * next recorded request.
   */
  | { kind: "readTool"; toolName: string; input: unknown }
  /**
   * Asks the client to run several tools in one step, in order. Write tools
   * land in the real workspace and change log, so specs assert on the UI.
   * `calls` may be a function of the recorded request bodies, so a later step
   * can use an id the client produced earlier (e.g. a created collection).
   */
  | {
      kind: "clientTools";
      calls: ClientToolCalls | ((previousBodies: unknown[]) => ClientToolCalls);
    }
  /** Omit `retryAfterSeconds` for the daily cap, which carries no wait time. */
  | { kind: "rateLimited"; retryAfterSeconds?: number }
  | { kind: "notConfigured" }
  | { kind: "offline" }
  /** Holds the response open so a test can press Stop and observe the abort. */
  | { kind: "hang" };

export type RelayRoutesHandle = {
  /** Parsed JSON bodies of every chat request, in order: the outbound payloads. */
  readonly requestBodies: unknown[];
  /** How many chat requests failed or were cancelled by the browser (Stop, navigation, offline). */
  abortedCount: () => number;
};

type UiMessageChunk = Record<string, unknown>;

function textChunks(text: string): UiMessageChunk[] {
  return [
    { type: "text-start", id: TEXT_PART_ID },
    ...text
      .split(/(?<=\s)/)
      .map((delta) => ({ type: "text-delta", id: TEXT_PART_ID, delta })),
    { type: "text-end", id: TEXT_PART_ID },
  ];
}

function scriptChunks(
  script: RelayScript,
  previousBodies: unknown[],
): UiMessageChunk[] {
  const body: UiMessageChunk[] = [];
  if (script.kind === "tool") {
    body.push(
      {
        type: "tool-input-available",
        toolCallId: FIRST_TOOL_CALL_ID,
        toolName: script.toolName,
        input: script.input,
      },
      {
        type: "tool-output-available",
        toolCallId: FIRST_TOOL_CALL_ID,
        output: script.output,
      },
    );
    if (script.text) body.push(...textChunks(script.text));
  }
  if (script.kind === "readTool") {
    body.push({
      type: "tool-input-available",
      toolCallId: FIRST_TOOL_CALL_ID,
      toolName: script.toolName,
      input: script.input,
    });
  }
  if (script.kind === "clientTools") {
    const calls =
      typeof script.calls === "function"
        ? script.calls(previousBodies)
        : script.calls;
    calls.forEach((call, index) => {
      body.push({
        type: "tool-input-available",
        // Unique per chat request: a repeated id would overwrite the earlier step's part.
        toolCallId: `${TOOL_CALL_ID_PREFIX}${previousBodies.length}-${index + 1}`,
        toolName: call.toolName,
        input: call.input,
      });
    });
  }
  if (script.kind === "text") body.push(...textChunks(script.text));
  return [
    { type: "start" },
    { type: "start-step" },
    ...body,
    { type: "finish-step" },
    { type: "finish" },
  ];
}

/** Serialises chunks as the SSE frames the AI SDK UI message stream emits. */
function toStreamBody(chunks: UiMessageChunk[]): string {
  return (
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
    STREAM_DONE_EVENT
  );
}

/**
 * Delivers a Relay failure as an in-stream error frame rather than an HTTP
 * 4xx/5xx. Chromium logs every failed fetch as a console error, which the QA
 * console guard rejects; the client maps both transports to the same code
 * (the HTTP-status path is covered by useRelayChat.spec and the route spec).
 */
function fulfillStreamError(route: Route, body: Record<string, unknown>) {
  return route.fulfill({
    status: 200,
    headers: { [UI_MESSAGE_STREAM_HEADER]: UI_MESSAGE_STREAM_VERSION },
    contentType: "text/event-stream",
    body: toStreamBody([
      { type: "start" },
      { type: "error", errorText: JSON.stringify(body) },
    ]),
  });
}

async function fulfillScript(
  route: Route,
  script: RelayScript,
  previousBodies: unknown[],
) {
  switch (script.kind) {
    case "rateLimited":
      return fulfillStreamError(route, {
        error: "rate_limited",
        ...(script.retryAfterSeconds
          ? { retryAfterSeconds: script.retryAfterSeconds }
          : {}),
      });
    case "notConfigured":
      return fulfillStreamError(route, { error: "not_configured" });
    case "offline":
      return route.abort("internetdisconnected");
    case "hang":
      // Never answered; the browser cancelling the request is what the test observes.
      return;
    default:
      if (script.kind === "text" && script.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, script.delayMs));
      }
      return route.fulfill({
        status: 200,
        headers: { [UI_MESSAGE_STREAM_HEADER]: UI_MESSAGE_STREAM_VERSION },
        contentType: "text/event-stream",
        body: toStreamBody(scriptChunks(script, previousBodies)),
      });
  }
}

/**
 * Installs a hermetic handler for the Relay chat endpoint. Each request is
 * answered with the next script (the last one repeats), and its JSON body is
 * recorded so specs can assert exactly what the client sent.
 */
export async function installRelayRoutes(
  page: Page,
  scripts: RelayScript | RelayScript[],
): Promise<RelayRoutesHandle> {
  const queue = Array.isArray(scripts) ? scripts : [scripts];
  if (queue.length === 0) {
    throw new Error(
      "[relayRoutes] installRelayRoutes needs at least one script",
    );
  }
  const requestBodies: unknown[] = [];
  let aborted = 0;

  page.on("requestfailed", (request: Request) => {
    if (new URL(request.url()).pathname === RELAY_CHAT_PATH) aborted += 1;
  });

  await page.route(`**${RELAY_CHAT_PATH}`, async (route) => {
    const body = route.request().postData();
    requestBodies.push(body ? JSON.parse(body) : null);
    const script = queue[Math.min(requestBodies.length - 1, queue.length - 1)];
    await fulfillScript(route, script, requestBodies);
  });

  return { requestBodies, abortedCount: () => aborted };
}

const PROXY_PATH = "/api/proxy";

/** A downstream response the app's request proxy should report. */
export type ProxyReply = {
  status: number;
  statusText: string;
  body: string;
  contentType?: string;
};

/** What to do with one proxied request: answer it, or hold it open so Stop can be observed. */
export type ProxyDecision = ProxyReply | "hang";

export type ProxyRoutesHandle = {
  /** The downstream URL of every request the app proxied, in order. */
  readonly requestedUrls: string[];
};

function proxyEnvelope(reply: ProxyReply) {
  return JSON.stringify({
    status: reply.status,
    statusText: reply.statusText,
    headers: { "content-type": reply.contentType ?? "application/json" },
    body: reply.body,
  });
}

/**
 * Answers every request the app sends through `/api/proxy`, so a spec can give
 * a saved request a real stored response without touching the network, and can
 * assert that nothing was proxied before the user approved (FR-42). The
 * envelope mirrors ProxyResponse in src/lib/requestRunner.ts: the proxy itself
 * always answers 200 and wraps the downstream status.
 */
export async function installProxyRoutes(
  page: Page,
  decide: (url: string) => ProxyDecision,
): Promise<ProxyRoutesHandle> {
  const requestedUrls: string[] = [];
  await page.route(`**${PROXY_PATH}`, async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}") as {
      url?: string;
    };
    const url = payload.url ?? "";
    requestedUrls.push(url);
    const decision = decide(url);
    // Never answered; the browser cancelling the request is what the test observes.
    if (decision === "hang") return;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: proxyEnvelope(decision),
    });
  });
  return { requestedUrls };
}

/** Answers every proxied request with the same reply. */
export function installProxyReply(page: Page, reply: ProxyReply) {
  return installProxyRoutes(page, () => reply);
}
