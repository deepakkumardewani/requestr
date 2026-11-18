/**
 * Prompt text for the eight one-shot AI actions served by `/api/ai`. Shared so
 * the actions and Relay draw on one source of truth (AC-20). Wording is kept
 * verbatim from the original route.
 */

export type ResponseSnapshot = {
  status?: number;
  headers?: Record<string, string>;
  bodySnippet?: string;
};

export type WriteScriptInput = {
  scriptType?: "pre" | "post";
  description?: string;
  context?: Record<string, unknown>;
};

export type ExplainErrorInput = {
  status?: number;
  bodySnippet?: string;
  contentType?: string;
};

export type GenerateBodyInput = {
  description?: string;
  bodyType?: string;
  url?: string;
  method?: string;
};

export type BuildRequestInput = {
  description?: string;
  currentUrl?: string;
};

export type SuggestJsonpathInput = {
  description?: string;
  bodySnippet?: string;
};

export type SuggestHeadersInput = {
  url?: string;
  method?: string;
  bodyType?: string;
  existingKeys?: string[];
};

export function suggestAssertionsPrompt({
  status,
  headers,
  bodySnippet,
}: ResponseSnapshot): string {
  return `Generate meaningful HTTP response assertions based on this response:
Status: ${status ?? "unknown"}
Headers: ${JSON.stringify(headers ?? {})}
Body (first 2000 chars): ${bodySnippet ?? ""}

Return 2-5 specific, useful assertions. Prefer JSONPath assertions for response body fields.`;
}

export function writeScriptPrompt({
  scriptType,
  description,
  context,
}: WriteScriptInput): string {
  return `Write a JavaScript ${scriptType === "pre" ? "pre-request" : "post-response"} script for an API testing tool.

Description: ${description ?? ""}
Context: ${JSON.stringify(context ?? {})}

Requirements:
- Use the rq object (rq.request for pre-scripts, rq.response for post-scripts)
- Return only valid JavaScript code, no markdown fences
- Keep it concise and focused on the described task`;
}

export function explainErrorPrompt({
  status,
  bodySnippet,
  contentType,
}: ExplainErrorInput): string {
  return `Explain this HTTP error response to an API developer in 2-3 sentences. Be specific and actionable.

Status: ${status ?? "unknown"}
Content-Type: ${contentType ?? "unknown"}
Response body (first 2000 chars): ${bodySnippet ?? ""}

Focus on: what likely caused it, and how to fix it.`;
}

export function generateBodyPrompt({
  description,
  bodyType,
  url,
  method,
}: GenerateBodyInput): string {
  return `Generate a realistic ${bodyType ?? "json"} request body for this API call.

Method: ${method ?? "POST"}
URL: ${url ?? ""}
Description: ${description ?? ""}

Return only the raw body content (no markdown fences, no explanations). For JSON, return valid JSON.`;
}

export function buildRequestPrompt({
  description,
  currentUrl,
}: BuildRequestInput): string {
  return `Build an HTTP request from this description.

Description: ${description ?? ""}
Current URL hint: ${currentUrl ?? ""}

Generate a complete, realistic API request with appropriate method, URL, headers, query params, and body.
IMPORTANT: If the description explicitly provides a URL or domain, you MUST use that instead of the "Current URL hint". The hint is only a fallback.`;
}

/** Stand in for the description when Open in Relay is used before the user typed one. */
export const JSONPATH_DEFAULT_DESCRIPTION =
  "the value I want to extract from this response";
export const BUILD_REQUEST_DEFAULT_DESCRIPTION =
  "a request for the URL in my current request";
export const GENERATE_BODY_DEFAULT_DESCRIPTION =
  "a realistic body for my current request";
export const WRITE_SCRIPT_DEFAULT_DESCRIPTION =
  "a script for my current request";

export function suggestJsonpathPrompt({
  description,
  bodySnippet,
}: SuggestJsonpathInput): string {
  return `Generate a JSONPath expression for: "${description ?? ""}"

JSON body (first 2000 chars):
${bodySnippet ?? ""}

Return only the JSONPath expression (e.g. $.data.users[0].email), nothing else.`;
}

export function summarizeResponsePrompt({
  status,
  headers,
  bodySnippet,
}: ResponseSnapshot): string {
  return `Summarize this HTTP API response for a developer in 2-4 sentences.

Status: ${status ?? "unknown"}
Headers: ${JSON.stringify(headers ?? {})}
Body (first 2000 chars): ${bodySnippet ?? ""}

Be specific: mention key fields, data counts, status meaning, and any anomalies.`;
}

export function suggestHeadersPrompt({
  url,
  method,
  bodyType,
  existingKeys,
}: SuggestHeadersInput): string {
  return `Suggest appropriate HTTP request headers for this API call.

Method: ${method ?? "GET"}
URL: ${url ?? ""}
Body type: ${bodyType ?? "none"}
Already present headers: ${JSON.stringify(existingKeys ?? [])}

Return 2-5 headers that are missing but useful. Do not repeat headers already present (case-insensitive).`;
}

export const ACTION_PROMPTS = {
  "suggest-assertions": suggestAssertionsPrompt,
  "write-script": writeScriptPrompt,
  "explain-error": explainErrorPrompt,
  "generate-body": generateBodyPrompt,
  "build-request": buildRequestPrompt,
  "suggest-jsonpath": suggestJsonpathPrompt,
  "summarize-response": summarizeResponsePrompt,
  "suggest-headers": suggestHeadersPrompt,
} as const;

export type ActionName = keyof typeof ACTION_PROMPTS;
