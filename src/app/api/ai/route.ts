import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const VALID_ACTIONS = [
  "suggest-assertions",
  "write-script",
  "explain-error",
  "generate-body",
  "build-request",
  "suggest-jsonpath",
  "summarize-response",
  "suggest-headers",
] as const;

type Action = (typeof VALID_ACTIONS)[number];

function getDeepseek() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Add it to .env.local to use AI features.",
    );
  }
  return createDeepSeek({ apiKey });
}

async function handleSuggestAssertions(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { status, headers, bodySnippet } = payload as {
    status?: number;
    headers?: Record<string, string>;
    bodySnippet?: string;
  };

  const { output } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    output: Output.object({
      schema: z.array(
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
      ),
    }),
    prompt: `Generate meaningful HTTP response assertions based on this response:
Status: ${status ?? "unknown"}
Headers: ${JSON.stringify(headers ?? {})}
Body (first 2000 chars): ${bodySnippet ?? ""}

Return 2-5 specific, useful assertions. Prefer JSONPath assertions for response body fields.`,
  });

  return output;
}

async function handleWriteScript(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { scriptType, description, context } = payload as {
    scriptType?: "pre" | "post";
    description?: string;
    context?: Record<string, unknown>;
  };

  const { text } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    prompt: `Write a JavaScript ${scriptType === "pre" ? "pre-request" : "post-response"} script for an API testing tool.

Description: ${description ?? ""}
Context: ${JSON.stringify(context ?? {})}

Requirements:
- Use the rq object (rq.request for pre-scripts, rq.response for post-scripts)
- Return only valid JavaScript code, no markdown fences
- Keep it concise and focused on the described task`,
  });

  return { code: text };
}

async function handleExplainError(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { status, bodySnippet, contentType } = payload as {
    status?: number;
    bodySnippet?: string;
    contentType?: string;
  };

  const { text } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    prompt: `Explain this HTTP error response to an API developer in 2-3 sentences. Be specific and actionable.

Status: ${status ?? "unknown"}
Content-Type: ${contentType ?? "unknown"}
Response body (first 2000 chars): ${bodySnippet ?? ""}

Focus on: what likely caused it, and how to fix it.`,
  });

  return { explanation: text };
}

async function handleGenerateBody(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { description, bodyType, url, method } = payload as {
    description?: string;
    bodyType?: string;
    url?: string;
    method?: string;
  };

  const { text } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    prompt: `Generate a realistic ${bodyType ?? "json"} request body for this API call.

Method: ${method ?? "POST"}
URL: ${url ?? ""}
Description: ${description ?? ""}

Return only the raw body content (no markdown fences, no explanations). For JSON, return valid JSON.`,
  });

  return { content: text };
}

async function handleBuildRequest(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { description, currentUrl } = payload as {
    description?: string;
    currentUrl?: string;
  };

  console.log("description", description);
  console.log("currentUrl", currentUrl);

  const { output } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    output: Output.object({
      schema: z.object({
        method: z.enum([
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "HEAD",
          "OPTIONS",
        ]),
        url: z.string(),
        headers: z.array(z.object({ key: z.string(), value: z.string() })),
        params: z.array(z.object({ key: z.string(), value: z.string() })),
        bodyType: z
          .enum(["none", "json", "xml", "text", "form-data", "urlencoded"])
          .optional(),
        bodyContent: z.string().optional(),
      }),
    }),
    prompt: `Build an HTTP request from this description.

Description: ${description ?? ""}
Current URL hint: ${currentUrl ?? ""}

Generate a complete, realistic API request with appropriate method, URL, headers, query params, and body.
IMPORTANT: If the description explicitly provides a URL or domain, you MUST use that instead of the "Current URL hint". The hint is only a fallback.`,
  });

  return output;
}

async function handleSuggestJsonpath(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { description, bodySnippet } = payload as {
    description?: string;
    bodySnippet?: string;
  };

  const { text } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    prompt: `Generate a JSONPath expression for: "${description ?? ""}"

JSON body (first 2000 chars):
${bodySnippet ?? ""}

Return only the JSONPath expression (e.g. $.data.users[0].email), nothing else.`,
  });

  return { expression: text.trim() };
}

async function handleSummarizeResponse(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { status, headers, bodySnippet } = payload as {
    status?: number;
    headers?: Record<string, string>;
    bodySnippet?: string;
  };

  const { text } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    prompt: `Summarize this HTTP API response for a developer in 2-4 sentences.

Status: ${status ?? "unknown"}
Headers: ${JSON.stringify(headers ?? {})}
Body (first 2000 chars): ${bodySnippet ?? ""}

Be specific: mention key fields, data counts, status meaning, and any anomalies.`,
  });

  return { summary: text };
}

async function handleSuggestHeaders(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const deepseek = getDeepseek();
  const { url, method, bodyType, existingKeys } = payload as {
    url?: string;
    method?: string;
    bodyType?: string;
    existingKeys?: string[];
  };

  const { output } = await generateText({
    model: deepseek("deepseek-v4-flash"),
    output: Output.object({
      schema: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
    prompt: `Suggest appropriate HTTP request headers for this API call.

Method: ${method ?? "GET"}
URL: ${url ?? ""}
Body type: ${bodyType ?? "none"}
Already present headers: ${JSON.stringify(existingKeys ?? [])}

Return 2-5 headers that are missing but useful. Do not repeat headers already present (case-insensitive).`,
  });

  return output;
}

const ACTION_HANDLERS: Record<
  Action,
  (payload: Record<string, unknown>) => Promise<unknown>
> = {
  "suggest-assertions": handleSuggestAssertions,
  "write-script": handleWriteScript,
  "explain-error": handleExplainError,
  "generate-body": handleGenerateBody,
  "build-request": handleBuildRequest,
  "suggest-jsonpath": handleSuggestJsonpath,
  "summarize-response": handleSummarizeResponse,
  "suggest-headers": handleSuggestHeaders,
};

export async function POST(req: Request) {
  let body: { action?: string; payload?: Record<string, unknown> };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { action, payload = {} } = body;

  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  try {
    const result = await ACTION_HANDLERS[action as Action](payload);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI request failed unexpectedly";
    const isKeyMissing = message.includes("DEEPSEEK_API_KEY");
    return NextResponse.json(
      { error: message },
      { status: isKeyMissing ? 500 : 502 },
    );
  }
}
