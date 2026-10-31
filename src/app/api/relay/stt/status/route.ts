import {
  HTTP_NOT_FOUND,
  isRelayFlagOff,
  isSameOrigin,
} from "@/lib/relay/server/guard";

const HTTP_FORBIDDEN = 403;
const NO_STORE = { "Cache-Control": "no-store" };

/** Whether server-side speech-to-text is set up; the answer is a flag, never key material. */
export function GET(req: Request): Response {
  if (!isSameOrigin(req)) {
    return Response.json(
      { error: "relay_unavailable" },
      { status: HTTP_FORBIDDEN, headers: NO_STORE },
    );
  }
  if (isRelayFlagOff()) {
    return Response.json(
      { error: "not_configured" },
      { status: HTTP_NOT_FOUND, headers: NO_STORE },
    );
  }
  return Response.json(
    { configured: Boolean(process.env.XAI_API_KEY) },
    { headers: NO_STORE },
  );
}
