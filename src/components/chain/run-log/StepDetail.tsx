"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RunStep } from "@/lib/chainRunHistory";
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
  step: RunStep;
};

export function StepDetail({ step }: StepDetailProps) {
  const t = useTranslations("chain");
  const tabIds: StepDetailTabId[] = step.error
    ? [...BASE_TAB_IDS, ERROR_TAB_ID]
    : [...BASE_TAB_IDS];

  const [activeTab, setActiveTab] = useState<StepDetailTabId>("input");

  // Reset to the Input tab whenever a different step is selected, but keep the
  // current tab when the same step's data is merely updated in place.
  useEffect(() => {
    setActiveTab("input");
  }, [step.id]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as StepDetailTabId)}
      className="flex h-full flex-col gap-0"
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
      </TabsList>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <TabsContent value="input">
          <InputTab step={step} />
        </TabsContent>
        <TabsContent value="output">
          <OutputTab step={step} />
        </TabsContent>
        <TabsContent value="assertions">
          <AssertionsTab step={step} />
        </TabsContent>
        <TabsContent value="extracted">
          <ExtractedTab step={step} />
        </TabsContent>
        {step.error && (
          <TabsContent value="error">
            <ErrorTab step={step} />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
