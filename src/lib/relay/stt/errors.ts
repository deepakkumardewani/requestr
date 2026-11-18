/** Keys under `relay.voice.grokErrors` in the message files. */
export type GrokDictationError =
  | "denied"
  | "noMic"
  | "tooShort"
  | "badAudio"
  | "upstreamAuth"
  | "tooLarge"
  | "busy"
  | "unavailable"
  | "network";

/** Route error codes (STT-05) mapped to the client message key. */
const ERROR_BY_ROUTE_CODE: Record<string, GrokDictationError> = {
  bad_audio: "badAudio",
  upstream_auth: "upstreamAuth",
  too_large: "tooLarge",
  rate_limited: "busy",
  unavailable: "unavailable",
  not_configured: "unavailable",
  relay_unavailable: "unavailable",
};

export function errorFromRouteCode(code: unknown): GrokDictationError {
  return (
    (typeof code === "string" && ERROR_BY_ROUTE_CODE[code]) || "unavailable"
  );
}

/** Maps a getUserMedia rejection; anything else is treated as a missing microphone. */
export function errorFromMicFailure(error: unknown): GrokDictationError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  return "noMic";
}

/** Failure of the transcription request, carrying the message key to show. */
export class SttRequestError extends Error {
  constructor(readonly kind: GrokDictationError) {
    super(`Grok transcription failed: ${kind}`);
    this.name = "SttRequestError";
  }
}
