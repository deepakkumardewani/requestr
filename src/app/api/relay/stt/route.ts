import { GROK_STT_URL, STT_MAX_UPLOAD_BYTES } from "@/lib/relay/constants";
import {
  HTTP_NOT_FOUND,
  isRelayFlagOff,
  isSameOrigin,
} from "@/lib/relay/server/guard";
import {
  buildUpstreamForm,
  mapUpstreamFailure,
  type SttErrorCode,
  toTranscript,
} from "@/lib/relay/stt";

export const maxDuration = 60;

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_UNSUPPORTED_MEDIA = 415;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const WAV_TYPE = "audio/wav";
const REQUEST_ID_HEADER = "x-request-id";
const NO_STORE = { "Cache-Control": "no-store" };

function fail(
  code: SttErrorCode | "relay_unavailable",
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: code },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

function readLanguage(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Transcribes a WAV recording with Grok; guards run in the STT-01 order. */
export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return fail("relay_unavailable", HTTP_FORBIDDEN);
  if (isRelayFlagOff()) return fail("not_configured", HTTP_NOT_FOUND);
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return fail("not_configured", HTTP_SERVICE_UNAVAILABLE);

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
    });
  } catch {
    console.error("[relay/stt] upstream unreachable");
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
