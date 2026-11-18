"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  ArrowConfigPanelBody,
  type ArrowConfigPanelBodyProps,
} from "./arrow-config/ArrowConfigPanelBody";
import { FormattedJsonResponseBody } from "./arrow-config/FormattedJsonResponseBody";
import { useOpenSessionKey } from "./arrow-config/useOpenSessionKey";

type ArrowConfigPanelProps = Omit<
  ArrowConfigPanelBodyProps,
  "onViewResponse"
> & {
  open: boolean;
};

export function ArrowConfigPanel({
  open,
  onClose,
  ...bodyProps
}: ArrowConfigPanelProps) {
  const t = useTranslations("chain");
  const [viewerOpen, setViewerOpen] = useState(false);
  const { sourceRequest, sourceRunState, sourceResponse } = bodyProps;
  const sessionKey = useOpenSessionKey(
    open,
    `${bodyProps.displayNodeId ?? ""}|${bodyProps.existingEdge?.id ?? ""}`,
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:w-[420px] border-l border-border bg-card flex flex-col p-0"
      >
        <ArrowConfigPanelBody
          key={sessionKey}
          {...bodyProps}
          onClose={onClose}
          onViewResponse={() => setViewerOpen(true)}
        />
      </SheetContent>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0 bg-muted/20">
            <DialogTitle className="text-base">
              {t("arrowConfigResponseTitle", {
                name: sourceRequest?.name ?? "",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-card p-5 font-mono text-xs">
            {sourceRunState === "running" ? (
              <div className="text-muted-foreground flex items-center gap-2 animate-pulse motion-reduce:animate-none">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                {t("arrowConfigRunningRequest")}
              </div>
            ) : sourceResponse ? (
              <FormattedJsonResponseBody body={sourceResponse.body} />
            ) : (
              <div className="text-muted-foreground">
                {t("arrowConfigNoResponse")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
