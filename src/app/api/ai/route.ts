import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mapProviderError, type RelayErrorCode } from "@/lib/relay/errors";
import { ACTION_PROMPTS, type ActionName } from "@/lib/relay/prompts";
import { getRelayModel } from "@/lib/relay/server/model";

const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const HTTP_BAD_GATEWAY = 502;

/** Failure responses carry a Relay code only, never provider text. */
const ERROR_STATUS: Partial<Record<RelayErrorCode, number>> = {
  not_configured: HTTP_SERVER_ERROR,
  rate_limited: HTTP_TOO_MANY_REQUESTS,
};

function isAction(value: unknown): value is ActionName {
  return typeof value === "string" && Object.hasOwn(ACTION_PROMPTS, value);
}

const assertionsSchema = z.array(
  z.object({
    source: z.enum(["status", "jsonpath", "header"]),
    sourcePath: z.string().optional(),
    operator: z.enum([
      "eq",
      "neq",
      "contains",
      "not_contains",
      "gt",
      "lt",
      "exists",
      "not_exists",
      "matches_regex",
    ]),
    expectedValue: z.string().optional(),
  }),
);

const requestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  url: z.string(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  params: z.array(z.object({ key: z.string(), value: z.string() })),
  bodyType: z
    .enum(["none", "json", "xml", "text", "form-data", "urlencoded"])
    .optional(),
  bodyContent: z.string().optional(),
});

const headersSchema = z.array(z.object({ key: z.string(), value: z.string() }));

async function generatePlainText(prompt: string): Promise<string> {
  const { text } = await generateText({ model: getRelayModel(), prompt });
  return text;
}

async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string,
): Promise<T> {
  const { output } = await generateText({
    model: getRelayModel(),
    output: Output.object({ schema }),
    prompt,
  });
  return output;
}

type Payload<A extends ActionName> = Parameters<(typeof ACTION_PROMPTS)[A]>[0];

const ACTION_HANDLERS: {
  [A in ActionName]: (payload: Payload<A>) => Promise<unknown>;
} = {
  "suggest-assertions": (p) =>
    generateStructured(
      assertionsSchema,
      ACTION_PROMPTS["suggest-assertions"](p),
    ),
  "write-script": async (p) => ({
    code: await generatePlainText(ACTION_PROMPTS["write-script"](p)),
  }),
  "explain-error": async (p) => ({
    explanation: await generatePlainText(ACTION_PROMPTS["explain-error"](p)),
  }),
  "generate-body": async (p) => ({
    content: await generatePlainText(ACTION_PROMPTS["generate-body"](p)),
  }),
  "build-request": (p) =>
    generateStructured(requestSchema, ACTION_PROMPTS["build-request"](p)),
  "suggest-jsonpath": async (p) => ({
    expression: (
      await generatePlainText(ACTION_PROMPTS["suggest-jsonpath"](p))
    ).trim(),
  }),
  "summarize-response": async (p) => ({
    summary: await generatePlainText(ACTION_PROMPTS["summarize-response"](p)),
  }),
  "suggest-headers": (p) =>
    generateStructured(headersSchema, ACTION_PROMPTS["suggest-headers"](p)),
};

export async function POST(req: Request) {
  let body: { action?: string; payload?: Record<string, unknown> };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: HTTP_BAD_REQUEST },
    );
  }

  const { action, payload = {} } = body;

  if (!isAction(action)) {
    return NextResponse.json(
      { error: "unknown action" },
      { status: HTTP_BAD_REQUEST },
    );
  }

  try {
    const handler = ACTION_HANDLERS[action] as (p: object) => Promise<unknown>;
    return NextResponse.json(await handler(payload));
  } catch (err) {
    const { code } = mapProviderError(err);
    console.error("[api/ai] action failed", { action, code });
    return NextResponse.json(
      { error: code },
      { status: ERROR_STATUS[code] ?? HTTP_BAD_GATEWAY },
    );
  }
}
