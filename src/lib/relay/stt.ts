import { GROK_STT_MODEL, STT_FORMAT_LANGUAGES } from "@/lib/relay/constants";

export const STT_ERROR_CODES = [
  "bad_audio",
  "upstream_auth",
  "too_large",
  "rate_limited",
  "unavailable",
  "not_configured",
] as const;
export type SttErrorCode = (typeof STT_ERROR_CODES)[number];

export type SttTranscript = {
  text: string;
  language: string;
  duration: number;
};

export type SttFailure = {
  code: SttErrorCode;
  status: number;
  /** Passed through from the upstream 429 so the client can wait. */
  retryAfter?: string | null;
};

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;

export function supportsFormatting(language: string | undefined): boolean {
  return (
    language !== undefined &&
    (STT_FORMAT_LANGUAGES as readonly string[]).includes(language)
  );
}

/**
 * Builds the upstream form. Grok reads fields in order, so the options come
 * first and the audio `file` must be the last field.
 */
export function buildUpstreamForm(audio: Blob, language?: string): FormData {
  const form = new FormData();
  form.append("model", GROK_STT_MODEL);
  if (language) form.append("language", language);
  if (supportsFormatting(language)) form.append("format", "true");
  form.append("file", audio, "audio.wav");
  return form;
}

/** Maps an upstream status to the STT-05 route response; null means success. */
export function mapUpstreamFailure(
  status: number,
  retryAfter: string | null,
): SttFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === HTTP_BAD_REQUEST) {
    return { code: "bad_audio", status: HTTP_BAD_REQUEST };
  }
  if (status === HTTP_UNAUTHORIZED) {
    return { code: "upstream_auth", status: HTTP_BAD_GATEWAY };
  }
  if (status === HTTP_PAYLOAD_TOO_LARGE) {
    return { code: "too_large", status: HTTP_PAYLOAD_TOO_LARGE };
  }
  if (status === HTTP_TOO_MANY_REQUESTS) {
    return { code: "rate_limited", status: HTTP_TOO_MANY_REQUESTS, retryAfter };
  }
  return { code: "unavailable", status: HTTP_SERVICE_UNAVAILABLE };
}

/** Reduces the upstream payload to the only three fields the client receives. */
export function toTranscript(
  payload: unknown,
  requestedLanguage: string | undefined,
): SttTranscript | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { text, language, duration } = payload as Record<string, unknown>;
  if (typeof text !== "string") return null;
  return {
    text,
    language:
      typeof language === "string" ? language : (requestedLanguage ?? ""),
    duration: typeof duration === "number" ? duration : 0,
  };
}
