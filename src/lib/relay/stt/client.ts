import { errorFromRouteCode, SttRequestError } from "./errors";

const STT_URL = "/api/relay/stt";
const AUDIO_FIELD = "audio";

export type TranscribeOptions = {
  language?: string;
  signal?: AbortSignal;
};

async function readErrorCode(response: Response): Promise<unknown> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return body?.error;
}

/**
 * Uploads a WAV to the Relay route and returns the transcript text.
 * Throws `SttRequestError` for route and network failures; an aborted request
 * rethrows the browser's AbortError so the caller can discard silently.
 */
export async function transcribeAudio(
  audio: Blob,
  { language, signal }: TranscribeOptions = {},
): Promise<string> {
  const form = new FormData();
  if (language) form.append("language", language);
  form.append(AUDIO_FIELD, audio, "audio.wav");

  let response: Response;
  try {
    response = await fetch(STT_URL, { method: "POST", body: form, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn("[relay] speech upload failed", { error });
    throw new SttRequestError("network");
  }
  if (!response.ok) {
    throw new SttRequestError(
      errorFromRouteCode(await readErrorCode(response)),
    );
  }
  const body = (await response.json().catch(() => null)) as {
    text?: unknown;
  } | null;
  if (typeof body?.text !== "string") throw new SttRequestError("unavailable");
  return body.text;
}
