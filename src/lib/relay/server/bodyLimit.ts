export type LimitedBody =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" };

const TOO_LARGE: LimitedBody = { ok: false, reason: "too_large" };

function declaredLength(req: Request): number | null {
  const header = req.headers.get("content-length");
  if (!header) return null;
  const length = Number(header);
  return Number.isFinite(length) && length >= 0 ? length : null;
}

/**
 * Reads a request body without ever buffering more than `maxBytes`. The
 * declared `Content-Length` is only a fast path: a chunked or lying client is
 * still cut off mid-stream, and the rest of the upload is cancelled.
 */
export async function readBodyWithLimit(
  req: Request,
  maxBytes: number,
): Promise<LimitedBody> {
  const declared = declaredLength(req);
  if (declared !== null && declared > maxBytes) {
    await req.body?.cancel();
    return TOO_LARGE;
  }
  if (!req.body) return { ok: true, text: "" };

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return TOO_LARGE;
    }
    text += decoder.decode(value, { stream: true });
  }
  return { ok: true, text: text + decoder.decode() };
}
