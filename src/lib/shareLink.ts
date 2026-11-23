import { z } from "zod";
import { track } from "@/lib/analytics/adapter";
import type { EventMap } from "@/lib/analytics/events";
import { decryptPayload, encryptPayload } from "@/lib/crypto";
import {
  alignLocalStateWithServerRateLimit,
  getLocalShareRateBlock,
  recordLocalShareSuccess,
} from "@/lib/shareRateLimitLocal";
import type { HttpTab } from "@/types";

/** Server payloads live 24h (`SHARE_PAYLOAD_TTL_SEC`), i.e. exactly one day. */
const SHARE_EXPIRY_BUCKET: EventMap["share_created"]["expiry_bucket"] = "1d-7d";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

const BODY_TYPES = [
  "none",
  "json",
  "xml",
  "text",
  "html",
  "form-data",
  "urlencoded",
] as const;

const KVPairSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  type: z.enum(["query", "path"]).optional(),
});

const AuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("bearer"), token: z.string() }),
  z.object({
    type: z.literal("basic"),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    type: z.literal("api-key"),
    key: z.string(),
    value: z.string(),
    addTo: z.enum(["header", "query"]),
  }),
]);

const BodyConfigSchema = z.object({
  type: z.enum(BODY_TYPES),
  content: z.string(),
  formData: z.array(KVPairSchema).optional(),
});

export const ShareRequestSchema = z.object({
  method: z.enum(HTTP_METHODS),
  url: z.string(),
  headers: z.array(KVPairSchema),
  params: z.array(KVPairSchema),
  body: BodyConfigSchema,
  auth: AuthConfigSchema,
});

export type SharePayload = z.infer<typeof ShareRequestSchema>;

export type CreateShareLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: "failed" }
  | { ok: false; error: "rate_limited"; resetAt?: number };

function requireWindow(): Window | null {
  if (globalThis.window === undefined) {
    return null;
  }
  return globalThis.window;
}

/**
 * Creates an encrypted, DB-backed share URL: `origin/?s={id}#{keyB64}`.
 * Returns `{ ok: false, error: ... }` on failure, or a discriminated `AbortError`
 * from `fetch` when `signal` aborts. Pass `signal` to cancel the `POST` in-flight.
 */
export async function createShareLink(
  tab: HttpTab,
  userId: string,
  signal?: AbortSignal,
): Promise<CreateShareLinkResult> {
  const win = requireWindow();
  if (!win || !userId) {
    return { ok: false, error: "failed" };
  }

  const localBlock = getLocalShareRateBlock();
  if (localBlock.blocked) {
    return {
      ok: false,
      error: "rate_limited",
      resetAt: localBlock.resetAtMs,
    };
  }

  const payload: SharePayload = {
    method: tab.method,
    url: tab.url,
    headers: tab.headers,
    params: tab.params,
    body: tab.body,
    auth: tab.auth,
  };

  let plaintext: string;
  try {
    plaintext = JSON.stringify(payload);
  } catch {
    return { ok: false, error: "failed" };
  }

  let ciphertext: string;
  let iv: string;
  let keyB64: string;
  try {
    const out = await encryptPayload(plaintext);
    ciphertext = out.ciphertext;
    iv = out.iv;
    keyB64 = out.keyB64;
  } catch {
    return { ok: false, error: "failed" };
  }

  try {
    const res = await win.fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext, iv, userId }),
      signal,
    });
    if (!res.ok) {
      let errBody: unknown;
      try {
        errBody = await res.json();
      } catch {
        errBody = null;
      }
      const isRateLimited =
        res.status === 429 ||
        (typeof errBody === "object" &&
          errBody !== null &&
          "code" in errBody &&
          (errBody as { code: string }).code === "RATE_LIMIT");
      if (isRateLimited) {
        let resetAt: number | undefined;
        if (
          typeof errBody === "object" &&
          errBody !== null &&
          "resetAt" in errBody
        ) {
          const v = (errBody as { resetAt: unknown }).resetAt;
          if (typeof v === "number" && Number.isFinite(v)) {
            resetAt = v;
          }
        }
        alignLocalStateWithServerRateLimit(resetAt);
        return {
          ok: false,
          error: "rate_limited",
          ...(resetAt != null ? { resetAt } : {}),
        };
      }
      return { ok: false, error: "failed" };
    }
    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("id" in data) ||
      typeof (data as { id: unknown }).id !== "string"
    ) {
      return { ok: false, error: "failed" };
    }
    const { id } = data as { id: string };
    if (id.length === 0) {
      return { ok: false, error: "failed" };
    }
    recordLocalShareSuccess();
    track("share_created", { expiry_bucket: SHARE_EXPIRY_BUCKET });
    return {
      ok: true,
      url: `${win.location.origin}/?s=${encodeURIComponent(id)}#${keyB64}`,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw e;
    }
    return { ok: false, error: "failed" };
  }
}

/**
 * Fetches ciphertext for `id`, reads the AES key from `window.location.hash`,
 * decrypts, and validates. Returns `null` on any failure.
 */
export async function fetchSharePayload(
  id: string,
): Promise<SharePayload | null> {
  const win = requireWindow();
  if (!win) {
    return null;
  }

  const hash = win.location.hash;
  if (hash.length <= 1) {
    return null;
  }
  const keyB64 = hash.slice(1);
  if (!keyB64) {
    return null;
  }

  let ciphertext: string;
  let iv: string;
  try {
    const res = await win.fetch(`/api/share/${encodeURIComponent(id)}`);
    if (!res.ok) {
      return null;
    }
    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("ciphertext" in data) ||
      !("iv" in data) ||
      typeof (data as { ciphertext: unknown }).ciphertext !== "string" ||
      typeof (data as { iv: unknown }).iv !== "string"
    ) {
      return null;
    }
    ciphertext = (data as { ciphertext: string }).ciphertext;
    iv = (data as { iv: string }).iv;
  } catch {
    return null;
  }

  let plaintext: string;
  try {
    plaintext = await decryptPayload(ciphertext, iv, keyB64);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }

  const result = ShareRequestSchema.safeParse(parsed);
  if (!result.success) return null;
  track("share_opened");
  return result.data;
}
