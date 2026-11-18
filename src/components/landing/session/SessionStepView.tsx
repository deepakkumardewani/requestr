import { CheckIcon, PencilIcon, ShieldAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionMethod, SessionStep } from "../data/sessions";

const STEP_ENTER = "motion-safe:animate-[panel-in_220ms_ease-out_both]";
const CARD_CLASS = "rounded-lg border border-border bg-card/60 px-3 py-2";

const METHOD_COLOR: Record<SessionMethod, string> = {
  GET: "var(--method-get)",
  POST: "var(--method-post)",
};

function MethodTag({ method }: { method: SessionMethod }) {
  return (
    <span
      className="shrink-0 font-mono text-[10px] font-bold"
      style={{ color: METHOD_COLOR[method] }}
    >
      {method}
    </span>
  );
}

function ToolRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </p>
  );
}

interface ChangeCardProps {
  label: string;
  method?: SessionMethod;
}

function ChangeCard({ label, method }: ChangeCardProps) {
  return (
    <div className={cn(CARD_CLASS, "flex items-center gap-2 text-xs")}>
      <PencilIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      {method ? <MethodTag method={method} /> : null}
      <span className="min-w-0 flex-1 truncate text-foreground/90">
        {label}
      </span>
      <span className="shrink-0 text-muted-foreground">Undo</span>
    </div>
  );
}

interface ConfirmCardProps {
  title: string;
  detail: string;
  /** True once the run has moved past this step, i.e. it was approved. */
  resolved: boolean;
}

function ConfirmCard({ title, detail, resolved }: ConfirmCardProps) {
  return (
    <div className={cn(CARD_CLASS, "space-y-1.5 text-xs")}>
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <ShieldAlertIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-warning"
        />
        {title}
      </p>
      <p className="text-muted-foreground">{detail}</p>
      {resolved ? (
        <p className="text-muted-foreground">Approved</p>
      ) : (
        <p className="flex gap-2 pt-0.5">
          <span className="rounded-md bg-primary px-2 py-0.5 font-medium text-primary-foreground">
            Approve
          </span>
          <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
            Decline
          </span>
        </p>
      )}
    </div>
  );
}

interface ResponseRowProps {
  status: string;
  meta: string;
}

function ResponseRow({ status, meta }: ResponseRowProps) {
  return (
    <p className="flex items-center gap-2 font-mono text-xs">
      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
        {status}
      </span>
      <span className="text-muted-foreground">{meta}</span>
    </p>
  );
}

function renderStep(step: SessionStep, resolved: boolean): React.ReactNode {
  switch (step.kind) {
    case "tool":
      return <ToolRow label={step.label} />;
    case "change":
      return <ChangeCard label={step.label} method={step.method} />;
    case "confirm":
      return (
        <ConfirmCard
          title={step.title}
          detail={step.detail}
          resolved={resolved}
        />
      );
    case "response":
      return <ResponseRow status={step.status} meta={step.meta} />;
    case "reply":
      return (
        <p className="text-sm leading-relaxed text-foreground/90">
          {step.text}
        </p>
      );
  }
}

interface SessionStepViewProps {
  step: SessionStep;
  /** True when a later step is already on screen. */
  resolved: boolean;
}

export function SessionStepView({ step, resolved }: SessionStepViewProps) {
  return <li className={STEP_ENTER}>{renderStep(step, resolved)}</li>;
}
