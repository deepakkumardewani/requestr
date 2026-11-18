"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import type { RunStep } from "@/lib/chainRunHistory";
import type { EnvPromotion } from "@/types/chain";
import { RunLogEmptyState } from "./RunLogEmptyState";
import { StepWarnings } from "./StepWarnings";
import { AssertionsTab } from "./tabs/AssertionsTab";
import { ErrorTab } from "./tabs/ErrorTab";
import { ExtractedTab } from "./tabs/ExtractedTab";
import { InputTab } from "./tabs/InputTab";
import { OutputTab } from "./tabs/OutputTab";

/** Ordered tab ids for a step's detail view. The Error tab is appended only when the step has an error. */
const BASE_TAB_IDS = ["input", "output", "assertions", "extracted"] as const;
const ERROR_TAB_ID = "error" as const;

type StepDetailTabId = (typeof BASE_TAB_IDS)[number] | typeof ERROR_TAB_ID;

const TAB_LABEL_KEY: Record<StepDetailTabId, string> = {
  input: "runLogTabInput",
  output: "runLogTabOutput",
  assertions: "runLogTabAssertions",
  extracted: "runLogTabExtracted",
  error: "runLogTabError",
};

type StepDetailProps = {
  /** Absent when no step is selected; a placeholder is shown instead. */
  step?: RunStep;
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;
  promotableEdgeIds?: ReadonlySet<string>;
};

const COPIED_ANNOUNCEMENT_MS = 2000;

const hasError = (step: RunStep) => Boolean(step.error || step.errorCode);

/** Failed steps open on Error, passed steps on Output; others have no result yet, so Input. */
const defaultTabFor = (step: RunStep): StepDetailTabId => {
  if (hasError(step)) return ERROR_TAB_ID;
  return step.state === "passed" ? "output" : "input";
};

type CopyActionProps = {
  label: string;
  text: string;
};

/** Icon button that copies `text`, then toasts and announces "Copied" via aria-live. */
function CopyAction({ label, text }: CopyActionProps) {
  const t = useTranslations("chain");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_ANNOUNCEMENT_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        toast.success(t("runLogCopyCopied"));
      })
      .catch((err) => {
        console.error("Clipboard write failed", err);
      });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        aria-label={label}
        title={label}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("runLogCopyCopied") : ""}
      </span>
    </>
  );
}

export function StepDetail({ step, ...rest }: StepDetailProps) {
  if (!step) {
    return (
      <div className="flex h-full">
        <RunLogEmptyState kind="noStepSelected" />
      </div>
    );
  }
  return <StepDetailBody step={step} {...rest} />;
}

function StepDetailBody({
  step,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
  promotableEdgeIds,
}: StepDetailProps & { step: RunStep }) {
  const t = useTranslations("chain");
  const chainErrorMessage = useChainErrorMessage();
  const tabIds: StepDetailTabId[] = hasError(step)
    ? [...BASE_TAB_IDS, ERROR_TAB_ID]
    : [...BASE_TAB_IDS];

  const [activeTab, setActiveTab] = useState<StepDetailTabId>(
    defaultTabFor(step),
  );

  // Reset to the default tab whenever a different step is selected, but keep the
  // current tab when the same step's data is merely updated in place.
  useEffect(() => {
    setActiveTab(defaultTabFor(step));
  }, [step.id]);

  const copyAction =
    activeTab === "output" && step.response ? (
      <CopyAction label={t("runLogCopyResponse")} text={step.response.body} />
    ) : activeTab === ERROR_TAB_ID && hasError(step) ? (
      <CopyAction
        label={t("runLogCopyError")}
        text={chainErrorMessage(step.errorCode, step.errorParams, step.error)}
      />
    ) : null;

  return (
    <div className="flex h-full flex-col">
      <StepWarnings warnings={step.warnings} />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as StepDetailTabId)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="h-7 shrink-0 border-b border-border px-2"
        >
          {tabIds.map((tabId) => (
            <TabsTrigger key={tabId} value={tabId} className="h-6 px-2 text-xs">
              {t(TAB_LABEL_KEY[tabId])}
            </TabsTrigger>
          ))}
          {copyAction}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <TabsContent value="input">
            <InputTab step={step} />
          </TabsContent>
          <TabsContent value="output">
            <OutputTab step={step} />
          </TabsContent>
          <TabsContent value="assertions">
            <AssertionsTab step={step} assertions={step.assertions} />
          </TabsContent>
          <TabsContent value="extracted">
            <ExtractedTab
              step={step}
              envPromotions={envPromotions}
              onSavePromotion={onSavePromotion}
              onRemovePromotion={onRemovePromotion}
              promotableEdgeIds={promotableEdgeIds}
            />
          </TabsContent>
          {hasError(step) && (
            <TabsContent value="error">
              <ErrorTab step={step} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
