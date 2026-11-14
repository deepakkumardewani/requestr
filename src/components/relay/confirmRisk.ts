import type { ConfirmPreview } from "@/lib/relay/tools/registry";

export type ConfirmRisk = {
  kind: "script" | "shareValues" | "tlsOff" | "baseUrl" | "header" | "download";
  /** Names the thing that changes, for the summary line; no summary without it. */
  subject?: string;
};

type RiskInput = {
  baseUrl?: unknown;
  headers?: unknown;
};

/** Which risk copy a tool call in Review mode gets; null for tools with none. */
export function confirmRiskFor(
  toolName: string,
  input: unknown,
  preview: ConfirmPreview,
): ConfirmRisk | null {
  const { baseUrl, headers } = (input ?? {}) as RiskInput;
  switch (toolName) {
    case "set_request_scripts":
      return { kind: "script", subject: preview.targets[0] };
    case "update_proxy_settings":
      return { kind: "tlsOff" };
    case "set_relay_preferences":
      return { kind: "shareValues" };
    case "export_history":
    case "export_postman":
      return { kind: "download" };
    case "set_global_variables":
      if (typeof baseUrl === "string") {
        return { kind: "baseUrl", subject: baseUrl };
      }
      return {
        kind: "header",
        subject: Array.isArray(headers) ? headers[0]?.key : undefined,
      };
    default:
      return null;
  }
}
