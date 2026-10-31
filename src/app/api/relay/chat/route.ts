import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type ToolSet,
  tool,
  type UIMessage,
  type UIMessageChunk,
  zodSchema,
} from "ai";
import { z } from "zod";
import { RELAY_MAX_STEPS } from "@/lib/relay/constants";
import { mapProviderError, type RelayErrorCode } from "@/lib/relay/errors";
import {
  hasUnredactedHistorySecret,
  hasUnredactedSecret,
} from "@/lib/relay/redact";
import { guardRelayRequest, isSameOrigin } from "@/lib/relay/server/guard";
import { getRelayModel, relayProviderOptions } from "@/lib/relay/server/model";
import { buildSystemPrompt } from "@/lib/relay/server/systemPrompt";
import { RELAY_MAX_BODY_BYTES } from "@/lib/relay/tokenBudget";
import { RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";

export const maxDuration = 60;

const MAX_OUTPUT_TOKENS = 4000;
const MAX_MESSAGES = 200;
const STEP_START_PART = "step-start";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_UNPROCESSABLE = 422;
const HTTP_BAD_GATEWAY = 502;

const messageSchema = z.looseObject({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.looseObject({ type: z.string() })),
});

const contextSchema = z.looseObject({
  workspace: z.looseObject({}),
  chips: z.array(z.looseObject({ kind: z.string(), id: z.string() })),
});

const bodySchema = z.looseObject({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  context: contextSchema.optional(),
});

/**
 * Tools are declared with schemas only: no `execute`, so every call streams
 * to the browser, which owns the data and runs it (FR-40).
 */
const relayTools: ToolSet = Object.fromEntries(
  Object.entries(RELAY_TOOL_SCHEMAS).map(([name, definition]) => [
    name,
    tool({
      description: definition.description,
      inputSchema: zodSchema<Record<string, unknown>>(definition.inputSchema),
    }),
  ]),
);

type ChatMessage = z.infer<typeof messageSchema>;

function errorResponse(
  code: RelayErrorCode,
  status: number,
  retryAfterSeconds?: number,
): Response {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return Response.json(
    { error: code, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
    { status, headers },
  );
}

/**
 * Each client tool round trip is a new request, so a fixed step cap would
 * never trigger: count the steps already taken since the last user message.
 */
function remainingSteps(messages: ChatMessage[]): number {
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  const used = messages
    .slice(lastUser + 1)
    .flatMap((m) => m.parts)
    .filter((part) => part.type === STEP_START_PART).length;
  return RELAY_MAX_STEPS - used;
}

type ReadBody =
  | {
      ok: true;
      messages: ChatMessage[];
      context?: z.infer<typeof contextSchema>;
    }
  | { ok: false; response: Response };

async function readBody(req: Request): Promise<ReadBody> {
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > RELAY_MAX_BODY_BYTES) {
    return {
      ok: false,
      response: errorResponse("context_too_long", HTTP_PAYLOAD_TOO_LARGE),
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: errorResponse("relay_unavailable", HTTP_BAD_REQUEST),
    };
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse("relay_unavailable", HTTP_BAD_REQUEST),
    };
  }
  const { messages, context } = parsed.data;
  // Defence in depth (FR-60): the client redacts, the server refuses what slipped through.
  // Checked separately, as the client redacts them, so the depth limit matches.
  if (
    (context && hasUnredactedSecret(context)) ||
    hasUnredactedHistorySecret(messages)
  ) {
    return {
      ok: false,
      response: errorResponse("relay_unavailable", HTTP_BAD_REQUEST),
    };
  }
  return { ok: true, messages, context };
}

/** Nothing vendor-specific may reach the client or IndexedDB (FR-62). */
function stripProviderMetadata(): TransformStream<
  UIMessageChunk,
  UIMessageChunk
> {
  return new TransformStream({
    transform(chunk, controller) {
      const { providerMetadata: _dropped, ...rest } = chunk as UIMessageChunk &
        Record<string, unknown>;
      controller.enqueue(rest as UIMessageChunk);
    },
  });
}

function onStreamError(error: unknown): string {
  const { code } = mapProviderError(error);
  console.error("[api/relay/chat] stream failed", { code });
  return code;
}

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) {
    return errorResponse("relay_unavailable", HTTP_FORBIDDEN);
  }

  const body = await readBody(req);
  if (!body.ok) return body.response;
  const { messages, context } = body;

  const guard = await guardRelayRequest({
    req,
    lastMessageRole: messages.at(-1)?.role,
  });
  if (!guard.ok) {
    return errorResponse(guard.code, guard.status, guard.retryAfterSeconds);
  }

  const remaining = remainingSteps(messages);
  if (remaining <= 0) {
    return errorResponse("tool_failed", HTTP_UNPROCESSABLE);
  }

  try {
    const result = streamText({
      model: getRelayModel(),
      system: buildSystemPrompt(context),
      tools: relayTools,
      messages: await convertToModelMessages(
        messages as unknown as UIMessage[],
        { ignoreIncompleteToolCalls: true },
      ),
      stopWhen: stepCountIs(remaining),
      providerOptions: relayProviderOptions,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: req.signal,
    });
    const stream = result
      .toUIMessageStream({
        onError: onStreamError,
        sendReasoning: false,
        sendSources: false,
      })
      .pipeThrough(stripProviderMetadata());
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const { code, retryAfterSeconds } = mapProviderError(error);
    console.error("[api/relay/chat] request failed", { code });
    return errorResponse(code, HTTP_BAD_GATEWAY, retryAfterSeconds);
  }
}
