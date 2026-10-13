import type { UIMessage } from "ai";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { isRelayToolName } from "@/lib/relay/tools/schemas";

const TOOL_PART_PREFIX = "tool-";

/** The slice of an AI SDK tool part that a row needs. */
export type ToolRowPart = {
  type: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolOutcome = { ok: boolean; data?: unknown; error?: string };

type MessagePart = UIMessage["parts"][number];

export const isToolPart = (
  part: MessagePart,
): part is MessagePart & ToolRowPart => part.type.startsWith(TOOL_PART_PREFIX);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function asOutcome(output: unknown): ToolOutcome | null {
  const record = asRecord(output);
  return typeof record.ok === "boolean" ? (record as ToolOutcome) : null;
}

/** What the row says the tool touched, taken from its input or result. */
function describeTarget(
  tool: string,
  part: ToolRowPart,
  noResponse: string,
): string {
  const data = asRecord(asOutcome(part.output)?.data);
  switch (tool) {
    case "search_workspace":
      return String(asRecord(part.input).query ?? "");
    case "get_request":
      return `${data.method ?? ""} ${data.url ?? ""}`.trim();
    case "get_collection":
    case "get_environment":
      return String(data.name ?? "");
    case "get_last_response":
      return data.available === false ? noResponse : String(data.status ?? "");
    default:
      return "";
  }
}

function RowIcon({ phase }: { phase: "running" | "done" | "failed" }) {
  if (phase === "running") {
    return (
      <Loader2Icon
        aria-hidden
        className="size-3.5 animate-spin motion-reduce:animate-none"
      />
    );
  }
  const Icon = phase === "done" ? CheckIcon : XIcon;
  return (
    <Icon
      aria-hidden
      className={`size-3.5 ${phase === "failed" ? "text-destructive" : ""}`}
    />
  );
}

export function ToolRow({ part }: { part: ToolRowPart }) {
  const t = useTranslations("relay.tools");
  const name = part.type.slice(TOOL_PART_PREFIX.length);
  const key = isRelayToolName(name) ? name : "unknown";
  const outcome = asOutcome(part.output);
  const failureText =
    part.state === "output-error"
      ? part.errorText
      : outcome && !outcome.ok
        ? outcome.error
        : undefined;
  const finished = part.state === "output-available";
  const phase =
    failureText !== undefined ? "failed" : finished ? "done" : "running";
  const detail = describeTarget(name, part, t("noResponse"));
  const label =
    phase === "failed" ? t("failed") : t(`${key}.${phase}`, { detail });

  return (
    <div
      data-testid="relay-tool-row"
      data-state={phase}
      role={phase === "failed" ? "alert" : undefined}
      className="my-1 text-xs text-muted-foreground"
    >
      <p className="flex items-center gap-1.5">
        <RowIcon phase={phase} />
        <span>{label}</span>
      </p>
      {failureText ? (
        <p className="pl-5" data-testid="relay-tool-error">
          {failureText}
        </p>
      ) : null}
    </div>
  );
}
