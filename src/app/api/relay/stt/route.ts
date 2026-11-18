import { GROK_STT_URL, STT_MAX_UPLOAD_BYTES } from "@/lib/relay/constants";
import type { RelayErrorCode } from "@/lib/relay/errors";
import { guardRelayRequest, isSameOrigin } from "@/lib/relay/server/guard";
import {
  buildUpstreamForm,
  mapUpstreamFailure,
  type SttErrorCode,
  toTranscript,
} from "@/lib/relay/stt";

export const maxDuration = 60;

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_LENGTH_REQUIRED = 411;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_UNSUPPORTED_MEDIA = 415;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const WAV_TYPE = "audio/wav";
const REQUEST_ID_HEADER = "x-request-id";
/** Bounds the upstream call; the function itself is capped at `maxDuration`. */
const UPSTREAM_TIMEOUT_MS = 30_000;
/** Multipart framing and the language field on top of the audio itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function fail(
  code: SttErrorCode | RelayErrorCode,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: code },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

/** Browsers always send a length for FormData; null means missing or malformed. */
function declaredLength(req: Request): number | null {
  const header = req.headers.get("content-length");
  if (!header) return null;
  const length = Number(header);
  return Number.isFinite(length) && length >= 0 ? length : null;
}

function readLanguage(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Transcribes a WAV recording with Grok; guards run in the STT-01 order. */
export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return fail("relay_unavailable", HTTP_FORBIDDEN);
  // Flag and rate limit run before the upload is buffered; the LLM key is not
  // needed here, STT has its own provider key.
  const guard = await guardRelayRequest({ req, route: "stt" });
  if (!guard.ok) {
    const retry: Record<string, string> = guard.retryAfterSeconds
      ? { "Retry-After": String(guard.retryAfterSeconds) }
      : {};
    return fail(guard.code, guard.status, retry);
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return fail("not_configured", HTTP_SERVICE_UNAVAILABLE);

  // formData() buffers the whole upload, so an unknown length is refused first.
  const declared = declaredLength(req);
  if (declared === null) return fail("bad_audio", HTTP_LENGTH_REQUIRED);
  if (declared > STT_MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return fail("too_large", HTTP_PAYLOAD_TOO_LARGE);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_audio", HTTP_BAD_REQUEST);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return fail("bad_audio", HTTP_BAD_REQUEST);
  if (audio.type.split(";")[0]?.trim() !== WAV_TYPE) {
    return fail("bad_audio", HTTP_UNSUPPORTED_MEDIA);
  }
  if (audio.size > STT_MAX_UPLOAD_BYTES) {
    return fail("too_large", HTTP_PAYLOAD_TOO_LARGE);
  }

  const language = readLanguage(form.get("language"));
  let upstream: Response;
  try {
    upstream = await fetch(GROK_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: buildUpstreamForm(audio, language),
      signal: AbortSignal.any([
        req.signal,
        AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      ]),
    });
  } catch (error) {
    // Timeout and client abort both land here and read as "try again".
    console.error("[relay/stt] upstream unreachable", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return fail("unavailable", HTTP_SERVICE_UNAVAILABLE);
  }

  const failure = mapUpstreamFailure(
    upstream.status,
    upstream.headers.get("retry-after"),
  );
  if (failure) {
    console.error("[relay/stt] upstream failed", {
      status: upstream.status,
      requestId: upstream.headers.get(REQUEST_ID_HEADER),
    });
    const retry: Record<string, string> = failure.retryAfter
      ? { "Retry-After": failure.retryAfter }
      : {};
    return fail(failure.code, failure.status, retry);
  }

  const transcript = toTranscript(
    await upstream.json().catch(() => null),
    language,
  );
  if (!transcript) return fail("unavailable", HTTP_BAD_GATEWAY);
  return Response.json(transcript, { headers: NO_STORE });
}
