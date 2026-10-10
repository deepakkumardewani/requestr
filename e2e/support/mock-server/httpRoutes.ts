import type { IncomingMessage, ServerResponse } from "node:http";
import { executeGraphql, GRAPHQL_PATH } from "./graphqlRoutes";
import {
  getEntries,
  queryToObject,
  recordEntry,
  resetEntries,
  resolveTestId,
} from "./requestLog";

const SLOW_DEFAULT_MS = 5000;
const MAX_GENERATED_BYTES = 50 * 1024 * 1024;
const DEFAULT_LARGE_BYTES = 1024;
const REDIRECT_STATUSES = new Set([301, 302, 307]);
const JSON_HEADERS = { "Content-Type": "application/json" };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
};

interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  path: string;
  query: URLSearchParams;
  testId: string;
  rawBody: Buffer;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...JSON_HEADERS, ...CORS_HEADERS });
  res.end(JSON.stringify(body));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

interface ParsedBody {
  body: unknown;
  files: { field: string; name: string; size: number; type: string }[];
}

async function parseMultipart(
  req: IncomingMessage,
  raw: Buffer,
): Promise<ParsedBody> {
  const form = await new Response(new Uint8Array(raw), {
    headers: { "content-type": String(req.headers["content-type"]) },
  }).formData();
  const fields: Record<string, string> = {};
  const files: ParsedBody["files"] = [];
  form.forEach((value, field) => {
    if (typeof value === "string") fields[field] = value;
    else
      files.push({
        field,
        name: value.name,
        size: value.size,
        type: value.type,
      });
  });
  return { body: fields, files };
}

async function parseBody(
  req: IncomingMessage,
  raw: Buffer,
): Promise<ParsedBody> {
  const contentType = String(req.headers["content-type"] ?? "");
  const text = raw.toString("utf8");
  if (!raw.length) return { body: null, files: [] };
  if (contentType.includes("multipart/form-data"))
    return parseMultipart(req, raw);
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return { body: queryToObject(new URLSearchParams(text)), files: [] };
  }
  if (contentType.includes("json")) {
    try {
      return { body: JSON.parse(text), files: [] };
    } catch {
      return { body: text, files: [] };
    }
  }
  return { body: text, files: [] };
}

async function handleEcho(ctx: RequestContext): Promise<void> {
  const { req, res, path, query, testId, rawBody } = ctx;
  const parsed = await parseBody(req, rawBody);
  const status = positiveInt(query.get("status"), 200);
  sendJson(res, status || 200, {
    method: req.method,
    path,
    query: queryToObject(query),
    headers: req.headers,
    body: parsed.body,
    files: parsed.files,
    rawBody: rawBody.toString("utf8"),
    testId,
  });
}

function handleRedirect({ res, query }: RequestContext): void {
  const requested = positiveInt(query.get("status"), 302);
  const status = REDIRECT_STATUSES.has(requested) ? requested : 302;
  const hops = positiveInt(query.get("hops"), 0);
  const target = query.get("to") ?? "/echo";
  const location =
    hops > 1
      ? `/redirect?${new URLSearchParams({ to: target, status: String(status), hops: String(hops - 1) })}`
      : target;
  res.writeHead(status, { Location: location, ...CORS_HEADERS });
  res.end();
}

function handleCookies({ res }: RequestContext): void {
  res.setHeader("Set-Cookie", [
    "session=abc123; Path=/; HttpOnly",
    "theme=dark; Path=/",
  ]);
  sendJson(res, 200, { cookies: ["session", "theme"] });
}

function handleLarge({ res, query }: RequestContext): void {
  const bytes = Math.min(
    positiveInt(query.get("bytes"), DEFAULT_LARGE_BYTES),
    MAX_GENERATED_BYTES,
  );
  res.writeHead(200, { "Content-Type": "text/plain", ...CORS_HEADERS });
  res.end("a".repeat(bytes));
}

function handleBinary({ res, query }: RequestContext): void {
  const bytes = Math.min(
    positiveInt(query.get("bytes"), 256),
    MAX_GENERATED_BYTES,
  );
  const body = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) body[i] = i % 256;
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    ...CORS_HEADERS,
  });
  res.end(body);
}

async function handleGraphql(ctx: RequestContext): Promise<void> {
  const { req, res, rawBody } = ctx;
  let payload = {};
  try {
    payload = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    sendJson(res, 400, { errors: [{ message: "Invalid JSON body" }] });
    return;
  }
  const result = await executeGraphql(payload, req.headers);
  sendJson(res, result.status, result.body);
}

function handleRequestLog({ res, testId }: RequestContext): void {
  sendJson(res, 200, { testId, requests: getEntries(testId) });
}

function handleReset({ res, testId }: RequestContext): void {
  resetEntries(testId);
  sendJson(res, 200, { ok: true, testId });
}

type RouteHandler = (ctx: RequestContext) => void | Promise<void>;

const ROUTES: Record<string, RouteHandler> = {
  "/__health": ({ res }) => sendJson(res, 200, { ok: true }),
  "/__requests": handleRequestLog,
  "/__reset": handleReset,
  "/echo": handleEcho,
  "/redirect": handleRedirect,
  "/cookies": handleCookies,
  "/large": handleLarge,
  "/binary": handleBinary,
  [GRAPHQL_PATH]: handleGraphql,
  "/slow": handleEcho,
};

const INTERNAL_PATH_PREFIX = "/__";

async function route(ctx: RequestContext): Promise<void> {
  const delayMs =
    ctx.path === "/slow"
      ? positiveInt(ctx.query.get("delay"), SLOW_DEFAULT_MS)
      : positiveInt(ctx.query.get("delay"), 0);
  if (delayMs) await sleep(delayMs);
  const handler = ROUTES[ctx.path] ?? handleEcho;
  await handler(ctx);
}

export async function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://mock.local");
  const testId = resolveTestId(req.headers, url.searchParams);
  const ctx: RequestContext = {
    req,
    res,
    path: url.pathname,
    query: url.searchParams,
    testId,
    rawBody: await readBody(req),
  };
  if (!url.pathname.startsWith(INTERNAL_PATH_PREFIX)) {
    recordEntry({
      kind: "http",
      event: "request",
      testId,
      method: req.method,
      path: url.pathname,
      query: queryToObject(url.searchParams),
      headers: req.headers,
    });
  }
  try {
    await route(ctx);
  } catch (error) {
    console.error(`Mock server: ${req.method} ${url.pathname} failed`, error);
    if (!res.headersSent) sendJson(res, 500, { error: String(error) });
  }
}
